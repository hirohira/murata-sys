/**
 * チャットで作る報告書：投稿（メッセージ）の形と、投稿から章立てを読み取る処理
 * 画面（ブラウザ）とサーバーの両方で使う
 *
 * 流れ
 *   1. 区分ボタン（現状・原因・散水試験…）を押す → 「現場の現状の写真です。」が投稿される
 *   2. 写真を添付する・コメントを書く（次の区分ボタンを押すまで、その区分に入る）
 *   3. 「これで報告書を作成」 → 投稿の順番どおりに章と写真を並べ、AIが文章を整える
 *
 * 写真の並び：一度に添付した写真が1組（遠景→近景→アップ）。報告書でも同じ組は矢印でつなぐ
 * コメント：写真のあとに書いたコメントは、直前に添付した写真の組の説明になる
 */
import type { PhotoCategory, ReportType } from '@/types';

export type ChatSectionKey = '全景' | '現状' | '原因' | '散水試験' | '対策' | 'その他';

export interface ChatSectionDef {
  key: ChatSectionKey;
  /** ボタンを押したときに投稿される文 */
  prompt: string;
  /** 案件写真として保存するときの区分（ドライブのフォルダ） */
  category: PhotoCategory;
  /** 章の見出しの既定（AIが使えないとき） */
  defaultTitle: string;
  color: string; // Tailwind のクラス
  hint: string;
}

export const CHAT_SECTIONS: ChatSectionDef[] = [
  {
    key: '全景',
    prompt: '建物の全景の写真です。',
    category: 'その他',
    defaultTitle: '全景',
    color: 'bg-slate-600',
    hint: '表紙のあとと最後のページに大きく載せます',
  },
  {
    key: '現状',
    prompt: '現場の現状の写真です。',
    category: '現状',
    defaultTitle: '現状について',
    color: 'bg-sky-600',
    hint: '雨漏りの箇所など、今の状態',
  },
  {
    key: '原因',
    prompt: '原因の写真です。',
    category: '原因',
    defaultTitle: '原因について',
    color: 'bg-rose-600',
    hint: 'もう一度押すと「原因②」になります',
  },
  {
    key: '散水試験',
    prompt: '散水試験の写真です。',
    category: 'その他',
    defaultTitle: '散水調査について',
    color: 'bg-cyan-700',
    hint: '散水した箇所と結果',
  },
  {
    key: '対策',
    prompt: '対策（修繕工事のご提案）です。',
    category: '対策',
    defaultTitle: '修繕工事について',
    color: 'bg-emerald-600',
    hint: '提案する工事の内容',
  },
  {
    key: 'その他',
    prompt: 'その他の写真です。',
    category: 'その他',
    defaultTitle: 'その他',
    color: 'bg-gray-500',
    hint: '注意事項・参考写真など',
  },
];

export const SECTION_BY_KEY = Object.fromEntries(CHAT_SECTIONS.map((s) => [s.key, s])) as Record<
  ChatSectionKey,
  ChatSectionDef
>;

export interface ChatPhoto {
  id: string; // report_photos の id（案件写真から選んだときは章写真の id）
  url: string;
  path: string;
}

interface Base {
  id: string;
  at: string; // ISO
  by?: string; // 投稿者名
}

export type ChatMessage =
  | (Base & { kind: 'section'; section: ChatSectionKey; index: number; topic?: string })
  | (Base & { kind: 'photos'; photos: ChatPhoto[] })
  | (Base & { kind: 'text'; text: string });

export interface ReportChat {
  id: string;
  project_id: string;
  report_type: ReportType;
  messages: ChatMessage[];
  report_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
export const circled = (n: number) => CIRCLED[n - 1] ?? `(${n})`;

/** 区分の表示名（同じ区分が2つ以上あるときは ①② を付ける） */
export function sectionLabel(m: Extract<ChatMessage, { kind: 'section' }>, all: ChatMessage[]): string {
  const multi = all.some((x) => x.kind === 'section' && x.section === m.section && x.index > 1);
  const base = multi ? `${m.section}${circled(m.index)}` : m.section;
  return m.topic?.trim() ? `${base}（${m.topic.trim()}）` : base;
}

/** 次に押す区分の番号（原因を2回押したら 2） */
export function nextSectionIndex(messages: ChatMessage[], key: ChatSectionKey): number {
  return messages.filter((m) => m.kind === 'section' && m.section === key).length + 1;
}

/** いま投稿している区分（最後に押した区分） */
export function currentSection(messages: ChatMessage[]): Extract<ChatMessage, { kind: 'section' }> | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.kind === 'section') return m;
  }
  return null;
}

