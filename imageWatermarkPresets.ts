/**
 * Watermark preset types and default presets
 */

export type WatermarkType = "text" | "logo" | "repeat";

export type NinePosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface TextWatermarkConfig {
  text: string;
  fontFamily: string;
  fontSize: number; // relative % (e.g. 5 = 5% of image width) or px
  color: string;
  opacity: number; // 0 to 1
  bold: boolean;
  italic: boolean;
  hasOutline: boolean;
  outlineColor: string;
  hasShadow: boolean;
  shadowColor: string;
  hasBg: boolean;
  bgColor: string;
  rotation: number; // degrees
  position: NinePosition;
  offsetX: number; // px shift
  offsetY: number; // px shift
  scaleMode: "proportional" | "fixed";
}

export interface LogoWatermarkConfig {
  logoFile: File | null;
  logoSource: CanvasImageSource | null;
  logoPreviewUrl: string;
  logoWidth: number;
  logoHeight: number;
  scale: number; // relative % of image width (e.g. 15 = 15%)
  opacity: number; // 0 to 1
  rotation: number;
  position: NinePosition;
  offsetX: number;
  offsetY: number;
  scaleMode: "proportional" | "fixed";
}

export interface RepeatWatermarkConfig {
  type: "text" | "logo";
  text: string;
  fontFamily: string;
  color: string;
  logoSource: CanvasImageSource | null;
  logoWidth: number;
  logoHeight: number;
  opacity: number; // 0 to 1
  size: number; // relative %
  rotation: number; // e.g. -30 or -45
  spacingX: number; // px or %
  spacingY: number; // px or %
  rowOffset: number; // diagonal offset
  pattern: "straight" | "diagonal";
}

export interface ProtectionArea {
  enabled: boolean;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  radiusPercent: number; // 0 to 100
}

export interface WatermarkSettings {
  watermarkType: WatermarkType;
  textConfig: TextWatermarkConfig;
  logoConfig: LogoWatermarkConfig;
  repeatConfig: RepeatWatermarkConfig;
  protectionArea: ProtectionArea;
  presetName?: string;
  outputFormat: "original" | "JPG" | "PNG" | "WEBP";
  qualitySetting: "max" | "high" | "rec";
}

export interface WatermarkPreset {
  id: string;
  name: string;
  description: string;
  settings: Partial<WatermarkSettings>;
}

export const DEFAULT_TEXT_CONFIG: TextWatermarkConfig = {
  text: "SomDrive © " + new Date().getFullYear(),
  fontFamily: "Arial",
  fontSize: 5, // 5% of image width
  color: "#FFFFFF",
  opacity: 0.8,
  bold: true,
  italic: false,
  hasOutline: true,
  outlineColor: "#000000",
  hasShadow: true,
  shadowColor: "rgba(0,0,0,0.5)",
  hasBg: false,
  bgColor: "rgba(0,0,0,0.4)",
  rotation: 0,
  position: "bottom-right",
  offsetX: 20,
  offsetY: 20,
  scaleMode: "proportional"
};

export const DEFAULT_LOGO_CONFIG: LogoWatermarkConfig = {
  logoFile: null,
  logoSource: null,
  logoPreviewUrl: "",
  logoWidth: 0,
  logoHeight: 0,
  scale: 15, // 15% of image width
  opacity: 0.85,
  rotation: 0,
  position: "bottom-right",
  offsetX: 20,
  offsetY: 20,
  scaleMode: "proportional"
};

export const DEFAULT_REPEAT_CONFIG: RepeatWatermarkConfig = {
  type: "text",
  text: "AMOSTRAGEM / PREVIEW",
  fontFamily: "Arial",
  color: "#FFFFFF",
  logoSource: null,
  logoWidth: 0,
  logoHeight: 0,
  opacity: 0.25,
  size: 4, // 4% of width
  rotation: -30,
  spacingX: 180,
  spacingY: 120,
  rowOffset: 60,
  pattern: "diagonal"
};

export const WATERMARK_PRESETS: WatermarkPreset[] = [
  {
    id: "store_product",
    name: "Produto para Loja",
    description: "Nome/logotipo discreto no canto inferior com fundo e opacidade média.",
    settings: {
      watermarkType: "text",
      textConfig: {
        ...DEFAULT_TEXT_CONFIG,
        text: "Sua Loja • R$ 0,00",
        position: "bottom-right",
        opacity: 0.75,
        fontSize: 4,
        hasBg: true,
        bgColor: "rgba(0,0,0,0.5)",
        offsetX: 20,
        offsetY: 20
      }
    }
  },
  {
    id: "portfolio",
    name: "Portfólio & Fotografia",
    description: "Nome ou site elegante no rodapé com alta nitidez.",
    settings: {
      watermarkType: "text",
      textConfig: {
        ...DEFAULT_TEXT_CONFIG,
        text: "© Seu Nome Fotografia | www.seusite.com.br",
        position: "bottom-center",
        opacity: 0.85,
        fontSize: 3.5,
        hasOutline: true,
        outlineColor: "#000000",
        offsetY: 25
      }
    }
  },
  {
    id: "protected_preview",
    name: "Prévia Protegida",
    description: "Marca d’água repetida em diagonal cobrindo toda a imagem.",
    settings: {
      watermarkType: "repeat",
      repeatConfig: {
        ...DEFAULT_REPEAT_CONFIG,
        text: "CÓPIA NÃO AUTORIZADA • PREVIEW",
        opacity: 0.2,
        size: 3.5,
        rotation: -30,
        pattern: "diagonal"
      }
    }
  },
  {
    id: "social_media",
    name: "Redes Sociais",
    description: "Perfil ou marca d'água no canto inferior esquerdo.",
    settings: {
      watermarkType: "text",
      textConfig: {
        ...DEFAULT_TEXT_CONFIG,
        text: "@seu.perfil",
        position: "bottom-left",
        opacity: 0.9,
        fontSize: 4.5,
        hasOutline: true,
        offsetX: 20,
        offsetY: 20
      }
    }
  },
  {
    id: "copyright",
    name: "Direitos Autorais",
    description: "Símbolo de copyright + nome + ano atual.",
    settings: {
      watermarkType: "text",
      textConfig: {
        ...DEFAULT_TEXT_CONFIG,
        text: `© ${new Date().getFullYear()} Todos os direitos reservados`,
        position: "bottom-right",
        opacity: 0.8,
        fontSize: 4,
        offsetX: 20,
        offsetY: 20
      }
    }
  }
];
