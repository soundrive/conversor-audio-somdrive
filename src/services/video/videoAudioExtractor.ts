/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ExtractedAudioData {
  leftChannel: Float32Array;
  rightChannel: Float32Array | null;
  channels: number;
  sampleRate: number;
  duration: number;
}

export async function extractAudioFromVideo(
  file: File,
  onProgress?: (stage: string, progress: number) => void,
  checkCancelled?: () => boolean
): Promise<ExtractedAudioData> {
  if (onProgress) onProgress('Analisando vídeo...', 10);

  if (checkCancelled && checkCancelled()) {
    throw new Error('Operação cancelada pelo usuário.');
  }

  // Memory safety check for files approaching 1GB
  if (file.size > 1024 * 1024 * 1024) {
    throw new Error('O arquivo excede o limite de 1 GB para processamento no navegador.');
  }

  if (onProgress) onProgress('Localizando faixa de áudio...', 25);

  // Read file ArrayBuffer for audio decoding
  const arrayBuffer = await file.arrayBuffer();

  if (checkCancelled && checkCancelled()) {
    throw new Error('Operação cancelada pelo usuário.');
  }

  if (onProgress) onProgress('Extraindo áudio...', 45);

  // Use AudioContext to decode audio track from video ArrayBuffer
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioCtx();

  try {
    const audioBuffer: AudioBuffer = await new Promise((resolve, reject) => {
      audioCtx.decodeAudioData(
        arrayBuffer,
        (decoded) => resolve(decoded),
        (err) => reject(new Error('Não foi possível extrair a faixa de áudio deste vídeo. Certifique-se de que o vídeo contém áudio e é em formato compatível (MP4, MOV, M4V, WebM).'))
      );
    });

    if (checkCancelled && checkCancelled()) {
      audioCtx.close();
      throw new Error('Operação cancelada pelo usuário.');
    }

    if (onProgress) onProgress('Preparando dados de áudio...', 60);

    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = channels > 1 ? audioBuffer.getChannelData(1) : null;

    audioCtx.close();

    return {
      leftChannel,
      rightChannel,
      channels,
      sampleRate,
      duration
    };
  } catch (error: any) {
    audioCtx.close();
    throw error;
  }
}
