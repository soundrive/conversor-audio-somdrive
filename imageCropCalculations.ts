import { CropRegion, FocalPoint, CropShape } from "./imageCropPresets";

/**
 * Calculates initial crop box centered around a focal point for a target aspect ratio.
 */
export function calculateCropRegionForFocalPoint(
  imgWidth: number,
  imgHeight: number,
  targetAspectRatio: number | undefined, // width / height
  focalPoint?: FocalPoint
): CropRegion {
  let cropWidth = imgWidth;
  let cropHeight = imgHeight;

  if (targetAspectRatio && targetAspectRatio > 0) {
    const imgRatio = imgWidth / imgHeight;
    if (imgRatio > targetAspectRatio) {
      // Image is wider than target aspect ratio -> constrain cropWidth
      cropHeight = imgHeight;
      cropWidth = imgHeight * targetAspectRatio;
    } else {
      // Image is taller than target aspect ratio -> constrain cropHeight
      cropWidth = imgWidth;
      cropHeight = cropWidth / targetAspectRatio;
    }
  }

  // Determine center based on focal point or image center
  const focalX = focalPoint ? (focalPoint.xPct / 100) * imgWidth : imgWidth / 2;
  const focalY = focalPoint ? (focalPoint.yPct / 100) * imgHeight : imgHeight / 2;

  let x = focalX - cropWidth / 2;
  let y = focalY - cropHeight / 2;

  // Clamp crop box within image boundaries
  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + cropWidth > imgWidth) x = imgWidth - cropWidth;
  if (y + cropHeight > imgHeight) y = imgHeight - cropHeight;

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight)
  };
}

/**
 * Checks if focal point is near border in a given crop box
 */
export function isFocalPointNearEdge(
  focalPoint: FocalPoint,
  crop: CropRegion,
  imgWidth: number,
  imgHeight: number,
  thresholdPct = 10
): boolean {
  const fx = (focalPoint.xPct / 100) * imgWidth;
  const fy = (focalPoint.yPct / 100) * imgHeight;

  const leftDist = fx - crop.x;
  const rightDist = (crop.x + crop.width) - fx;
  const topDist = fy - crop.y;
  const bottomDist = (crop.y + crop.height) - fy;

  const minHoriz = crop.width * (thresholdPct / 100);
  const minVert = crop.height * (thresholdPct / 100);

  return (
    leftDist < minHoriz ||
    rightDist < minHoriz ||
    topDist < minVert ||
    bottomDist < minVert
  );
}

/**
 * Render cropped image onto a new HTMLCanvasElement with transforms & shape masks
 */
export function renderCroppedCanvas(
  source: HTMLImageElement | HTMLCanvasElement | ImageBitmap,
  crop: CropRegion,
  targetWidth?: number,
  targetHeight?: number,
  options: {
    rotation?: number; // 0, 90, 180, 270
    flipH?: boolean;
    flipV?: boolean;
    shape?: CropShape;
    borderRadiusPct?: number;
    backgroundColor?: string; // "transparent" | "#ffffff" | etc.
  } = {}
): HTMLCanvasElement {
  const finalWidth = targetWidth || crop.width;
  const finalHeight = targetHeight || crop.height;

  const canvas = document.createElement("canvas");
  canvas.width = finalWidth;
  canvas.height = finalHeight;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Não foi possível obter o contexto 2D do Canvas.");
  }

  // 1. Fill background if set and not transparent
  if (options.backgroundColor && options.backgroundColor !== "transparent") {
    ctx.fillStyle = options.backgroundColor;
    ctx.fillRect(0, 0, finalWidth, finalHeight);
  }

  ctx.save();

  // 2. Apply Shape Mask
  if (options.shape === "circle") {
    ctx.beginPath();
    ctx.ellipse(
      finalWidth / 2,
      finalHeight / 2,
      finalWidth / 2,
      finalHeight / 2,
      0,
      0,
      2 * Math.PI
    );
    ctx.clip();
  } else if (options.shape === "rounded") {
    const radius = ((options.borderRadiusPct || 10) / 100) * Math.min(finalWidth, finalHeight);
    ctx.beginPath();
    ctx.roundRect(0, 0, finalWidth, finalHeight, radius);
    ctx.clip();
  }

  // 3. Draw cropped sub-rectangle with high quality smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Handle rotation and flip if any
  const rotation = options.rotation || 0;
  const flipH = options.flipH || false;
  const flipV = options.flipV || false;

  if (rotation !== 0 || flipH || flipV) {
    // Render source crop region to temporary canvas first, then transform
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = crop.width;
    tempCanvas.height = crop.height;
    const tempCtx = tempCanvas.getContext("2d");
    if (tempCtx) {
      tempCtx.imageSmoothingEnabled = true;
      tempCtx.imageSmoothingQuality = "high";
      tempCtx.drawImage(
        source,
        crop.x, crop.y, crop.width, crop.height,
        0, 0, crop.width, crop.height
      );
    }

    // Now apply transform to final context
    ctx.translate(finalWidth / 2, finalHeight / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    const drawW = (rotation === 90 || rotation === 270) ? finalHeight : finalWidth;
    const drawH = (rotation === 90 || rotation === 270) ? finalWidth : finalHeight;

    ctx.drawImage(
      tempCanvas,
      0, 0, crop.width, crop.height,
      -drawW / 2, -drawH / 2, drawW, drawH
    );
  } else {
    // Direct draw
    ctx.drawImage(
      source,
      crop.x, crop.y, crop.width, crop.height,
      0, 0, finalWidth, finalHeight
    );
  }

  ctx.restore();
  return canvas;
}
