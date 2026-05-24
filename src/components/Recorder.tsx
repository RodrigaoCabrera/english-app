"use client";

import { useState, useRef, useCallback } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PronunciationScore } from "@/services/pronunciation-scorer";

type RecorderState = "idle" | "recording" | "processing";

interface Props {
  referenceText: string;
  readingId: number;
  onResult: (score: PronunciationScore) => void;
  onError: (message: string) => void;
}

function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);  // PCM
  view.setUint16(22, 1, true);  // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

async function blobToWavBlob(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 16000 });
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);
  audioCtx.close();

  // Mix down to mono using first channel
  const samples = decoded.getChannelData(0);
  const wavBuffer = encodeWAV(samples, 16000);
  return new Blob([wavBuffer], { type: "audio/wav" });
}

export function Recorder({ referenceText, readingId, onResult, onError }: Props) {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setState("processing");
        stopTimer();

        try {
          const rawBlob = new Blob(chunksRef.current, { type: recorder.mimeType });
          const wavBlob = await blobToWavBlob(rawBlob);

          const form = new FormData();
          form.append("audio", wavBlob, "recording.wav");
          form.append("referenceText", referenceText);
          form.append("readingId", String(readingId));

          const res = await fetch("/api/speech/assess", { method: "POST", body: form });
          const json = await res.json();

          if (json.success) {
            onResult(json.data as PronunciationScore);
          } else {
            onError(json.error ?? "Assessment failed");
          }
        } catch {
          onError("Failed to process audio. Please try again.");
        } finally {
          setState("idle");
          setSeconds(0);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setState("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      onError("Microphone access denied. Please allow microphone permission.");
    }
  }, [referenceText, readingId, onResult, onError, stopTimer]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    stopTimer();
  }, [stopTimer]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-4">
      {state === "idle" && (
        <Button onClick={startRecording} className="gap-2">
          <Mic className="h-4 w-4" />
          Start Recording
        </Button>
      )}

      {state === "recording" && (
        <>
          <Button onClick={stopRecording} variant="destructive" className="gap-2">
            <Square className="h-4 w-4" />
            Stop
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            {formatTime(seconds)}
          </span>
        </>
      )}

      {state === "processing" && (
        <span className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analyzing pronunciation…
        </span>
      )}
    </div>
  );
}
