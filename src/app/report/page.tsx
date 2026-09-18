"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Finding {
  photoId: string;
  photoNumber: number;
  location: string;
  finding: string;
  severity: "要補修" | "経過観察" | "問題なし";
  recommendation: string;
}

interface ReportData {
  siteName: string;
  buildingName: string;
  inspectionDate: string;
  findings: Finding[];
  summary: string;
}

interface PhotoData {
  id: string;
  base64: string;
  mimeType: string;
  location: string;
}

const severityColor: Record<string, { bg: string; text: string; border: string }> = {
  要補修: { bg: "bg-red-50", text: "text-red-700", border: "border-red-300" },
  経過観察: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-300" },
  問題なし: { bg: "bg-green-50", text: "text-green-700", border: "border-green-300" },
};

export default function ReportPage() {
  const router = useRouter();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [photos, setPhotos] = useState<PhotoData[]>([]);

  useEffect(() => {
    const dataStr = sessionStorage.getItem("reportData");
    const photosStr = sessionStorage.getItem("reportPhotos");

    if (!dataStr || !photosStr) {
      router.push("/");
      return;
    }

    setReportData(JSON.parse(dataStr));
    setPhotos(JSON.parse(photosStr));
  }, [router]);

  if (!reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-murata-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const getPhoto = (photoId: string) => photos.find((p) => p.id === photoId);

  return (
    <div className="min-h-screen bg-gray-200 py-8">
      {/* Toolbar */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex items-center justify-between px-4">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-murata-primary"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          入力画面に戻る
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-murata-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-900"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          印刷 / PDF保存
        </button>
      </div>

      {/* Report Page - Cover */}
      <div className="report-page mb-8">
        <div className="flex flex-col h-full">
          {/* Company header bar */}
          <div className="border-b-4 border-murata-primary pb-4 mb-12">
            <div className="text-right text-sm text-gray-500">
              株式会社 MURATA
            </div>
          </div>

          {/* Center content */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-lg text-gray-500 mb-4 tracking-widest">INSPECTION REPORT</p>
            <h1 className="text-4xl font-bold text-murata-dark mb-2 tracking-wide">
              調 査 報 告 書
            </h1>
            <div className="w-24 h-1 bg-murata-accent mt-4 mb-12" />

            <div className="text-center space-y-3">
              <p className="text-2xl font-bold text-murata-dark">
                {reportData.siteName}
              </p>
              {reportData.buildingName && (
                <p className="text-lg text-gray-600">{reportData.buildingName}</p>
              )}
            </div>
          </div>

          {/* Bottom info */}
          <div className="border-t-2 border-gray-200 pt-6 mt-12">
            <table className="mx-auto text-sm">
              <tbody>
                <tr>
                  <td className="text-gray-500 pr-6 py-1">調査日</td>
                  <td className="font-medium text-murata-dark">
                    {formatDate(reportData.inspectionDate)}
                  </td>
                </tr>
                <tr>
                  <td className="text-gray-500 pr-6 py-1">作成日</td>
                  <td className="font-medium text-murata-dark">
                    {formatDate(new Date().toISOString().split("T")[0])}
                  </td>
                </tr>
                <tr>
                  <td className="text-gray-500 pr-6 py-1">作成者</td>
                  <td className="font-medium text-murata-dark">
                    株式会社 MURATA
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Report Page - Findings (2 photos per page) */}
      {Array.from(
        { length: Math.ceil(reportData.findings.length / 2) },
        (_, pageIdx) => {
          const pagefindings = reportData.findings.slice(
            pageIdx * 2,
            pageIdx * 2 + 2
          );
          return (
            <div key={pageIdx} className="report-page mb-8">
              {/* Page header */}
              <div className="flex items-center justify-between border-b-2 border-murata-primary pb-2 mb-6">
                <h2 className="text-lg font-bold text-murata-primary">
                  状況写真・所見
                </h2>
                <span className="text-xs text-gray-400">
                  {reportData.siteName} | {formatDate(reportData.inspectionDate)}
                </span>
              </div>

              <div className="space-y-8">
                {pagefindings.map((finding) => {
                  const photo = getPhoto(finding.photoId);
                  const sev = severityColor[finding.severity] || severityColor["経過観察"];

                  return (
                    <div
                      key={finding.photoId}
                      className="border border-gray-200 rounded-lg overflow-hidden"
                    >
                      {/* Photo section */}
                      <div className="bg-gray-50 p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-murata-primary text-white text-xs font-bold px-2 py-0.5 rounded">
                            写真 {finding.photoNumber}
                          </span>
                          <span className="text-sm text-gray-600">
                            {finding.location}
                          </span>
                          <span
                            className={`ml-auto text-xs font-bold px-2 py-0.5 rounded border ${sev.bg} ${sev.text} ${sev.border}`}
                          >
                            {finding.severity}
                          </span>
                        </div>
                        {photo && (
                          <div className="aspect-[16/10] bg-white rounded overflow-hidden border border-gray-200">
                            <img
                              src={`data:${photo.mimeType};base64,${photo.base64}`}
                              alt={`写真 ${finding.photoNumber}`}
                              className="w-full h-full object-contain"
                            />
                          </div>
                        )}
                      </div>

                      {/* Finding text */}
                      <div className="p-4 space-y-2">
                        <div>
                          <span className="text-xs font-bold text-murata-primary">
                            ■ 所見
                          </span>
                          <p className="text-sm text-gray-800 mt-1 leading-relaxed">
                            {finding.finding}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-murata-accent">
                            ■ 推奨対応
                          </span>
                          <p className="text-sm text-gray-800 mt-1 leading-relaxed">
                            {finding.recommendation}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Page number */}
              <div className="mt-6 text-center text-xs text-gray-400">
                {pageIdx + 2}
              </div>
            </div>
          );
        }
      )}

      {/* Report Page - Summary */}
      <div className="report-page mb-8">
        <div className="flex items-center justify-between border-b-2 border-murata-primary pb-2 mb-6">
          <h2 className="text-lg font-bold text-murata-primary">調査総括</h2>
          <span className="text-xs text-gray-400">
            {reportData.siteName} | {formatDate(reportData.inspectionDate)}
          </span>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-6">
          <p className="text-sm leading-relaxed text-gray-800 whitespace-pre-wrap">
            {reportData.summary}
          </p>
        </div>

        {/* Severity summary table */}
        <h3 className="text-sm font-bold text-murata-dark mb-3">
          判定一覧
        </h3>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-murata-primary text-white">
              <th className="py-2 px-3 text-left">No.</th>
              <th className="py-2 px-3 text-left">撮影箇所</th>
              <th className="py-2 px-3 text-center">判定</th>
              <th className="py-2 px-3 text-left">推奨対応</th>
            </tr>
          </thead>
          <tbody>
            {reportData.findings.map((f, i) => {
              const sev = severityColor[f.severity] || severityColor["経過観察"];
              return (
                <tr
                  key={f.photoId}
                  className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}
                >
                  <td className="py-2 px-3 border-b border-gray-200">
                    {f.photoNumber}
                  </td>
                  <td className="py-2 px-3 border-b border-gray-200">
                    {f.location}
                  </td>
                  <td className="py-2 px-3 border-b border-gray-200 text-center">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${sev.bg} ${sev.text}`}
                    >
                      {f.severity}
                    </span>
                  </td>
                  <td className="py-2 px-3 border-b border-gray-200">
                    {f.recommendation}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div className="mt-auto pt-12 border-t border-gray-200 mt-12">
          <div className="text-center text-sm text-gray-500">
            <p className="font-bold text-murata-dark mb-1">株式会社 MURATA</p>
            <p>本報告書は現地調査に基づき作成したものです。</p>
          </div>
        </div>
      </div>
    </div>
  );
}
