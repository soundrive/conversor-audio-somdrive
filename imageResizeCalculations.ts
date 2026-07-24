/**
 * Helpers for dimension calculations
 */

export interface TargetDimensions {
  width: number;
  height: number;
  isUpscaling: boolean;
}

/**
 * Calculates target dimensions given original dimensions, mode, and settings.
 */
export function calculateTargetDimensions(
  origWidth: number,
  origHeight: number,
  mode: "pixels" | "percentage" | "presets",
  options: {
    targetWidth?: number;
    targetHeight?: number;
    keepAspectRatio?: boolean;
    percentage?: number;
    presetWidth?: number;
    presetHeight?: number;
  }
): TargetDimensions {
  let width = origWidth;
  let height = origHeight;
  const aspectRatio = origWidth > 0 && origHeight > 0 ? origWidth / origHeight : 1;

  if (mode === "percentage") {
    const pct = (options.percentage || 100) / 100;
    width = Math.max(1, Math.round(origWidth * pct));
    height = Math.max(1, Math.round(origHeight * pct));
  } else if (mode === "presets") {
    width = options.presetWidth || origWidth;
    height = options.presetHeight || origHeight;
  } else {
    // Mode pixels
    const reqW = options.targetWidth || origWidth;
    const reqH = options.targetHeight || origHeight;

    if (options.keepAspectRatio) {
      // If user changed width
      if (reqW !== origWidth) {
        width = Math.max(1, reqW);
        height = Math.max(1, Math.round(width / aspectRatio));
      } else if (reqH !== origHeight) {
        height = Math.max(1, reqH);
        width = Math.max(1, Math.round(height * aspectRatio));
      } else {
        width = reqW;
        height = reqH;
      }
    } else {
      width = Math.max(1, reqW);
      height = Math.max(1, reqH);
    }
  }

  // Cap max dimension to 10000px to prevent browser canvas crash
  const MAX_SAFE_DIM = 10000;
  if (width > MAX_SAFE_DIM || height > MAX_SAFE_DIM) {
    if (width >= height) {
      height = Math.round((height * MAX_SAFE_DIM) / width);
      width = MAX_SAFE_DIM;
    } else {
      width = Math.round((width * MAX_SAFE_DIM) / height);
      height = MAX_SAFE_DIM;
    }
  }

  const isUpscaling = width > origWidth || height > origHeight;

  return { width, height, isUpscaling };
}
