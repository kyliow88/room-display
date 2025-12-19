import { NextRequest, NextResponse } from 'next/server';

interface CalendarEvent {
  id: string;
  subject: string;
  start: Date;
  end: Date;
  location?: string;
  organizer?: string;
}

// Parse iCal format to extract events
function parseICalToEvents(icalData: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = icalData.split(/\r\n|\n|\r/);

  let currentEvent: Partial<CalendarEvent> | null = null;
  let currentKey = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Handle line continuation (lines starting with space or tab)
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      i++;
      line += lines[i].substring(1);
    }

    if (line.startsWith('BEGIN:VEVENT')) {
      currentEvent = { id: `event-${Date.now()}-${Math.random()}` };
    } else if (line.startsWith('END:VEVENT') && currentEvent) {
      if (currentEvent.subject && currentEvent.start && currentEvent.end) {
        events.push(currentEvent as CalendarEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const keyPart = line.substring(0, colonIndex);
        const value = line.substring(colonIndex + 1);

        // Extract the key name (before any parameters like ;TZID=...)
        const key = keyPart.split(';')[0];

        switch (key) {
          case 'SUMMARY':
            currentEvent.subject = value;
            break;
          case 'DTSTART':
            currentEvent.start = parseICalDate(value);
            break;
          case 'DTEND':
            currentEvent.end = parseICalDate(value);
            break;
          case 'LOCATION':
            currentEvent.location = value;
            break;
          case 'ORGANIZER':
            // Extract email or name from ORGANIZER field
            const match = value.match(/CN=([^:]+)/);
            currentEvent.organizer = match ? match[1] : value.replace('mailto:', '');
            break;
          case 'UID':
            currentEvent.id = value;
            break;
        }
      }
    }
  }

  return events;
}

// Parse iCal date format
function parseICalDate(dateStr: string): Date {
  // Remove any timezone suffix and parse
  const cleanDate = dateStr.replace(/Z$/, '');

  // Format: YYYYMMDDTHHMMSS or YYYYMMDD
  if (cleanDate.length === 8) {
    // All day event: YYYYMMDD
    const year = parseInt(cleanDate.substring(0, 4));
    const month = parseInt(cleanDate.substring(4, 6)) - 1;
    const day = parseInt(cleanDate.substring(6, 8));
    return new Date(year, month, day);
  } else if (cleanDate.length >= 15) {
    // Date with time: YYYYMMDDTHHMMSS
    const year = parseInt(cleanDate.substring(0, 4));
    const month = parseInt(cleanDate.substring(4, 6)) - 1;
    const day = parseInt(cleanDate.substring(6, 8));
    const hour = parseInt(cleanDate.substring(9, 11));
    const minute = parseInt(cleanDate.substring(11, 13));
    const second = parseInt(cleanDate.substring(13, 15));

    // If original had Z suffix, it's UTC
    if (dateStr.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    return new Date(year, month, day, hour, minute, second);
  }

  return new Date(dateStr);
}

export async function POST(request: NextRequest) {
  try {
    const { icalUrl } = await request.json();

    if (!icalUrl) {
      return NextResponse.json({ error: 'iCal URL is required' }, { status: 400 });
    }

    // Fetch the iCal feed
    const response = await fetch(icalUrl, {
      headers: {
        'Accept': 'text/calendar',
      },
    });

    if (!response.ok) {
      return NextResponse.json({
        error: `Failed to fetch iCal feed: ${response.status}`
      }, { status: 500 });
    }

    const icalData = await response.text();

    // Parse the iCal data
    const allEvents = parseICalToEvents(icalData);

    // Filter to today's events
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todayEvents = allEvents
      .filter(event => {
        const eventStart = new Date(event.start);
        const eventEnd = new Date(event.end);
        // Event overlaps with today
        return eventStart < todayEnd && eventEnd > todayStart;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    // Find current and next meeting
    let currentMeeting = null;
    let nextMeeting = null;

    for (const event of todayEvents) {
      const start = new Date(event.start);
      const end = new Date(event.end);

      if (start <= now && end > now) {
        currentMeeting = {
          subject: event.subject,
          start: { dateTime: event.start.toISOString() },
          end: { dateTime: event.end.toISOString() },
          location: event.location,
          organizer: event.organizer ? { emailAddress: { name: event.organizer } } : undefined,
        };
      } else if (start > now && !nextMeeting) {
        nextMeeting = {
          subject: event.subject,
          start: { dateTime: event.start.toISOString() },
          end: { dateTime: event.end.toISOString() },
          location: event.location,
          organizer: event.organizer ? { emailAddress: { name: event.organizer } } : undefined,
        };
      }

      if (currentMeeting && nextMeeting) break;
    }

    // Format all events for display
    const formattedEvents = todayEvents.map(event => ({
      subject: event.subject,
      start: { dateTime: event.start.toISOString() },
      end: { dateTime: event.end.toISOString() },
      location: event.location,
      organizer: event.organizer ? { emailAddress: { name: event.organizer } } : undefined,
    }));

    return NextResponse.json({
      currentMeeting,
      nextMeeting,
      allEvents: formattedEvents,
    });

  } catch (error) {
    console.error('Calendar fetch error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch calendar'
    }, { status: 500 });
  }
}
