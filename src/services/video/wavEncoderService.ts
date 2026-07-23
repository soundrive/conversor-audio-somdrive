/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface WavEncodingOptions {
  sampleRateSetting: '44100' | '48000' | 'original';
  channelsSetting: 'mono' | 'stereo' | 'original';
}

export async function encodeWavBuffer(
  left: Float32Array,
  right: Float32Array | null,
  originalChannels: number,
  originalSampleRate: number,
  options: WavEncodingOptions,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  let targetSampleRate = originalSampleRate;
  if (options.sampleRateSetting === '44100') targetSampleRate = 44100;
  if (options.sampleRateSetting === '48000') targetSampleRate = 48000;

  let targetChannels = originalChannels;
  if (options.channelsSetting === 'mono') targetChannels = 1;
  if (options.channelsSetting === 'stereo') targetChannels = 2;

  if (onProgress) onProgress(10);

  // Resample/rechannel if needed using OfflineAudioContext
  let finalLeft = left;
  let finalRight = right;

  if (targetSampleRate !== originalSampleRate || targetChannels !== originalChannels) {
    if (onProgress) onProgress(30);
    const OfflineCtx = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const length = Math.ceil((left.length / originalSampleRate) * targetSampleRate);
    const offlineCtx = new OfflineCtx(targetChannels, length, targetSampleRate);

    const sourceBuffer = offlineCtx.createBuffer(
      originalChannels,
      left.length,
      originalSampleRate
    );
    sourceBuffer.getChannelData(0).set(left);
    if (originalChannels > 1 && right) {
      sourceBuffer.getChannelData(1).set(right);
    }

    const sourceNode = offlineCtx.createBufferSource();
    sourceNode.buffer = sourceBuffer;
    sourceNode.connect(offlineCtx.destination);
    sourceNode.start(0);

    const renderedBuffer = await offlineCtx.startRendering();
    finalLeft = renderedBuffer.getChannelData(0);
    finalRight = targetChannels > 1 ? renderedBuffer.getChannelData(1) : null;
  }

  if (onProgress) onProgress(60);

  // Generate 16-bit PCM WAV File
  const numChannels = targetChannels;
  const sampleRate = targetSampleRate;
  const numSamples = finalLeft.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const chunkSize = 36 + dataSize;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // Helper to write string to DataView
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, chunkSize, true);
  writeString(8, 'WAVE');

  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true);  // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample (16)

  // data chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    // Left channel
    let sLeft = Math.max(-1, Math.min(1, finalLeft[i]));
    view.setInt16(offset, sLeft < 0 ? sLeft * 0x8000 : sLeft * 0x7FFF, true);
    offset += 2;

    if (numChannels === 2) {
      // Right channel
      let sRight = finalRight ? Math.max(-1, Math.min(1, finalRight[i])) : sLeft;
      view.setInt16(offset, sRight < 0 ? sRight * 0x8000 : sRight * 0x7FFF, true);
      offset += 2;
    }

    if (i % 100000 === 0 && onProgress) {
      onProgress(60 + Math.round((i / numSamples) * 35));
    }
  }

  if (onProgress) onProgress(100);

  return new Blob([buffer], { type: 'audio/wav' });
}
