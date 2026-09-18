"use client";

import { useState, useCallback } from "react";
import PhotoUploader from "@/components/PhotoUploader";
import VoiceRecorder from "@/components/VoiceRecorder";
import { useRouter } from "next/navigation";

export interface PhotoEntry {
  id: string;
  file: File;
  preview: string;
  description: string;
  location: string;
}

export default function Home() {
  const router = useRouter();
  const [photos, setPhotos] = useState<PhotoEntry[]>([]);
  const [siteName, setSiteName] = useState("");
  const [buildingName, setBuildingName] = useState("");
  const [inspectionDate, setInspectionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);

  const addPhoto = useCallback((file: File) => {
    const id = crypto.randomUUID();
    const preview = URL.createObjectURL(file);
    setPhotos((prev) => [
      ...prev,
      { id, file, preview, description: "", location: "" },
    ]);
    setActivePhotoId(id);
  }, []);

  const updatePhotoDescription = useCallback(
    (id: string, description: string) => {
      setPhotos((prev) =>
        prev.map((p) => (p.id === id ? { ...p, description } : p))
      );
    },
    []
  );

  const updatePhotoLocation = useCallback((id: string, location: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, location } : p))
    );
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.preview);
      return prev.filter((p) => p.id !== id);
    });
    setActivePhotoId((current) => (current === id ? null : current));
  }, []);

  const handleGenerate = async () => {
    if (photos.length === 0) {
      alert("写真を1枚以上追加してください");
      return;
    }

    setIsGenerating(true);

    try {
      // Convert photos to base64 for API
      const photoData = await Promise.all(
        photos.map(async (photo) => {
          const buffer = await photo.file.arrayBuffer();
          const base64 = btoa(
            new Uint8Array(buffer).reduce(
              (data, byte) => data + String.fromCharCode(byte),
              ""
            )
          );
          return {
            id: photo.id,
            base64,
            mimeType: photo.file.type,
            description: photo.description,
            location: photo.location,
            fileName: photo.file.name,
          };
        })
      );

      const response = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName,
          buildingName,
          inspectionDate,
          photos: photoData,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "生成に失敗しました");
      }

      const result = await response.json();

      // Store report data in sessionStorage for report page
      sessionStorage.setItem("reportData", JSON.stringify(result));
      sessionStorage.setItem(
        "reportPhotos",
        JSON.stringify(
          photoData.map((p) => ({
            id: p.id,
            base64: p.base64,
            mimeType: p.mimeType,
            location: p.location,
          }))
        )
      );

      router.push("/report");
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "エラーが発生しました"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const activePhoto = photos.find((p) => p.id === activePhotoId);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-murata-primary text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center text-xl font-bold">
              M
            </div>
            <div>
              <h1 className="text-xl font-bold">MURATA 調査報告書システム</h1>
              <p className="text-sm text-blue-200">
                写真・音声入力から報告書を自動生成
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Site Info */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-murata-dark mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-murata-primary text-white rounded-full flex items-center justify-center text-sm">
              1
            </span>
            現場情報
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                現場名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="例：メドウ松が丘"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-murata-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                建物名
              </label>
              <input
                type="text"
                value={buildingName}
                onChange={(e) => setBuildingName(e.target.value)}
                placeholder="例：A棟"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-murata-primary focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                調査日
              </label>
              <input
                type="date"
                value={inspectionDate}
                onChange={(e) => setInspectionDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-murata-primary focus:border-transparent"
              />
            </div>
          </div>
        </section>

        {/* Photo Upload + Description */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h2 className="text-lg font-bold text-murata-dark mb-4 flex items-center gap-2">
            <span className="w-7 h-7 bg-murata-primary text-white rounded-full flex items-center justify-center text-sm">
              2
            </span>
            写真・所見の入力
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Photo grid + uploader */}
            <div>
              <PhotoUploader onPhotoAdd={addPhoto} />

              {photos.length > 0 && (
                <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {photos.map((photo, idx) => (
                    <button
                      key={photo.id}
                      onClick={() => setActivePhotoId(photo.id)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        activePhotoId === photo.id
                          ? "border-murata-accent ring-2 ring-murata-accent/30"
                          : "border-gray-200 hover:border-gray-400"
                      }`}
                    >
                      <img
                        src={photo.preview}
                        alt={`写真 ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                        {idx + 1}
                      </span>
                      {photo.description && (
                        <span className="absolute bottom-1 right-1 bg-green-500 w-2.5 h-2.5 rounded-full" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhoto(photo.id);
                        }}
                        className="absolute top-1 right-1 bg-red-500 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 hover:opacity-100"
                        style={{ opacity: activePhotoId === photo.id ? 1 : undefined }}
                      >
                        ×
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Description input for selected photo */}
            <div>
              {activePhoto ? (
                <div className="space-y-4">
                  <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 border">
                    <img
                      src={activePhoto.preview}
                      alt="選択中の写真"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      撮影箇所
                    </label>
                    <input
                      type="text"
                      value={activePhoto.location}
                      onChange={(e) =>
                        updatePhotoLocation(activePhoto.id, e.target.value)
                      }
                      placeholder="例：北面 2階バルコニー手すり"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-murata-primary focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      所見（音声またはテキスト）
                    </label>
                    <VoiceRecorder
                      value={activePhoto.description}
                      onChange={(text) =>
                        updatePhotoDescription(activePhoto.id, text)
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
                  <div className="text-center">
                    <svg
                      className="mx-auto w-12 h-12 mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
                      />
                    </svg>
                    <p className="text-sm">写真を選択してください</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Summary */}
        {photos.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-murata-dark mb-3 flex items-center gap-2">
              <span className="w-7 h-7 bg-murata-primary text-white rounded-full flex items-center justify-center text-sm">
                3
              </span>
              入力状況
            </h2>
            <div className="flex items-center gap-6 text-sm text-gray-600 mb-4">
              <span>
                写真: <strong className="text-murata-dark">{photos.length}</strong> 枚
              </span>
              <span>
                所見入力済:{" "}
                <strong className="text-green-600">
                  {photos.filter((p) => p.description).length}
                </strong>{" "}
                / {photos.length}
              </span>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !siteName}
              className={`w-full py-3 rounded-xl text-white font-bold text-base transition-all ${
                isGenerating || !siteName
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-murata-accent hover:bg-orange-600 shadow-md hover:shadow-lg active:scale-[0.98]"
              }`}
            >
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="animate-spin h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  AI で報告書を生成中...
                </span>
              ) : (
                "調査報告書を生成する"
              )}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
