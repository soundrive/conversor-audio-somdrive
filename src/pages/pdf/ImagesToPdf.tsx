/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  Trash2, 
  FileText, 
  Download, 
  ChevronUp, 
  ChevronDown, 
  ArrowLeft, 
  Sparkles, 
  Info, 
  AlertTriangle,
  X,
  CheckCircle2,
  Image as ImageIcon,
  RotateCcw
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { 
  validateAndLoadImage, 
  ImageMetadata, 
  MAX_IMAGES_COUNT, 
  MAX_TOTAL_IMAGES_SIZE 
} from "../../utils/imageValidation";
import { 
  convertImagesToPdf, 
  ImagesToPdfOptions, 
  PageSizeOption, 
  OrientationOption, 
  MarginOption, 
  ImageFitOption, 
  ImageQualityOption 
} from "../../services/pdf/imagesToPdfService";
import { trackEvent } from "../../lib/gtag";
import { triggerDownload } from "../../utils/downloadZip";

export interface ImagesToPdfProps {
  onBack?: () => void;
}

export default function ImagesToPdf({ onBack }: ImagesToPdfProps) {
  const [images, setImages] = useState<ImageMetadata[]>([]);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Conversion options
  const [pageSize, setPageSize] = useState<PageSizeOption>("a4");
  const [orientation, setOrientation] = useState<OrientationOption>("auto");
  const [margin, setMargin] = useState<MarginOption>("small");
  const [fitMode, setFitMode] = useState<ImageFitOption>("contain");
  const [quality, setQuality] = useState<ImageQualityOption>("high");
  const [whiteBackground, setWhiteBackground] = useState<boolean>(true);
  const [centerImage, setCenterImage] = useState<boolean>(true);

  // Execution state
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressStep, setProgressStep] = useState<string>("");
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const isCancelledRef = useRef<boolean>(false);

  // Result state
  const [resultPdfBlob, setResultPdfBlob] = useState<Blob | null>(null);
  const [resultFileName, setResultFileName] = useState<string>("imagens-convertidas.pdf");
  const [resultPageCount, setResultPageCount] = useState<number>(0);
  const [resultSize, setResultSize] = useState<number>(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up Object URLs when unmounting or clearing
  useEffect(() => {
    return () => {
      images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    };
  }, []);

  const handleFileSelect = async (files: FileList | File[]) => {
    setGlobalError(null);
    setInfoMessage(null);

    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    if (images.length + fileArray.length > MAX_IMAGES_COUNT) {
      setGlobalError(`Você pode converter até ${MAX_IMAGES_COUNT} imagens por vez.`);
      return;
    }

    const currentTotalSize = images.reduce((acc, img) => acc + img.size, 0);
    const newTotalSize = fileArray.reduce((acc, f) => acc + f.size, 0) + currentTotalSize;

    if (newTotalSize > MAX_TOTAL_IMAGES_SIZE) {
      setGlobalError("O tamanho total das imagens excede o limite recomendado de 500 MB.");
      return;
    }

    const loaded: ImageMetadata[] = [];
    const errors: string[] = [];

    for (const file of fileArray) {
      try {
        const meta = await validateAndLoadImage(file);
        loaded.push(meta);
      } catch (e: any) {
        errors.push(e.message || `Erro ao carregar ${file.name}`);
      }
    }

    if (errors.length > 0) {
      setGlobalError(errors.join(" | "));
    }

    if (loaded.length > 0) {
      setImages(prev => [...prev, ...loaded]);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setImages(prev => {
      const arr = [...prev];
      const temp = arr[index - 1];
      arr[index - 1] = arr[index];
      arr[index] = temp;
      return arr;
    });
  };

  const handleMoveDown = (index: number) => {
    setImages(prev => {
      if (index >= prev.length - 1) return prev;
      const arr = [...prev];
      const temp = arr[index + 1];
      arr[index + 1] = arr[index];
      arr[index] = temp;
      return arr;
    });
  };

  const handleClearAll = () => {
    images.forEach(img => URL.revokeObjectURL(img.previewUrl));
    setImages([]);
    setGlobalError(null);
    setResultPdfBlob(null);
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    setIsProcessing(false);
    setProgressStep("Conversão cancelada.");
  };

  const handleGeneratePdf = async () => {
    if (images.length === 0) return;

    setGlobalError(null);
    setIsProcessing(true);
    setProgressPercent(0);
    setProcessedCount(0);
    setProgressStep("Preparando imagens...");
    isCancelledRef.current = false;

    trackEvent("images_to_pdf_started", {
      file_count: images.length,
      page_size: pageSize,
      quality
    });

    const options: ImagesToPdfOptions = {
      pageSize,
      orientation,
      margin,
      fitMode,
      quality,
      whiteBackground,
      centerImage
    };

    try {
      const result = await convertImagesToPdf(
        images,
        options,
        (progress) => {
          setProgressStep(progress.stepText);
          setProgressPercent(progress.percent);
          setProcessedCount(progress.processedCount);
        },
        () => isCancelledRef.current
      );

      setResultPdfBlob(result.pdfBlob);
      setResultPageCount(result.pageCount);
      setResultSize(result.pdfBlob.size);
      setIsProcessing(false);

      trackEvent("images_to_pdf_completed", {
        file_count: images.length,
        page_count: result.pageCount,
        success: true
      });
    } catch (err: any) {
      setIsProcessing(false);
      const errMsg = err.message || "Erro desconhecido ao gerar o PDF.";
      setGlobalError(errMsg);

      trackEvent("images_to_pdf_failed", {
        error: errMsg,
        file_count: images.length
      });
    }
  };

  const handleDownload = () => {
    if (!resultPdfBlob) return;
    const finalName = resultFileName.trim().endsWith(".pdf") 
      ? resultFileName.trim() 
      : `${resultFileName.trim()}.pdf`;

    triggerDownload(resultPdfBlob, finalName);

    trackEvent("images_to_pdf_download_clicked", {
      file_count: resultPageCount,
      filename: finalName
    });
  };

  const handleReset = () => {
    setResultPdfBlob(null);
    setGlobalError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-6 text-[#F5F7F8]" id="images-to-pdf-wrapper">
      
      {/* Top Breadcrumb & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2D3B47] pb-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 bg-[#202D38] hover:bg-[#2B3945] text-[#AEB8C1] hover:text-white rounded-xl border border-[#2D3B47] transition-colors cursor-pointer"
              title="Voltar às Ferramentas PDF"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h2 className="font-display font-extrabold text-xl md:text-2xl text-white flex items-center gap-2">
              <ImageIcon className="h-6 w-6 text-[#22C96B]" />
              Imagens para PDF
            </h2>
            <p className="text-xs md:text-sm text-[#AEB8C1] font-medium mt-0.5">
              Transforme JPG, PNG e WEBP em um único arquivo PDF organizado.
            </p>
          </div>
        </div>

        {images.length > 0 && !resultPdfBlob && !isProcessing && (
          <button
            onClick={handleClearAll}
            className="px-3.5 py-2 bg-[#202D38] hover:bg-red-950/40 text-red-400 border border-[#2D3B47] hover:border-red-800/50 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Trash2 className="h-4 w-4" />
            Limpar tudo
          </button>
        )}
      </div>

      {/* Global Error Alert */}
      {globalError && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-2xl p-4 text-red-300 text-xs font-semibold flex items-start gap-3 animate-fade-in" id="error-alert">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-bold text-red-200">Atenção ao processar imagens:</p>
            <p>{globalError}</p>
          </div>
          <button onClick={() => setGlobalError(null)} className="text-red-400 hover:text-red-200 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* RESULT VIEW */}
      {resultPdfBlob ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#1B2732] border border-[#22C96B] rounded-[28px] p-6 md:p-8 space-y-6 shadow-2xl"
          id="result-view"
        >
          <div className="flex items-center gap-4 text-[#22C96B]">
            <div className="p-3 bg-[#173A2A] rounded-2xl border border-[#22C96B]/30 shrink-0">
              <CheckCircle2 className="h-8 w-8 text-[#22C96B]" />
            </div>
            <div>
              <h3 className="font-display font-extrabold text-xl text-white">PDF Gerado com Sucesso!</h3>
              <p className="text-xs text-[#AEB8C1] font-semibold mt-1">
                Seu documento está pronto para ser baixado.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#202D38] p-5 rounded-2xl border border-[#2D3B47]">
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-extrabold text-[#AEB8C1] uppercase tracking-wider block mb-1">
                  Nome do Arquivo PDF:
                </label>
                <input
                  type="text"
                  value={resultFileName}
                  onChange={(e) => setResultFileName(e.target.value)}
                  className="w-full bg-[#1B2732] border border-[#2D3B47] focus:border-[#22C96B] rounded-xl px-3.5 py-2.5 text-sm font-bold text-white outline-none transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
              <div className="bg-[#1B2732] p-3 rounded-xl border border-[#2D3B47]">
                <span className="text-[#AEB8C1] text-[10px] block font-bold uppercase">Páginas:</span>
                <span className="text-white font-extrabold text-base">{resultPageCount}</span>
              </div>
              <div className="bg-[#1B2732] p-3 rounded-xl border border-[#2D3B47]">
                <span className="text-[#AEB8C1] text-[10px] block font-bold uppercase">Tamanho Final:</span>
                <span className="text-[#22C96B] font-extrabold text-base">{formatFileSize(resultSize)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleDownload}
              className="flex-1 py-4 bg-[#22C96B] hover:bg-[#1eb860] text-[#10171D] rounded-xl font-extrabold text-base flex items-center justify-center gap-2 shadow-lg shadow-[#22C96B]/20 transition-all cursor-pointer active:scale-[0.99]"
              id="btn-download-pdf"
            >
              <Download className="h-5 w-5" />
              Baixar PDF Gerado
            </button>
            <button
              onClick={handleReset}
              className="py-4 px-6 bg-[#202D38] hover:bg-[#2B3945] text-white border border-[#2D3B47] rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              Criar Outro PDF
            </button>
          </div>
        </motion.div>
      ) : isProcessing ? (
        /* PROCESSING VIEW */
        <div className="bg-[#1B2732] border border-[#2D3B47] rounded-[28px] p-8 text-center space-y-6 shadow-xl" id="processing-view">
          <div className="p-4 bg-[#202D38] border border-[#2D3B47] rounded-full inline-block animate-bounce">
            <Sparkles className="h-8 w-8 text-[#22C96B]" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="font-display font-extrabold text-lg text-white">{progressStep}</h3>
            <p className="text-xs text-[#AEB8C1] font-semibold">
              Processando imagem {processedCount} de {images.length}...
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <div className="w-full bg-[#202D38] rounded-full h-3 overflow-hidden border border-[#2D3B47]">
              <div 
                className="bg-[#22C96B] h-full transition-all duration-300 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-bold text-[#22C96B]">{progressPercent}%</span>
          </div>

          <div>
            <button
              onClick={handleCancel}
              className="px-5 py-2.5 bg-[#202D38] hover:bg-red-950/40 text-red-400 border border-[#2D3B47] hover:border-red-800/50 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        /* MAIN WORKSPACE VIEW */
        <div className="space-y-8">
          
          {/* DRAG AND DROP ZONE */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-[28px] p-8 md:p-12 text-center cursor-pointer transition-all duration-300 ${
              dragActive 
                ? "border-[#22C96B] bg-[#173A2A]/40 scale-[1.01]" 
                : "border-[#2D3B47] bg-[#1B2732] hover:border-[#22C96B]/60 hover:bg-[#202D38]"
            }`}
            id="dropzone-images"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/bmp"
              className="hidden"
              onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
            />

            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 bg-[#202D38] text-[#22C96B] rounded-2xl border border-[#2D3B47] shadow-inner">
                <Upload className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="font-display font-extrabold text-base md:text-lg text-white">
                  Arraste suas imagens aqui ou <span className="text-[#22C96B] underline underline-offset-4">clique para selecionar</span>
                </p>
                <p className="text-xs text-[#AEB8C1] font-semibold">
                  Suporta JPG, PNG, WEBP e BMP (Até 100 imagens, máximo 25 MB por foto)
                </p>
              </div>
            </div>
          </div>

          {/* LIST & CONFIGURATION GRID */}
          {images.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              
              {/* LEFT 2 COLS: IMAGES LIST WITH REORDER */}
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-extrabold text-base text-white flex items-center gap-2">
                    <span>Imagens Selecionadas ({images.length})</span>
                  </h3>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs font-extrabold text-[#22C96B] hover:text-[#1eb860] flex items-center gap-1 cursor-pointer"
                  >
                    + Adicionar mais fotos
                  </button>
                </div>

                <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1 custom-scrollbar">
                  {images.map((img, idx) => (
                    <motion.div
                      key={img.previewUrl}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-[#1B2732] border border-[#2D3B47] hover:border-[#22C96B]/50 rounded-2xl p-3.5 flex items-center gap-4 transition-all shadow-sm"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#202D38] border border-[#2D3B47] flex items-center justify-center font-extrabold text-xs text-[#22C96B] shrink-0">
                        {idx + 1}
                      </div>

                      <div className="w-14 h-14 bg-[#202D38] rounded-xl border border-[#2D3B47] overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                        <img 
                          src={img.previewUrl} 
                          alt={img.name} 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <h4 className="text-xs font-extrabold text-white truncate">{img.name}</h4>
                        <div className="flex items-center gap-3 text-[11px] text-[#AEB8C1] font-semibold">
                          <span>{formatFileSize(img.size)}</span>
                          <span>•</span>
                          <span>{img.width}x{img.height} px</span>
                          <span>•</span>
                          <span className="uppercase text-[#22C96B] font-extrabold">{img.format}</span>
                        </div>
                      </div>

                      {/* Reorder Buttons */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          className="p-1 bg-[#202D38] hover:bg-[#2B3945] disabled:opacity-30 disabled:hover:bg-[#202D38] text-white rounded-lg border border-[#2D3B47] transition-colors cursor-pointer"
                          title="Subir página"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === images.length - 1}
                          className="p-1 bg-[#202D38] hover:bg-[#2B3945] disabled:opacity-30 disabled:hover:bg-[#202D38] text-white rounded-lg border border-[#2D3B47] transition-colors cursor-pointer"
                          title="Descer página"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => handleRemoveImage(idx)}
                        className="p-2 bg-[#202D38] hover:bg-red-950/40 text-[#AEB8C1] hover:text-red-400 rounded-xl border border-[#2D3B47] hover:border-red-800/40 transition-colors cursor-pointer shrink-0"
                        title="Remover imagem"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* RIGHT COL: PDF SETTINGS CARD */}
              <div className="bg-[#1B2732] border border-[#2D3B47] rounded-[24px] p-6 space-y-6 shadow-md">
                <h3 className="font-display font-extrabold text-base text-white border-b border-[#2D3B47] pb-3">
                  Configurações do PDF
                </h3>

                {/* Page Size */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-[#AEB8C1] uppercase tracking-wider block">
                    Tamanho da Página:
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as PageSizeOption)}
                    className="w-full bg-[#202D38] border border-[#2D3B47] focus:border-[#22C96B] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="a4">A4 (Padrão Recomendado)</option>
                    <option value="auto">Automático (Ajustar à imagem)</option>
                    <option value="letter">Carta (Letter)</option>
                  </select>
                </div>

                {/* Orientation */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-[#AEB8C1] uppercase tracking-wider block">
                    Orientação:
                  </label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as OrientationOption)}
                    className="w-full bg-[#202D38] border border-[#2D3B47] focus:border-[#22C96B] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="auto">Automática (Ajustar por foto)</option>
                    <option value="portrait">Retrato (Vertical)</option>
                    <option value="landscape">Paisagem (Horizontal)</option>
                  </select>
                </div>

                {/* Margins */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-[#AEB8C1] uppercase tracking-wider block">
                    Margens:
                  </label>
                  <select
                    value={margin}
                    onChange={(e) => setMargin(e.target.value as MarginOption)}
                    className="w-full bg-[#202D38] border border-[#2D3B47] focus:border-[#22C96B] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="none">Sem margem (0pt)</option>
                    <option value="small">Pequena (15pt - Padrão)</option>
                    <option value="medium">Média (30pt)</option>
                    <option value="large">Grande (45pt)</option>
                  </select>
                </div>

                {/* Fit Mode */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-[#AEB8C1] uppercase tracking-wider block">
                    Ajuste da Imagem:
                  </label>
                  <select
                    value={fitMode}
                    onChange={(e) => setFitMode(e.target.value as ImageFitOption)}
                    className="w-full bg-[#202D38] border border-[#2D3B47] focus:border-[#22C96B] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="contain">Conter imagem inteira (Sem cortes)</option>
                    <option value="fill">Preencher página</option>
                  </select>
                </div>

                {/* Quality & Compression */}
                <div className="space-y-2">
                  <label className="text-xs font-extrabold text-[#AEB8C1] uppercase tracking-wider block">
                    Qualidade / Compactação:
                  </label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value as ImageQualityOption)}
                    className="w-full bg-[#202D38] border border-[#2D3B47] focus:border-[#22C96B] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                  >
                    <option value="high">Alta Qualidade (Otimizada - Padrão)</option>
                    <option value="maximum">Qualidade Máxima (HD)</option>
                    <option value="medium">Média (Compactar PDF)</option>
                    <option value="economic">Econômica (Menor tamanho)</option>
                    <option value="original">Manter arquivo original</option>
                  </select>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3 pt-2 border-t border-[#2D3B47] text-xs font-semibold">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={centerImage}
                      onChange={(e) => setCenterImage(e.target.checked)}
                      className="rounded accent-[#22C96B] w-4 h-4 cursor-pointer"
                    />
                    <span>Centralizar imagem na página</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={whiteBackground}
                      onChange={(e) => setWhiteBackground(e.target.checked)}
                      className="rounded accent-[#22C96B] w-4 h-4 cursor-pointer"
                    />
                    <span>Fundo branco na página</span>
                  </label>
                </div>

                {/* Action button */}
                <button
                  onClick={handleGeneratePdf}
                  className="w-full py-4 bg-[#22C96B] hover:bg-[#1eb860] text-[#10171D] rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#22C96B]/20 transition-all cursor-pointer active:scale-[0.99]"
                  id="btn-generate-pdf"
                >
                  <FileText className="h-5 w-5" />
                  Gerar Arquivo PDF ({images.length})
                </button>
              </div>

            </div>
          )}

          {/* Privacy Note */}
          <div className="bg-[#1B2732] border border-[#2D3B47] rounded-2xl p-4 text-center">
            <p className="text-xs text-[#AEB8C1] font-bold">
              🔒 Seus arquivos não ficam salvos.
            </p>
          </div>

        </div>
      )}

    </div>
  );
}
