/**
 * Processes pdfjs textContent items into ordered lines and paragraphs
 */

export type ExtractionMode = "continuous" | "perPage" | "preserveLines";

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasEOL?: boolean;
}

/**
 * Organizes pdfjs text items into readable text lines
 */
export function processPageTextContent(
  items: any[],
  mode: ExtractionMode
): string {
  if (!items || items.length === 0) return "";

  const textItems: TextItem[] = [];

  for (const item of items) {
    if (!item || typeof item.str !== "string") continue;
    const str = item.str;
    if (!str && !item.hasEOL) continue;

    const transform = item.transform || [1, 0, 0, 1, 0, 0];
    const x = transform[4] || 0;
    const y = transform[5] || 0;

    textItems.push({
      str,
      x,
      y,
      width: item.width || 0,
      height: item.height || 0,
      hasEOL: item.hasEOL
    });
  }

  if (textItems.length === 0) return "";

  // Group items by Y coordinate with a line tolerance (e.g., 3.5 points)
  const lineTolerance = 3.5;
  const lines: { y: number; items: TextItem[] }[] = [];

  for (const item of textItems) {
    let foundLine = false;
    for (const line of lines) {
      if (Math.abs(line.y - item.y) <= lineTolerance) {
        line.items.push(item);
        foundLine = true;
        break;
      }
    }
    if (!foundLine) {
      lines.push({ y: item.y, items: [item] });
    }
  }

  // Sort lines from top to bottom (higher Y in PDF coordinate system means top of page)
  lines.sort((a, b) => b.y - a.y);

  // For each line, sort items horizontally (left to right by X)
  const lineStrings: string[] = [];

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);

    let lineStr = "";
    let prevItem: TextItem | null = null;

    for (const item of line.items) {
      if (prevItem) {
        const gap = item.x - (prevItem.x + prevItem.width);
        // Add a space if there's a horizontal gap between text fragments
        if (gap > 2 && !lineStr.endsWith(" ") && !item.str.startsWith(" ")) {
          lineStr += " ";
        }
      }
      lineStr += item.str;
      prevItem = item;
    }

    if (lineStr.trim()) {
      lineStrings.push(lineStr.trim());
    }
  }

  if (mode === "preserveLines") {
    return lineStrings.join("\n");
  } else {
    // Group lines into paragraphs if there's significant vertical spacing or sentences
    return lineStrings.join("\n");
  }
}
