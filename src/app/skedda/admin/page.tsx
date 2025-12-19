'use client';

import { useState, useEffect } from 'react';

interface SkeddaConfig {
  spaceName: string;
  embedUrl?: string;
  icalUrl?: string;
  displayMode: 'embed' | 'ical' | 'status';
}

export default function SkeddaAdminPage() {
  const [config, setConfig] = useState<SkeddaConfig>({
    spaceName: 'Meeting Room',
    embedUrl: '',
    icalUrl: '',
    displayMode: 'embed',
  });
  const [saved, setSaved] = useState(false);

  // Load saved config
  useEffect(() => {
    const saved = localStorage.getItem('skeddaConfig');
    if (saved) {
      setConfig(JSON.parse(saved));
    }
  }, []);

  // Save config
  const handleSave = () => {
    localStorage.setItem('skeddaConfig', JSON.stringify(config));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Skedda Settings</h1>
          <a
            href="/skedda"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
          >
            Back to Display
          </a>
        </div>

        {/* Settings Form */}
        <div className="space-y-6">
          {/* Space Name */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Display Settings</h2>

            <div className="mb-6">
              <label className="block text-gray-300 mb-2">Space Name</label>
              <input
                type="text"
                value={config.spaceName}
                onChange={(e) => setConfig({ ...config, spaceName: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-all"
                placeholder="e.g., Meeting Room A"
              />
            </div>
          </div>

          {/* Skedda Embed URL */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Skedda Embed</h2>

            <div className="mb-4">
              <label className="block text-gray-300 mb-2">Embed URL</label>
              <input
                type="url"
                value={config.embedUrl || ''}
                onChange={(e) => setConfig({ ...config, embedUrl: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-all"
                placeholder="https://your-space.skedda.com/booking"
              />
              <p className="text-gray-500 text-sm mt-2">
                Your Skedda booking page URL
              </p>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <h3 className="text-blue-400 font-medium mb-2">How to get your Skedda URL:</h3>
              <ol className="text-gray-300 text-sm space-y-2">
                <li>1. Login to your Skedda account</li>
                <li>2. Go to your booking page</li>
                <li>3. Copy the URL from the address bar</li>
                <li>4. It should look like: https://your-space.skedda.com/booking</li>
              </ol>
            </div>
          </div>

          {/* Optional: iCal Feed */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">iCal Feed (Optional)</h2>

            <div className="mb-4">
              <label className="block text-gray-300 mb-2">iCal URL</label>
              <input
                type="url"
                value={config.icalUrl || ''}
                onChange={(e) => setConfig({ ...config, icalUrl: e.target.value })}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-all"
                placeholder="https://your-space.skedda.com/ical/..."
              />
              <p className="text-gray-500 text-sm mt-2">
                For custom status display (coming soon)
              </p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
              <h3 className="text-yellow-400 font-medium mb-2">How to get iCal feed:</h3>
              <ol className="text-gray-300 text-sm space-y-2">
                <li>1. Login to Skedda as admin</li>
                <li>2. Go to Settings → Integrations</li>
                <li>3. Find the iCal/Calendar Sync option</li>
                <li>4. Copy the iCal feed URL</li>
              </ol>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            className={`w-full py-4 font-semibold rounded-xl transition-all ${
              saved
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {saved ? 'Saved!' : 'Save Settings'}
          </button>

          {/* Preview Link */}
          {config.embedUrl && (
            <a
              href="/skedda"
              className="block w-full py-4 text-center bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all"
            >
              Preview Display →
            </a>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-white/5 backdrop-blur-sm rounded-2xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">About Skedda Integration</h2>
          <div className="text-gray-300 space-y-3 text-sm">
            <p>This display embeds your Skedda booking page directly, allowing:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Real-time booking availability</li>
              <li>Direct booking from the display (if enabled)</li>
              <li>Automatic sync with Skedda</li>
            </ul>
            <p className="mt-4 text-gray-400">
              Note: For the best experience, consider setting up a dedicated
              &quot;Display&quot; view in Skedda with simplified options.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
