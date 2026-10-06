import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchImage } from '@/lib/google-drive';

// GET /api/drive/thumbnail/[fileId] — 写真選択画面用のサムネイル
export async function GET(_req: Request, { params }: { params: { fileId: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });

  try {
    const image = await fetchImage(params.fileId, 320);
    return new NextResponse(image.data as unknown as BodyInit, {
      headers: {
        'Content-Type': image.mimeType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('Thumbnail error:', err);
    return NextResponse.json({ error: 'サムネイルを取得できません' }, { status: 404 });
  }
}
