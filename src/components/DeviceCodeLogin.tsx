'use client';

import { useState, useEffect, useCallback } from 'react';

interface DeviceCodeResponse {
  userCode: string;
  deviceCode: string;
  verificationUri: string;
  expiresIn: number;
  interval: number;
  message: string;
}

interface TokenInfo {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface DeviceCodeLoginProps {
  onLoginSuccess: (tokenInfo: TokenInfo) => void;
}

export default function DeviceCodeLogin({ onLoginSuccess }: DeviceCodeLoginProps) {
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<DeviceCodeResponse | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  // Request device code
  const requestDeviceCode = async () => {
    try {
      setStatus('waiting');
      setError(null);

      const response = await fetch('/api/auth/device-code', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get device code');
      }

      setDeviceCodeInfo(data);
      setCountdown(data.expiresIn);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Poll for token
  const pollForToken = useCallback(async () => {
    if (!deviceCodeInfo) return;

    try {
      console.log('Polling for token...');
      const response = await fetch('/api/auth/device-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceCode: deviceCodeInfo.deviceCode }),
      });

      const data = await response.json();
      console.log('Poll response:', data);

      if (data.status === 'success') {
        const tokenInfo: TokenInfo = {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresAt: Date.now() + data.expiresIn * 1000,
        };

        // Save to localStorage
        localStorage.setItem('deviceTokenInfo', JSON.stringify(tokenInfo));

        setStatus('success');
        onLoginSuccess(tokenInfo);
      } else if (data.status === 'failed' || data.error) {
        setStatus('error');
        setError(data.error || 'Authorization failed');
      }
      // If pending, continue waiting
    } catch (err) {
      console.error('Poll error:', err);
      setStatus('error');
      setError('Network error while checking authorization');
    }
  }, [deviceCodeInfo, onLoginSuccess]);

  // Polling logic
  useEffect(() => {
    if (status !== 'waiting' || !deviceCodeInfo) return;

    console.log('Starting polling with interval:', deviceCodeInfo.interval || 5, 'seconds');

    // Execute immediately
    pollForToken();

    const interval = setInterval(() => {
      pollForToken();
    }, (deviceCodeInfo.interval || 5) * 1000);

    return () => {
      console.log('Clearing polling interval');
      clearInterval(interval);
    };
  }, [status, deviceCodeInfo, pollForToken]);

  // Countdown
  useEffect(() => {
    if (countdown <= 0 || status !== 'waiting') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setStatus('error');
          setError('Code expired. Please try again.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, status]);

  // Retry
  const handleRetry = () => {
    setStatus('idle');
    setDeviceCodeInfo(null);
    setError(null);
    setCountdown(0);
  };

  // Format countdown
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        {/* Title */}
        <h1 className="text-4xl font-bold text-white text-center mb-8">
          Meeting Room Display
        </h1>

        {/* Initial state */}
        {status === 'idle' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
            <p className="text-gray-300 mb-8 text-lg">
              Connect to Microsoft 365 Calendar
            </p>

            <button
              onClick={requestDeviceCode}
              className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold rounded-xl transition-all mb-4"
            >
              Login with Code
            </button>

            <p className="text-gray-500 text-sm">
              Perfect for tablets and kiosk devices
            </p>
          </div>
        )}

        {/* Waiting for user to enter code */}
        {status === 'waiting' && deviceCodeInfo && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
            <div className="mb-6">
              <p className="text-gray-300 text-lg mb-4">
                Visit this URL on your phone or computer:
              </p>
              <div className="bg-white/20 rounded-xl p-4 mb-6">
                <a
                  href={deviceCodeInfo.verificationUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-2xl text-blue-400 font-mono hover:underline"
                >
                  {deviceCodeInfo.verificationUri}
                </a>
              </div>

              <p className="text-gray-300 text-lg mb-4">
                Then enter this code:
              </p>
              <div className="bg-blue-600 rounded-xl p-6 mb-6">
                <span className="text-5xl font-bold text-white tracking-widest font-mono">
                  {deviceCodeInfo.userCode}
                </span>
              </div>

              {/* Countdown */}
              <div className="flex items-center justify-center gap-2 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Waiting for authorization... {formatCountdown(countdown)}</span>
              </div>
            </div>

            <button
              onClick={handleRetry}
              className="text-gray-400 hover:text-white text-sm underline"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div className="bg-green-900/50 backdrop-blur-sm rounded-2xl p-8 text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Login Successful!</h2>
            <p className="text-gray-300">Loading calendar data...</p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="bg-red-900/50 backdrop-blur-sm rounded-2xl p-8 text-center">
            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Login Failed</h2>
            <p className="text-gray-300 mb-6">{error}</p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl transition-all"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
