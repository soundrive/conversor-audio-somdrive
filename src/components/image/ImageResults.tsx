import React, { useState } from "react";
import { Download, FileArchive, CheckCircle2, RotateCcw, AlertCircle, Loader2 } from "lucide-react";
import { ImageItem } from "../../services/image/imageConverterService";
import { formatBytes } from "./ImageFileList";
import { createZipArchive, triggerDownload } from "../../utils/downloadZip";

interface ImageResultsProps {
  items: ImageItem[];
  onDownloadSingle: (item: ImageItem) => void;
  onZipDownload: () => void;
  onReset: () => void;
}

export default function ImageResults({
  items,
  onDownloadSingle,
  onZipDownload,
  onReset
}: ImageResultsProps) {
  const completedItems = items.filter((item) => item.status === "concluida" && item.convertedBlob);
  const failedItems = items.filter((item) => item.status === "falhou");
  const [isZipping, setIsZipping] = useState(false);

  if (completedItems.length === 0 && failedItems.length === 0) return null;

  const handleDownloadZipAll = async () => {
    if (completedItems.length === 0) return;
    setIsZipping(true);
    try {
      onZipDownload(); // Trigger GA4 analytics event

      const zipFiles = await Promise.all(
        completedItems.map(async (item) => {
          const arrayBuffer = await item.convertedBlob!.arrayBuffer();
          return {
            filename: item.convertedFileName || `${item.name}-convertido.png`,
            data: new Uint8Array(arrayBuffer)
          };
        })
      );

      const zipBlob = createZipArchive(zipFiles);
      triggerDownload(zipBlob, "imagens-convertidas.zip");
    } catch (err) {
      console.error("Erro ao gerar arquivo ZIP:", err);
      alert("Falha ao criar o arquivo ZIP. Tente baixar as imagens individualmente.");
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="bg-card-inner rounded-3xl border border-emerald-500/30 p-6 md:p-8 space-y-6">
      {/* Success Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-border-main/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-950/50 rounded-2xl border border-emerald-800/50 text-emerald-400 shrink-0">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-extrabold text-base md:text-lg text-text-main">
              Conversão Concluída!
            </h3>
            <p className="text-xs text-text-muted font-semibold mt-0.5">
              {completedItems.length} {completedItems.length === 1 ? "imagem convertida com sucesso" : "imagens convertidas com sucesso"}
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
            <span>Converter Mais Imagens</span>
          </button>
        </div>
      </div>

      {/* Grid of Results */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {completedItems.map((item) => (
          <div
            key={item.id}
            className="bg-bg-sec rounded-2xl border border-border-main p-3.5 flex flex-col justify-between space-y-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-14 h-14 bg-card-inner rounded-xl border border-border-main overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                {item.convertedBlobUrl ? (
                  <img
                    src={item.convertedBlobUrl}
                    alt={item.convertedFileName}
                    className="w-full h-full object-cover rounded-lg"
                  />
                ) : (
                  <span className="text-[10px] font-bold text-text-muted uppercase">{item.outputFormat}</span>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <h5 className="font-bold text-xs text-text-main truncate" title={item.convertedFileName}>
                  {item.convertedFileName}
                </h5>

                <div className="text-[11px] text-text-muted space-y-0.5 font-semibold">
                  <p>
                    Formato: <span className="text-text-sec font-bold">{item.originalFormat}</span> → <span className="text-green-primary font-bold">{item.outputFormat}</span>
                  </p>
                  <p>
                    Tamanho: {formatBytes(item.originalSize)} → <span className="text-emerald-400 font-bold">{formatBytes(item.convertedSize || 0)}</span>
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onDownloadSingle(item)}
              className="w-full py-2 px-3 bg-green-primary hover:bg-green-dark text-white rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Baixar Imagem</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
