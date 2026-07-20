/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface QueueItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  format: string;
  duration: number | null;
  channels: number | null;
  status: "aguardando" | "preparando" | "convertendo" | "concluido" | "erro" | "cancelado";
  progress: number;
  convertedSize: number | null;
  convertedBlobUrl: string | null;
  convertedFileName: string | null;
  errorMessage: string | null;
  originalBlobUrl?: string | null;
}

export interface Ad {
  id: string;
  title?: string; // legacy title field, mapped to internalTitle if internalTitle is missing
  imageUrl: string; // Base64 data URI or web URL
  storagePath?: string;
  destinationUrl: string;
  altText: string;
  position: string; // e.g. "sidebar_top" | "sidebar_middle" | "sidebar_bottom" | "below_how_it_works" | "below_pdf_tools" | "page_bottom"
  isActive?: boolean; // legacy active state
  active?: boolean; // new active state
  startDate?: string | null; // ISO string or empty
  endDate?: string | null; // ISO string or empty
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;

  // New fields
  internalTitle?: string;
  publicTitle?: string;
  description?: string;
  buttonText?: string;
  format?: string; // "medium_rectangle" | "square" | "horizontal_banner" | "wide_banner" | "automatic" | "custom"
  order?: number;
  customWidth?: number;
  customHeight?: number;
}

export interface SeoConfig {
  siteName: string;
  title: string;
  description: string;
  canonical: string;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: string;
  pages: {
    home: { title: string; description: string };
    audio: { title: string; description: string };
    pdf: { title: string; description: string };
    merge: { title: string; description: string };
    compress: { title: string; description: string };
    imgToPdf: { title: string; description: string };
    organize: { title: string; description: string };
  };
  siteLogoUrl?: string;
  siteTitle?: string;
  siteSubtitle?: string;
}
