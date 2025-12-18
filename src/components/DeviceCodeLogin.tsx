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

  // 请求 device code
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

  // 轮询获取 token
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

        // 保存到 localStorage
        localStorage.setItem('deviceTokenInfo', JSON.stringify(tokenInfo));

        setStatus('success');
        onLoginSuccess(tokenInfo);
      } else if (data.status === 'failed' || data.error) {
        setStatus('error');
        setError(data.error || 'Authorization failed');
      }
      // 如果是 pending，继续等待
    } catch (err) {
      console.error('Poll error:', err);
      setStatus('error');
      setError('Network error while checking authorization');
    }
  }, [deviceCodeInfo, onLoginSuccess]);

  // 轮询逻辑
  useEffect(() => {
    if (status !== 'waiting' || !deviceCodeInfo) return;

    console.log('Starting polling with interval:', deviceCodeInfo.interval || 5, 'seconds');

    // 立即执行一次
    pollForToken();

    const interval = setInterval(() => {
      pollForToken();
    }, (deviceCodeInfo.interval || 5) * 1000);

    return () => {
      console.log('Clearing polling interval');
      clearInterval(interval);
    };
  }, [status, deviceCodeInfo, pollForToken]);

  // 倒计时
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

  // 重试
  const handleRetry = () => {
    setStatus('idle');
    setDeviceCodeInfo(null);
    setError(null);
    setCountdown(0);
  };

  // 格式化倒计时
  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-8">
      <div className="max-w-lg w-full">
        {/* 标题 */}
        <h1 className="text-4xl font-bold text-white text-center mb-8">
          会议室显示系统
        </h1>

        {/* 初始状态 - 显示两种登录方式 */}
        {status === 'idle' && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
            <p className="text-gray-300 mb-8 text-lg">
              选择登录方式连接 Microsoft 365 日历
            </p>

            <button
              onClick={requestDeviceCode}
              className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold rounded-xl transition-all mb-4"
            >
              使用代码登录
            </button>

            <p className="text-gray-500 text-sm">
              适合平板等不方便输入的设备
            </p>
          </div>
        )}

        {/* 等待用户输入代码 */}
        {status === 'waiting' && deviceCodeInfo && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
            <div className="mb-6">
              <p className="text-gray-300 text-lg mb-4">
                请在手机或电脑上访问：
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
                然后输入代码：
              </p>
              <div className="bg-blue-600 rounded-xl p-6 mb-6">
                <span className="text-5xl font-bold text-white tracking-widest font-mono">
                  {deviceCodeInfo.userCode}
                </span>
              </div>

              {/* 倒计时 */}
              <div className="flex items-center justify-center gap-2 text-gray-400">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>等待授权中... {formatCountdown(countdown)}</span>
              </div>
            </div>

            <button
              onClick={handleRetry}
              className="text-gray-400 hover:text-white text-sm underline"
            >
              取消
            </button>
          </div>
        )}

        {/* 成功 */}
        {status === 'success' && (
          <div className="bg-green-900/50 backdrop-blur-sm rounded-2xl p-8 text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">登录成功！</h2>
            <p className="text-gray-300">正在加载日历数据...</p>
          </div>
        )}

        {/* 错误 */}
        {status === 'error' && (
          <div className="bg-red-900/50 backdrop-blur-sm rounded-2xl p-8 text-center">
            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">登录失败</h2>
            <p className="text-gray-300 mb-6">{error}</p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl transition-all"
            >
              重试
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
