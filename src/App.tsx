/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  FileAudio, 
  Clock, 
  ShieldCheck, 
  Volume2, 
  Layers, 
  Settings,
  Info,
  Trash2,
  X,
  Play,
  ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Web Worker code as a string to run the LameJS encoder in a background thread
const workerCode = `
  self.importScripts('https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.all.min.js');

  self.onmessage = function(e) {
    const { left, right, channels, sampleRate, kbps } = e.data;
    
    // Check if lamejs loaded successfully from CDN
    var lameInstance = typeof lamejs !== 'undefined' ? lamejs : (typeof lame !== 'undefined' ? lame : null);
    if (!lameInstance) {
      self.postMessage({ type: 'error', error: 'Não foi possível carregar a biblioteca de codificação MP3 (LameJS).' });
      return;
    }
    
    // Helper function to convert Float32Array to Int16Array (16-bit signed PCM)
    function floatTo16BitPCM(float32Array) {
      var len = float32Array.length;
      var buffer = new Int16Array(len);
      for (var i = 0; i < len; i++) {
        var s = Math.max(-1, Math.min(1, float32Array[i]));
        buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      return buffer;
    }
    
    self.postMessage({ type: 'status', message: 'Processando canais...' });
    
    var leftPCM = floatTo16BitPCM(left);
    var rightPCM = (channels === 2 && right) ? floatTo16BitPCM(right) : null;
    
    self.postMessage({ type: 'status', message: 'Codificando em MP3 @ 96kbps...' });
    
    var mp3encoder = new lameInstance.Mp3Encoder(channels, sampleRate, kbps);
    var mp3Data = [];
    
    var sampleBlockSize = 1152; // LAME standard block size
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
      
      // Periodically report progress to the main thread
      if (i % (sampleBlockSize * 25) === 0 || i + sampleBlockSize >= totalSamples) {
        var progress = Math.min(100, Math.round((i / totalSamples) * 100));
        self.postMessage({ type: 'progress', progress: progress });
      }
    }
    
    var mp3bufFlush = mp3encoder.flush();
    if (mp3bufFlush.length > 0) {
      mp3Data.push(new Uint8Array(mp3bufFlush));
    }
    
    // Combine all MP3 chunks into a single ArrayBuffer to transfer back
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

// Helper function to check if an MP4/M4A file contains an audio track ('soun')
function checkMp4Audio(arrayBuffer: ArrayBuffer): { hasAudio: boolean; hasVideo: boolean } {
  const view = new DataView(arrayBuffer);
  let hasAudio = false;
  let hasVideo = false;
  const len = arrayBuffer.byteLength;
  
  function parseBoxes(start: number, end: number) {
    let pos = start;
    while (pos + 8 <= end) {
      let boxSize = view.getUint32(pos);
      let headerSize = 8;
      
      if (boxSize === 1) {
        if (pos + 16 > end) break;
        // 64-bit box size - read the lower 32-bits (within range for standard browser files)
        boxSize = view.getUint32(pos + 12);
        headerSize = 16;
      } else if (boxSize === 0) {
        boxSize = end - pos;
      }
      
      if (boxSize < headerSize) break; // prevent infinite loops
      
      const typeBytes = [
        view.getUint8(pos + 4),
        view.getUint8(pos + 5),
        view.getUint8(pos + 6),
        view.getUint8(pos + 7)
      ];
      const boxType = String.fromCharCode(...typeBytes);
      
      if (boxType === "moov" || boxType === "trak" || boxType === "mdia") {
        parseBoxes(pos + headerSize, Math.min(pos + boxSize, end));
      } else if (boxType === "hdlr") {
        if (pos + headerSize + 12 <= end) {
          const handlerBytes = [
            view.getUint8(pos + headerSize + 8),
            view.getUint8(pos + headerSize + 9),
            view.getUint8(pos + headerSize + 10),
            view.getUint8(pos + headerSize + 11)
          ];
          const handlerType = String.fromCharCode(...handlerBytes);
          if (handlerType === "soun") {
            hasAudio = true;
          } else if (handlerType === "vide") {
            hasVideo = true;
          }
        }
      }
      
      pos += boxSize;
    }
  }
  
  try {
    parseBoxes(0, len);
  } catch (e) {
    console.error("Erro ao analisar MP4: ", e);
  }
  
  return { hasAudio, hasVideo };
}

interface QueueItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  format: string;
  duration: number | null;
  channels: number | null;
  status: "aguardando" | "preparando" | "convertendo" | "concluido" | "erro" | "cancelado";
  progress: number;
  convertedSize: number | null;
  convertedBlobUrl: string | null;
  convertedFileName: string | null;
  errorMessage: string | null;
}

export default function App() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentProcessingIndex, setCurrentProcessingIndex] = useState<number>(-1);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeWorkerRef = useRef<Worker | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  // Supported extensions
  const allowedExtensions = ["wav", "mp3", "mp4", "m4a", "aac", "flac", "ogg", "webm"];

  // Provisional Limits
  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const MAX_BATCH_SIZE = 150 * 1024 * 1024; // 150MB
  const MAX_FILES_COUNT = 15;

  // Format bytes nicely
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  // Format duration nicely (mm:ss)
  const formatDuration = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Clear single item from queue
  const removeItem = (id: string) => {
    setQueue((prev) => {
      const target = prev.find(item => item.id === id);
      if (target && target.convertedBlobUrl) {
        URL.revokeObjectURL(target.convertedBlobUrl);
      }
      return prev.filter(item => item.id !== id);
    });
  };

  // Clear all list and stop any active worker
  const clearQueue = () => {
    cancelQueue();
    queue.forEach(item => {
      if (item.convertedBlobUrl) {
        URL.revokeObjectURL(item.convertedBlobUrl);
      }
    });
    setQueue([]);
    setGlobalError(null);
  };

  // Cancel overall active conversion process
  const cancelQueue = () => {
    isCancelledRef.current = true;
    if (activeWorkerRef.current) {
      activeWorkerRef.current.terminate();
      activeWorkerRef.current = null;
    }
    
    setQueue((prev) => prev.map((item, index) => {
      if (item.status === "convertendo" || item.status === "preparando" || item.status === "aguardando") {
        return { ...item, status: "cancelado", progress: 0 };
      }
      return item;
    }));

    setIsProcessing(false);
    setCurrentProcessingIndex(-1);
  };

  // Pre-decode audio metadata for displaying details in the queue
  const readAudioMetadata = async (file: File): Promise<{ duration: number; channels: number }> => {
    const arrayBuffer = await file.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Web Audio API não suportada.");
    }
    const audioCtx = new AudioContextClass();
    const buffer = await audioCtx.decodeAudioData(arrayBuffer);
    const metadata = {
      duration: buffer.duration,
      channels: buffer.numberOfChannels
    };
    audioCtx.close();
    return metadata;
  };

  // Add files to the queue with safety validation
  const handleSelectedFiles = async (selectedFiles: FileList) => {
    setGlobalError(null);
    const filesArray = Array.from(selectedFiles);

    // 1. Limit total files count
    if (queue.length + filesArray.length > MAX_FILES_COUNT) {
      setGlobalError(`Você pode converter no máximo 15 arquivos de uma vez. Fila atual: ${queue.length} arquivos.`);
      return;
    }

    const newItems: QueueItem[] = [];
    let currentBatchSize = queue.reduce((sum, item) => sum + item.originalSize, 0);

    for (const file of filesArray) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      
      // Validation: Extension
      if (!allowedExtensions.includes(ext)) {
        setGlobalError(`Formato inválido rejeitado: .${ext.toUpperCase()}. Use apenas formatos de áudio suportados.`);
        continue;
      }

      // Validation: Individual file size
      if (file.size > MAX_FILE_SIZE) {
        setGlobalError(`Arquivo rejeitado por exceder 50MB: "${file.name}" (${formatBytes(file.size)})`);
        continue;
      }

      // Validation: Total batch size
      if (currentBatchSize + file.size > MAX_BATCH_SIZE) {
        setGlobalError(`Limite total do lote de 150MB seria excedido. Alguns arquivos foram ignorados.`);
        break;
      }

      currentBatchSize += file.size;

      const id = Math.random().toString(36).substring(2, 9);
      newItems.push({
        id,
        file,
        name: file.name,
        originalSize: file.size,
        format: ext.toUpperCase(),
        duration: null,
        channels: null,
        status: "aguardando",
        progress: 0,
        convertedSize: null,
        convertedBlobUrl: null,
        convertedFileName: null,
        errorMessage: null,
      });
    }

    if (newItems.length > 0) {
      setQueue((prev) => [...prev, ...newItems]);

      // Lazy load metadata in the background to not block UI
      newItems.forEach((item) => {
        readAudioMetadata(item.file).then((meta) => {
          setQueue((prev) => prev.map((q) => q.id === item.id ? { ...q, duration: meta.duration, channels: meta.channels } : q));
        }).catch(() => {
          // Quiet failure for background metadata retrieval
        });
      });
    }
  };

  // Resample helper to target constant 44100 Hz rate
  const resampleAudio = async (buffer: AudioBuffer): Promise<AudioBuffer> => {
    const targetSampleRate = 44100;
    const numberOfChannels = buffer.numberOfChannels;
    const duration = buffer.duration;

    const offlineCtx = new OfflineAudioContext(
      numberOfChannels,
      Math.round(targetSampleRate * duration),
      targetSampleRate
    );

    const bufferSource = offlineCtx.createBufferSource();
    bufferSource.buffer = buffer;
    bufferSource.connect(offlineCtx.destination);
    bufferSource.start();

    return await offlineCtx.startRendering();
  };

  // Run the sequential queue process loop
  const startBatchConversion = async () => {
    if (isProcessing || queue.length === 0) return;

    // Check if there are items left to convert
    const itemsToConvert = queue.filter(item => item.status === "aguardando" || item.status === "cancelado" || item.status === "erro");
    if (itemsToConvert.length === 0) {
      setGlobalError("Todos os arquivos selecionados já foram convertidos com sucesso!");
      return;
    }

    setIsProcessing(true);
    isCancelledRef.current = false;
    setGlobalError(null);

    // Process one item at a time sequentially
    for (let i = 0; i < queue.length; i++) {
      if (isCancelledRef.current) break;

      const currentItem = queue[i];
      if (currentItem.status === "concluido") continue; // skip already converted

      setCurrentProcessingIndex(i);
      
      // Update item status in the state
      setQueue((prev) => prev.map((q, idx) => idx === i ? { ...q, status: "preparando", progress: 5 } : q));

      try {
        const arrayBuffer = await currentItem.file.arrayBuffer();
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        
        // Update item status
        setQueue((prev) => prev.map((q, idx) => idx === i ? { ...q, status: "preparando", progress: 20 } : q));
        
        const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        audioCtx.close(); // Immediate cleanup of memory

        // Resample to 44100 Hz
        setQueue((prev) => prev.map((q, idx) => idx === i ? { ...q, status: "preparando", progress: 40 } : q));
        const resampledBuffer = await resampleAudio(decodedBuffer);

        // Update item status to converting
        setQueue((prev) => prev.map((q, idx) => idx === i ? { ...q, status: "convertendo", progress: 0 } : q));

        // Start Web Worker for MP3 conversion
        await new Promise<void>((resolve, reject) => {
          const workerBlob = new Blob([workerCode], { type: "application/javascript" });
          const workerUrl = URL.createObjectURL(workerBlob);
          const worker = new Worker(workerUrl);
          activeWorkerRef.current = worker;

          const cleanUpWorker = () => {
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            activeWorkerRef.current = null;
          };

          worker.onmessage = (e) => {
            const msg = e.data;
            if (msg.type === "progress") {
              setQueue((prev) => prev.map((q, idx) => idx === i ? { ...q, progress: msg.progress } : q));
            } else if (msg.type === "error") {
              cleanUpWorker();
              reject(new Error(msg.error));
            } else if (msg.type === "complete") {
              const mp3Buffer = msg.data;
              const mp3Blob = new Blob([mp3Buffer], { type: "audio/mp3" });
              const mp3Url = URL.createObjectURL(mp3Blob);

              const originalName = currentItem.file.name;
              const lastDotIndex = originalName.lastIndexOf(".");
              const baseName = lastDotIndex !== -1 ? originalName.substring(0, lastDotIndex) : originalName;

              setQueue((prev) => prev.map((q, idx) => idx === i ? { 
                ...q, 
                status: "concluido", 
                progress: 100,
                convertedSize: mp3Blob.size,
                convertedBlobUrl: mp3Url,
                convertedFileName: `${baseName}.mp3`
              } : q));

              cleanUpWorker();
              resolve();
            }
          };

          const leftData = resampledBuffer.getChannelData(0);
          const rightData = resampledBuffer.numberOfChannels > 1 ? resampledBuffer.getChannelData(1) : null;

          const workerLeft = new Float32Array(leftData);
          const workerRight = rightData ? new Float32Array(rightData) : null;

          const transfers: Transferable[] = [workerLeft.buffer];
          if (workerRight) {
            transfers.push(workerRight.buffer);
          }

          worker.postMessage({
            left: workerLeft,
            right: workerRight,
            channels: resampledBuffer.numberOfChannels,
            sampleRate: 44100,
            kbps: 96
          }, transfers);
        });

      } catch (err: any) {
        console.error("Erro ao converter arquivo: ", currentItem.name, err);
        
        let customMessage = err.message || "Falha na decodificação ou conversão de áudio.";
        const isMp4 = currentItem.file.name.toLowerCase().endsWith(".mp4") || 
                      currentItem.file.type.includes("mp4");
        
        if (isMp4) {
          try {
            const arrayBuffer = await currentItem.file.arrayBuffer();
            const mp4Info = checkMp4Audio(arrayBuffer);
            if (!mp4Info.hasAudio) {
              customMessage = "Este arquivo MP4 não possui uma faixa de áudio válida.";
            } else {
              customMessage = "Este arquivo MP4 contém um formato de áudio que o navegador não conseguiu interpretar.";
            }
          } catch (e) {
            customMessage = "Este arquivo MP4 contém um formato de áudio que o navegador não conseguiu interpretar.";
          }
        }

        setQueue((prev) => prev.map((q, idx) => idx === i ? { 
          ...q, 
          status: "erro", 
          progress: 0,
          errorMessage: customMessage
        } : q));
        // We continue to the next file regardless of error
      }
    }

    setIsProcessing(false);
    setCurrentProcessingIndex(-1);
  };

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleSelectedFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleSelectedFiles(e.target.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Calculate statistics of the whole process
  const completedCount = queue.filter(item => item.status === "concluido").length;
  const queueLength = queue.length;
  const totalOriginalBytes = queue.reduce((sum, item) => sum + item.originalSize, 0);
  const totalConvertedBytes = queue.reduce((sum, item) => sum + (item.convertedSize || 0), 0);
  const spaceSavings = totalOriginalBytes > 0 && totalConvertedBytes > 0 && totalOriginalBytes > totalConvertedBytes
    ? Math.round(((totalOriginalBytes - totalConvertedBytes) / totalOriginalBytes) * 100)
    : 0;

  // Cleanup Object URLs on unmount
  useEffect(() => {
    return () => {
      queue.forEach(item => {
        if (item.convertedBlobUrl) {
          URL.revokeObjectURL(item.convertedBlobUrl);
        }
      });
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-200">
      
      {/* Top Header */}
      <header className="border-b border-slate-900/60 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 px-4 py-4 md:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/20 text-emerald-400">
              <Volume2 className="h-6 w-6 animate-pulse" id="logo-icon" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg tracking-tight text-slate-100" id="header-title">
                Conversor de Áudio Grátis
              </h1>
              <p className="text-xs text-slate-400 font-medium" id="header-subtitle">
                Otimizador de Áudio para Compositores
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 text-xs bg-slate-900/80 px-3 py-1.5 rounded-full border border-slate-800/60">
            <ShieldCheck className="h-4 w-4 text-emerald-400" id="shield-icon" />
            <span className="text-slate-300 font-medium" id="privacy-badge">Conversão 100% Local</span>
          </div>
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-grow max-w-3xl w-full mx-auto px-4 py-10 md:py-14 space-y-8">
        
        {/* Dropzone & Queue Converter Area */}
        <div className="space-y-6">
          
          {/* Main Card */}
          <div className="bg-slate-900/40 rounded-3xl border border-slate-900 p-6 md:p-8 shadow-2xl backdrop-blur-sm relative overflow-hidden" id="main-converter-card">
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

            {/* Title Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-900 gap-3" id="title-block">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-100" id="main-title">
                  Fila de Conversão em Lote
                </h2>
                <p className="text-xs text-slate-400 mt-0.5" id="main-subtitle">
                  Selecione até 15 arquivos • Máx 50MB por arquivo • Máx 150MB por lote
                </p>
              </div>
              
              {queueLength > 0 && (
                <button
                  onClick={clearQueue}
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors py-1 px-3 bg-rose-500/5 border border-rose-500/10 rounded-lg hover:bg-rose-500/10 flex items-center space-x-1.5 self-start md:self-auto"
                  id="btn-clear-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Limpar Fila</span>
                </button>
              )}
            </div>

            {/* Queue Statistics Header */}
            {queueLength > 0 && (
              <div className="grid grid-cols-3 gap-3 py-4 text-center border-b border-slate-900 bg-slate-950/20 rounded-xl px-4 mt-4" id="stats-banner">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Arquivos</p>
                  <p className="text-sm font-bold text-emerald-400">{completedCount} / {queueLength}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Original</p>
                  <p className="text-sm font-bold text-slate-300 font-mono">{formatBytes(totalOriginalBytes, 1)}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider font-bold">Economia</p>
                  <p className="text-sm font-bold text-emerald-400 font-mono">{spaceSavings > 0 ? `${spaceSavings}%` : "0%"}</p>
                </div>
              </div>
            )}

            {/* Drag & Dropzone */}
            <form 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onSubmit={(e) => e.preventDefault()}
              onClick={triggerFileInput}
              className={`mt-6 border-2 border-dashed rounded-2xl p-6 md:p-10 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-4 group ${
                dragActive 
                  ? "border-emerald-500 bg-emerald-500/5 scale-[0.99]" 
                  : "border-slate-800 bg-slate-950/40 hover:border-slate-700/80 hover:bg-slate-950/60"
              }`}
              id="upload-dropzone"
            >
              <input 
                ref={fileInputRef}
                type="file" 
                multiple
                className="hidden" 
                accept=".wav,.mp3,.mp4,.m4a,.aac,.flac,.ogg,.webm,audio/*,video/mp4,application/mp4"
                onChange={handleChange}
              />
              
              <div className="p-3 bg-slate-900/85 rounded-xl border border-slate-800 group-hover:scale-105 transition-transform duration-200 text-slate-400 group-hover:text-emerald-400">
                <Upload className="h-6 w-6" id="upload-icon" />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-200" id="upload-text-main">
                  Clique ou arraste de 1 até 15 arquivos de áudio
                </p>
                <p className="text-xs text-slate-500" id="upload-text-sub">
                  Suporta WAV, MP3, MP4, M4A, AAC, FLAC, OGG e WEBM de até 50 MB cada.
                </p>
              </div>
            </form>

            {/* Global Error Banner */}
            {globalError && (
              <div className="mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start space-x-3 text-left animate-shake" id="global-error-alert">
                <AlertCircle className="h-5 w-5 text-rose-400 mt-0.5 shrink-0" id="error-icon" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">Aviso</h4>
                  <p className="text-xs text-rose-300/90 leading-relaxed mt-0.5" id="global-error-message">
                    {globalError}
                  </p>
                </div>
                <button onClick={() => setGlobalError(null)} className="text-slate-400 hover:text-slate-200 shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Queue List */}
            <div className="mt-6 space-y-3 max-h-[420px] overflow-y-auto pr-1" id="queue-list-container">
              {queue.length === 0 ? (
                <div className="text-center py-10 text-slate-500 border border-slate-900/40 rounded-2xl bg-slate-950/20" id="empty-queue-message">
                  <FileAudio className="h-8 w-8 mx-auto text-slate-700 mb-2" />
                  <p className="text-xs font-semibold">Nenhum arquivo na fila de conversão</p>
                  <p className="text-[10px] text-slate-600 mt-1">Selecione arquivos acima para começar</p>
                </div>
              ) : (
                queue.map((item, index) => {
                  const isCurrent = index === currentProcessingIndex;
                  const itemSavings = item.originalSize && item.convertedSize && item.originalSize > item.convertedSize
                    ? Math.round(((item.originalSize - item.convertedSize) / item.originalSize) * 100)
                    : null;

                  return (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-3 relative ${
                        isCurrent 
                          ? "bg-emerald-950/20 border-emerald-500/50" 
                          : item.status === "concluido" 
                          ? "bg-emerald-950/10 border-emerald-500/20" 
                          : item.status === "erro"
                          ? "bg-rose-950/10 border-rose-500/20"
                          : "bg-slate-950/40 border-slate-900 hover:border-slate-800"
                      }`}
                      id={`queue-item-${item.id}`}
                    >
                      <div className="flex items-center space-x-3.5 min-w-0 flex-1">
                        <div className={`p-2.5 rounded-xl border ${
                          item.status === "concluido"
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : item.status === "erro"
                            ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                            : "bg-slate-900 border-slate-800 text-slate-400"
                        }`}>
                          <FileAudio className="h-5 w-5" />
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-200 truncate" id={`name-${item.id}`}>
                            {item.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 text-[10px] text-slate-500 font-medium">
                            <span className="font-mono font-bold text-slate-400">{item.format}</span>
                            <span>•</span>
                            <span>{formatBytes(item.originalSize)}</span>
                            {item.duration !== null && (
                              <>
                                <span>•</span>
                                <span className="flex items-center space-x-1">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatDuration(item.duration)}</span>
                                </span>
                              </>
                            )}
                            {item.convertedSize && (
                              <>
                                <span>•</span>
                                <span className="text-emerald-400 font-bold font-mono">Convertido: {formatBytes(item.convertedSize)}</span>
                                {itemSavings && (
                                  <span className="text-emerald-400 font-bold font-mono">({itemSavings}% menor)</span>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status / Actions Area */}
                      <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
                        
                        {/* Status Message Text */}
                        <div className="text-right">
                          {item.status === "aguardando" && (
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Aguardando</span>
                          )}
                          {item.status === "preparando" && (
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide flex items-center space-x-1">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span>Processando...</span>
                            </span>
                          )}
                          {item.status === "convertendo" && (
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide flex items-center space-x-1">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span>{item.progress}%</span>
                            </span>
                          )}
                          {item.status === "concluido" && (
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wide flex items-center space-x-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Pronto</span>
                            </span>
                          )}
                          {item.status === "cancelado" && (
                            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Cancelado</span>
                          )}
                          {item.status === "erro" && (
                            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wide flex items-center space-x-1" title={item.errorMessage || "Erro desconhecido"}>
                              <AlertCircle className="h-3 w-3" />
                              <span>Erro</span>
                            </span>
                          )}
                        </div>

                        {/* Individual Download/Remove Buttons */}
                        <div className="flex items-center space-x-1.5">
                          {item.status === "concluido" && item.convertedBlobUrl && (
                            <a
                              href={item.convertedBlobUrl}
                              download={item.convertedFileName || "convertido.mp3"}
                              className="p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 hover:text-emerald-300 rounded-lg transition-colors"
                              title="Baixar este arquivo convertido"
                              id={`dl-${item.id}`}
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          )}

                          {!isProcessing && (
                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-1.5 bg-slate-950/80 hover:bg-rose-500/10 border border-slate-900 hover:border-rose-500/20 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                              title="Remover da lista"
                              id={`rm-${item.id}`}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                      </div>

                      {/* Error details inside the list item */}
                      {item.status === "erro" && item.errorMessage && (
                        <div className="w-full text-[10px] text-rose-400 font-medium pt-1 mt-1 border-t border-rose-500/5 leading-normal md:hidden">
                          * {item.errorMessage}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Queue Control Buttons */}
            {queueLength > 0 && (
              <div className="mt-6 pt-5 border-t border-slate-900 space-y-4" id="action-buttons-box">
                
                {/* Global conversion progress text */}
                {isProcessing && (
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                    <span className="flex items-center space-x-1.5">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                      <span>Convertendo item <strong>{currentProcessingIndex + 1}</strong> de <strong>{queueLength}</strong></span>
                    </span>
                    <span className="font-semibold text-emerald-400 font-mono">
                      Fila em andamento
                    </span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  {isProcessing ? (
                    <button
                      onClick={cancelQueue}
                      className="w-full px-5 py-3 text-sm font-bold rounded-xl bg-slate-950 text-slate-400 border border-slate-900 hover:border-rose-500/20 hover:bg-rose-500/5 hover:text-rose-400 transition-all duration-150 h-12 flex items-center justify-center space-x-2"
                      id="btn-cancel-conversion"
                    >
                      <X className="h-4 w-4" />
                      <span>Cancelar Conversão</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={startBatchConversion}
                        disabled={queue.length === 0}
                        className={`w-full px-6 py-3.5 text-sm font-bold rounded-xl text-white shadow-xl transition-all duration-150 flex items-center justify-center space-x-2 h-13 ${
                          queue.length > 0
                            ? "bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 active:scale-[0.99] cursor-pointer" 
                            : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-900"
                        }`}
                        id="btn-start-batch"
                      >
                        <Play className="h-4 w-4" />
                        <span>Converter todos para MP3 96 kbps</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

          </div>

        </div>

        {/* Explanation Section below the main card */}
        <section className="bg-slate-900/25 rounded-3xl border border-slate-900/60 p-6 md:p-8 space-y-6 relative overflow-hidden" id="benefits-section">
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <h3 className="font-display text-xl md:text-2xl font-bold tracking-tight text-emerald-400" id="benefits-title">
              Áudio mais leve para tocar melhor no SomDrive
            </h3>
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed" id="benefits-subtitle">
              Converta seus arquivos para MP3 96 kbps e deixe suas músicas mais leves, mais rápidas para carregar e mais fáceis de ouvir dentro do SomDrive.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2" id="benefits-grid">
            {/* Benefit 1 */}
            <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-900/80 hover:border-emerald-500/10 transition-all duration-200 flex flex-col space-y-2" id="benefit-card-1">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 text-xs font-bold shrink-0">01</span>
                <h4 className="text-sm font-semibold text-slate-200">Mais leve</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Arquivos menores para subir e reproduzir com mais facilidade.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-900/80 hover:border-emerald-500/10 transition-all duration-200 flex flex-col space-y-2" id="benefit-card-2">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 text-xs font-bold shrink-0">02</span>
                <h4 className="text-sm font-semibold text-slate-200">Mais rápido</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Menos tempo de carregamento no celular e no computador.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-900/80 hover:border-emerald-500/10 transition-all duration-200 flex flex-col space-y-2" id="benefit-card-3">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20 text-xs font-bold shrink-0">03</span>
                <h4 className="text-sm font-semibold text-slate-200">Ideal para demos</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Qualidade suficiente para apresentar voz, melodia e harmonia com clareza.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-900/60 flex flex-col md:flex-row items-center justify-between gap-4" id="benefits-footer-box">
            <p className="text-xs text-emerald-400 font-semibold text-center md:text-left">
              Menos peso no arquivo. Mais fluidez na reprodução. Melhor experiência no SomDrive.
            </p>
            
            <div className="flex items-center space-x-2 shrink-0 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-900">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">SomDrive PRO</span>
              <a 
                href="https://somdrive.com.br" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-emerald-400 font-bold hover:text-emerald-300 transition-colors flex items-center space-x-1"
                id="somdrive-footer-btn"
              >
                <span>Acessar plataforma</span>
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </section>

        {/* Safety info at the very bottom */}
        <div className="bg-slate-950/40 rounded-2xl border border-slate-900/60 p-4 flex items-start space-x-3 max-w-3xl mx-auto" id="local-security-card">
          <Info className="h-4.5 w-4.5 text-emerald-400 mt-0.5 shrink-0" id="info-icon" />
          <p className="text-xs text-slate-400 leading-relaxed" id="security-disclaimer">
            Seus arquivos são processados diretamente no seu dispositivo e não ficam armazenados em nossos servidores. Ao atualizar ou fechar a aba, a memória local é 100% liberada.
          </p>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900/40 bg-slate-950 py-6 px-4 md:px-8">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center md:text-left">
          <p id="footer-text-left">
            &copy; {new Date().getFullYear()} Conversor de Áudio Local. Processado 100% no seu navegador.
          </p>
          <div className="flex items-center space-x-4" id="footer-links">
            <span className="flex items-center space-x-1.5" id="footer-link-tech">
              <span>Tecnologia: Web Audio API & Multi-Threading Web Workers</span>
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
