/**
 * Googleドライブ連携
 *
 * 接続方式は2通り（どちらか一方を設定する）:
 *
 * A. Googleアカウント（マイドライブ）… デモ・小規模運用向け
 *   GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN
 *   リフレッシュトークンは scripts/google-drive-token.mjs で取得する。
 *   ファイルはそのアカウントの持ち物として作成される。
 *
 * B. サービスアカウント（共有ドライブ）… 本番運用向け
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY（改行は \n のままでよい）
 *   サービスアカウントを共有ドライブのメンバー（コンテンツ管理者）に追加しておくこと。
 *   ※ サービスアカウントはマイドライブにはファイルを作れない（保存容量がないため）。
 *
 * 共通:
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID  現場フォルダを作る場所のフォルダID（または共有ドライブID）
 *   両方設定されている場合は A を優先する。
 */
import { Readable } from 'stream';
import { drive_v3 } from '@googleapis/drive';
import { JWT, OAuth2Client } from 'google-auth-library';

export const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

/** 標準フォルダ構成（運用テンプレート「2. 標準フォルダ構成」） */
export const SITE_SUBFOLDERS: { name: string; children?: string[] }[] = [
  { name: '00_現場基本情報' },
  { name: '01_見積・契約' },
  { name: '02_図面・仕様書' },
  { name: '03_現場調査' },
  { name: '04_施工計画・安全' },
  { name: '05_施工写真', children: ['01_施工前', '02_施工中', '03_施工詳細', '04_施工後', '05_完成'] },
  { name: '06_作業動画' },
  { name: '07_日報・作業記録' },
  { name: '08_材料・原価' },
  { name: '09_検査・品質・是正' },
  { name: '10_請求・精算' },
  { name: '11_完了・引渡し' },
  { name: '12_AI解析' },
  { name: '13_教育・ナレッジ' },
  { name: '99_長期保管' },
];

/** 報告書の保存先 */
export const REPORT_FOLDER: Record<string, string> = {
  '調査報告書': '03_現場調査',
  '完了報告書': '11_完了・引渡し',
};

/** 写真取り込みの対象フォルダ */
export const PHOTO_SOURCE_FOLDERS = ['03_現場調査', '05_施工写真', '09_検査・品質・是正', '11_完了・引渡し'];

export class DriveNotConfiguredError extends Error {
  constructor() {
    super('Googleドライブ連携が設定されていません（環境変数を確認してください）');
    this.name = 'DriveNotConfiguredError';
  }
}

function hasOAuthConfig(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
      process.env.GOOGLE_OAUTH_REFRESH_TOKEN
  );
}

function hasServiceAccountConfig(): boolean {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID && (hasOAuthConfig() || hasServiceAccountConfig())
  );
}

let _client: JWT | OAuth2Client | null = null;

function getAuthClient(): JWT | OAuth2Client {
  if (!isDriveConfigured()) throw new DriveNotConfiguredError();
  if (!_client) {
    if (hasOAuthConfig()) {
      const client = new OAuth2Client({
        clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
        clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
      });
      client.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
      _client = client;
    } else {
      _client = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
    }
  }
  return _client;
}

export function getDrive(): drive_v3.Drive {
  return new drive_v3.Drive({ auth: getAuthClient() });
}

export function rootFolderId(): string {
  if (!isDriveConfigured()) throw new DriveNotConfiguredError();
  return process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
}

export function folderUrl(id: string) {
  return `https://drive.google.com/drive/folders/${id}`;
}

const ALL_DRIVES = { supportsAllDrives: true } as const;
const LIST_ALL_DRIVES = {
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
  corpora: 'allDrives',
} as const;

function q(str: string) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function findChild(
  parentId: string,
  name: string,
  mimeType?: string
): Promise<drive_v3.Schema$File | null> {
  const drive = getDrive();
  const conds = [`'${q(parentId)}' in parents`, `name = '${q(name)}'`, 'trashed = false'];
  if (mimeType) conds.push(`mimeType = '${mimeType}'`);
  const res = await drive.files.list({
    ...LIST_ALL_DRIVES,
    q: conds.join(' and '),
    fields: 'files(id, name, webViewLink)',
    pageSize: 1,
  });
  return res.data.files?.[0] ?? null;
}

export async function ensureFolder(parentId: string, name: string): Promise<string> {
  const existing = await findChild(parentId, name, FOLDER_MIME);
  if (existing?.id) return existing.id;
  const res = await getDrive().files.create({
    ...ALL_DRIVES,
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: 'id',
  });
  return res.data.id!;
}

export async function folderExists(id: string): Promise<boolean> {
  try {
    const res = await getDrive().files.get({ ...ALL_DRIVES, fileId: id, fields: 'id, trashed' });
    return Boolean(res.data.id) && !res.data.trashed;
  } catch {
    return false;
  }
}

