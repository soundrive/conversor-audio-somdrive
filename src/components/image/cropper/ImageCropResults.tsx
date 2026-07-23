import React from "react";
import { CropProcessResult } from "../../../services/image/imageCropService";
import { Download, CheckCircle2, FileCheck, ArrowRight, RefreshCw, Layers } from "lucide-react";

interface ImageCropResultsProps {
  results: CropProcessResult[];
  onReset: () => void;
  onDownloadSingle: (item: CropProcessResult) => void;
  onDownloadZip: () => void;
}

export default function ImageCropResults({
  results,
  onReset,
  onDownloadSingle,
  onDownloadZip
}: ImageCropResultsProps) {
  const isPackage = results.length > 1;
  const single = results[0];

  return (
    <div className="bg-card-main border border-border-main p-6 md:p-8 rounded-[28px] space-y-6 shadow-md max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border-main pb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-primary/10 border border-green-primary/30 rounded-2xl text-green-primary">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-display text-xl font-extrabold text-text-main">
              {isPackage ? "Pacote de Cortes Concluído!" : "Imagem Recortada com Sucesso!"}
            </h3>
            <p className="text-xs text-text-sec font-semibold">
              {isPackage
                ? `${results.length} arquivos prontos para download.`
                : "Seu arquivo está pronto para baixar."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 rounded-xl bg-card-inner border border-border-main hover:border-green-primary/50 text-text-sec hover:text-green-light font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Cortar Outra Imagem</span>
        </button>
      </div>

      {/* Comparison: ANTES vs DEPOIS for Single Mode */}
      {!isPackage && single && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Output Image Preview */}
          <div className="bg-card-inner border border-border-main rounded-2xl p-4 flex flex-col items-center justify-center space-y-3">
            <div className="relative aspect-auto max-h-[300px] rounded-xl overflow-hidden bg-bg-main border border-border-main p-2 flex items-center justify-center">
              <img
                src={single.url}
                alt={single.filename}
                className="max-h-[280px] w-auto object-contain shadow-md rounded"
              />
            </div>
            <p className="text-xs font-bold text-text-main text-center truncate max-w-full">
              {single.filename}
            </p>
          </div>

          {/* Stats & Download */}
          <div className="bg-card-inner border border-border-main rounded-2xl p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <h4 className="font-extrabold text-sm text-text-main uppercase tracking-wider border-b border-border-main pb-2">
                Comparativo de Resolução
              </h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-card-main border border-border-main rounded-xl">
                  <span className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider block">
                    Antes:
                  </span>
                  <p className="text-sm font-mono font-extrabold text-text-main mt-0.5">
                    {single.originalWidth} × {single.originalHeight} px
                  </p>
                  <p className="text-[11px] text-text-muted mt-1 font-semibold">
                    {(single.originalSize / 1024).toFixed(1)} KB
                  </p>
                </div>

                <div className="p-3 bg-card-main border border-green-primary/40 rounded-xl">
                  <span className="text-[10px] font-extrabold text-green-primary uppercase tracking-wider block">
                    Depois (Recortado):
                  </span>
                  <p className="text-sm font-mono font-extrabold text-green-light mt-0.5">
                    {single.width} × {single.height} px
                  </p>
                  <p className="text-[11px] text-text-muted mt-1 font-semibold">
                    {(single.newSize / 1024).toFixed(1)} KB ({single.format})
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDownloadSingle(single)}
              className="w-full py-3 px-6 rounded-2xl bg-green-primary hover:bg-green-light text-bg-main font-extrabold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="h-5 w-5 stroke-[3]" />
              <span>Baixar Imagem Recortada</span>
            </button>
          </div>
        </div>
      )}

      {/* Package Mode Results List */}
      {isPackage && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-extrabold text-sm text-text-main">
              Arquivos Gerados no Pacote:
            </h4>
            <button
              type="button"
              onClick={onDownloadZip}
              className="px-5 py-2.5 rounded-xl bg-green-primary hover:bg-green-light text-bg-main font-extrabold text-xs transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Download className="h-4 w-4 stroke-[3]" />
              <span>Baixar Todos em ZIP</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {results.map((item) => (
              <div
                key={item.id}
                className="bg-card-inner border border-border-main p-3 rounded-xl flex items-center justify-between gap-3 hover:border-green-primary/40 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={item.url}
                    alt={item.filename}
                    className="w-12 h-12 rounded-lg object-cover bg-bg-main border border-border-main shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-text-main truncate">
                      {item.presetName || item.filename}
                    </p>
                    <p className="text-[10px] text-text-muted font-mono mt-0.5">
                      {item.width} × {item.height} px • {(item.newSize / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onDownloadSingle(item)}
                  className="p-2 rounded-lg bg-card-main border border-border-main hover:border-green-primary text-text-sec hover:text-green-light transition-all cursor-pointer shrink-0"
                  title="Baixar arquivo"
                >
                  <Download className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
