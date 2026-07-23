/**
 * Service for Image Resizing Queue
 */

import { decodeImageFile } from "./imageDecoder";
import { canEncodeMimeType, getMimeTypeFromFormat } from "../../utils/imageFormatSupport";
import { FitMode } from "../../utils/imageResizePresets";
import { calculateTargetDimensions } from "../../utils/imageResizeCalculations";

export type ResizerItemStatus = "aguardando" | "redimensionando" | "concluida" | "falhou" | "cancelada";

export interface ResizedImageItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  originalFormat: string;
  origWidth?: number;
  origHeight?: number;
  previewUrl?: string;
  status: ResizerItemStatus;
  progress: number;
  resizedBlob?: Blob;
  resizedBlobUrl?: string;
  resizedSize?: number;
  finalWidth?: number;
  finalHeight?: number;
  resizedFileName?: string;
  isUpscaled?: boolean;
  errorMessage?: string;
}

export interface ResizeGlobalOptions {
  mode: "pixels" | "percentage" | "presets";
  targetWidth: number;
  targetHeight: number;
  keepAspectRatio: boolean;
  percentage: number;
  presetWidth: number;
  presetHeight: number;
  fitMode: FitMode;
  bgColor: "transparent" | "white" | "black" | string;
  quality: number; // 0.1 to 1.0
}

/**
 * Prepares item metadata and preview
 */
export async function prepareResizerItem(file: File): Promise<Partial<ResizedImageItem>> {
  const ext = file.name.split(".").pop()?.toUpperCase() || "IMG";
  try {
    const decodeRes = await decodeImageFile(file);
    return {
      origWidth: decodeRes.width,
      origHeight: decodeRes.height,
      previewUrl: decodeRes.previewUrl,
      originalFormat: ext
    };
  } catch (err: any) {
    return {
      originalFormat: ext,
      errorMessage: err.message || "Erro ao ler o arquivo de imagem."
    };
  }
}

/**
 * Resizes a single image
 */
export async function resizeSingleImage(
  item: ResizedImageItem,
  options: ResizeGlobalOptions
): Promise<{
  resizedBlob: Blob;
  resizedBlobUrl: string;
  resizedSize: number;
  finalWidth: number;
  finalHeight: number;
  resizedFileName: string;
  isUpscaled: boolean;
}> {
  const decodeRes = await decodeImageFile(item.file);

  try {
    const srcW = decodeRes.width;
    const srcH = decodeRes.height;

    // Calculate target dimensions
    const dims = calculateTargetDimensions(srcW, srcH, options.mode, {
      targetWidth: options.targetWidth,
      targetHeight: options.targetHeight,
      keepAspectRatio: options.keepAspectRatio,
      percentage: options.percentage,
      presetWidth: options.presetWidth,
      presetHeight: options.presetHeight
    });

    const targetW = dims.width;
    const targetH = dims.height;

    // Determine target format & MIME
    let targetFormat = item.originalFormat.toUpperCase();
    if (targetFormat === "JPEG") targetFormat = "JPG";
    let mimeType = getMimeTypeFromFormat(targetFormat);

    if (!canEncodeMimeType(mimeType)) {
      if (canEncodeMimeType("image/webp")) {
        targetFormat = "WEBP";
        mimeType = "image/webp";
      } else {
        targetFormat = "JPG";
        mimeType = "image/jpeg";
      }
    }

    // Create Canvas at target dimensions
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

    if (typeof OffscreenCanvas !== "undefined") {
      try {
        canvas = new OffscreenCanvas(targetW, targetH);
        ctx = canvas.getContext("2d");
      } catch (e) {
        canvas = document.createElement("canvas");
        canvas.width = targetW;
        canvas.height = targetH;
        ctx = canvas.getContext("2d");
      }
    } else {
      canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      ctx = canvas.getContext("2d");
    }

    if (!ctx) {
      throw new Error("Não foi possível carregar o ambiente de renderização Canvas.");
    }

    // Enable high-quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Handle background fill
    ctx.clearRect(0, 0, targetW, targetH);

    const isTransparentFormat = targetFormat === "PNG" || targetFormat === "WEBP" || targetFormat === "AVIF";
    
    if (!isTransparentFormat || options.bgColor !== "transparent") {
      let bgHex = "#FFFFFF"; // default white
      if (options.bgColor === "black") bgHex = "#000000";
      else if (options.bgColor === "white") bgHex = "#FFFFFF";
      else if (options.bgColor && options.bgColor !== "transparent") bgHex = options.bgColor;

      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, targetW, targetH);
    }

    // Calculate drawing position based on fitMode
    let drawX = 0;
    let drawY = 0;
    let drawW = targetW;
    let drawH = targetH;

    if (options.fitMode === "stretch") {
      drawX = 0;
      drawY = 0;
      drawW = targetW;
      drawH = targetH;
    } else if (options.fitMode === "contain") {
      const scale = Math.min(targetW / srcW, targetH / srcH);
      drawW = Math.round(srcW * scale);
      drawH = Math.round(srcH * scale);
      drawX = Math.round((targetW - drawW) / 2);
      drawY = Math.round((targetH - drawH) / 2);
    } else if (options.fitMode === "cover") {
      const scale = Math.max(targetW / srcW, targetH / srcH);
      drawW = Math.round(srcW * scale);
      drawH = Math.round(srcH * scale);
      drawX = Math.round((targetW - drawW) / 2);
      drawY = Math.round((targetH - drawH) / 2);
    }

    // Draw image onto canvas
    ctx.drawImage(decodeRes.source, drawX, drawY, drawW, drawH);

    // Export Canvas to Blob
    let resizedBlob: Blob | null = null;

    if ("convertToBlob" in canvas && typeof (canvas as OffscreenCanvas).convertToBlob === "function") {
      try {
        resizedBlob = await (canvas as OffscreenCanvas).convertToBlob({
          type: mimeType,
          quality: options.quality
        });
      } catch (e) {
        // Fallback below
      }
    }

    if (!resizedBlob) {
      const htmlCanvas = canvas as HTMLCanvasElement;
      resizedBlob = await new Promise<Blob>((resolve, reject) => {
        htmlCanvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Falha ao exportar a imagem redimensionada."));
          },
          mimeType,
          options.quality
        );
      });
    }

    // Generate output filename: original-redimensionado.ext
    const lastDotIndex = item.name.lastIndexOf(".");
    const baseName = lastDotIndex > 0 ? item.name.slice(0, lastDotIndex) : item.name;
    const cleanExt = targetFormat.toLowerCase();
    const resizedFileName = `${baseName}-redimensionado.${cleanExt}`;

    const resizedSize = resizedBlob.size;
    const resizedBlobUrl = URL.createObjectURL(resizedBlob);

    return {
      resizedBlob,
      resizedBlobUrl,
      resizedSize,
      finalWidth: targetW,
      finalHeight: targetH,
      resizedFileName,
      isUpscaled: dims.isUpscaling
    };
  } finally {
    decodeRes.cleanUp();
  }
}
