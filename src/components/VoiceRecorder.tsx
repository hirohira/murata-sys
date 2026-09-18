"use client";

import { useState, useRef, useCallback } from "react";

interface Props {
  value: string;
  onChange: (text: string) => void;
}

const MAX_RECORDING_SECONDS = 60;

export default function VoiceRecorder({ value, onChange }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stopRecordingRef = useRef<() => void>();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Try to use a lower bitrate codec to keep file size small
      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000, // Low bitrate to reduce file size
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        await transcribeAudio(blob);
      };

      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingTime(0);

      // Auto-stop after MAX_RECORDING_SECONDS
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds += 1;
        setRecordingTime(seconds);
        if (seconds >= MAX_RECORDING_SECONDS) {
          stopRecordingRef.current?.();
        }
      }, 1000);
    } catch {
      alert("マイクへのアクセスが許可されていません");
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Keep ref in sync for auto-stop timer
  stopRecordingRef.current = stopRecording;

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      // Check file size before sending
      const sizeMB = blob.size / (1024 * 1024);
      if (sizeMB > 4) {
        throw new Error(
          `音声ファイルが大きすぎます（${sizeMB.toFixed(1)}MB）。短めに録音してください。`
        );
      }

      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        let errorMsg = "文字起こしに失敗しました";
        try {
          const err = await res.json();
          errorMsg = err.error || errorMsg;
        } catch {
          // Response may not be JSON
        }
        throw new Error(errorMsg);
      }

      const { text } = await res.json();
      // Append transcribed text to existing description
      onChange(value ? `${value}\n${text}` : text);
    } catch (err) {
      alert(err instanceof Error ? err.message : "文字起こしに失敗しました");
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const remaining = MAX_RECORDING_SECONDS - recordingTime;

  return (
    <div className="space-y-2">
      {/* Voice recording controls */}
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <button
            onClick={startRecording}
            disabled={isTranscribing}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isTranscribing
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
            }`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
            音声入力
          </button>
        ) : (
          <button
            onClick={stopRecording}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 animate-pulse"
          >
            <span className="w-3 h-3 bg-white rounded-sm" />
            録音停止 {formatTime(recordingTime)}
          </button>
        )}

        {isRecording && (
          <span className="text-xs text-gray-400">
            残り {remaining}秒
          </span>
        )}

        {isTranscribing && (
          <span className="text-sm text-gray-500 flex items-center gap-1">
            <svg
              className="animate-spin h-4 w-4"
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
            文字起こし中...
          </span>
        )}
      </div>

      {/* Text input area */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="所見を入力してください。&#10;例：外壁コーキング部に経年劣化によるひび割れを確認。幅0.5mm程度。雨水浸入のリスクあり。"
        rows={4}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-murata-primary focus:border-transparent resize-y"
      />
      <p className="text-xs text-gray-400">
        音声入力した内容はテキストに変換されます。手動で編集も可能です。（最大{MAX_RECORDING_SECONDS}秒）
      </p>
    </div>
  );
}
