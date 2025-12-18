'use client';

import { useState, useEffect, useRef } from 'react';
import { getCalendars } from '@/lib/graphService';

interface Calendar {
  id: string;
  name: string;
  canEdit: boolean;
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

export default function AdminPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [roomConfig, setRoomConfig] = useState<RoomConfig>({ roomName: 'Meeting Room' });
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check login status
  useEffect(() => {
    const saved = localStorage.getItem('deviceTokenInfo');
    if (saved) {
      const info = JSON.parse(saved) as TokenInfo;
      if (info.expiresAt > Date.now()) {
        setTokenInfo(info);
        setIsAuthenticated(true);
      }
    }
    setLoading(false);
  }, []);

  // Load saved config
  useEffect(() => {
    const saved = localStorage.getItem('roomConfig');
    if (saved) {
      setRoomConfig(JSON.parse(saved));
    }
  }, []);

  // Fetch calendar list
  useEffect(() => {
    const fetchCalendars = async () => {
      if (!isAuthenticated || !tokenInfo) return;

      try {
        setCalendarLoading(true);
        const calendarList = await getCalendars(tokenInfo.accessToken);
        setCalendars(calendarList);
      } catch (err) {
        console.error('Failed to fetch calendars:', err);
      } finally {
        setCalendarLoading(false);
      }
    };

    fetchCalendars();
  }, [isAuthenticated, tokenInfo]);

  // Save config
  const handleSave = () => {
    try {
      setError(null);
      localStorage.setItem('roomConfig', JSON.stringify(roomConfig));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save failed:', err);
      if (err instanceof Error && err.name === 'QuotaExceededError') {
        setError('Storage quota exceeded. Please use a smaller image or enter an image URL.');
      } else {
        setError('Save failed, please try again');
      }
    }
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('deviceTokenInfo');
    setTokenInfo(null);
    setIsAuthenticated(false);
  };

  // Compress image
  const compressImage = (file: File, maxWidth: number = 1920, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Scale down proportionally
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to create canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setError(null);
        const compressedImage = await compressImage(file);
        setRoomConfig({ ...roomConfig, backgroundImage: compressedImage });
      } catch (err) {
        console.error('Image compression failed:', err);
        setError('Image processing failed, please try a smaller image');
      }
    }
  };

  // Clear background image
  const handleClearImage = () => {
    setRoomConfig({ ...roomConfig, backgroundImage: undefined });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        {/* Title */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Settings</h1>
          <a
            href="/display"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
          >
            Back to Display
          </a>
        </div>

        {/* Not logged in */}
        {!isAuthenticated && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
            <p className="text-gray-400 mb-6">Please login on the display page first</p>
            <a
              href="/display"
              className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all"
            >
              Go to Login
            </a>
          </div>
        )}

        {/* Logged in */}
        {isAuthenticated && (
          <div className="space-y-6">
            {/* Account info */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Account</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">Logged in</p>
                  <p className="text-gray-400 text-sm">Via Device Code</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600/50 hover:bg-red-600 text-white rounded-lg transition-all"
                >
                  Logout
                </button>
              </div>
            </div>

            {/* Room settings */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Room Settings</h2>

              {/* Room name */}
              <div className="mb-6">
                <label className="block text-gray-300 mb-2">Room Name</label>
                <input
                  type="text"
                  value={roomConfig.roomName}
                  onChange={(e) => setRoomConfig({ ...roomConfig, roomName: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="e.g., Meeting Room A"
                />
              </div>

              {/* Meeting room email */}
              <div className="mb-6">
                <label className="block text-gray-300 mb-2">Meeting Room Email</label>
                <input
                  type="email"
                  value={roomConfig.calendarEmail || ''}
                  onChange={(e) => setRoomConfig({ ...roomConfig, calendarEmail: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="e.g., MeetingRoomA@company.com"
                />
                <p className="text-gray-500 text-sm mt-2">
                  Enter the meeting room&apos;s email address
                </p>
              </div>

              {/* Or select from list */}
              <div className="mb-6">
                <label className="block text-gray-300 mb-2">Or Select Calendar</label>
                {calendarLoading ? (
                  <div className="text-gray-400">Loading calendars...</div>
                ) : (
                  <select
                    value={roomConfig.calendarId || ''}
                    onChange={(e) => setRoomConfig({ ...roomConfig, calendarId: e.target.value || undefined })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="" className="bg-gray-800">Don&apos;t use list</option>
                    {calendars.map((cal) => (
                      <option key={cal.id} value={cal.id} className="bg-gray-800">
                        {cal.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Save button */}
              <button
                onClick={handleSave}
                className={`w-full py-3 font-semibold rounded-lg transition-all ${
                  saved
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {saved ? 'Saved!' : 'Save Settings'}
              </button>
            </div>

            {/* Background image settings */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Background Image</h2>

              {/* Current background preview */}
              {roomConfig.backgroundImage && (
                <div className="mb-4">
                  <p className="text-gray-300 mb-2">Current background:</p>
                  <div className="relative w-full h-40 rounded-lg overflow-hidden">
                    <img
                      src={roomConfig.backgroundImage}
                      alt="Background preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={handleClearImage}
                      className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 rounded-full text-white"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Upload image */}
              <div className="mb-4">
                <label className="block text-gray-300 mb-2">Upload Image</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer"
                />
              </div>

              {/* Or enter image URL */}
              <div>
                <label className="block text-gray-300 mb-2">Or Enter Image URL</label>
                <input
                  type="url"
                  value={roomConfig.backgroundImage?.startsWith('data:') ? '' : roomConfig.backgroundImage || ''}
                  onChange={(e) => setRoomConfig({ ...roomConfig, backgroundImage: e.target.value || undefined })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              {/* Save background button */}
              <button
                onClick={handleSave}
                className="w-full mt-4 py-3 font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all"
              >
                Save Background
              </button>
            </div>

            {/* Instructions */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Instructions</h2>
              <div className="text-gray-300 space-y-3 text-sm">
                <p>1. Set the room name (displayed on screen)</p>
                <p>2. Enter the meeting room email (e.g., MeetingRoomA@company.com)</p>
                <p>3. Optional: Upload or enter a background image</p>
                <p>4. Save settings and return to display</p>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-red-500/20 border border-red-500 text-red-300 p-4 rounded-lg">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
