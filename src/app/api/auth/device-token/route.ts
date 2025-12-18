import { NextRequest, NextResponse } from 'next/server';

const TENANT_ID = process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common';
const CLIENT_ID = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '';

// 轮询获取 token
export async function POST(request: NextRequest) {
  try {
    const { deviceCode } = await request.json();

    if (!deviceCode) {
      return NextResponse.json({ error: 'Device code is required' }, { status: 400 });
    }

    const response = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          device_code: deviceCode,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // 用户还没完成授权，返回 pending 状态
      if (data.error === 'authorization_pending') {
        return NextResponse.json({ status: 'pending' });
      }
      // 用户拒绝或超时
      if (data.error === 'authorization_declined' || data.error === 'expired_token') {
        return NextResponse.json({ status: 'failed', error: data.error_description });
      }
      return NextResponse.json({ error: data.error_description || 'Failed to get token' }, { status: 400 });
    }

    // 成功获取 token
    return NextResponse.json({
      status: 'success',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      idToken: data.id_token,
    });
  } catch (error) {
    console.error('Token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
