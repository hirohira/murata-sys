import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  DriveNotConfiguredError,
  fetchImage,
  listSitePhotos,
  tagFromFolderPath,
} from '@/lib/google-drive';
import { ensureProjectDriveFolder } from '@/lib/project-drive';
import { contentFromFileName } from '@/lib/project-id';

export const maxDuration = 60;

function errorResponse(err: unknown, fallback: string) {
  console.error(fallback, err);
  const status = err instanceof DriveNotConfiguredError ? 503 : 500;
  return NextResponse.json({ error: err instanceof Error ? err.message : fallback }, { status });
}

async function loadProject(id: string) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, project: null };
  const { data: project } = await supabase.from('projects').select('*').eq('id', id).single();
  return { supabase, user, project };
}

// GET /api/projects/[id]/drive-photos — 現場フォルダ内の写真一覧
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { supabase, user, project } = await loadProject(params.id);
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  if (!project) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });

  try {
    const folder = await ensureProjectDriveFolder(supabase, project);
    const photos = await listSitePhotos(folder.id);
    return NextResponse.json({ data: photos, folderUrl: folder.url });
  } catch (err) {
    return errorResponse(err, '写真一覧の取得に失敗しました');
  }
}

// POST /api/projects/[id]/drive-photos — ドライブの写真1枚を報告書用に取り込む
// body: { fileId: string, folderPath?: string }
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const { supabase, user, project } = await loadProject(params.id);
  if (!user) return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  if (!project) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 });

  const { fileId, folderPath } = (await req.json()) as { fileId?: string; folderPath?: string };
  if (!fileId) return NextResponse.json({ error: 'fileId が必要です' }, { status: 400 });

  try {
    // 報告書用に長辺2000pxに縮小した版を取得
    const image = await fetchImage(fileId, 2000);
    const ext = image.mimeType.includes('png') ? 'png' : 'jpg';
    const path = `${user.id}/${project.id}/drive_${fileId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('report-photos')
      .upload(path, image.data, { contentType: image.mimeType, upsert: true, cacheControl: '3600' });
    if (uploadError) throw new Error(uploadError.message);

    const {
      data: { publicUrl },
    } = supabase.storage.from('report-photos').getPublicUrl(path);

    return NextResponse.json({
      data: {
        url: publicUrl,
        path,
        name: image.name,
        caption: contentFromFileName(image.name),
        tag: folderPath ? tagFromFolderPath(folderPath) : undefined,
      },
    });
  } catch (err) {
    return errorResponse(err, '写真の取り込みに失敗しました');
  }
}
