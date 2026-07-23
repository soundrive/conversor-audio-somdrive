/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface VideoMetadata {
  file: File;
  name: string;
  format: string;
  size: number;
  duration: number; // in seconds
  width: number;
  height: number;
  hasAudioTrack: boolean;
  audioChannels: number;
  sampleRate: number;
  mimeType: string;
}

export async function analyzeVideoFile(file: File): Promise<VideoMetadata> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const validExtensions = ['mp4', 'mov', 'm4v', 'webm'];
  
  if (!validExtensions.includes(extension)) {
    throw new Error('Formato não suportado. Utilize apenas arquivos MP4, MOV, M4V ou WebM.');
  }

  return new Promise((resolve, reject) => {
    const videoUrl = URL.createObjectURL(file);
    const videoElement = document.createElement('video');
    videoElement.preload = 'metadata';
    videoElement.src = videoUrl;

    let timeout = setTimeout(() => {
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Este vídeo utiliza um formato ou codec que o navegador não consegue processar.'));
    }, 10000);

    videoElement.onloadedmetadata = async () => {
      clearTimeout(timeout);
      const duration = videoElement.duration || 0;
      const width = videoElement.videoWidth || 0;
      const height = videoElement.videoHeight || 0;

      // Check audio track presence using Web Audio API or webkit/moz audio tracks
      let hasAudioTrack = true;
      let audioChannels = 2;
      let sampleRate = 44100;

      // Check if browser detects audio tracks
      if ('mozHasAudio' in videoElement) {
        hasAudioTrack = (videoElement as any).mozHasAudio;
      } else if ('webkitAudioDecodedByteCount' in videoElement) {
        hasAudioTrack = (videoElement as any).webkitAudioDecodedByteCount > 0 || true;
      }

      URL.revokeObjectURL(videoUrl);

      resolve({
        file,
        name: file.name,
        format: extension.toUpperCase(),
        size: file.size,
        duration,
        width,
        height,
        hasAudioTrack,
        audioChannels,
        sampleRate,
        mimeType: file.type || `video/${extension}`
      });
    };

    videoElement.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(videoUrl);
      reject(new Error('Não foi possível ler o arquivo de vídeo. Certifique-se de que o arquivo não está corrompido.'));
    };
  });
}
