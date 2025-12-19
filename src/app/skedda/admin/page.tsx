'use client';

import { useState, useEffect, useRef } from 'react';

interface SkeddaConfig {
  spaceName: string;
  embedUrl?: string;
  icalUrl?: string;
  displayMode: 'embed' | 'status';
  backgroundImage?: string;
}

export default function SkeddaAdminPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [config, setConfig] = useState<SkeddaConfig>({
    spaceName: 'Meeting Room',
    embedUrl: '',
    icalUrl: '',
    displayMode: 'status',
    backgroundImage: '',
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

  // Compress and handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxWidth = 1920;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
            setConfig({ ...config, backgroundImage: compressedDataUrl });
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
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
          {/* Display Mode */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Display Mode</h2>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setConfig({ ...config, displayMode: 'status' })}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  config.displayMode === 'status'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                <div className="text-white font-semibold mb-1">Status Display</div>
                <div className="text-gray-400 text-sm">
                  Shows BUSY/FREE status like meeting room display
                </div>
              </button>
              <button
                onClick={() => setConfig({ ...config, displayMode: 'embed' })}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  config.displayMode === 'embed'
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                <div className="text-white font-semibold mb-1">Embed Booking</div>
                <div className="text-gray-400 text-sm">
                  Shows full Skedda booking page
                </div>
              </button>
            </div>
          </div>

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

          {/* iCal URL - for Status Display mode */}
          {config.displayMode === 'status' && (
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">iCal Calendar Feed</h2>

              <div className="mb-4">
                <label className="block text-gray-300 mb-2">iCal URL</label>
                <input
                  type="url"
                  value={config.icalUrl || ''}
                  onChange={(e) => setConfig({ ...config, icalUrl: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="https://wohhup.skedda.com/ical/..."
                />
              </div>

              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
                <h3 className="text-blue-400 font-medium mb-2">How to get your Skedda iCal URL:</h3>
                <ol className="text-gray-300 text-sm space-y-2">
                  <li>1. Login to Skedda as admin at <a href="https://wohhup.skedda.com" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">wohhup.skedda.com</a></li>
                  <li>2. Go to <strong>Settings</strong> → <strong>Integrations</strong></li>
                  <li>3. Find <strong>Calendar Sync / iCal</strong> option</li>
                  <li>4. Enable iCal feed for the space you want to display</li>
                  <li>5. Copy the iCal URL and paste it above</li>
                </ol>
              </div>
            </div>
          )}

          {/* Skedda Embed URL - for Embed mode */}
          {config.displayMode === 'embed' && (
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Skedda Embed</h2>

              <div className="mb-4">
                <label className="block text-gray-300 mb-2">Embed URL</label>
                <input
                  type="url"
                  value={config.embedUrl || ''}
                  onChange={(e) => setConfig({ ...config, embedUrl: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="https://wohhup.skedda.com/booking"
                />
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <p className="text-yellow-400 text-sm">
                  Your Skedda booking page: <a href="https://wohhup.skedda.com/booking" target="_blank" rel="noopener noreferrer" className="underline">https://wohhup.skedda.com/booking</a>
                </p>
              </div>
            </div>
          )}

          {/* Background Image */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Background Image (Optional)</h2>

            {config.backgroundImage && (
              <div className="mb-4">
                <p className="text-gray-300 mb-2">Current background:</p>
                <div className="relative w-full h-32 rounded-lg overflow-hidden">
                  <img
                    src={config.backgroundImage}
                    alt="Background preview"
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => {
                      setConfig({ ...config, backgroundImage: '' });
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 rounded-full text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-gray-300 mb-2">Upload Image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer"
              />
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
          {(config.icalUrl || config.embedUrl) && (
            <a
              href="/skedda"
              className="block w-full py-4 text-center bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all"
            >
              Preview Display →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
