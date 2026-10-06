'use client';

import { useRef, useCallback } from 'react';
import { PHOTO_CATEGORIES, CATEGORY_COLORS } from '@/lib/constants';
import type { PhotoEntry, PhotoCategory } from '@/types';

interface Props {
  photos: PhotoEntry[];
  onAdd: (file: File) => void;
  onRemove: (id: string) => void;
  onUpdateCategory: (id: string, category: PhotoCategory) => void;
  onUpdateCaption: (id: string, caption: string) => void;
}

export default function PhotoCaptureSection({
  photos,
  onAdd,
  onRemove,
  onUpdateCategory,
  onUpdateCaption,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          onAdd(file);
        }
      });
    },
    [onAdd]
  );

  return (
    <div className="space-y-4">
      {/* Camera + file buttons */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 bg-murata-primary text-white py-3.5 px-4 rounded-xl font-medium hover:opacity-90 transition-opacity active:scale-[0.98]"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          撮影
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-murata-primary text-murata-primary py-3.5 px-4 rounded-xl font-medium hover:bg-murata-primary-light transition-colors active:scale-[0.98]"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          選択
        </button>
      </div>

      {/* Hidden inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="space-y-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="card overflow-hidden"
            >
              <div className="flex gap-3 p-3">
                {/* Thumbnail */}
                <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.preview}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {photo.uploading && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Category buttons */}
                  <div className="flex gap-1 flex-wrap">
                    {PHOTO_CATEGORIES.map((cat) => {
                      const colors = CATEGORY_COLORS[cat];
                      const isActive = photo.category === cat;
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => onUpdateCategory(photo.id, cat)}
                          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                            isActive
                              ? `${colors.bg} ${colors.text}`
                              : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                          }`}
                        >
                          {cat}
                        </button>
                      );
                    })}
                  </div>

                  {/* Caption input */}
                  <input
                    type="text"
                    value={photo.caption}
                    onChange={(e) => onUpdateCaption(photo.id, e.target.value)}
                    placeholder="写真の説明..."
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-murata-primary focus:border-transparent"
                  />
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => onRemove(photo.id)}
                  className="self-start text-gray-300 hover:text-red-500 transition-colors p-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          <p className="text-xs text-gray-400 text-center">
            {photos.length} 枚の写真
          </p>
        </div>
      )}
    </div>
  );
}
