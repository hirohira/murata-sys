'use client';

import React, { useState } from 'react';
import type { Report, ReportChapter } from '@/types';
import { getOutputChapters } from '@/lib/chapter-numbering';

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
            style={{ aspectRatio: '4/3', fontFamily: "'Noto Sans JP', sans-serif" }}
          >
            {slides[currentSlide]}

            {/* Footer - 茂様式 */}
            <div
              className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-white"
              style={{
                borderTop: '2.5px solid #D32F2F',
                padding: '4px 12px 6px',
                fontSize: '10px',
                color: '#888',
              }}
            >
              <div className="flex items-center gap-1.5" style={{ fontWeight: 700, color: '#1B4F72', fontSize: '10px' }}>
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    width: '18px',
                    height: '14px',
                    background: '#D32F2F',
                    color: '#fff',
                    fontSize: '8px',
                    fontWeight: 800,
                    textAlign: 'center',
                    lineHeight: '14px',
                    borderRadius: '2px',
                  }}
                >
                  M
                </span>
                株式会社MURATA
              </div>
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '11px', color: '#aaa' }}>
                {currentSlide + 1}
              </span>
              <span style={{ fontSize: '9px', color: '#1976D2', fontWeight: 600 }}>
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

function ChapterSlide({ chapter, title }: { chapter: ReportChapter; title: string }) {
  const photos = chapter.photos || [];
  const hasBeforeAfter = photos.some((p) => p.tag === 'before' || p.tag === 'after');

  return (
    <div className="flex flex-col h-full pb-6">
      {/* Chapter header with red underline */}
      <div
        className="text-center"
        style={{
          padding: '12px 20px 8px',
          fontSize: '15px',
          fontWeight: 700,
          color: '#222',
          borderBottom: '2.5px solid #D32F2F',
        }}
      >
        {title}
      </div>

      <div className="flex-1 px-4 py-3 overflow-hidden" style={{ fontSize: '10px' }}>
        {/* Photo grid */}
        {photos.length > 0 && (
          hasBeforeAfter ? (
            <BeforeAfterPhotoLayout photos={photos} />
          ) : (
            <div
              className="grid gap-1.5 mb-2"
              style={{
                gridTemplateColumns: photos.length === 1 ? '1fr' : photos.length <= 4 ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
              }}
            >
              {photos.slice(0, 6).map((p) => (
                <div key={p.id} className="rounded overflow-hidden bg-gray-100" style={{ aspectRatio: '4/3' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url || p.preview || ''}
                    alt={p.caption || ''}
                    className="w-full h-full object-cover"
                  />
                  {p.caption && (
                    <p className="text-center truncate px-1" style={{ fontSize: '8px', color: '#666', marginTop: '1px' }}>
                      {p.caption}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* Description */}
        {chapter.description && (
          <div style={{ fontSize: '10px', color: '#333', lineHeight: 1.6 }}>
            <p className="whitespace-pre-wrap line-clamp-6">{chapter.description}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BeforeAfterPhotoLayout({ photos }: { photos: ReportChapter['photos'] }) {
  const beforePhotos = photos.filter((p) => p.tag === 'before');
  const afterPhotos = photos.filter((p) => p.tag === 'after');
  const maxPairs = Math.max(beforePhotos.length, afterPhotos.length);

  return (
    <div className="mb-2">
      <div className="grid grid-cols-2 gap-1.5">
        <div className="text-center" style={{ fontSize: '9px', fontWeight: 600, color: '#E65100' }}>施工前</div>
        <div className="text-center" style={{ fontSize: '9px', fontWeight: 600, color: '#2E7D32' }}>施工後</div>
        {Array.from({ length: Math.min(maxPairs, 3) }).map((_, i) => {
          const bp = beforePhotos[i];
          const ap = afterPhotos[i];
          return (
            <React.Fragment key={i}>
              <div className="rounded overflow-hidden bg-gray-100" style={{ aspectRatio: '4/3' }}>
                {bp ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={bp.url || bp.preview || ''} alt={bp.caption || ''} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300" style={{ fontSize: '8px' }}>—</div>
                )}
              </div>
              <div className="rounded overflow-hidden bg-gray-100" style={{ aspectRatio: '4/3' }}>
                {ap ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ap.url || ap.preview || ''} alt={ap.caption || ''} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300" style={{ fontSize: '8px' }}>—</div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

