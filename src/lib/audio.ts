/**
 * Shared helpers for merging and playing generated audio (e.g. from /api/speech).
 */

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

export async function mergeAudioBlobs(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) throw new Error("No audio to merge");
  if (blobs.length === 1) return blobs[0];
  const ctx = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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

export function segmentsToBlobs(
  segments: { audioBase64: string; contentType: string }[]
): Blob[] {
  return segments.map((seg) => {
    const binary = atob(seg.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: seg.contentType || "audio/mpeg" });
  });
}