/** 現場フォルダと標準サブフォルダを作成（既にあれば再利用）。フォルダIDを返す */
export async function createSiteFolder(folderName: string): Promise<{ id: string; url: string }> {
  const siteId = await ensureFolder(rootFolderId(), folderName);
  for (const sub of SITE_SUBFOLDERS) {
    const subId = await ensureFolder(siteId, sub.name);
    for (const child of sub.children ?? []) {
      await ensureFolder(subId, child);
    }
  }
  return { id: siteId, url: folderUrl(siteId) };
}

/** ファイルをアップロード（existingFileId があれば内容と名前を更新） */
export async function uploadFile(params: {
  parentId: string;
  name: string;
  mimeType: string;
  data: Buffer;
  existingFileId?: string | null;
}): Promise<{ id: string; url: string }> {
  const drive = getDrive();
  const media = { mimeType: params.mimeType, body: Readable.from(params.data) };

  if (params.existingFileId) {
    try {
      const res = await drive.files.update({
        ...ALL_DRIVES,
        fileId: params.existingFileId,
        requestBody: { name: params.name },
        media,
        fields: 'id, webViewLink, trashed',
      });
      if (res.data.id && !res.data.trashed) {
        return { id: res.data.id, url: res.data.webViewLink ?? '' };
      }
    } catch {
      // 削除済みなどで更新できなければ新規作成
    }
  }

  const res = await drive.files.create({
    ...ALL_DRIVES,
    requestBody: { name: params.name, parents: [params.parentId] },
    media: { mimeType: params.mimeType, body: Readable.from(params.data) },
    fields: 'id, webViewLink',
  });
  return { id: res.data.id!, url: res.data.webViewLink ?? '' };
}

export interface DrivePhoto {
  id: string;
  name: string;
  folderPath: string; // 例: "05_施工写真/01_施工前"
  modifiedTime?: string | null;
  hasThumbnail: boolean;
}

/** 指定フォルダ配下（サブフォルダ含む）の画像を一覧する */
export async function listImagesRecursive(
  folderId: string,
  folderPath: string,
  depth = 3
): Promise<DrivePhoto[]> {
  const drive = getDrive();
  const results: DrivePhoto[] = [];
  let pageToken: string | undefined;

  do {
    const res = await drive.files.list({
      ...LIST_ALL_DRIVES,
      q: `'${q(folderId)}' in parents and trashed = false and (mimeType = '${FOLDER_MIME}' or mimeType contains 'image/')`,
      fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, hasThumbnail)',
      orderBy: 'folder,name',
      pageSize: 1000,
      pageToken,
    });
    for (const f of res.data.files ?? []) {
      if (f.mimeType === FOLDER_MIME) {
        if (depth > 0 && f.id) {
          results.push(...(await listImagesRecursive(f.id, `${folderPath}/${f.name}`, depth - 1)));
        }
      } else if (f.id) {
        results.push({
          id: f.id,
          name: f.name ?? '',
          folderPath,
          modifiedTime: f.modifiedTime,
          hasThumbnail: Boolean(f.hasThumbnail),
        });
      }
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return results;
}

/** 現場フォルダ内の写真取り込み対象フォルダから画像を一覧する */
export async function listSitePhotos(siteFolderId: string): Promise<DrivePhoto[]> {
  const photos: DrivePhoto[] = [];
  for (const name of PHOTO_SOURCE_FOLDERS) {
    const folder = await findChild(siteFolderId, name, FOLDER_MIME);
    if (folder?.id) photos.push(...(await listImagesRecursive(folder.id, name)));
  }
  return photos;
}

/**
 * 画像を取得する。size を指定すると Drive のサムネイル機能で縮小版を取得する
 * （報告書用には長辺 2000px 程度で十分。サムネイルが無ければ原本をダウンロード）
 */
export async function fetchImage(
  fileId: string,
  size?: number
): Promise<{ data: Buffer; mimeType: string; name: string }> {
  const drive = getDrive();
  const meta = await drive.files.get({
    ...ALL_DRIVES,
    fileId,
    fields: 'id, name, mimeType, thumbnailLink, parents',
  });
  const name = meta.data.name ?? fileId;

  if (size && meta.data.thumbnailLink) {
    const token = await getAuthClient().getAccessToken();
    const link = meta.data.thumbnailLink.replace(/=s\d+$/, `=s${size}`);
    const res = await fetch(link, { headers: { Authorization: `Bearer ${token.token}` } });
    if (res.ok) {
      return {
        data: Buffer.from(await res.arrayBuffer()),
        mimeType: res.headers.get('content-type') || 'image/jpeg',
        name,
      };
    }
  }

  const res = await drive.files.get(
    { ...ALL_DRIVES, fileId, alt: 'media' },
    { responseType: 'arraybuffer' }
  );
  return {
    data: Buffer.from(res.data as ArrayBuffer),
    mimeType: meta.data.mimeType || 'application/octet-stream',
    name,
  };
}

/** 写真のフォルダから施工前/施工後タグを推定 */
export function tagFromFolderPath(folderPath: string): 'before' | 'after' | undefined {
  if (/01_施工前/.test(folderPath)) return 'before';
  if (/04_施工後|05_完成/.test(folderPath)) return 'after';
  return undefined;
}
