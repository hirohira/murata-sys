// 案件・報告書とGoogleドライブを結び付ける処理
import type { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Project, Report } from '@/types';
import { buildSiteFolderName, buildFileName } from '@/lib/project-id';
import {
  createSiteFolder,
  ensureFolder,
  folderExists,
  folderUrl,
  uploadFile,
  REPORT_FOLDER,
  PPTX_MIME,
} from '@/lib/google-drive';
import { buildReportPptx } from '@/lib/report-pptx';

type Supabase = ReturnType<typeof createServerSupabaseClient>;

/** 案件の現場フォルダを用意する（未作成・削除済みなら作成し、DBに保存） */
export async function ensureProjectDriveFolder(
  supabase: Supabase,
  project: Project
): Promise<{ id: string; url: string }> {
  if (project.drive_folder_id && (await folderExists(project.drive_folder_id))) {
    return { id: project.drive_folder_id, url: project.drive_folder_url || folderUrl(project.drive_folder_id) };
  }

  const folder = await createSiteFolder(buildSiteFolderName(project));
  const { error } = await supabase
    .from('projects')
    .update({ drive_folder_id: folder.id, drive_folder_url: folder.url })
    .eq('id', project.id);
  if (error) throw new Error(`フォルダ情報の保存に失敗しました: ${error.message}`);
  return folder;
}

/** 報告書をPowerPointにしてドライブの所定フォルダに保存する（2回目以降は同じファイルを上書き） */
export async function saveReportToDrive(
  supabase: Supabase,
  reportId: string
): Promise<{ id: string; url: string; name: string }> {
  const { data: report, error } = await supabase
    .from('reports')
    .select('*, project:projects(*)')
    .eq('id', reportId)
    .single();
  if (error || !report) throw new Error('報告書が見つかりません');
  if (!report.project) throw new Error('報告書に案件が紐付いていません');

  const r = report as Report & { project: Project };
  const siteFolder = await ensureProjectDriveFolder(supabase, r.project);
  const targetFolderId = await ensureFolder(siteFolder.id, REPORT_FOLDER[r.report_type] ?? '03_現場調査');

  let worker: string | null = null;
  if (r.created_by) {
    const { data: user } = await supabase.from('users').select('name').eq('id', r.created_by).single();
    worker = user?.name ?? null;
  }

  const name = buildFileName({
    date: new Date(r.created_at),
    projectId: r.project.project_id,
    content: r.report_type,
    worker,
    ext: 'pptx',
  });

  const data = await buildReportPptx(r);
  const file = await uploadFile({
    parentId: targetFolderId,
    name,
    mimeType: PPTX_MIME,
    data,
    existingFileId: r.drive_file_id,
  });

  const { error: updateError } = await supabase
    .from('reports')
    .update({ drive_file_id: file.id, drive_file_url: file.url, drive_saved_at: new Date().toISOString() })
    .eq('id', reportId);
  if (updateError) throw new Error(`保存先情報の記録に失敗しました: ${updateError.message}`);

  return { ...file, name };
}
