/**
 * Device & Browser capabilities for Manual Background Removal
 */

export interface DeviceCapability {
  isMobile: boolean;
  recommendedResolution: number;
  accelerationMode: "Canvas2D (Navegador)";
}

export function detectDeviceCapabilities(): DeviceCapability {
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

  const recommendedResolution = isMobile ? 3072 : 4096;

  return {
    isMobile,
    recommendedResolution,
    accelerationMode: "Canvas2D (Navegador)"
  };
}

export const SUPPORTED_BG_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/bmp"
];

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
