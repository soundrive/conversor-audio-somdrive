import React, { useState, useRef } from "react";
import { Image as ImageIcon, Sparkles, ShieldCheck, ArrowRight, Play, AlertCircle } from "lucide-react";
import ImageToolSwitcher from "../../components/image/ImageToolSwitcher";
import ImageUpload from "../../components/image/ImageUpload";
import ImageSettings, { ImageSettingsState } from "../../components/image/ImageSettings";
import ImageFileList from "../../components/image/ImageFileList";
import ImageProgress from "../../components/image/ImageProgress";
import ImageResults from "../../components/image/ImageResults";
import {
  ImageItem,
  prepareImageItem,
  convertSingleImage
} from "../../services/image/imageConverterService";
import { trackEvent } from "../../lib/gtag";

interface ImageConverterProps {
  onNavigate?: (path: string) => void;
}

export default function ImageConverter({ onNavigate }: ImageConverterProps) {
  const [items, setItems] = useState<ImageItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const cancelRequestedRef = useRef(false);

  const [settings, setSettings] = useState<ImageSettingsState>({
    outputFormat: "PNG",
    qualityPreset: "Alta",
    qualityValue: 0.85,
    backgroundColor: "#FFFFFF"
  });

  const currentTotalSize = items.reduce((acc, curr) => acc + curr.originalSize, 0);

  // Handle file selection from upload or drag-and-drop
  const handleFilesSelected = async (files: File[]) => {
    setIsFinished(false);
    const newItems: ImageItem[] = [];

    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const meta = await prepareImageItem(file);

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
        outputFormat: settings.outputFormat,
        errorMessage: meta.errorMessage
      });
    }

    setItems((prev) => [...prev, ...newItems]);
  };

  const handleRemoveItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      if (target?.convertedBlobUrl) URL.revokeObjectURL(target.convertedBlobUrl);
      return prev.filter((i) => i.id !== id);
    });
  };

  const handleClearAll = () => {
    items.forEach((i) => {
      if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
      if (i.convertedBlobUrl) URL.revokeObjectURL(i.convertedBlobUrl);
    });
    setItems([]);
    setIsFinished(false);
    setSuccessCount(0);
    setFailedCount(0);
  };

  // Start conversion queue
  const handleStartConversion = async () => {
    if (items.length === 0 || isConverting) return;

    cancelRequestedRef.current = false;
    setIsConverting(true);
    setIsFinished(false);
    setCurrentIndex(0);
    let succ = 0;
    let fail = 0;

    // Track GA4 conversion start event
    const inputFormatsList = Array.from(new Set(items.map((i) => i.originalFormat))).join(",");
    trackEvent("image_conversion_started", {
      tool_name: "image_converter",
      input_format: inputFormatsList,
      output_format: settings.outputFormat,
      file_count: items.length,
      quality: settings.qualityPreset
    });

    for (let i = 0; i < items.length; i++) {
      if (cancelRequestedRef.current) {
        // Mark remaining items as cancelled
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

      // Mark current item as converting
      setItems((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: "convertendo" } : item))
      );

      const currentItem = items[i];

      try {
        const result = await convertSingleImage(currentItem, {
          outputFormat: settings.outputFormat,
          quality: settings.qualityValue,
          backgroundColor: settings.backgroundColor
        });

        succ++;
        setSuccessCount(succ);

        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? {
                  ...item,
                  status: "concluida",
                  convertedBlob: result.convertedBlob,
                  convertedBlobUrl: result.convertedBlobUrl,
                  convertedSize: result.convertedSize,
                  convertedFileName: result.convertedFileName,
                  outputFormat: settings.outputFormat,
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
                  errorMessage: err.message || "Erro durante a conversão da imagem."
                }
              : item
          )
        );
      }

      // Small non-blocking yield to keep UI responsive
      await new Promise((resolve) => setTimeout(resolve, 30));
    }

    setIsConverting(false);
    setIsFinished(true);

    // Track GA4 completed/failed event
    if (succ > 0) {
      trackEvent("image_conversion_completed", {
        tool_name: "image_converter",
        input_format: inputFormatsList,
        output_format: settings.outputFormat,
        file_count: items.length,
        converted_count: succ,
        failed_count: fail,
        quality: settings.qualityPreset,
        success: true
      });
    } else {
      trackEvent("image_conversion_failed", {
        tool_name: "image_converter",
        input_format: inputFormatsList,
        output_format: settings.outputFormat,
        file_count: items.length,
        converted_count: 0,
        failed_count: fail,
        quality: settings.qualityPreset,
        success: false
      });
    }
  };

  const handleCancelConversion = () => {
    cancelRequestedRef.current = true;
  };

  const handleDownloadSingle = (item: ImageItem) => {
    if (!item.convertedBlobUrl || !item.convertedFileName) return;

    trackEvent("image_download_clicked", {
      tool_name: "image_converter",
      output_format: item.outputFormat
    });

    const link = document.createElement("a");
    link.href = item.convertedBlobUrl;
    link.download = item.convertedFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleZipDownloadTracking = () => {
    trackEvent("image_zip_download_clicked", {
      tool_name: "image_converter",
      file_count: successCount
    });
  };

  return (
    <div className="space-y-8">
      {/* Top Tool Switcher */}
      <ImageToolSwitcher activeTool="converter" onNavigate={onNavigate} />

      {/* Title & Header */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-400">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Ferramentas de Imagem</span>
        </div>

        <h1 className="font-display text-2xl md:text-3xl font-extrabold text-text-main tracking-tight" id="image-converter-h1">
          Conversor de Imagens Grátis
        </h1>

        <p className="text-xs md:text-sm text-text-sec font-semibold">
          Converta imagens entre JPG, PNG, WEBP, AVIF e BMP.
        </p>

        <p className="text-xs text-text-muted font-semibold pt-0.5">
          Precisa reduzir o tamanho?{" "}
          <button
            type="button"
            onClick={() => onNavigate?.("/imagem/comprimir")}
            className="text-green-primary hover:underline font-bold cursor-pointer"
          >
            Use o Compressor de Imagens.
          </button>
        </p>

        <p className="text-[11px] text-emerald-400 font-bold flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck className="h-4 w-4" />
          <span>Seus arquivos não ficam salvos.</span>
        </p>
      </div>

      {/* Main Workspace Area */}
      <div className="space-y-6">
        {/* Step 1: Upload Dropzone if no files */}
        {items.length === 0 && (
          <ImageUpload
            onFilesSelected={handleFilesSelected}
            currentCount={items.length}
            currentTotalSize={currentTotalSize}
          />
        )}

        {/* Step 2: Settings and File List */}
        {items.length > 0 && !isFinished && (
          <div className="space-y-6">
            <ImageSettings
              settings={settings}
              onChange={setSettings}
              disabled={isConverting}
            />

            <ImageFileList
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
              isConverting={isConverting}
            />

            {/* Action Bar / Convert Button */}
            {!isConverting && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={handleStartConversion}
                  className="w-full sm:w-auto min-w-[280px] py-4 px-8 bg-green-primary hover:bg-green-dark text-white rounded-2xl font-black text-sm md:text-base transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg shadow-emerald-950/30 active:scale-[0.98]"
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span>CONVERTER IMAGENS</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Conversion Progress Overlay */}
        {isConverting && (
          <ImageProgress
            currentIndex={currentIndex}
            totalCount={items.length}
            successCount={successCount}
            failedCount={failedCount}
            onCancel={handleCancelConversion}
          />
        )}

        {/* Step 4: Results Display */}
        {isFinished && (
          <ImageResults
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

          <button
            type="button"
            onClick={() => onNavigate?.("/audio")}
            className="bg-bg-sec hover:bg-bg-main border border-border-main px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-text-main hover:text-green-light"
          >
            <span>Conversor de Áudio</span>
            <ArrowRight className="h-3.5 w-3.5 text-green-primary" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("/video-para-audio")}
            className="bg-bg-sec hover:bg-bg-main border border-border-main px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 text-text-main hover:text-green-light"
          >
            <span>Vídeo para Áudio</span>
            <ArrowRight className="h-3.5 w-3.5 text-green-primary" />
          </button>
        </div>
      </div>
    </div>
  );
}
