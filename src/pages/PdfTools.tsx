/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  FileText, 
  Upload, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  X, 
  ArrowLeft, 
  ChevronUp, 
  ChevronDown, 
  Layers, 
  Scissors, 
  RotateCw, 
  RefreshCw,
  Image, 
  FileImage, 
  Info, 
  Sparkles, 
  ShieldCheck 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PDFDocument, degrees, PDFRawStream, PDFDict, PDFName, PDFNumber } from "pdf-lib";
import * as pdfjs from "pdfjs-dist";
import { trackEvent } from "../lib/gtag";

type PdfToolType = "none" | "merge" | "compress" | "imgToPdf" | "organize" | "deleteRotate";

interface FileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl?: string;
}

interface PageItem {
  index: number; // 0-indexed original page
  label: string; // "Página X"
  rotation: number; // 0, 90, 180, 270
  deleted: boolean;
}

export interface PdfToolsProps {
  activeTool?: PdfToolType;
  setActiveTool?: (tool: PdfToolType) => void;
}

export default function PdfTools({ activeTool: propActiveTool, setActiveTool: propSetActiveTool }: PdfToolsProps = {}) {
  const [localActiveTool, setLocalActiveTool] = useState<PdfToolType>("none");
  const activeTool = propActiveTool !== undefined ? propActiveTool : localActiveTool;
  const setActiveTool = propSetActiveTool !== undefined ? propSetActiveTool : setLocalActiveTool;
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [dragActive, setDragActive] = useState<boolean>(false);

  useEffect(() => {
    if (activeTool && activeTool !== "none") {
      trackEvent("pdf_tool_opened", { tool: activeTool });
    }
  }, [activeTool]);


  // Download states
  const [downloadBlobUrl, setDownloadBlobUrl] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState<string | null>(null);
  const [outputSize, setOutputSize] = useState<number | null>(null);
  const [originalSize, setOriginalSize] = useState<number | null>(null);

  // States for MERGE tool
  const [mergeFiles, setMergeFiles] = useState<FileItem[]>([]);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  // States for COMPRESS tool
  const [compressFile, setCompressFile] = useState<FileItem | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<"low" | "medium" | "high" | "very_high">("medium");
  const compressInputRef = useRef<HTMLInputElement>(null);
  const [sampleOriginalUrl, setSampleOriginalUrl] = useState<string | null>(null);
  const [sampleCompressedUrl, setSampleCompressedUrl] = useState<string | null>(null);
  const [sampleRawBytes, setSampleRawBytes] = useState<Uint8Array | null>(null);
  const [sampleFilter, setSampleFilter] = useState<string>("");
  const [hasImages, setHasImages] = useState<boolean | null>(null);

  // Deep Compression specific states
  const [pdfDiagnosis, setPdfDiagnosis] = useState<{
    originalSize: number;
    numPages: number;
    dimensions: string;
    hasImages: boolean;
    imageCount: number;
    contentType: "Texto e Vetores" | "Escaneado (Imagem principal)" | "Predominantemente Escaneado" | "Misto (Texto + Imagens)";
    potentialReduction: string;
    isOptimized: boolean;
  } | null>(null);

  const [targetSizeOption, setTargetSizeOption] = useState<string>("max"); // max, 1mb, 2mb, 5mb, 10mb, custom
  const [customTargetSizeMB, setCustomTargetSizeMB] = useState<number>(1);
  const [colorOption, setColorOption] = useState<"original" | "grayscale" | "monochrome">("original");
  const [compressionStrategy, setCompressionStrategy] = useState<"structural" | "raster">("structural");

  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [isCancelled, setIsCancelled] = useState<boolean>(false);
  const isCancelledRef = useRef<boolean>(false);

  const [compressionResults, setCompressionResults] = useState<{
    originalSize: number;
    finalSize: number;
    reductionKB: number;
    reductionPercent: number;
    levelUsed: string;
    strategyUsed: string;
    attempts: number;
    averageQuality: number;
    processingTime: string;
    message: string;
    status: "success" | "low_reduction" | "already_optimized" | "larger" | "no_benefit";
    originalBytes: Uint8Array;
    compressedBytes: Uint8Array;
    dpiUsed: number | string;
    jpegUsed: number;
    textPreserved: "Sim" | "Não";
    rasterized: "Sim" | "Não";
  } | null>(null);

  const [selectedPreviewPage, setSelectedPreviewPage] = useState<number>(1);

  // States for IMAGES TO PDF tool
  const [imgFiles, setImgFiles] = useState<FileItem[]>([]);
  const [imgQuality, setImgQuality] = useState<"original" | "alta" | "equilibrada" | "compacta">("original");
  const [pageSize, setPageSize] = useState<"a4" | "letter" | "fit">("a4");
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait");
  const [marginSize, setMarginSize] = useState<"none" | "small" | "large">("none");
  const imgInputRef = useRef<HTMLInputElement>(null);

  // States for ORGANIZE tool
  const [organizeFile, setOrganizeFile] = useState<FileItem | null>(null);
  const [organizePages, setOrganizePages] = useState<PageItem[]>([]);
  const organizeInputRef = useRef<HTMLInputElement>(null);

  // States for DELETE & ROTATE tool
  const [drFile, setDrFile] = useState<FileItem | null>(null);
  const [drPages, setDrPages] = useState<PageItem[]>([]);
  const drInputRef = useRef<HTMLInputElement>(null);

  // Clean URLs on unmount
  useEffect(() => {
    return () => {
      if (downloadBlobUrl) URL.revokeObjectURL(downloadBlobUrl);
      if (sampleOriginalUrl) URL.revokeObjectURL(sampleOriginalUrl);
      if (sampleCompressedUrl) URL.revokeObjectURL(sampleCompressedUrl);
      imgFiles.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    };
  }, [downloadBlobUrl, sampleOriginalUrl, sampleCompressedUrl, imgFiles]);

  const formatBytes = (bytes: number, decimals = 1) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const compressImageBytes = async (
    rawBytes: Uint8Array,
    quality: number,
    maxDim: number,
    originalFilter: string
  ): Promise<{ bytes: Uint8Array; width: number; height: number; filter: string } | null> => {
    return new Promise((resolve) => {
      let mimeType = "image/jpeg";
      if (originalFilter === "FlateDecode") {
        mimeType = "image/png";
      }

      const blob = new Blob([rawBytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const img = new window.Image();
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        let width = img.width;
        let height = img.height;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64Data = compressedDataUrl.split(",")[1];
        const compressedBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        resolve({
          bytes: compressedBytes,
          width,
          height,
          filter: "DCTDecode"
        });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      
      img.src = url;
    });
  };

  const convertWebPToJpg = async (arrayBuffer: ArrayBuffer, quality = 0.95): Promise<ArrayBuffer> => {
    return new Promise((resolve, reject) => {
      const blob = new Blob([arrayBuffer], { type: "image/webp" });
      const url = URL.createObjectURL(blob);
      const img = new window.Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((resultBlob) => {
          if (resultBlob) {
            resultBlob.arrayBuffer().then(resolve);
          } else {
            reject(new Error("WebP conversion failed"));
          }
        }, "image/jpeg", quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not load WebP image"));
      };
      img.src = url;
    });
  };

  const compressImageForPdf = async (
    arrayBuffer: ArrayBuffer,
    mimeType: string,
    qualityKey: "alta" | "equilibrada" | "compacta"
  ): Promise<{ bytes: ArrayBuffer; isPng: boolean }> => {
    return new Promise((resolve) => {
      let quality = 0.85;
      let maxDim = 2400;
      
      if (qualityKey === "alta") {
        quality = 0.90;
        maxDim = 2400;
      } else if (qualityKey === "equilibrada") {
        quality = 0.75;
        maxDim = 1600;
      } else if (qualityKey === "compacta") {
        quality = 0.50;
        maxDim = 1000;
      }
      
      const blob = new Blob([arrayBuffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const img = new window.Image();
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        let width = img.width;
        let height = img.height;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ bytes: arrayBuffer, isPng: mimeType === "image/png" });
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((compressedBlob) => {
          if (compressedBlob) {
            compressedBlob.arrayBuffer().then(buf => {
              resolve({ bytes: buf, isPng: false });
            });
          } else {
            resolve({ bytes: arrayBuffer, isPng: mimeType === "image/png" });
          }
        }, "image/jpeg", quality);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ bytes: arrayBuffer, isPng: mimeType === "image/png" });
      };
      
      img.src = url;
    });
  };

  const generateCompressionPreview = async (
    rawBytes: Uint8Array,
    level: "low" | "medium" | "high" | "very_high",
    filter: string
  ) => {
    let quality = 0.65;
    let maxDim = 1200;
    
    if (level === "low") {
      quality = 0.85;
      maxDim = 1800;
    } else if (level === "medium") {
      quality = 0.65;
      maxDim = 1200;
    } else if (level === "high") {
      quality = 0.45;
      maxDim = 800;
    } else if (level === "very_high") {
      quality = 0.20;
      maxDim = 500;
    }
    
    const res = await compressImageBytes(rawBytes, quality, maxDim, filter);
    if (res) {
      const compressedBlob = new Blob([res.bytes], { type: "image/jpeg" });
      const compUrl = URL.createObjectURL(compressedBlob);
      setSampleCompressedUrl(prev => {
        if (prev) URL.revokeObjectURL(prev);
        return compUrl;
      });
    } else {
      setSampleCompressedUrl(null);
    }
  };

  useEffect(() => {
    if (sampleRawBytes && activeTool === "compress") {
      generateCompressionPreview(sampleRawBytes, compressionLevel, sampleFilter);
    }
  }, [compressionLevel, sampleRawBytes, activeTool]);

  const handleResetTool = () => {
    setActiveTool("none");
    setGlobalError(null);
    setSuccessMessage(null);
    setIsProcessing(false);
    setProgress(0);
    setDownloadBlobUrl(null);
    setDownloadFileName(null);
    setOutputSize(null);
    setOriginalSize(null);
    
    // Reset specific states
    setMergeFiles([]);
    setCompressFile(null);
    if (sampleOriginalUrl) URL.revokeObjectURL(sampleOriginalUrl);
    if (sampleCompressedUrl) URL.revokeObjectURL(sampleCompressedUrl);
    setSampleOriginalUrl(null);
    setSampleCompressedUrl(null);
    setSampleRawBytes(null);
    setSampleFilter("");
    setHasImages(null);
    setImgQuality("original");
    
    // Clean deep compression specific states
    setPdfDiagnosis(null);
    setTargetSizeOption("max");
    setCustomTargetSizeMB(1);
    setColorOption("original");
    setCompressionStrategy("structural");
    setProcessingStatus("");
    setIsCancelled(false);
    setCompressionResults(null);
    setSelectedPreviewPage(1);
    
    imgFiles.forEach(f => f.previewUrl && URL.revokeObjectURL(f.previewUrl));
    setImgFiles([]);
    
    setOrganizeFile(null);
    setOrganizePages([]);
    setDrFile(null);
    setDrPages([]);
  };

  const triggerInput = (ref: React.RefObject<HTMLInputElement | null>) => {
    ref.current?.click();
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // 1. MERGE TOOL FUNCTIONS
  const handleMergeFilesAdded = (files: FileList) => {
    setGlobalError(null);
    const added: FileItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setGlobalError("Apenas arquivos PDF são aceitos para mesclagem.");
        continue;
      }
      added.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        size: file.size
      });
    }
    setMergeFiles(prev => [...prev, ...added]);
  };

  const moveMergeItem = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === mergeFiles.length - 1) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const updated = [...mergeFiles];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setMergeFiles(updated);
  };

  const removeMergeItem = (id: string) => {
    setMergeFiles(prev => prev.filter(item => item.id !== id));
  };

  const processMerge = async () => {
    if (mergeFiles.length < 2) {
      setGlobalError("Por favor, adicione pelo menos 2 arquivos PDF para juntar.");
      return;
    }

    setIsProcessing(true);
    setProgress(20);
    setGlobalError(null);
    setSuccessMessage(null);

    trackEvent("pdf_processing_started", { tool: "merge", files_count: mergeFiles.length });

    try {
      const mergedPdf = await PDFDocument.create();
      setProgress(40);

      for (let i = 0; i < mergeFiles.length; i++) {
        const fileItem = mergeFiles[i];
        const bytes = await fileItem.file.arrayBuffer();
        const pdf = await PDFDocument.load(bytes);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach(page => mergedPdf.addPage(page));
        
        const currentProgress = 40 + Math.round(((i + 1) / mergeFiles.length) * 40);
        setProgress(Math.min(85, currentProgress));
      }

      setProgress(90);
      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([mergedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      
      setDownloadBlobUrl(url);
      setDownloadFileName("documento_juntado.pdf");
      setOutputSize(blob.size);
      
      // Calculate original total size
      const origTotal = mergeFiles.reduce((sum, item) => sum + item.size, 0);
      setOriginalSize(origTotal);
      
      setSuccessMessage("PDFs juntados com sucesso!");
      setProgress(100);

      trackEvent("pdf_processing_completed", {
        tool: "merge",
        original_size: origTotal,
        converted_size: blob.size,
      });
    } catch (err: any) {
      console.error(err);
      setGlobalError("Ocorreu um erro ao mesclar os arquivos. Verifique se nenhum PDF está protegido por senha.");
      trackEvent("pdf_processing_failed", {
        tool: "merge",
        error_message: err.message || String(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. COMPRESS TOOL FUNCTIONS

  const compressRawImage = async (
    rawBytes: Uint8Array,
    quality: number,
    maxDim: number,
    colorMode: "original" | "grayscale" | "monochrome"
  ): Promise<{ bytes: Uint8Array; width: number; height: number; filter: string } | null> => {
    return new Promise((resolve) => {
      let mimeType = "image/jpeg";
      const blob = new Blob([rawBytes], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const img = new window.Image();
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        let width = img.width;
        let height = img.height;
        
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        if (colorMode === "grayscale" || colorMode === "monochrome") {
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            const gray = 0.299 * r + 0.587 * g + 0.114 * b;
            if (colorMode === "monochrome") {
              const val = gray > 127 ? 255 : 0;
              data[i] = data[i+1] = data[i+2] = val;
            } else {
              data[i] = data[i+1] = data[i+2] = gray;
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }
        
        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64Data = compressedDataUrl.split(",")[1];
        const compressedBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        
        // Free canvas memory
        canvas.width = 0;
        canvas.height = 0;

        resolve({
          bytes: compressedBytes,
          width,
          height,
          filter: "DCTDecode"
        });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      
      img.src = url;
    });
  };

  const handleCancelCompress = () => {
    isCancelledRef.current = true;
    setIsCancelled(true);
    setIsProcessing(false);
    setProcessingStatus("");
    setProgress(0);
    setGlobalError("A compressão do PDF foi cancelada pelo usuário.");
  };

  const handleCompressFileAdded = async (files: FileList) => {
    setGlobalError(null);
    setSuccessMessage(null);
    setCompressionResults(null);
    if (files.length === 0) return;
    const file = files[0];
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setGlobalError("Por favor, selecione um arquivo PDF válido.");
      return;
    }

    if (sampleOriginalUrl) URL.revokeObjectURL(sampleOriginalUrl);
    if (sampleCompressedUrl) URL.revokeObjectURL(sampleCompressedUrl);
    setSampleOriginalUrl(null);
    setSampleCompressedUrl(null);
    setSampleRawBytes(null);
    setSampleFilter("");
    setHasImages(null);

    setCompressFile({
      id: "compress-file",
      file,
      name: file.name,
      size: file.size
    });

    setIsProcessing(true);
    setProcessingStatus("Analisando o conteúdo do PDF...");
    setProgress(15);

    try {
      const bytes = await file.arrayBuffer();
      
      // Load with pdf-lib to run quick structural diagnostic
      const pdfLibDoc = await PDFDocument.load(bytes);
      const numPages = pdfLibDoc.getPageCount();
      
      let dimensions = "Desconhecido";
      if (numPages > 0) {
        const firstPage = pdfLibDoc.getPage(0);
        const { width, height } = firstPage.getSize();
        dimensions = `${Math.round(width)} × ${Math.round(height)} pt`;
      }

      const indirectObjects = pdfLibDoc.context.enumerateIndirectObjects();
      let imageCount = 0;
      
      for (const [ref, obj] of indirectObjects) {
        if (obj instanceof PDFRawStream) {
          const dict = obj.dict;
          const subtype = dict.get(PDFName.of("Subtype"));
          if (subtype === PDFName.of("Image")) {
            imageCount++;
          }
        }
      }

      setProgress(50);

      // Analyze page texts using pdfjs-dist
      let textPagesCount = 0;
      try {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version || "6.1.200"}/build/pdf.worker.min.mjs`;
        const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
        const pdfjsDoc = await loadingTask.promise;
        const pagesToAnalyze = Math.min(numPages, 10);
        
        for (let i = 0; i < pagesToAnalyze; i++) {
          const page = await pdfjsDoc.getPage(i + 1);
          const textContent = await page.getTextContent();
          if (textContent.items.length > 5) {
            textPagesCount++;
          }
        }
      } catch (err) {
        console.error("Error analyzing text in PDF:", err);
        if (imageCount === 0) textPagesCount = numPages;
      }

      setProgress(85);

      const hasImages = imageCount > 0;
      const isScanned = hasImages && textPagesCount === 0;
      
      let contentType: "Texto e Vetores" | "Escaneado (Imagem principal)" | "Predominantemente Escaneado" | "Misto (Texto + Imagens)" = "Texto e Vetores";
      if (hasImages) {
        if (isScanned) {
          contentType = "Escaneado (Imagem principal)";
        } else if (textPagesCount < numPages * 0.4) {
          contentType = "Predominantemente Escaneado";
        } else {
          contentType = "Misto (Texto + Imagens)";
        }
      }

      let potentialReduction = "Baixo (0% - 10%)";
      if (hasImages) {
        if (isScanned || contentType.includes("Escaneado")) {
          potentialReduction = "Altíssimo (60% - 90%)";
        } else {
          potentialReduction = "Médio a Alto (30% - 60%)";
        }
      } else if (file.size > 2 * 1024 * 1024) {
        potentialReduction = "Baixo a Médio (5% - 15%)";
      }

      const isOptimized = file.size < 400 * 1024 && hasImages && imageCount > 4;

      setPdfDiagnosis({
        originalSize: file.size,
        numPages,
        dimensions,
        hasImages,
        imageCount,
        contentType,
        potentialReduction,
        isOptimized
      });

      // Default strategy recommendation based on diagnosis
      if (isScanned || contentType.includes("Escaneado")) {
        setCompressionStrategy("raster");
      } else {
        setCompressionStrategy("structural");
      }

      setProgress(100);
    } catch (err: any) {
      console.error(err);
      setGlobalError("Falha ao analisar o PDF. O arquivo pode estar corrompido ou protegido por senha.");
    } finally {
      setIsProcessing(false);
      setProcessingStatus("");
    }
  };

  const processCompress = async () => {
    if (!compressFile) return;

    setIsProcessing(true);
    setGlobalError(null);
    setSuccessMessage(null);
    setCompressionResults(null);
    setIsCancelled(false);
    isCancelledRef.current = false;
    setProgress(5);

    trackEvent("pdf_processing_started", {
      tool: "compress",
      strategy: compressionStrategy,
      level: targetSizeOption,
    });

    const startTime = Date.now();
    
    try {
      const originalBytes = new Uint8Array(await compressFile.file.arrayBuffer());
      const originalSize = originalBytes.length;

      let targetSizeBytes = Infinity;
      if (targetSizeOption === "1mb") targetSizeBytes = 1 * 1024 * 1024;
      else if (targetSizeOption === "2mb") targetSizeBytes = 2 * 1024 * 1024;
      else if (targetSizeOption === "5mb") targetSizeBytes = 5 * 1024 * 1024;
      else if (targetSizeOption === "10mb") targetSizeBytes = 10 * 1024 * 1024;
      else if (targetSizeOption === "custom") targetSizeBytes = customTargetSizeMB * 1024 * 1024;

      const pLow = { level: "low" as const, maxDim: 2200, quality: 0.90, scale: 220 / 72, dpi: 220 };
      const pMedium = { level: "medium" as const, maxDim: 1700, quality: 0.82, scale: 170 / 72, dpi: 170 };
      const pHigh = { level: "high" as const, maxDim: 1300, quality: 0.66, scale: 130 / 72, dpi: 130 };
      const pVeryHigh = { level: "very_high" as const, maxDim: 1000, quality: 0.48, scale: 100 / 72, dpi: 100 };

      // Build the candidate array up to the selected compressionLevel
      let candidates: Array<{
        level: "low" | "medium" | "high" | "very_high";
        maxDim: number;
        quality: number;
        scale: number;
        dpi: number;
      }> = [];

      if (compressionLevel === "low") {
        candidates = [pLow];
      } else if (compressionLevel === "medium") {
        candidates = [pLow, pMedium];
      } else if (compressionLevel === "high") {
        candidates = [pLow, pMedium, pHigh];
      } else if (compressionLevel === "very_high") {
        candidates = [pLow, pMedium, pHigh, pVeryHigh];
      }

      // Single attempt runner
      const runSingleCompressionAttempt = async (
        params: { maxDim: number; quality: number; scale: number; dpi: number },
        progressStart: number,
        progressEnd: number
      ): Promise<Uint8Array | null> => {
        const progressRange = progressEnd - progressStart;
        if (compressionStrategy === "structural") {
          const pdfDoc = await PDFDocument.load(originalBytes);
          const indirectObjects = pdfDoc.context.enumerateIndirectObjects();
          
          let totalImages = 0;
          for (const [ref, obj] of indirectObjects) {
            if (obj instanceof PDFRawStream) {
              const dict = obj.dict;
              const subtype = dict.get(PDFName.of("Subtype"));
              if (subtype === PDFName.of("Image")) {
                totalImages++;
              }
            }
          }

          let processedImages = 0;
          for (const [ref, obj] of indirectObjects) {
            if (isCancelledRef.current) return null;
            
            if (obj instanceof PDFRawStream) {
              const dict = obj.dict;
              const subtype = dict.get(PDFName.of("Subtype"));
              if (subtype === PDFName.of("Image")) {
                const rawBytes = obj.contents;
                
                // Only touch larger images
                if (rawBytes && rawBytes.length > 1000) {
                  setProcessingStatus(`Otimizando imagens (${processedImages + 1}/${totalImages})...`);
                  setProgress(progressStart + Math.round((processedImages / Math.max(1, totalImages)) * progressRange * 0.85));

                  const res = await compressRawImage(
                    rawBytes,
                    params.quality,
                    params.maxDim,
                    colorOption
                  );

                  if (res && res.bytes.length < rawBytes.length) {
                    const newStream = PDFRawStream.of(dict, res.bytes);
                    pdfDoc.context.assign(ref, newStream);

                    dict.set(PDFName.of("Length"), PDFNumber.of(res.bytes.length));
                    dict.set(PDFName.of("Width"), PDFNumber.of(res.width));
                    dict.set(PDFName.of("Height"), PDFNumber.of(res.height));
                    dict.set(PDFName.of("Filter"), PDFName.of(res.filter));
                    dict.set(PDFName.of("ColorSpace"), PDFName.of("DeviceRGB"));
                    dict.delete(PDFName.of("DecodeParms"));
                  }
                }
                processedImages++;
              }
            }
          }

          if (isCancelledRef.current) return null;

          setProcessingStatus("Sincronizando estrutura...");
          setProgress(progressStart + Math.round(progressRange * 0.95));

          pdfDoc.context.enumerateIndirectObjects().forEach(([ref, obj]) => {
            if (obj instanceof PDFDict) {
              obj.delete(PDFName.of("PieceInfo"));
              obj.delete(PDFName.of("Metadata"));
            }
          });

          return await pdfDoc.save({ useObjectStreams: true });
        } else {
          // RASTER strategy
          pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version || "6.1.200"}/build/pdf.worker.min.mjs`;
          const loadingTask = pdfjs.getDocument({ data: originalBytes.slice() });
          const pdfjsDoc = await loadingTask.promise;
          const numPages = pdfjsDoc.numPages;

          const newPdfDoc = await PDFDocument.create();

          for (let i = 0; i < numPages; i++) {
            if (isCancelledRef.current) return null;

            setProcessingStatus(`Rasterizando pág. ${i + 1}/${numPages} (${params.dpi} DPI)...`);
            setProgress(progressStart + Math.round((i / numPages) * progressRange * 0.9));

            const page = await pdfjsDoc.getPage(i + 1);
            const viewport = page.getViewport({ scale: params.scale });
            
            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext("2d");
            
            if (ctx) {
              await page.render({ canvasContext: ctx, viewport } as any).promise;

              if (colorOption === "grayscale" || colorOption === "monochrome") {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                for (let j = 0; j < data.length; j += 4) {
                  const gray = 0.299 * data[j] + 0.587 * data[j+1] + 0.114 * data[j+2];
                  if (colorOption === "monochrome") {
                    const val = gray > 127 ? 255 : 0;
                    data[j] = data[j+1] = data[j+2] = val;
                  } else {
                    data[j] = data[j+1] = data[j+2] = gray;
                  }
                }
                ctx.putImageData(imgData, 0, 0);
              }

              const compressedDataUrl = canvas.toDataURL("image/jpeg", params.quality);
              const base64Data = compressedDataUrl.split(",")[1];
              const jpegBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

              const embeddedImg = await newPdfDoc.embedJpg(jpegBytes);
              
              const origViewport = page.getViewport({ scale: 1.0 });
              const pdfPage = newPdfDoc.addPage([origViewport.width, origViewport.height]);
              
              pdfPage.drawImage(embeddedImg, {
                x: 0,
                y: 0,
                width: origViewport.width,
                height: origViewport.height
              });
            }

            canvas.width = 0;
            canvas.height = 0;
          }

          if (isCancelledRef.current) return null;

          setProcessingStatus("Compilando novo PDF...");
          setProgress(progressStart + Math.round(progressRange * 0.98));
          return await newPdfDoc.save({ useObjectStreams: true });
        }
      };

      let results: Array<{
        params: { level: "low" | "medium" | "high" | "very_high"; maxDim: number; quality: number; scale: number; dpi: number };
        bytes: Uint8Array;
        size: number;
      }> = [];

      let winner: {
        params: { level: "low" | "medium" | "high" | "very_high"; maxDim: number; quality: number; scale: number; dpi: number };
        bytes: Uint8Array;
        size: number;
      } | null = null;

      let targetSizeNotReachedButPreserved = false;

      if (targetSizeOption === "max" || targetSizeOption === "") {
        // Mode A: Smart Candidate Selection (No specific target size)
        for (let i = 0; i < candidates.length; i++) {
          if (isCancelledRef.current) break;
          const candidate = candidates[i];
          const progressStart = 5 + (i * 85) / candidates.length;
          const progressEnd = 5 + ((i + 1) * 85) / candidates.length;

          setProcessingStatus(`Executando otimização com perfil ${candidate.level === "low" ? "Leve" : candidate.level === "medium" ? "Equilibrado" : candidate.level === "high" ? "Forte" : "Muito Forte"}...`);
          const bytes = await runSingleCompressionAttempt(candidate, progressStart, progressEnd);
          if (bytes) {
            results.push({ params: candidate, bytes, size: bytes.length });
          }
        }

        if (isCancelledRef.current) {
          setIsProcessing(false);
          setProcessingStatus("");
          return;
        }

        // Now select the smartest candidate
        if (results.length > 0) {
          let selectedIdx = 0;
          for (let i = 1; i < results.length; i++) {
            const prevSize = results[selectedIdx].size;
            const currentSize = results[i].size;
            
            // Check if dropping quality further is worth it (saving at least 15% and >50KB)
            const relativeReduction = ((prevSize - currentSize) / prevSize) * 100;
            const sizeDiff = prevSize - currentSize;
            
            if (relativeReduction >= 15 && sizeDiff > 50 * 1024) {
              selectedIdx = i;
            } else {
              // If it's not worth it, stop downgrading quality and stick with current selected
              break;
            }
          }
          winner = results[selectedIdx];
        }
      } else {
        // Mode B: Target Size Capping
        for (let i = 0; i < candidates.length; i++) {
          if (isCancelledRef.current) break;
          const candidate = candidates[i];
          const progressStart = 5 + (i * 85) / candidates.length;
          const progressEnd = 5 + ((i + 1) * 85) / candidates.length;

          setProcessingStatus(`Testando perfil de qualidade ${candidate.level === "low" ? "Leve" : candidate.level === "medium" ? "Equilibrado" : candidate.level === "high" ? "Forte" : "Muito Forte"} para meta de tamanho...`);
          const bytes = await runSingleCompressionAttempt(candidate, progressStart, progressEnd);
          if (bytes) {
            winner = { params: candidate, bytes, size: bytes.length };
            if (bytes.length <= targetSizeBytes) {
              // Target reached! We can stop immediately to preserve quality
              break;
            }
          }
        }

        if (isCancelledRef.current) {
          setIsProcessing(false);
          setProcessingStatus("");
          return;
        }

        if (winner && winner.size > targetSizeBytes) {
          targetSizeNotReachedButPreserved = true;
        }
      }

      if (!winner) {
        setIsProcessing(false);
        setProcessingStatus("");
        return;
      }

      setProgress(95);
      setProcessingStatus("Calculando resultados e gerando prévias...");

      const finalSizeActual = winner.size;
      const reductionKB = originalSize - finalSizeActual;
      const reductionPercent = (reductionKB / originalSize) * 100;
      const timeSpent = ((Date.now() - startTime) / 1000).toFixed(1);

      let status: "success" | "low_reduction" | "already_optimized" | "larger" | "no_benefit" = "success";
      let message = "";
      let finalBytes = originalBytes;

      if (finalSizeActual < originalSize) {
        // If the reduction is under 10% and they chose max mode, do not keep the compressed PDF
        if (targetSizeOption === "max" && reductionPercent < 10) {
          status = "no_benefit";
          message = "A redução obtida não compensou a perda de qualidade. O original foi preservado.";
          finalBytes = originalBytes;
        } else if (reductionPercent < 10) {
          // If they chose a specific target and it reduced less than 10%, we keep it because they need the small size
          status = "low_reduction";
          message = "Este PDF apresentou pouca redução de tamanho.";
          finalBytes = winner.bytes;
        } else {
          status = "success";
          message = "PDF comprimido com sucesso.";
          finalBytes = winner.bytes;
        }
      } else {
        status = "larger";
        message = "A tentativa de compressão aumentou o tamanho do arquivo. O original foi mantido.";
        finalBytes = originalBytes;
      }

      if (downloadBlobUrl) URL.revokeObjectURL(downloadBlobUrl);
      const finalBlob = new Blob([finalBytes], { type: "application/pdf" });
      const downloadUrl = URL.createObjectURL(finalBlob);

      setDownloadBlobUrl(downloadUrl);
      setOutputSize(finalBytes.length);
      setOriginalSize(originalSize);

      const baseName = compressFile.name.substring(0, compressFile.name.lastIndexOf(".")) || compressFile.name;
      setDownloadFileName(status === "larger" || status === "no_benefit" ? `${baseName}.pdf` : `${baseName}_comprimido.pdf`);

      if (targetSizeNotReachedButPreserved) {
        message = "Não foi possível atingir o tamanho escolhido sem comprometer demais a qualidade. O limite visual de segurança foi aplicado.";
      }

      setCompressionResults({
        originalSize,
        finalSize: finalBytes.length,
        reductionKB: status === "larger" || status === "no_benefit" ? 0 : originalSize - finalBytes.length,
        reductionPercent: status === "larger" || status === "no_benefit" ? 0 : ((originalSize - finalBytes.length) / originalSize) * 100,
        levelUsed: winner.params.level,
        strategyUsed: compressionStrategy,
        attempts: results.length > 0 ? results.length : 1,
        averageQuality: winner.params.quality,
        processingTime: `${timeSpent}s`,
        message,
        status,
        originalBytes,
        compressedBytes: finalBytes,
        dpiUsed: winner.params.dpi,
        jpegUsed: Math.round(winner.params.quality * 100),
        textPreserved: compressionStrategy === "structural" ? "Sim" : "Não",
        rasterized: compressionStrategy === "raster" ? "Sim" : "Não"
      });

      setSuccessMessage(message);
      setProgress(100);
      setIsProcessing(false);
      setProcessingStatus("");

      trackEvent("pdf_processing_completed", {
        tool: "compress",
        original_size: originalSize,
        converted_size: finalBytes.length,
        compression_status: status,
      });

    } catch (err: any) {
      console.error(err);
      setGlobalError("Ocorreu um erro ao comprimir o PDF. Certifique-se de que o arquivo não é protegido.");
      setIsProcessing(false);
      setProcessingStatus("");

      trackEvent("pdf_processing_failed", {
        tool: "compress",
        error_message: err.message || String(err),
      });
    }
  };

  // 3. IMAGES TO PDF TOOL FUNCTIONS
  const handleImgFilesAdded = (files: FileList) => {
    setGlobalError(null);
    const added: FileItem[] = [];
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!allowed.includes(file.type) && !/\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
        setGlobalError("Formato de imagem inválido. Use JPG, PNG ou WebP.");
        continue;
      }
      added.push({
        id: Math.random().toString(36).substring(2, 9),
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file)
      });
    }
    setImgFiles(prev => [...prev, ...added]);
  };

  const moveImgItem = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === imgFiles.length - 1) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    const updated = [...imgFiles];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setImgFiles(updated);
  };

  const removeImgItem = (id: string) => {
    setImgFiles(prev => {
      const item = prev.find(f => f.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      return prev.filter(f => f.id !== id);
    });
  };

  const processImgToPdf = async () => {
    if (imgFiles.length === 0) {
      setGlobalError("Por favor, adicione pelo menos uma imagem para converter.");
      return;
    }

    setIsProcessing(true);
    setProgress(20);
    setGlobalError(null);
    setSuccessMessage(null);

    trackEvent("pdf_processing_started", { tool: "imgToPdf", files_count: imgFiles.length });

    try {
      const pdfDoc = await PDFDocument.create();
      setProgress(35);

      for (let i = 0; i < imgFiles.length; i++) {
        const imgItem = imgFiles[i];
        let arrayBuffer = await imgItem.file.arrayBuffer();
        let isPng = imgItem.file.type === "image/png" || imgItem.name.toLowerCase().endsWith(".png");
        const isWebp = imgItem.file.type === "image/webp" || imgItem.name.toLowerCase().endsWith(".webp");
        
        if (imgQuality === "original") {
          if (isWebp) {
            arrayBuffer = await convertWebPToJpg(arrayBuffer, 0.95);
            isPng = false;
          }
        } else {
          const compResult = await compressImageForPdf(arrayBuffer, imgItem.file.type, imgQuality);
          arrayBuffer = compResult.bytes;
          isPng = compResult.isPng;
        }

        let pdfImage;
        if (isPng) {
          pdfImage = await pdfDoc.embedPng(arrayBuffer);
        } else {
          pdfImage = await pdfDoc.embedJpg(arrayBuffer);
        }

        const imgWidth = pdfImage.width;
        const imgHeight = pdfImage.height;

        let pageWidth = imgWidth;
        let pageHeight = imgHeight;

        // Custom page size options
        if (pageSize === "a4") {
          // A4 dimensions in points: 595.28 x 841.89
          pageWidth = orientation === "portrait" ? 595.28 : 841.89;
          pageHeight = orientation === "portrait" ? 841.89 : 595.28;
        } else if (pageSize === "letter") {
          // Letter dimensions in points: 612 x 792
          pageWidth = orientation === "portrait" ? 612 : 792;
          pageHeight = orientation === "portrait" ? 792 : 612;
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Margins definition
        let margin = 0;
        if (marginSize === "small") margin = 20;
        else if (marginSize === "large") margin = 45;

        const containerWidth = pageWidth - margin * 2;
        const containerHeight = pageHeight - margin * 2;

        // Scale image to fit page comfortably
        const scale = Math.min(containerWidth / imgWidth, containerHeight / imgHeight);
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;

        // Centering drawn image on page
        const xPos = margin + (containerWidth - drawWidth) / 2;
        const yPos = margin + (containerHeight - drawHeight) / 2;

        page.drawImage(pdfImage, {
          x: xPos,
          y: yPos,
          width: drawWidth,
          height: drawHeight,
        });

        const currentProgress = 35 + Math.round(((i + 1) / imgFiles.length) * 50);
        setProgress(Math.min(85, currentProgress));
      }

      setProgress(90);
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setDownloadBlobUrl(url);
      setDownloadFileName("imagens_convertidas.pdf");
      setOutputSize(blob.size);
      
      const origTotal = imgFiles.reduce((sum, item) => sum + item.size, 0);
      setOriginalSize(origTotal);

      setSuccessMessage("Imagens convertidas em PDF com sucesso!");
      setProgress(100);

      trackEvent("pdf_processing_completed", {
        tool: "imgToPdf",
        original_size: origTotal,
        converted_size: blob.size,
      });
    } catch (err: any) {
      console.error(err);
      setGlobalError("Falha ao converter imagens para PDF. Verifique se o formato das imagens está correto (use JPG ou PNG preferencialmente).");
      trackEvent("pdf_processing_failed", {
        tool: "imgToPdf",
        error_message: err.message || String(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. ORGANIZE TOOL FUNCTIONS
  const handleOrganizeFileAdded = async (files: FileList) => {
    setGlobalError(null);
    if (files.length === 0) return;
    const file = files[0];
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setGlobalError("Por favor, selecione um arquivo PDF válido.");
      return;
    }

    setIsProcessing(true);
    setStatusMessage("Analisando PDF...");
    setProgress(30);

    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const pageCount = pdfDoc.getPageCount();
      
      const pages: PageItem[] = [];
      for (let i = 0; i < pageCount; i++) {
        pages.push({
          index: i,
          label: `Página ${i + 1}`,
          rotation: 0,
          deleted: false
        });
      }

      setOrganizeFile({
        id: "organize-file",
        file,
        name: file.name,
        size: file.size
      });
      setOrganizePages(pages);
      setProgress(100);
    } catch (err: any) {
      console.error(err);
      setGlobalError("Erro ao carregar o arquivo PDF. Verifique se não está protegido por senha.");
    } finally {
      setIsProcessing(false);
    }
  };

  const movePageItem = (index: number, direction: "left" | "right") => {
    if (direction === "left" && index === 0) return;
    if (direction === "right" && index === organizePages.length - 1) return;
    const targetIdx = direction === "left" ? index - 1 : index + 1;
    const updated = [...organizePages];
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setOrganizePages(updated);
  };

  const deletePageFromOrganize = (index: number) => {
    setOrganizePages(prev => prev.filter((_, idx) => idx !== index));
  };

  const processOrganize = async () => {
    if (!organizeFile || organizePages.length === 0) return;

    setIsProcessing(true);
    setProgress(30);
    setGlobalError(null);
    setSuccessMessage(null);

    trackEvent("pdf_processing_started", { tool: "organize", pages_count: organizePages.length });

    try {
      const bytes = await organizeFile.file.arrayBuffer();
      const originalPdf = await PDFDocument.load(bytes);
      const newPdf = await PDFDocument.create();

      setProgress(60);
      const originalIndices = organizePages.map(p => p.index);
      
      // Copy selected pages in specified new order
      const copiedPages = await newPdf.copyPages(originalPdf, originalIndices);
      copiedPages.forEach(page => newPdf.addPage(page));

      setProgress(85);
      const newBytes = await newPdf.save();
      const blob = new Blob([newBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setDownloadBlobUrl(url);
      const baseName = organizeFile.name.substring(0, organizeFile.name.lastIndexOf(".")) || organizeFile.name;
      setDownloadFileName(`${baseName}_organizado.pdf`);
      setOutputSize(blob.size);
      setOriginalSize(organizeFile.size);

      setSuccessMessage("PDF reorganizado com sucesso!");
      setProgress(100);

      trackEvent("pdf_processing_completed", {
        tool: "organize",
        original_size: organizeFile.size,
        converted_size: blob.size,
      });
    } catch (err: any) {
      console.error(err);
      setGlobalError("Não foi possível gerar o novo PDF. Tente com outro arquivo.");
      trackEvent("pdf_processing_failed", {
        tool: "organize",
        error_message: err.message || String(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. DELETE & ROTATE TOOL FUNCTIONS
  const handleDrFileAdded = async (files: FileList) => {
    setGlobalError(null);
    if (files.length === 0) return;
    const file = files[0];
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setGlobalError("Por favor, selecione um arquivo PDF válido.");
      return;
    }

    setIsProcessing(true);
    setStatusMessage("Processando estrutura de páginas...");
    setProgress(30);

    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const pageCount = pdfDoc.getPageCount();
      
      const pages: PageItem[] = [];
      for (let i = 0; i < pageCount; i++) {
        pages.push({
          index: i,
          label: `Página ${i + 1}`,
          rotation: 0,
          deleted: false
        });
      }

      setDrFile({
        id: "dr-file",
        file,
        name: file.name,
        size: file.size
      });
      setDrPages(pages);
      setProgress(100);
    } catch (err: any) {
      console.error(err);
      setGlobalError("Erro ao abrir arquivo. O PDF pode estar danificado ou criptografado.");
    } finally {
      setIsProcessing(false);
    }
  };

  const rotatePage = (index: number) => {
    setDrPages(prev => prev.map((p, idx) => {
      if (idx === index) {
        return { ...p, rotation: (p.rotation + 90) % 360 };
      }
      return p;
    }));
  };

  const togglePageDeletion = (index: number) => {
    setDrPages(prev => prev.map((p, idx) => {
      if (idx === index) {
        return { ...p, deleted: !p.deleted };
      }
      return p;
    }));
  };

  const processDeleteRotate = async () => {
    if (!drFile) return;

    const remainingPages = drPages.filter(p => !p.deleted);
    if (remainingPages.length === 0) {
      setGlobalError("Você não pode deletar todas as páginas do PDF.");
      return;
    }

    setIsProcessing(true);
    setProgress(30);
    setGlobalError(null);
    setSuccessMessage(null);

    trackEvent("pdf_processing_started", {
      tool: "deleteRotate",
      original_pages: drPages.length,
      remaining_pages: remainingPages.length,
    });

    try {
      const bytes = await drFile.file.arrayBuffer();
      const originalPdf = await PDFDocument.load(bytes);
      const newPdf = await PDFDocument.create();

      setProgress(55);
      
      // Copy only remaining pages
      const indicesToCopy = remainingPages.map(p => p.index);
      const copiedPages = await newPdf.copyPages(originalPdf, indicesToCopy);
      
      // Add pages and apply rotation
      copiedPages.forEach((page, i) => {
        const config = remainingPages[i];
        if (config.rotation > 0) {
          page.setRotation(degrees(config.rotation));
        }
        newPdf.addPage(page);
      });

      setProgress(85);
      const newBytes = await newPdf.save();
      const blob = new Blob([newBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      setDownloadBlobUrl(url);
      const baseName = drFile.name.substring(0, drFile.name.lastIndexOf(".")) || drFile.name;
      setDownloadFileName(`${baseName}_editado.pdf`);
      setOutputSize(blob.size);
      setOriginalSize(drFile.size);

      setSuccessMessage("PDF editado com sucesso!");
      setProgress(100);

      trackEvent("pdf_processing_completed", {
        tool: "deleteRotate",
        original_size: drFile.size,
        converted_size: blob.size,
      });
    } catch (err: any) {
      console.error(err);
      setGlobalError("Erro ao aplicar modificações no PDF.");
      trackEvent("pdf_processing_failed", {
        tool: "deleteRotate",
        error_message: err.message || String(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const list = e.dataTransfer.files;
      if (activeTool === "merge") handleMergeFilesAdded(list);
      else if (activeTool === "compress") handleCompressFileAdded(list);
      else if (activeTool === "imgToPdf") handleImgFilesAdded(list);
      else if (activeTool === "organize") handleOrganizeFileAdded(list);
      else if (activeTool === "deleteRotate") handleDrFileAdded(list);
    }
  };

  const setStatusMessage = (msg: string) => {
    // Helper function matching older structures
  };

  return (
    <div className="space-y-8 text-text-main bg-transparent">
      
      {/* Dynamic Header Block */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-border-main gap-4" id="pdf-header-block">
        <div>
          <h2 className="font-display text-xl font-extrabold text-text-main" id="pdf-main-title">
            {activeTool === "none" ? "Suíte de Ferramentas PDF Local" : `Ferramenta: ${
              activeTool === "merge" ? "Juntar PDF" :
              activeTool === "compress" ? "Comprimir PDF" :
              activeTool === "imgToPdf" ? "Imagem para PDF" :
              activeTool === "organize" ? "Organizar Páginas" :
              "Excluir / Girar Páginas"
            }`}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5" id="pdf-main-subtitle">
            {activeTool === "none" ? (
              <>
                <span className="bg-card-inner text-text-sec text-[11px] px-2.5 py-1 rounded-md border border-border-main font-semibold">💻 Recomendado para Computador</span>
              </>
            ) : (
              <button 
                onClick={handleResetTool}
                className="text-xs text-green-primary hover:text-white font-extrabold flex items-center gap-1 cursor-pointer bg-card-selected px-3 py-1.5 rounded-lg border border-green-primary/20 shadow-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Voltar para as ferramentas</span>
              </button>
            )}
          </div>
        </div>
        
        {activeTool !== "none" && (
          <button
            onClick={handleResetTool}
            className="text-xs font-bold text-[#E96574] hover:text-white transition-colors py-2 px-4 bg-[#E96574]/10 border border-[#E96574]/30 rounded-xl hover:bg-[#E96574]/20 flex items-center space-x-1.5 cursor-pointer"
            id="btn-clear-pdf"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Cancelar</span>
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        
        {/* VIEW 1: Tool Grid selector */}
        {activeTool === "none" && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            id="pdf-tools-grid"
          >
            {/* Tool 1: Juntar PDF */}
            <div 
              className="bg-[#1B2732] border border-[#2D3B47] rounded-[24px] p-6 hover:border-[#22C96B] hover:shadow-lg transition-all duration-300 group flex flex-col justify-between h-full cursor-pointer"
              onClick={() => setActiveTool("merge")}
            >
              <div className="space-y-4">
                <div className="p-3 bg-[#202D38] text-[#22C96B] rounded-2xl border border-[#2D3B47] inline-block group-hover:scale-105 transition-all duration-300 shadow-sm">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-[#F5F7F8] group-hover:text-[#22C96B] transition-colors flex items-center gap-2">
                    Juntar PDF
                  </h3>
                  <p className="text-xs text-[#AEB8C1] mt-2 leading-relaxed font-semibold">
                    Combine vários arquivos PDF em uma única sequência. Reordene a sequência dos arquivos antes de juntar de forma simples.
                  </p>
                </div>
              </div>
              <div className="pt-6 border-t border-[#2D3B47] mt-4 flex justify-end text-xs font-bold text-[#22C96B] group-hover:translate-x-1 transition-transform">
                <span>Mesclar arquivos &rarr;</span>
              </div>
            </div>

            {/* Tool 2: Comprimir PDF */}
            <div 
              className="bg-[#1B2732] border border-[#2D3B47] rounded-[24px] p-6 hover:border-[#22C96B] hover:shadow-lg transition-all duration-300 group flex flex-col justify-between h-full cursor-pointer"
              onClick={() => setActiveTool("compress")}
            >
              <div className="space-y-4">
                <div className="p-3 bg-[#202D38] text-[#22C96B] rounded-2xl border border-[#2D3B47] inline-block group-hover:scale-105 transition-all duration-300 shadow-sm">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-[#F5F7F8] group-hover:text-[#22C96B] transition-colors flex items-center gap-2">
                    Comprimir PDF
                  </h3>
                  <p className="text-xs text-[#AEB8C1] mt-2 leading-relaxed font-semibold">
                    Reduza o tamanho do seu arquivo PDF otimizando as tabelas de objetos internos sem perder legibilidade das fontes e textos.
                  </p>
                </div>
              </div>
              <div className="pt-6 border-t border-[#2D3B47] mt-4 flex justify-end text-xs font-bold text-[#22C96B] group-hover:translate-x-1 transition-transform">
                <span>Otimizar tamanho &rarr;</span>
              </div>
            </div>

            {/* Tool 3: Imagens para PDF */}
            <div 
              className="bg-[#1B2732] border border-[#2D3B47] rounded-[24px] p-6 hover:border-[#22C96B] hover:shadow-lg transition-all duration-300 group flex flex-col justify-between h-full cursor-pointer"
              onClick={() => setActiveTool("imgToPdf")}
            >
              <div className="space-y-4">
                <div className="p-3 bg-[#202D38] text-[#22C96B] rounded-2xl border border-[#2D3B47] inline-block group-hover:scale-105 transition-all duration-300 shadow-sm">
                  <Image className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-[#F5F7F8] group-hover:text-[#22C96B] transition-colors flex items-center gap-2">
                    Imagens para PDF
                  </h3>
                  <p className="text-xs text-[#AEB8C1] mt-2 leading-relaxed font-semibold">
                    Converta fotos e imagens (JPG, PNG, WebP) em um documento PDF organizado com layouts e margens ajustáveis.
                  </p>
                </div>
              </div>
              <div className="pt-6 border-t border-[#2D3B47] mt-4 flex justify-end text-xs font-bold text-[#22C96B] group-hover:translate-x-1 transition-transform">
                <span>Converter imagens &rarr;</span>
              </div>
            </div>

            {/* Tool 4: Organizar PDF */}
            <div 
              className="bg-[#1B2732] border border-[#2D3B47] rounded-[24px] p-6 hover:border-[#22C96B] hover:shadow-lg transition-all duration-300 group flex flex-col justify-between h-full cursor-pointer"
              onClick={() => setActiveTool("organize")}
            >
              <div className="space-y-4">
                <div className="p-3 bg-[#202D38] text-[#22C96B] rounded-2xl border border-[#2D3B47] inline-block group-hover:scale-105 transition-all duration-300 shadow-sm">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-[#F5F7F8] group-hover:text-[#22C96B] transition-colors flex items-center gap-2">
                    Organizar Páginas
                  </h3>
                  <p className="text-xs text-[#AEB8C1] mt-2 leading-relaxed font-semibold">
                    Reordene, mova ou remova páginas de um PDF de forma visual e simples. Exporte o documento formatado.
                  </p>
                </div>
              </div>
              <div className="pt-6 border-t border-[#2D3B47] mt-4 flex justify-end text-xs font-bold text-[#22C96B] group-hover:translate-x-1 transition-transform">
                <span>Reordenar páginas &rarr;</span>
              </div>
            </div>

            {/* Tool 5: Excluir/Girar Páginas */}
            <div 
              className="bg-[#1B2732] border border-[#2D3B47] rounded-[24px] p-6 hover:border-[#22C96B] hover:shadow-lg transition-all duration-300 group flex flex-col justify-between h-full cursor-pointer"
              onClick={() => setActiveTool("deleteRotate")}
            >
              <div className="space-y-4">
                <div className="p-3 bg-[#202D38] text-[#22C96B] rounded-2xl border border-[#2D3B47] inline-block group-hover:scale-105 transition-all duration-300 shadow-sm">
                  <Scissors className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-display font-extrabold text-base text-[#F5F7F8] group-hover:text-[#22C96B] transition-colors flex items-center gap-2">
                    Excluir / Girar Páginas
                  </h3>
                  <p className="text-xs text-[#AEB8C1] mt-2 leading-relaxed font-semibold">
                    Gire páginas desalinhadas em 90°/180° ou descarte páginas indesejadas do seu documento PDF localmente.
                  </p>
                </div>
              </div>
              <div className="pt-6 border-t border-[#2D3B47] mt-4 flex justify-end text-xs font-bold text-[#22C96B] group-hover:translate-x-1 transition-transform">
                <span>Girar & Excluir &rarr;</span>
              </div>
            </div>

            {/* Privacy Promise Info Box */}
            <div className="bg-[#1B2732] border border-[#2D3B47] rounded-[24px] p-6 flex flex-col justify-between h-full relative overflow-hidden shadow-md">
              <div className="absolute -right-12 -bottom-12 w-32 h-32 bg-[#22C96B]/10 rounded-full blur-xl pointer-events-none" />
              
              <div className="space-y-3 relative z-10">
                <span className="text-[9px] bg-[#173A2A] text-[#42E58A] border border-[#22C96B]/30 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider inline-block font-semibold">
                  Segurança Máxima
                </span>
                <h3 className="font-display font-bold text-sm text-[#F5F7F8]">
                  Sem Upload para Servidores
                </h3>
                <p className="text-[11px] text-[#AEB8C1] leading-relaxed font-semibold">
                  Seus documentos de identidade, contratos e fotos pessoais são manipulados na memória do seu próprio navegador. Nada é enviado à internet.
                </p>
              </div>
              <div className="pt-6 relative z-10 flex items-center gap-1 text-[11px] font-bold text-[#22C96B]">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Não salvamos nenhum arquivo.</span>
              </div>
            </div>

          </motion.div>
        )}

        {/* VIEW 2: ACTIVE TOOL - MERGE */}
        {activeTool === "merge" && (
          <motion.div 
            key="merge-tool"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start"
          >
            {/* Left Area (3/5): Upload and List */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Dropzone */}
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => triggerInput(mergeInputRef)}
                className={`border-2 border-dashed rounded-2xl p-6 md:p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-4 group ${
                  dragActive 
                    ? "border-green-primary bg-green-primary/5" 
                    : "border-border-main bg-card-inner/50 hover:border-green-primary hover:bg-card-inner/80"
                }`}
              >
                <input 
                  ref={mergeInputRef}
                  type="file" 
                  multiple
                  accept=".pdf"
                  className="hidden" 
                  onChange={(e) => e.target.files && handleMergeFilesAdded(e.target.files)}
                />
                
                <div className="p-3 bg-card-inner rounded-xl border border-border-main text-green-primary group-hover:scale-105 transition-transform duration-200 shadow-sm">
                  <Upload className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-text-main">Arraste seus PDFs para cá ou clique para selecionar</p>
                  <p className="text-xs text-text-sec">Mescle múltiplos arquivos PDF de forma ultra rápida.</p>
                </div>
              </div>

              {/* Success Result block */}
              {successMessage && downloadBlobUrl && (
                <motion.div 
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-card-main border-2 border-green-primary rounded-[24px] p-6 text-center space-y-4 shadow-sm"
                >
                  <div className="mx-auto w-12 h-12 bg-green-primary/10 border border-green-primary/20 text-green-primary rounded-full flex items-center justify-center animate-bounce">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display font-extrabold text-base text-text-main">{successMessage}</h3>
                    <p className="text-xs text-text-sec">Seu novo arquivo PDF consolidado está pronto para baixar!</p>
                  </div>
                  <div className="bg-card-inner border border-border-main p-3 rounded-xl max-w-sm mx-auto flex justify-between text-xs font-semibold text-text-sec">
                    <span>Novo tamanho:</span>
                    <strong className="text-text-main">{formatBytes(outputSize || 0)}</strong>
                  </div>
                  <div className="pt-2">
                    <a
                      href={downloadBlobUrl}
                      download={downloadFileName || "documento_juntado.pdf"}
                      className="inline-flex items-center gap-2 py-3 px-6 bg-green-primary hover:bg-green-dark text-white rounded-xl font-extrabold text-xs shadow-md cursor-pointer transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Baixar PDF Juntado</span>
                    </a>
                  </div>
                </motion.div>
              )}

              {/* List of PDFs */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-sec">Fila de PDF para Juntar ({mergeFiles.length})</h4>
                
                {mergeFiles.length === 0 ? (
                  <div className="text-center py-8 text-text-sec border border-dashed border-border-main rounded-2xl bg-card-inner/10">
                    <FileText className="h-8 w-8 mx-auto text-text-sec/30 mb-2" />
                    <p className="text-xs font-bold">Nenhum PDF selecionado</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mergeFiles.map((item, index) => (
                      <div 
                        key={item.id}
                        className="p-3.5 bg-card-inner border border-border-main rounded-xl flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center space-x-3 min-w-0 flex-1">
                          <span className="text-xs font-bold text-text-sec bg-card-main border border-border-main px-2.5 py-1 rounded-md font-mono">{index + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-text-main truncate">{item.name}</p>
                            <p className="text-[10px] text-text-sec mt-0.5 font-semibold font-mono">{formatBytes(item.size)}</p>
                          </div>
                        </div>

                        {/* Order management actions */}
                        <div className="flex items-center space-x-1 shrink-0">
                          <button 
                            disabled={index === 0}
                            onClick={() => moveMergeItem(index, "up")}
                            className="p-1 text-text-sec hover:text-green-primary hover:bg-card-main border border-transparent hover:border-border-main rounded-lg disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <button 
                            disabled={index === mergeFiles.length - 1}
                            onClick={() => moveMergeItem(index, "down")}
                            className="p-1 text-text-sec hover:text-green-primary hover:bg-card-main border border-transparent hover:border-border-main rounded-lg disabled:opacity-30 cursor-pointer"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={() => removeMergeItem(item.id)}
                            className="p-1 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-lg cursor-pointer"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Area (2/5): Settings & trigger button */}
            <div className="lg:col-span-2 space-y-6 bg-card-main p-6 md:p-8 rounded-[24px] border border-border-main">
              <div className="space-y-2">
                <h3 className="font-display font-extrabold text-text-main text-sm flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="w-1.5 h-3.5 bg-green-primary rounded-full inline-block"></span>
                  Configurações de Mesclagem
                </h3>
                <p className="text-[11px] text-text-sec font-semibold leading-normal">
                  Seus arquivos serão agrupados exatamente na ordem numérica mostrada à esquerda.
                </p>
              </div>

              <div className="border-t border-border-main/60 my-4" />

              <div className="space-y-4">
                {isProcessing ? (
                  <div className="space-y-3 bg-card-inner p-4 rounded-xl border border-dashed border-green-primary/40 text-center">
                    <RefreshCwIcon className="h-5 w-5 animate-spin mx-auto text-green-primary" />
                    <span className="text-xs font-extrabold text-text-sec block">Processando PDF ({progress}%)</span>
                    <div className="w-full h-1.5 bg-card-main rounded-full overflow-hidden">
                      <div className="h-full bg-green-primary" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : (
                  <button
                    disabled={mergeFiles.length < 2}
                    onClick={processMerge}
                    className={`w-full py-4 px-4 text-xs font-extrabold rounded-xl text-white transition-all cursor-pointer shadow-md flex items-center justify-center space-x-2 ${
                      mergeFiles.length >= 2 
                        ? "bg-green-primary hover:bg-green-dark" 
                        : "bg-card-inner/60 text-text-muted cursor-not-allowed border border-border-main/40"
                    }`}
                  >
                    <Layers className="h-4 w-4" />
                    <span>Juntar PDFs Agora</span>
                  </button>
                )}

                <div className="p-4 bg-card-inner border border-border-main rounded-xl flex items-start space-x-3 shadow-sm">
                  <ShieldCheck className="h-4 w-4 text-green-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-text-sec leading-relaxed font-semibold">
                    União ultra rápida e segura. A codificação é feita localmente copiando os dicionários de páginas, preservando vetores, links e imagens em resolução total.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 3: ACTIVE TOOL - COMPRESS */}
        {activeTool === "compress" && (
          <motion.div 
            key="compress-tool"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start animate-fade-in"
          >
            {/* Left Area (3/5) */}
            <div className="lg:col-span-3 space-y-6">
              
              {/* Dropzone */}
              {!compressFile && (
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => triggerInput(compressInputRef)}
                  className="border-2 border-dashed border-border-main bg-card-inner/50 hover:border-green-primary hover:bg-card-inner cursor-pointer rounded-2xl p-8 text-center transition-all duration-200 flex flex-col items-center justify-center space-y-4 group"
                >
                  <input 
                    ref={compressInputRef}
                    type="file" 
                    accept=".pdf"
                    className="hidden" 
                    onChange={(e) => e.target.files && handleCompressFileAdded(e.target.files)}
                  />
                  <div className="p-3 bg-card-inner rounded-xl border border-border-main text-green-primary group-hover:scale-105 transition-transform duration-200 shadow-sm">
                    <Upload className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-text-main">Arraste seu PDF ou clique para carregar</p>
                    <p className="text-xs text-text-sec">Seu arquivo será processado e compactado totalmente no navegador de forma privada.</p>
                  </div>
                </div>
              )}

              {/* Uploaded File Header */}
              {compressFile && (
                <div className="w-full flex items-center justify-between p-3.5 bg-card-main border border-border-main rounded-2xl shadow-sm">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="p-2.5 bg-card-inner text-green-primary rounded-xl border border-border-main">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <p className="text-xs font-bold text-text-main truncate max-w-[200px] sm:max-w-xs">{compressFile.name}</p>
                      <p className="text-[10px] text-text-sec font-mono mt-0.5">{formatBytes(compressFile.size)}</p>
                    </div>
                  </div>
                  {!isProcessing && (
                    <button 
                      onClick={() => {
                        setCompressFile(null);
                        setPdfDiagnosis(null);
                        setCompressionResults(null);
                        setSuccessMessage(null);
                        setGlobalError(null);
                      }}
                      className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg border border-transparent hover:border-rose-500/20 cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}

              {/* Processing Progress Panel */}
              {isProcessing && (
                <div className="p-6 bg-card-main border border-border-main rounded-[24px] space-y-4 shadow-md text-center">
                  <RefreshCwIcon className="h-6 w-6 animate-spin mx-auto text-green-primary" />
                  <div className="space-y-1">
                    <span className="text-xs font-extrabold text-text-main block uppercase tracking-wider">
                      Processando PDF ({progress}%)
                    </span>
                    <span className="text-[10px] text-text-sec block font-medium">
                      {processingStatus || "Iniciando recompactação..."}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-card-inner rounded-full overflow-hidden border border-border-main">
                    <div 
                      className="h-full bg-green-primary transition-all duration-300" 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={handleCancelCompress}
                      className="py-1.5 px-4 text-[10px] font-bold uppercase tracking-wider text-[#E96574] hover:text-white border border-[#E96574]/30 bg-[#E96574]/5 hover:bg-[#E96574]/20 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancelar Operação
                    </button>
                  </div>
                </div>
              )}

              {/* PDF DIAGNOSIS SHEET */}
              {compressFile && pdfDiagnosis && !isProcessing && !compressionResults && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card-main border border-border-main rounded-[24px] p-6 space-y-4 shadow-md"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-3.5 bg-green-primary rounded-full"></div>
                    <h4 className="font-display font-extrabold text-xs text-text-main uppercase tracking-wider">
                      Diagnóstico de Estrutura do Arquivo
                    </h4>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 bg-card-inner border border-border-main/50 rounded-xl">
                      <span className="block text-[9px] text-text-sec uppercase font-bold tracking-wider">Dimensões</span>
                      <strong className="text-xs text-text-main block mt-1 font-mono">{pdfDiagnosis.dimensions}</strong>
                    </div>
                    <div className="p-3 bg-card-inner border border-border-main/50 rounded-xl">
                      <span className="block text-[9px] text-text-sec uppercase font-bold tracking-wider">Páginas</span>
                      <strong className="text-xs text-text-main block mt-1 font-mono">{pdfDiagnosis.numPages}</strong>
                    </div>
                    <div className="p-3 bg-card-inner border border-border-main/50 rounded-xl">
                      <span className="block text-[9px] text-text-sec uppercase font-bold tracking-wider">Imagens</span>
                      <strong className="text-xs text-text-main block mt-1 font-mono">{pdfDiagnosis.imageCount} objetos</strong>
                    </div>
                    <div className="p-3 bg-card-inner border border-border-main/50 rounded-xl">
                      <span className="block text-[9px] text-text-sec uppercase font-bold tracking-wider">Redução Estimada</span>
                      <strong className="text-xs text-green-primary block mt-1 font-extrabold">{pdfDiagnosis.potentialReduction}</strong>
                    </div>
                  </div>

                  <div className="p-3.5 bg-card-inner border border-border-main/70 rounded-xl space-y-1.5 text-xs">
                    <p className="text-[11px] text-text-sec leading-relaxed">
                      <strong className="text-text-main">Tipo de Conteúdo Predominante:</strong> {pdfDiagnosis.contentType}
                    </p>
                    <p className="text-[11px] text-text-sec leading-relaxed">
                      <strong className="text-text-main">Recomendação Técnica:</strong>{" "}
                      {pdfDiagnosis.contentType.includes("Escaneado") || pdfDiagnosis.contentType.includes("Predominantemente") ? (
                        <span>Este PDF é uma digitalização de páginas. A estratégia de <strong className="text-green-primary">Rasterização de Páginas</strong> é altamente recomendada para garantir a máxima taxa de compressão e legibilidade visual.</span>
                      ) : (
                        <span>Este PDF contém textos vetoriais nativos. Recomendamos a <strong className="text-green-primary">Otimização Estrutural</strong> para manter todos os textos, fontes e vetores 100% nítidos, diminuindo apenas o peso de fotos e figuras de fundo.</span>
                      )}
                    </p>
                    {pdfDiagnosis.isOptimized && (
                      <div className="mt-2 text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-500 p-2 rounded-lg font-semibold flex items-center gap-1.5">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>Este arquivo já possui um tamanho muito baixo para a proporção de conteúdo. Reduções adicionais podem ser pequenas.</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* HONEST RESULTS SHEET */}
              {compressFile && compressionResults && !isProcessing && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="space-y-6"
                >
                  <div className="bg-card-main border border-border-main rounded-[24px] p-6 space-y-5 shadow-lg">
                    
                    {/* Header Feedback Status */}
                    <div className={`flex items-start gap-3 p-4 rounded-xl border border-dashed text-left font-semibold ${
                      compressionResults.status === "success" 
                        ? "bg-green-primary/10 border-green-primary/30 text-green-primary"
                        : compressionResults.status === "larger"
                        ? "bg-rose-500/10 border-rose-500/20 text-[#E96574]"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-500"
                    }`}>
                      {compressionResults.status === "success" && (
                        <>
                          <div className="p-1.5 bg-green-primary/10 border border-green-primary/20 text-green-primary rounded-lg shrink-0 mt-0.5">
                            <CheckCircle2 className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-green-primary uppercase tracking-wider">PDF Comprimido com Sucesso!</h4>
                            <p className="text-[11px] text-text-sec mt-1 leading-relaxed">
                              Parabéns! O arquivo foi otimizado com sucesso mantendo a qualidade visual do seu documento.
                            </p>
                          </div>
                        </>
                      )}
                      {compressionResults.status === "no_benefit" && (
                        <>
                          <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg shrink-0 mt-0.5">
                            <Info className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-amber-500 uppercase tracking-wider">Original Preservado</h4>
                            <p className="text-[11px] text-text-sec mt-1 leading-relaxed">
                              A redução obtida não compensou a perda de qualidade. O original foi preservado.
                            </p>
                          </div>
                        </>
                      )}
                      {compressionResults.status === "low_reduction" && (
                        <>
                          <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg shrink-0 mt-0.5">
                            <Info className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-amber-500 uppercase tracking-wider">Pouca Redução Obtida</h4>
                            <p className="text-[11px] text-text-sec mt-1 leading-relaxed">
                              A redução foi de apenas <strong>{compressionResults.reductionPercent.toFixed(1)}%</strong>. O documento original já estava muito otimizado.
                            </p>
                          </div>
                        </>
                      )}
                      {compressionResults.status === "already_optimized" && (
                        <>
                          <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg shrink-0 mt-0.5">
                            <Info className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-amber-500 uppercase tracking-wider">O PDF já estava otimizado</h4>
                            <p className="text-[11px] text-text-sec mt-1 leading-relaxed">
                              Não foi detectado conteúdo adicional compressível sem gerar perda de leitura.
                            </p>
                          </div>
                        </>
                      )}
                      {compressionResults.status === "larger" && (
                        <>
                          <div className="p-1.5 bg-rose-500/10 border border-[#E96574]/20 text-[#E96574] rounded-lg shrink-0 mt-0.5">
                            <AlertCircle className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-extrabold text-[#E96574] uppercase tracking-wider">O original foi mantido</h4>
                            <p className="text-[11px] text-text-sec mt-1 leading-relaxed">
                              A tentativa de compressão aumentou o tamanho do arquivo. O original foi preservado intacto.
                            </p>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Size Comparison Stats row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-card-inner border border-border-main/50 rounded-xl relative overflow-hidden">
                        <span className="block text-[9px] text-text-sec uppercase font-bold tracking-wider">Tamanho Original</span>
                        <strong className="text-base text-text-main block mt-1 font-mono font-extrabold">{formatBytes(compressionResults.originalSize)}</strong>
                      </div>
                      <div className="p-4 bg-card-inner border border-green-primary/10 rounded-xl relative overflow-hidden">
                        <span className="block text-[9px] text-green-primary uppercase font-bold tracking-wider">Tamanho Final</span>
                        <strong className={`text-base block mt-1 font-mono font-extrabold ${
                          compressionResults.status === "larger" || compressionResults.status === "no_benefit" 
                            ? "text-text-main" 
                            : "text-green-primary"
                        }`}>
                          {formatBytes(compressionResults.finalSize)}
                        </strong>
                        {compressionResults.reductionPercent > 0 && (
                          <span className="absolute right-2 bottom-2 bg-green-primary/10 border border-green-primary/20 text-green-primary text-[9px] font-bold px-1.5 py-0.5 rounded font-mono">
                            -{compressionResults.reductionPercent.toFixed(1)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Honest Results Table */}
                    <div className="p-4 bg-card-inner border border-border-main/60 rounded-xl space-y-2.5 text-xs text-text-sec text-left">
                      <div className="flex justify-between py-1 border-b border-border-main/20">
                        <span>Original:</span>
                        <strong className="text-text-main font-mono">{formatBytes(compressionResults.originalSize)}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border-main/20">
                        <span>Resultado:</span>
                        <strong className="text-text-main font-mono">{formatBytes(compressionResults.finalSize)}</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border-main/20">
                        <span>Redução obtida:</span>
                        <strong className={`font-mono ${compressionResults.reductionPercent > 0 ? "text-green-primary" : "text-text-main"}`}>
                          {compressionResults.reductionPercent.toFixed(1)}%
                        </strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border-main/20">
                        <span>Qualidade selecionada:</span>
                        <strong className="text-text-main uppercase font-bold">
                          {compressionResults.levelUsed === "low" ? "Leve" :
                           compressionResults.levelUsed === "medium" ? "Equilibrada" :
                           compressionResults.levelUsed === "high" ? "Forte" : "Muito Forte"}
                        </strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border-main/20">
                        <span>DPI final aplicado:</span>
                        <strong className="text-text-main font-mono">{compressionResults.dpiUsed} DPI</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border-main/20">
                        <span>Qualidade JPEG aplicada:</span>
                        <strong className="text-text-main font-mono">{compressionResults.jpegUsed}%</strong>
                      </div>
                      <div className="flex justify-between py-1 border-b border-border-main/20">
                        <span>Texto digital preservado:</span>
                        <strong className={`font-bold ${compressionResults.textPreserved === "Sim" ? "text-green-primary" : "text-amber-500"}`}>
                          {compressionResults.textPreserved}
                        </strong>
                      </div>
                      <div className="flex justify-between py-1">
                        <span>Rasterização completa:</span>
                        <strong className={`font-bold ${compressionResults.rasterized === "Sim" ? "text-amber-500" : "text-green-primary"}`}>
                          {compressionResults.rasterized}
                        </strong>
                      </div>
                    </div>

                    {/* Action trigger group (Baixar, Voltar, Manter Original) */}
                    <div className="flex flex-col gap-3 pt-2">
                      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
                        {/* Baixar comprimido */}
                        <a
                          href={downloadBlobUrl || "#"}
                          download={downloadFileName || "documento_comprimido.pdf"}
                          className="w-full sm:w-1/2 inline-flex items-center justify-center gap-2 py-3 px-6 bg-green-primary hover:bg-green-dark text-white rounded-xl font-extrabold text-xs shadow-md cursor-pointer transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          <span>
                            {compressionResults.status === "no_benefit" || compressionResults.status === "larger"
                              ? "Baixar PDF Original"
                              : "Baixar PDF Comprimido"}
                          </span>
                        </a>

                        {/* Voltar e usar qualidade maior */}
                        <button
                          onClick={() => {
                            // Upgrade level
                            if (compressionLevel === "very_high") setCompressionLevel("high");
                            else if (compressionLevel === "high") setCompressionLevel("medium");
                            else if (compressionLevel === "medium") setCompressionLevel("low");

                            // Clear results so they can reconfigure and re-run
                            setCompressionResults(null);
                            setSuccessMessage(null);
                          }}
                          className="w-full sm:w-1/2 inline-flex items-center justify-center gap-2 py-3 px-6 bg-card-inner hover:bg-card-selected text-text-main border border-border-main rounded-xl font-bold text-xs cursor-pointer transition-colors"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          <span>Voltar e usar qualidade maior</span>
                        </button>
                      </div>

                      {/* Manter original */}
                      <button
                        onClick={() => {
                          const originalBlob = new Blob([compressionResults.originalBytes], { type: "application/pdf" });
                          const originalUrl = URL.createObjectURL(originalBlob);
                          const a = document.createElement("a");
                          a.href = originalUrl;
                          a.download = compressFile?.name || "documento_original.pdf";
                          a.click();
                          URL.revokeObjectURL(originalUrl);
                        }}
                        className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 bg-card-inner/50 hover:bg-card-selected text-text-sec border border-border-main/50 rounded-xl font-bold text-xs cursor-pointer transition-colors"
                      >
                        <FileText className="h-4 w-4" />
                        <span>Manter Original</span>
                      </button>
                    </div>

                  </div>

                  {/* VISUAL PAGE COMPARISON PREVIEW */}
                  {pdfDiagnosis && pdfDiagnosis.numPages >= 1 && (
                    <div className="bg-card-main border border-border-main rounded-[24px] p-6 space-y-4 shadow-lg text-left">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border-main/60">
                        <div>
                          <span className="text-[9px] bg-green-primary/10 border border-green-primary/20 text-green-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider inline-block">
                            Verificação Visual Real
                          </span>
                          <h4 className="font-display font-bold text-sm text-text-main mt-1">Comparativo de Páginas Side-by-Side</h4>
                        </div>

                        {/* Page Selector */}
                        {pdfDiagnosis.numPages > 1 && (
                          <div className="flex items-center space-x-2">
                            <button
                              disabled={selectedPreviewPage === 1}
                              onClick={() => setSelectedPreviewPage(p => Math.max(1, p - 1))}
                              className="px-2.5 py-1.5 text-xs font-bold text-text-main bg-card-inner hover:bg-card-selected border border-border-main rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              &larr; Anterior
                            </button>
                            <span className="text-[11px] font-mono font-bold text-text-main">
                              Pág. {selectedPreviewPage} de {pdfDiagnosis.numPages}
                            </span>
                            <button
                              disabled={selectedPreviewPage === pdfDiagnosis.numPages}
                              onClick={() => setSelectedPreviewPage(p => Math.min(pdfDiagnosis.numPages, p + 1))}
                              className="px-2.5 py-1.5 text-xs font-bold text-text-main bg-card-inner hover:bg-card-selected border border-border-main rounded-lg disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              Próxima &rarr;
                            </button>
                          </div>
                        )}
                      </div>

                      <PreviewComparison 
                        originalBytes={compressionResults.originalBytes}
                        compressedBytes={compressionResults.compressedBytes}
                        pageNum={selectedPreviewPage}
                        totalPages={pdfDiagnosis.numPages}
                      />
                    </div>
                  )}

                  {/* Run Another Test link */}
                  <div className="text-center pt-2">
                    <button
                      onClick={() => {
                        setCompressFile(null);
                        setPdfDiagnosis(null);
                        setCompressionResults(null);
                        setSuccessMessage(null);
                      }}
                      className="text-xs text-green-primary hover:text-white font-extrabold flex items-center gap-1.5 mx-auto bg-card-inner/60 px-4 py-2 rounded-xl border border-border-main hover:bg-card-selected transition-all"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Comprimir outro arquivo PDF</span>
                    </button>
                  </div>
                </motion.div>
              )}

            </div>

            {/* Right Area (2/5): Settings & trigger */}
            <div className="lg:col-span-2 space-y-6 bg-card-main p-6 md:p-8 rounded-[24px] border border-border-main text-left">
              
              <div className="space-y-2">
                <h3 className="font-display font-extrabold text-text-main text-sm flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="w-1.5 h-3.5 bg-green-primary rounded-full inline-block"></span>
                  Configurações de Saída
                </h3>
                <p className="text-[11px] text-text-sec font-semibold leading-normal">
                  Configure as diretrizes e regras do motor para otimizar o seu documento.
                </p>
              </div>

              <div className="border-t border-border-main/60 my-4" />

              {/* SECTION: Compression levels (Low, Med, High, Very High) */}
              <div className="space-y-3">
                <label className="text-[10px] font-extrabold text-text-main uppercase tracking-wider block">1. Grau de Compressão</label>
                <div className="space-y-2">
                  {[
                    { key: "low", label: "Compressão Leve", desc: "Qualidade de imagem quase intocada (200 DPI). Ideal para portfólios." },
                    { key: "medium", label: "Compressão Equilibrada (Padrão)", desc: "Excelente legibilidade e redução robusta de peso (150 DPI)." },
                    { key: "high", label: "Compressão Forte", desc: "Redução agressiva para envios rápidos e sites do governo (110 DPI)." },
                    { key: "very_high", label: "Compressão Muito Forte", desc: "Economia máxima possível, otimizado para conexões lentas (80 DPI)." }
                  ].map((lvl) => (
                    <button
                      key={lvl.key}
                      disabled={isProcessing}
                      onClick={() => setCompressionLevel(lvl.key as any)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                        compressionLevel === lvl.key 
                          ? "border-green-primary bg-card-selected ring-2 ring-green-primary/10" 
                          : "border-border-main bg-card-inner hover:bg-card-inner/80"
                      } disabled:opacity-50`}
                    >
                      <span className="block text-xs font-extrabold text-text-main">{lvl.label}</span>
                      <span className="block text-[10px] text-text-sec mt-0.5 font-semibold leading-relaxed">{lvl.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION: Compression Strategy */}
              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-extrabold text-text-main uppercase tracking-wider block">2. Método de Otimização</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setCompressionStrategy("structural")}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      compressionStrategy === "structural"
                        ? "border-green-primary bg-card-selected font-extrabold text-text-main"
                        : "border-border-main bg-card-inner text-text-sec hover:bg-card-inner/80"
                    } disabled:opacity-50`}
                  >
                    <span className="block text-xs font-bold">Estrutural</span>
                    <span className="block text-[9px] text-text-muted mt-0.5 leading-normal">Mantém textos e vetores nítidos</span>
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => setCompressionStrategy("raster")}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                      compressionStrategy === "raster"
                        ? "border-green-primary bg-card-selected font-extrabold text-text-main"
                        : "border-border-main bg-card-inner text-text-sec hover:bg-card-inner/80"
                    } disabled:opacity-50`}
                  >
                    <span className="block text-xs font-bold">Rasterização</span>
                    <span className="block text-[9px] text-text-muted mt-0.5 leading-normal">Converte páginas em imagens (Scans)</span>
                  </button>
                </div>
              </div>

              {/* SECTION: Color modes */}
              <div className="space-y-3 pt-2">
                <label className="text-[10px] font-extrabold text-text-main uppercase tracking-wider block">3. Paleta de Cores</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "original", label: "Colorido" },
                    { key: "grayscale", label: "Tons de Cinza" },
                    { key: "monochrome", label: "Preto & Branco" }
                  ].map((color) => (
                    <button
                      key={color.key}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setColorOption(color.key as any)}
                      className={`p-2.5 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                        colorOption === color.key
                          ? "border-green-primary bg-card-selected text-text-main"
                          : "border-border-main bg-card-inner text-text-sec hover:bg-card-inner/80"
                      } disabled:opacity-50`}
                    >
                      {color.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION: Target Capping (Objetivo de Tamanho) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-extrabold text-text-main uppercase tracking-wider block">4. Objetivo de Tamanho (Opcional)</label>
                  <span className="text-[9px] bg-green-primary/10 text-green-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Iterativo</span>
                </div>
                <select
                  disabled={isProcessing}
                  value={targetSizeOption}
                  onChange={(e) => setTargetSizeOption(e.target.value)}
                  className="w-full p-3 bg-card-inner border border-border-main rounded-xl text-xs font-bold text-text-main focus:outline-none focus:border-green-primary"
                >
                  <option value="max">Reduzir o máximo possível (Passo único)</option>
                  <option value="1mb">Forçar até 1 MB (Múltiplos passos)</option>
                  <option value="2mb">Forçar até 2 MB (Múltiplos passos)</option>
                  <option value="5mb">Forçar até 5 MB (Múltiplos passos)</option>
                  <option value="10mb">Forçar até 10 MB (Múltiplos passos)</option>
                  <option value="custom">Tamanho personalizado (Múltiplos passos)</option>
                </select>

                {targetSizeOption === "custom" && (
                  <div className="pt-1.5 flex items-center gap-2 animate-fade-in">
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      disabled={isProcessing}
                      value={customTargetSizeMB}
                      onChange={(e) => setCustomTargetSizeMB(parseFloat(e.target.value) || 1)}
                      className="w-24 p-2 bg-card-inner border border-border-main rounded-lg text-xs font-mono text-center font-bold text-text-main focus:outline-none focus:border-green-primary"
                    />
                    <span className="text-xs font-semibold text-text-sec">MB alvo aproximado</span>
                  </div>
                )}
              </div>

              <div className="border-t border-border-main/60 my-4" />

              {/* Action trigger button */}
              <div className="space-y-3">
                {isProcessing ? (
                  <button
                    onClick={handleCancelCompress}
                    className="w-full py-4 px-4 text-xs font-extrabold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer shadow-md flex items-center justify-center space-x-2"
                  >
                    <X className="h-4 w-4 animate-pulse" />
                    <span>Cancelar Compressão</span>
                  </button>
                ) : (
                  <button
                    disabled={!compressFile}
                    onClick={processCompress}
                    className={`w-full py-4 px-4 text-xs font-extrabold rounded-xl text-white transition-all cursor-pointer shadow-md flex items-center justify-center space-x-2 ${
                      compressFile
                        ? "bg-green-primary hover:bg-green-dark" 
                        : "bg-card-inner/60 text-text-muted cursor-not-allowed border border-border-main/50"
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Iniciar Compressão Real</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 4: ACTIVE TOOL - IMAGES TO PDF */}
        {activeTool === "imgToPdf" && (
          <motion.div 
            key="img-to-pdf-tool"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start"
          >
            {/* Left Area (3/5) */}
            <div className="lg:col-span-3 space-y-6">
              
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => triggerInput(imgInputRef)}
                className={`border-2 border-dashed rounded-2xl p-6 md:p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-4 group ${
                  dragActive 
                    ? "border-green-primary bg-green-primary/5" 
                    : "border-border-main bg-card-inner/50 hover:border-green-primary hover:bg-card-inner"
                }`}
              >
                <input 
                  ref={imgInputRef}
                  type="file" 
                  multiple
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden" 
                  onChange={(e) => e.target.files && handleImgFilesAdded(e.target.files)}
                />
                
                <div className="p-3 bg-card-inner rounded-xl border border-border-main text-green-primary group-hover:scale-105 transition-transform duration-200 shadow-sm">
                  <Image className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-text-main">Arraste suas fotos para cá ou clique para selecionar</p>
                  <p className="text-xs text-text-sec">Aceita JPG, PNG e WebP. Organize-as em um único PDF.</p>
                </div>
              </div>

              {/* Success Card */}
              {successMessage && downloadBlobUrl && (
                <motion.div 
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-card-main border-2 border-green-primary rounded-[24px] p-6 text-center space-y-4 shadow-sm"
                >
                  <div className="mx-auto w-12 h-12 bg-green-primary/10 border border-green-primary/20 text-green-primary rounded-full flex items-center justify-center animate-bounce">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display font-extrabold text-base text-text-main">{successMessage}</h3>
                    <p className="text-xs text-text-sec animate-pulse">Novo PDF gerado a partir de {imgFiles.length} imagens!</p>
                  </div>
                  <div className="bg-card-inner border border-border-main p-3 rounded-xl max-w-sm mx-auto flex justify-between text-xs font-semibold text-text-sec">
                    <span>Tamanho do PDF:</span>
                    <strong className="text-text-main">{formatBytes(outputSize || 0)}</strong>
                  </div>
                  <div className="pt-2">
                    <a
                      href={downloadBlobUrl}
                      download={downloadFileName || "imagens.pdf"}
                      className="inline-flex items-center gap-2 py-3 px-6 bg-green-primary hover:bg-green-dark text-white rounded-xl font-extrabold text-xs shadow-md cursor-pointer transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Baixar PDF Final</span>
                    </a>
                  </div>
                </motion.div>
              )}

              {/* Images Grid list */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-sec">Imagens Selecionadas ({imgFiles.length})</h4>
                
                {imgFiles.length === 0 ? (
                  <div className="text-center py-8 text-text-sec border border-dashed border-border-main rounded-2xl bg-card-inner/10">
                    <FileImage className="h-8 w-8 mx-auto text-text-sec/30 mb-2" />
                    <p className="text-xs font-bold">Nenhuma imagem selecionada</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {imgFiles.map((item, index) => (
                      <div 
                        key={item.id}
                        className="bg-card-inner border border-border-main rounded-xl p-3 relative group flex flex-col justify-between space-y-3"
                      >
                        {/* Image Preview */}
                        <div className="aspect-video w-full rounded-lg bg-card-main overflow-hidden border border-border-main relative">
                          {item.previewUrl && (
                            <img 
                              src={item.previewUrl} 
                              alt="preview" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          <span className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/60 text-white rounded font-mono text-[9px] font-bold">{index + 1}</span>
                        </div>

                        <p className="text-[10px] font-bold text-text-main truncate leading-tight">{item.name}</p>

                        {/* Order management */}
                        <div className="flex items-center justify-between pt-1.5 border-t border-border-main/40">
                          <button 
                            disabled={index === 0}
                            onClick={() => moveImgItem(index, "up")}
                            className="p-1 text-text-sec hover:text-green-primary hover:bg-card-main border border-border-main/40 rounded-lg disabled:opacity-30 cursor-pointer"
                            title="Mover para cima"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            disabled={index === imgFiles.length - 1}
                            onClick={() => moveImgItem(index, "down")}
                            className="p-1 text-text-sec hover:text-green-primary hover:bg-card-main border border-border-main/40 rounded-lg disabled:opacity-30 cursor-pointer"
                            title="Mover para baixo"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            onClick={() => removeImgItem(item.id)}
                            className="p-1 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-lg cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Right Area (2/5): Settings & trigger */}
            <div className="lg:col-span-2 space-y-6 bg-card-main p-6 md:p-8 rounded-[24px] border border-border-main">
              <div className="space-y-2">
                <h3 className="font-display font-extrabold text-text-main text-sm flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="w-1.5 h-3.5 bg-green-primary rounded-full inline-block"></span>
                  Layout do Documento
                </h3>
                <p className="text-[11px] text-text-sec font-semibold leading-normal">
                  Configure a formatação e orientação das páginas do PDF de saída.
                </p>
              </div>

              <div className="border-t border-border-main/60 my-4" />

              <div className="space-y-4">
                {/* Page Size Selection */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-main uppercase tracking-wider">Tamanho da Página:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "a4", label: "A4 padrão" },
                      { key: "letter", label: "Carta" },
                      { key: "fit", label: "Ajustar Foto" }
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setPageSize(opt.key as any)}
                        className={`py-2 px-3 border rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          pageSize === opt.key 
                            ? "border-green-primary bg-card-selected text-green-primary ring-1 ring-green-primary" 
                            : "border-border-main bg-card-inner hover:bg-card-inner/80 text-text-sec"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orientation Selection */}
                {pageSize !== "fit" && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="text-[11px] font-bold text-text-main uppercase tracking-wider">Orientação da Página:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: "portrait", label: "Retrato (Vertical)" },
                        { key: "landscape", label: "Paisagem (Horizontal)" }
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => setOrientation(opt.key as any)}
                          className={`py-2 px-3 border rounded-xl text-xs font-bold cursor-pointer transition-all ${
                            orientation === opt.key 
                              ? "border-green-primary bg-card-selected text-green-primary ring-1 ring-green-primary" 
                              : "border-border-main bg-card-inner hover:bg-card-inner/80 text-text-sec"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Margins Selection */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-text-main uppercase tracking-wider">Margens da Página:</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: "none", label: "Sem Margens" },
                      { key: "small", label: "Pequenas" },
                      { key: "large", label: "Grandes" }
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setMarginSize(opt.key as any)}
                        className={`py-2 px-3 border rounded-xl text-xs font-bold cursor-pointer transition-all ${
                          marginSize === opt.key 
                            ? "border-green-primary bg-card-selected text-green-primary ring-1 ring-green-primary" 
                            : "border-border-main bg-card-inner hover:bg-card-inner/80 text-text-sec"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image Quality Selection */}
                <div className="space-y-1.5 pt-1">
                  <label className="text-[11px] font-bold text-text-main uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-green-primary" />
                    Resolução e Otimização:
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { key: "original", label: "Original" },
                      { key: "alta", label: "Alta" },
                      { key: "equilibrada", label: "Média" },
                      { key: "compacta", label: "Mínima" }
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setImgQuality(opt.key as any)}
                        className={`py-2 px-1 border rounded-xl text-[10px] font-extrabold cursor-pointer transition-all ${
                          imgQuality === opt.key 
                            ? "border-green-primary bg-card-selected text-green-primary ring-1 ring-green-primary" 
                            : "border-border-main bg-card-inner hover:bg-card-inner/80 text-text-sec"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[9.5px] text-text-sec leading-snug font-semibold">
                    {imgQuality === "original" ? "Mantém bytes originais (conversão direta sem alteração de nitidez)." :
                     imgQuality === "alta" ? "Alta fidelidade (90% de qualidade), recomendada para fotos nítidas." :
                     imgQuality === "equilibrada" ? "Equilíbrio ideal (75% de qualidade) para otimização de tamanho." :
                     "Super compactado (50% de qualidade) para envio ultra-rápido por e-mail."}
                  </p>
                </div>
              </div>

              <div className="border-t border-border-main/60 my-4" />

              <div className="space-y-3">
                {isProcessing ? (
                  <div className="space-y-3 bg-card-inner p-4 rounded-xl border border-dashed border-green-primary/40 text-center">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto text-green-primary" />
                    <span className="text-xs font-extrabold text-text-sec block">Criando PDF com imagens ({progress}%)</span>
                    <div className="w-full h-1.5 bg-card-main rounded-full overflow-hidden">
                      <div className="h-full bg-green-primary" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : (
                  <button
                    disabled={imgFiles.length === 0}
                    onClick={processImgToPdf}
                    className={`w-full py-4 px-4 text-xs font-extrabold rounded-xl text-white transition-all cursor-pointer shadow-md flex items-center justify-center space-x-2 ${
                      imgFiles.length > 0
                        ? "bg-green-primary hover:bg-green-dark" 
                        : "bg-card-inner/60 text-text-muted cursor-not-allowed border border-border-main/50"
                    }`}
                  >
                    <FileText className="h-4 w-4" />
                    <span>Gerar PDF das Imagens</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 5: ACTIVE TOOL - ORGANIZE */}
        {activeTool === "organize" && (
          <motion.div 
            key="organize-tool"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start"
          >
            {/* Left Area (3/5) */}
            <div className="lg:col-span-3 space-y-6">
              
              {!organizeFile && (
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => triggerInput(organizeInputRef)}
                  className={`border-2 border-dashed rounded-2xl p-6 md:p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-4 group ${
                    dragActive 
                      ? "border-green-primary bg-green-primary/5" 
                      : "border-border-main bg-card-inner/50 hover:border-green-primary hover:bg-card-inner"
                  }`}
                >
                  <input 
                    ref={organizeInputRef}
                    type="file" 
                    accept=".pdf"
                    className="hidden" 
                    onChange={(e) => e.target.files && handleOrganizeFileAdded(e.target.files)}
                  />
                  
                  <div className="p-3 bg-card-inner rounded-xl border border-border-main text-green-primary group-hover:scale-105 transition-transform duration-200 shadow-sm">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-text-main">Selecione o PDF que deseja reordenar</p>
                    <p className="text-xs text-text-sec">Visualize e altere a ordem das páginas facilmente.</p>
                  </div>
                </div>
              )}

              {/* Success Result block */}
              {successMessage && downloadBlobUrl && (
                <motion.div 
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-card-main border-2 border-green-primary rounded-[24px] p-6 text-center space-y-4 shadow-sm"
                >
                  <div className="mx-auto w-12 h-12 bg-green-primary/10 border border-green-primary/20 text-green-primary rounded-full flex items-center justify-center animate-bounce">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display font-extrabold text-base text-text-main">{successMessage}</h3>
                    <p className="text-xs text-text-sec">Sua nova sequência de páginas foi salva e exportada!</p>
                  </div>
                  <div className="pt-2">
                    <a
                      href={downloadBlobUrl}
                      download={downloadFileName || "reordered.pdf"}
                      className="inline-flex items-center gap-2 py-3 px-6 bg-green-primary hover:bg-green-dark text-white rounded-xl font-extrabold text-xs shadow-md cursor-pointer transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Baixar Novo PDF</span>
                    </a>
                  </div>
                </motion.div>
              )}

              {/* Pages visual display */}
              {organizeFile && organizePages.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-sec">Estrutura das Páginas ({organizePages.length})</h4>
                    <button 
                      onClick={() => setOrganizeFile(null)}
                      className="text-xs font-bold text-rose-500 hover:underline flex items-center gap-1 cursor-pointer animate-pulse"
                    >
                      Remover arquivo
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" id="pages-reorder-grid">
                    {organizePages.map((page, index) => (
                      <div 
                        key={page.index}
                        className="bg-card-inner border border-border-main rounded-xl p-4 text-center space-y-3 relative group shadow-sm flex flex-col justify-between"
                      >
                        <div className="aspect-[3/4] rounded-lg bg-card-main border border-border-main flex flex-col items-center justify-center text-text-sec font-bold text-xs select-none">
                          <FileText className="h-8 w-8 text-text-muted mb-1" />
                          <span className="text-[10px] text-text-sec">{page.label}</span>
                        </div>

                        <div className="text-[10px] text-text-sec font-bold">Posição: {index + 1}</div>

                        <div className="flex items-center justify-between pt-1.5 border-t border-border-main/40">
                          <button 
                            disabled={index === 0}
                            onClick={() => movePageItem(index, "left")}
                            className="p-1.5 text-text-sec hover:text-green-primary hover:bg-card-main border border-border-main rounded-lg disabled:opacity-30 cursor-pointer"
                            title="Mover para esquerda"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            onClick={() => deletePageFromOrganize(index)}
                            className="p-1.5 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-lg cursor-pointer"
                            title="Descartar página"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            disabled={index === organizePages.length - 1}
                            onClick={() => movePageItem(index, "right")}
                            className="p-1.5 text-text-sec hover:text-green-primary hover:bg-card-main border border-border-main rounded-lg disabled:opacity-30 cursor-pointer"
                            title="Mover para direita"
                          >
                            <ArrowRightIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Right Area (2/5): trigger */}
            <div className="lg:col-span-2 space-y-6 bg-card-main p-6 md:p-8 rounded-[24px] border border-border-main">
              <div className="space-y-2">
                <h3 className="font-display font-extrabold text-text-main text-sm flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="w-1.5 h-3.5 bg-green-primary rounded-full inline-block"></span>
                  Geração do Novo PDF
                </h3>
                <p className="text-[11px] text-text-sec font-semibold leading-normal">
                  As páginas excluídas serão removidas e as remanescentes serão ordenadas conforme o grid visual.
                </p>
              </div>

              <div className="border-t border-border-main/60 my-4" />

              <div className="space-y-3">
                {isProcessing ? (
                  <div className="space-y-3 bg-card-inner p-4 rounded-xl border border-dashed border-green-primary/40 text-center">
                    <RefreshCwIcon className="h-5 w-5 animate-spin mx-auto text-green-primary" />
                    <span className="text-xs font-extrabold text-text-sec block">Reordenando páginas do PDF ({progress}%)</span>
                    <div className="w-full h-1.5 bg-card-main rounded-full overflow-hidden">
                      <div className="h-full bg-green-primary" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : (
                  <button
                    disabled={!organizeFile || organizePages.length === 0}
                    onClick={processOrganize}
                    className={`w-full py-4 px-4 text-xs font-extrabold rounded-xl text-white transition-all cursor-pointer shadow-md flex items-center justify-center space-x-2 ${
                      organizeFile && organizePages.length > 0
                        ? "bg-green-primary hover:bg-green-dark" 
                        : "bg-card-inner/60 text-text-muted cursor-not-allowed border border-border-main/50"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Salvar e Exportar PDF</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* VIEW 6: ACTIVE TOOL - DELETE & ROTATE */}
        {activeTool === "deleteRotate" && (
          <motion.div 
            key="dr-tool"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start"
          >
            {/* Left Area (3/5) */}
            <div className="lg:col-span-3 space-y-6">
              
              {!drFile && (
                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => triggerInput(drInputRef)}
                  className={`border-2 border-dashed rounded-2xl p-6 md:p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-4 group ${
                    dragActive 
                      ? "border-green-primary bg-green-primary/5" 
                      : "border-border-main bg-card-inner/50 hover:border-green-primary hover:bg-card-inner"
                  }`}
                >
                  <input 
                    ref={drInputRef}
                    type="file" 
                    accept=".pdf"
                    className="hidden" 
                    onChange={(e) => e.target.files && handleDrFileAdded(e.target.files)}
                  />
                  
                  <div className="p-3 bg-card-inner rounded-xl border border-border-main text-green-primary group-hover:scale-105 transition-transform duration-200 shadow-sm">
                    <Scissors className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-text-main">Selecione o PDF para girar ou excluir páginas</p>
                    <p className="text-xs text-text-sec">Ideal para reajustar orientação de scanner ou deletar folhas extras.</p>
                  </div>
                </div>
              )}

              {/* Success Result block */}
              {successMessage && downloadBlobUrl && (
                <motion.div 
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-card-main border-2 border-green-primary rounded-[24px] p-6 text-center space-y-4 shadow-sm"
                >
                  <div className="mx-auto w-12 h-12 bg-green-primary/10 border border-green-primary/20 text-green-primary rounded-full flex items-center justify-center animate-bounce">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-display font-extrabold text-base text-text-main">{successMessage}</h3>
                    <p className="text-xs text-text-sec">As alterações foram aplicadas e o novo PDF foi criado!</p>
                  </div>
                  <div className="pt-2">
                    <a
                      href={downloadBlobUrl}
                      download={downloadFileName || "edited.pdf"}
                      className="inline-flex items-center gap-2 py-3 px-6 bg-green-primary hover:bg-green-dark text-white rounded-xl font-extrabold text-xs shadow-md cursor-pointer transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      <span>Baixar PDF Modificado</span>
                    </a>
                  </div>
                </motion.div>
              )}

              {/* Page list with rotate control */}
              {drFile && drPages.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-text-sec">Estrutura das Páginas ({drPages.length})</h4>
                    <button 
                      onClick={() => setDrFile(null)}
                      className="text-xs font-bold text-rose-500 hover:underline flex items-center gap-1 cursor-pointer animate-pulse"
                    >
                      Remover arquivo
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" id="pages-dr-grid">
                    {drPages.map((page, index) => (
                      <div 
                        key={page.index}
                        className={`bg-card-inner border rounded-xl p-4 text-center space-y-3 relative group shadow-sm flex flex-col justify-between transition-all ${
                          page.deleted ? "border-rose-500/30 bg-rose-500/10 opacity-75 scale-[0.98]" : "border-border-main"
                        }`}
                      >
                        <div className="aspect-[3/4] rounded-lg bg-card-main border border-border-main flex flex-col items-center justify-center text-text-sec font-bold text-xs select-none relative overflow-hidden">
                          
                          {page.deleted && (
                            <div className="absolute inset-0 bg-rose-500/10 flex items-center justify-center z-10">
                              <span className="bg-rose-500 text-white text-[9px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-md shadow-sm">Marcada p/ Exclusão</span>
                            </div>
                          )}

                          <motion.div 
                            animate={{ rotate: page.rotation }}
                            transition={{ duration: 0.2 }}
                            className="flex flex-col items-center justify-center"
                          >
                            <FileText className="h-8 w-8 text-text-muted mb-1" />
                            <span className="text-[10px] text-text-sec">{page.label}</span>
                          </motion.div>
                        </div>

                        <div className="text-[10px] text-text-sec font-bold">Rotação: {page.rotation}°</div>

                        <div className="flex items-center justify-center gap-1.5 pt-1.5 border-t border-border-main/40">
                          <button 
                            disabled={page.deleted}
                            onClick={() => rotatePage(index)}
                            className="p-1.5 text-green-primary hover:text-green-dark hover:bg-green-primary/10 border border-border-main rounded-lg disabled:opacity-30 cursor-pointer flex-1 flex justify-center"
                            title="Girar 90 graus"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                          </button>
                          <button 
                            onClick={() => togglePageDeletion(index)}
                            className={`p-1.5 border rounded-lg cursor-pointer flex-1 flex justify-center ${
                              page.deleted 
                                ? "bg-rose-500 hover:bg-rose-600 text-white border-rose-500" 
                                : "text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 border border-border-main"
                            }`}
                            title={page.deleted ? "Desfazer descarte" : "Excluir página"}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Right Area (2/5): trigger */}
            <div className="lg:col-span-2 space-y-6 bg-card-main p-6 md:p-8 rounded-[24px] border border-border-main">
              <div className="space-y-2">
                <h3 className="font-display font-extrabold text-text-main text-sm flex items-center gap-1.5 uppercase tracking-wider">
                  <span className="w-1.5 h-3.5 bg-green-primary rounded-full inline-block"></span>
                  Editor de Páginas
                </h3>
                <p className="text-[11px] text-text-sec font-semibold leading-normal">
                  Aplique as rotações e exclusões selecionadas para salvar o seu arquivo finalizado.
                </p>
              </div>

              <div className="border-t border-border-main/60 my-4" />

              <div className="space-y-3">
                {isProcessing ? (
                  <div className="space-y-3 bg-card-inner p-4 rounded-xl border border-dashed border-green-primary/40 text-center">
                    <RefreshCwIcon className="h-5 w-5 animate-spin mx-auto text-green-primary" />
                    <span className="text-xs font-extrabold text-text-sec block">Salvando modificações ({progress}%)</span>
                    <div className="w-full h-1.5 bg-card-main rounded-full overflow-hidden">
                      <div className="h-full bg-green-primary" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ) : (
                  <button
                    disabled={!drFile || drPages.filter(p => !p.deleted).length === 0}
                    onClick={processDeleteRotate}
                    className={`w-full py-4 px-4 text-xs font-extrabold rounded-xl text-white transition-all cursor-pointer shadow-md flex items-center justify-center space-x-2 ${
                      drFile && drPages.filter(p => !p.deleted).length > 0
                        ? "bg-green-primary hover:bg-green-dark" 
                        : "bg-card-inner/60 text-text-muted cursor-not-allowed border border-border-main/50"
                    }`}
                  >
                    <Scissors className="h-4 w-4" />
                    <span>Aplicar Modificações</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Global Error message */}
      {globalError && (
        <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start space-x-3.5 text-left animate-shake" id="pdf-error-banner">
          <AlertCircle className="h-5.5 w-5.5 text-rose-400 mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <h4 className="text-[13px] font-extrabold text-rose-400 uppercase tracking-wider">Erro ao processar</h4>
            <p className="text-[14px] text-rose-400/90 leading-relaxed mt-1 font-semibold">
              {globalError}
            </p>
          </div>
          <button onClick={() => setGlobalError(null)} className="text-text-sec hover:text-text-main shrink-0 cursor-pointer">
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
      )}

    </div>
  );
}

// Inline custom icon components to keep bundle completely stable with Lucide
function RefreshCwIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

const PreviewComparison = ({ 
  originalBytes, 
  compressedBytes, 
  pageNum, 
  totalPages 
}: { 
  originalBytes: Uint8Array; 
  compressedBytes: Uint8Array; 
  pageNum: number;
  totalPages: number;
}) => {
  const origCanvasRef = useRef<HTMLCanvasElement>(null);
  const compCanvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const render = async () => {
      if (!origCanvasRef.current || !compCanvasRef.current) return;
      setLoading(true);

      try {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version || "6.1.200"}/build/pdf.worker.min.mjs`;

        // Load and render original page
        const origTask = pdfjs.getDocument({ data: originalBytes.slice() });
        const origDoc = await origTask.promise;
        if (!active) return;
        const origPage = await origDoc.getPage(pageNum);
        if (!active) return;
        
        const origViewport = origPage.getViewport({ scale: 1.0 });
        const scale = Math.min(380 / origViewport.width, 480 / origViewport.height);
        const renderViewport = origPage.getViewport({ scale });

        const origCanvas = origCanvasRef.current;
        origCanvas.width = renderViewport.width;
        origCanvas.height = renderViewport.height;
        const origCtx = origCanvas.getContext("2d");
        if (origCtx) {
          await origPage.render({ canvasContext: origCtx, viewport: renderViewport } as any).promise;
        }

        // Load and render compressed page
        const compTask = pdfjs.getDocument({ data: compressedBytes.slice() });
        const compDoc = await compTask.promise;
        if (!active) return;
        const compPage = await compDoc.getPage(pageNum);
        if (!active) return;

        const compCanvas = compCanvasRef.current;
        compCanvas.width = renderViewport.width;
        compCanvas.height = renderViewport.height;
        const compCtx = compCanvas.getContext("2d");
        if (compCtx) {
          await compPage.render({ canvasContext: compCtx, viewport: renderViewport } as any).promise;
        }
      } catch (err) {
        console.error("Error rendering side-by-side preview:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    render();

    return () => {
      active = false;
    };
  }, [originalBytes, compressedBytes, pageNum]);

  return (
    <div className="space-y-4 pt-4">
      {loading && (
        <div className="text-center py-2 text-xs text-green-primary flex items-center justify-center gap-1.5 font-bold animate-pulse">
          <RefreshCwIcon className="h-3.5 w-3.5 animate-spin" />
          <span>Renderizando comparação de páginas...</span>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card-inner border border-border-main p-4 rounded-2xl flex flex-col items-center space-y-2">
          <span className="text-[10px] font-bold text-text-sec uppercase tracking-wider">PÁGINA ORIGINAL {pageNum}</span>
          <div className="border border-border-main/50 rounded-xl bg-[#0B1218] overflow-hidden p-1 flex items-center justify-center max-w-full">
            <canvas ref={origCanvasRef} className="max-w-full h-auto object-contain rounded shadow-lg" />
          </div>
        </div>
        <div className="bg-card-inner border border-border-main p-4 rounded-2xl flex flex-col items-center space-y-2">
          <span className="text-[10px] font-bold text-green-primary uppercase tracking-wider">PÁGINA COMPRIMIDA {pageNum}</span>
          <div className="border border-green-primary/30 rounded-xl bg-[#0B1218] overflow-hidden p-1 flex items-center justify-center max-w-full font-semibold">
            <canvas ref={compCanvasRef} className="max-w-full h-auto object-contain rounded shadow-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};
