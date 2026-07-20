import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { 
  FileVideo, 
  Settings, 
  FolderOpen, 
  Play, 
  XCircle, 
  CheckCircle, 
  Info, 
  Clock, 
  Activity, 
  HardDrive, 
  FileAudio,
  ShieldCheck,
  ChevronRight,
  Sparkles
} from "lucide-react";

interface VideoMetadata {
  filename: string;
  size: number;
  duration: number;
  format: string;
  codec: string;
  frequency: number;
  channels: number;
}

export default function App() {
  // Input State
  const [videoPath, setVideoPath] = useState<string>("");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProbing, setIsProbing] = useState<boolean>(false);

  // Conversion Options
  const [outputDir, setOutputDir] = useState<string>("");
  const [format, setFormat] = useState<"mp3" | "wav">("mp3");
  const [mp3Bitrate, setMp3Bitrate] = useState<string>("192");
  const [wavSampleRate, setWavSampleRate] = useState<string>("44100");

  // Conversion State
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const [speed, setSpeed] = useState<string>("1.0x");
  const [processedSize, setProcessedSize] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Stats for tests display
  const [testLog, setTestLog] = useState<{
    fileSize: string;
    duration: string;
    outputFormat: string;
    bitrate: string;
    elapsed: string;
    finalSize: string;
  } | null>(null);

  // Timer for elapsed time
  useEffect(() => {
    let timer: any;
    if (isConverting) {
      const start = Date.now();
      timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - start) / 1000));
      }, 1000);
    } else {
      clearInterval(timer);
    }
    return () => clearInterval(timer);
  }, [isConverting]);

  // Listen to Tauri events for progress updates
  useEffect(() => {
    let unlistenProgress: any;
    let unlistenDone: any;
    let unlistenError: any;

    async function setupListeners() {
      unlistenProgress = await listen<any>("conversion-progress", (event) => {
        const { percentage, speed: speedVal, total_size } = event.payload;
        setProgress(Math.min(100, Math.max(0, percentage)));
        if (speedVal) setSpeed(speedVal);
        if (total_size) setProcessedSize(total_size);

        // Estimate remaining time
        if (percentage > 2 && metadata?.duration) {
          const currentDuration = metadata.duration;
          const elapsed = elapsedTime || 1;
          const totalEstimatedTime = (elapsed / (percentage / 100));
          const rem = Math.max(0, Math.round(totalEstimatedTime - elapsed));
          setRemainingTime(rem);
        }
      });

      unlistenDone = await listen<any>("conversion-done", (event) => {
        setIsConverting(false);
        setIsCompleted(true);
        setProgress(100);
        setRemainingTime(0);

        // Record stats for test history
        if (metadata) {
          setTestLog({
            fileSize: formatBytes(metadata.size),
            duration: formatDuration(metadata.duration),
            outputFormat: format.toUpperCase(),
            bitrate: format === "mp3" ? `${mp3Bitrate} kbps` : "PCM 16-bit",
            elapsed: `${elapsedTime}s`,
            finalSize: formatBytes(event.payload?.size || 0),
          });
        }
      });

      unlistenError = await listen<string>("conversion-error", (event) => {
        setIsConverting(false);
        setError(`Erro na conversão: ${event.payload}`);
      });
    }

    setupListeners();

    return () => {
      if (unlistenProgress) unlistenProgress();
      if (unlistenDone) unlistenDone();
      if (unlistenError) unlistenError();
    };
  }, [isConverting, elapsedTime, metadata, format, mp3Bitrate]);

  // Select Video File using Tauri dialog
  const handleSelectVideo = async () => {
    try {
      setError(null);
      const selected = await open({
        multiple: false,
        filters: [{
          name: "Arquivos de Vídeo",
          extensions: ["mp4", "mkv", "avi", "mov", "webm", "mpeg", "3gp", "flv"]
        }]
      });

      if (selected && typeof selected === "string") {
        setVideoPath(selected);
        
        // Auto-set output folder to the same folder as the input video
        const lastSlash = Math.max(selected.lastIndexOf("\\"), selected.lastIndexOf("/"));
        if (lastSlash !== -1) {
          setOutputDir(selected.substring(0, lastSlash));
        }

        // Fetch Metadata via ffprobe
        setIsProbing(true);
        const metaStr: string = await invoke("probe_video", { videoPath: selected });
        const parsedMeta: VideoMetadata = JSON.parse(metaStr);
        setMetadata(parsedMeta);
        setIsCompleted(false);
        setProgress(0);
        setElapsedTime(0);
        setRemainingTime(null);
        setSpeed("1.0x");
        setIsProbing(false);
      }
    } catch (err: any) {
      console.error(err);
      setError(`Falha ao carregar metadados do vídeo: ${err.message || err}`);
      setIsProbing(false);
    }
  };

  // Change Output Directory
  const handleChangeOutputDir = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false
      });
      if (selected && typeof selected === "string") {
        setOutputDir(selected);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  // Start Conversion
  const handleStartConversion = async () => {
    if (!videoPath || !outputDir) {
      setError("Selecione um arquivo de vídeo e uma pasta de destino.");
      return;
    }

    try {
      setError(null);
      setIsCompleted(false);
      setIsConverting(true);
      setProgress(0);
      setElapsedTime(0);
      setRemainingTime(null);
      setSpeed("1.0x");

      await invoke("convert_video", {
        videoPath,
        outputDir,
        format,
        bitrate: mp3Bitrate,
        sampleRate: wavSampleRate
      });
    } catch (err: any) {
      setError(`Erro ao iniciar conversão: ${err.message || err}`);
      setIsConverting(false);
    }
  };

  // Cancel Conversion
  const handleCancelConversion = async () => {
    try {
      await invoke("cancel_conversion");
      setIsConverting(false);
      setProgress(0);
      setRemainingTime(null);
      setError("Conversão cancelada pelo usuário. Arquivo temporário removido.");
    } catch (err: any) {
      setError(`Erro ao cancelar: ${err.message || err}`);
    }
  };

  // Open Output Folder
  const handleOpenFolder = async () => {
    if (!outputDir) return;
    try {
      await invoke("open_folder", { path: outputDir });
    } catch (err: any) {
      setError(`Não foi possível abrir a pasta: ${err.message || err}`);
    }
  };

  // Reset State
  const handleReset = () => {
    setVideoPath("");
    setMetadata(null);
    setError(null);
    setIsCompleted(false);
    setProgress(0);
    setElapsedTime(0);
    setRemainingTime(null);
  };

  // Format Helpers
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(" ");
  };

  const formatSeconds = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen p-6 md:p-10 flex flex-col justify-between max-w-6xl mx-auto space-y-8 animate-fade-in">
      
      {/* Header Panel */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#D5DEDA] pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-[#22B455]/10 text-[#22B455] rounded-lg">
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-[#1F2A33] tracking-tight uppercase">
              SomDrive <span className="text-[#22B455]">Desktop</span>
            </h1>
          </div>
          <p className="text-sm font-semibold text-[#5F6B76] mt-1">
            Conversor e extrator nativo de áudio de alta fidelidade e alta performance.
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-[#FFFFFF] border border-[#D5DEDA] rounded-xl px-4 py-2 self-start sm:self-auto shadow-sm">
          <ShieldCheck className="h-4.5 w-4.5 text-[#22B455]" />
          <span className="text-xs font-extrabold text-[#1F2A33] tracking-wide uppercase">Windows v1.0.0 (x86_64)</span>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start flex-1">
        
        {/* Left Column (Selector / Inputs) */}
        <section className="lg:col-span-3 space-y-6">
          
          {/* File Selector Zone */}
          {!videoPath ? (
            <div 
              onClick={handleSelectVideo}
              className="border-2 border-dashed border-[#D5DEDA] hover:border-[#22B455] rounded-[24px] p-8 md:p-12 text-center bg-white shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center justify-center min-h-[300px] space-y-5"
            >
              {isProbing ? (
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-10 h-10 border-4 border-[#22B455] border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-sm font-bold text-[#5F6B76]">Analisando faixas do vídeo...</p>
                </div>
              ) : (
                <>
                  <div className="p-4 bg-[#22B455]/10 text-[#22B455] rounded-full border border-[#22B455]/20">
                    <FileVideo className="h-10 w-10" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-extrabold text-lg text-[#1F2A33]">
                      Clique para selecionar um arquivo de vídeo
                    </h3>
                    <p className="text-xs font-semibold text-[#5F6B76] max-w-md mx-auto leading-relaxed">
                      Lê diretamente do disco sem carregar em RAM (compatível com 500 MB, 1 GB, 2 GB ou superior). Processamento 100% offline.
                    </p>
                  </div>
                  <span className="px-5 py-2.5 bg-[#22B455] hover:bg-[#168844] text-white text-sm font-extrabold rounded-xl transition-all shadow-sm">
                    Escolher Vídeo
                  </span>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white border border-[#D5DEDA] rounded-[24px] p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-[#EEF2F1] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-[#22B455]/15 text-[#22B455] rounded-xl">
                    <FileVideo className="h-5 w-5" />
                  </div>
                  <div className="max-w-md overflow-hidden">
                    <h3 className="font-extrabold text-[#1F2A33] text-base truncate" title={metadata?.filename || "Vídeo carregado"}>
                      {metadata?.filename || "Vídeo Carregado"}
                    </h3>
                    <p className="text-xs font-semibold text-[#5F6B76] truncate">{videoPath}</p>
                  </div>
                </div>
                {!isConverting && (
                  <button 
                    onClick={handleReset}
                    className="text-xs font-extrabold text-[#B42318] hover:underline cursor-pointer"
                  >
                    Trocar arquivo
                  </button>
                )}
              </div>

              {metadata ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="p-3 bg-[#F4F6F5] rounded-xl space-y-1">
                    <span className="text-[10px] font-extrabold text-[#5F6B76] uppercase tracking-wider block">Tamanho</span>
                    <span className="font-bold text-sm text-[#1F2A33]">{formatBytes(metadata.size)}</span>
                  </div>
                  <div className="p-3 bg-[#F4F6F5] rounded-xl space-y-1">
                    <span className="text-[10px] font-extrabold text-[#5F6B76] uppercase tracking-wider block">Duração</span>
                    <span className="font-bold text-sm text-[#1F2A33]">{formatDuration(metadata.duration)}</span>
                  </div>
                  <div className="p-3 bg-[#F4F6F5] rounded-xl space-y-1">
                    <span className="text-[10px] font-extrabold text-[#5F6B76] uppercase tracking-wider block">Formato Contêiner</span>
                    <span className="font-bold text-sm text-[#1F2A33] uppercase">{metadata.format.replace(/,.*$/, "")}</span>
                  </div>
                  <div className="p-3 bg-[#F4F6F5] rounded-xl space-y-1">
                    <span className="text-[10px] font-extrabold text-[#5F6B76] uppercase tracking-wider block">Codec Áudio</span>
                    <span className="font-bold text-sm text-[#1F2A33] uppercase">{metadata.codec || "Nenhum"}</span>
                  </div>
                  <div className="p-3 bg-[#F4F6F5] rounded-xl space-y-1">
                    <span className="text-[10px] font-extrabold text-[#5F6B76] uppercase tracking-wider block">Taxa Amostragem</span>
                    <span className="font-bold text-sm text-[#1F2A33]">{metadata.frequency ? `${metadata.frequency} Hz` : "Desconhecida"}</span>
                  </div>
                  <div className="p-3 bg-[#F4F6F5] rounded-xl space-y-1">
                    <span className="text-[10px] font-extrabold text-[#5F6B76] uppercase tracking-wider block">Canais</span>
                    <span className="font-bold text-sm text-[#1F2A33]">
                      {metadata.channels === 1 ? "Mono" : metadata.channels === 2 ? "Stereo" : `${metadata.channels} canais`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-xs font-bold text-[#5F6B76]">Lendo metadados técnicos...</div>
              )}
            </div>
          )}

          {/* Config Settings Area */}
          {videoPath && metadata && (
            <div className="bg-white border border-[#D5DEDA] rounded-[24px] p-6 shadow-sm space-y-6">
              <div className="flex items-center gap-2 border-b border-[#EEF2F1] pb-3">
                <Settings className="h-4 w-4 text-[#5F6B76]" />
                <h3 className="font-extrabold text-[14px] text-[#1F2A33] uppercase tracking-wider">Parâmetros de Codificação</h3>
              </div>

              {/* Format selection */}
              <div className="space-y-2">
                <label className="text-xs font-extrabold text-[#5F6B76] uppercase tracking-wider block">Formato de Saída</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    disabled={isConverting}
                    onClick={() => setFormat("mp3")}
                    className={`p-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      format === "mp3" 
                        ? "border-[#22B455] bg-[#22B455]/5 text-[#115C2A] font-extrabold" 
                        : "border-[#D5DEDA] text-[#5F6B76] hover:bg-[#F4F6F5]"
                    }`}
                  >
                    <FileAudio className="h-4 w-4" />
                    MP3 (MPEG Audio Layer III)
                  </button>
                  <button
                    disabled={isConverting}
                    onClick={() => setFormat("wav")}
                    className={`p-3 rounded-xl border font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      format === "wav" 
                        ? "border-[#22B455] bg-[#22B455]/5 text-[#115C2A] font-extrabold" 
                        : "border-[#D5DEDA] text-[#5F6B76] hover:bg-[#F4F6F5]"
                    }`}
                  >
                    <FileAudio className="h-4 w-4" />
                    WAV (Waveform Audio Format)
                  </button>
                </div>
              </div>

              {/* Quality Subsections */}
              {format === "mp3" ? (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs font-extrabold text-[#5F6B76] uppercase tracking-wider block">Taxa de Bits (Bitrate MP3)</label>
                  <div className="grid grid-cols-5 gap-2">
                    {["96", "112", "128", "192", "320"].map((rate) => (
                      <button
                        key={rate}
                        disabled={isConverting}
                        onClick={() => setMp3Bitrate(rate)}
                        className={`py-2 px-1 rounded-lg border font-bold text-xs transition-all text-center cursor-pointer ${
                          mp3Bitrate === rate 
                            ? "border-[#22B455] bg-[#22B455]/10 text-[#115C2A] font-extrabold" 
                            : "border-[#D5DEDA] text-[#5F6B76] hover:bg-[#F4F6F5]"
                        }`}
                      >
                        {rate} kbps
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-[#5F6B76] font-semibold block leading-relaxed">
                    {mp3Bitrate === "128" ? "Qualidade padrão de rádio. Ótima economia." : mp3Bitrate === "320" ? "Qualidade máxima (Hi-Fi de estúdio). Menor compressão." : "Modo de compressão libmp3lame otimizado."}
                  </span>
                </div>
              ) : (
                <div className="space-y-2 animate-fade-in">
                  <label className="text-xs font-extrabold text-[#5F6B76] uppercase tracking-wider block">Frequência do PCM WAV</label>
                  <div className="grid grid-cols-2 gap-3">
                    {["44100", "48000"].map((rate) => (
                      <button
                        key={rate}
                        disabled={isConverting}
                        onClick={() => setWavSampleRate(rate)}
                        className={`p-3 rounded-xl border font-bold text-xs transition-all text-center cursor-pointer ${
                          wavSampleRate === rate 
                            ? "border-[#22B455] bg-[#22B455]/10 text-[#115C2A] font-extrabold" 
                            : "border-[#D5DEDA] text-[#5F6B76] hover:bg-[#F4F6F5]"
                        }`}
                      >
                        {rate === "44100" ? "44.100 Hz (Qualidade de CD)" : "48.000 Hz (Qualidade de Vídeo/Estúdio)"}
                      </button>
                    ))}
                  </div>
                  <span className="text-[11px] text-[#5F6B76] font-semibold block">
                    WAV sem compressão adicional. PCM Linear 16-bit estéreo.
                  </span>
                </div>
              )}

              {/* Output Directory selector */}
              <div className="space-y-2 pt-2 border-t border-[#EEF2F1]">
                <label className="text-xs font-extrabold text-[#5F6B76] uppercase tracking-wider block">Pasta de Destino</label>
                <div className="flex gap-2">
                  <div className="bg-[#F4F6F5] border border-[#D5DEDA] rounded-xl px-4 py-2.5 flex-1 text-xs font-bold text-[#1F2A33] select-all truncate">
                    {outputDir}
                  </div>
                  <button
                    disabled={isConverting}
                    onClick={handleChangeOutputDir}
                    className="px-4 py-2.5 bg-white border border-[#D5DEDA] hover:bg-[#F4F6F5] text-[#1F2A33] font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <FolderOpen className="h-4 w-4 text-[#5F6B76]" />
                    Alterar
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col sm:flex-row gap-3">
                {!isConverting ? (
                  <button
                    onClick={handleStartConversion}
                    className="px-6 py-4 bg-[#22B455] hover:bg-[#168844] text-white font-extrabold text-sm rounded-xl shadow-md shadow-emerald-950/10 flex-1 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Play className="h-4 w-4" />
                    Iniciar Extração de Áudio
                  </button>
                ) : (
                  <button
                    onClick={handleCancelConversion}
                    className="px-6 py-4 bg-[#B42318] hover:bg-[#912018] text-white font-extrabold text-sm rounded-xl shadow-md flex-1 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <XCircle className="h-4 w-4" />
                    Cancelar Extração e Excluir Temporários
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Right Column (Conversion Progress / Real tests simulation results) */}
        <section className="lg:col-span-2 space-y-6">
          
          {/* Active conversion progress panel */}
          {isConverting || isCompleted || error ? (
            <div className="bg-white border border-[#D5DEDA] rounded-[24px] p-6 shadow-sm space-y-5 animate-fade-in">
              <h3 className="font-extrabold text-sm text-[#1F2A33] uppercase tracking-wider border-b border-[#EEF2F1] pb-3">
                Monitor de Processamento
              </h3>

              {isConverting && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs font-extrabold text-[#1F2A33]">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-[#22B455] rounded-full animate-ping"></div>
                      <span>Convertendo...</span>
                    </div>
                    <span>{progress.toFixed(1)}%</span>
                  </div>

                  {/* Progress bar container */}
                  <div className="h-3 bg-[#EEF2F1] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#22B455] transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>

                  {/* Conversion stats */}
                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-semibold text-[#5F6B76]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Tempo Decorrido: <strong>{formatSeconds(elapsedTime)}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-[#22B455]" />
                      <span>Restante: <strong>{remainingTime !== null ? formatSeconds(remainingTime) : "Estimando..."}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      <span>Velocidade FFmpeg: <strong>{speed}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <HardDrive className="h-3.5 w-3.5" />
                      <span>Tamanho Gerado: <strong>{formatBytes(processedSize)}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Success Screen */}
              {isCompleted && (
                <div className="text-center py-4 space-y-4 animate-fade-in">
                  <div className="inline-flex p-3 bg-[#22B455]/10 text-[#22B455] border border-[#22B455]/20 rounded-full">
                    <CheckCircle className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-[#1F2A33] text-base">Áudio Extraído com Sucesso!</h4>
                    <p className="text-xs font-semibold text-[#5F6B76] px-4">
                      O arquivo foi salvo na pasta selecionada com metadados originais e codificação otimizada.
                    </p>
                  </div>

                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      onClick={handleOpenFolder}
                      className="px-4 py-2.5 bg-[#22B455] hover:bg-[#168844] text-white font-extrabold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <FolderOpen className="h-4 w-4" />
                      Abrir Pasta de Destino
                    </button>
                    <button
                      onClick={handleReset}
                      className="px-4 py-2.5 bg-white border border-[#D5DEDA] hover:bg-[#F4F6F5] text-[#5F6B76] font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Converter outro vídeo
                    </button>
                  </div>
                </div>
              )}

              {/* Error Screen */}
              {error && (
                <div className="p-4 bg-[#B42318]/5 border border-[#B42318]/15 rounded-xl text-xs font-semibold text-[#B42318] space-y-1 animate-fade-in">
                  <div className="flex items-center gap-1.5 font-extrabold">
                    <XCircle className="h-4 w-4 text-[#B42318]" />
                    <span>Falha na Operação</span>
                  </div>
                  <p>{error}</p>
                </div>
              )}
            </div>
          ) : null}

          {/* Desktop App technical performance stats / architecture summary */}
          <div className="bg-white border border-[#D5DEDA] rounded-[24px] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#5F6B76]">
              <Info className="h-4 w-4" />
              <h4 className="font-extrabold text-[12px] uppercase tracking-wider">Características da Arquitetura</h4>
            </div>

            <ul className="text-xs font-semibold text-[#5F6B76] space-y-3">
              <li className="flex items-start gap-2 leading-relaxed">
                <ChevronRight className="h-3.5 w-3.5 text-[#22B455] mt-0.5 shrink-0" />
                <span><strong>Leitura direta:</strong> Não há necessidade de carregar o arquivo na memória RAM do navegador (MEMFS). O FFmpeg nativo lê direto do disco.</span>
              </li>
              <li className="flex items-start gap-2 leading-relaxed">
                <ChevronRight className="h-3.5 w-3.5 text-[#22B455] mt-0.5 shrink-0" />
                <span><strong>Sem limites:</strong> Processa arquivos de 500 MB, 1 GB, 2 GB ou mais, sem travamentos de thread ou interrupções de sandbox de iFrames.</span>
              </li>
              <li className="flex items-start gap-2 leading-relaxed">
                <ChevronRight className="h-3.5 w-3.5 text-[#22B455] mt-0.5 shrink-0" />
                <span><strong>Processo limpo:</strong> Interrupções de cancelamento excluem instantaneamente arquivos corrompidos ou inacabados do disco, poupando espaço de armazenamento.</span>
              </li>
            </ul>

            {/* Test Log display if a conversion just succeeded */}
            {testLog && (
              <div className="mt-4 p-4 bg-[#22B455]/5 border border-[#22B455]/10 rounded-xl space-y-2 animate-fade-in text-xs font-mono">
                <div className="font-extrabold text-[#115C2A] uppercase tracking-wider text-[10px] mb-1">Log de Teste da Conversão</div>
                <div>Tamanho Original: <span className="font-bold text-[#1F2A33]">{testLog.fileSize}</span></div>
                <div>Duração: <span className="font-bold text-[#1F2A33]">{testLog.duration}</span></div>
                <div>Saída: <span className="font-bold text-[#1F2A33]">{testLog.outputFormat} - {testLog.bitrate}</span></div>
                <div>Tempo de Processamento: <span className="font-bold text-[#1F2A33]">{testLog.elapsed}</span></div>
                <div>Tamanho Final: <span className="font-bold text-[#1F2A33]">{testLog.finalSize}</span></div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer Branding */}
      <footer className="flex flex-col sm:flex-row items-center justify-between text-xs font-bold text-[#5F6B76] pt-6 border-t border-[#D5DEDA] gap-2">
        <span>© {new Date().getFullYear()} Conversor SomDrive Desktop</span>
        <span className="flex items-center gap-1.5 bg-[#F4F6F5] border border-[#D5DEDA] px-3 py-1 rounded-lg">
          <span className="w-1.5 h-1.5 bg-[#22B455] rounded-full"></span>
          Motor FFmpeg Nativo Windows x86_64
        </span>
      </footer>
    </div>
  );
}
