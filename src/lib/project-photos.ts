// サーバー専用：案件の写真をGoogleドライブの現場フォルダへ保存する
// 保存先：現場フォルダ / 03_現場調査 / <区分>（現状・原因・対策・その他）
// ファイル名：日付_現場ID_区分連番_撮影者.jpg（運用テンプレートの「日付_現場ID_内容_作業者」）
import type { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Project, ReportPhoto, PhotoCategory } from '@/types';
import { ensureFolder, moveFile, uploadFile, isDriveConfigured } from '@/lib/google-drive';
import { ensureProjectDriveFolder } from '@/lib/project-drive';
import { buildFileName } from '@/lib/project-id';

type Supabase = ReturnType<typeof createServerSupabaseClient>;

export const PHOTO_DRIVE_PARENT = '03_現場調査';

async function categoryFolderId(supabase: Supabase, project: Project, category: PhotoCategory) {
  const site = await ensureProjectDriveFolder(supabase, project);
  const parent = await ensureFolder(site.id, PHOTO_DRIVE_PARENT);
  return ensureFolder(parent, category);
}

/** 区分内の連番（ファイル名用） */
async function nextSequence(supabase: Supabase, projectId: string, category: PhotoCategory, excludeId?: string) {
  let q = supabase
    .from('report_photos')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('category', category)
    .not('drive_file_id', 'is', null);
  if (excludeId) q = q.neq('id', excludeId);
  const { count } = await q;
  return (count ?? 0) + 1;
}

function photoFileName(project: Project, category: PhotoCategory, seq: number, takenAt: Date, worker?: string | null) {
  return buildFileName({
    date: takenAt,
    projectId: project.project_id,
    content: `${category}${String(seq).padStart(3, '0')}`,
    worker,
    ext: 'jpg',
  });
}

/** 写真1枚をドライブに保存し、保存先をDBに記録する。連携未設定なら何もしない */
export async function savePhotoToDrive(
  supabase: Supabase,
  project: Project,
  photo: ReportPhoto,
  data: Buffer,
  worker?: string | null
): Promise<{ id: string; url: string; name: string } | null> {
  if (!isDriveConfigured()) return null;
  const folderId = await categoryFolderId(supabase, project, photo.category);
  const seq = await nextSequence(supabase, project.id, photo.category, photo.id);
  const name = photoFileName(project, photo.category, seq, new Date(photo.taken_at || photo.created_at), worker);
  const file = await uploadFile({ parentId: folderId, name, mimeType: 'image/jpeg', data });
  await supabase
    .from('report_photos')
    .update({ drive_file_id: file.id, drive_file_url: file.url, drive_file_name: name })
    .eq('id', photo.id);
  return { ...file, name };
}

/** 区分を付け替えたとき、ドライブのファイルも新しい区分のフォルダへ移して名前を付け直す */
export async function movePhotoInDrive(
  supabase: Supabase,
  project: Project,
  photo: ReportPhoto,
  newCategory: PhotoCategory
): Promise<string | null> {
  if (!isDriveConfigured() || !photo.drive_file_id) return null;
  const folderId = await categoryFolderId(supabase, project, newCategory);
  const seq = await nextSequence(supabase, project.id, newCategory, photo.id);
  // 旧ファイル名「日付_現場ID_区分連番_撮影者.jpg」から撮影者を引き継ぐ
  const parts = (photo.drive_file_name || '').replace(/\.jpg$/, '').split('_');
  const worker = parts.length > 3 ? parts.slice(3).join('_') : null;
  const name = photoFileName(project, newCategory, seq, new Date(photo.taken_at || photo.created_at), worker);
  await moveFile({ fileId: photo.drive_file_id, newParentId: folderId, newName: name });
  return name;
}
