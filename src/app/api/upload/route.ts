import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// POST /api/upload — 写真をSupabase Storageにアップロード
export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const projectId = formData.get('projectId') as string;

  if (!file) {
    return NextResponse.json({ error: 'ファイルが必要です' }, { status: 400 });
  }

  // Generate unique file path: {userId}/{projectId}/{timestamp}_{filename}
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = `${user.id}/${projectId || 'general'}/${timestamp}_${safeName}`;

  const { data, error } = await supabase.storage
    .from('report-photos')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('report-photos').getPublicUrl(data.path);

  return NextResponse.json({
    url: publicUrl,
    path: data.path,
  });
}
