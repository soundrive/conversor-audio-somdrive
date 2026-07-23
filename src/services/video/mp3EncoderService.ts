/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const lameWorkerCode = `
  self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.all.min.js');

  self.onmessage = function(e) {
    const { left, right, channels, sampleRate, kbps } = e.data;
    
    var lameInstance = typeof lamejs !== 'undefined' ? lamejs : (typeof lame !== 'undefined' ? lame : null);
    if (!lameInstance) {
      self.postMessage({ type: 'error', error: 'Não foi possível carregar a biblioteca de codificação MP3 (LameJS).' });
      return;
    }
    
    function floatTo16BitPCM(float32Array) {
      var len = float32Array.length;
      var buffer = new Int16Array(len);
      for (var i = 0; i < len; i++) {
        var s = Math.max(-1, Math.min(1, float32Array[i]));
        buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return buffer;
    }
    
    self.postMessage({ type: 'status', message: 'Processando amostras...' });
    
    var leftPCM = floatTo16BitPCM(left);
    var rightPCM = (channels === 2 && right) ? floatTo16BitPCM(right) : null;
    
    self.postMessage({ type: 'status', message: 'Codificando em MP3...' });
    
    var mp3encoder = new lameInstance.Mp3Encoder(channels, sampleRate, kbps);
    var mp3Data = [];
    
    var sampleBlockSize = 1152;
    var totalSamples = leftPCM.length;
    
    for (var i = 0; i < totalSamples; i += sampleBlockSize) {
      var leftChunk = leftPCM.subarray(i, i + sampleBlockSize);
      var mp3buf;
      
      if (channels === 2 && rightPCM) {
        var rightChunk = rightPCM.subarray(i, i + sampleBlockSize);
        mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      } else {
        mp3buf = mp3encoder.encodeBuffer(leftChunk);
      }
      
      if (mp3buf.length > 0) {
        mp3Data.push(new Uint8Array(mp3buf));
      }
      
      if (i % (sampleBlockSize * 30) === 0 || i + sampleBlockSize >= totalSamples) {
        var progress = Math.min(100, Math.round((i / totalSamples) * 100));
        self.postMessage({ type: 'progress', progress: progress });
      }
    }
    
    var mp3bufFlush = mp3encoder.flush();
    if (mp3bufFlush.length > 0) {
      mp3Data.push(new Uint8Array(mp3bufFlush));
    }
    
    var totalLength = 0;
    for (var j = 0; j < mp3Data.length; j++) {
      totalLength += mp3Data[j].length;
    }
    var result = new Uint8Array(totalLength);
    var offset = 0;
    for (var j = 0; j < mp3Data.length; j++) {
      result.set(mp3Data[j], offset);
      offset += mp3Data[j].length;
    }
    
    self.postMessage({ type: 'complete', data: result.buffer }, [result.buffer]);
  };
`;

export function encodeMp3InWorker(
  left: Float32Array,
  right: Float32Array | null,
  channels: number,
  sampleRate: number,
  kbps: number,
  onProgress: (progress: number) => void,
  onWorkerRef?: (worker: Worker) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([lameWorkerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    const worker = new Worker(workerUrl);

    if (onWorkerRef) {
      onWorkerRef(worker);
    }

    worker.onmessage = (e) => {
      const { type, progress, data, error } = e.data;
      if (type === 'progress') {
        onProgress(progress);
      } else if (type === 'complete') {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        const mp3Blob = new Blob([data], { type: 'audio/mp3' });
        resolve(mp3Blob);
      } else if (type === 'error') {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        reject(new Error(error || 'Erro na codificação MP3.'));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(new Error('Falha no Worker de codificação MP3.'));
    };

    worker.postMessage({
      left,
      right,
      channels,
      sampleRate,
      kbps
    });
  });
}
