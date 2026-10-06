import { NextResponse } from 'next/server';
import { isDriveConfigured } from '@/lib/google-drive';

// GET /api/drive/status — Googleドライブ連携が設定済みか
export async function GET() {
  return NextResponse.json({ configured: isDriveConfigured() });
}
