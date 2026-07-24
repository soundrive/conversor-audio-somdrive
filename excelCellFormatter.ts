import { ParsedCell } from "../../services/document/excelReaderService";

export function formatCellValueForDisplay(cell: ParsedCell): string {
  if (cell.w !== undefined && cell.w !== null && cell.w !== "") {
    return cell.w;
  }

  const v = cell.v;
  if (v === undefined || v === null || v === "") {
    return "";
  }

  if (typeof v === "number") {
    if (cell.t === "n") {
      // Check if integer or decimal
      if (Number.isInteger(v)) {
        return v.toLocaleString("pt-BR");
      } else {
        return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }
    return String(v);
  }

  if (v instanceof Date) {
    return v.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  }

  return String(v);
}
