import { renderCroppedCanvas } from "../../utils/imageCropCalculations";
import { CropRegion, CropPreset, CropShape } from "../../utils/imageCropPresets";
import { decodeImageFile } from "./imageDecoder";
import { createZipArchive, triggerDownload, ZipFileEntry } from "../../utils/downloadZip";

export interface SingleCropOptions {
  crop: CropRegion;
  outputFormat: "JPG" | "PNG" | "WEBP";
  quality: number; // 0.1 to 1.0
  rotation?: number; // 0, 90, 180, 270
  flipH?: boolean;
  flipV?: boolean;
  shape?: CropShape;
  borderRadiusPct?: number;
  backgroundColor?: string;
  targetWidth?: number;
  targetHeight?: number;
  presetName?: string;
}

export interface CropProcessResult {
  id: string;
  filename: string;
  blob: Blob;
  url: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  originalSize: number;
  newSize: number;
  presetName?: string;
  presetId?: string;
  format: "JPG" | "PNG" | "WEBP";
}

export interface PackageCropItem {
  preset: CropPreset;
  crop: CropRegion;
}

export interface PackageCropOptions {
  items: PackageCropItem[];
  outputFormat: "JPG" | "PNG" | "WEBP";
  quality: number;
  rotation?: number;
  flipH?: boolean;
  flipV?: boolean;
  shape?: CropShape;
  backgroundColor?: string;
}

/**
 * Process a single image crop
 */
export async function processSingleCrop(
  file: File,
  options: SingleCropOptions
): Promise<CropProcessResult> {
  const decoded = await decodeImageFile(file);

  try {
    const canvas = renderCroppedCanvas(
      decoded.source,
      options.crop,
      options.targetWidth,
      options.targetHeight,
      {
        rotation: options.rotation,
        flipH: options.flipH,
        flipV: options.flipV,
        shape: options.shape,
        borderRadiusPct: options.borderRadiusPct,
        backgroundColor: options.backgroundColor
      }
    );

    const mimeType = options.outputFormat === "PNG" ? "image/png" : options.outputFormat === "WEBP" ? "image/webp" : "image/jpeg";
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b);
          else reject(new Error("Falha ao gerar arquivo da imagem cortada."));
        },
        mimeType,
        options.quality
      );
    });

    const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    const ext = options.outputFormat.toLowerCase();
    const suffix = options.presetName 
      ? `-${options.presetName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`
      : "-recortado";
    const filename = `${baseName}${suffix}.${ext}`;

    const url = URL.createObjectURL(blob);

    return {
      id: Math.random().toString(36).substring(2, 9),
      filename,
      blob,
      url,
      width: canvas.width,
      height: canvas.height,
      originalWidth: decoded.width,
      originalHeight: decoded.height,
      originalSize: file.size,
      newSize: blob.size,
      presetName: options.presetName,
      format: options.outputFormat
    };
  } finally {
    decoded.cleanUp();
  }
}

/**
 * Process package of crops from one image
 */
export async function processPackageCrops(
  file: File,
  options: PackageCropOptions
): Promise<CropProcessResult[]> {
  const decoded = await decodeImageFile(file);
  const results: CropProcessResult[] = [];

  try {
    const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    const ext = options.outputFormat.toLowerCase();
    const mimeType = options.outputFormat === "PNG" ? "image/png" : options.outputFormat === "WEBP" ? "image/webp" : "image/jpeg";

    for (const item of options.items) {
      const canvas = renderCroppedCanvas(
        decoded.source,
        item.crop,
        item.preset.width,
        item.preset.height,
        {
          rotation: options.rotation,
          flipH: options.flipH,
          flipV: options.flipV,
          shape: options.shape,
          backgroundColor: options.backgroundColor
        }
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error(`Falha ao gerar corte para ${item.preset.name}.`));
          },
          mimeType,
          options.quality
        );
      });

      const presetSlug = item.preset.id.replace(/_/g, "-");
      const filename = `${baseName}-${presetSlug}.${ext}`;
      const url = URL.createObjectURL(blob);

      results.push({
        id: Math.random().toString(36).substring(2, 9),
        filename,
        blob,
        url,
        width: canvas.width,
        height: canvas.height,
        originalWidth: decoded.width,
        originalHeight: decoded.height,
        originalSize: file.size,
        newSize: blob.size,
        presetName: item.preset.name,
        presetId: item.preset.id,
        format: options.outputFormat
      });
    }

    return results;
  } finally {
    decoded.cleanUp();
  }
}

/**
 * Generate ZIP file from array of crop results and download
 */
export async function downloadCropResultsZip(
  results: CropProcessResult[],
  zipFilename = "pacote-de-cortes.zip"
): Promise<void> {
  const entries: ZipFileEntry[] = [];

  for (const item of results) {
    const arrayBuffer = await item.blob.arrayBuffer();
    entries.push({
      filename: item.filename,
      data: new Uint8Array(arrayBuffer)
    });
  }

  const zipBlob = createZipArchive(entries);
  triggerDownload(zipBlob, zipFilename);
}
