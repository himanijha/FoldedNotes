import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import styles from "@/styles/AudioRecorder.module.css";

const THEME_ORDER = [
  "Angry",
  "Anxious",
  "Happy",
  "Fear",
  "Surprise",
  "Love/Warmth",
  "Misc",
];

type VoiceOption = { voice_id: string; name: string; description?: string };

type SegmentForApi =
  | { type: "speech"; text: string; voice_id: string }
  | { type: "sound_effect"; text: string };

function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length * numChannels * 2;
  const byteRate = sampleRate * numChannels * 2;
  const dataSize = length;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);
  const write = (offset: number, value: number, little = true) =>
    view.setUint32(offset, value, little);
  const write16 = (offset: number, value: number, little = true) =>
    view.setUint16(offset, value, little);

  const setStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  setStr(0, "RIFF");
  write(4, 36 + dataSize);
  setStr(8, "WAVE");
  setStr(12, "fmt ");
  write(16, 16);
  write16(20, 1);
  write16(22, numChannels);
  write(24, sampleRate);
  write(28, byteRate);
  write16(32, numChannels * 2);
  write16(34, 16);
  setStr(36, "data");
  write(40, dataSize);

  const out = new Int16Array(arrayBuffer, headerSize, buffer.length * numChannels);
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numChannels; c++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
      out[i * numChannels + c] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }
  return new Blob([arrayBuffer], { type: "audio/wav" });
}

async function mergeAudioBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) throw new Error("No audio to merge");
  if (blobs.length === 1) return blobs[0];
  const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const buffers: AudioBuffer[] = [];
  for (const blob of blobs) {
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    buffers.push(buffer);
  }
  const first = buffers[0];
  const sampleRate = first.sampleRate;
  const numChannels = Math.max(...buffers.map((b) => b.numberOfChannels));
  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  const merged = ctx.createBuffer(numChannels, totalLength, sampleRate);
  let offset = 0;
  for (const b of buffers) {
    const len = b.length;
    const srcChannels = b.numberOfChannels;
    for (let c = 0; c < numChannels; c++) {
      const src = b.getChannelData(c < srcChannels ? c : 0);
      merged.getChannelData(c).set(src, offset);
    }
    offset += len;
  }
  return audioBufferToWavBlob(merged);
}

function parseTextWithSoundEffects(
  text: string,
  voiceMainId: string,
  fallbackVoiceId: string
): SegmentForApi[] {
  const voiceId = voiceMainId || fallbackVoiceId;
  const segments: SegmentForApi[] = [];
  const re = /\[([^\]]*)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index).trim();
    if (before) segments.push({ type: "speech", text: before, voice_id: voiceId });
    const inner = match[1].trim();
    if (inner) segments.push({ type: "sound_effect", text: inner });
    lastIndex = match.index + match[0].length;
  }
  const after = text.slice(lastIndex).trim();
  if (after) segments.push({ type: "speech", text: after, voice_id: voiceId });
  return segments.length
    ? segments
    : [{ type: "speech", text: text.trim() || "(empty)", voice_id: voiceId }];
}

const TRANSCRIPT_STORAGE_KEY = "foldednotes_transcript";
const LANGUAGE_STORAGE_KEY = "foldednotes_language_code";

export function getStoredTranscript(): { text: string; language_code?: string } | null {
  if (typeof window === "undefined") return null;
  const text = sessionStorage.getItem(TRANSCRIPT_STORAGE_KEY);
  if (text == null) return null;
  return {
    text,
    language_code: sessionStorage.getItem(LANGUAGE_STORAGE_KEY) ?? undefined,
  };
}

export function setStoredTranscript(text: string, language_code?: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TRANSCRIPT_STORAGE_KEY, text);
  if (language_code != null) sessionStorage.setItem(LANGUAGE_STORAGE_KEY, language_code);
  else sessionStorage.removeItem(LANGUAGE_STORAGE_KEY);
}

type Props = {
  initialTranscript: string;
  initialLanguageCode?: string;
};

