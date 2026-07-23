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
  ArrowLeft, 
  Sparkles, 
  AlertTriangle,
  X,
  CheckCircle2,
  Image as ImageIcon,
  RotateCcw,
  Archive,
  CheckSquare,
  Square
} from "lucide-react";
import { motion } from "motion/react";
import { 
  loadPdfDocument, 
  generatePageThumbnails, 
  convertPdfPagesToImages, 
  PageThumbnail, 
  ConvertedPageImage, 
  ImageFormat, 
  DpiOption, 
  JpgQualityOption, 
  PdfToImagesOptions 
} from "../../services/pdf/pdfToImagesService";
import { parsePageRange, formatPageRangeString } from "../../utils/pageRangeParser";
import { createZipArchive, triggerDownload } from "../../utils/downloadZip";
import { trackEvent } from "../../lib/gtag";

export interface PdfToImagesProps {
  onBack?: () => void;
}

type PageSelectionMode = "all" | "custom_range" | "manual";

export default function PdfToImages({ onBack }: PdfToImagesProps) {
  // Input File State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pdfjsDoc, setPdfjsDoc] = useState<any | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(false);

  // Thumbnails state
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [isLoadingThumbnails, setIsLoadingThumbnails] = useState<boolean>(false);

  // Selection & Options State
  const [selectionMode, setSelectionMode] = useState<PageSelectionMode>("all");
  const [rangeInput, setRangeInput] = useState<string>("");
  const [selectedPageNumbers, setSelectedPageNumbers] = useState<number[]>([]);
  
  const [outputFormat, setOutputFormat] = useState<ImageFormat>("jpg");
  const [dpi, setDpi] = useState<DpiOption>(150);
  const [jpgQuality, setJpgQuality] = useState<JpgQualityOption>("high");
  const [whiteBackground, setWhiteBackground] = useState<boolean>(true);

  // Execution State
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalToProcess, setTotalToProcess] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const isCancelledRef = useRef<boolean>(false);
  const timerRef = useRef<any>(null);

  // Results State
  const [convertedImages, setConvertedImages] = useState<ConvertedPageImage[]>([]);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  // Errors & Alerts
  const [globalError, setGlobalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up Object URLs when resetting
  const cleanupConvertedUrls = () => {
    convertedImages.forEach(img => URL.revokeObjectURL(img.url));
    setConvertedImages([]);
  };

  useEffect(() => {
    return () => {
      cleanupConvertedUrls();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleFileChange = async (file: File) => {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
      setGlobalError("Por favor, selecione um arquivo no formato PDF.");
      return;
    }

    setGlobalError(null);
    setSelectedFile(file);
    setIsLoadingPdf(true);
    cleanupConvertedUrls();
    setThumbnails([]);

    try {
      const { pdfjsDoc: loadedDoc, numPages } = await loadPdfDocument(file);
      setPdfjsDoc(loadedDoc);
      setTotalPages(numPages);
      setIsLoadingPdf(false);

      // Default selection to all pages
      const allPages = Array.from({ length: numPages }, (_, i) => i + 1);
      setSelectedPageNumbers(allPages);
      setRangeInput(`1-${numPages}`);

      // Load lightweight thumbnails
      setIsLoadingThumbnails(true);
      const thumbs = await generatePageThumbnails(loadedDoc, allPages);
      setThumbnails(thumbs);
      setIsLoadingThumbnails(false);

    } catch (err: any) {
      setIsLoadingPdf(false);
      setIsLoadingThumbnails(false);
      setPdfjsDoc(null);
      setSelectedFile(null);
      setGlobalError(err.message || "Falha ao carregar o documento PDF.");
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPdfjsDoc(null);
    setTotalPages(0);
    setThumbnails([]);
    cleanupConvertedUrls();
    setGlobalError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSelectAllPages = () => {
    const allPages = Array.from({ length: totalPages }, (_, i) => i + 1);
    setSelectedPageNumbers(allPages);
    setSelectionMode("all");
    setRangeInput(`1-${totalPages}`);
  };

  const handleClearSelection = () => {
    setSelectedPageNumbers([]);
    setSelectionMode("manual");
    setRangeInput("");
  };

  const togglePageSelection = (pageNum: number) => {
    setSelectedPageNumbers(prev => {
      let next: number[];
      if (prev.includes(pageNum)) {
        next = prev.filter(p => p !== pageNum);
      } else {
        next = [...prev, pageNum].sort((a, b) => a - b);
      }
      setSelectionMode("manual");
      setRangeInput(formatPageRangeString(next));
      return next;
    });
  };

  const handleRangeInputChange = (value: string) => {
    setRangeInput(value);
    setSelectionMode("custom_range");
    const { pages, error } = parsePageRange(value, totalPages);
    if (!error) {
      setSelectedPageNumbers(pages);
      setGlobalError(null);
    } else {
      setGlobalError(error);
    }
  };

  const handleStartConversion = async () => {
    if (!pdfjsDoc || !selectedFile) return;

    let pagesToConvert = selectedPageNumbers;

    if (selectionMode === "custom_range" || rangeInput.trim()) {
      const { pages, error } = parsePageRange(rangeInput, totalPages);
      if (error) {
        setGlobalError(error);
        return;
      }
      pagesToConvert = pages;
    }

    if (pagesToConvert.length === 0) {
      setGlobalError("Selecione ao menos uma página para converter em imagem.");
      return;
    }

    setGlobalError(null);
    setIsProcessing(true);
    setCurrentPage(0);
    setTotalToProcess(pagesToConvert.length);
    isCancelledRef.current = false;
    setStartTime(Date.now());
    setElapsedSeconds(0);

    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    trackEvent("pdf_to_images_started", {
      page_count: pagesToConvert.length,
      format: outputFormat,
      dpi,
      quality: jpgQuality
    });

    const options: PdfToImagesOptions = {
      format: outputFormat,
      dpi,
      jpgQuality,
      whiteBackground,
      selectedPages: pagesToConvert
    };

    try {
      const results = await convertPdfPagesToImages(
        pdfjsDoc,
        selectedFile.name,
        options,
        (current, total) => {
          setCurrentPage(current);
        },
        () => isCancelledRef.current
      );

      if (timerRef.current) clearInterval(timerRef.current);
      setConvertedImages(results);
      setIsProcessing(false);

      trackEvent("pdf_to_images_completed", {
        page_count: results.length,
        format: outputFormat,
        success: true
      });
    } catch (err: any) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsProcessing(false);
      const errMsg = err.message || "Erro durante a conversão do PDF para imagens.";
      setGlobalError(errMsg);

      trackEvent("pdf_to_images_failed", {
        error: errMsg,
        format: outputFormat
      });
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsProcessing(false);
  };

  const handleDownloadSingle = (item: ConvertedPageImage) => {
    triggerDownload(item.blob, item.filename);

    trackEvent("pdf_to_images_download_clicked", {
      format: outputFormat,
      filename: item.filename,
      type: "single"
    });
  };

  const handleDownloadZip = async () => {
    if (convertedImages.length === 0) return;
    setIsZipping(true);

    try {
      const entries = await Promise.all(
        convertedImages.map(async (item) => {
          const buffer = await item.blob.arrayBuffer();
          return {
            filename: item.filename,
            data: new Uint8Array(buffer)
          };
        })
      );

      const zipBlob = createZipArchive(entries);
      const baseName = selectedFile?.name.replace(/\.pdf$/i, "") || "pdf-imagens";
      triggerDownload(zipBlob, `${baseName}-imagens.zip`);
      setIsZipping(false);

      trackEvent("pdf_to_images_download_clicked", {
        format: outputFormat,
        page_count: convertedImages.length,
        type: "zip"
      });
    } catch (e: any) {
      setIsZipping(false);
      setGlobalError(`Erro ao gerar o arquivo ZIP: ${e.message}`);
    }
  };

  const handleReset = () => {
    cleanupConvertedUrls();
    setGlobalError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const totalConvertedBytes = convertedImages.reduce((sum, img) => sum + img.size, 0);

  return (
    <div className="space-y-6 text-[#F5F7F8]" id="pdf-to-images-wrapper">
      
      {/* Top Header */}
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
              PDF para Imagens
            </h2>
            <p className="text-xs md:text-sm text-[#AEB8C1] font-medium mt-0.5">
              Converta páginas de PDF em JPG ou PNG com resolução e qualidade ajustáveis.
            </p>
          </div>
        </div>

        {selectedFile && !convertedImages.length && !isProcessing && (
          <button
            onClick={handleRemoveFile}
            className="px-3.5 py-2 bg-[#202D38] hover:bg-red-950/40 text-red-400 border border-[#2D3B47] hover:border-red-800/50 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto"
          >
            <Trash2 className="h-4 w-4" />
            Trocar PDF
          </button>
        )}
      </div>

      {/* Global Error Banner */}
      {globalError && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-2xl p-4 text-red-300 text-xs font-semibold flex items-start gap-3 animate-fade-in" id="pdf-images-error-alert">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
          <div className="flex-1 space-y-1">
            <p className="font-bold text-red-200">Aviso do sistema:</p>
            <p>{globalError}</p>
          </div>
          <button onClick={() => setGlobalError(null)} className="text-red-400 hover:text-red-200 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* RESULT VIEW */}
      {convertedImages.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[#1B2732] border border-[#22C96B] rounded-[28px] p-6 md:p-8 space-y-6 shadow-2xl"
          id="pdf-images-results"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2D3B47] pb-4">
            <div className="flex items-center gap-3 text-[#22C96B]">
              <div className="p-3 bg-[#173A2A] rounded-2xl border border-[#22C96B]/30 shrink-0">
                <CheckCircle2 className="h-8 w-8 text-[#22C96B]" />
              </div>
              <div>
                <h3 className="font-display font-extrabold text-xl text-white">Conversão Concluída!</h3>
                <p className="text-xs text-[#AEB8C1] font-semibold mt-0.5">
                  {convertedImages.length} {convertedImages.length === 1 ? "imagem gerada" : "imagens geradas"} ({outputFormat.toUpperCase()} • {dpi} DPI)
                </p>
              </div>
            </div>

            <button
              onClick={handleReset}
              className="px-4 py-2 bg-[#202D38] hover:bg-[#2B3945] text-white border border-[#2D3B47] rounded-xl font-extrabold text-xs flex items-center gap-2 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <RotateCcw className="h-4 w-4" />
              Converter Outro PDF
            </button>
          </div>

          {/* Action Bar (Download All as ZIP if > 1 page) */}
          {convertedImages.length > 1 && (
            <div className="bg-[#202D38] border border-[#2D3B47] p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-xs font-semibold text-[#AEB8C1]">
                <span>Tamanho acumulado: </span>
                <strong className="text-white">{formatFileSize(totalConvertedBytes)}</strong>
              </div>
              <button
                onClick={handleDownloadZip}
                disabled={isZipping}
                className="w-full sm:w-auto px-6 py-3 bg-[#22C96B] hover:bg-[#1eb860] disabled:opacity-50 text-[#10171D] rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#22C96B]/20 transition-all cursor-pointer active:scale-[0.99]"
                id="btn-download-all-zip"
              >
                <Archive className="h-4 w-4" />
                {isZipping ? "Compactando ZIP..." : "Baixar Todas em Arquivo ZIP"}
              </button>
            </div>
          )}

          {/* Images Grid list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
            {convertedImages.map((img) => (
              <div
                key={img.filename}
                className="bg-[#202D38] border border-[#2D3B47] hover:border-[#22C96B]/40 rounded-2xl p-3 flex flex-col justify-between space-y-3 group transition-all"
              >
                <div className="aspect-[3/4] bg-[#1B2732] rounded-xl overflow-hidden border border-[#2D3B47] relative flex items-center justify-center p-1">
                  <img
                    src={img.url}
                    alt={img.filename}
                    className="max-w-full max-h-full object-contain rounded"
                  />
                  <div className="absolute top-2 left-2 bg-[#10171D]/80 backdrop-blur-md border border-[#2D3B47] px-2 py-0.5 rounded-lg text-[10px] font-extrabold text-white">
                    Pág. {img.pageNum}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] font-extrabold text-white truncate" title={img.filename}>
                    {img.filename}
                  </p>
                  <p className="text-[10px] font-semibold text-[#AEB8C1]">
                    {formatFileSize(img.size)} • {img.width}x{img.height} px
                  </p>
                </div>

                <button
                  onClick={() => handleDownloadSingle(img)}
                  className="w-full py-2 bg-[#1B2732] hover:bg-[#22C96B] hover:text-[#10171D] text-white border border-[#2D3B47] hover:border-[#22C96B] rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Baixar Imagem
                </button>
              </div>
            ))}
          </div>

        </motion.div>
      ) : isProcessing ? (
        /* PROCESSING VIEW */
        <div className="bg-[#1B2732] border border-[#2D3B47] rounded-[28px] p-8 text-center space-y-6 shadow-xl" id="pdf-images-processing">
          <div className="p-4 bg-[#202D38] border border-[#2D3B47] rounded-full inline-block animate-bounce">
            <Sparkles className="h-8 w-8 text-[#22C96B]" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="font-display font-extrabold text-lg text-white">
              Convertendo página {currentPage} de {totalToProcess}
            </h3>
            <p className="text-xs text-[#AEB8C1] font-semibold">
              Renderizando em {dpi} DPI ({outputFormat.toUpperCase()})...
            </p>
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <div className="w-full bg-[#202D38] rounded-full h-3 overflow-hidden border border-[#2D3B47]">
              <div 
                className="bg-[#22C96B] h-full transition-all duration-300 rounded-full"
                style={{ width: `${Math.round((currentPage / (totalToProcess || 1)) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-bold text-[#AEB8C1]">
              <span>Tempo decorrido: {elapsedSeconds}s</span>
              <span className="text-[#22C96B]">
                {Math.round((currentPage / (totalToProcess || 1)) * 100)}%
              </span>
            </div>
          </div>

          <div>
            <button
              onClick={handleCancel}
              className="px-5 py-2.5 bg-[#202D38] hover:bg-red-950/40 text-red-400 border border-[#2D3B47] hover:border-red-800/50 rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
            >
              Cancelar Conversão
            </button>
          </div>
        </div>
      ) : (
        /* WORKSPACE VIEW */
        <div className="space-y-8">
          
          {/* FILE DROPZONE OR FILE DETAILS CARD */}
          {!selectedFile ? (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#2D3B47] hover:border-[#22C96B]/60 bg-[#1B2732] hover:bg-[#202D38] rounded-[28px] p-8 md:p-12 text-center cursor-pointer transition-all duration-300"
              id="dropzone-pdf-to-images"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => e.target.files && e.target.files[0] && handleFileChange(e.target.files[0])}
              />

              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="p-4 bg-[#202D38] text-[#22C96B] rounded-2xl border border-[#2D3B47] shadow-inner">
                  <Upload className="h-8 w-8" />
                </div>
                <div className="space-y-1">
                  <p className="font-display font-extrabold text-base md:text-lg text-white">
                    Arraste seu arquivo PDF aqui ou <span className="text-[#22C96B] underline underline-offset-4">clique para selecionar</span>
                  </p>
                  <p className="text-xs text-[#AEB8C1] font-semibold">
                    Selecione um PDF para extrair as páginas como imagens JPG ou PNG.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* ACTIVE FILE CONFIG & PAGE SELECTION */
            <div className="space-y-8">
              
              {/* FILE SUMMARY CARD */}
              <div className="bg-[#1B2732] border border-[#2D3B47] rounded-[24px] p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="p-3 bg-[#202D38] text-[#22C96B] rounded-2xl border border-[#2D3B47] shrink-0">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display font-extrabold text-base text-white truncate" title={selectedFile.name}>
                      {selectedFile.name}
                    </h3>
                    <p className="text-xs text-[#AEB8C1] font-semibold mt-0.5">
                      {formatFileSize(selectedFile.size)} • {totalPages} {totalPages === 1 ? "página" : "páginas"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleRemoveFile}
                  className="px-3.5 py-2 bg-[#202D38] hover:bg-red-950/40 text-red-400 border border-[#2D3B47] hover:border-red-800/40 rounded-xl text-xs font-extrabold transition-colors cursor-pointer shrink-0"
                >
                  Remover
                </button>
              </div>

              {/* GRID: CONFIG ON RIGHT, PAGE SELECTION PREVIEW ON LEFT */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                
                {/* LEFT 2 COLS: PAGE SELECTION & THUMBNAILS */}
                <div className="lg:col-span-2 space-y-6">
                  
                  {/* SELECTION MODE SELECTOR */}
                  <div className="bg-[#1B2732] border border-[#2D3B47] rounded-[24px] p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2D3B47] pb-3">
                      <h3 className="font-display font-extrabold text-base text-white">
                        Seleção de Páginas ({selectedPageNumbers.length} de {totalPages})
                      </h3>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleSelectAllPages}
                          className="px-3 py-1.5 bg-[#202D38] hover:bg-[#2B3945] text-[#22C96B] border border-[#2D3B47] rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
                        >
                          Selecionar Todas
                        </button>
                        <button
                          onClick={handleClearSelection}
                          className="px-3 py-1.5 bg-[#202D38] hover:bg-[#2B3945] text-[#AEB8C1] border border-[#2D3B47] rounded-xl text-xs font-extrabold transition-colors cursor-pointer"
                        >
                          Limpar
                        </button>
                      </div>
                    </div>

                    {/* RANGE INPUT */}
                    <div className="space-y-2">
                      <label className="text-xs font-extrabold text-[#AEB8C1] uppercase tracking-wider block">
                        Intervalo de Páginas (ex: 1-5, 1,3,7, 2-4,8):
                      </label>
                      <input
                        type="text"
                        value={rangeInput}
                        onChange={(e) => handleRangeInputChange(e.target.value)}
                        placeholder="Ex: 1-5, 8"
                        className="w-full bg-[#202D38] border border-[#2D3B47] focus:border-[#22C96B] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none transition-colors"
                      />
                    </div>
                  </div>

                  {/* PAGE THUMBNAILS GRID */}
                  <div className="bg-[#1B2732] border border-[#2D3B47] rounded-[24px] p-5 space-y-4">
                    <h4 className="font-display font-extrabold text-sm text-[#AEB8C1]">
                      Clique nas miniaturas para selecionar ou desmarcar páginas:
                    </h4>

                    {isLoadingThumbnails ? (
                      <div className="p-8 text-center text-xs text-[#AEB8C1] font-semibold animate-pulse">
                        Gerando prévias das páginas do PDF...
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                        {thumbnails.map((thumb) => {
                          const isSelected = selectedPageNumbers.includes(thumb.pageNum);
                          return (
                            <div
                              key={thumb.pageNum}
                              onClick={() => togglePageSelection(thumb.pageNum)}
                              className={`aspect-[3/4] bg-[#202D38] rounded-2xl border p-2 flex flex-col justify-between cursor-pointer relative transition-all group ${
                                isSelected 
                                  ? "border-[#22C96B] bg-[#173A2A]/30 shadow-md shadow-[#22C96B]/10" 
                                  : "border-[#2D3B47] opacity-60 hover:opacity-100"
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] font-extrabold z-10">
                                <span className="bg-[#10171D]/80 text-white px-2 py-0.5 rounded-md">
                                  Pág. {thumb.pageNum}
                                </span>
                                {isSelected ? (
                                  <CheckSquare className="h-4 w-4 text-[#22C96B]" />
                                ) : (
                                  <Square className="h-4 w-4 text-[#AEB8C1]" />
                                )}
                              </div>

                              <div className="flex-1 flex items-center justify-center overflow-hidden my-1">
                                <img 
                                  src={thumb.dataUrl} 
                                  alt={`Página ${thumb.pageNum}`} 
                                  className="max-w-full max-h-full object-contain rounded"
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>

                {/* RIGHT COL: CONVERSION OPTIONS CARD */}
                <div className="bg-[#1B2732] border border-[#2D3B47] rounded-[24px] p-6 space-y-6 shadow-md">
                  <h3 className="font-display font-extrabold text-base text-white border-b border-[#2D3B47] pb-3">
                    Opções da Imagem
                  </h3>

                  {/* Format */}
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-[#AEB8C1] uppercase tracking-wider block">
                      Formato de Saída:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setOutputFormat("jpg")}
                        className={`py-2.5 text-xs font-extrabold rounded-xl border transition-all cursor-pointer ${
                          outputFormat === "jpg"
                            ? "bg-[#22C96B] text-[#10171D] border-[#22C96B]"
                            : "bg-[#202D38] text-white border-[#2D3B47]"
                        }`}
                      >
                        JPG (Ideal)
                      </button>
                      <button
                        type="button"
                        onClick={() => setOutputFormat("png")}
                        className={`py-2.5 text-xs font-extrabold rounded-xl border transition-all cursor-pointer ${
                          outputFormat === "png"
                            ? "bg-[#22C96B] text-[#10171D] border-[#22C96B]"
                            : "bg-[#202D38] text-white border-[#2D3B47]"
                        }`}
                      >
                        PNG (Sem perdas)
                      </button>
                    </div>
                  </div>

                  {/* JPG Quality */}
                  {outputFormat === "jpg" && (
                    <div className="space-y-2">
                      <label className="text-xs font-extrabold text-[#AEB8C1] uppercase tracking-wider block">
                        Qualidade JPG:
                      </label>
                      <select
                        value={jpgQuality}
                        onChange={(e) => setJpgQuality(e.target.value as JpgQualityOption)}
                        className="w-full bg-[#202D38] border border-[#2D3B47] focus:border-[#22C96B] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                      >
                        <option value="high">Alta (Recomendado - 85%)</option>
                        <option value="maximum">Máxima (95%)</option>
                        <option value="medium">Média (70%)</option>
                        <option value="economic">Econômica (55%)</option>
                      </select>
                    </div>
                  )}

                  {/* DPI Resolution */}
                  <div className="space-y-2">
                    <label className="text-xs font-extrabold text-[#AEB8C1] uppercase tracking-wider block">
                      Resolução (DPI):
                    </label>
                    <select
                      value={dpi}
                      onChange={(e) => setDpi(Number(e.target.value) as DpiOption)}
                      className="w-full bg-[#202D38] border border-[#2D3B47] focus:border-[#22C96B] rounded-xl px-3.5 py-2.5 text-xs font-bold text-white outline-none cursor-pointer"
                    >
                      <option value={150}>150 DPI (Padrão Recomendado)</option>
                      <option value={72}>72 DPI (Telas pequenas)</option>
                      <option value={96}>96 DPI (Web padrão)</option>
                      <option value={200}>200 DPI (Alta definição)</option>
                      <option value={300}>300 DPI (Impressão / Nitidez máxima)</option>
                    </select>

                    <p className="text-[11px] text-[#AEB8C1] font-semibold mt-1 bg-[#202D38] p-2.5 rounded-xl border border-[#2D3B47]">
                      💡 Resoluções maiores geram imagens mais pesadas e exigem mais memória do seu computador.
                    </p>
                  </div>

                  {/* White background option */}
                  <div className="pt-2 border-t border-[#2D3B47]">
                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={whiteBackground}
                        onChange={(e) => setWhiteBackground(e.target.checked)}
                        className="rounded accent-[#22C96B] w-4 h-4 cursor-pointer"
                      />
                      <span>Preencher fundo branco</span>
                    </label>
                  </div>

                  {/* CONVERT BUTTON */}
                  <button
                    onClick={handleStartConversion}
                    disabled={selectedPageNumbers.length === 0}
                    className="w-full py-4 bg-[#22C96B] hover:bg-[#1eb860] disabled:opacity-50 text-[#10171D] rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#22C96B]/20 transition-all cursor-pointer active:scale-[0.99]"
                    id="btn-convert-pdf-to-images"
                  >
                    <ImageIcon className="h-5 w-5" />
                    Converter {selectedPageNumbers.length} {selectedPageNumbers.length === 1 ? "Página" : "Páginas"}
                  </button>

                </div>

              </div>

            </div>
          )}

          {/* Privacy footer info */}
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
