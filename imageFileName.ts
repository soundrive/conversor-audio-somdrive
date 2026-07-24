/**
 * Utility for formatting converted image filenames
 */

export function generateConvertedFileName(originalName: string, outputExtension: string): string {
  // Strip original extension
  const lastDotIndex = originalName.lastIndexOf(".");
  const baseName = lastDotIndex > 0 ? originalName.slice(0, lastDotIndex) : originalName;
  
  // Clean file extension
  const cleanExt = outputExtension.toLowerCase().replace(/^\./, "");
  
  return `${baseName}-convertido.${cleanExt}`;
}
