'use client';

import React, { useRef, useCallback } from 'react';
import type { ReportChapter, ChapterPhoto, PhotoTag } from '@/types';
import VoiceRecorder from '@/components/VoiceRecorder';

interface Props {
  chapter: ReportChapter;
  onUpdate: (chapter: ReportChapter) => void;
  onAddPhoto: (chapterId: string, file: File) => void;
  onRemovePhoto: (chapterId: string, photoId: string) => void;
  onUpdatePhotoCaption: (chapterId: string, photoId: string, caption: string) => void;
  onUpdatePhotoTag?: (chapterId: string, photoId: string, tag: PhotoTag) => void;
  isCompletionReport?: boolean;
}

export default function ChapterEditor({
  chapter,
  onUpdate,
  onAddPhoto,
  onRemovePhoto,
  onUpdatePhotoCaption,
  onUpdatePhotoTag,
  isCompletionReport,
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Show before/after tagging for completion report chapters that deal with before/after states
  const showBeforeAfter = isCompletionReport && ['before', 'after', 'work'].includes(chapter.key);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;
      Array.from(files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          onAddPhoto(chapter.id, file);
        }
      });
    },
    [chapter.id, onAddPhoto]
  );

  return (
    <div className="space-y-4">
      {/* Chapter title */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-murata-primary/10 text-murata-primary flex items-center justify-center text-sm font-bold flex-shrink-0">
          {chapter.sort_order + 1}
        </div>
        <input
          type="text"
          value={chapter.title}
          onChange={(e) => onUpdate({ ...chapter, title: e.target.value })}
          aria-label="章の名前"
          placeholder="章の名前"
          className="flex-1 min-w-0 font-bold text-gray-900 bg-transparent border-b border-dashed border-gray-300 focus:border-murata-primary focus:outline-none py-1"
        />
      </div>

      {/* Photo section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            写真 ({chapter.photos.length}枚)
          </p>
        </div>

        {/* Photo grid */}
        {chapter.photos.length > 0 && (
          showBeforeAfter ? (
            <BeforeAfterGrid
              photos={chapter.photos}
              chapterId={chapter.id}
              onRemove={onRemovePhoto}
              onUpdateCaption={onUpdatePhotoCaption}
              onUpdateTag={onUpdatePhotoTag}
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {chapter.photos.map((photo) => (
                <PhotoCard
                  key={photo.id}
                  photo={photo}
                  onRemove={() => onRemovePhoto(chapter.id, photo.id)}
                  onUpdateCaption={(caption) =>
                    onUpdatePhotoCaption(chapter.id, photo.id, caption)
                  }
                />
              ))}
            </div>
          )
        )}

        {/* Add photo buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 bg-murata-primary text-white py-3 px-3 rounded-xl text-sm font-medium hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            撮影
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-murata-primary text-murata-primary py-3 px-3 rounded-xl text-sm font-medium hover:bg-murata-primary/5 transition-colors active:scale-[0.98]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            選択
          </button>
        </div>

        {/* Hidden file inputs */}
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
      </div>

      {/* Description / voice input section */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          説明・所見
        </p>
        <VoiceRecorder
          value={chapter.description}
          onChange={(text) => onUpdate({ ...chapter, description: text })}
        />
        <p className="text-xs text-gray-400">
          写真を追加すると、AIが自動で所見を生成します。
        </p>
      </div>
    </div>
  );
}

function PhotoCard({
  photo,
  onRemove,
  onUpdateCaption,
  onUpdateTag,
  showTag,
}: {
  photo: ChapterPhoto;
  onRemove: () => void;
  onUpdateCaption: (caption: string) => void;
  onUpdateTag?: (tag: PhotoTag) => void;
  showTag?: boolean;
}) {
  return (
    <div className="relative group rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
      <div className="aspect-square">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.preview || photo.url || ''}
          alt={photo.caption || ''}
          className="w-full h-full object-cover"
        />
      </div>
      {/* Tag badge */}
      {photo.tag && (
        <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-white ${
          photo.tag === 'before' ? 'bg-orange-500' : 'bg-emerald-500'
        }`}>
          {photo.tag === 'before' ? '施工前' : '施工後'}
        </span>
      )}
      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
      {/* Tag selector + Caption */}
      <div className="border-t border-gray-200 bg-white">
        {showTag && onUpdateTag && (
          <div className="flex border-b border-gray-100">
            <button
              type="button"
              onClick={() => onUpdateTag('before')}
              className={`flex-1 text-[10px] py-1 font-medium transition-colors ${
                photo.tag === 'before'
                  ? 'bg-orange-100 text-orange-700'
                  : 'text-gray-400 hover:text-orange-600'
              }`}
            >
              施工前
            </button>
            <button
              type="button"
              onClick={() => onUpdateTag('after')}
              className={`flex-1 text-[10px] py-1 font-medium transition-colors ${
                photo.tag === 'after'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'text-gray-400 hover:text-emerald-600'
              }`}
            >
              施工後
            </button>
          </div>
        )}
        <input
          type="text"
          value={photo.caption}
          onChange={(e) => onUpdateCaption(e.target.value)}
          placeholder="キャプション..."
          className="w-full text-xs px-2 py-1.5 bg-white focus:ring-1 focus:ring-murata-primary focus:outline-none"
        />
      </div>
    </div>
  );
}

function BeforeAfterGrid({
  photos,
  chapterId,
  onRemove,
  onUpdateCaption,
  onUpdateTag,
}: {
  photos: ChapterPhoto[];
  chapterId: string;
  onRemove: (chapterId: string, photoId: string) => void;
  onUpdateCaption: (chapterId: string, photoId: string, caption: string) => void;
  onUpdateTag?: (chapterId: string, photoId: string, tag: PhotoTag) => void;
}) {
  const beforePhotos = photos.filter((p) => p.tag === 'before');
  const afterPhotos = photos.filter((p) => p.tag === 'after');
  const untagged = photos.filter((p) => !p.tag);

  return (
    <div className="space-y-3">
      {/* Paired: before/after side by side */}
      {beforePhotos.length > 0 && afterPhotos.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">施工前 → 施工後</p>
          <div className="grid grid-cols-2 gap-2">
            {beforePhotos.map((bp, i) => {
              const ap = afterPhotos[i];
              return (
                <React.Fragment key={bp.id}>
                  <PhotoCard
                    photo={bp}
                    onRemove={() => onRemove(chapterId, bp.id)}
                    onUpdateCaption={(c) => onUpdateCaption(chapterId, bp.id, c)}
                    onUpdateTag={onUpdateTag ? (tag) => onUpdateTag(chapterId, bp.id, tag) : undefined}
                    showTag
                  />
                  {ap ? (
                    <PhotoCard
                      photo={ap}
                      onRemove={() => onRemove(chapterId, ap.id)}
                      onUpdateCaption={(c) => onUpdateCaption(chapterId, ap.id, c)}
                      onUpdateTag={onUpdateTag ? (tag) => onUpdateTag(chapterId, ap.id, tag) : undefined}
                      showTag
                    />
                  ) : (
                    <div className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                      <span className="text-xs text-gray-400">施工後の写真を追加</span>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            {/* Extra after photos */}
            {afterPhotos.slice(beforePhotos.length).map((ap) => (
              <React.Fragment key={ap.id}>
                <div className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center">
                  <span className="text-xs text-gray-400">施工前の写真を追加</span>
                </div>
                <PhotoCard
                  photo={ap}
                  onRemove={() => onRemove(chapterId, ap.id)}
                  onUpdateCaption={(c) => onUpdateCaption(chapterId, ap.id, c)}
                  onUpdateTag={onUpdateTag ? (tag) => onUpdateTag(chapterId, ap.id, tag) : undefined}
                  showTag
                />
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Only before or only after */}
      {(beforePhotos.length > 0 && afterPhotos.length === 0) && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-orange-500 uppercase tracking-wider">施工前</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {beforePhotos.map((p) => (
              <PhotoCard
                key={p.id}
                photo={p}
                onRemove={() => onRemove(chapterId, p.id)}
                onUpdateCaption={(c) => onUpdateCaption(chapterId, p.id, c)}
                onUpdateTag={onUpdateTag ? (tag) => onUpdateTag(chapterId, p.id, tag) : undefined}
                showTag
              />
            ))}
          </div>
        </div>
      )}
      {(afterPhotos.length > 0 && beforePhotos.length === 0) && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wider">施工後</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {afterPhotos.map((p) => (
              <PhotoCard
                key={p.id}
                photo={p}
                onRemove={() => onRemove(chapterId, p.id)}
                onUpdateCaption={(c) => onUpdateCaption(chapterId, p.id, c)}
                onUpdateTag={onUpdateTag ? (tag) => onUpdateTag(chapterId, p.id, tag) : undefined}
                showTag
              />
            ))}
          </div>
        </div>
      )}

      {/* Untagged photos with tag prompt */}
      {untagged.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
            未分類（施工前/施工後をタグ付けしてください）
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {untagged.map((p) => (
              <PhotoCard
                key={p.id}
                photo={p}
                onRemove={() => onRemove(chapterId, p.id)}
                onUpdateCaption={(c) => onUpdateCaption(chapterId, p.id, c)}
                onUpdateTag={onUpdateTag ? (tag) => onUpdateTag(chapterId, p.id, tag) : undefined}
                showTag
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
