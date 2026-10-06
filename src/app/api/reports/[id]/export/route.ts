import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Report, ReportChapter } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient();
    const { data: report, error } = await supabase
      .from('reports')
      .select('*, project:projects(*)')
      .eq('id', params.id)
      .single();

    if (error || !report) {
      return NextResponse.json(
        { error: '報告書が見つかりません' },
        { status: 404 }
      );
    }

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
    const chapters = (report.chapters || []) as ReportChapter[];
    let slideNum = 2;

    for (const ch of chapters) {
      if (ch.key === 'cover') continue;
      if (!ch.description && (!ch.photos || ch.photos.length === 0)) continue;

      const slide = pptx.addSlide();
      addMurataFooter(slide, slideNum);
      slideNum++;

      // Chapter header
      slide.addText(ch.title, {
        x: 0.0,
        y: 0.0,
        w: 10.0,
        h: 0.6,
        fontSize: 16,
        bold: true,
        color: '222222',
        align: 'center',
        fontFace: 'Noto Sans JP',
      });

      // Red underline
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.5,
        y: 0.6,
        w: 9.0,
        h: 0.03,
        fill: { color: ACCENT },
      });

      const photos = ch.photos || [];
      let descY = 0.8;

      // Photos
      if (photos.length > 0) {
        const hasBeforeAfter = photos.some((p) => p.tag === 'before' || p.tag === 'after');

        if (hasBeforeAfter) {
          // Before/After layout
          const beforePhotos = photos.filter((p) => p.tag === 'before');
          const afterPhotos = photos.filter((p) => p.tag === 'after');

          slide.addText('施工前', {
            x: 0.5, y: 0.8, w: 4.2, h: 0.3,
            fontSize: 9, bold: true, color: 'E65100', align: 'center', fontFace: 'Noto Sans JP',
          });
          slide.addText('施工後', {
            x: 5.3, y: 0.8, w: 4.2, h: 0.3,
            fontSize: 9, bold: true, color: '2E7D32', align: 'center', fontFace: 'Noto Sans JP',
          });

          const maxPairs = Math.min(Math.max(beforePhotos.length, afterPhotos.length), 3);
          for (let i = 0; i < maxPairs; i++) {
            const yPos = 1.15 + i * 1.5;
            const bp = beforePhotos[i];
            const ap = afterPhotos[i];

            if (bp?.url) {
              try {
                slide.addImage({ path: bp.url, x: 0.5, y: yPos, w: 4.2, h: 1.3, rounding: true });
              } catch { /* skip if image fails */ }
            }
            if (ap?.url) {
              try {
                slide.addImage({ path: ap.url, x: 5.3, y: yPos, w: 4.2, h: 1.3, rounding: true });
              } catch { /* skip if image fails */ }
            }
          }
          descY = 1.15 + maxPairs * 1.5 + 0.1;
        } else {
          // Regular photo grid
          const cols = photos.length === 1 ? 1 : photos.length <= 4 ? 2 : 3;
          const photoW = cols === 1 ? 5.0 : cols === 2 ? 4.2 : 2.8;
          const photoH = cols === 1 ? 3.0 : cols === 2 ? 2.0 : 1.6;

          photos.slice(0, 6).forEach((p, i) => {
            if (!p.url) return;
            const col = i % cols;
            const row = Math.floor(i / cols);
            const xPos = cols === 1 ? 2.5 : 0.5 + col * (photoW + 0.3);
            const yPos = 0.8 + row * (photoH + 0.2);

            try {
              slide.addImage({ path: p.url, x: xPos, y: yPos, w: photoW, h: photoH, rounding: true });
            } catch { /* skip */ }

            if (p.caption) {
              slide.addText(p.caption, {
                x: xPos, y: yPos + photoH, w: photoW, h: 0.2,
                fontSize: 7, color: '666666', align: 'center', fontFace: 'Noto Sans JP',
              });
            }
          });

          const rows = Math.ceil(Math.min(photos.length, 6) / cols);
          descY = 0.8 + rows * (photoH + 0.3) + 0.1;
        }
      }

      // Description
      if (ch.description) {
        const maxDescH = Math.max(0.5, 6.5 - descY);
        slide.addText(ch.description, {
          x: 0.5,
          y: descY,
          w: 9.0,
          h: maxDescH,
          fontSize: 10,
          color: '333333',
          fontFace: 'Noto Sans JP',
          lineSpacing: 18,
          valign: 'top',
        });
      }
    }

    // Generate PPTX buffer
    const pptxOutput = await pptx.write({ outputType: 'nodebuffer' });
    const pptxBuffer = Buffer.from(pptxOutput as ArrayBuffer);

    return new NextResponse(pptxBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(report.title)}.pptx"`,
      },
    });
  } catch (err) {
    console.error('PPTX export error:', err);
    return NextResponse.json(
      { error: 'エクスポートに失敗しました' },
      { status: 500 }
    );
  }
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
