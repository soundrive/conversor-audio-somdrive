/**
 * Utilities for image transform state calculation, dimensions, and history tracking
 */

export interface TransformState {
  rotation: number; // 0, 90, 180, 270 degrees CW
  flipH: boolean;   // horizontal flip
  flipV: boolean;   // vertical flip
  autoOriented?: boolean; // whether EXIF auto-orientation was applied
}

export function createInitialTransformState(): TransformState {
  return {
    rotation: 0,
    flipH: false,
    flipV: false,
    autoOriented: false
  };
}

/**
 * Calculates transformed width and height based on rotation (0, 90, 180, 270)
 */
export function getTransformedDimensions(
  origWidth: number,
  origHeight: number,
  rotation: number
): { width: number; height: number } {
  const normalizedRot = ((rotation % 360) + 360) % 360;
  if (normalizedRot === 90 || normalizedRot === 270) {
    return { width: origHeight, height: origWidth };
  }
  return { width: origWidth, height: origHeight };
}

/**
 * Helper to rotate current angle by delta (+90, -90, +180)
 */
export function rotateAngle(currentRotation: number, delta: number): number {
  return ((currentRotation + delta) % 360 + 360) % 360;
}

/**
 * Renders transformed source (HTMLImageElement or ImageBitmap or Canvas) onto a canvas
 */
export function renderTransformedCanvas(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  transform: TransformState
): HTMLCanvasElement {
  const normRot = ((transform.rotation % 360) + 360) % 360;
  const { width: targetWidth, height: targetHeight } = getTransformedDimensions(
    sourceWidth,
    sourceHeight,
    normRot
  );

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Não foi possível criar contexto 2D para renderização de imagem.");
  }

  ctx.save();
  // Move origin to canvas center
  ctx.translate(targetWidth / 2, targetHeight / 2);

  // Apply rotation
  ctx.rotate((normRot * Math.PI) / 180);

  // Apply flips
  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);

  // Draw source image centered
  ctx.drawImage(
    source,
    -sourceWidth / 2,
    -sourceHeight / 2,
    sourceWidth,
    sourceHeight
  );

  ctx.restore();

  return canvas;
}

/**
 * Generates lightweight data URL preview for thumbnail
 */
export function generateThumbnailPreview(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  transform: TransformState,
  maxDimension: number = 320
): string {
  const normRot = ((transform.rotation % 360) + 360) % 360;
  const { width: fullW, height: fullH } = getTransformedDimensions(sourceWidth, sourceHeight, normRot);

  let scale = 1;
  if (fullW > maxDimension || fullH > maxDimension) {
    scale = Math.min(maxDimension / fullW, maxDimension / fullH);
  }

  const thumbW = Math.max(1, Math.round(fullW * scale));
  const thumbH = Math.max(1, Math.round(fullH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = thumbW;
  canvas.height = thumbH;
  const ctx = canvas.getContext("2d");

  if (!ctx) return "";

  ctx.save();
  ctx.translate(thumbW / 2, thumbH / 2);
  ctx.scale(scale, scale);
  ctx.rotate((normRot * Math.PI) / 180);
  ctx.scale(transform.flipH ? -1 : 1, transform.flipV ? -1 : 1);

  ctx.drawImage(
    source,
    -sourceWidth / 2,
    -sourceHeight / 2,
    sourceWidth,
    sourceHeight
  );

  ctx.restore();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  // clean up canvas
  canvas.width = 0;
  canvas.height = 0;

  return dataUrl;
}
