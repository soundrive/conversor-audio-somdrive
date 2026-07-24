import { ParsedSheet } from "../../services/document/excelReaderService";
import {
  PrintSettings,
  PAGE_SIZES,
  MARGINS,
  calculateSmartSettings,
  parseCellRange
} from "./excelPrintSettings";

export interface PageChunk {
  pageIndex: number;
  sheetId: string;
  sheetName: string;
  sheetCustomName: string;
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  scale: number;
  repeatRows: number[];
  orientation: "portrait" | "landscape";
  widthPt: number;
  heightPt: number;
  marginPt: { top: number; bottom: number; left: number; right: number };
}

export function calculatePageChunksForSheet(
  sheet: ParsedSheet,
  settings: PrintSettings
): PageChunk[] {
  if (!sheet.selected) return [];

  // Determine effective range
  let startRow = sheet.minRow;
  let endRow = sheet.maxRow;
  let startCol = sheet.minCol;
  let endCol = sheet.maxCol;

  if (settings.printArea.type === "custom" && settings.printArea.customRange) {
    const range = parseCellRange(settings.printArea.customRange);
    if (range) {
      startRow = Math.max(sheet.minRow, range.startRow);
      endRow = Math.min(sheet.maxRow, range.endRow);
      startCol = Math.max(sheet.minCol, range.startCol);
      endCol = Math.min(sheet.maxCol, range.endCol);
    }
  }

  const colCount = Math.max(1, endCol - startCol + 1);
  const rowCount = Math.max(1, endRow - startRow + 1);

  // Page Dimensions in mm -> convert to pt (1 mm = 2.83465 pt)
  const MM_TO_PT = 2.83465;
  const pageSizeMM = PAGE_SIZES[settings.pageSize] || PAGE_SIZES.A4;
  let rawWidthPt = pageSizeMM.widthMM * MM_TO_PT;
  let rawHeightPt = pageSizeMM.heightMM * MM_TO_PT;

  // Determine orientation
  let orientation: "portrait" | "landscape" = "portrait";
  if (settings.orientation === "auto") {
    const smart = calculateSmartSettings(sheet, settings.pageSize, settings.margin);
    orientation = smart.suggestedOrientation;
  } else {
    orientation = settings.orientation;
  }

  let pageWidthPt = orientation === "landscape" ? Math.max(rawWidthPt, rawHeightPt) : Math.min(rawWidthPt, rawHeightPt);
  let pageHeightPt = orientation === "landscape" ? Math.min(rawWidthPt, rawHeightPt) : Math.max(rawWidthPt, rawHeightPt);

  // Margins in pt
  const marginMM = MARGINS[settings.margin] || MARGINS.normal;
  const marginPt = {
    top: marginMM.topMM * MM_TO_PT,
    bottom: marginMM.bottomMM * MM_TO_PT,
    left: marginMM.leftMM * MM_TO_PT,
    right: marginMM.rightMM * MM_TO_PT
  };

  // Reserve space for header & footer if enabled
  const headerFooterSpacePt = settings.headerFooter.enabled ? 30 : 10;

  const printableWidthPt = pageWidthPt - marginPt.left - marginPt.right;
  const printableHeightPt = pageHeightPt - marginPt.top - marginPt.bottom - headerFooterSpacePt;

  // Calculate unscaled table width and heights
  let totalWidthPx = 0;
  for (let c = startCol; c <= endCol; c++) {
    const idx = c - sheet.minCol;
    totalWidthPx += sheet.colWidths[idx] || 80;
  }

  let totalHeightPx = 0;
  for (let r = startRow; r <= endRow; r++) {
    const idx = r - sheet.minRow;
    totalHeightPx += sheet.rowHeights[idx] || 24;
  }

  // Convert px estimates to pt (1 px approx 0.75 pt)
  const PX_TO_PT = 0.75;
  const totalWidthPt = totalWidthPx * PX_TO_PT;
  const totalHeightPt = totalHeightPx * PX_TO_PT;

  // Calculate scale factor
  let scale = 1.0;
  if (settings.scalingMode === "fit_columns") {
    scale = Math.min(1.0, printableWidthPt / Math.max(1, totalWidthPt));
  } else if (settings.scalingMode === "fit_rows") {
    scale = Math.min(1.0, printableHeightPt / Math.max(1, totalHeightPt));
  } else if (settings.scalingMode === "fit_sheet") {
    scale = Math.min(1.0, printableWidthPt / Math.max(1, totalWidthPt), printableHeightPt / Math.max(1, totalHeightPt));
  } else if (settings.scalingMode === "custom") {
    scale = Math.max(0.1, Math.min(2.0, (settings.customScalePercent || 100) / 100));
  }

  // Minimum legible scale limit
  scale = Math.max(0.35, scale);

  // Identify repeated header rows if enabled
  const repeatRows: number[] = [];
  if (settings.repeatHeader.enabled) {
    const count = settings.repeatHeader.repeatRowsCount || 1;
    for (let r = startRow; r < startRow + count && r <= endRow; r++) {
      repeatRows.push(r);
    }
  }

  // Calculate repeated header height in pt
  let repeatHeaderHeightPt = 0;
  for (const r of repeatRows) {
    const idx = r - sheet.minRow;
    repeatHeaderHeightPt += (sheet.rowHeights[idx] || 24) * PX_TO_PT * scale;
  }

  const chunks: PageChunk[] = [];
  let currentStartRow = startRow;
  let pageIdx = 0;

  while (currentStartRow <= endRow) {
    let currentHeightPt = 0;
    let currentEndRow = currentStartRow;

    const isFirstPage = pageIdx === 0;
    const effectiveRepeatRows = isFirstPage ? [] : repeatRows;
    const reservedHeightPt = isFirstPage ? 0 : repeatHeaderHeightPt;

    while (currentEndRow <= endRow) {
      // If this row is already in repeatRows and not first page, skip duplicate height count
      if (!isFirstPage && repeatRows.includes(currentEndRow)) {
        currentEndRow++;
        continue;
      }

      const rIdx = currentEndRow - sheet.minRow;
      const rowHeightPt = (sheet.rowHeights[rIdx] || 24) * PX_TO_PT * scale;

      if (currentHeightPt + reservedHeightPt + rowHeightPt > printableHeightPt && currentEndRow > currentStartRow) {
        break; // Reached page limit
      }

      currentHeightPt += rowHeightPt;
      currentEndRow++;
    }

    currentEndRow = Math.min(endRow, Math.max(currentStartRow, currentEndRow - 1));

    chunks.push({
      pageIndex: pageIdx,
      sheetId: sheet.id,
      sheetName: sheet.name,
      sheetCustomName: sheet.customName || sheet.name,
      startRow: currentStartRow,
      endRow: currentEndRow,
      startCol,
      endCol,
      scale,
      repeatRows: effectiveRepeatRows,
      orientation,
      widthPt: pageWidthPt,
      heightPt: pageHeightPt,
      marginPt
    });

    pageIdx++;
    currentStartRow = currentEndRow + 1;
  }

  return chunks;
}
