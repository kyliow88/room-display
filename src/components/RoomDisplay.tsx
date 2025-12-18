'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from '@/config/authConfig';
import { getCurrentAndNextMeeting } from '@/lib/graphService';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface Meeting {
  subject: string;
  start: { dateTime: string };
  end: { dateTime: string };
  organizer?: { emailAddress: { name: string } };
}

interface RoomConfig {
  roomName: string;
  calendarId?: string;
}

export default function RoomDisplay() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null);
  const [allEvents, setAllEvents] = useState<Meeting[]>([]);
  const [roomConfig, setRoomConfig] = useState<RoomConfig>({ roomName: '会议室' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 更新时间
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 加载房间配置
  useEffect(() => {
    const saved = localStorage.getItem('roomConfig');
    if (saved) {
      setRoomConfig(JSON.parse(saved));
    }
  }, []);

  // 获取日历数据
  const fetchCalendarData = useCallback(async () => {
    if (!isAuthenticated || accounts.length === 0) return;

    try {
      setLoading(true);
      setError(null);

      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });

      const data = await getCurrentAndNextMeeting(response.accessToken, roomConfig.calendarId);
      setCurrentMeeting(data.currentMeeting);
      setNextMeeting(data.nextMeeting);
      setAllEvents(data.allEvents);
    } catch (err) {
      console.error('获取日历数据失败:', err);
      setError('无法获取日历数据');
    } finally {
      setLoading(false);
    }
  }, [instance, accounts, isAuthenticated, roomConfig.calendarId]);

  // 定时刷新数据
  useEffect(() => {
    if (isAuthenticated) {
      fetchCalendarData();
      const interval = setInterval(fetchCalendarData, 60000); // 每分钟刷新
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchCalendarData]);

  // 登录
  const handleLogin = async () => {
    try {
      await instance.loginPopup(loginRequest);
    } catch (err) {
      console.error('登录失败:', err);
    }
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString + 'Z');
    return format(date, 'HH:mm');
  };

  // 计算剩余时间
  const getTimeRemaining = (endDateString: string) => {
    const end = new Date(endDateString + 'Z');
    const diff = end.getTime() - currentTime.getTime();
    if (diff <= 0) return '即将结束';
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `剩余 ${hours}小时${minutes % 60}分钟`;
    }
    return `剩余 ${minutes} 分钟`;
  };

  // 计算距离开始时间
  const getTimeUntilStart = (startDateString: string) => {
    const start = new Date(startDateString + 'Z');
    const diff = start.getTime() - currentTime.getTime();
    if (diff <= 0) return '即将开始';
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}小时${minutes % 60}分钟后`;
    }
    return `${minutes} 分钟后`;
  };

  const isOccupied = currentMeeting !== null;

  // 未登录状态
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-8">会议室显示系统</h1>
          <p className="text-gray-400 mb-8">请登录 Microsoft 365 账号以连接日历</p>
          <button
            onClick={handleLogin}
            className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold rounded-xl transition-all duration-300 transform hover:scale-105"
          >
            登录 Microsoft 365
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-all duration-500 ${
      isOccupied
        ? 'bg-gradient-to-br from-red-900 via-red-800 to-red-900'
        : 'bg-gradient-to-br from-green-900 via-green-800 to-green-900'
    }`}>
      {/* 顶部状态栏 */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center">
        <div className="text-white/80 text-lg">
          {format(currentTime, 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
        </div>
        <div className="text-white text-4xl font-light tracking-wider">
          {format(currentTime, 'HH:mm:ss')}
        </div>
      </div>

      {/* 主显示区域 */}
      <div className="min-h-screen flex flex-col items-center justify-center px-8">
        {/* 房间名称 */}
        <h1 className="text-6xl md:text-8xl font-bold text-white mb-8 tracking-wide">
          {roomConfig.roomName}
        </h1>

        {/* 状态指示 */}
        <div className={`w-32 h-32 rounded-full mb-8 flex items-center justify-center shadow-2xl ${
          isOccupied ? 'bg-red-500' : 'bg-green-500'
        }`}>
          {isOccupied ? (
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        {/* 状态文字 */}
        <div className="text-5xl md:text-7xl font-bold text-white mb-4">
          {isOccupied ? '使用中' : '空闲'}
        </div>

        {/* 当前会议信息 */}
        {currentMeeting && (
          <div className="mt-8 text-center">
            <div className="text-3xl text-white/90 font-medium mb-2">
              {currentMeeting.subject}
            </div>
            <div className="text-2xl text-white/70">
              {formatTime(currentMeeting.start.dateTime)} - {formatTime(currentMeeting.end.dateTime)}
            </div>
            <div className="text-xl text-white/60 mt-2">
              {getTimeRemaining(currentMeeting.end.dateTime)}
            </div>
            {currentMeeting.organizer && (
              <div className="text-lg text-white/50 mt-2">
                组织者: {currentMeeting.organizer.emailAddress.name}
              </div>
            )}
          </div>
        )}

        {/* 下一个会议 */}
        {nextMeeting && (
          <div className="mt-12 p-6 bg-black/20 rounded-2xl backdrop-blur-sm">
            <div className="text-xl text-white/60 mb-2">下一场会议</div>
            <div className="text-2xl text-white font-medium">
              {nextMeeting.subject}
            </div>
            <div className="text-xl text-white/80 mt-2">
              {formatTime(nextMeeting.start.dateTime)} - {formatTime(nextMeeting.end.dateTime)}
            </div>
            <div className="text-lg text-white/60 mt-1">
              {getTimeUntilStart(nextMeeting.start.dateTime)}
            </div>
          </div>
        )}

        {/* 无会议提示 */}
        {!currentMeeting && !nextMeeting && (
          <div className="mt-8 text-2xl text-white/60">
            今日暂无会议安排
          </div>
        )}
      </div>

      {/* 底部今日日程 */}
      {allEvents.length > 0 && (
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-black/30 backdrop-blur-sm">
          <div className="text-white/60 text-sm mb-3">今日日程</div>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {allEvents.map((event, index) => {
              const start = new Date(event.start.dateTime + 'Z');
              const end = new Date(event.end.dateTime + 'Z');
              const isNow = start <= currentTime && end > currentTime;
              const isPast = end <= currentTime;

              return (
                <div
                  key={index}
                  className={`flex-shrink-0 px-4 py-2 rounded-lg ${
                    isNow
                      ? 'bg-white/30 text-white'
                      : isPast
                      ? 'bg-white/10 text-white/40'
                      : 'bg-white/20 text-white/80'
                  }`}
                >
                  <div className="text-sm font-medium">{event.subject}</div>
                  <div className="text-xs">
                    {formatTime(event.start.dateTime)} - {formatTime(event.end.dateTime)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 设置按钮 */}
      <a
        href="/admin"
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all"
        title="设置"
      >
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </a>

      {/* 错误提示 */}
      {error && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-red-500/80 text-white px-6 py-3 rounded-lg">
          {error}
        </div>
      )}
    </div>
  );
}
