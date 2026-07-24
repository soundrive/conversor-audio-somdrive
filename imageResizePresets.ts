/**
 * Presets and constants for Image Resizer
 */

export interface ResizePreset {
  id: string;
  name: string;
  category: "Redes Sociais" | "Documentos" | "Vídeo/Vídeo" | "Geral";
  width: number;
  height: number;
}

export const RESIZE_PRESETS: ResizePreset[] = [
  { id: "insta_feed", name: "Instagram Feed (1080×1350)", category: "Redes Sociais", width: 1080, height: 1350 },
  { id: "insta_square", name: "Instagram Quadrado (1080×1080)", category: "Redes Sociais", width: 1080, height: 1080 },
  { id: "insta_story", name: "Instagram Stories (1080×1920)", category: "Redes Sociais", width: 1080, height: 1920 },
  { id: "fb_post", name: "Facebook Post (1200×630)", category: "Redes Sociais", width: 1200, height: 630 },
  { id: "yt_thumb", name: "YouTube Thumbnail (1280×720)", category: "Vídeo/Vídeo", width: 1280, height: 720 },
  { id: "foto_3x4", name: "Foto 3x4 (Proporção 3:4)", category: "Documentos", width: 600, height: 800 },
  { id: "a4_300dpi", name: "A4 (300 DPI - 2480×3508)", category: "Documentos", width: 2480, height: 3508 },
  { id: "hd", name: "HD (1280×720)", category: "Geral", width: 1280, height: 720 },
  { id: "full_hd", name: "Full HD (1920×1080)", category: "Geral", width: 1920, height: 1080 }
];

export type ResizeMode = "pixels" | "percentage" | "presets";

export type FitMode = "contain" | "cover" | "stretch";

export const PERCENTAGE_OPTIONS = [25, 50, 75, 125, 150, 200];
