/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { Loader2, XCircle, Clock } from "lucide-react";

interface VideoConversionProgressProps {
  stage: string;
  progress: number; // 0 to 100
  onCancel: () => void;
}

export default function VideoConversionProgress({
  stage,
  progress,
  onCancel
}: VideoConversionProgressProps) {
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-card-main border border-border-main rounded-[24px] p-6 md:p-8 space-y-6 max-w-xl mx-auto shadow-2xl">
      <div className="flex items-center justify-between border-b border-border-main pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-primary/10 border border-green-primary/20 text-green-primary rounded-2xl animate-spin">
            <Loader2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-text-main text-base md:text-lg font-display">
              Extraindo Áudio do Vídeo
            </h3>
            <p className="text-xs text-text-sec font-medium">Processamento local no seu navegador</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-card-inner border border-border-main text-text-sec rounded-xl font-mono text-xs">
          <Clock className="h-3.5 w-3.5 text-green-primary" />
          <span>{formatSeconds(secondsElapsed)}</span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center text-xs md:text-sm font-bold">
          <span className="text-green-primary flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-primary animate-ping"></span>
            <span>{stage || "Processando..."}</span>
          </span>
          <span className="text-text-main font-mono">{Math.round(progress)}%</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-card-inner border border-border-main rounded-full h-3 overflow-hidden p-0.5">
          <div
            className="bg-gradient-to-r from-emerald-500 to-green-primary h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${Math.max(5, Math.min(100, progress))}%` }}
          ></div>
        </div>
      </div>

      <div className="pt-2 flex justify-center">
        <button
          type="button"
          onClick={onCancel}
          className="py-2.5 px-5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer"
        >
          <XCircle className="h-4 w-4" />
          <span>Cancelar Conversão</span>
        </button>
      </div>
    </div>
  );
}
