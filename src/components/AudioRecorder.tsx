import { useState, useRef, useCallback, useEffect } from "react";
import styles from "../styles/AudioRecorder.module.css";
import { setStoredTranscript } from "./GenerateFromTranscript";

const LEVEL_BARS = 20;

type RecordingState = "idle" | "recording" | "recorded" | "submitted" | "error";

type AudioRecorderProps = {
  onTranscriptReady?: (text: string) => void;
  onEmotionReady?: (emotion: string) => void;
};

export default function AudioRecorder({ onTranscriptReady, onEmotionReady }: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [levelBars, setLevelBars] = useState<number[]>(() =>
    Array(LEVEL_BARS).fill(0)
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    text: string;
    language_code?: string;
    submittedAt?: string;
  } | null>(null);
  const [emotionResult, setEmotionResult] = useState<string | null>(null);
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

  const SENDING_MIN_MS = 6000;

    const submitToElevenLabs = useCallback(async () => {
        const url = audioUrlRef.current;
        if (!url) return;

        setSubmitting(true);
        setError(null);
        const start = Date.now();

        try {
            // 1️⃣ Fetch audio blob from the recorded URL
            const response = await fetch(url);
            const blob = await response.blob();

            // 2️⃣ Convert to base64
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve, reject) => {
                reader.onloadend = () => {
                    const result = reader.result as string;
                    resolve(result.split(",")[1] ?? "");
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            // 3️⃣ Send to ElevenLabs API
            const res = await fetch("/api/transcribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    audioBase64: base64,
                    contentType: blob.type || "audio/webm",
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "Transcription failed");

            const elapsed = Date.now() - start;
            const wait = Math.max(0, SENDING_MIN_MS - elapsed);
            if (wait > 0) await new Promise((r) => setTimeout(r, wait));

            let emotion: string | null = null;
            if (data.text?.trim()) {
              try {
                emotion = await classifyEmotion(data.text);
              } catch {
                // ignore classification errors
              }
            }

            try {
              const saveRes = await fetch("/api/notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  user: "username",
                  text: data.text ?? "",
                  emotion: emotion ?? "Misc",
                }),
              });
              if (!saveRes.ok) {
                const errBody = await saveRes.json().catch(() => ({}));
                console.warn("Notes save failed:", saveRes.status, errBody);
              }
            } catch (e) {
              console.warn("Notes save error:", e);
            }

            const submittedAt = new Date().toISOString();
            setSubmitResult({
              text: data.text ?? "",
              language_code: data.language_code,
              submittedAt,
            });
            setState("submitted");

            if (onTranscriptReady && data.text) {
              onTranscriptReady(data.text);
            }
            if (emotion) {
              setEmotionResult(emotion);
              onEmotionReady?.(emotion);
            }
          } catch (err) {
            const elapsed = Date.now() - start;
            const wait = Math.max(0, SENDING_MIN_MS - elapsed);
            if (wait > 0) await new Promise((r) => setTimeout(r, wait));
            setError(err instanceof Error ? err.message : "Failed to process recording");
            setState("error");
          } finally {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => setSubmitting(false));
            });
          }
  }, []);



    const goToGenerate = useCallback(() => {
        if (!submitResult?.text) return;

        setStoredTranscript(
            submitResult.text,
            submitResult.language_code
        );

        window.location.href = "/generate";
    }, [submitResult]);

  const reset = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    chunksRef.current = [];
    setState("idle");
    setError(null);
    setSubmitResult(null);
    setEmotionResult(null);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={`${styles.wrapper} ${submitting ? styles.wrapperDuringAnimation : ""}`}>
      {submitting && (
        <div className={styles.sendingOverlay} aria-live="polite" aria-busy="true">
          <div className={styles.sendingOcean}>
            <div className={styles.sendingSun} aria-hidden />
            <div className={styles.sendingWaves} />
            <div className={styles.sendingWaves2} />
            <div className={styles.sendingBottle} aria-hidden>
              <span className={styles.bottleBody} />
              <span className={styles.bottleNeck} />
            </div>
          </div>
          <p className={styles.sendingText}>Your note is on its way</p>
          <p className={styles.sendingSubtext}>Off to find someone who needs it</p>
        </div>
      )}

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
          {submitResult.submittedAt && (
            <p className={styles.submittedMeta}>
              Date recorded: {new Date(submitResult.submittedAt).toLocaleString()}
            </p>
          )}
          {emotionResult && (
            <div className={styles.emotionResult}>
              <span className={styles.emotionLabel}>Detected emotion</span>
              <span className={styles.emotionValue}>{emotionResult}</span>
            </div>
          )}
          <p className={styles.submittedLabel}>Transcript (for debugging only)</p>
          <p className={styles.submittedText}>{submitResult.text || "(empty)"}</p>
          {submitResult.language_code && (
            <p className={styles.submittedMeta}>
              Language: {submitResult.language_code}
            </p>
          )}
          <button
            type="button"
            className={styles.generateButton}
            onClick={goToGenerate}
            disabled={!submitResult.text?.trim()}
          >
            Generate audio from this transcript
          </button>
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
