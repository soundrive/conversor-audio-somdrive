export interface CropPreset {
  id: string;
  name: string;
  category: "social" | "document" | "aspect";
  width?: number;
  height?: number;
  aspectRatio?: number; // width / height
  description: string;
  iconName?: string;
  badge?: string;
}

export const CROP_ASPECT_RATIOS: { label: string; value: string; ratio?: number }[] = [
  { label: "Livre", value: "free" },
  { label: "Original", value: "original" },
  { label: "1:1 (Quadrado)", value: "1:1", ratio: 1 },
  { label: "4:5 (Instagram)", value: "4:5", ratio: 4 / 5 },
  { label: "3:4 (Retrato)", value: "3:4", ratio: 3 / 4 },
  { label: "2:3 (Fotografia)", value: "2:3", ratio: 2 / 3 },
  { label: "16:9 (Widescreen)", value: "16:9", ratio: 16 / 9 },
  { label: "9:16 (Vertical)", value: "9:16", ratio: 9 / 16 },
  { label: "3:2 (Horizontal)", value: "3:2", ratio: 3 / 2 },
  { label: "21:9 (Ultrawide)", value: "21:9", ratio: 21 / 9 },
  { label: "Personalizada", value: "custom" }
];

export const SOCIAL_PRESETS: CropPreset[] = [
  {
    id: "insta_square",
    name: "Instagram Quadrado",
    category: "social",
    width: 1080,
    height: 1080,
    aspectRatio: 1,
    description: "Ideal para feed principal do Instagram (1080 × 1080 px)",
    badge: "Popualar"
  },
  {
    id: "insta_feed",
    name: "Instagram Feed Retrato",
    category: "social",
    width: 1080,
    height: 1350,
    aspectRatio: 4 / 5,
    description: "Aproveita mais espaço vertical na tela (1080 × 1350 px)",
    badge: "Recomendado"
  },
  {
    id: "insta_stories",
    name: "Instagram Stories & Reels",
    category: "social",
    width: 1080,
    height: 1920,
    aspectRatio: 9 / 16,
    description: "Tela cheia vertical para Stories, Reels e TikTok (1080 × 1920 px)"
  },
  {
    id: "youtube_thumb",
    name: "YouTube Thumbnail",
    category: "social",
    width: 1280,
    height: 720,
    aspectRatio: 16 / 9,
    description: "Capa padrão em HD para vídeos do YouTube (1280 × 720 px)"
  },
  {
    id: "facebook_post",
    name: "Facebook Post",
    category: "social",
    width: 1200,
    height: 630,
    aspectRatio: 1200 / 630,
    description: "Formato retangular padrão para publicações (1200 × 630 px)"
  },
  {
    id: "profile_pic",
    name: "Foto de Perfil",
    category: "social",
    width: 1080,
    height: 1080,
    aspectRatio: 1,
    description: "Quadrado perfeito otimizado para avatar de redes (1080 × 1080 px)"
  },
  {
    id: "tiktok_vert",
    name: "TikTok Vertical",
    category: "social",
    width: 1080,
    height: 1920,
    aspectRatio: 9 / 16,
    description: "Formato padrão para vídeos do TikTok (1080 × 1920 px)"
  },
  {
    id: "linkedin_post",
    name: "LinkedIn Post",
    category: "social",
    width: 1200,
    height: 627,
    aspectRatio: 1200 / 627,
    description: "Postagem corporativa para o feed do LinkedIn (1200 × 627 px)"
  }
];

export const DOCUMENT_PRESETS: CropPreset[] = [
  {
    id: "photo_3x4",
    name: "Foto 3x4",
    category: "document",
    width: 600,
    height: 800,
    aspectRatio: 3 / 4,
    description: "Foto padrão para documentos pessoais (3 × 4 cm)"
  },
  {
    id: "a4_portrait",
    name: "A4 Retrato",
    category: "document",
    width: 2480,
    height: 3508,
    aspectRatio: 2480 / 3508,
    description: "Proporção da folha A4 vertical para impressão"
  },
  {
    id: "a4_landscape",
    name: "A4 Paisagem",
    category: "document",
    width: 3508,
    height: 2480,
    aspectRatio: 3508 / 2480,
    description: "Proporção da folha A4 horizontal para impressão"
  }
];

export const ALL_CROP_PRESETS = [...SOCIAL_PRESETS, ...DOCUMENT_PRESETS];

export type CropShape = "rect" | "circle" | "rounded";

export interface CropRegion {
  x: number;      // pixels in original image
  y: number;      // pixels in original image
  width: number;  // pixels in original image
  height: number; // pixels in original image
}

export interface FocalPoint {
  xPct: number; // 0 to 100
  yPct: number; // 0 to 100
}

export interface PackagePresetConfig {
  preset: CropPreset;
  enabled: boolean;
  customCrop?: CropRegion; // custom override if user edited this specific preset
}
