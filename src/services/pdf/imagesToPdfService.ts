/**
 * Service for converting image collections into a PDF document using pdf-lib
 */

import { PDFDocument, PageSizes, rgb } from "pdf-lib";
import { ImageMetadata } from "../../utils/imageValidation";

export type PageSizeOption = "auto" | "a4" | "letter";
export type OrientationOption = "auto" | "portrait" | "landscape";
export type MarginOption = "none" | "small" | "medium" | "large";
export type ImageFitOption = "contain" | "fill";
export type ImageQualityOption = "original" | "maximum" | "high" | "medium" | "economic";

export interface ImagesToPdfOptions {
  pageSize: PageSizeOption;
  orientation: OrientationOption;
  margin: MarginOption;
  fitMode: ImageFitOption;
  quality: ImageQualityOption;
  whiteBackground: boolean;
  centerImage: boolean;
}

export interface ConversionProgress {
  stepText: string;
  processedCount: number;
  totalCount: number;
  percent: number;
}

const MARGIN_VALUES_PT: Record<MarginOption, number> = {
  none: 0,
  small: 15,
  medium: 30,
  large: 45
};

export async function convertImagesToPdf(
  images: ImageMetadata[],
  options: ImagesToPdfOptions,
  onProgress?: (progress: ConversionProgress) => void,
  isCancelled?: () => boolean
): Promise<{ pdfBlob: Blob; pageCount: number; pdfBytes: Uint8Array }> {
  if (!images || images.length === 0) {
    throw new Error("Nenhuma imagem selecionada para a geração do PDF.");
  }

  const pdfDoc = await PDFDocument.create();
  const total = images.length;

  onProgress?.({
    stepText: "Iniciando estruturação do PDF...",
    processedCount: 0,
    totalCount: total,
    percent: 5
  });

  for (let i = 0; i < total; i++) {
    if (isCancelled?.()) {
      throw new Error("Processamento cancelado pelo usuário.");
    }

    const imgMeta = images[i];

    onProgress?.({
      stepText: `Processando imagem ${i + 1} de ${total}: ${imgMeta.name}`,
      processedCount: i,
      totalCount: total,
      percent: Math.round(10 + (i / total) * 80)
    });

    // 1. Process image bytes (compress or convert if needed)
    const { imageBytes, isJpg, imgWidth, imgHeight } = await processImageForPdf(imgMeta, options.quality);

    if (isCancelled?.()) {
      throw new Error("Processamento cancelado pelo usuário.");
    }

    // 2. Embed into pdf-lib
    let embeddedImage;
    if (isJpg) {
      embeddedImage = await pdfDoc.embedJpg(imageBytes);
    } else {
      embeddedImage = await pdfDoc.embedPng(imageBytes);
    }

    // 3. Determine Page Dimensions in Points (1 px = 0.75 pt)
    const naturalWidthPt = imgWidth * 0.75;
    const naturalHeightPt = imgHeight * 0.75;

    let pageWidth = 0;
    let pageHeight = 0;

    if (options.pageSize === "auto") {
      pageWidth = naturalWidthPt;
      pageHeight = naturalHeightPt;
    } else if (options.pageSize === "a4") {
      const [a4W, a4H] = PageSizes.A4;
      pageWidth = a4W;
      pageHeight = a4H;
    } else {
      // letter
      const [letW, letH] = PageSizes.Letter;
      pageWidth = letW;
      pageHeight = letH;
    }

    // 4. Orientation adjustment
    let isLandscape = false;
    if (options.orientation === "auto") {
      isLandscape = imgWidth > imgHeight;
    } else if (options.orientation === "landscape") {
      isLandscape = true;
    } else {
      isLandscape = false; // portrait
    }

    if (options.pageSize !== "auto") {
      const minDim = Math.min(pageWidth, pageHeight);
      const maxDim = Math.max(pageWidth, pageHeight);
      if (isLandscape) {
        pageWidth = maxDim;
        pageHeight = minDim;
      } else {
        pageWidth = minDim;
        pageHeight = maxDim;
      }
    } else {
      // For auto page size, add margin to page
      const mPt = MARGIN_VALUES_PT[options.margin];
      pageWidth += mPt * 2;
      pageHeight += mPt * 2;
    }

    const page = pdfDoc.addPage([pageWidth, pageHeight]);

    // 5. Background color
    if (options.whiteBackground) {
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(1, 1, 1)
      });
    }

    // 6. Calculate Margins and Image Placement
    const marginPt = MARGIN_VALUES_PT[options.margin];
    const availWidth = Math.max(10, pageWidth - marginPt * 2);
    const availHeight = Math.max(10, pageHeight - marginPt * 2);

    let drawWidth = naturalWidthPt;
    let drawHeight = naturalHeightPt;

    const imgAspect = naturalWidthPt / (naturalHeightPt || 1);
    const availAspect = availWidth / (availHeight || 1);

    if (options.fitMode === "fill") {
      // Scale image to fill available area without distorting (crop overflow or fill)
      if (imgAspect > availAspect) {
        drawHeight = availHeight;
        drawWidth = availHeight * imgAspect;
      } else {
        drawWidth = availWidth;
        drawHeight = availWidth / imgAspect;
      }
    } else {
      // "contain": scale image down to fit completely inside available area
      if (naturalWidthPt > availWidth || naturalHeightPt > availHeight || options.pageSize !== "auto") {
        if (imgAspect > availAspect) {
          drawWidth = availWidth;
          drawHeight = availWidth / imgAspect;
        } else {
          drawHeight = availHeight;
          drawWidth = availHeight * imgAspect;
        }
      }
    }

    // Calculate position
    let drawX = marginPt;
    let drawY = marginPt;

    if (options.centerImage) {
      drawX = marginPt + (availWidth - drawWidth) / 2;
      drawY = marginPt + (availHeight - drawHeight) / 2;
    }

    page.drawImage(embeddedImage, {
      x: drawX,
      y: drawY,
      width: drawWidth,
      height: drawHeight
    });
  }

  onProgress?.({
    stepText: "Finalizando arquivo PDF...",
    processedCount: total,
    totalCount: total,
    percent: 95
  });

  const pdfBytes = await pdfDoc.save();
  const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });

  onProgress?.({
    stepText: "Concluído!",
    processedCount: total,
    totalCount: total,
    percent: 100
  });

  return {
    pdfBlob,
    pageCount: total,
    pdfBytes
  };
}

