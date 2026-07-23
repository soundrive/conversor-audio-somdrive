import React from "react";
import { Loader2, XCircle, CheckCircle2, AlertCircle } from "lucide-react";

interface ImageResizerProgressProps {
  currentIndex: number;
  totalCount: number;
  successCount: number;
  failedCount: number;
  onCancel: () => void;
}

export default function ImageResizerProgress({
  currentIndex,
  totalCount,
  successCount,
  failedCount,
  onCancel
}: ImageResizerProgressProps) {
  const percentage = totalCount > 0 ? Math.round((currentIndex / totalCount) * 100) : 0;

  return (
    <div className="bg-card-inner rounded-2xl border border-green-primary/40 p-5 space-y-4 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Loader2 className="h-5 w-5 text-green-primary animate-spin shrink-0" />
          <div>
            <h4 className="font-extrabold text-sm text-text-main">
              Redimensionando imagem {Math.min(currentIndex + 1, totalCount)} de {totalCount}
            </h4>
            <div className="flex items-center gap-3 text-[11px] text-text-muted font-semibold mt-0.5">
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                {successCount} {successCount === 1 ? "sucesso" : "sucessos"}
              </span>
              {failedCount > 0 && (
                <span className="flex items-center gap-1 text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  {failedCount} {failedCount === 1 ? "falha" : "falhas"}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="py-2 px-4 bg-red-950/40 hover:bg-red-950/70 text-red-300 border border-red-800/50 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <XCircle className="h-4 w-4" />
          <span>CANCELAR</span>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full bg-bg-sec rounded-full h-3 overflow-hidden border border-border-main p-0.5">
          <div
            className="bg-green-primary h-full rounded-full transition-all duration-300 shadow-sm"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-text-muted font-bold">
          <span>{percentage}% concluído</span>
          <span>{totalCount - currentIndex} restantes</span>
        </div>
      </div>
    </div>
  );
}
