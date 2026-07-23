/**
 * Presets and helpers for Image Compression
 */

export type CompressionPreset = "maxima" | "alta" | "media" | "economica" | "personalizada";

export interface CompressionLevelConfig {
  id: CompressionPreset;
  label: string;
  description: string;
  jpgQuality: number;
  webpQuality: number;
  avifQuality: number;
  pngLevelLabel: string;
}

export const COMPRESSION_PRESETS: Record<CompressionPreset, CompressionLevelConfig> = {
  maxima: {
    id: "maxima",
    label: "Qualidade Máxima",
    description: "Alteração visual imperceptível, menor redução de peso",
    jpgQuality: 0.92,
    webpQuality: 0.90,
    avifQuality: 0.88,
    pngLevelLabel: "Sem Perda Visível"
  },
  alta: {
    id: "alta",
    label: "Qualidade Alta",
    description: "Excelente equilíbrio entre qualidade visual e peso (Recomendado)",
    jpgQuality: 0.82,
    webpQuality: 0.80,
    avifQuality: 0.78,
    pngLevelLabel: "Otimização Equilibrada"
  },
  media: {
    id: "media",
    label: "Qualidade Média",
    description: "Boa compressão para sites e envios rápidos",
    jpgQuality: 0.70,
    webpQuality: 0.68,
    avifQuality: 0.65,
    pngLevelLabel: "Compactação Média"
  },
  economica: {
    id: "economica",
    label: "Econômica",
    description: "Máxima redução de tamanho de arquivo",
    jpgQuality: 0.55,
    webpQuality: 0.52,
    avifQuality: 0.50,
    pngLevelLabel: "Maior Redução"
  },
  personalizada: {
    id: "personalizada",
    label: "Qualidade Personalizada",
    description: "Ajuste manual da porcentagem de qualidade (10% a 100%)",
    jpgQuality: 0.80,
    webpQuality: 0.80,
    avifQuality: 0.80,
    pngLevelLabel: "Personalizada"
  }
};

export function getQualityValueForFormat(
  preset: CompressionPreset,
  customPercentage: number, // 10 to 100
  format: string
): number {
  if (preset === "personalizada") {
    return Math.max(0.1, Math.min(1.0, customPercentage / 100));
  }

  const fmt = format.toLowerCase();
  const config = COMPRESSION_PRESETS[preset] || COMPRESSION_PRESETS.alta;

  if (fmt === "webp") return config.webpQuality;
  if (fmt === "avif") return config.avifQuality;
  return config.jpgQuality;
}
