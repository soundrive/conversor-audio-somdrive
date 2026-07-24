/**
 * Utility to test native browser canvas image format encoding/decoding support
 */

export interface SupportedFormats {
  jpeg: boolean;
  png: boolean;
  webp: boolean;
  avif: boolean;
  bmp: boolean;
}

export const ALLOWED_INPUT_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/bmp"
];

export const ALLOWED_INPUT_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".bmp"];

/**
 * Checks if browser canvas can encode to a specific MIME type.
 * Returns true only if toDataURL produces a data URI starting with that MIME type.
 */
export function canEncodeMimeType(mimeType: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const dataUrl = canvas.toDataURL(mimeType);
    return dataUrl.startsWith(`data:${mimeType}`);
  } catch (err) {
    return false;
  }
}

export function detectSupportedOutputFormats(): SupportedFormats {
  return {
    jpeg: canEncodeMimeType("image/jpeg"),
    png: canEncodeMimeType("image/png"),
    webp: canEncodeMimeType("image/webp"),
    avif: canEncodeMimeType("image/avif"),
    bmp: canEncodeMimeType("image/bmp")
  };
}

export function getMimeTypeFromFormat(format: string): string {
  const f = format.toLowerCase();
  if (f === "jpg" || f === "jpeg") return "image/jpeg";
  if (f === "png") return "image/png";
  if (f === "webp") return "image/webp";
  if (f === "avif") return "image/avif";
  if (f === "bmp") return "image/bmp";
  return "image/png";
}

export function getExtensionFromFormat(format: string): string {
  const f = format.toLowerCase();
  if (f === "jpg" || f === "jpeg") return "jpg";
  if (f === "png") return "png";
  if (f === "webp") return "webp";
  if (f === "avif") return "avif";
  if (f === "bmp") return "bmp";
  return f;
}
