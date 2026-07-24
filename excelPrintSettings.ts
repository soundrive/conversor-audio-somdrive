import { ParsedSheet } from "../../services/document/excelReaderService";

export type PageSizeOption = "A4" | "Carta" | "Oficio" | "A3";
export type OrientationOption = "auto" | "portrait" | "landscape";
export type MarginOption = "small" | "normal" | "large" | "custom";
export type ScalingModeOption = "real" | "fit_columns" | "fit_rows" | "fit_sheet" | "custom";

export interface DimensionsMM {
  widthMM: number;
  heightMM: number;
}

export const PAGE_SIZES: Record<PageSizeOption, DimensionsMM> = {
  A4: { widthMM: 210, heightMM: 297 },
  Carta: { widthMM: 215.9, heightMM: 279.4 },
  Oficio: { widthMM: 215.9, heightMM: 355.6 },
  A3: { widthMM: 297, heightMM: 420 }
};

export interface MarginMM {
  topMM: number;
  bottomMM: number;
  leftMM: number;
  rightMM: number;
}

export const MARGINS: Record<MarginOption, MarginMM> = {
  small: { topMM: 8, bottomMM: 8, leftMM: 8, rightMM: 8 },
  normal: { topMM: 15, bottomMM: 15, leftMM: 15, rightMM: 15 },
  large: { topMM: 25, bottomMM: 25, leftMM: 25, rightMM: 25 },
  custom: { topMM: 15, bottomMM: 15, leftMM: 15, rightMM: 15 }
};

export interface HeaderFooterConfig {
  enabled: boolean;
  showSheetName: boolean;
  showPageNumber: boolean;
  showFilename: boolean;
  showDate: boolean;
  customText: string;
}

export interface RepeatHeaderConfig {
  enabled: boolean;
  repeatFirstRow: boolean;
  repeatRowsCount: number;
}

export interface PrintAreaConfig {
  type: "all" | "auto" | "custom";
  customRange: string; // e.g. "A1:H50"
}

export interface PrintSettings {
  pageSize: PageSizeOption;
  orientation: OrientationOption;
  margin: MarginOption;
  customMargins?: MarginMM;
  scalingMode: ScalingModeOption;
  customScalePercent: number; // e.g. 100 = 100%
  headerFooter: HeaderFooterConfig;
  repeatHeader: RepeatHeaderConfig;
  printArea: PrintAreaConfig;
}

export const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  pageSize: "A4",
  orientation: "auto",
  margin: "normal",
  scalingMode: "fit_columns",
  customScalePercent: 100,
  headerFooter: {
    enabled: true,
    showSheetName: true,
    showPageNumber: true,
    showFilename: false,
    showDate: false,
    customText: ""
  },
  repeatHeader: {
    enabled: true,
    repeatFirstRow: true,
    repeatRowsCount: 1
  },
  printArea: {
    type: "auto",
    customRange: ""
  }
};

export interface SmartSettingsResult {
  suggestedOrientation: "portrait" | "landscape";
  suggestedScalingMode: ScalingModeOption;
  suggestedRepeatHeader: boolean;
  reason: string;
}

export function calculateSmartSettings(
  sheet: ParsedSheet,
  pageSize: PageSizeOption = "A4",
  margin: MarginOption = "normal"
): SmartSettingsResult {
  const colCount = sheet.colCount || 1;
  const rowCount = sheet.rowCount || 1;

  // Total estimated width in pixels
  let totalWidthPx = 0;
  for (let c = 0; c < colCount; c++) {
    totalWidthPx += sheet.colWidths[c] || 80;
  }

  // Get printable width for A4 portrait
  const dims = PAGE_SIZES[pageSize];
  const margins = MARGINS[margin];
  const printableWidthPortraitMM = dims.widthMM - (margins.leftMM + margins.rightMM);
  const printableWidthPortraitPx = printableWidthPortraitMM * 3.78; // mm to px approx

  const suggestedOrientation: "portrait" | "landscape" =
    colCount > 7 || totalWidthPx > printableWidthPortraitPx ? "landscape" : "portrait";

  const suggestedScalingMode: ScalingModeOption = "fit_columns";
  const suggestedRepeatHeader = rowCount > 25;

  let reason = `Identificado ${colCount} colunas e ${rowCount} linhas. `;
  if (suggestedOrientation === "landscape") {
    reason += "Recomendado orientação Paisagem e Ajuste de Colunas para evitar cortes horizontais.";
  } else {
    reason += "Recomendado orientação Retrato e Ajuste de Colunas para excelente legibilidade.";
  }

  if (suggestedRepeatHeader) {
    reason += " Ativado repetição do cabeçalho devido à extensão da tabela.";
  }

  return {
    suggestedOrientation,
    suggestedScalingMode,
    suggestedRepeatHeader,
    reason
  };
}

// Helper to parse cell range string like "A1:H50" into row/col numbers
export function parseCellRange(rangeStr: string): { startRow: number; endRow: number; startCol: number; endCol: number } | null {
  if (!rangeStr || !rangeStr.includes(":")) return null;
  const parts = rangeStr.trim().toUpperCase().split(":");
  if (parts.length !== 2) return null;

  const parseSingleCell = (str: string) => {
    const match = str.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    const colStr = match[1];
    const rowNum = parseInt(match[2], 10) - 1; // 0-indexed

    let colNum = 0;
    for (let i = 0; i < colStr.length; i++) {
      colNum = colNum * 26 + (colStr.charCodeAt(i) - 64);
    }
    colNum -= 1; // 0-indexed

    return { row: rowNum, col: colNum };
  };

  const start = parseSingleCell(parts[0]);
  const end = parseSingleCell(parts[1]);

  if (!start || !end) return null;

  return {
    startRow: Math.min(start.row, end.row),
    endRow: Math.max(start.row, end.row),
    startCol: Math.min(start.col, end.col),
    endCol: Math.max(start.col, end.col)
  };
}
