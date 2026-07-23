/**
 * Service for decoding image files and extracting dimensions and image source
 */

export interface ImageDecodeResult {
  width: number;
  height: number;
  aspectRatio: number;
  previewUrl: string;
  source: ImageBitmap | HTMLImageElement;
  cleanUp: () => void;
}

export async function decodeImageFile(file: File): Promise<ImageDecodeResult> {
  // Try createImageBitmap first (modern, faster, auto-orients in supported browsers)
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const previewUrl = URL.createObjectURL(file);
      return {
        width: bitmap.width,
        height: bitmap.height,
        aspectRatio: bitmap.width / (bitmap.height || 1),
        previewUrl,
        source: bitmap,
        cleanUp: () => {
          bitmap.close();
          URL.revokeObjectURL(previewUrl);
        }
      };
    } catch (err) {
      // Fall back to Image element
    }
  }

  // Fallback to HTMLImageElement via object URL
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      resolve({
        width,
        height,
        aspectRatio: width / (height || 1),
        previewUrl: objectUrl,
        source: img,
        cleanUp: () => {
          URL.revokeObjectURL(objectUrl);
        }
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Falha ao carregar a imagem "${file.name}". O arquivo pode estar corrompido ou ter formato não suportado.`));
    };

    img.src = objectUrl;
  });
}