/** 「これで報告書を作成お願いします」などの投稿を作成の合図とみなす */
export function isCreateRequest(text: string): boolean {
  const t = text.replace(/\s/g, '');
  return /(報告書|レポート).*(作成|作って|つくって|お願い)/.test(t) || /^(作成|作成して|作成お願いします?)$/.test(t);
}

// ─── 投稿から章立てを読み取る ─────────────────────────────

export interface ParsedGroup {
  photos: ChatPhoto[];
  notes: string[];
}

export interface ParsedSection {
  sid: string; // S1, S2 …
  key: ChatSectionKey;
  index: number;
  label: string; // 原因②（シーリングの劣化）
  topic: string;
  notes: string[]; // 写真より前に書いたコメント（区分全体の説明）
  groups: ParsedGroup[];
}

export interface ParsedChat {
  /** 区分ボタンを押す前のコメント（全体のメモ） */
  preface: string[];
  sections: ParsedSection[];
  photoCount: number;
}

export function parseChat(messages: ChatMessage[]): ParsedChat {
  const preface: string[] = [];
  const sections: ParsedSection[] = [];
  let cur: ParsedSection | null = null;
  let photoCount = 0;

  for (const m of messages) {
    if (m.kind === 'section') {
      cur = {
        sid: `S${sections.length + 1}`,
        key: m.section,
        index: m.index,
        label: sectionLabel(m, messages),
        topic: (m.topic || '').trim(),
        notes: [],
        groups: [],
      };
      sections.push(cur);
      continue;
    }
    if (m.kind === 'photos') {
      if (m.photos.length === 0) continue;
      if (!cur) {
        // 区分を選ぶ前の写真は「現状」とみなす
        cur = { sid: `S${sections.length + 1}`, key: '現状', index: 1, label: '現状', topic: '', notes: [], groups: [] };
        sections.push(cur);
      }
      cur.groups.push({ photos: m.photos, notes: [] });
      photoCount += m.photos.length;
      continue;
    }
    const t = m.text.trim();
    if (!t || isCreateRequest(t)) continue;
    if (!cur) preface.push(t);
    else if (cur.groups.length === 0) cur.notes.push(t);
    else cur.groups[cur.groups.length - 1].notes.push(t);
  }

  return { preface, sections: sections.filter((s) => s.groups.length > 0 || s.notes.length > 0 || s.topic), photoCount };
}

export function newMessageId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 保存できる投稿だけを通す（サーバーで使う） */
export function sanitizeMessages(input: unknown): ChatMessage[] | null {
  if (!Array.isArray(input) || input.length > 500) return null;
  const keys = new Set(CHAT_SECTIONS.map((s) => s.key));
  const out: ChatMessage[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') return null;
    const m = raw as Record<string, unknown>;
    const base = {
      id: String(m.id || newMessageId()).slice(0, 64),
      at: typeof m.at === 'string' ? m.at : new Date().toISOString(),
      ...(typeof m.by === 'string' ? { by: m.by.slice(0, 40) } : {}),
    };
    if (m.kind === 'section' && keys.has(m.section as ChatSectionKey)) {
      out.push({
        ...base,
        kind: 'section',
        section: m.section as ChatSectionKey,
        index: Math.max(1, Math.min(20, Number(m.index) || 1)),
        ...(typeof m.topic === 'string' && m.topic.trim() ? { topic: m.topic.trim().slice(0, 40) } : {}),
      });
    } else if (m.kind === 'photos' && Array.isArray(m.photos)) {
      const photos = (m.photos as Record<string, unknown>[])
        .filter((p) => p && typeof p.url === 'string' && typeof p.path === 'string')
        .slice(0, 30)
        .map((p) => ({ id: String(p.id || '').slice(0, 64), url: String(p.url), path: String(p.path) }));
      out.push({ ...base, kind: 'photos', photos });
    } else if (m.kind === 'text' && typeof m.text === 'string') {
      out.push({ ...base, kind: 'text', text: m.text.slice(0, 2000) });
    } else {
      return null;
    }
  }
  return out;
}
