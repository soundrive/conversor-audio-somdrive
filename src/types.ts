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
  position: string; // e.g. "top_banner" | "sidebar_top" | "sidebar_middle" | "sidebar_bottom" | "below_how_it_works" | "below_pdf_tools" | "page_bottom"
  isActive?: boolean; // legacy active state
  active?: boolean; // new active state
  startDate?: string | null; // ISO string or empty
  endDate?: string | null; // ISO string or empty
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;

  // Analytics click metrics
  clickCount?: number;
  lastClickedAt?: string | null;

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

export interface PageSeoItem {
  title: string;
  description: string;
  keywords?: string[];
  canonicalUrl?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  allowIndexing?: boolean;
  allowFollow?: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface SeoConfig {
  siteName: string;
  defaultTitle: string;
  defaultDescription: string;
  canonicalUrl: string;
  language: string;
  author: string;
  theme: string;
  
  keywords: string[];

  // Legacy compatibility fields
  title?: string;
  description?: string;
  canonical?: string;
  robots?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: string;

  // Open Graph
  openGraph: {
    title: string;
    description: string;
    image: string;
    url: string;
    type: string;
    siteName: string;
    locale: string;
  };

  // Twitter
  twitter: {
    card: string;
    title: string;
    description: string;
    image: string;
  };

  // Robots & Indexing
  robotsConfig: {
    allowIndexing: boolean;
    allowFollow: boolean;
    sitemapUrl: string;
    canonicalUrl: string;
    blockAdmin: boolean;
    blockPrivateRoutes: boolean;
    blockApi: boolean;
  };

  // Structured Data
  structuredData: {
    webSiteName: string;
    appName: string;
    appCategory: string;
    operatingSystem: string;
    price: string;
    priceCurrency: string;
    browserRequirements: string;
    description: string;
  };

  // Page specific SEO
  pages: {
    home: PageSeoItem;
    audio: PageSeoItem;
    pdf: PageSeoItem;
    howItWorks: PageSeoItem;
    [key: string]: PageSeoItem;
  };

  // FAQ Page items
  faqList: FaqItem[];

  updatedAt?: string;
  updatedBy?: string;

  siteLogoUrl?: string;
  siteTitle?: string;
  siteSubtitle?: string;
}

export function resolveAdImageSrc(ad: Partial<Ad> | Ad): string {
  if (ad.storagePath) {
    return `/api/ads-public-image?path=${encodeURIComponent(ad.storagePath)}`;
  }
  
  const imageUrl = ad.imageUrl || "";
  if (imageUrl.startsWith("data:") || imageUrl.startsWith("/")) {
    return imageUrl;
  }
  
  return `/api/ads-public-image?url=${encodeURIComponent(imageUrl)}`;
}

