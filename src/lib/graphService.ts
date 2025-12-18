import { Client } from '@microsoft/microsoft-graph-client';

// 创建 Graph 客户端
export function createGraphClient(accessToken: string) {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

// 获取用户信息
export async function getUserInfo(accessToken: string) {
  const client = createGraphClient(accessToken);
  return await client.api('/me').get();
}

// 获取今日日历事件
export async function getTodayEvents(accessToken: string, calendarId?: string, calendarEmail?: string) {
  const client = createGraphClient(accessToken);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const startDateTime = today.toISOString();
  const endDateTime = tomorrow.toISOString();

  // 如果有会议室 Email，使用 getSchedule API
  if (calendarEmail) {
    try {
      const scheduleResponse = await client
        .api('/me/calendar/getSchedule')
        .post({
          schedules: [calendarEmail],
          startTime: {
            dateTime: startDateTime,
            timeZone: 'UTC'
          },
          endTime: {
            dateTime: endDateTime,
            timeZone: 'UTC'
          },
          availabilityViewInterval: 30
        });

      // 转换 schedule 数据为 events 格式
      const scheduleData = scheduleResponse.value?.[0];
      if (scheduleData?.scheduleItems) {
        return scheduleData.scheduleItems.map((item: {
          subject?: string;
          start: { dateTime: string };
          end: { dateTime: string };
          location?: string;
          status?: string;
        }) => ({
          subject: item.subject || 'Busy',
          start: { dateTime: item.start.dateTime.replace('Z', '') },
          end: { dateTime: item.end.dateTime.replace('Z', '') },
          location: item.location,
          status: item.status
        }));
      }
      return [];
    } catch (scheduleError) {
      console.error('getSchedule API failed:', scheduleError);
      // 如果 getSchedule 失败，尝试直接访问日历
      try {
        const response = await client
          .api(`/users/${calendarEmail}/calendar/calendarView`)
          .query({
            startDateTime: startDateTime,
            endDateTime: endDateTime
          })
          .select('subject,start,end,location,organizer,isAllDay')
          .orderby('start/dateTime')
          .top(50)
          .get();
        return response.value;
      } catch (calendarError) {
        console.error('Direct calendar access failed:', calendarError);
        throw new Error(`无法访问会议室日历。请确保已添加 Calendars.Read.Shared 权限，并且在 Azure 中已授权。`);
      }
    }
  }

  // 使用用户自己的日历
  let endpoint = '/me/calendar/events';
  if (calendarId) {
    endpoint = `/me/calendars/${calendarId}/events`;
  }

  const response = await client
    .api(endpoint)
    .filter(`start/dateTime ge '${startDateTime}' and start/dateTime lt '${endDateTime}'`)
    .orderby('start/dateTime')
    .select('subject,start,end,location,organizer,isAllDay')
    .top(50)
    .get();

  return response.value;
}

// 获取用户的所有日历
export async function getCalendars(accessToken: string) {
  const client = createGraphClient(accessToken);
  const response = await client.api('/me/calendars').get();
  return response.value;
}

// 获取当前和下一个会议
export async function getCurrentAndNextMeeting(accessToken: string, calendarId?: string, calendarEmail?: string) {
  const events = await getTodayEvents(accessToken, calendarId, calendarEmail);
  const now = new Date();

  let currentMeeting = null;
  let nextMeeting = null;

  for (const event of events) {
    const start = new Date(event.start.dateTime + 'Z');
    const end = new Date(event.end.dateTime + 'Z');

    if (start <= now && end > now) {
      currentMeeting = event;
    } else if (start > now && !nextMeeting) {
      nextMeeting = event;
    }

    if (currentMeeting && nextMeeting) break;
  }

  return { currentMeeting, nextMeeting, allEvents: events };
}

// 快速预订会议室
export async function quickBook(
  accessToken: string,
  subject: string,
  durationMinutes: number,
  roomEmail?: string,
  roomName?: string
) {
  const client = createGraphClient(accessToken);

  const now = new Date();
  const end = new Date(now.getTime() + durationMinutes * 60000);

  interface EventPayload {
    subject: string;
    start: { dateTime: string; timeZone: string };
    end: { dateTime: string; timeZone: string };
    location?: { displayName: string };
    attendees?: Array<{
      emailAddress: { address: string; name: string };
      type: string;
    }>;
  }

  const event: EventPayload = {
    subject: subject,
    start: {
      dateTime: now.toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: 'UTC',
    },
  };

  // 如果有会议室 email，添加为与会者和地点
  if (roomEmail) {
    event.location = {
      displayName: roomName || roomEmail,
    };
    event.attendees = [
      {
        emailAddress: {
          address: roomEmail,
          name: roomName || roomEmail,
        },
        type: 'resource',
      },
    ];
  }

  return await client.api('/me/calendar/events').post(event);
}
