import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getCurrentUser, permissionError } from '@/lib/current-user';
import { PHOTO_CATEGORIES } from '@/lib/constants';
import { savePhotoToDrive } from '@/lib/project-photos';
import type { CaptureMethod, PhotoCategory, Project, ReportPhoto } from '@/types';

export const maxDuration = 60;

const METHODS: CaptureMethod[] = ['camera', 'select', 'inapp'];

// GET /api/projects/[id]/photos — 案件の写真一覧（新しい順）
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  const denied = permissionError(me);
  if (denied) return denied;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('report_photos')
    .select('*')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST /api/projects/[id]/photos — 写真1枚をアップ（区分・撮り方つき）。ドライブにも保存する
// multipart: file, category, method, taken_at(ISO), width, height
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  const denied = permissionError(me);
  if (denied) return denied;

  const supabase = createServerSupabaseClient();
  const { data: project } = await supabase.from('projects').select('*').eq('id', params.id).single();
  if (!project) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });

  const form = await req.formData();
  const file = form.get('file');
  const category = String(form.get('category') || '') as PhotoCategory;
  const method = String(form.get('method') || '') as CaptureMethod;
  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: '写真がありません' }, { status: 400 });
  }
  if (!PHOTO_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: '区分の指定が正しくありません' }, { status: 400 });
  }
  const takenAtRaw = String(form.get('taken_at') || '');
  const takenAt = takenAtRaw && !Number.isNaN(Date.parse(takenAtRaw)) ? new Date(takenAtRaw).toISOString() : null;
  const width = Number(form.get('width')) || null;
  const height = Number(form.get('height')) || null;

  const data = Buffer.from(await file.arrayBuffer());
  const path = `${project.id}/photos/${randomUUID()}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from('report-photos')
    .upload(path, data, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });
  const {
    data: { publicUrl },
  } = supabase.storage.from('report-photos').getPublicUrl(path);

  const { data: photo, error } = await supabase
    .from('report_photos')
    .insert({
      project_id: project.id,
      file_url: publicUrl,
      file_path: path,
      category,
      capture_method: METHODS.includes(method) ? method : null,
      taken_at: takenAt,
      width,
      height,
      created_by: me!.id,
    })
    .select('*')
    .single();
  if (error) {
    await supabase.storage.from('report-photos').remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ドライブへの保存は失敗しても写真の登録自体は成功扱い（あとで再送できる）
  let driveError: string | null = null;
  try {
    const saved = await savePhotoToDrive(supabase, project as Project, photo as ReportPhoto, data, me!.profile.name);
    if (saved) Object.assign(photo, { drive_file_id: saved.id, drive_file_url: saved.url, drive_file_name: saved.name });
  } catch (e) {
    console.error('Photo drive save failed:', e);
    driveError = e instanceof Error ? e.message : 'ドライブへの保存に失敗しました';
  }

  return NextResponse.json({ data: photo, driveError }, { status: 201 });
}
