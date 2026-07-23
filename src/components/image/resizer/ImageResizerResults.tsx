import React, { useState } from "react";
import { Download, FileArchive, CheckCircle2, RotateCcw, Loader2 } from "lucide-react";
import { ResizedImageItem } from "../../../services/image/imageResizeService";
import { formatBytes } from "../ImageFileList";
import { createZipArchive, triggerDownload } from "../../../utils/downloadZip";

interface ImageResizerResultsProps {
  items: ResizedImageItem[];
  onDownloadSingle: (item: ResizedImageItem) => void;
  onZipDownload: () => void;
  onReset: () => void;
}

export default function ImageResizerResults({
  items,
  onDownloadSingle,
  onZipDownload,
  onReset
}: ImageResizerResultsProps) {
  const completedItems = items.filter((item) => item.status === "concluida" && item.resizedBlob);
  const failedItems = items.filter((item) => item.status === "falhou");
  const [isZipping, setIsZipping] = useState(false);

  if (completedItems.length === 0 && failedItems.length === 0) return null;

  const handleDownloadZipAll = async () => {
    if (completedItems.length === 0) return;
    setIsZipping(true);
    try {
      onZipDownload();

      const zipFiles = await Promise.all(
        completedItems.map(async (item) => {
          const arrayBuffer = await item.resizedBlob!.arrayBuffer();
          return {
            filename: item.resizedFileName || `${item.name}-redimensionado.jpg`,
            data: new Uint8Array(arrayBuffer)
          };
        })
      );

      const zipBlob = createZipArchive(zipFiles);
      triggerDownload(zipBlob, "imagens-redimensionadas.zip");
    } catch (err) {
      console.error("Erro ao gerar arquivo ZIP:", err);
      alert("Falha ao criar o arquivo ZIP. Tente baixar as imagens individualmente.");
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="bg-card-inner rounded-3xl border border-emerald-500/30 p-6 md:p-8 space-y-6">
      {/* Banner Summary */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-main/60 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-950/50 rounded-2xl border border-emerald-800/50 text-emerald-400 shrink-0">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-base md:text-lg text-text-main">
              Redimensionamento Concluído!
            </h3>
            <p className="text-xs text-text-muted font-semibold">
              {completedItems.length} {completedItems.length === 1 ? "imagem processada" : "imagens processadas"}
              {failedItems.length > 0 && ` (${failedItems.length} falhas)`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {completedItems.length > 1 && (
            <button
              type="button"
              disabled={isZipping}
              onClick={handleDownloadZipAll}
              className="w-full sm:w-auto py-3 px-5 bg-green-primary hover:bg-green-dark text-white rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-950/20 active:scale-[0.98]"
            >
              {isZipping ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Gerando ZIP…</span>
                </>
              ) : (
                <>
                  <FileArchive className="h-4 w-4" />
                  <span>BAIXAR TODAS EM ZIP</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onReset}
            className="w-full sm:w-auto py-3 px-4 bg-bg-sec hover:bg-bg-main text-text-sec hover:text-text-main border border-border-main rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="h-4 w-4 text-green-primary" />
            <span>Redimensionar Mais Imagens</span>
          </button>
        </div>
      </div>

      {/* Grid of Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {completedItems.map((item) => (
          <div
            key={item.id}
            className="bg-bg-sec rounded-2xl border border-border-main p-4 flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 bg-card-inner rounded-xl border border-border-main overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                  {item.resizedBlobUrl ? (
                    <img
                      src={item.resizedBlobUrl}
                      alt={item.resizedFileName}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-text-muted uppercase">{item.originalFormat}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                  <h5 className="font-bold text-xs md:text-sm text-text-main truncate" title={item.resizedFileName}>
                    {item.resizedFileName}
                  </h5>
                  <span className="bg-card-inner px-2 py-0.5 rounded-md border border-border-main/50 uppercase font-bold text-[10px] text-text-sec inline-block">
                    {item.originalFormat}
                  </span>
                </div>
              </div>

              {/* Before / After Metrics Table */}
              <div className="bg-card-inner/60 p-3 rounded-xl border border-border-main/50 text-[11px] space-y-1.5 font-semibold">
                <div className="flex justify-between items-center text-text-muted">
                  <span>ANTES:</span>
                  <span className="text-text-sec font-bold">
                    {item.origWidth} × {item.origHeight} px ({formatBytes(item.originalSize)})
                  </span>
                </div>

                <div className="flex justify-between items-center text-text-muted">
                  <span>DEPOIS:</span>
                  <span className="text-emerald-400 font-extrabold">
                    {item.finalWidth} × {item.finalHeight} px ({formatBytes(item.resizedSize || 0)})
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDownloadSingle(item)}
              className="w-full py-2.5 px-3 bg-green-primary hover:bg-green-dark text-white rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Baixar Imagem Redimensionada</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
