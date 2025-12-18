import { NextResponse } from 'next/server';

const TENANT_ID = process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common';
const CLIENT_ID = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '';

// 请求 device code
export async function POST() {
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
          scope: 'User.Read Calendars.Read Calendars.ReadWrite offline_access',
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