export default function GenerateFromTranscript({
  initialTranscript,
  initialLanguageCode,
}: Props) {
  const [transcript, setTranscript] = useState(initialTranscript);
  const [languageCode, setLanguageCode] = useState(initialLanguageCode ?? "");
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voiceMainId, setVoiceMainId] = useState("");
  const [voiceTheme, setVoiceTheme] = useState("");
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generatedAudioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/voices")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.voices) && data.voices.length > 0) {
          setVoices(data.voices);
          setVoiceMainId((prev) => prev || data.voices[0].voice_id);
          setVoiceTheme((prev) => prev || "Misc");
        }
      })
      .catch(() => {});
  }, []);

  const generateAudio = useCallback(async () => {
    if (!transcript.trim()) return;

    setGeneratingAudio(true);
    setError(null);
    setGeneratedAudioUrl(null);
    try {
      const hasBrackets = transcript.includes("[");
      const voiceId = voiceMainId || (voices[0]?.voice_id ?? "");
      const segmentsFromInput = parseTextWithSoundEffects(transcript, voiceId, voiceId);
      const body = hasBrackets
        ? {
            segments: segmentsFromInput,
            language_code: languageCode || undefined,
            voice_theme: voiceTheme || "Misc",
          }
        : {
            text: transcript,
            language_code: languageCode || undefined,
            voiceMain: voiceId || undefined,
            voice_theme: voiceTheme || "Misc",
          };
      const res = await fetch("/api/speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Failed to generate audio");
      }

      const segments = data.segments as { audioBase64: string; contentType: string }[] | undefined;
      if (!Array.isArray(segments) || segments.length === 0) {
        throw new Error("No audio segments returned");
      }

      const blobs: Blob[] = [];
      for (const seg of segments) {
        const binary = atob(seg.audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        blobs.push(new Blob([bytes], { type: seg.contentType || "audio/mpeg" }));
      }
      const mergedBlob = await mergeAudioBlobs(blobs);
      const url = URL.createObjectURL(mergedBlob);

      if (generatedAudioUrlRef.current) URL.revokeObjectURL(generatedAudioUrlRef.current);
      generatedAudioUrlRef.current = url;
      setGeneratedAudioUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate audio");
    } finally {
      setGeneratingAudio(false);
    }
  }, [transcript, languageCode, voices, voiceMainId, voiceTheme]);

  return (
    <div className={styles.wrapper}>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <p className={styles.stickerLabel}>Your words</p>
      <textarea
        className={styles.transcriptInput}
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Paste or tweak your note…"
        rows={5}
        aria-label="Transcript"
      />
      {languageCode && (
        <p className={styles.submittedMeta}>Language: {languageCode}</p>
      )}

      {voices.length > 0 && (
        <>
          <p className={styles.voiceHint}>
            Add <code>[chuckle]</code>, <code>[sigh]</code>, <code>[laughter]</code> for sound effects{" "}
            <span className={styles.sparkleIcon} aria-hidden />
          </p>
          <div className={styles.voiceSelects}>
            <label className={styles.voiceLabel}>
              Voice
              <select
                className={styles.voiceSelect}
                value={voiceMainId}
                onChange={(e) => setVoiceMainId(e.target.value)}
                aria-label="Voice"
              >
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.voiceLabel}>
              Theme
              <select
                className={styles.voiceSelect}
                value={voiceTheme}
                onChange={(e) => setVoiceTheme(e.target.value)}
                aria-label="Theme"
              >
                {THEME_ORDER.map((theme) => (
                  <option key={theme} value={theme}>
                    {theme}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}

      <button
        type="button"
        className={styles.generateButton}
        onClick={generateAudio}
        disabled={generatingAudio || !transcript.trim()}
      >
        <span className={styles.micIcon} aria-hidden />
        {generatingAudio ? "Creating your audio…" : "Give it a voice"}
      </button>

      {generatedAudioUrl && (
        <div className={styles.generatedAudio}>
          <p className={styles.stickerLabel}>Listen!</p>
          <audio
            className={styles.audio}
            src={generatedAudioUrl}
            controls
            preload="metadata"
          />
        </div>
      )}

      <Link href="/" className={styles.againButton} style={{ textDecoration: "none", textAlign: "center" }}>
        <span className={styles.arrowLeftIcon} aria-hidden />
        Back to record
      </Link>
    </div>
  );
}
