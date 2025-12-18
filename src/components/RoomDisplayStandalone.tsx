'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCurrentAndNextMeeting } from '@/lib/graphService';
import { format } from 'date-fns';
import DeviceCodeLogin from './DeviceCodeLogin';

interface Meeting {
  subject: string;
  start: { dateTime: string };
  end: { dateTime: string };
  organizer?: { emailAddress: { name: string } };
}

interface RoomConfig {
  roomName: string;
  calendarId?: string;
  calendarEmail?: string;
  backgroundImage?: string;
}

interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export default function RoomDisplayStandalone() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null);
  const [allEvents, setAllEvents] = useState<Meeting[]>([]);
  const [roomConfig, setRoomConfig] = useState<RoomConfig>({ roomName: 'Meeting Room' });
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [pressTimer, setPressTimer] = useState<NodeJS.Timeout | null>(null);

  // 长按显示设置
  const handlePressStart = () => {
    const timer = setTimeout(() => {
      setShowSettings(true);
      setTimeout(() => setShowSettings(false), 10000);
    }, 3000);
    setPressTimer(timer);
  };

  const handlePressEnd = () => {
    if (pressTimer) {
      clearTimeout(pressTimer);
      setPressTimer(null);
    }
  };

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

  // 检查已保存的 token
  useEffect(() => {
    const saved = localStorage.getItem('deviceTokenInfo');
    if (saved) {
      const info = JSON.parse(saved) as TokenInfo;
      if (info.expiresAt > Date.now()) {
        setTokenInfo(info);
        setIsAuthenticated(true);
      } else {
        refreshToken(info.refreshToken);
      }
    }
    setLoading(false);
  }, []);

  // 刷新 token
  const refreshToken = async (refreshTokenStr: string) => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: refreshTokenStr }),
      });

      const data = await response.json();

      if (response.ok) {
        const newTokenInfo: TokenInfo = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + data.expiresIn * 1000,
        };
        localStorage.setItem('deviceTokenInfo', JSON.stringify(newTokenInfo));
        setTokenInfo(newTokenInfo);
        setIsAuthenticated(true);
      } else {
        localStorage.removeItem('deviceTokenInfo');
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Refresh token error:', err);
      localStorage.removeItem('deviceTokenInfo');
      setIsAuthenticated(false);
    }
  };

  // 获取日历数据
  const fetchCalendarData = useCallback(async () => {
    if (!tokenInfo) return;

    try {
      setError(null);

      if (tokenInfo.expiresAt - Date.now() < 5 * 60 * 1000) {
        await refreshToken(tokenInfo.refreshToken);
        return;
      }

      const data = await getCurrentAndNextMeeting(
        tokenInfo.accessToken,
        roomConfig.calendarId,
        roomConfig.calendarEmail
      );
      setCurrentMeeting(data.currentMeeting);
      setNextMeeting(data.nextMeeting);
      setAllEvents(data.allEvents);
    } catch (err) {
      console.error('获取日历数据失败:', err);
      setError('无法获取日历数据');

      if (tokenInfo.refreshToken) {
        await refreshToken(tokenInfo.refreshToken);
      }
    }
  }, [tokenInfo, roomConfig.calendarId, roomConfig.calendarEmail]);

  // 定时刷新数据
  useEffect(() => {
    if (isAuthenticated && tokenInfo) {
      fetchCalendarData();
      const interval = setInterval(fetchCalendarData, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, tokenInfo, fetchCalendarData]);

  // 登录成功回调
  const handleLoginSuccess = (info: TokenInfo) => {
    setTokenInfo(info);
    setIsAuthenticated(true);
  };

  // 登出
  const handleLogout = () => {
    localStorage.removeItem('deviceTokenInfo');
    setTokenInfo(null);
    setIsAuthenticated(false);
    setCurrentMeeting(null);
    setNextMeeting(null);
    setAllEvents([]);
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
    if (diff <= 0) return 'Ending soon';
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m remaining`;
    }
    return `${minutes} min remaining`;
  };

  // 计算距离开始时间
  const getTimeUntilStart = (startDateString: string) => {
    const start = new Date(startDateString + 'Z');
    const diff = start.getTime() - currentTime.getTime();
    if (diff <= 0) return 'Starting now';
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `in ${hours}h ${minutes % 60}m`;
    }
    return `in ${minutes} min`;
  };

  // 加载中
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // 未登录状态
  if (!isAuthenticated) {
    return <DeviceCodeLogin onLoginSuccess={handleLoginSuccess} />;
  }

  const isOccupied = currentMeeting !== null;

  return (
    <div className="min-h-screen relative overflow-hidden select-none">
      {/* 背景图片 */}
      {roomConfig.backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${roomConfig.backgroundImage})` }}
        >
          <div className={`absolute inset-0 ${
            isOccupied
              ? 'bg-gradient-to-br from-red-900/90 via-red-800/85 to-rose-900/90'
              : 'bg-gradient-to-br from-emerald-900/90 via-teal-800/85 to-cyan-900/90'
          }`} />
        </div>
      )}

      {/* 默认渐变背景（无背景图时） */}
      {!roomConfig.backgroundImage && (
        <div className={`absolute inset-0 transition-all duration-1000 ${
          isOccupied
            ? 'bg-gradient-to-br from-red-950 via-rose-900 to-red-950'
            : 'bg-gradient-to-br from-emerald-950 via-teal-900 to-emerald-950'
        }`}>
          {/* 背景装饰 */}
          <div className="absolute inset-0 overflow-hidden">
            <div className={`absolute top-0 right-0 w-[800px] h-[800px] rounded-full blur-[150px] opacity-30 ${
              isOccupied ? 'bg-red-600' : 'bg-emerald-600'
            }`} />
            <div className={`absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full blur-[150px] opacity-20 ${
              isOccupied ? 'bg-orange-600' : 'bg-cyan-600'
            }`} />
          </div>
        </div>
      )}

      {/* 主内容 */}
      <div className="relative z-10 min-h-screen flex flex-col p-6 md:p-10">
        {/* 顶部栏 */}
        <div className="flex justify-between items-start mb-auto">
          {/* 日期 */}
          <div className="text-white/70 text-lg md:text-xl font-light">
            {format(currentTime, 'EEEE')}
            <span className="mx-2 text-white/40">|</span>
            {format(currentTime, 'MMM d, yyyy')}
          </div>

          {/* 时间 */}
          <div className="text-right">
            <div className="text-white text-5xl md:text-7xl font-thin tracking-tight tabular-nums">
              {format(currentTime, 'HH:mm')}
            </div>
            <div className="text-white/50 text-sm md:text-base font-light">
              {format(currentTime, 'ss')} sec
            </div>
          </div>
        </div>

        {/* 中间主要区域 */}
        <div className="flex-1 flex flex-col items-center justify-center py-8">
          {/* 状态指示条 */}
          <div className={`w-32 h-2 rounded-full mb-8 ${
            isOccupied
              ? 'bg-red-500 shadow-lg shadow-red-500/50'
              : 'bg-emerald-500 shadow-lg shadow-emerald-500/50'
          }`}>
            <div className={`w-full h-full rounded-full animate-pulse ${
              isOccupied ? 'bg-red-400' : 'bg-emerald-400'
            }`} />
          </div>

          {/* 房间名称 */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-white mb-6 tracking-tight text-center">
            {roomConfig.roomName}
          </h1>

          {/* 状态文字 */}
          <div className={`text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-8 ${
            isOccupied ? 'text-red-400' : 'text-emerald-400'
          }`}>
            {isOccupied ? 'BUSY' : 'FREE'}
          </div>

          {/* 当前会议信息卡片 */}
          {currentMeeting && (
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 max-w-2xl w-full border border-white/10">
              <div className="text-center">
                <div className="text-white/60 text-sm uppercase tracking-widest mb-2">
                  Current Meeting
                </div>
                <div className="text-2xl md:text-3xl text-white font-semibold mb-4 line-clamp-2">
                  {currentMeeting.subject}
                </div>
                <div className="flex items-center justify-center gap-4 text-white/80">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-lg">
                      {formatTime(currentMeeting.start.dateTime)} - {formatTime(currentMeeting.end.dateTime)}
                    </span>
                  </div>
                </div>
                <div className={`mt-4 text-lg font-medium ${isOccupied ? 'text-red-300' : 'text-emerald-300'}`}>
                  {getTimeRemaining(currentMeeting.end.dateTime)}
                </div>
                {currentMeeting.organizer && (
                  <div className="mt-3 text-white/50 text-sm">
                    Organizer: {currentMeeting.organizer.emailAddress.name}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 空闲时下一场会议 */}
          {!currentMeeting && nextMeeting && (
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 max-w-xl w-full border border-white/10">
              <div className="text-center">
                <div className="text-white/50 text-sm uppercase tracking-widest mb-2">
                  Next Meeting
                </div>
                <div className="text-xl text-white font-medium mb-2">
                  {nextMeeting.subject}
                </div>
                <div className="text-white/60">
                  {formatTime(nextMeeting.start.dateTime)} - {formatTime(nextMeeting.end.dateTime)}
                  <span className="mx-2">·</span>
                  <span className="text-emerald-400">{getTimeUntilStart(nextMeeting.start.dateTime)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 今日无会议 */}
          {!currentMeeting && !nextMeeting && (
            <div className="text-white/50 text-xl">
              No meetings scheduled for today
            </div>
          )}
        </div>

        {/* 底部今日日程 */}
        {allEvents.length > 0 && (
          <div className="mt-auto">
            <div className="text-white/40 text-xs uppercase tracking-widest mb-3">
              Today&apos;s Schedule
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
              {allEvents.map((event, index) => {
                const start = new Date(event.start.dateTime + 'Z');
                const end = new Date(event.end.dateTime + 'Z');
                const isNow = start <= currentTime && end > currentTime;
                const isPast = end <= currentTime;

                return (
                  <div
                    key={index}
                    className={`flex-shrink-0 px-4 py-3 rounded-xl transition-all min-w-[140px] ${
                      isNow
                        ? isOccupied
                          ? 'bg-red-500/30 border border-red-400/50 text-white'
                          : 'bg-emerald-500/30 border border-emerald-400/50 text-white'
                        : isPast
                        ? 'bg-white/5 text-white/30 border border-transparent'
                        : 'bg-white/10 text-white/70 border border-white/10'
                    }`}
                  >
                    <div className="text-xs opacity-70 mb-1">
                      {formatTime(event.start.dateTime)} - {formatTime(event.end.dateTime)}
                    </div>
                    <div className="text-sm font-medium line-clamp-1">
                      {event.subject}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 隐藏的触发区域 - 长按右上角3秒显示设置 */}
      <div
        className="absolute top-0 right-0 w-32 h-32 z-20"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      />

      {/* 设置和登出按钮 */}
      {showSettings && (
        <div className="absolute top-6 right-6 flex gap-3 z-30">
          <a
            href="/display/admin"
            className="p-3 bg-white/20 hover:bg-white/30 rounded-xl transition-all backdrop-blur-sm"
            title="Settings"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </a>
          <button
            onClick={handleLogout}
            className="p-3 bg-white/20 hover:bg-red-500/50 rounded-xl transition-all backdrop-blur-sm"
            title="Logout"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-xl z-30 backdrop-blur-sm">
          {error}
        </div>
      )}
    </div>
  );
}
