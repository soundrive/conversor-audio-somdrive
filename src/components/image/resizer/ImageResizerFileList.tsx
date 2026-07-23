import React from "react";
import { Trash2, Download, CheckCircle2, AlertCircle, Clock, Loader2, Plus, XCircle } from "lucide-react";
import { ResizedImageItem } from "../../../services/image/imageResizeService";
import { formatBytes } from "../ImageFileList";

interface ImageResizerFileListProps {
  items: ResizedImageItem[];
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onAddMoreClick: () => void;
  onDownloadSingle: (item: ResizedImageItem) => void;
  isResizing: boolean;
}

export default function ImageResizerFileList({
  items,
  onRemoveItem,
  onClearAll,
  onAddMoreClick,
  onDownloadSingle,
  isResizing
}: ImageResizerFileListProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-bg-sec/80 px-4 py-3 rounded-2xl border border-border-main">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-xs text-text-main">
            {items.length} {items.length === 1 ? "imagem selecionada" : "imagens selecionadas"}
          </span>
          <span className="text-[11px] text-text-muted font-medium">
            ({formatBytes(items.reduce((acc, curr) => acc + curr.originalSize, 0))})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isResizing && (
            <button
              type="button"
              onClick={onAddMoreClick}
              className="py-1.5 px-3 bg-card-inner hover:bg-card-main text-text-sec hover:text-text-main rounded-xl text-xs font-bold transition-all border border-border-main flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-green-primary" />
              <span>Adicionar mais</span>
            </button>
          )}

          {!isResizing && (
            <button
              type="button"
              onClick={onClearAll}
              className="py-1.5 px-3 bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 rounded-xl text-xs font-bold transition-all border border-red-900/30 flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Limpar todas</span>
            </button>
          )}
        </div>
      </div>

      {/* File List */}
      <div className="space-y-2.5 max-h-[480px] overflow-y-auto pr-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="bg-card-inner rounded-2xl border border-border-main p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-border-main/80 transition-all"
          >
            {/* Thumbnail & Info */}
            <div className="flex items-center gap-3.5 min-w-0 w-full sm:w-auto flex-1">
              <div className="w-14 h-14 bg-bg-sec rounded-xl border border-border-main overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt={item.name}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-text-muted uppercase">{item.originalFormat}</span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <h5 className="font-bold text-xs md:text-sm text-text-main truncate" title={item.name}>
                  {item.name}
                </h5>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted font-semibold">
                  <span className="bg-bg-sec px-2 py-0.5 rounded-md border border-border-main/50 uppercase font-bold text-[10px] text-text-sec">
                    {item.originalFormat}
                  </span>

                  {item.origWidth && item.origHeight && (
                    <span>
                      {item.origWidth} × {item.origHeight} px
                    </span>
                  )}

                  <span>{formatBytes(item.originalSize)}</span>

                  {item.finalWidth && item.finalHeight && (
                    <span className="text-green-primary font-bold">
                      → {item.finalWidth} × {item.finalHeight} px
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Status & Actions */}
            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t sm:border-t-0 border-border-main/40 pt-2 sm:pt-0 shrink-0">
              <div className="flex items-center gap-1.5">
                {item.status === "aguardando" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-text-muted bg-bg-sec px-2.5 py-1 rounded-full border border-border-main">
                    <Clock className="h-3 w-3" />
                    Aguardando
                  </span>
                )}

                {item.status === "redimensionando" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-primary bg-green-primary/10 px-2.5 py-1 rounded-full border border-green-primary/30 animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Redimensionando…
                  </span>
                )}

                {item.status === "concluida" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-800/40">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    Concluída
                  </span>
                )}

                {item.status === "falhou" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-950/40 px-2.5 py-1 rounded-full border border-red-800/40" title={item.errorMessage || "Erro"}>
                    <AlertCircle className="h-3 w-3 text-red-400" />
                    Falhou
                  </span>
                )}

                {item.status === "cancelada" && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/40 px-2.5 py-1 rounded-full border border-amber-800/40">
                    <XCircle className="h-3 w-3 text-amber-400" />
                    Cancelada
                  </span>
                )}
              </div>

              {item.status === "concluida" && item.resizedBlobUrl && (
                <button
                  type="button"
                  onClick={() => onDownloadSingle(item)}
                  className="py-1.5 px-3 bg-green-primary hover:bg-green-dark text-white rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-950/20"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Baixar</span>
                </button>
              )}

              {!isResizing && (
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.id)}
                  className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-all cursor-pointer"
                  title="Remover imagem"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
