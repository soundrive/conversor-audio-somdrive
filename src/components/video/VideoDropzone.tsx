/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from "react";
import { Film, Upload, AlertCircle } from "lucide-react";

interface VideoDropzoneProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export default function VideoDropzone({ onFileSelect, disabled = false }: VideoDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const validateAndSelect = (file: File) => {
    setErrorMessage(null);
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    const allowed = ["mp4", "mov", "m4v", "webm"];

    if (!allowed.includes(ext)) {
      setErrorMessage("Formato não suportado. Por favor, selecione um arquivo MP4, MOV, M4V ou WebM.");
      return;
    }

    if (file.size > 1024 * 1024 * 1024) {
      setErrorMessage("O arquivo selecionado excede o limite de 1 GB para conversão no computador.");
      return;
    }

    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full space-y-4">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-[24px] p-8 md:p-12 text-center transition-all cursor-pointer ${
          dragActive
            ? "border-green-primary bg-green-primary/10 scale-[1.01]"
            : "border-border-main hover:border-green-primary/50 bg-card-main/60 hover:bg-card-main/80"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v,.webm"
          className="hidden"
          onChange={handleChange}
          disabled={disabled}
        />

        <div className="max-w-md mx-auto space-y-4 pointer-events-none">
          <div className="p-4 bg-green-primary/10 border border-green-primary/20 text-green-primary rounded-2xl w-fit mx-auto shadow-inner">
            <Film className="h-10 w-10" />
          </div>

          <div className="space-y-2">
            <h3 className="text-lg md:text-xl font-bold text-text-main font-display">
              Selecione ou arraste seu arquivo de vídeo
            </h3>
            <p className="text-xs md:text-sm text-text-sec font-medium">
              Transforme o áudio do seu vídeo em MP3 ou WAV diretamente no seu navegador.
            </p>
          </div>

          <div className="pt-2">
            <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-primary hover:bg-green-light text-bg-main font-extrabold text-xs md:text-sm rounded-xl transition-all shadow-lg shadow-green-primary/20">
              <Upload className="h-4 w-4" />
              <span>Escolher Vídeo no Computador</span>
            </span>
          </div>

          <div className="pt-3 border-t border-border-main/50 text-[12px] text-text-sec/80 flex flex-wrap justify-center gap-3">
            <span>Formatos aceitos: <strong className="text-text-main">MP4, MOV, M4V, WebM</strong></span>
            <span>•</span>
            <span>Limite máximo: <strong className="text-text-main">Até 1 GB</strong></span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-xs md:text-sm font-medium flex items-center gap-3 animate-fadeIn">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
