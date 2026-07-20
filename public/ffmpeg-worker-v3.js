/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Mock document and window for scripts that are not fully worker-compatible
self.document = {
  currentScript: null,
  getElementsByTagName: function() { return []; },
  createElement: function() { return {}; }
};
self.window = self;

const origin = self.location.origin;
const VERSION = '3';
const ffmpegMinJsUrl = new URL(`/ffmpeg.min-v3.js?v=${VERSION}`, origin).href;
const ffmpegCoreJsUrl = new URL(`/ffmpeg-core-v3.js?v=${VERSION}`, origin).href;
const ffmpegCoreWasmUrl = new URL(`/ffmpeg-core-v3.wasm?v=${VERSION}`, origin).href;

console.log('[FFMPEG] Versão dos assets: v3');
console.log('[Worker v3] Caminhos do motor configurados:', {
  origin,
  ffmpegMinJsUrl,
  ffmpegCoreJsUrl,
  ffmpegCoreWasmUrl
});

// Import the local build of FFmpeg.wasm
try {
  importScripts(ffmpegMinJsUrl);
  console.log('[Worker v3] ffmpeg.min-v3.js importado com sucesso via importScripts.');
} catch (err) {
  self.postMessage({ 
    type: 'error', 
    error: `Falha ao iniciar: /ffmpeg-worker-v3.js (Não foi possível importar ${ffmpegMinJsUrl} via importScripts: ${err.message})` 
  });
}

let ffmpeg = null;
let currentFile = null;
let currentSafeName = '';
let currentMountPoint = '';
let isWorkerFsSupported = false;
let isUsingMemFSFallback = false;

let probeMetadata = {
  duration: null,
  codec: null,
  frequency: null,
  channels: null,
  bitrate: null
};

// Reset and run a rigorous file system test to audit WORKERFS support
async function runFileSystemTest(testFile) {
  console.log('[TESTE FS] Iniciando teste funcional do filesystem...');
  if (!ffmpeg) {
    console.error('[TESTE FS] Erro: FFmpeg não carregado.');
    return;
  }

  console.log('[TESTE FS] Motor carregado');
  const testMountPoint = '/test_fs_mount_' + Math.random().toString(36).substring(2, 9);
  
  // 1. Create a mount point
  try {
    ffmpeg.FS('mkdir', testMountPoint);
    console.log('[TESTE FS] Diretório criado');
  } catch (err) {
    console.error('[TESTE FS] Erro ao criar diretório:', err);
    self.postMessage({
      type: 'test_fs_log',
      message: `[TESTE FS] Falha ao criar diretório: ${err.message || err}`
    });
    return;
  }

  // 2. Try to mount using WORKERFS
  const testSafeName = 'test_probe_video.mp4';
  let safeFile;
  try {
    safeFile = new File([testFile], testSafeName, { type: testFile.type });
  } catch (e) {
    safeFile = testFile;
  }

  try {
    console.log('[TESTE FS] Tentando montar com WORKERFS no ponto:', testMountPoint);
    ffmpeg.FS('mount', 'WORKERFS', { files: [safeFile] }, testMountPoint);
    
    // If we reach here, WORKERFS is available and mounted successfully!
    isWorkerFsSupported = true;
    console.log('[TESTE FS] WORKERFS disponível');
    console.log('[TESTE FS] Arquivo montado');

    // List the directory contents
    try {
      const files = ffmpeg.FS('readdir', testMountPoint);
      console.log(`[TESTE FS] Arquivos encontrados: [${files.join(', ')}]`);
    } catch (readErr) {
      console.warn('[TESTE FS] Aviso ao ler diretório:', readErr);
    }

    // Execute stat on the mounted file
    const filePath = `${testMountPoint}/${testSafeName}`;
    try {
      const stats = ffmpeg.FS('stat', filePath);
      console.log(`[TESTE FS] Tamanho reconhecido: ${stats.size} bytes`);
    } catch (statErr) {
      console.warn('[TESTE FS] Aviso ao executar stat:', statErr);
    }

    // Unmount
    try {
      ffmpeg.FS('unmount', testMountPoint);
      console.log('[TESTE FS] Desmontagem concluída');
    } catch (unmountErr) {
      console.warn('[TESTE FS] Erro ao desmontar:', unmountErr);
    }

  } catch (err) {
    isWorkerFsSupported = false;
    console.warn('[TESTE FS] O motor atual não possui suporte a WORKERFS ou a montagem falhou.');
    
    // Log complete error details as requested
    console.error({
      operacao: 'mount WORKERFS',
      mountPoint: testMountPoint,
      caminho: `${testMountPoint}/${testSafeName}`,
      mensagemCompleta: err.message || String(err),
      stack: err.stack || 'Não disponível',
      codigoErro: err.code || 'N/A',
      errno: err.errno || 'N/A'
    });

    self.postMessage({
      type: 'test_fs_fail',
      errorDetails: {
        operacao: 'mount WORKERFS',
        mountPoint: testMountPoint,
        caminho: `${testMountPoint}/${testSafeName}`,
        mensagemCompleta: err.message || String(err),
        stack: err.stack || 'Não disponível',
        codigoErro: err.code || 'N/A',
        errno: err.errno || 'N/A'
      }
    });

    // Clean up directory if mount failed
    try {
      // In Emscripten, we cannot rmdir easily if not empty, but let's try
      // Or just ignore since it's in MEMFS memory
    } catch (e) {}
  }
}

