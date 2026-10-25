import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser, permissionError } from '@/lib/current-user';
import { PHOTO_CATEGORIES } from '@/lib/constants';
import { movePhotoInDrive, savePhotoToDrive } from '@/lib/project-photos';
import { trashFile, isDriveConfigured } from '@/lib/google-drive';
import type { PhotoCategory, Project, ReportPhoto } from '@/types';

export const maxDuration = 60;

async function load(id: string) {
  const supabase = createServerSupabaseClient();
  const { data: photo } = await supabase.from('report_photos').select('*').eq('id', id).single();
  if (!photo) return { supabase, photo: null, project: null };
  const { data: project } = await supabase.from('projects').select('*').eq('id', photo.project_id).single();
  return { supabase, photo: photo as ReportPhoto, project: project as Project | null };
}

// PATCH /api/photos/[id] — 区分・説明の変更、ドライブへの再送（{ retryDrive: true }）
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  const denied = permissionError(me);
  if (denied) return denied;

  const { supabase, photo, project } = await load(params.id);
  if (!photo || !project) return NextResponse.json({ error: '写真が見つかりません' }, { status: 404 });

  const body = (await req.json()) as { category?: string; caption?: string; retryDrive?: boolean };
  const update: Record<string, unknown> = {};
  let driveError: string | null = null;

  if (typeof body.caption === 'string') update.caption = body.caption.trim() || null;

  if (body.category !== undefined && body.category !== photo.category) {
    if (!PHOTO_CATEGORIES.includes(body.category as PhotoCategory)) {
      return NextResponse.json({ error: '区分の指定が正しくありません' }, { status: 400 });
    }
    update.category = body.category;
    try {
      const name = await movePhotoInDrive(supabase, project, photo, body.category as PhotoCategory);
      if (name) update.drive_file_name = name;
    } catch (e) {
      console.error('Photo drive move failed:', e);
      driveError = 'ドライブ側のフォルダ移動に失敗しました（システム上の区分は変更済み）';
    }
  }

  if (Object.keys(update).length > 0) {
    const { error } = await supabase.from('report_photos').update(update).eq('id', photo.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ドライブ未保存の写真を再送
  if (body.retryDrive && !photo.drive_file_id && isDriveConfigured()) {
    try {
      const res = await fetch(photo.file_url);
      if (!res.ok) throw new Error('写真を読み込めませんでした');
      const data = Buffer.from(await res.arrayBuffer());
      const { data: author } = photo.created_by
        ? await supabase.from('users').select('name').eq('id', photo.created_by).single()
        : { data: null };
      await savePhotoToDrive(supabase, project, { ...photo, ...update } as ReportPhoto, data, author?.name ?? null);
    } catch (e) {
      driveError = e instanceof Error ? e.message : 'ドライブへの保存に失敗しました';
    }
  }

  const { data } = await supabase.from('report_photos').select('*').eq('id', photo.id).single();
  return NextResponse.json({ data, driveError });
}

// DELETE /api/photos/[id] — 写真を削除（ドライブのファイルはゴミ箱へ移す）
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  const denied = permissionError(me);
  if (denied) return denied;

  const { supabase, photo } = await load(params.id);
  if (!photo) return NextResponse.json({ error: '写真が見つかりません' }, { status: 404 });

  const { error } = await supabase.from('report_photos').delete().eq('id', photo.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 保存ファイルの削除（撮影者以外が消す場合もあるのでサーバー権限で行う）。
  // 報告書に取り込み済みの写真はファイルを残す（報告書の写真が消えないように）
  const { data: reports } = await supabase.from('reports').select('chapters').eq('project_id', photo.project_id);
  const usedInReport = (reports || []).some((r) => JSON.stringify(r.chapters || []).includes(photo.file_path));
  if (!usedInReport) {
    try {
      await createAdminClient().storage.from('report-photos').remove([photo.file_path]);
    } catch (e) {
      console.error('Storage remove failed:', e);
    }
  }
  if (photo.drive_file_id && isDriveConfigured()) {
    try {
      await trashFile(photo.drive_file_id);
    } catch (e) {
      console.error('Drive trash failed:', e);
    }
  }
  return NextResponse.json({ success: true });
}
