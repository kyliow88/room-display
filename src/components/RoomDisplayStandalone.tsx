'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCurrentAndNextMeeting, quickBook, endMeetingEarly } from '@/lib/graphService';
import { format } from 'date-fns';
import DeviceCodeLogin from './DeviceCodeLogin';

interface Meeting {
  id?: string;
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
  const [showBooking, setShowBooking] = useState(false);
  const [bookingSubject, setBookingSubject] = useState('Quick Meeting');
  const [bookingDuration, setBookingDuration] = useState(30);
  const [isBooking, setIsBooking] = useState(false);
  const [isEndingMeeting, setIsEndingMeeting] = useState(false);

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

  // 保持屏幕常亮 (Wake Lock API)
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('Screen Wake Lock activated');
        }
      } catch (err) {
        console.log('Wake Lock error:', err);
      }
    };

    // 请求 Wake Lock
    requestWakeLock();

    // 页面重新可见时重新请求 (切换标签页后回来)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release();
      }
    };
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
      console.error('Failed to fetch calendar data:', err);
      setError('Unable to fetch calendar data');

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

  // 快速预订
  const handleQuickBook = async () => {
    if (!tokenInfo || isBooking) return;

    setIsBooking(true);
    try {
      await quickBook(
        tokenInfo.accessToken,
        bookingSubject,
        bookingDuration,
        roomConfig.calendarEmail,
        roomConfig.roomName
      );
      setShowBooking(false);
      setBookingSubject('Quick Meeting');
      setBookingDuration(30);
      // 刷新日历数据
      await fetchCalendarData();
    } catch (err) {
      console.error('Booking failed:', err);
      setError('Booking failed, please try again');
    } finally {
      setIsBooking(false);
    }
  };

  // 结束会议
  const handleEndMeeting = async () => {
    if (!tokenInfo || !currentMeeting?.id || isEndingMeeting) return;

    setIsEndingMeeting(true);
    try {
      await endMeetingEarly(tokenInfo.accessToken, currentMeeting.id);
      // 刷新日历数据
      await fetchCalendarData();
    } catch (err) {
      console.error('End meeting failed:', err);
      setError('Unable to end meeting, please try again');
    } finally {
      setIsEndingMeeting(false);
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  // 未登录状态
  if (!isAuthenticated) {
    return <DeviceCodeLogin onLoginSuccess={handleLoginSuccess} />;
  }

  const isOccupied = currentMeeting !== null;
  const statusColor = isOccupied ? 'text-red-500' : 'text-emerald-500';
  const statusBorderColor = isOccupied ? 'border-red-500/30' : 'border-emerald-500/30';
  const statusBgColor = isOccupied ? 'bg-red-500' : 'bg-emerald-500';

  return (
    <div className="min-h-screen relative overflow-hidden select-none bg-slate-950">
      {/* 背景图片 */}
      {roomConfig.backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${roomConfig.backgroundImage})` }}
        />
      )}

      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute top-1/2 left-1/4 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[200px] opacity-10 ${statusBgColor}`} />
      </div>

      {/* 主内容 - 左右分栏 */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">

        {/* 左侧 - 状态区域 */}
        <div className="lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-12">
          {/* 状态指示点 */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-4 h-4 rounded-full animate-pulse ${statusBgColor} shadow-lg ${isOccupied ? 'shadow-red-500/50' : 'shadow-emerald-500/50'}`} />
            <span className="text-white/50 text-sm uppercase tracking-widest">Status</span>
          </div>

          {/* 状态文字 */}
          <div className={`text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter ${statusColor}`}>
            {isOccupied ? 'BUSY' : 'FREE'}
          </div>

          {/* 房间名称 */}
          <div className="mt-8 text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight">
              {roomConfig.roomName}
            </h1>
          </div>

          {/* 时间显示 */}
          <div className="mt-12 text-center">
            <div className="text-6xl md:text-7xl font-thin text-white/90 tabular-nums tracking-tight">
              {format(currentTime, 'HH:mm')}
            </div>
            <div className="text-white/40 text-lg mt-2">
              {format(currentTime, 'EEEE, MMM d')}
            </div>
          </div>

          {/* 预订按钮 - 仅在空闲时显示 */}
          {!isOccupied && !showBooking && (
            <button
              onClick={() => setShowBooking(true)}
              className="mt-10 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white text-xl font-semibold rounded-2xl transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/40"
            >
              Book Now
            </button>
          )}
        </div>

        {/* 分隔线 */}
        <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />

        {/* 右侧 - 会议信息 */}
        <div className="lg:w-1/2 flex flex-col p-8 lg:p-12">

          {/* 当前会议 */}
          {currentMeeting && (
            <div className={`rounded-2xl border ${statusBorderColor} bg-white/5 backdrop-blur-sm p-6 lg:p-8 mb-6`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-2 h-2 rounded-full ${statusBgColor}`} />
                <span className="text-white/50 text-xs uppercase tracking-widest">Current Meeting</span>
              </div>
              <h2 className="text-2xl lg:text-3xl font-semibold text-white mb-4">
                {currentMeeting.subject}
              </h2>
              <div className="flex items-center gap-2 text-white/70 mb-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-lg">
                  {formatTime(currentMeeting.start.dateTime)} - {formatTime(currentMeeting.end.dateTime)}
                </span>
              </div>
              <div className={`text-lg font-medium ${statusColor}`}>
                {getTimeRemaining(currentMeeting.end.dateTime)}
              </div>
              {currentMeeting.organizer && (
                <div className="mt-4 pt-4 border-t border-white/10 text-white/40 text-sm">
                  Organizer: {currentMeeting.organizer.emailAddress.name}
                </div>
              )}

              {/* End Meeting Button - only show if we have event ID */}
              {currentMeeting.id && (
                <button
                  onClick={handleEndMeeting}
                  disabled={isEndingMeeting}
                  className="mt-4 w-full py-3 bg-red-500/20 hover:bg-red-500/40 disabled:bg-red-500/10 disabled:cursor-not-allowed text-red-400 font-semibold rounded-xl transition-all border border-red-500/30"
                >
                  {isEndingMeeting ? 'Ending...' : 'End Meeting Now'}
                </button>
              )}
            </div>
          )}

          {/* 下一场会议 */}
          {nextMeeting && (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 lg:p-8 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-white/30" />
                <span className="text-white/50 text-xs uppercase tracking-widest">Next Meeting</span>
              </div>
              <h3 className="text-xl lg:text-2xl font-medium text-white/90 mb-3">
                {nextMeeting.subject}
              </h3>
              <div className="text-white/60">
                {formatTime(nextMeeting.start.dateTime)} - {formatTime(nextMeeting.end.dateTime)}
                <span className="mx-3 text-white/30">·</span>
                <span className={statusColor}>{getTimeUntilStart(nextMeeting.start.dateTime)}</span>
              </div>
            </div>
          )}

          {/* 无会议状态 */}
          {!currentMeeting && !nextMeeting && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className={`text-6xl mb-4 ${statusColor}`}>
                  <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-white/50 text-xl">
                  No meetings scheduled
                </div>
                <div className="text-white/30 text-sm mt-2">
                  Room is available all day
                </div>
              </div>
            </div>
          )}

          {/* 今日日程 */}
          {allEvents.length > 0 && (
            <div className="mt-auto pt-6 border-t border-white/10">
              <div className="text-white/40 text-xs uppercase tracking-widest mb-4">
                Today&apos;s Schedule
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {allEvents.map((event, index) => {
                  const start = new Date(event.start.dateTime + 'Z');
                  const end = new Date(event.end.dateTime + 'Z');
                  const isNow = start <= currentTime && end > currentTime;
                  const isPast = end <= currentTime;

                  return (
                    <div
                      key={index}
                      className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                        isNow
                          ? `${isOccupied ? 'bg-red-500/20 border-l-2 border-red-500' : 'bg-emerald-500/20 border-l-2 border-emerald-500'}`
                          : isPast
                          ? 'opacity-40'
                          : 'bg-white/5'
                      }`}
                    >
                      <div className="text-white/50 text-sm w-24 flex-shrink-0">
                        {formatTime(event.start.dateTime)}
                      </div>
                      <div className={`text-sm flex-1 truncate ${isNow ? 'text-white font-medium' : 'text-white/70'}`}>
                        {event.subject}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
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
            className="p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all backdrop-blur-sm border border-white/10"
            title="Settings"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </a>
          <button
            onClick={handleLogout}
            className="p-3 bg-white/10 hover:bg-red-500/30 rounded-xl transition-all backdrop-blur-sm border border-white/10"
            title="Logout"
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      )}

      {/* 预订弹窗 */}
      {showBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowBooking(false)}
          />

          {/* 弹窗内容 */}
          <div className="relative bg-slate-900 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6">Quick Book</h2>

            {/* 会议名称 */}
            <div className="mb-6">
              <label className="block text-white/60 text-sm mb-2">Meeting Name</label>
              <input
                type="text"
                value={bookingSubject}
                onChange={(e) => setBookingSubject(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-emerald-500 transition-all"
                placeholder="Enter meeting name"
              />
            </div>

            {/* 时长选择 */}
            <div className="mb-8">
              <label className="block text-white/60 text-sm mb-3">Duration</label>
              <div className="grid grid-cols-4 gap-3">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => setBookingDuration(mins)}
                    className={`py-3 rounded-xl font-medium transition-all ${
                      bookingDuration === mins
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white/10 text-white/70 hover:bg-white/20'
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* 预订信息 */}
            <div className="mb-6 p-4 bg-white/5 rounded-xl">
              <div className="flex justify-between text-white/60 text-sm mb-2">
                <span>Start</span>
                <span className="text-white">{format(currentTime, 'HH:mm')}</span>
              </div>
              <div className="flex justify-between text-white/60 text-sm">
                <span>End</span>
                <span className="text-white">
                  {format(new Date(currentTime.getTime() + bookingDuration * 60000), 'HH:mm')}
                </span>
              </div>
            </div>

            {/* 按钮 */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowBooking(false)}
                className="flex-1 py-4 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleQuickBook}
                disabled={isBooking || !bookingSubject.trim()}
                className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all"
              >
                {isBooking ? 'Booking...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-xl z-30 backdrop-blur-sm">
          {error}
        </div>
      )}
    </div>
  );
}