self.onmessage = async function(e) {
  const { type, file, format, quality, sampleRate } = e.data;

  if (type === 'probe') {
    try {
      self.postMessage({ type: 'status', message: 'Carregando motor do processador...' });
      
      if (!ffmpeg) {
        // 1. Audit / Test-fetch for ffmpeg-core-v3.js
        self.postMessage({ type: 'status', message: 'Verificando acessibilidade de ffmpeg-core-v3.js...' });
        try {
          const res = await fetch(ffmpegCoreJsUrl, { method: 'HEAD' });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
          }
          console.log('[Worker v3] Conexão com ffmpeg-core-v3.js bem-sucedida.');
        } catch (err) {
          throw new Error(`Falha ao carregar: ${ffmpegCoreJsUrl} (${err.message}). Por favor, verifique se o arquivo está na pasta pública.`);
        }

        // 2. Audit / Test-fetch for ffmpeg-core-v3.wasm
        self.postMessage({ type: 'status', message: 'Verificando acessibilidade de ffmpeg-core-v3.wasm...' });
        try {
          const res = await fetch(ffmpegCoreWasmUrl, { method: 'HEAD' });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}`);
          }
          console.log('[Worker v3] Conexão com ffmpeg-core-v3.wasm bem-sucedida.');
        } catch (err) {
          throw new Error(`Falha ao carregar: ${ffmpegCoreWasmUrl} (${err.message}). Por favor, verifique se o arquivo .wasm está na pasta pública e se o servidor aceita esta requisição.`);
        }

        self.postMessage({ type: 'status', message: 'Inicializando o motor FFmpeg.wasm...' });

        ffmpeg = FFmpeg.createFFmpeg({
          log: true,
          corePath: ffmpegCoreJsUrl,
          wasmPath: ffmpegCoreWasmUrl,
          logger: ({ message }) => {
            self.postMessage({ type: 'log', message });
            parseLogForMetadata(message);
          }
        });

        try {
          await ffmpeg.load();
          console.log('[Worker v3] ffmpeg.load() concluído com sucesso.');
          
          // Print FFmpeg version as requested in Section 7
          try {
            console.log('[FFMPEG] Executando teste mínimo: ffmpeg -version');
            await ffmpeg.run('-version');
          } catch (verErr) {
            console.warn('[FFMPEG] Erro ao obter versão:', verErr);
          }
        } catch (err) {
          throw new Error(`O motor de processamento FFmpeg falhou ao inicializar no load(): ${err.message || err}. Verifique se o seu navegador suporta WebAssembly.`);
        }
      }

      self.postMessage({ type: 'status', message: 'Executando testes funcionais de armazenamento...' });

      // Run File System Audit
      await runFileSystemTest(file);

      self.postMessage({ type: 'status', message: 'Analisando formato do vídeo...' });

      currentFile = file;
      const ext = file.name.split('.').pop() || 'mp4';
      currentSafeName = 'video.' + ext;

      if (isWorkerFsSupported) {
        // Use WORKERFS
        isUsingMemFSFallback = false;
        
        if (currentMountPoint) {
          try {
            ffmpeg.FS('unmount', currentMountPoint);
          } catch (e) {}
        }
        currentMountPoint = '/work_' + Math.random().toString(36).substring(2, 9);
        try {
          ffmpeg.FS('mkdir', currentMountPoint);
        } catch (e) {}

        let safeFile;
        try {
          safeFile = new File([file], currentSafeName, { type: file.type });
        } catch (e) {
          safeFile = file;
          currentSafeName = file.name;
        }

        ffmpeg.FS('mount', 'WORKERFS', { files: [safeFile] }, currentMountPoint);
        console.log('[Worker v3] Vídeo montado usando WORKERFS em:', `${currentMountPoint}/${currentSafeName}`);
      } else {
        // Fallback to MEMFS
        isUsingMemFSFallback = true;
        console.log('[Worker v3] Ativando fallback de armazenamento MEMFS...');
        
        // Check size limit for MEMFS safety (e.g. 150MB)
        const sizeLimit = 150 * 1024 * 1024;
        if (file.size > sizeLimit) {
          throw new Error(`O motor atual do navegador não possui suporte a WORKERFS (leitura direta do disco) e o arquivo de ${Math.round(file.size / 1024 / 1024)} MB é muito grande para a memória RAM virtual do navegador (limite seguro: 150 MB).`);
        }

        self.postMessage({ type: 'status', message: 'Lendo arquivo para a memória virtual (MEMFS)...' });
        
        const arrayBuffer = await file.arrayBuffer();
        ffmpeg.FS('writeFile', currentSafeName, new Uint8Array(arrayBuffer));
        console.log('[Worker v3] Vídeo gravado na memória virtual MEMFS:', currentSafeName);
      }

      // Reset probe state
      probeMetadata = {
        duration: null,
        codec: null,
        frequency: null,
        channels: null,
        bitrate: null
      };

      // Run dummy ffmpeg command to parse metadata
      try {
        const inputPath = isUsingMemFSFallback ? currentSafeName : `${currentMountPoint}/${currentSafeName}`;
        await ffmpeg.run('-i', inputPath);
      } catch (err) {
        // Expected to fail since there is no output file, but it parses metadata logs
      }

      self.postMessage({ type: 'metadata', metadata: probeMetadata });

    } catch (err) {
      console.error('[Worker v3] Erro no probe:', err);
      self.postMessage({ type: 'error', error: err.message || String(err) });
    }
  }

  if (type === 'convert') {
    try {
      if (!ffmpeg || !currentFile) {
        throw new Error('Nenhum vídeo carregado para conversão.');
      }

      self.postMessage({ type: 'status', message: 'Iniciando extração...' });

      const outputFilename = format === 'mp3' ? 'output.mp3' : 'output.wav';
      
      try {
        ffmpeg.FS('unlink', outputFilename);
      } catch (e) {}

      const inputPath = isUsingMemFSFallback ? currentSafeName : `${currentMountPoint}/${currentSafeName}`;
      const args = ['-i', inputPath, '-vn'];

      if (format === 'mp3') {
        args.push('-acodec', 'libmp3lame', '-ab', `${quality}k`);
      } else {
        args.push('-acodec', 'pcm_s16le');
      }

      if (sampleRate && sampleRate !== 'original') {
        args.push('-ar', `${sampleRate}`);
      }

      args.push('-y', outputFilename);

      self.postMessage({ type: 'status', message: `Extraindo faixa de áudio e convertendo para ${format.toUpperCase()}...` });
      console.log('[Worker v3] Executando comando FFmpeg:', args.join(' '));

      await ffmpeg.run(...args);

      self.postMessage({ type: 'status', message: 'Preparando download...' });

      let data;
      try {
        data = ffmpeg.FS('readFile', outputFilename);
      } catch (readErr) {
        throw new Error('Falha ao localizar o arquivo montado ou gerado.');
      }

      self.postMessage({
        type: 'done',
        data: data.buffer,
        format: format,
        filename: outputFilename
      }, [data.buffer]);

      // Clean up output file in MEMFS
      try {
        ffmpeg.FS('unlink', outputFilename);
      } catch (e) {}

      // Clean up input file if we copied it to MEMFS
      if (isUsingMemFSFallback) {
        try {
          ffmpeg.FS('unlink', currentSafeName);
        } catch (e) {}
      }

    } catch (err) {
      console.error('[Worker v3] Erro na conversão:', err);
      self.postMessage({ type: 'error', error: err.message || String(err) });
    }
  }
};

function parseLogForMetadata(message) {
  // Parse duration: "Duration: 00:05:12.34"
  const durationMatch = message.match(/Duration:\s+(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (durationMatch) {
    const hours = parseInt(durationMatch[1], 10);
    const minutes = parseInt(durationMatch[2], 10);
    const seconds = parseInt(durationMatch[3], 10);
    const hundredths = parseInt(durationMatch[4], 10);
    probeMetadata.duration = hours * 3600 + minutes * 60 + seconds + hundredths / 100;
  }

  // Parse Audio track info: "Stream #0:1: Audio: aac (LC), 48000 Hz, stereo, fltp, 128 kb/s"
  if (message.includes('Audio:')) {
    const codecMatch = message.match(/Audio:\s+([a-zA-Z0-9_]+)/);
    if (codecMatch) {
      probeMetadata.codec = codecMatch[1];
    }

    const hzMatch = message.match(/(\d+)\s*Hz/);
    if (hzMatch) {
      probeMetadata.frequency = parseInt(hzMatch[1], 10);
    }

    if (message.includes('stereo')) {
      probeMetadata.channels = 2;
    } else if (message.includes('mono')) {
      probeMetadata.channels = 1;
    } else {
      const channelsMatch = message.match(/(\d+)\s+channels/);
      if (channelsMatch) {
        probeMetadata.channels = parseInt(channelsMatch[1], 10);
      }
    }

    const kbpsMatch = message.match(/(\d+)\s*kb\/s/);
    if (kbpsMatch) {
      probeMetadata.bitrate = parseInt(kbpsMatch[1], 10);
    }
  }

  // Parse progress for conversion: "time=00:01:23.45"
  if (probeMetadata.duration && message.includes('time=')) {
    const timeMatch = message.match(/time=(\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseInt(timeMatch[3], 10);
      const hundredths = parseInt(timeMatch[4], 10);
      const elapsed = hours * 3600 + minutes * 60 + seconds + hundredths / 100;
      const progress = Math.min(100, Math.round((elapsed / probeMetadata.duration) * 100));
      self.postMessage({ type: 'progress', progress, elapsed });
    }
  }
}
