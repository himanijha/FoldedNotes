import { useState, useRef, useCallback, useEffect } from "react";
import styles from "../styles/AudioRecorder.module.css";

const LEVEL_BARS = 20;

type RecordingState = "idle" | "recording" | "recorded" | "submitted" | "error";

type AudioRecorderProps = {
  onTranscriptReady?: (text: string) => void;
};

export default function AudioRecorder({ onTranscriptReady }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [levelBars, setLevelBars] = useState<number[]>(() =>
    Array(LEVEL_BARS).fill(0)
  );
  const [submitting, setSubmitting] = useState(false);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedSegmentUrls, setGeneratedSegmentUrls] = useState<string[]>([]);
  const [playingSegmentIndex, setPlayingSegmentIndex] = useState(0);
  const generatedAudioUrlRef = useRef<string | null>(null);
  const generatedSegmentUrlsRef = useRef<string[]>([]);
  const playingSegmentIndexRef = useRef(0);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [submitResult, setSubmitResult] = useState<{
    text: string;
    language_code?: string;
  } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioUrlRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  const classifyEmotion = async (text: string) => {
    const res = await fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    console.log("Classify API response:", data); // <--- Check the JSON here
    return data.emotion;
  };

  const clearDuration = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    setDuration(0);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (animationFrameRef.current != null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    frequencyDataRef.current = null;
    setLevelBars(Array(LEVEL_BARS).fill(0));
  }, []);

  useEffect(() => {
    return () => stopLevelMeter();
  }, [stopLevelMeter]);

  const startLevelMeter = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);

    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    const dataArray = new Uint8Array(
      new ArrayBuffer(analyser.frequencyBinCount)
    ) as Uint8Array<ArrayBuffer>;
    frequencyDataRef.current = dataArray;

    const updateLevels = () => {
      const analyser = analyserRef.current;
      const dataArray = frequencyDataRef.current;
      if (!analyser || !dataArray) return;

      analyser.getByteFrequencyData(dataArray);
      const step = Math.floor(dataArray.length / LEVEL_BARS);
      const bars = Array.from({ length: LEVEL_BARS }, (_, i) => {
        const start = i * step;
        let sum = 0;
        for (let j = 0; j < step && start + j < dataArray.length; j++) {
          sum += dataArray[start + j];
        }
        return (sum / step) / 255;
      });
      setLevelBars(bars);
      animationFrameRef.current = requestAnimationFrame(updateLevels);
    };
    updateLevels();
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setSubmitResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stopLevelMeter();
        stopStream();
        clearDuration();
        if (chunksRef.current.length > 0) {
          const blob = new Blob(chunksRef.current, { type: "audio/webm" });
          if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = URL.createObjectURL(blob);
          setState("recorded");
        }
      };

      recorder.start();
      setState("recording");
      startTimeRef.current = Date.now();
      startLevelMeter(stream);
      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not access microphone"
      );
      setState("error");
    }
  }, [stopStream, clearDuration, startLevelMeter, stopLevelMeter]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const submitToElevenLabs = useCallback(async () => {
    const url = audioUrlRef.current;
    if (!url) return;

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(",")[1];
          resolve(base64 ?? "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBase64: base64,
          contentType: blob.type || "audio/webm",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Transcription failed");
      }

      setSubmitResult({
        text: data.text ?? "",
        language_code: data.language_code,
      });
      setState("submitted");

      if (onTranscriptReady && data.text) {
        onTranscriptReady(data.text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process recording");
    } finally {
      setSubmitting(false);
    }
  }, []);

  const generateAudioFromTranscript = useCallback(async () => {
    if (!submitResult?.text?.trim()) return;

    setGeneratingAudio(true);
    setError(null);
    setGeneratedAudioUrl(null);
    try {
      const res = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: submitResult.text,
          language_code: submitResult.language_code,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate audio");
      }

      const segments = data.segments as { audioBase64: string; contentType: string }[] | undefined;
      if (!Array.isArray(segments) || segments.length === 0) {
        throw new Error("No audio segments returned");
      }

      const urls: string[] = [];
      for (const seg of segments) {
        const binary = atob(seg.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: seg.contentType || "audio/mpeg" });
        urls.push(URL.createObjectURL(blob));
      }

      generatedSegmentUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      if (generatedAudioUrlRef.current) URL.revokeObjectURL(generatedAudioUrlRef.current);
      generatedSegmentUrlsRef.current = urls;
      generatedAudioUrlRef.current = urls[0];
      setGeneratedSegmentUrls(urls);
      setGeneratedAudioUrl(urls[0]);
      playingSegmentIndexRef.current = 0;
      setPlayingSegmentIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate audio");
    } finally {
      setGeneratingAudio(false);
    }
  }, [submitResult]);

  const reset = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    generatedSegmentUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    generatedSegmentUrlsRef.current = [];
    if (generatedAudioUrlRef.current) {
      URL.revokeObjectURL(generatedAudioUrlRef.current);
      generatedAudioUrlRef.current = null;
    }
    setGeneratedSegmentUrls([]);
    setGeneratedAudioUrl(null);
    playingSegmentIndexRef.current = 0;
    setPlayingSegmentIndex(0);
    chunksRef.current = [];
    setState("idle");
    setError(null);
    setSubmitResult(null);
  }, []);

  const handleGeneratedAudioEnded = useCallback(() => {
    const urls = generatedSegmentUrlsRef.current;
    if (urls.length <= 1) return;
    const current = playingSegmentIndexRef.current;
    const next = current + 1;
    if (next >= urls.length) return;
    playingSegmentIndexRef.current = next;
    setPlayingSegmentIndex(next);
    const audio = audioElementRef.current;
    if (audio) {
      audio.src = urls[next];
      audio.play().catch(() => {});
    }
  }, []);

  const generatedAudioSrc =
    generatedSegmentUrls.length > 0 && playingSegmentIndex < generatedSegmentUrls.length
      ? generatedSegmentUrls[playingSegmentIndex]
      : generatedAudioUrl;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={styles.wrapper}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {state === "idle" && (
        <button
          type="button"
          className={styles.recordButton}
          onClick={startRecording}
          aria-label="Start recording"
        >
          <span className={styles.micIcon} aria-hidden />
          Tap to record
        </button>
      )}

      {state === "recording" && (
        <div className={styles.recordingBlock}>
          <div
            className={styles.levelMeter}
            role="img"
            aria-label="Microphone level"
          >
            {levelBars.map((level, i) => (
              <div
                key={i}
                className={styles.levelBar}
                style={{
                  height: `${Math.max(12, level * 100)}%`,
                  animationDelay: `${i * 0.02}s`,
                }}
              />
            ))}
          </div>
          <div className={styles.timer}>{formatTime(duration)}</div>
          <button
            type="button"
            className={styles.stopButton}
            onClick={stopRecording}
            aria-label="Stop recording"
          >
            Stop
          </button>
        </div>
      )}

      {state === "recorded" && (
        <div className={styles.recorded}>
          <audio
            className={styles.audio}
            src={audioUrlRef.current ?? undefined}
            controls
            preload="metadata"
          />
          <div className={styles.recordedActions}>
            <button
              type="button"
              className={styles.submitButton}
              onClick={submitToElevenLabs}
              disabled={submitting}
            >
              {submitting ? "Processing…" : "Submit to process"}
            </button>
            <button
              type="button"
              className={styles.againButton}
              onClick={reset}
            >
              Record another
            </button>
          </div>
        </div>
      )}

      {state === "submitted" && submitResult && (
        <div className={styles.submitted}>
          <p className={styles.submittedLabel}>Transcript</p>
          <p className={styles.submittedText}>{submitResult.text || "(empty)"}</p>
          {submitResult.language_code && (
            <p className={styles.submittedMeta}>
              Language: {submitResult.language_code}
            </p>
          )}
          <button
            type="button"
            className={styles.generateButton}
            onClick={generateAudioFromTranscript}
            disabled={generatingAudio || !submitResult.text?.trim()}
          >
            {generatingAudio ? "Generating…" : "Generate audio from transcript"}
          </button>
          {(generatedAudioUrl || generatedSegmentUrls.length > 0) && (
            <div className={styles.generatedAudio}>
              <p className={styles.submittedLabel}>Generated audio</p>
              <audio
                ref={audioElementRef}
                className={styles.audio}
                src={generatedAudioSrc ?? undefined}
                controls
                preload="metadata"
                onEnded={handleGeneratedAudioEnded}
              />
            </div>
          )}
          <button
            type="button"
            className={styles.againButton}
            onClick={reset}
          >
            Record another
          </button>
        </div>
      )}

      {state === "error" && (
        <button
          type="button"
          className={styles.recordButton}
          onClick={startRecording}
        >
          Try again
        </button>
      )}
    </div>
  );
}
