/**
 * Utilities for cleaning and formatting extracted text from PDFs
 */

export interface TextCleaningOptions {
  removeDuplicateSpaces: boolean;
  fixExcessiveLineBreaks: boolean;
  joinHyphenatedWords: boolean;
  removeEmptyPages: boolean;
}

export const DEFAULT_CLEANING_OPTIONS: TextCleaningOptions = {
  removeDuplicateSpaces: true,
  fixExcessiveLineBreaks: true,
  joinHyphenatedWords: true,
  removeEmptyPages: false
};

/**
 * Clean a single string or page text according to selected cleaning options
 */
export function cleanExtractedText(text: string, options: TextCleaningOptions): string {
  let cleaned = text;

  // 1. Join hyphenated words at line endings (e.g., "extra- \n ção" -> "extração")
  if (options.joinHyphenatedWords) {
    cleaned = cleaned.replace(/(\b[a-zA-ZáàâãéèêíïóôõöúçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]+)-\s*\r?\n\s*([a-zA-ZáàâãéèêíïóôõöúçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ]+\b)/g, "$1$2");
  }

  // 2. Remove duplicate spaces on the same line
  if (options.removeDuplicateSpaces) {
    cleaned = cleaned.replace(/[ \t]{2,}/g, " ");
  }

  // 3. Fix excessive blank lines (more than 2 consecutive newlines)
  if (options.fixExcessiveLineBreaks) {
    cleaned = cleaned.replace(/(\r?\n){3,}/g, "\n\n");
  }

  return cleaned.trim();
}

/**
 * Calculate character and word count for a text string
 */
export function getTextMetrics(text: string): { charCount: number; wordCount: number } {
  const trimmed = text.trim();
  if (!trimmed) {
    return { charCount: 0, wordCount: 0 };
  }

  const charCount = text.length;
  // Match words considering accented characters
  const words = trimmed.match(/[\wáàâãéèêíïóôõöúçÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇ\-]+/g);
  const wordCount = words ? words.length : 0;

  return { charCount, wordCount };
}
