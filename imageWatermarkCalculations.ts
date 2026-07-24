/**
 * Canvas rendering utilities for Text, Logo, and Repeated Watermarks
 */

import {
  WatermarkSettings,
  NinePosition,
  TextWatermarkConfig,
  LogoWatermarkConfig,
  RepeatWatermarkConfig,
  ProtectionArea
} from "./imageWatermarkPresets";

export interface Point {
  x: number;
  y: number;
}

/**
 * Calculates top-left (x, y) coordinates for a watermark block inside an image
 */
export function calculateAnchorPosition(
  imgW: number,
  imgH: number,
  wmW: number,
  wmH: number,
  position: NinePosition,
  offsetX: number,
  offsetY: number
): Point {
  let x = 0;
  let y = 0;

  switch (position) {
    case "top-left":
      x = offsetX;
      y = offsetY;
      break;
    case "top-center":
      x = (imgW - wmW) / 2 + offsetX;
      y = offsetY;
      break;
    case "top-right":
      x = imgW - wmW - offsetX;
      y = offsetY;
      break;
    case "center-left":
      x = offsetX;
      y = (imgH - wmH) / 2 + offsetY;
      break;
    case "center":
      x = (imgW - wmW) / 2 + offsetX;
      y = (imgH - wmH) / 2 + offsetY;
      break;
    case "center-right":
      x = imgW - wmW - offsetX;
      y = (imgH - wmH) / 2 + offsetY;
      break;
    case "bottom-left":
      x = offsetX;
      y = imgH - wmH - offsetY;
      break;
    case "bottom-center":
      x = (imgW - wmW) / 2 + offsetX;
      y = imgH - wmH - offsetY;
      break;
    case "bottom-right":
    default:
      x = imgW - wmW - offsetX;
      y = imgH - wmH - offsetY;
      break;
  }

  return { x, y };
}

/**
 * Renders text watermark on a 2D canvas context
 */
export function renderTextWatermark(
  ctx: CanvasRenderingContext2D,
  imgW: number,
  imgH: number,
  config: TextWatermarkConfig,
  protectionArea?: ProtectionArea
): void {
  const {
    text,
    fontFamily,
    fontSize,
    color,
    opacity,
    bold,
    italic,
    hasOutline,
    outlineColor,
    hasShadow,
    shadowColor,
    hasBg,
    bgColor,
    rotation,
    position,
    offsetX,
    offsetY,
    scaleMode
  } = config;

  if (!text || text.trim() === "") return;

  ctx.save();

  // Calculate font size in pixels (proportional to image width, or fixed)
  const fontPx =
    scaleMode === "proportional"
      ? Math.max(12, Math.round((imgW * fontSize) / 100))
      : fontSize;

  const fontStyle = `${italic ? "italic " : ""}${bold ? "bold " : ""}${fontPx}px ${fontFamily}, sans-serif`;
  ctx.font = fontStyle;
  ctx.textBaseline = "top";

  const metrics = ctx.measureText(text);
  const textW = metrics.width;
  const textH = fontPx * 1.2;

  // If protection area is enabled, align watermark over or near target coordinates
  let anchor: Point;
  if (protectionArea && protectionArea.enabled) {
    const targetX = (imgW * protectionArea.xPercent) / 100;
    const targetY = (imgH * protectionArea.yPercent) / 100;
    anchor = {
      x: targetX - textW / 2 + offsetX,
      y: targetY - textH / 2 + offsetY
    };
  } else {
    anchor = calculateAnchorPosition(imgW, imgH, textW, textH, position, offsetX, offsetY);
  }

  const centerX = anchor.x + textW / 2;
  const centerY = anchor.y + textH / 2;

  ctx.translate(centerX, centerY);
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }
  ctx.globalAlpha = opacity;

  // Background Box
  if (hasBg) {
    const paddingX = fontPx * 0.4;
    const paddingY = fontPx * 0.2;
    ctx.fillStyle = bgColor;
    ctx.fillRect(
      -textW / 2 - paddingX,
      -textH / 2 - paddingY,
      textW + paddingX * 2,
      textH + paddingY * 2
    );
  }

  // Shadow
  if (hasShadow) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = Math.max(2, Math.round(fontPx * 0.15));
    ctx.shadowOffsetX = Math.max(1, Math.round(fontPx * 0.05));
    ctx.shadowOffsetY = Math.max(1, Math.round(fontPx * 0.05));
  }

  // Outline
  if (hasOutline) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = Math.max(1, Math.round(fontPx * 0.08));
    ctx.strokeText(text, -textW / 2, -textH / 2);
  }

  // Fill Text
  ctx.fillStyle = color;
  ctx.fillText(text, -textW / 2, -textH / 2);

  ctx.restore();
}

/**
 * Renders logo image watermark on canvas context
 */
