'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import SkeddaDisplay from '@/components/skedda/SkeddaDisplay';

interface SkeddaConfig {
  spaceName: string;
  embedUrl?: string;
  icalUrl?: string;
  displayMode: 'embed' | 'ical' | 'status';
}

export default function SkeddaPage() {
  const [config, setConfig] = useState<SkeddaConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load config
  useEffect(() => {
    const saved = localStorage.getItem('skeddaConfig');
    if (saved) {
      setConfig(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  // Screen wake lock
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

    requestWakeLock();

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!config || !config.embedUrl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8">
        <div className="max-w-lg w-full text-center">
          <h1 className="text-4xl font-bold text-white mb-8">Skedda Display</h1>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
            <p className="text-gray-300 mb-6">
              Please configure Skedda settings first
            </p>
            <a
              href="/skedda/admin"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all"
            >
              Go to Settings
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 relative">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex justify-between items-center bg-gradient-to-b from-slate-950 to-transparent">
        <div>
          <h1 className="text-2xl font-bold text-white">{config.spaceName}</h1>
        </div>
        <div className="text-right">
          <div className="text-3xl font-light text-white tabular-nums">
            {format(currentTime, 'HH:mm')}
          </div>
          <div className="text-white/50 text-sm">
            {format(currentTime, 'EEEE, MMM d')}
          </div>
        </div>
      </div>

      {/* Skedda Display */}
      <SkeddaDisplay config={config} />

      {/* Hidden settings trigger - long press top right */}
      <a
        href="/skedda/admin"
        className="absolute bottom-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all opacity-30 hover:opacity-100"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </a>
    </div>
  );
}
