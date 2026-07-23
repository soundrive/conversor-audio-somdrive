/**
 * Utility for compressing multiple blobs/files into a ZIP archive using fflate
 */

import { zipSync } from "fflate";

export interface ZipFileEntry {
  filename: string;
  data: Uint8Array;
}

export function createZipArchive(files: ZipFileEntry[]): Blob {
  const zipData: Record<string, Uint8Array> = {};

  for (const entry of files) {
    zipData[entry.filename] = entry.data;
  }

  const zipped = zipSync(zipData, { level: 6 });
  return new Blob([zipped], { type: "application/zip" });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
