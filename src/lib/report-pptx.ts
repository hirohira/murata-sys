// 報告書PowerPoint（茂様式）の生成
// ページの中身は report-pages.ts で組み立て、ここでは図形として書き出すだけ（プレビューと同じ配置）
import type { Report } from '@/types';
import { buildReportPages, type Element } from '@/lib/report-pages';
import { REPORT_ASSET_DATA } from '@/lib/report-assets';

const FONT_BODY = 'メイリオ';
const FONT_ROUNDED = 'HG丸ｺﾞｼｯｸM-PRO';

export async function buildReportPptx(report: Report, opts: { worker?: string | null } = {}): Promise<Buffer> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_4x3';
  pptx.author = '株式会社MURATA';
  pptx.company = '株式会社MURATA';
  pptx.title = report.title;

  const pages = buildReportPages(report, { worker: opts.worker });

  // 写真は同じURLを何度も取得しないようにキャッシュ
  const cache = new Map<string, Promise<LoadedImage | null>>();
  const getImage = (url: string) => {
    if (!cache.has(url)) cache.set(url, loadImage(url));
    return cache.get(url)!;
  };

  for (const page of pages) {
    const slide = pptx.addSlide();
    for (const el of page.elements) {
      await drawElement(pptx, slide, el, getImage);
    }
  }

  const out = await pptx.write({ outputType: 'nodebuffer' });
  return Buffer.from(out as ArrayBuffer);
}

async function drawElement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pptx: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  slide: any,
  el: Element,
  getImage: (url: string) => Promise<LoadedImage | null>
) {
  switch (el.kind) {
    case 'asset':
      slide.addImage({ data: REPORT_ASSET_DATA[el.asset], ...el.box });
      return;

    case 'line':
      slide.addShape(pptx.ShapeType.line, {
        x: el.box.x,
        y: el.box.y,
        w: el.box.w,
        h: 0,
        line: { color: el.color, width: el.widthPt },
      });
      return;

    case 'photo': {
      const url = el.photo.url;
      const img = url ? await getImage(url) : null;
      if (img) {
        // 元画像の縦横比を保ったまま枠いっぱいにトリミング（引き伸ばさない）
        const scale = Math.max(el.box.w / img.width, el.box.h / img.height);
        slide.addImage({
          data: img.data,
          x: el.box.x,
          y: el.box.y,
          w: img.width * scale,
          h: img.height * scale,
          sizing: { type: 'cover', w: el.box.w, h: el.box.h },
        });
      } else {
        slide.addShape(pptx.ShapeType.rect, { ...el.box, fill: { color: 'EEEEEE' }, line: { color: 'DDDDDD' } });
      }
      if (el.badge) {
        slide.addText(el.badge.text, {
          x: el.box.x + 0.06,
          y: el.box.y + 0.06,
          w: 0.7,
          h: 0.24,
          fontSize: 9,
          bold: true,
          color: 'FFFFFF',
          fill: { color: el.badge.color },
          align: 'center',
          valign: 'middle',
          fontFace: FONT_BODY,
          margin: 0,
        });
      }
      return;
    }

    case 'text': {
      const lineSpacing = el.fontSize * el.lineSpacing; // pt指定（倍率指定はフォント依存で広がるため）
      const runs = el.paragraphs.map((p, i) => ({
        text: p.text,
        options: {
          bold: p.bold ?? el.bold,
          color: p.color ?? el.color,
          breakLine: i < el.paragraphs.length - 1,
        },
      }));
      slide.addText(runs, {
        ...el.box,
        fontSize: el.fontSize,
        fontFace: el.font === 'rounded' ? FONT_ROUNDED : FONT_BODY,
        color: el.color,
        bold: el.bold,
        underline: el.underline ? { style: 'sng' } : undefined,
        align: el.align,
        valign: el.valign,
        lineSpacing,
        margin: 0,
      });
      return;
    }
  }
}

interface LoadedImage {
  data: string;
  width: number;
  height: number;
}

async function loadImage(url: string): Promise<LoadedImage | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const size = imageSize(buf);
    if (!size) return null;
    const mime = size.type === 'png' ? 'image/png' : 'image/jpeg';
    return { data: `${mime};base64,${buf.toString('base64')}`, width: size.width, height: size.height };
  } catch {
    return null;
  }
}

/** JPEG / PNG のピクセルサイズを読む */
function imageSize(buf: Buffer): { type: 'jpeg' | 'png'; width: number; height: number } | null {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { type: 'png', width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i++;
        continue;
      }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      const isSOF =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) {
        return { type: 'jpeg', height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + len;
    }
  }
  return null;
}
