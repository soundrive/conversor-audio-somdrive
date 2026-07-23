/**
 * Service for converting PDF pages into JPG/PNG images using pdfjs-dist
 */

import * as pdfjs from "pdfjs-dist";

// Set worker source
if (typeof window !== "undefined" && pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version || "6.1.200"}/build/pdf.worker.min.mjs`;
}

export type ImageFormat = "jpg" | "png";
export type DpiOption = 72 | 96 | 150 | 200 | 300;
export type JpgQualityOption = "maximum" | "high" | "medium" | "economic";

export interface PdfToImagesOptions {
  format: ImageFormat;
  dpi: DpiOption;
  jpgQuality: JpgQualityOption;
  whiteBackground: boolean;
  selectedPages: number[]; // 1-indexed page numbers
}

export interface ConvertedPageImage {
  pageNum: number;
  filename: string;
  blob: Blob;
  url: string;
  size: number;
  width: number;
  height: number;
}

export interface PageThumbnail {
  pageNum: number;
  dataUrl: string;
  width: number;
  height: number;
}

const DPI_TO_SCALE: Record<DpiOption, number> = {
  72: 1.0,
  96: 1.33333,
  150: 2.08333,
  200: 2.77778,
  300: 4.16667
};

const JPG_QUALITY_RATES: Record<JpgQualityOption, number> = {
  maximum: 0.95,
  high: 0.85,
  medium: 0.70,
  economic: 0.55
};

export async function loadPdfDocument(file: File): Promise<{ pdfjsDoc: any; numPages: number }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version || "6.1.200"}/cmaps/`,
      cMapPacked: true
    });

    const pdfjsDoc = await loadingTask.promise;
    return {
      pdfjsDoc,
      numPages: pdfjsDoc.numPages
    };
  } catch (err: any) {
    console.error("Error loading PDF document with PDF.js:", err);
    if (err.name === "PasswordException" || err.message?.includes("password")) {
      throw new Error("Este PDF possui senha e precisa ser desbloqueado antes da conversão.");
    }
    throw new Error("Não foi possível ler o arquivo PDF. O documento pode estar corrompido ou ser inválido.");
  }
}

/**
 * Renders lightweight preview thumbnails for pages
 */
export async function generatePageThumbnails(
  pdfjsDoc: any,
  pagesToRender: number[],
  onProgress?: (renderedCount: number, total: number) => void,
  isCancelled?: () => boolean
): Promise<PageThumbnail[]> {
  const thumbnails: PageThumbnail[] = [];
  const total = pagesToRender.length;

  for (let i = 0; i < total; i++) {
    if (isCancelled?.()) break;

    const pageNum = pagesToRender[i];
    try {
      const page = await pdfjsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.25 });

      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(viewport.width));
      canvas.height = Math.max(1, Math.round(viewport.height));

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: ctx,
          viewport
        }).promise;

        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        thumbnails.push({
          pageNum,
          dataUrl,
          width: canvas.width,
          height: canvas.height
        });
      }

      // Cleanup
      canvas.width = 0;
      canvas.height = 0;
    } catch (e) {
      console.warn(`Failed to render thumbnail for page ${pageNum}:`, e);
    }

    onProgress?.(i + 1, total);
  }

  return thumbnails;
}

/**
 * Renders selected PDF pages to high quality Blob images (JPG/PNG)
 */
export async function convertPdfPagesToImages(
  pdfjsDoc: any,
  pdfFileName: string,
  options: PdfToImagesOptions,
  onProgress?: (current: number, total: number, filename: string, item: ConvertedPageImage) => void,
  isCancelled?: () => boolean
): Promise<ConvertedPageImage[]> {
  const pages = options.selectedPages;
  const total = pages.length;
  const results: ConvertedPageImage[] = [];

  if (total === 0) {
    throw new Error("Nenhuma página selecionada para conversão.");
  }

  const baseName = pdfFileName.replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-0\-_]/g, "_");
  const scale = DPI_TO_SCALE[options.dpi] || 2.08333;
  const mimeType = options.format === "png" ? "image/png" : "image/jpeg";
  const qualityRate = options.format === "png" ? 1.0 : JPG_QUALITY_RATES[options.jpgQuality];

  for (let i = 0; i < total; i++) {
    if (isCancelled?.()) {
      throw new Error("Processamento cancelado pelo usuário.");
    }

    const pageNum = pages[i];
    const page = await pdfjsDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Não foi possível obter contexto 2D para renderização.");
    }

    if (options.whiteBackground || options.format === "jpg") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({
      canvasContext: ctx,
      viewport
    }).promise;

    const pagePaddedStr = String(pageNum).padStart(3, "0");
    const filename = `${baseName}-pagina-${pagePaddedStr}.${options.format}`;

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error(`Falha ao converter página ${pageNum} em imagem.`));
        },
        mimeType,
        qualityRate
      );
    });

    const url = URL.createObjectURL(blob);
    const convertedItem: ConvertedPageImage = {
      pageNum,
      filename,
      blob,
      url,
      size: blob.size,
      width: canvas.width,
      height: canvas.height
    };

    results.push(convertedItem);

    // Free canvas memory
    canvas.width = 0;
    canvas.height = 0;

    onProgress?.(i + 1, total, filename, convertedItem);
  }

  return results;
}
