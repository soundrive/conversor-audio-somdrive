/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Film, Clock, FileText, Monitor, Volume2, HardDrive } from "lucide-react";
import { VideoMetadata } from "../../services/video/videoAnalyzer";

interface VideoInfoProps {
  metadata: VideoMetadata;
}

export default function VideoInfo({ metadata }: VideoInfoProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "--:--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-card-main border border-border-main rounded-[20px] p-5 md:p-6 space-y-4">
      <div className="flex items-center gap-3 border-b border-border-main pb-3">
        <div className="p-2 bg-green-primary/10 border border-green-primary/20 text-green-primary rounded-xl">
          <Film className="h-5 w-5" />
        </div>
        <div className="overflow-hidden">
          <h4 className="font-bold text-text-main text-sm md:text-base truncate" title={metadata.name}>
            {metadata.name}
          </h4>
          <p className="text-xs text-text-sec">Vídeo selecionado para extração</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs md:text-sm">
        <div className="bg-card-inner border border-border-main/60 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-text-sec text-[11px]">
            <FileText className="h-3.5 w-3.5 text-green-primary" />
            <span>Formato</span>
          </div>
          <p className="font-bold text-text-main">{metadata.format}</p>
        </div>

        <div className="bg-card-inner border border-border-main/60 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-text-sec text-[11px]">
            <HardDrive className="h-3.5 w-3.5 text-green-primary" />
            <span>Tamanho</span>
          </div>
          <p className="font-bold text-text-main">{formatBytes(metadata.size)}</p>
        </div>

        <div className="bg-card-inner border border-border-main/60 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-text-sec text-[11px]">
            <Clock className="h-3.5 w-3.5 text-green-primary" />
            <span>Duração</span>
          </div>
          <p className="font-bold text-text-main">{formatDuration(metadata.duration)}</p>
        </div>

        <div className="bg-card-inner border border-border-main/60 rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-text-sec text-[11px]">
            <Monitor className="h-3.5 w-3.5 text-green-primary" />
            <span>Resolução</span>
          </div>
          <p className="font-bold text-text-main">
            {metadata.width && metadata.height ? `${metadata.width}x${metadata.height}` : 'N/D'}
          </p>
        </div>

        <div className="bg-card-inner border border-border-main/60 rounded-xl p-3 space-y-1 col-span-2 md:col-span-2">
          <div className="flex items-center gap-1.5 text-text-sec text-[11px]">
            <Volume2 className="h-3.5 w-3.5 text-green-primary" />
            <span>Faixa de Áudio Detectada</span>
          </div>
          <p className="font-bold text-text-main flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Detectada (AAC/MP3/PCM) - Pronta para extração</span>
          </p>
        </div>
      </div>
    </div>
  );
}
