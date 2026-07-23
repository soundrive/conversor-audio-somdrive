import React, { useState, useRef, useEffect } from "react";
import { Sliders, Sparkles, ShieldCheck, ArrowRight, Play } from "lucide-react";
import ImageToolSwitcher from "../../components/image/ImageToolSwitcher";
import ImageCompressorUpload from "../../components/image/compressor/ImageCompressorUpload";
import ImageCompressorSettings, { CompressorSettingsState } from "../../components/image/compressor/ImageCompressorSettings";
import ImageCompressorFileList from "../../components/image/compressor/ImageCompressorFileList";
import ImageCompressorProgress from "../../components/image/compressor/ImageCompressorProgress";
import ImageCompressorResults from "../../components/image/compressor/ImageCompressorResults";
import {
  CompressedImageItem,
  prepareCompressorItem,
  compressSingleImage
} from "../../services/image/imageCompressorService";
import { trackEvent } from "../../lib/gtag";

interface ImageCompressorProps {
  onNavigate?: (path: string) => void;
}

export default function ImageCompressor({ onNavigate }: ImageCompressorProps) {
  const [items, setItems] = useState<CompressedImageItem[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const cancelRequestedRef = useRef(false);

  const [settings, setSettings] = useState<CompressorSettingsState>({
    preset: "alta",
    customQualityPercentage: 80
  });

  const currentTotalSize = items.reduce((acc, curr) => acc + curr.originalSize, 0);

  // Clean up Object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((i) => {
        if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
        if (i.compressedBlobUrl) URL.revokeObjectURL(i.compressedBlobUrl);
      });
    };
  }, []);

  const handleFilesSelected = async (files: File[]) => {
    setIsFinished(false);
    const newItems: CompressedImageItem[] = [];

    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const meta = await prepareCompressorItem(file);

      newItems.push({
        id,
        file,
        name: file.name,
        originalSize: file.size,
        originalFormat: meta.originalFormat || "IMG",
        width: meta.width,
        height: meta.height,
        previewUrl: meta.previewUrl,
        status: "aguardando",
        progress: 0,
        errorMessage: meta.errorMessage
      });
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.compressedBlobUrl) URL.revokeObjectURL(target.compressedBlobUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleClearAll = () => {
    items.forEach((i) => {
      if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
      if (i.compressedBlobUrl) URL.revokeObjectURL(i.compressedBlobUrl);
    });
    setItems([]);
    setIsFinished(false);
    setSuccessCount(0);
    setFailedCount(0);
  };

  const handleStartCompression = async () => {
    if (items.length === 0 || isCompressing) return;

    cancelRequestedRef.current = false;
    setIsCompressing(true);
    setIsFinished(false);
    setCurrentIndex(0);
    let succ = 0;
    let fail = 0;

    const inputFormatsList = Array.from(new Set(items.map((i) => i.originalFormat))).join(",");

    // GA4 Compression Started
    trackEvent("image_compression_started", {
      tool_name: "image_compressor",
      input_format: inputFormatsList,
      file_count: items.length,
      compression_level: settings.preset
    });

    for (let i = 0; i < items.length; i++) {
      if (cancelRequestedRef.current) {
        setItems((prev) =>
          prev.map((item, idx) =>
            idx >= i && item.status === "aguardando"
              ? { ...item, status: "cancelada" }
              : item
          )
        );
        break;
      }

      setCurrentIndex(i);

      setItems((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: "comprimindo" } : item))
      );

      const currentItem = items[i];

      try {
        const result = await compressSingleImage(currentItem, {
          preset: settings.preset,
          customQualityPercentage: settings.customQualityPercentage
        });

        succ++;
        setSuccessCount(succ);

        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: "concluida",
                  compressedBlob: result.compressedBlob,
                  compressedBlobUrl: result.compressedBlobUrl,
                  compressedSize: result.compressedSize,
                  savedBytes: result.savedBytes,
                  savedPercentage: result.savedPercentage,
                  isLargerThanOriginal: result.isLargerThanOriginal,
                  compressedFileName: result.compressedFileName,
                  usedPreset: settings.preset,
                  usedQuality: result.usedQuality,
                  width: result.width,
                  height: result.height
                }
              : item
          )
        );
      } catch (err: any) {
        fail++;
        setFailedCount(fail);

        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: "falhou",
                  errorMessage: err.message || "Erro durante a compressão da imagem."
                }
              : item
          )
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    setIsCompressing(false);
    setIsFinished(true);

    // GA4 Compression Completed / Failed
    if (succ > 0) {
      trackEvent("image_compression_completed", {
        tool_name: "image_compressor",
        input_format: inputFormatsList,
        file_count: items.length,
        compressed_count: succ,
        failed_count: fail,
        compression_level: settings.preset,
        success: true
      });
    } else {
      trackEvent("image_compression_failed", {
        tool_name: "image_compressor",
        input_format: inputFormatsList,
        file_count: items.length,
        compressed_count: 0,
        failed_count: fail,
        compression_level: settings.preset,
        success: false
      });
    }
  };

  const handleCancelCompression = () => {
    cancelRequestedRef.current = true;
  };

  const handleDownloadSingle = (item: CompressedImageItem) => {
    const blobToUse = (item.isLargerThanOriginal ? item.file : item.compressedBlob);
    const urlToUse = item.compressedBlobUrl;
    if (!urlToUse || !item.compressedFileName) return;

    trackEvent("image_compression_download_clicked", {
      tool_name: "image_compressor",
      input_format: item.originalFormat
    });

    const link = document.createElement("a");
    link.href = urlToUse;
    link.download = item.compressedFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZipDownloadTracking = () => {
    trackEvent("image_compression_zip_download_clicked", {
      tool_name: "image_compressor",
      file_count: successCount
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Tool Switcher */}
      <ImageToolSwitcher activeTool="comprimir" onNavigate={onNavigate} />

      {/* Title & Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Ferramentas de Imagem</span>
        </div>

        <h1 className="font-display text-2xl md:text-3xl font-extrabold text-text-main tracking-tight" id="image-compressor-h1">
          Compressor de Imagens Grátis
        </h1>

        <p className="text-xs md:text-sm text-text-sec font-semibold">
          Reduza o tamanho das suas imagens de forma rápida e escolha o nível de qualidade desejado.
        </p>

        <p className="text-xs text-text-muted font-semibold pt-0.5">
          Precisa alterar largura e altura?{" "}
          <button
            type="button"
            onClick={() => onNavigate?.("/imagem/redimensionar")}
            className="text-green-primary hover:underline font-bold cursor-pointer"
          >
            Use o Redimensionador de Imagens.
          </button>
        </p>

        <p className="text-[11px] text-emerald-400 font-bold flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck className="h-4 w-4" />
          <span>Seus arquivos não ficam salvos.</span>
        </p>
      </div>

      {/* Main Workspace */}
      <div className="space-y-6">
        {items.length === 0 && (
          <ImageCompressorUpload
            onFilesSelected={handleFilesSelected}
            currentCount={items.length}
            currentTotalSize={currentTotalSize}
          />
        )}

        {items.length > 0 && !isFinished && (
          <div className="space-y-6">
            <ImageCompressorSettings
              settings={settings}
              onChange={setSettings}
              disabled={isCompressing}
            />

            <ImageCompressorFileList
              items={items}
              onRemoveItem={handleRemoveItem}
              onClearAll={handleClearAll}
              onAddMoreClick={() => {
                const hiddenInput = document.createElement("input");
                hiddenInput.type = "file";
                hiddenInput.multiple = true;
                hiddenInput.accept = "image/jpeg,image/png,image/webp,image/avif,image/bmp,.jpg,.jpeg,.png,.webp,.avif,.bmp";
                hiddenInput.onchange = (e: any) => {
                  if (e.target.files) handleFilesSelected(Array.from(e.target.files));
                };
                hiddenInput.click();
              }}
              onDownloadSingle={handleDownloadSingle}
              isCompressing={isCompressing}
            />

            {!isCompressing && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleStartCompression}
                  className="w-full sm:w-auto min-w-[280px] py-4 px-8 bg-green-primary hover:bg-green-dark text-white rounded-2xl font-black text-sm md:text-base transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-emerald-950/30 active:scale-[0.98]"
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span>COMPRIMIR IMAGENS</span>
                </button>
              </div>
            )}
          </div>
        )}

        {isCompressing && (
          <ImageCompressorProgress
            currentIndex={currentIndex}
            totalCount={items.length}
            successCount={successCount}
            failedCount={failedCount}
            onCancel={handleCancelCompression}
          />
        )}

        {isFinished && (
          <ImageCompressorResults
            items={items}
            onDownloadSingle={handleDownloadSingle}
            onZipDownload={handleZipDownloadTracking}
            onReset={handleClearAll}
          />
        )}
      </div>

      {/* Internal Navigation Links */}
      <div className="bg-card-inner rounded-2xl border border-border-main p-5 space-y-3 mt-8">
        <h4 className="text-xs font-extrabold text-text-sec uppercase tracking-wider">
          Outras Ferramentas Recomendadas
        </h4>
        <div className="flex flex-wrap gap-2 text-xs font-bold text-green-primary">
          <button
            type="button"
            onClick={() => onNavigate?.("/imagem/redimensionar")}
            className="bg-bg-sec hover:bg-bg-main border border-border-main px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-text-main hover:text-green-light"
          >
            <span>Redimensionador de Imagens</span>
            <ArrowRight className="h-3.5 w-3.5 text-green-primary" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("/imagem/converter")}
            className="bg-bg-sec hover:bg-bg-main border border-border-main px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-text-main hover:text-green-light"
          >
            <span>Conversor de Imagens</span>
            <ArrowRight className="h-3.5 w-3.5 text-green-primary" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("/pdf/imagens-para-pdf")}
            className="bg-bg-sec hover:bg-bg-main border border-border-main px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-text-main hover:text-green-light"
          >
            <span>Imagens para PDF</span>
            <ArrowRight className="h-3.5 w-3.5 text-green-primary" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("/pdf/pdf-para-imagens")}
            className="bg-bg-sec hover:bg-bg-main border border-border-main px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-text-main hover:text-green-light"
          >
            <span>PDF para Imagens</span>
            <ArrowRight className="h-3.5 w-3.5 text-green-primary" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("/pdf")}
            className="bg-bg-sec hover:bg-bg-main border border-border-main px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-text-main hover:text-green-light"
          >
            <span>Ferramentas PDF</span>
            <ArrowRight className="h-3.5 w-3.5 text-green-primary" />
          </button>
        </div>
      </div>
    </div>
  );
}