/**
 * Helper to process image bytes and handle quality/compression via HTML5 Canvas
 */
async function processImageForPdf(
  imgMeta: ImageMetadata,
  qualityOpt: ImageQualityOption
): Promise<{ imageBytes: Uint8Array; isJpg: boolean; imgWidth: number; imgHeight: number }> {
  // Check if original file can be embedded as-is without re-encoding
  const isOriginalJpg = imgMeta.file.type === "image/jpeg" || imgMeta.name.match(/\.(jpg|jpeg)$/i);
  const isOriginalPng = imgMeta.file.type === "image/png" || imgMeta.name.match(/\.(png)$/i);

  if (qualityOpt === "original" && (isOriginalJpg || isOriginalPng)) {
    const arrayBuffer = await imgMeta.file.arrayBuffer();
    return {
      imageBytes: new Uint8Array(arrayBuffer),
      isJpg: Boolean(isOriginalJpg),
      imgWidth: imgMeta.width,
      imgHeight: imgMeta.height
    };
  }

  // Determine quality ratio
  let qualityVal = 0.90;
  if (qualityOpt === "maximum") qualityVal = 0.95;
  if (qualityOpt === "high") qualityVal = 0.85;
  if (qualityOpt === "medium") qualityVal = 0.70;
  if (qualityOpt === "economic") qualityVal = 0.55;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;

        // Downscale oversized images if economic or medium quality selected
        if (qualityOpt === "economic" && Math.max(w, h) > 1920) {
          const ratio = 1920 / Math.max(w, h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        } else if (qualityOpt === "medium" && Math.max(w, h) > 2560) {
          const ratio = 2560 / Math.max(w, h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        canvas.width = w;
        canvas.height = h;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Falha ao criar contexto do Canvas para a imagem."));
          return;
        }

        // Fill white background for JPEG conversion (so transparent PNGs don't turn black)
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        const dataUrl = canvas.toDataURL("image/jpeg", qualityVal);
        const base64Data = dataUrl.split(",")[1];
        const binaryStr = atob(base64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let j = 0; j < binaryStr.length; j++) {
          bytes[j] = binaryStr.charCodeAt(j);
        }

        // Clean up canvas
        canvas.width = 0;
        canvas.height = 0;

        resolve({
          imageBytes: bytes,
          isJpg: true,
          imgWidth: w,
          imgHeight: h
        });
      } catch (e: any) {
        reject(new Error(`Erro ao processar a imagem "${imgMeta.name}": ${e.message}`));
      }
    };

    img.onerror = () => {
      reject(new Error(`Falha ao ler os dados da imagem "${imgMeta.name}".`));
    };

    img.src = imgMeta.previewUrl;
  });
}
