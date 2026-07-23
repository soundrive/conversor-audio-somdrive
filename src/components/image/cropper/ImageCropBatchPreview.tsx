import React from "react";
import { CropProcessResult } from "../../../services/image/imageCropService";
import { CropPreset, FocalPoint, CropRegion } from "../../../utils/imageCropPresets";
import { isFocalPointNearEdge } from "../../../utils/imageCropCalculations";
import { Download, AlertTriangle, Edit3, Check, Layers, ExternalLink } from "lucide-react";

interface ImageCropBatchPreviewProps {
  results: CropProcessResult[];
  focalPoint: FocalPoint | null;
  imgWidth: number;
  imgHeight: number;
  onEditPreset: (presetId: string) => void;
  onDownloadSingle: (item: CropProcessResult) => void;
  onDownloadZip: () => void;
  isProcessing?: boolean;
}

export default function ImageCropBatchPreview({
  results,
  focalPoint,
  imgWidth,
  imgHeight,
  onEditPreset,
  onDownloadSingle,
  onDownloadZip,
  isProcessing = false
}: ImageCropBatchPreviewProps) {
  return (
    <div className="bg-card-main border border-border-main p-6 rounded-[28px] space-y-6 shadow-sm">
      
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-border-main pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-green-primary/10 border border-green-primary/30 text-green-primary">
              <Layers className="h-5 w-5" />
            </span>
            <h3 className="font-display text-xl font-extrabold text-text-main">
              Prévia do Pacote de Cortes ({results.length} formatos)
            </h3>
          </div>
          <p className="text-xs text-text-sec mt-1 font-semibold">
            Confira e baixe individualmente ou selecione o arquivo completo em ZIP.
          </p>
        </div>

        <button
          type="button"
          onClick={onDownloadZip}
          disabled={isProcessing || results.length === 0}
          className="px-5 py-2.5 rounded-2xl bg-green-primary hover:bg-green-light text-bg-main font-extrabold text-xs transition-all shadow-md hover:shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Download className="h-4 w-4 stroke-[3]" />
          <span>Baixar Pacote em ZIP</span>
        </button>
      </div>

      {/* Grid of Generated Crops */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {results.map((item) => {
          return (
            <div
              key={item.id}
              className="bg-card-inner border border-border-main rounded-2xl p-3 flex flex-col justify-between hover:border-green-primary/40 transition-all space-y-3 group"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-square rounded-xl bg-bg-main border border-border-main/80 overflow-hidden flex items-center justify-center p-2">
                <img
                  src={item.url}
                  alt={item.filename}
                  className="max-w-full max-h-full object-contain shadow-md rounded"
                />

                <span className="absolute top-2 left-2 bg-bg-main/90 border border-border-main text-text-main text-[9px] font-mono font-extrabold px-2 py-0.5 rounded-full shadow">
                  {item.width} × {item.height} px
                </span>
              </div>

              {/* Information */}
              <div>
                <h4 className="font-extrabold text-xs text-text-main truncate">
                  {item.presetName || item.filename}
                </h4>
                <div className="flex items-center justify-between text-[10px] text-text-muted mt-1 font-semibold">
                  <span>{(item.newSize / 1024).toFixed(1)} KB</span>
                  <span className="font-mono uppercase font-bold text-green-primary">{item.format}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-border-main flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onDownloadSingle(item)}
                  className="flex-1 py-1.5 px-2 rounded-xl bg-card-main border border-border-main hover:border-green-primary/50 text-text-sec hover:text-green-light text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Baixar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
