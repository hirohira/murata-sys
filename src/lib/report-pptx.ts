// 報告書PowerPoint（茂様式）の生成
import type { Report } from '@/types';
import { getOutputChapters } from '@/lib/chapter-numbering';
import {
  layoutChapterSlide,
  TITLE_BOX,
  TITLE_RULE,
  CAPTION_FONT,
  DESC_LINE_SPACING,
} from '@/lib/slide-layout';

export async function buildReportPptx(report: Report): Promise<Buffer> {
  // Dynamic import pptxgenjs (server-side)
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();

  // Configure presentation
  pptx.layout = 'LAYOUT_4x3';
  pptx.author = '株式会社MURATA';
  pptx.company = '株式会社MURATA';
  pptx.title = report.title;

  // Define colors
  const PRIMARY = '1B4F72';
  const ACCENT = 'D32F2F';

  // ─── Cover slide ───
  const coverSlide = pptx.addSlide();
  addMurataFooter(coverSlide, 1);

  coverSlide.addText(report.report_type, {
    x: 1.0,
    y: 1.2,
    w: 8.0,
    h: 0.4,
    fontSize: 11,
    color: '888888',
    align: 'center',
    fontFace: 'Noto Sans JP',
  });

  coverSlide.addText(report.title, {
    x: 1.0,
    y: 1.7,
    w: 8.0,
    h: 0.8,
    fontSize: 22,
    bold: true,
    color: '222222',
    align: 'center',
    fontFace: 'Noto Sans JP',
  });

  // Red line under title
  coverSlide.addShape(pptx.ShapeType.rect, {
    x: 2.5,
    y: 2.6,
    w: 5.0,
    h: 0.03,
    fill: { color: ACCENT },
  });

  // Customer / info
  const meta = report.meta as Report['meta'];
  const infoLines: string[] = [];
  if (report.project?.customer_name) infoLines.push(`${report.project.customer_name} 様`);
  if (meta?.construction_name) infoLines.push(meta.construction_name);
  if (meta?.survey_date) infoLines.push(`調査日: ${meta.survey_date}`);
  infoLines.push(`作成日: ${new Date(report.created_at).toLocaleDateString('ja-JP')}`);

  coverSlide.addText(infoLines.join('\n'), {
    x: 1.0,
    y: 3.0,
    w: 8.0,
    h: 1.5,
    fontSize: 11,
    color: '555555',
    align: 'center',
    fontFace: 'Noto Sans JP',
    lineSpacing: 24,
  });

  // Company name at bottom
  coverSlide.addText('株式会社MURATA', {
    x: 1.0,
    y: 5.8,
    w: 8.0,
    h: 0.5,
    fontSize: 14,
    bold: true,
    color: PRIMARY,
    align: 'center',
    fontFace: 'Noto Sans JP',
  });

  // ─── Chapter slides ───
  let slideNum = 2;

  for (const { chapter: ch, displayTitle } of getOutputChapters(report.chapters)) {

    const slide = pptx.addSlide();
    addMurataFooter(slide, slideNum);
    slideNum++;

    // 章見出し＋赤線
    slide.addText(displayTitle, {
      ...TITLE_BOX,
      fontSize: 16,
      bold: true,
      color: '222222',
      align: 'center',
      valign: 'middle',
      fontFace: 'Noto Sans JP',
    });
    slide.addShape(pptx.ShapeType.rect, { ...TITLE_RULE, fill: { color: ACCENT }, line: { color: ACCENT } });

    // 写真・説明文の配置はプレビューと共通の計算（3枚までは横1列、説明文は枠内に収める）
    const layout = layoutChapterSlide(ch.photos || [], ch.description || '');

    for (const label of layout.labels) {
      slide.addText(label.text, {
        ...label.box,
        fontSize: 10,
        bold: true,
        color: label.color,
        align: 'center',
        valign: 'middle',
        fontFace: 'Noto Sans JP',
      });
    }

    for (const { photo, box, caption } of layout.photos) {
      const img = photo.url ? await loadImage(photo.url) : null;
      if (img) {
        // 元画像の縦横比を渡し、枠いっぱいにトリミング（引き伸ばさない）
        const scale = Math.max(box.w / img.width, box.h / img.height);
        slide.addImage({
          data: img.data,
          x: box.x,
          y: box.y,
          w: img.width * scale,
          h: img.height * scale,
          sizing: { type: 'cover', w: box.w, h: box.h },
        });
      }
      if (caption) {
        slide.addText(caption.text, {
          ...caption.box,
          fontSize: CAPTION_FONT,
          color: '666666',
          align: 'center',
          valign: 'top',
          fontFace: 'Noto Sans JP',
          margin: 0,
          fit: 'shrink',
        });
      }
    }

    if (layout.hiddenCount > 0) {
      slide.addText(`ほか${layout.hiddenCount}枚`, {
        x: 7.5, y: 0.66, w: 2.0, h: 0.14,
        fontSize: 8, color: '888888', align: 'right', fontFace: 'Noto Sans JP', margin: 0,
      });
    }

    if (layout.description) {
      const d = layout.description;
      slide.addText(d.text, {
        ...d.box,
        fontSize: d.fontSize,
        color: '333333',
        fontFace: 'Noto Sans JP',
        lineSpacing: d.fontSize * DESC_LINE_SPACING, // 行間はpt指定（倍率指定だとフォント依存で広がる）
        valign: 'top',
        margin: 0,
      });
    }
  }

  // Generate PPTX buffer
  const pptxOutput = await pptx.write({ outputType: 'nodebuffer' });
  const pptxBuffer = Buffer.from(pptxOutput as ArrayBuffer);

  return pptxBuffer;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addMurataFooter(slide: any, pageNum: number) {
  // Red line at bottom
  slide.addShape('rect', {
    x: 0,
    y: 7.15,
    w: 10.0,
    h: 0.03,
    fill: { color: 'D32F2F' },
  });

  // Company name (left)
  slide.addText('株式会社MURATA', {
    x: 0.3,
    y: 7.2,
    w: 3.0,
    h: 0.3,
    fontSize: 9,
    bold: true,
    color: '1B4F72',
    fontFace: 'Noto Sans JP',
    align: 'left',
  });

  // Page number (center)
  slide.addText(String(pageNum), {
    x: 4.0,
    y: 7.2,
    w: 2.0,
    h: 0.3,
    fontSize: 10,
    color: 'AAAAAA',
    fontFace: 'Inter',
    align: 'center',
  });

  // URL (right)
  slide.addText('murata-reform.jp', {
    x: 6.5,
    y: 7.2,
    w: 3.2,
    h: 0.3,
    fontSize: 8,
    bold: true,
    color: '1976D2',
    fontFace: 'Inter',
    align: 'right',
  });
}

/** 画像を取得して data URI と縦横のピクセル数を返す（失敗時は null） */
async function loadImage(url: string): Promise<{ data: string; width: number; height: number } | null> {
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
