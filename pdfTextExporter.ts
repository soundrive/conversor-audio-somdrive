/**
 * Utility for exporting extracted PDF text as TXT or ZIP files
 */

import { createZipArchive, triggerDownload } from "./downloadZip";

export interface PageTextResult {
  pageNum: number;
  text: string;
}

/**
 * Downloads a single text file (.txt)
 */
export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, filename);
}

/**
 * Downloads a ZIP file containing individual .txt files for each page
 */
export function downloadPagesAsZip(pages: PageTextResult[], zipFilename: string): void {
  const encoder = new TextEncoder();
  const entries = pages.map((p) => {
    const pageNumStr = String(p.pageNum).padStart(3, "0");
    const filename = `pagina-${pageNumStr}.txt`;
    const data = encoder.encode(p.text);
    return { filename, data };
  });

  const zipBlob = createZipArchive(entries);
  triggerDownload(zipBlob, zipFilename);
}
