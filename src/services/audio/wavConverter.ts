/**
 * Converts any audio Blob (WebM, MP4, OGG, etc.) to standard PCM 16-bit WAV (mono, 16kHz or 24kHz)
 * which is universally accepted by speech-to-text APIs and LLM multimodal audio endpoints.
 */
export async function convertBlobToWav(blob: Blob, targetSampleRate = 16000): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const tempCtx = new AudioCtx();
  
  let audioBuffer: AudioBuffer;
  try {
    audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
  } finally {
    tempCtx.close();
  }

// Resample to targetSampleRate (e.g. 16kHz) mono using OfflineAudioContext
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(audioBuffer.duration * targetSampleRate), targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const channelData = renderedBuffer.getChannelData(0);

  // Encode Float32Array to 16-bit PCM WAV
  const wavBytes = encodeWav(channelData, targetSampleRate);
  return new Blob([wavBytes], { type: 'audio/wav' });
}

/**
 * Concatenates two audio Blobs sequentially into a single standard PCM 16-bit WAV (mono, 16kHz).
 * Returns the merged blob, individual durations, and the new total duration.
 */
export async function concatAudioBlobs(
  blob1: Blob | undefined | null,
  blob2: Blob,
  targetSampleRate = 16000
): Promise<{ mergedBlob: Blob; duration1: number; duration2: number; totalDuration: number }> {
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const tempCtx = new AudioCtx();

  let buffer1: AudioBuffer | null = null;
  let buffer2: AudioBuffer;

  try {
    if (blob1 && blob1.size > 0) {
      try {
        const ab1 = await blob1.arrayBuffer();
        buffer1 = await tempCtx.decodeAudioData(ab1.slice(0));
      } catch (err) {
        console.warn('Could not decode existing audio blob1 for concatenation:', err);
      }
    }

    const ab2 = await blob2.arrayBuffer();
    buffer2 = await tempCtx.decodeAudioData(ab2.slice(0));
  } finally {
    tempCtx.close();
  }

  const duration1 = buffer1 ? buffer1.duration : 0;
  const duration2 = buffer2.duration;
  const totalDuration = duration1 + duration2;

  const totalSamples = Math.ceil(totalDuration * targetSampleRate);
  const offlineCtx = new OfflineAudioContext(1, Math.max(1, totalSamples), targetSampleRate);

  if (buffer1 && duration1 > 0) {
    const source1 = offlineCtx.createBufferSource();
    source1.buffer = buffer1;
    source1.connect(offlineCtx.destination);
    source1.start(0);
  }

  const source2 = offlineCtx.createBufferSource();
  source2.buffer = buffer2;
  source2.connect(offlineCtx.destination);
  source2.start(duration1);

  const renderedBuffer = await offlineCtx.startRendering();
  const channelData = renderedBuffer.getChannelData(0);
  const wavBytes = encodeWav(channelData, targetSampleRate);
  const mergedBlob = new Blob([wavBytes], { type: 'audio/wav' });

  return { mergedBlob, duration1, duration2, totalDuration };
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1 mono)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
  view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
  view.setUint16(34, 16, true); // BitsPerSample (16 bits)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
