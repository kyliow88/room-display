'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

interface Meeting {
  subject: string;
  start: { dateTime: string };
  end: { dateTime: string };
  location?: string;
  organizer?: { emailAddress: { name: string } };
}

interface SkeddaConfig {
  spaceName: string;
  embedUrl?: string;
  icalUrl?: string;
  displayMode: 'embed' | 'ical' | 'status';
  backgroundImage?: string;
}

interface SkeddaStatusDisplayProps {
  config: SkeddaConfig;
}

export default function SkeddaStatusDisplay({ config }: SkeddaStatusDisplayProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | null>(null);
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null);
  const [allEvents, setAllEvents] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Update time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch calendar data
  const fetchCalendarData = useCallback(async () => {
    if (!config.icalUrl) {
      setLoading(false);
      setError('No iCal URL configured');
      return;
    }

    try {
      setError(null);
      const response = await fetch('/api/skedda/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ icalUrl: config.icalUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch calendar');
      }

      setCurrentMeeting(data.currentMeeting);
      setNextMeeting(data.nextMeeting);
      setAllEvents(data.allEvents || []);
    } catch (err) {
      console.error('Failed to fetch calendar:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar');
    } finally {
      setLoading(false);
    }
  }, [config.icalUrl]);

  // Fetch data on mount and periodically
  useEffect(() => {
    fetchCalendarData();
    const interval = setInterval(fetchCalendarData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchCalendarData]);

  // Format time
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, 'HH:mm');
  };

  // Calculate time remaining
  const getTimeRemaining = (endDateString: string) => {
    const end = new Date(endDateString);
    const diff = end.getTime() - currentTime.getTime();
    if (diff <= 0) return 'Ending soon';
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m remaining`;
    }
    return `${minutes} min remaining`;
  };

  // Calculate time until start
  const getTimeUntilStart = (startDateString: string) => {
    const start = new Date(startDateString);
    const diff = start.getTime() - currentTime.getTime();
    if (diff <= 0) return 'Starting now';
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `in ${hours}h ${minutes % 60}m`;
    }
    return `in ${minutes} min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-2xl">Loading calendar...</div>
      </div>
    );
  }

  if (error && !currentMeeting && !nextMeeting) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">{error}</div>
          <a
            href="/skedda/admin"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
          >
            Configure iCal URL
          </a>
        </div>
      </div>
    );
  }

  const isOccupied = currentMeeting !== null;
  const statusColor = isOccupied ? 'text-red-500' : 'text-emerald-500';
  const statusBorderColor = isOccupied ? 'border-red-500/30' : 'border-emerald-500/30';
  const statusBgColor = isOccupied ? 'bg-red-500' : 'bg-emerald-500';

  return (
    <div className="min-h-screen relative overflow-hidden select-none bg-slate-950">
      {/* Background image */}
      {config.backgroundImage && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${config.backgroundImage})` }}
        />
      )}

      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute top-1/2 left-1/4 w-[600px] h-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[200px] opacity-10 ${statusBgColor}`} />
      </div>

      {/* Main content - left/right split */}
      <div className="relative z-10 min-h-screen flex flex-col lg:flex-row">

        {/* Left side - Status area */}
        <div className="lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-12">
          {/* Status indicator */}
          <div className="flex items-center gap-3 mb-6">
            <div className={`w-4 h-4 rounded-full animate-pulse ${statusBgColor} shadow-lg ${isOccupied ? 'shadow-red-500/50' : 'shadow-emerald-500/50'}`} />
            <span className="text-white/50 text-sm uppercase tracking-widest">Status</span>
          </div>

          {/* Status text */}
          <div className={`text-7xl md:text-8xl lg:text-9xl font-black tracking-tighter ${statusColor}`}>
            {isOccupied ? 'BUSY' : 'FREE'}
          </div>

          {/* Room name */}
          <div className="mt-8 text-center">
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight">
              {config.spaceName}
            </h1>
            <div className="text-white/40 text-sm mt-2">Powered by Skedda</div>
          </div>

          {/* Time display */}
          <div className="mt-12 text-center">
            <div className="text-6xl md:text-7xl font-thin text-white/90 tabular-nums tracking-tight">
              {format(currentTime, 'HH:mm')}
            </div>
            <div className="text-white/40 text-lg mt-2">
              {format(currentTime, 'EEEE, MMM d')}
            </div>
          </div>

          {/* Book button - link to Skedda */}
          {!isOccupied && config.embedUrl && (
            <a
              href={config.embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-10 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white text-xl font-semibold rounded-2xl transition-all shadow-lg shadow-emerald-500/30 hover:shadow-emerald-400/40"
            >
              Book Now
            </a>
          )}
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px bg-gradient-to-b from-transparent via-white/20 to-transparent" />

        {/* Right side - Meeting info */}
        <div className="lg:w-1/2 flex flex-col p-8 lg:p-12">

          {/* Current meeting */}
          {currentMeeting && (
            <div className={`rounded-2xl border ${statusBorderColor} bg-white/5 backdrop-blur-sm p-6 lg:p-8 mb-6`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-2 h-2 rounded-full ${statusBgColor}`} />
                <span className="text-white/50 text-xs uppercase tracking-widest">Current Booking</span>
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
                  Booked by: {currentMeeting.organizer.emailAddress.name}
                </div>
              )}
            </div>
          )}

          {/* Next meeting */}
          {nextMeeting && (
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 lg:p-8 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-white/30" />
                <span className="text-white/50 text-xs uppercase tracking-widest">Next Booking</span>
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

          {/* No meetings */}
          {!currentMeeting && !nextMeeting && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className={`text-6xl mb-4 ${statusColor}`}>
                  <svg className="w-20 h-20 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-white/50 text-xl">
                  No bookings scheduled
                </div>
                <div className="text-white/30 text-sm mt-2">
                  Space is available all day
                </div>
              </div>
            </div>
          )}

          {/* Today's schedule */}
          {allEvents.length > 0 && (
            <div className="mt-auto pt-6 border-t border-white/10">
              <div className="text-white/40 text-xs uppercase tracking-widest mb-4">
                Today&apos;s Schedule
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {allEvents.map((event, index) => {
                  const start = new Date(event.start.dateTime);
                  const end = new Date(event.end.dateTime);
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

      {/* Settings link */}
      <a
        href="/skedda/admin"
        className="absolute bottom-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all opacity-30 hover:opacity-100"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </a>

      {/* Error toast */}
      {error && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-red-500/90 text-white px-6 py-3 rounded-xl z-30 backdrop-blur-sm">
          {error}
        </div>
      )}
    </div>
  );
}
