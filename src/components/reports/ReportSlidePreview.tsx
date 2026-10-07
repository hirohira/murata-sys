'use client';

import React, { useMemo, useState } from 'react';
import type { Report } from '@/types';
import {
  buildReportPages,
  ASSET_PATH,
  SLIDE_W,
  SLIDE_H,
  type Box,
  type Element,
} from '@/lib/report-pages';

interface Props {
  report: Report;
  worker?: string | null;
}

/** 報告書のスライドプレビュー（PowerPoint出力と同じページ構成・配置） */
export default function ReportSlidePreview({ report, worker }: Props) {
  const pages = useMemo(() => buildReportPages(report, { worker }), [report, worker]);
  const [current, setCurrent] = useState(0);
  const total = pages.length;
  const index = Math.min(current, total - 1);

  if (total === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-murata-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          スライドプレビュー（茂様式）
        </h3>
        <span className="text-xs text-gray-400">
          {index + 1} / {total}
        </span>
      </div>

      <div className="bg-gray-100 rounded-lg p-3 sm:p-4">
        <div className="mx-auto" style={{ maxWidth: '720px' }}>
          <div
            className="relative bg-white shadow-lg overflow-hidden"
            style={{
              aspectRatio: '4/3',
              fontFamily: "'Meiryo', 'Noto Sans JP', sans-serif",
              containerType: 'inline-size',
            }}
          >
            {pages[index].elements.map((el, i) => (
              <SlideElement key={i} el={el} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setCurrent(Math.max(index - 1, 0))}
          disabled={index === 0}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
          aria-label="前のページ"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex gap-1.5 overflow-x-auto max-w-[240px]">
          {pages.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              aria-label={`${i + 1}ページ目`}
              className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                i === index ? 'bg-murata-primary' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCurrent(Math.min(index + 1, total - 1))}
          disabled={index === total - 1}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
          aria-label="次のページ"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/** インチ単位の枠をスライド内の位置（%）に変換 */
function boxStyle(box: Box): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${(box.x / SLIDE_W) * 100}%`,
    top: `${(box.y / SLIDE_H) * 100}%`,
    width: `${(box.w / SLIDE_W) * 100}%`,
    height: `${(box.h / SLIDE_H) * 100}%`,
  };
}

/** pt をスライド幅基準の長さに変換（スライド幅10インチ = 100cqw） */
function pt(size: number): string {
  return `${((size / 72) * 100) / SLIDE_W}cqw`;
}

const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' } as const;

function SlideElement({ el }: { el: Element }) {
  switch (el.kind) {
    case 'asset':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={ASSET_PATH[el.asset]} alt="" style={{ ...boxStyle(el.box), objectFit: 'contain' }} />
      );

    case 'line':
      return (
        <div
          style={{
            ...boxStyle({ ...el.box, h: 0 }),
            borderTop: `${pt(el.widthPt)} solid #${el.color}`,
            transform: 'translateY(-50%)',
          }}
        />
      );

    case 'photo':
      return (
        <div className="overflow-hidden bg-gray-100" style={boxStyle(el.box)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={el.photo.url || el.photo.preview || ''}
            alt={el.photo.caption || ''}
            className="w-full h-full object-cover"
          />
          {el.badge && (
            <span
              className="absolute text-white font-bold text-center"
              style={{
                left: pt(4),
                top: pt(4),
                padding: `0 ${pt(4)}`,
                fontSize: pt(9),
                lineHeight: pt(17),
                background: `#${el.badge.color}`,
              }}
            >
              {el.badge.text}
            </span>
          )}
        </div>
      );

    case 'text':
      return (
        <div
          className="overflow-hidden"
          style={{
            ...boxStyle(el.box),
            display: 'flex',
            flexDirection: 'column',
            justifyContent: JUSTIFY[el.valign],
            textAlign: el.align,
            fontSize: pt(el.fontSize),
            lineHeight: el.lineSpacing,
            fontWeight: el.bold ? 700 : 400,
            color: `#${el.color ?? '222222'}`,
            fontFamily: el.font === 'rounded' ? "'HG丸ｺﾞｼｯｸM-PRO', 'Kosugi Maru', 'Meiryo', sans-serif" : undefined,
          }}
        >
          {el.paragraphs.map((p, i) => (
            <div
              key={i}
              style={{
                fontWeight: (p.bold ?? el.bold) ? 700 : 400,
                color: p.color ? `#${p.color}` : undefined,
                textDecoration: el.underline ? 'underline' : undefined,
                whiteSpace: 'pre-wrap',
                minHeight: '1em',
              }}
            >
              {p.text}
            </div>
          ))}
        </div>
      );
  }
}
