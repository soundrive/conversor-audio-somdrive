import React, { useState, useRef, useEffect } from "react";
import { Sparkles, ShieldCheck, ArrowRight, Play } from "lucide-react";
import ImageToolSwitcher from "../../components/image/ImageToolSwitcher";
import ImageResizerUpload from "../../components/image/resizer/ImageResizerUpload";
import ImageResizerSettings, { ResizerSettingsState } from "../../components/image/resizer/ImageResizerSettings";
import ImageResizerFileList from "../../components/image/resizer/ImageResizerFileList";
import ImageResizerProgress from "../../components/image/resizer/ImageResizerProgress";
import ImageResizerResults from "../../components/image/resizer/ImageResizerResults";
import {
  ResizedImageItem,
  prepareResizerItem,
  resizeSingleImage
} from "../../services/image/imageResizeService";
import { trackEvent } from "../../lib/gtag";

interface ImageResizerProps {
  onNavigate?: (path: string) => void;
}

export default function ImageResizer({ onNavigate }: ImageResizerProps) {
  const [items, setItems] = useState<ResizedImageItem[]>([]);
  const [isResizing, setIsResizing] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const cancelRequestedRef = useRef(false);

  const [settings, setSettings] = useState<ResizerSettingsState>({
    mode: "pixels",
    targetWidth: 1080,
    targetHeight: 1080,
    keepAspectRatio: true,
    percentage: 50,
    presetId: "insta_square",
    presetWidth: 1080,
    presetHeight: 1080,
    fitMode: "contain",
    bgColor: "transparent"
  });

  const currentTotalSize = items.reduce((acc, curr) => acc + curr.originalSize, 0);

  // Clean up Object URLs on unmount
  useEffect(() => {
    return () => {
      items.forEach((i) => {
        if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
        if (i.resizedBlobUrl) URL.revokeObjectURL(i.resizedBlobUrl);
      });
    };
  }, []);

  const handleFilesSelected = async (files: File[]) => {
    setIsFinished(false);
    const newItems: ResizedImageItem[] = [];

    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const meta = await prepareResizerItem(file);

      newItems.push({
        id,
        file,
        name: file.name,
        originalSize: file.size,
        originalFormat: meta.originalFormat || "IMG",
        origWidth: meta.origWidth,
        origHeight: meta.origHeight,
        previewUrl: meta.previewUrl,
        status: "aguardando",
        progress: 0,
        errorMessage: meta.errorMessage
      });
    }

    // Automatically set default target dimensions based on first image if available
    if (items.length === 0 && newItems.length > 0 && newItems[0].origWidth && newItems[0].origHeight) {
      setSettings((prev) => ({
        ...prev,
        targetWidth: newItems[0].origWidth || 1080,
        targetHeight: newItems[0].origHeight || 1080
      }));
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.resizedBlobUrl) URL.revokeObjectURL(target.resizedBlobUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleClearAll = () => {
    items.forEach((i) => {
      if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
      if (i.resizedBlobUrl) URL.revokeObjectURL(i.resizedBlobUrl);
    });
    setItems([]);
    setIsFinished(false);
    setSuccessCount(0);
    setFailedCount(0);
  };

  const handleStartResize = async () => {
    if (items.length === 0 || isResizing) return;

    cancelRequestedRef.current = false;
    setIsResizing(true);
    setIsFinished(false);
    setCurrentIndex(0);
    let succ = 0;
    let fail = 0;

    const inputFormatsList = Array.from(new Set(items.map((i) => i.originalFormat))).join(",");

    // GA4 Resize Started
    trackEvent("image_resize_started", {
      tool_name: "image_resizer",
      input_format: inputFormatsList,
      file_count: items.length,
      resize_mode: settings.mode,
      preset_name: settings.mode === "presets" ? settings.presetId : "custom"
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
        prev.map((item, idx) => (idx === i ? { ...item, status: "redimensionando" } : item))
      );

      const currentItem = items[i];

      try {
        const result = await resizeSingleImage(currentItem, {
          mode: settings.mode,
          targetWidth: settings.targetWidth,
          targetHeight: settings.targetHeight,
          keepAspectRatio: settings.keepAspectRatio,
          percentage: settings.percentage,
          presetWidth: settings.presetWidth,
          presetHeight: settings.presetHeight,
          fitMode: settings.fitMode,
          bgColor: settings.bgColor,
          quality: 0.90
        });

        succ++;
        setSuccessCount(succ);

        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: "concluida",
                  resizedBlob: result.resizedBlob,
                  resizedBlobUrl: result.resizedBlobUrl,
                  resizedSize: result.resizedSize,
                  finalWidth: result.finalWidth,
                  finalHeight: result.finalHeight,
                  resizedFileName: result.resizedFileName,
                  isUpscaled: result.isUpscaled
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
                  errorMessage: err.message || "Erro ao redimensionar a imagem."
                }
              : item
          )
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    setIsResizing(false);
    setIsFinished(true);

    // GA4 Resize Completed / Failed
    if (succ > 0) {
      trackEvent("image_resize_completed", {
        tool_name: "image_resizer",
        input_format: inputFormatsList,
        file_count: items.length,
        resized_count: succ,
        failed_count: fail,
        resize_mode: settings.mode,
        success: true
      });
    } else {
      trackEvent("image_resize_failed", {
        tool_name: "image_resizer",
        input_format: inputFormatsList,
        file_count: items.length,
        resized_count: 0,
        failed_count: fail,
        resize_mode: settings.mode,
        success: false
      });
    }
  };

  const handleCancelResize = () => {
    cancelRequestedRef.current = true;
  };

  const handleDownloadSingle = (item: ResizedImageItem) => {
    if (!item.resizedBlobUrl || !item.resizedFileName) return;

    trackEvent("image_resize_download_clicked", {
      tool_name: "image_resizer",
      input_format: item.originalFormat
    });

    const link = document.createElement("a");
    link.href = item.resizedBlobUrl;
    link.download = item.resizedFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZipDownloadTracking = () => {
    trackEvent("image_resize_zip_download_clicked", {
      tool_name: "image_resizer",
      file_count: successCount
    });
  };

  const firstItemWithDims = items.find((i) => i.origWidth && i.origHeight);

  return (
    <div className="space-y-8">
      {/* Top Tool Switcher */}
      <ImageToolSwitcher activeTool="redimensionar" onNavigate={onNavigate} />

      {/* Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Ferramentas de Imagem</span>
        </div>

        <h1 className="font-display text-2xl md:text-3xl font-extrabold text-text-main tracking-tight" id="image-resizer-h1">
          Redimensionador de Imagens Grátis
        </h1>

        <p className="text-xs md:text-sm text-text-sec font-semibold">
          Altere as dimensões das suas imagens em pixels, porcentagem ou tamanhos prontos.
        </p>

        <p className="text-[11px] text-emerald-400 font-bold flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck className="h-4 w-4" />
          <span>Seus arquivos não ficam salvos.</span>
        </p>
      </div>

      {/* Main Workspace */}
      <div className="space-y-6">
        {items.length === 0 && (
          <ImageResizerUpload
            onFilesSelected={handleFilesSelected}
            currentCount={items.length}
            currentTotalSize={currentTotalSize}
          />
        )}

        {items.length > 0 && !isFinished && (
          <div className="space-y-6">
            <ImageResizerSettings
              settings={settings}
              onChange={setSettings}
              sampleOriginalWidth={firstItemWithDims?.origWidth || 1920}
              sampleOriginalHeight={firstItemWithDims?.origHeight || 1080}
              disabled={isResizing}
            />

            <ImageResizerFileList
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
              isResizing={isResizing}
            />

            {!isResizing && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleStartResize}
                  className="w-full sm:w-auto min-w-[280px] py-4 px-8 bg-green-primary hover:bg-green-dark text-white rounded-2xl font-black text-sm md:text-base transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-emerald-950/30 active:scale-[0.98]"
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span>REDIMENSIONAR IMAGENS</span>
                </button>
              </div>
            )}
          </div>
        )}

        {isResizing && (
          <ImageResizerProgress
            currentIndex={currentIndex}
            totalCount={items.length}
            successCount={successCount}
            failedCount={failedCount}
            onCancel={handleCancelResize}
          />
        )}

        {isFinished && (
          <ImageResizerResults
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
            onClick={() => onNavigate?.("/imagem/converter")}
            className="bg-bg-sec hover:bg-bg-main border border-border-main px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-text-main hover:text-green-light"
          >
            <span>Conversor de Imagens</span>
            <ArrowRight className="h-3.5 w-3.5 text-green-primary" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("/imagem/comprimir")}
            className="bg-bg-sec hover:bg-bg-main border border-border-main px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-text-main hover:text-green-light"
          >
            <span>Compressor de Imagens</span>
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
        </div>
      </div>
    </div>
  );
}
