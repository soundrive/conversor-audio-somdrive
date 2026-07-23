/**
 * Main Orchestrator Service for Image Conversion Queue
 */

import { decodeImageFile } from "./imageDecoder";
import { encodeImageCanvas } from "./imageEncoder";
import { generateConvertedFileName } from "../../utils/imageFileName";

export type ImageConversionStatus = "aguardando" | "convertendo" | "concluida" | "falhou" | "cancelada";

export interface ImageItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  originalFormat: string;
  width?: number;
  height?: number;
  previewUrl?: string;
  status: ImageConversionStatus;
  progress: number;
  convertedBlob?: Blob;
  convertedBlobUrl?: string;
  convertedSize?: number;
  convertedFileName?: string;
  outputFormat: "JPG" | "PNG" | "WEBP" | "AVIF" | "BMP";
  errorMessage?: string;
}

export interface ConversionOptions {
  outputFormat: "JPG" | "PNG" | "WEBP" | "AVIF" | "BMP";
  quality: number;
  backgroundColor: string;
}

/**
 * Loads metadata and generates a local thumbnail for an input image file
 */
export async function prepareImageItem(file: File): Promise<Partial<ImageItem>> {
  const originalFormat = getFileExtension(file.name).toUpperCase() || "IMG";
  try {
    const decodeRes = await decodeImageFile(file);
    return {
      width: decodeRes.width,
      height: decodeRes.height,
      previewUrl: decodeRes.previewUrl,
      originalFormat
    };
  } catch (err: any) {
    return {
      originalFormat,
      errorMessage: err.message || "Erro ao ler a imagem."
    };
  }
}

/**
 * Converts a single image item
 */
export async function convertSingleImage(
  item: ImageItem,
  options: ConversionOptions
): Promise<{
  convertedBlob: Blob;
  convertedBlobUrl: string;
  convertedSize: number;
  convertedFileName: string;
  width: number;
  height: number;
}> {
  const decodeRes = await decodeImageFile(item.file);
  try {
    const blob = await encodeImageCanvas(decodeRes.source, decodeRes.width, decodeRes.height, {
      outputFormat: options.outputFormat,
      quality: options.quality,
      backgroundColor: options.backgroundColor
    });

    const convertedBlobUrl = URL.createObjectURL(blob);
    const convertedFileName = generateConvertedFileName(item.name, options.outputFormat);

    return {
      convertedBlob: blob,
      convertedBlobUrl,
      convertedSize: blob.size,
      convertedFileName,
      width: decodeRes.width,
      height: decodeRes.height
    };
  } finally {
    decodeRes.cleanUp();
  }
}

function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts.pop()! : "";
}
