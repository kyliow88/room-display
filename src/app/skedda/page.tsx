'use client';

import { useState, useEffect } from 'react';
import SkeddaDisplay from '@/components/skedda/SkeddaDisplay';
import SkeddaStatusDisplay from '@/components/skedda/SkeddaStatusDisplay';

interface SkeddaConfig {
  spaceName: string;
  embedUrl?: string;
  icalUrl?: string;
  displayMode: 'embed' | 'status';
  backgroundImage?: string;
}

export default function SkeddaPage() {
  const [config, setConfig] = useState<SkeddaConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Load config
  useEffect(() => {
    const saved = localStorage.getItem('skeddaConfig');
    if (saved) {
      const parsedConfig = JSON.parse(saved);
      // Check if background image was stored separately
      if (parsedConfig.backgroundImage === '__STORED_SEPARATELY__') {
        const storedImage = localStorage.getItem('skeddaBackgroundImage');
        if (storedImage) {
          parsedConfig.backgroundImage = storedImage;
        } else {
          parsedConfig.backgroundImage = '';
        }
      }
      setConfig(parsedConfig);
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

  if (!config) {
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

  // Status display mode (uses iCal feed)
  if (config.displayMode === 'status' && config.icalUrl) {
    return <SkeddaStatusDisplay config={config} />;
  }

  // Embed mode (shows Skedda booking page)
  if (config.embedUrl) {
    return <SkeddaDisplay config={config} />;
  }

  // No valid config
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-8">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-4xl font-bold text-white mb-8">Skedda Display</h1>
        <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
          <p className="text-gray-300 mb-6">
            Please configure a Skedda URL or iCal feed
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
