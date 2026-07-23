/**
 * Service for Image Compression Queue
 */

import { decodeImageFile } from "./imageDecoder";
import { canEncodeMimeType, getMimeTypeFromFormat } from "../../utils/imageFormatSupport";
import { CompressionPreset, getQualityValueForFormat } from "../../utils/imageCompressionLevels";

export type ImageCompressorStatus = "aguardando" | "comprimindo" | "concluida" | "falhou" | "cancelada";

export interface CompressedImageItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  originalFormat: string;
  width?: number;
  height?: number;
  previewUrl?: string;
  status: ImageCompressorStatus;
  progress: number;
  compressedBlob?: Blob;
  compressedBlobUrl?: string;
  compressedSize?: number;
  savedBytes?: number;
  savedPercentage?: number;
  isLargerThanOriginal?: boolean;
  compressedFileName?: string;
  usedPreset?: CompressionPreset;
  usedQuality?: number;
  errorMessage?: string;
}

export interface CompressionOptions {
  preset: CompressionPreset;
  customQualityPercentage: number; // 10 to 100
}

/**
 * Prepares metadata and local thumbnail preview for an image
 */
export async function prepareCompressorItem(file: File): Promise<Partial<CompressedImageItem>> {
  const ext = file.name.split(".").pop()?.toUpperCase() || "IMG";
  try {
    const decodeRes = await decodeImageFile(file);
    return {
      width: decodeRes.width,
      height: decodeRes.height,
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
 * Compresses a single image while preserving format, dimensions, transparency, and orientation.
 */
export async function compressSingleImage(
  item: CompressedImageItem,
  options: CompressionOptions
): Promise<{
  compressedBlob: Blob;
  compressedBlobUrl: string;
  compressedSize: number;
  savedBytes: number;
  savedPercentage: number;
  isLargerThanOriginal: boolean;
  compressedFileName: string;
  width: number;
  height: number;
  usedQuality: number;
}> {
  const decodeRes = await decodeImageFile(item.file);

  try {
    const width = decodeRes.width;
    const height = decodeRes.height;

    // Detect format
    let targetFormat = item.originalFormat.toUpperCase();
    if (targetFormat === "JPEG") targetFormat = "JPG";

    let mimeType = getMimeTypeFromFormat(targetFormat);

    // Fallback if browser can't encode target mimeType (e.g. AVIF or BMP)
    if (!canEncodeMimeType(mimeType)) {
      if (canEncodeMimeType("image/webp")) {
        targetFormat = "WEBP";
        mimeType = "image/webp";
      } else {
        targetFormat = "JPG";
        mimeType = "image/jpeg";
      }
    }

    const qualityValue = getQualityValueForFormat(options.preset, options.customQualityPercentage, targetFormat);

    // Create Canvas at exact original dimensions
    let canvas: HTMLCanvasElement | OffscreenCanvas;
    let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;

    if (typeof OffscreenCanvas !== "undefined") {
      try {
        canvas = new OffscreenCanvas(width, height);
        ctx = canvas.getContext("2d");
      } catch (e) {
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        ctx = canvas.getContext("2d");
      }
    } else {
      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext("2d");
    }

    if (!ctx) {
      throw new Error("Não foi possível carregar o ambiente de renderização Canvas.");
    }

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Fill white background ONLY if format does not support transparency (like JPG / BMP)
    if (targetFormat === "JPG" || targetFormat === "BMP") {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, width, height);
    }

    // Draw source image onto canvas
    ctx.drawImage(decodeRes.source, 0, 0, width, height);

    // Export Canvas to Blob
    let compressedBlob: Blob | null = null;

    if ("convertToBlob" in canvas && typeof (canvas as OffscreenCanvas).convertToBlob === "function") {
      try {
        compressedBlob = await (canvas as OffscreenCanvas).convertToBlob({
          type: mimeType,
          quality: qualityValue
        });
      } catch (e) {
        // Fallback below
      }
    }

    if (!compressedBlob) {
      const htmlCanvas = canvas as HTMLCanvasElement;
      compressedBlob = await new Promise<Blob>((resolve, reject) => {
        htmlCanvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Falha ao exportar a imagem comprimida."));
          },
          mimeType,
          qualityValue
        );
      });
    }

    // Generate output filename: original-comprimido.ext
    const lastDotIndex = item.name.lastIndexOf(".");
    const baseName = lastDotIndex > 0 ? item.name.slice(0, lastDotIndex) : item.name;
    const cleanExt = targetFormat.toLowerCase();
    const compressedFileName = `${baseName}-comprimido.${cleanExt}`;

    const compressedSize = compressedBlob.size;
    const originalSize = item.originalSize;
    const savedBytes = Math.max(0, originalSize - compressedSize);
    const savedPercentage = originalSize > 0 ? Math.round((savedBytes / originalSize) * 100) : 0;
    const isLargerThanOriginal = compressedSize >= originalSize;

    const compressedBlobUrl = URL.createObjectURL(compressedBlob);

    return {
      compressedBlob,
      compressedBlobUrl,
      compressedSize,
      savedBytes,
      savedPercentage,
      isLargerThanOriginal,
      compressedFileName,
      width,
      height,
      usedQuality: qualityValue
    };
  } finally {
    decodeRes.cleanUp();
  }
}
