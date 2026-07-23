/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Film, ShieldCheck, AlertTriangle, Monitor, Sparkles, FileAudio, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import VideoDropzone from "../components/video/VideoDropzone";
import VideoInfo from "../components/video/VideoInfo";
import VideoPreview from "../components/video/VideoPreview";
import VideoOutputSettings, { VideoConversionConfig } from "../components/video/VideoOutputSettings";
import VideoConversionProgress from "../components/video/VideoConversionProgress";
import VideoConversionResult, { VideoConversionResultData } from "../components/video/VideoConversionResult";
import { analyzeVideoFile, VideoMetadata } from "../services/video/videoAnalyzer";
import { extractAudioFromVideo, ExtractedAudioData } from "../services/video/videoAudioExtractor";
import { encodeMp3InWorker } from "../services/video/mp3EncoderService";
import { encodeWavBuffer } from "../services/video/wavEncoderService";

interface VideoToAudioProps {
  onBack?: () => void;
  onNavigateTab?: (tab: string) => void;
}

export default function VideoToAudio({ onBack, onNavigateTab }: VideoToAudioProps = {}) {
  // Mobile / Desktop detection
  const isMobileDevice = typeof window !== "undefined" && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(window.navigator.userAgent) ||
    window.innerWidth < 768
  );

  // Workflow states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Output config
  const [config, setConfig] = useState<VideoConversionConfig>({
    format: "mp3",
    mp3Kbps: 96,
    wavSampleRate: "44100",
    wavChannels: "original",
    hasAcceptedTerms: false
  });

  // Progress states
  const [isConverting, setIsConverting] = useState(false);
  const [progressStage, setProgressStage] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);

  // Result state
  const [conversionResult, setConversionResult] = useState<VideoConversionResultData | null>(null);

  // Cancellation and worker refs
  const isCancelledRef = useRef(false);
  const activeWorkerRef = useRef<Worker | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMemory();
    };
  }, []);

  const cleanupMemory = () => {
    if (activeWorkerRef.current) {
      activeWorkerRef.current.terminate();
      activeWorkerRef.current = null;
    }
    if (conversionResult?.outputBlobUrl) {
      URL.revokeObjectURL(conversionResult.outputBlobUrl);
    }
  };

  const handleFileSelect = async (file: File) => {
    cleanupMemory();
    setSelectedFile(file);
    setVideoMetadata(null);
    setAnalysisError(null);
    setConversionResult(null);
    setIsAnalyzing(true);

    try {
      const metadata = await analyzeVideoFile(file);
      setVideoMetadata(metadata);
    } catch (err: any) {
      setAnalysisError(err.message || 'Erro ao analisar o vídeo.');
      setSelectedFile(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartConversion = async () => {
    if (!selectedFile || !videoMetadata || !config.hasAcceptedTerms) return;

    setIsConverting(true);
    setProgressPercent(5);
    setProgressStage("Analisando vídeo...");
    isCancelledRef.current = false;

    try {
      // Step 1 & 2: Extract audio track to PCM
      const audioData: ExtractedAudioData = await extractAudioFromVideo(
        selectedFile,
        (stage, progress) => {
          setProgressStage(stage);
          setProgressPercent(progress);
        },
        () => isCancelledRef.current
      );

      if (isCancelledRef.current) throw new Error("Cancelado pelo usuário");

      setProgressStage("Convertendo para " + config.format.toUpperCase() + "...");
      setProgressPercent(70);

      let outputBlob: Blob;
      let qualityChosen = "";

      if (config.format === "mp3") {
        qualityChosen = `${config.mp3Kbps} kbps`;
        outputBlob = await encodeMp3InWorker(
          audioData.leftChannel,
          audioData.rightChannel,
          audioData.channels,
          audioData.sampleRate,
          config.mp3Kbps,
          (progress) => {
            setProgressPercent(70 + Math.round((progress / 100) * 25));
          },
          (worker) => {
            activeWorkerRef.current = worker;
          }
        );
      } else {
        qualityChosen = config.wavSampleRate === 'original' 
          ? `${audioData.sampleRate} Hz` 
          : `${config.wavSampleRate} Hz`;

        outputBlob = await encodeWavBuffer(
          audioData.leftChannel,
          audioData.rightChannel,
          audioData.channels,
          audioData.sampleRate,
          {
            sampleRateSetting: config.wavSampleRate,
            channelsSetting: config.wavChannels
          },
          (progress) => {
            setProgressPercent(70 + Math.round((progress / 100) * 25));
          }
        );
      }

      if (isCancelledRef.current) throw new Error("Cancelado pelo usuário");

      setProgressStage("Preparando arquivo para download...");
      setProgressPercent(98);

      const blobUrl = URL.createObjectURL(outputBlob);
      const originalBaseName = selectedFile.name.replace(/\.[^/.]+$/, "");
      const outputFileName = `${originalBaseName}-audio.${config.format}`;

      setConversionResult({
        outputFileName,
        outputBlobUrl: blobUrl,
        outputBlob,
        format: config.format,
        originalSize: selectedFile.size,
        finalSize: outputBlob.size,
        duration: audioData.duration,
        qualityChosen
      });

      setProgressPercent(100);
      setProgressStage("Concluído");
    } catch (err: any) {
      if (err.message !== "Cancelado pelo usuário" && err.message !== "Operação cancelada pelo usuário.") {
        alert("Erro na conversão: " + err.message);
      }
    } finally {
      setIsConverting(false);
      activeWorkerRef.current = null;
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    if (activeWorkerRef.current) {
      activeWorkerRef.current.terminate();
      activeWorkerRef.current = null;
    }
    setIsConverting(false);
    setProgressPercent(0);
    setProgressStage("");
  };

  const handleReset = () => {
    cleanupMemory();
    setSelectedFile(null);
    setVideoMetadata(null);
    setConversionResult(null);
    setConfig(prev => ({ ...prev, hasAcceptedTerms: false }));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 md:py-12 space-y-8">
      {/* Header & Toggle Options */}
      <div className="space-y-6">
        {/* Toggle Cards / Bar */}
        {onNavigateTab && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {/* Audio Converter Card Option */}
            <button
              type="button"
              onClick={() => onNavigateTab("audio")}
              className="p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 bg-card-inner border-border-main text-text-sec hover:border-green-primary/50 hover:text-text-main text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-card-main border border-border-main text-green-primary group-hover:scale-105 transition-transform">
                  <FileAudio className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-text-main group-hover:text-green-light">CONVERSOR DE ÁUDIO</h4>
                  <p className="text-[11px] text-text-sec font-medium">Arquivos de áudio para MP3, WAV, AAC, etc.</p>
                </div>
              </div>
            </button>

            {/* Video to Audio Card Option (ACTIVE) */}
            <div className="p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 bg-green-primary border-green-primary text-bg-main shadow-lg shadow-green-primary/20 text-left relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-bg-main text-green-primary border border-green-primary/30 shrink-0">
                  <Film className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-extrabold text-sm text-bg-main">VÍDEO PARA ÁUDIO</h4>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-bg-main text-green-primary px-2 py-0.5 rounded-full">ATIVO</span>
                  </div>
                  <p className="text-[11px] text-bg-main/80 font-bold">Extraia áudio de vídeos no computador</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Title & Subtitle */}
        <div className="text-center space-y-2 max-w-2xl mx-auto pt-2">
          <h1 className="text-2xl md:text-3xl font-black text-text-main font-display uppercase tracking-tight">
            CONVERSOR DE VÍDEO PARA ÁUDIO
          </h1>
          <p className="text-xs md:text-sm text-text-sec font-semibold leading-relaxed">
            Extraia o áudio de vídeos MP4, MOV, M4V e WebM para MP3 ou WAV diretamente no navegador.
          </p>
        </div>

        {/* Card de Destaque Horizontal com Benefícios */}
        <div className="bg-card-main border border-border-main rounded-[24px] p-6 md:p-8 space-y-4 shadow-xl max-w-3xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-main pb-4">
            <div className="space-y-1">
              <h2 className="font-extrabold text-base md:text-lg text-text-main flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-green-primary" />
                Extraia o áudio com processamento 100% local
              </h2>
              <p className="text-xs text-text-sec font-medium">
                Transforme vídeos do seu computador em arquivos MP3 ou WAV com alta qualidade, sem enviar nada para servidores.
              </p>
            </div>
          </div>

          {/* Benefícios visíveis */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-1 text-xs">
            <div className="flex items-center gap-2 bg-card-inner border border-border-main px-3 py-2 rounded-xl text-text-sec font-semibold">
              <ShieldCheck className="h-4 w-4 text-green-primary shrink-0" />
              <span>MP4, MOV, M4V e WebM</span>
            </div>
            <div className="flex items-center gap-2 bg-card-inner border border-border-main px-3 py-2 rounded-xl text-text-sec font-semibold">
              <FileAudio className="h-4 w-4 text-green-primary shrink-0" />
              <span>Saída MP3 ou WAV</span>
            </div>
            <div className="flex items-center gap-2 bg-card-inner border border-border-main px-3 py-2 rounded-xl text-text-sec font-semibold">
              <Monitor className="h-4 w-4 text-green-primary shrink-0" />
              <span>Processamento no navegador</span>
            </div>
            <div className="flex items-center gap-2 bg-card-inner border border-border-main px-3 py-2 rounded-xl text-text-sec font-semibold">
              <Film className="h-4 w-4 text-green-primary shrink-0" />
              <span>Arquivos grandes no PC</span>
            </div>
            <div className="flex items-center gap-2 bg-card-inner border border-border-main px-3 py-2 rounded-xl text-text-sec font-semibold col-span-1 sm:col-span-2 md:col-span-2">
              <ShieldCheck className="h-4 w-4 text-green-primary shrink-0" />
              <span>Sem armazenamento nem upload em servidores</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Notice Overlay/Banner */}
      {isMobileDevice ? (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-[24px] p-6 text-center space-y-4 max-w-lg mx-auto shadow-xl">
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl w-fit mx-auto border border-amber-500/30">
            <Monitor className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h3 className="font-extrabold text-lg text-amber-400">
              Ferramenta Exclusiva para Computador
            </h3>
            <p className="text-xs md:text-sm text-text-main leading-relaxed font-medium">
              Esta ferramenta foi desenvolvida para computadores. Para converter vídeos grandes com estabilidade e velocidade, utilize um PC ou notebook.
            </p>
          </div>
        </div>
      ) : (
        /* Main Desktop Workflow */
        <div className="space-y-8">
          {/* Step 1: Dropzone when no file selected */}
          {!selectedFile && !isConverting && !conversionResult && (
            <VideoDropzone onFileSelect={handleFileSelect} disabled={isAnalyzing} />
          )}

          {/* Loading analysis state */}
          {isAnalyzing && (
            <div className="bg-card-main border border-border-main rounded-[24px] p-8 text-center space-y-4 max-w-md mx-auto">
              <div className="p-3 bg-green-primary/10 text-green-primary rounded-2xl w-fit mx-auto animate-spin">
                <Film className="h-8 w-8" />
              </div>
              <p className="font-bold text-text-main text-sm">Analisando faixa de áudio e metadados do vídeo...</p>
            </div>
          )}

          {/* Analysis Error */}
          {analysisError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-center space-y-3 max-w-lg mx-auto text-red-400">
              <p className="text-xs md:text-sm font-bold">{analysisError}</p>
              <button
                type="button"
                onClick={handleReset}
                className="py-2 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-xs font-bold cursor-pointer transition-all"
              >
                Tentar Outro Arquivo
              </button>
            </div>
          )}

          {/* Step 2: Settings & Metadata view */}
          {selectedFile && videoMetadata && !isConverting && !conversionResult && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <div className="md:col-span-6 space-y-6">
                <VideoInfo metadata={videoMetadata} />
                <VideoPreview file={selectedFile} />
              </div>

              <div className="md:col-span-6 space-y-6">
                <VideoOutputSettings
                  config={config}
                  onChange={setConfig}
                  onStartConversion={handleStartConversion}
                />

                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="text-xs text-text-sec hover:text-text-main underline cursor-pointer"
                  >
                    Trocar arquivo de vídeo
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Converting progress */}
          {isConverting && (
            <VideoConversionProgress
              stage={progressStage}
              progress={progressPercent}
              onCancel={handleCancel}
            />
          )}

          {/* Step 4: Result */}
          {conversionResult && (
            <VideoConversionResult
              result={conversionResult}
              onReset={handleReset}
            />
          )}

          {/* Privacy Guarantee Footer */}
          <div className="bg-card-main/40 border border-border-main/50 rounded-2xl p-4 text-center space-y-1 max-w-2xl mx-auto">
            <p className="text-xs text-text-sec flex items-center justify-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-primary shrink-0" />
              <span>Seu vídeo é processado diretamente no navegador do seu computador. O arquivo não é enviado nem armazenado em nossos servidores.</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
