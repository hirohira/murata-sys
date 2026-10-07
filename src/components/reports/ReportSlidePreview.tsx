'use client';

import React, { useState } from 'react';
import type { Report, ReportChapter } from '@/types';
import { getOutputChapters } from '@/lib/chapter-numbering';
import { layoutChapterSlide, SLIDE_W, SLIDE_H, TITLE_BOX, TITLE_RULE, type Box } from '@/lib/slide-layout';

interface Props {
  report: Report;
}

export default function ReportSlidePreview({ report }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Build slides: cover + one per chapter with content
  const slides = buildSlides(report);
  const totalSlides = slides.length;

  const goNext = () => setCurrentSlide((p) => Math.min(p + 1, totalSlides - 1));
  const goPrev = () => setCurrentSlide((p) => Math.max(p - 1, 0));

  if (totalSlides === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-murata-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          スライドプレビュー（茂様式）
        </h3>
        <span className="text-xs text-gray-400">{currentSlide + 1} / {totalSlides}</span>
      </div>

      {/* Slide container */}
      <div className="bg-gray-100 rounded-lg p-3 sm:p-4">
        <div className="relative mx-auto" style={{ maxWidth: '640px' }}>
          {/* 4:3 aspect ratio slide */}
          <div
            className="relative bg-white shadow-lg overflow-hidden"
            style={{ aspectRatio: '4/3', fontFamily: "'Noto Sans JP', sans-serif", containerType: 'inline-size' }}
          >
            {slides[currentSlide]}

            {/* Footer - 茂様式 */}
            <div
              className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-white"
              style={{
                borderTop: '0.4cqw solid #D32F2F',
                padding: '0.62cqw 1.88cqw 0.94cqw',
                fontSize: '1.56cqw',
                color: '#888',
              }}
            >
              <div className="flex items-center" style={{ gap: '0.94cqw', fontWeight: 700, color: '#1B4F72', fontSize: '1.56cqw' }}>
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    width: '2.81cqw',
                    height: '2.19cqw',
                    background: '#D32F2F',
                    color: '#fff',
                    fontSize: '1.25cqw',
                    fontWeight: 800,
                    textAlign: 'center',
                    lineHeight: '2.19cqw',
                    borderRadius: '0.31cqw',
                  }}
                >
                  M
                </span>
                株式会社MURATA
              </div>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '1.72cqw', color: '#aaa' }}>
                {currentSlide + 1}
              </span>
              <span style={{ fontSize: '1.41cqw', color: '#1976D2', fontWeight: 600 }}>
                murata-reform.jp
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentSlide === 0}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Dot indicators */}
        <div className="flex gap-1.5 overflow-x-auto max-w-[200px]">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentSlide(i)}
              className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${
                i === currentSlide ? 'bg-murata-primary' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={goNext}
          disabled={currentSlide === totalSlides - 1}
          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function buildSlides(report: Report): React.ReactNode[] {
  const slides: React.ReactNode[] = [];

  // Cover slide
  slides.push(<CoverSlide key="cover" report={report} />);

  // One slide per chapter (empty chapters and the cover chapter are skipped)
  getOutputChapters(report.chapters).forEach(({ chapter, displayTitle }, idx) => {
    slides.push(<ChapterSlide key={chapter.id || idx} chapter={chapter} title={displayTitle} />);
  });

  return slides;
}

function CoverSlide({ report }: { report: Report }) {
  const project = report.project;
  const meta = report.meta;

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 pb-8" style={{ paddingTop: '15%' }}>
      <div
        className="text-center mb-4"
        style={{ borderBottom: '2.5px solid #D32F2F', paddingBottom: '12px', width: '80%' }}
      >
        <p style={{ fontSize: '11px', color: '#888', letterSpacing: '2px', marginBottom: '6px' }}>
          {report.report_type}
        </p>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#222', lineHeight: 1.4 }}>
          {report.title}
        </h1>
      </div>

      <div className="text-center space-y-1 mt-4" style={{ fontSize: '11px', color: '#555' }}>
        {project && (
          <p>{project.customer_name} 様</p>
        )}
        {meta?.construction_name && <p>{meta.construction_name}</p>}
        {meta?.survey_date && (
          <p>調査日: {meta.survey_date}</p>
        )}
        <p style={{ marginTop: '12px', color: '#888' }}>
          作成日: {new Date(report.created_at).toLocaleDateString('ja-JP')}
        </p>
      </div>

      <div className="mt-auto text-center" style={{ fontSize: '12px', color: '#1B4F72', fontWeight: 700 }}>
        <div className="flex items-center justify-center gap-2">
          <span
            className="inline-flex items-center justify-center"
            style={{
              width: '24px',
              height: '18px',
              background: '#D32F2F',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 800,
              borderRadius: '2px',
            }}
          >
            M
          </span>
          株式会社MURATA
        </div>
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

function ChapterSlide({ chapter, title }: { chapter: ReportChapter; title: string }) {
  const layout = layoutChapterSlide(chapter.photos || [], chapter.description || '');

  return (
    <div className="absolute inset-0">
      {/* 章見出し＋赤線 */}
      <div
        className="flex items-center justify-center text-center"
        style={{ ...boxStyle(TITLE_BOX), fontSize: pt(16), fontWeight: 700, color: '#222' }}
      >
        {title}
      </div>
      <div style={{ ...boxStyle(TITLE_RULE), background: '#D32F2F' }} />

      {/* 施工前/施工後ラベル */}
      {layout.labels.map((l) => (
        <div
          key={l.text}
          className="flex items-center justify-center"
          style={{ ...boxStyle(l.box), fontSize: pt(10), fontWeight: 700, color: `#${l.color}` }}
        >
          {l.text}
        </div>
      ))}

      {/* 写真 */}
      {layout.photos.map(({ photo, box, caption }) => (
        <React.Fragment key={photo.id}>
          <div className="overflow-hidden bg-gray-100" style={{ ...boxStyle(box), borderRadius: '0.6cqw' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url || photo.preview || ''} alt={photo.caption || ''} className="w-full h-full object-cover" />
          </div>
          {caption && (
            <div
              className="text-center truncate"
              style={{ ...boxStyle(caption.box), fontSize: pt(8), color: '#666', lineHeight: 1.6 }}
            >
              {caption.text}
            </div>
          )}
        </React.Fragment>
      ))}

      {layout.hiddenCount > 0 && (
        <div
          className="text-right"
          style={{ position: 'absolute', right: '5%', top: '10.7%', fontSize: pt(8), color: '#888' }}
        >
          ほか{layout.hiddenCount}枚
        </div>
      )}

      {/* 説明文（枠内に収まるよう文字サイズを自動調整） */}
      {layout.description && (
        <div
          className="overflow-hidden whitespace-pre-wrap"
          style={{
            ...boxStyle(layout.description.box),
            fontSize: pt(layout.description.fontSize),
            lineHeight: 1.5,
            color: '#333',
          }}
        >
          {layout.description.text}
        </div>
      )}
    </div>
  );
}
