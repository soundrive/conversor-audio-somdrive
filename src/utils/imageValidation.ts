/**
 * Utility for validating and reading image files for Images to PDF conversion
 */

export interface ImageMetadata {
  file: File;
  name: string;
  size: number;
  width: number;
  height: number;
  aspectRatio: number;
  previewUrl: string;
  format: string;
}

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp"
];

export const MAX_SINGLE_IMAGE_SIZE = 25 * 1024 * 1024; // 25 MB
export const MAX_TOTAL_IMAGES_SIZE = 500 * 1024 * 1024; // 500 MB
export const MAX_IMAGES_COUNT = 100;

export async function validateAndLoadImage(file: File): Promise<ImageMetadata> {
  const format = file.type.split("/")[1]?.toUpperCase() || "IMG";
  
  if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|bmp)$/i)) {
    throw new Error(`O arquivo "${file.name}" tem um formato não suportado. Envie arquivos JPG, PNG, WEBP ou BMP.`);
  }

  if (file.size > MAX_SINGLE_IMAGE_SIZE) {
    throw new Error(`A imagem "${file.name}" excede o limite máximo de 25 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
  }

  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      resolve({
        file,
        name: file.name,
        size: file.size,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        aspectRatio: (img.naturalWidth || img.width) / ((img.naturalHeight || img.height) || 1),
        previewUrl: objectUrl,
        format
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Falha ao carregar a imagem "${file.name}". O arquivo pode estar corrompido.`));
    };

    img.src = objectUrl;
  });
}
