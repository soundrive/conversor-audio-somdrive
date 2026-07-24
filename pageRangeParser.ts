/**
 * Parses user input for PDF page range selection (e.g., "1-5", "1,3,7", "2-4,8")
 */

export function parsePageRange(rangeStr: string, totalPages: number): { pages: number[]; error: string | null } {
  if (!rangeStr || !rangeStr.trim()) {
    // If empty, default to all pages
    const all = Array.from({ length: totalPages }, (_, i) => i + 1);
    return { pages: all, error: null };
  }

  const pagesSet = new Set<number>();
  const parts = rangeStr.split(/[,;\s]+/).map(p => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      const num = parseInt(part, 10);
      if (num < 1 || num > totalPages) {
        return { pages: [], error: `Página ${num} fora do limite do documento (1 a ${totalPages}).` };
      }
      pagesSet.add(num);
    } else if (/^\d+-\d+$/.test(part)) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);

      if (start > end) {
        return { pages: [], error: `Intervalo inválido "${part}": a página inicial não pode ser maior que a final.` };
      }
      if (start < 1 || end > totalPages) {
        return { pages: [], error: `Intervalo "${part}" fora do limite do documento (1 a ${totalPages}).` };
      }

      for (let i = start; i <= end; i++) {
        pagesSet.add(i);
      }
    } else {
      return { pages: [], error: `Sintaxe de intervalo de páginas inválida: "${part}". Use formatos como "1-5" ou "1,3,7".` };
    }
  }

  const sortedPages = Array.from(pagesSet).sort((a, b) => a - b);

  if (sortedPages.length === 0) {
    return { pages: [], error: "Nenhuma página válida foi selecionada." };
  }

  return { pages: sortedPages, error: null };
}

export function formatPageRangeString(pages: number[]): string {
  if (pages.length === 0) return "";
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  
  let start = sorted[0];
  let prev = start;

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    if (curr === prev + 1) {
      prev = curr;
    } else {
      if (start === prev) {
        ranges.push(`${start}`);
      } else {
        ranges.push(`${start}-${prev}`);
      }
      start = curr;
      prev = curr;
    }
  }

  if (start === prev) {
    ranges.push(`${start}`);
  } else {
    ranges.push(`${start}-${prev}`);
  }

  return ranges.join(", ");
}
