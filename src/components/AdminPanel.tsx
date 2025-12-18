'use client';

import { useState, useEffect, useRef } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { loginRequest } from '@/config/authConfig';
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

export default function AdminPanel() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [roomConfig, setRoomConfig] = useState<RoomConfig>({ roomName: '会议室' });
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载保存的配置
  useEffect(() => {
    const saved = localStorage.getItem('roomConfig');
    if (saved) {
      setRoomConfig(JSON.parse(saved));
    }
  }, []);

  // 获取日历列表
  useEffect(() => {
    const fetchCalendars = async () => {
      if (!isAuthenticated || accounts.length === 0) return;

      try {
        setLoading(true);
        const response = await instance.acquireTokenSilent({
          ...loginRequest,
          account: accounts[0],
        });

        const calendarList = await getCalendars(response.accessToken);
        setCalendars(calendarList);
      } catch (err) {
        console.error('获取日历列表失败:', err);
        setError('无法获取日历列表');
      } finally {
        setLoading(false);
      }
    };

    fetchCalendars();
  }, [instance, accounts, isAuthenticated]);

  // 登录
  const handleLogin = async () => {
    try {
      await instance.loginPopup(loginRequest);
    } catch (err) {
      console.error('登录失败:', err);
    }
  };

  // 保存配置
  const handleSave = () => {
    try {
      setError(null);
      localStorage.setItem('roomConfig', JSON.stringify(roomConfig));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('保存失败:', err);
      if (err instanceof Error && err.name === 'QuotaExceededError') {
        setError('存储空间不足。请尝试使用较小的图片或输入图片网址。');
      } else {
        setError('保存失败，请重试');
      }
    }
  };

  // 登出
  const handleLogout = () => {
    instance.logoutPopup();
  };

  // 压缩图片
  const compressImage = (file: File, maxWidth: number = 1920, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // 按比例缩小
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建 canvas context'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsDataURL(file);
    });
  };

  // 处理图片上传
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        setError(null);
        const compressedImage = await compressImage(file);
        setRoomConfig({ ...roomConfig, backgroundImage: compressedImage });
      } catch (err) {
        console.error('图片压缩失败:', err);
        setError('图片处理失败，请尝试较小的图片');
      }
    }
  };

  // 清除背景图
  const handleClearImage = () => {
    setRoomConfig({ ...roomConfig, backgroundImage: undefined });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">后台管理</h1>
          <a
            href="/display"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all"
          >
            返回显示
          </a>
        </div>

        {/* 未登录状态 */}
        {!isAuthenticated && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
            <p className="text-gray-400 mb-6">请先登录 Microsoft 365 账号</p>
            <button
              onClick={handleLogin}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-all"
            >
              登录 Microsoft 365
            </button>
          </div>
        )}

        {/* 已登录状态 */}
        {isAuthenticated && (
          <div className="space-y-6">
            {/* 账号信息 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">账号信息</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white">{accounts[0]?.name}</p>
                  <p className="text-gray-400 text-sm">{accounts[0]?.username}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600/50 hover:bg-red-600 text-white rounded-lg transition-all"
                >
                  登出
                </button>
              </div>
            </div>

            {/* 房间设置 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">房间设置</h2>

              {/* 房间名称 */}
              <div className="mb-6">
                <label className="block text-gray-300 mb-2">房间名称</label>
                <input
                  type="text"
                  value={roomConfig.roomName}
                  onChange={(e) => setRoomConfig({ ...roomConfig, roomName: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="例如: Meeting Room A"
                />
              </div>

              {/* 会议室 Email（直接输入） */}
              <div className="mb-6">
                <label className="block text-gray-300 mb-2">会议室 Email</label>
                <input
                  type="email"
                  value={roomConfig.calendarEmail || ''}
                  onChange={(e) => setRoomConfig({ ...roomConfig, calendarEmail: e.target.value })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="例如: MeetingRoomA@it96.my"
                />
                <p className="text-gray-500 text-sm mt-2">
                  直接输入会议室的 Email 地址
                </p>
              </div>

              {/* 或者从列表选择 */}
              <div className="mb-6">
                <label className="block text-gray-300 mb-2">或从列表选择日历</label>
                {loading ? (
                  <div className="text-gray-400">加载日历列表中...</div>
                ) : (
                  <select
                    value={roomConfig.calendarId || ''}
                    onChange={(e) => setRoomConfig({ ...roomConfig, calendarId: e.target.value || undefined })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-all"
                  >
                    <option value="" className="bg-gray-800">不使用列表</option>
                    {calendars.map((cal) => (
                      <option key={cal.id} value={cal.id} className="bg-gray-800">
                        {cal.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* 保存按钮 */}
              <button
                onClick={handleSave}
                className={`w-full py-3 font-semibold rounded-lg transition-all ${
                  saved
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {saved ? '已保存!' : '保存设置'}
              </button>
            </div>

            {/* 背景图片设置 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">背景图片</h2>

              {/* 当前背景预览 */}
              {roomConfig.backgroundImage && (
                <div className="mb-4">
                  <p className="text-gray-300 mb-2">当前背景：</p>
                  <div className="relative w-full h-40 rounded-lg overflow-hidden">
                    <img
                      src={roomConfig.backgroundImage}
                      alt="背景预览"
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

              {/* 上传图片 */}
              <div className="mb-4">
                <label className="block text-gray-300 mb-2">上传图片</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer"
                />
              </div>

              {/* 或输入图片 URL */}
              <div>
                <label className="block text-gray-300 mb-2">或输入图片网址</label>
                <input
                  type="url"
                  value={roomConfig.backgroundImage?.startsWith('data:') ? '' : roomConfig.backgroundImage || ''}
                  onChange={(e) => setRoomConfig({ ...roomConfig, backgroundImage: e.target.value || undefined })}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              {/* 保存背景按钮 */}
              <button
                onClick={handleSave}
                className="w-full mt-4 py-3 font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all"
              >
                保存背景设置
              </button>
            </div>

            {/* 使用说明 */}
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4">使用说明</h2>
              <div className="text-gray-300 space-y-3 text-sm">
                <p>1. 设置房间名称（显示在屏幕上）</p>
                <p>2. 输入会议室 Email（如 MeetingRoomA@it96.my）</p>
                <p>3. 可选：上传或输入背景图片</p>
                <p>4. 保存设置后返回显示页面</p>
              </div>
            </div>

            {/* 错误提示 */}
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