export function renderLogoWatermark(
  ctx: CanvasRenderingContext2D,
  imgW: number,
  imgH: number,
  config: LogoWatermarkConfig,
  protectionArea?: ProtectionArea
): void {
  const {
    logoSource,
    logoWidth,
    logoHeight,
    scale,
    opacity,
    rotation,
    position,
    offsetX,
    offsetY,
    scaleMode
  } = config;

  if (!logoSource || logoWidth <= 0 || logoHeight <= 0) return;

  ctx.save();

  // Calculate target logo dimensions preserving aspect ratio
  const aspect = logoWidth / logoHeight;
  let targetW: number;
  let targetH: number;

  if (scaleMode === "proportional") {
    targetW = Math.max(20, Math.round((imgW * scale) / 100));
    targetH = Math.round(targetW / aspect);
  } else {
    targetW = Math.max(20, Math.round(logoWidth * (scale / 100)));
    targetH = Math.round(targetW / aspect);
  }

  let anchor: Point;
  if (protectionArea && protectionArea.enabled) {
    const targetX = (imgW * protectionArea.xPercent) / 100;
    const targetY = (imgH * protectionArea.yPercent) / 100;
    anchor = {
      x: targetX - targetW / 2 + offsetX,
      y: targetY - targetH / 2 + offsetY
    };
  } else {
    anchor = calculateAnchorPosition(imgW, imgH, targetW, targetH, position, offsetX, offsetY);
  }

  const centerX = anchor.x + targetW / 2;
  const centerY = anchor.y + targetH / 2;

  ctx.translate(centerX, centerY);
  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }
  ctx.globalAlpha = opacity;

  ctx.drawImage(logoSource, -targetW / 2, -targetH / 2, targetW, targetH);

  ctx.restore();
}

/**
 * Renders repeated watermark over entire canvas
 */
export function renderRepeatWatermark(
  ctx: CanvasRenderingContext2D,
  imgW: number,
  imgH: number,
  config: RepeatWatermarkConfig
): void {
  const {
    type,
    text,
    fontFamily,
    color,
    logoSource,
    logoWidth,
    logoHeight,
    opacity,
    size,
    rotation,
    spacingX,
    spacingY,
    rowOffset,
    pattern
  } = config;

  ctx.save();
  ctx.globalAlpha = opacity;

  if (type === "text" && text) {
    const fontPx = Math.max(12, Math.round((imgW * size) / 100));
    ctx.font = `bold ${fontPx}px ${fontFamily}, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const stepX = Math.max(80, spacingX);
    const stepY = Math.max(60, spacingY);

    // Grid bounds exceeding image dimensions to cover rotated edges
    const diagonal = Math.sqrt(imgW * imgW + imgH * imgH);
    const minX = -diagonal / 2;
    const maxX = imgW + diagonal / 2;
    const minY = -diagonal / 2;
    const maxY = imgH + diagonal / 2;

    let row = 0;
    for (let y = minY; y < maxY; y += stepY) {
      const offsetX = pattern === "diagonal" ? (row % 2) * rowOffset : 0;
      for (let x = minX; x < maxX; x += stepX) {
        ctx.save();
        ctx.translate(x + offsetX, y);
        if (rotation !== 0) {
          ctx.rotate((rotation * Math.PI) / 180);
        }
        ctx.fillText(text, 0, 0);
        ctx.restore();
      }
      row++;
    }
  } else if (type === "logo" && logoSource && logoWidth > 0 && logoHeight > 0) {
    const aspect = logoWidth / logoHeight;
    const targetW = Math.max(20, Math.round((imgW * size) / 100));
    const targetH = Math.round(targetW / aspect);

    const stepX = Math.max(targetW + 20, spacingX);
    const stepY = Math.max(targetH + 20, spacingY);

    const diagonal = Math.sqrt(imgW * imgW + imgH * imgH);
    const minX = -diagonal / 2;
    const maxX = imgW + diagonal / 2;
    const minY = -diagonal / 2;
    const maxY = imgH + diagonal / 2;

    let row = 0;
    for (let y = minY; y < maxY; y += stepY) {
      const offsetX = pattern === "diagonal" ? (row % 2) * rowOffset : 0;
      for (let x = minX; x < maxX; x += stepX) {
        ctx.save();
        ctx.translate(x + offsetX, y);
        if (rotation !== 0) {
          ctx.rotate((rotation * Math.PI) / 180);
        }
        ctx.drawImage(logoSource, -targetW / 2, -targetH / 2, targetW, targetH);
        ctx.restore();
      }
      row++;
    }
  }

  ctx.restore();
}

/**
 * Composite function: Draws source image and then applies configured watermark
 */
export function applyWatermarkToCanvas(
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  settings: WatermarkSettings
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = sourceW;
  canvas.height = sourceH;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Não foi possível criar o contexto 2D do Canvas.");
  }

  // 1. Draw base image
  ctx.drawImage(source, 0, 0, sourceW, sourceH);

  // 2. Render Protection Area Visual Tip if enabled (only subtle outline in rendering or skip for final)
  // Watermark is applied based on settings
  switch (settings.watermarkType) {
    case "text":
      renderTextWatermark(ctx, sourceW, sourceH, settings.textConfig, settings.protectionArea);
      break;
    case "logo":
      renderLogoWatermark(ctx, sourceW, sourceH, settings.logoConfig, settings.protectionArea);
      break;
    case "repeat":
      renderRepeatWatermark(ctx, sourceW, sourceH, settings.repeatConfig);
      break;
  }

  return canvas;
}
