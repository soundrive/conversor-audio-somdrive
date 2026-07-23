/**
 * Service for encoding drawn image canvas into desired output format and quality
 */

import { getMimeTypeFromFormat, canEncodeMimeType } from "../../utils/imageFormatSupport";

export interface EncodeOptions {
  outputFormat: "JPG" | "PNG" | "WEBP" | "AVIF" | "BMP";
  quality: number; // 0.1 - 1.0
  backgroundColor?: string; // Hex color string, e.g. "#FFFFFF" for transparency replacement in JPG
}

export async function encodeImageCanvas(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
  options: EncodeOptions
): Promise<Blob> {
  const mimeType = getMimeTypeFromFormat(options.outputFormat);

  // Validate format support before attempting
  if (!canEncodeMimeType(mimeType)) {
    throw new Error(`Seu navegador não possui suporte para gerar arquivos no formato ${options.outputFormat}.`);
  }

  // Create canvas
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
    throw new Error("Não foi possível inicializar o contexto de renderização Canvas.");
  }

  // Handle background fill if target format does not support transparency (like JPG / JPEG)
  const isJpg = options.outputFormat === "JPG" || options.outputFormat === "BMP";
  if (isJpg || options.backgroundColor) {
    const bg = options.backgroundColor || "#FFFFFF";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
  }

  // Draw image onto canvas
  ctx.drawImage(source, 0, 0, width, height);

  // Convert canvas to Blob
  if ("convertToBlob" in canvas && typeof (canvas as OffscreenCanvas).convertToBlob === "function") {
    try {
      return await (canvas as OffscreenCanvas).convertToBlob({
        type: mimeType,
        quality: options.quality
      });
    } catch (err) {
      // Fallback if convertToBlob fails for specific format
    }
  }

  // Fallback to HTMLCanvasElement.toBlob
  const htmlCanvas = canvas as HTMLCanvasElement;
  return new Promise((resolve, reject) => {
    htmlCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error(`Falha ao exportar a imagem no formato ${options.outputFormat}.`));
        }
      },
      mimeType,
      options.quality
    );
  });
}
