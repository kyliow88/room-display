import { NextResponse } from 'next/server';

// 请求 device code
export async function POST() {
  const TENANT_ID = process.env.NEXT_PUBLIC_AZURE_TENANT_ID || process.env.AZURE_TENANT_ID || 'common';
  const CLIENT_ID = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || process.env.AZURE_CLIENT_ID || '';

  // 调试：检查环境变量
  if (!CLIENT_ID) {
    console.error('Missing CLIENT_ID. Available env vars:', Object.keys(process.env).filter(k => k.includes('AZURE')));
    return NextResponse.json({
      error: 'Server configuration error: Missing Azure Client ID. Please check environment variables.',
      debug: {
        hasClientId: !!CLIENT_ID,
        hasTenantId: !!TENANT_ID,
      }
    }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/devicecode`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          scope: 'User.Read Calendars.Read Calendars.ReadWrite Calendars.Read.Shared Schedule.Read.All offline_access',
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error_description || 'Failed to get device code' }, { status: 400 });
    }

    return NextResponse.json({
      userCode: data.user_code,
      deviceCode: data.device_code,
      verificationUri: data.verification_uri,
      expiresIn: data.expires_in,
      interval: data.interval,
      message: data.message,
    });
  } catch (error) {
    console.error('Device code error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
