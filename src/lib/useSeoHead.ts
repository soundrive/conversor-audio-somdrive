import { useEffect, useState } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, onSnapshot, getDoc } from "firebase/firestore";
import { SeoConfig, PageSeoItem, FaqItem } from "../types";
import firebaseConfig from "../../firebase-applet-config.json";

// Default seed SEO configuration
export const DEFAULT_SEO_CONFIG: SeoConfig = {
  siteName: "Conversor SomDrive",
  defaultTitle: "Conversor SomDrive - Ferramentas de Áudio e PDF Online Grátis",
  defaultDescription: "Converta arquivos de áudio para MP3, WAV, AAC, OGG e FLAC, e gerencie documentos PDF com ferramentas gratuitas online: juntar, comprimir, imagem para PDF e organizar páginas.",
  canonicalUrl: "https://conversor.somdrive.com.br",
  language: "pt-BR",
  author: "SomDrive",
  theme: "#10b981",

  keywords: [
    "conversor de audio",
    "converter mp3",
    "juntar pdf",
    "comprimir pdf",
    "imagem para pdf",
    "somdrive",
    "converter audio online",
    "ferramentas de pdf gratis",
    "conversor de mp3 para wav",
    "organizar paginas de pdf"
  ],

  openGraph: {
    title: "Conversor SomDrive - Ferramentas de Áudio e PDF Grátis",
    description: "Converta áudios em alta qualidade e gerencie PDFs com total privacidade e velocidade. 100% gratuito e direto no seu navegador.",
    image: "https://conversor.somdrive.com.br/logo.svg",
    url: "https://conversor.somdrive.com.br",
    type: "website",
    siteName: "Conversor SomDrive",
    locale: "pt_BR"
  },

  twitter: {
    card: "summary_large_image",
    title: "Conversor SomDrive - Ferramentas de Áudio e PDF Grátis",
    description: "Converta áudios em alta qualidade e gerencie PDFs com total privacidade e velocidade. 100% gratuito e direto no seu navegador.",
    image: "https://conversor.somdrive.com.br/logo.svg"
  },

  robotsConfig: {
    allowIndexing: true,
    allowFollow: true,
    sitemapUrl: "https://conversor.somdrive.com.br/sitemap.xml",
    canonicalUrl: "https://conversor.somdrive.com.br",
    blockAdmin: true,
    blockPrivateRoutes: true,
    blockApi: true
  },

  structuredData: {
    webSiteName: "Conversor SomDrive",
    appName: "Conversor SomDrive & PDF Tools",
    appCategory: "MultimediaApplication",
    operatingSystem: "Web/Browser",
    price: "0",
    priceCurrency: "BRL",
    browserRequirements: "Navegador Web com suporte a HTML5 e WebAssembly",
    description: "Ferramenta online gratuita para conversão rápida de áudios e edição de arquivos PDF sem limites."
  },

  pages: {
    home: {
      title: "Conversor SomDrive - Ferramentas de Áudio e PDF Online Grátis",
      description: "Converta arquivos de áudio e edite PDFs gratuitamente online. Rápido, seguro e sem instalação.",
      keywords: ["conversor de audio", "ferramentas pdf", "somdrive", "conversor mp3"],
      canonicalUrl: "https://conversor.somdrive.com.br",
      allowIndexing: true,
      allowFollow: true
    },
    audio: {
      title: "Conversor de Áudio Online Grátis - MP3, WAV, AAC, OGG | SomDrive",
      description: "Converta qualquer arquivo de áudio para MP3, WAV, AAC, OGG, M4A ou FLAC em alta fidelidade diretamente no seu navegador.",
      keywords: ["conversor mp3", "converter audio", "mp3 para wav", "audio converter"],
      canonicalUrl: "https://conversor.somdrive.com.br/audio",
      allowIndexing: true,
      allowFollow: true
    },
    pdf: {
      title: "Ferramentas PDF Online Grátis - Juntar, Comprimir, Converter | SomDrive",
      description: "Edite seus arquivos PDF gratuitamente: junte múltiplos PDFs, reduza o tamanho mantendo a qualidade, converta imagens JPG/PNG para PDF e reordene páginas.",
      keywords: ["juntar pdf", "comprimir pdf", "imagem para pdf", "organizar pdf"],
      canonicalUrl: "https://conversor.somdrive.com.br/pdf",
      allowIndexing: true,
      allowFollow: true
    },
    howItWorks: {
      title: "Como Funciona | Conversor SomDrive & PDF Tools",
      description: "Saiba como utilizar o Conversor SomDrive para converter áudios e editar arquivos PDF com máxima privacidade e processamento instantâneo.",
      keywords: ["como funciona somdrive", "privacidade conversor audio", "tutorial pdf"],
      canonicalUrl: "https://conversor.somdrive.com.br/como-funciona",
      allowIndexing: true,
      allowFollow: true
    },
    videoToAudio: {
      title: "Extrair Áudio de Vídeo para MP3 ou WAV | SomDrive",
      description: "Extraia o áudio de vídeos MP4, MOV, M4V e WebM para MP3 ou WAV diretamente no navegador do computador, sem enviar arquivos para servidores.",
      keywords: [
        "extrair áudio de vídeo",
        "vídeo para MP3",
        "vídeo para WAV",
        "converter vídeo para MP3",
        "converter vídeo para WAV",
        "MP4 para MP3",
        "MP4 para WAV",
        "MOV para MP3",
        "MOV para WAV",
        "M4V para MP3",
        "WebM para MP3",
        "extrair som de vídeo",
        "converter vídeo em áudio",
        "conversor de vídeo para áudio",
        "conversor de vídeo no computador",
        "extrair áudio online grátis",
        "conversor SomDrive"
      ],
      canonicalUrl: "https://conversor.somdrive.com.br/video-para-audio",
      allowIndexing: true,
      allowFollow: true
    },
    imagesToPdf: {
      title: "Imagens para PDF Grátis: JPG, PNG e WEBP | SomDrive",
      description: "Transforme imagens JPG, PNG e WEBP em um único arquivo PDF, organize a ordem das páginas e baixe gratuitamente.",
      keywords: [
        "imagens para PDF",
        "JPG para PDF",
        "PNG para PDF",
        "WEBP para PDF",
        "converter imagem em PDF",
        "transformar foto em PDF",
        "juntar imagens em PDF",
        "criar PDF com imagens",
        "fotos para PDF",
        "converter JPG para PDF grátis",
        "converter PNG para PDF online"
      ],
      canonicalUrl: "https://conversor.somdrive.com.br/pdf/imagens-para-pdf",
      allowIndexing: true,
      allowFollow: true
    },
    pdfToImages: {
      title: "PDF para JPG ou PNG Grátis | SomDrive",
      description: "Converta páginas de PDF para imagens JPG ou PNG, escolha a resolução e baixe individualmente ou em arquivo ZIP.",
      keywords: [
        "PDF para JPG",
        "PDF para PNG",
        "converter PDF em imagem",
        "transformar PDF em JPG",
        "PDF em PNG",
        "extrair páginas do PDF como imagem",
        "converter PDF para imagens grátis",
        "baixar páginas do PDF em JPG",
        "PDF para imagem online"
      ],
      canonicalUrl: "https://conversor.somdrive.com.br/pdf/pdf-para-imagens",
      allowIndexing: true,
      allowFollow: true
    },
    imageConverter: {
      title: "Conversor de Imagens Grátis: JPG, PNG, WEBP e AVIF | SomDrive",
      description: "Converta imagens entre JPG, PNG, WEBP, AVIF e BMP gratuitamente, com qualidade personalizada e download em lote.",
      keywords: [
        "conversor de imagens",
        "converter JPG para PNG",
        "converter PNG para JPG",
        "WEBP para PNG",
        "WEBP para JPG",
        "AVIF para JPG",
        "BMP para PNG",
        "converter foto online",
        "conversor de imagem gratis"
      ],
      canonicalUrl: "https://conversor.somdrive.com.br/imagem/converter",
      allowIndexing: true,
      allowFollow: true
    },
    imageCompressor: {
      title: "Comprimir Imagem Grátis: JPG, PNG e WEBP | SomDrive",
      description: "Reduza o tamanho de imagens JPG, PNG, WEBP e AVIF gratuitamente, mantendo uma boa qualidade e baixando individualmente ou em ZIP.",
      keywords: [
        "comprimir imagem",
        "reduzir tamanho de imagem",
        "diminuir imagem",
        "comprimir JPG",
        "comprimir PNG",
        "comprimir WEBP",
        "reduzir MB da foto",
        "diminuir tamanho da foto",
        "otimizar imagem",
        "compactar imagem",
        "compressor de imagem grátis",
        "reduzir peso da imagem",
        "comprimir fotos online",
        "diminuir KB da imagem",
        "reduzir tamanho JPG"
      ],
      canonicalUrl: "https://conversor.somdrive.com.br/imagem/comprimir",
      allowIndexing: true,
      allowFollow: true
    },
    imageResizer: {
      title: "Redimensionar Imagem Grátis em Pixels e Porcentagem | SomDrive",
      description: "Redimensione imagens JPG, PNG, WEBP e AVIF em pixels, porcentagem ou tamanhos prontos, com download individual ou em lote.",
      keywords: [
        "redimensionar imagem",
        "alterar tamanho de imagem",
        "diminuir imagem",
        "aumentar imagem",
        "mudar largura e altura da foto",
        "redimensionar JPG",
        "redimensionar PNG",
        "redimensionar WEBP",
        "imagem 1080x1080",
        "imagem 1080x1920",
        "imagem 1280x720",
        "redimensionar foto online",
        "alterar pixels da imagem",
        "redimensionar imagem grátis"
      ],
      canonicalUrl: "https://conversor.somdrive.com.br/imagem/redimensionar",
      allowIndexing: true,
      allowFollow: true
    },
    imageCropper: {
      title: "Cortar Imagem Grátis e Criar Tamanhos para Redes Sociais | SomDrive",
      description: "Recorte imagens livremente ou crie vários tamanhos prontos para Instagram, YouTube, Facebook, TikTok e documentos de uma só vez.",
      keywords: [
        "cortar imagem",
        "recortar foto online",
        "cortar foto gratis",
        "cortar imagem instagram",
        "recortar foto 3x4",
        "pacote de cortes",
        "cortar foto 1080x1080",
        "cortar foto para stories",
        "cortar imagem youtube thumbnail"
      ],
      canonicalUrl: "https://conversor.somdrive.com.br/imagem/cortar",
      allowIndexing: true,
      allowFollow: true
    }
  },

  faqList: [
    {
      id: "faq-1",
      question: "O Conversor SomDrive é 100% gratuito?",
      answer: "Sim! Todas as nossas ferramentas de áudio e PDF são completamente gratuitas e ilimitadas, sem necessidade de cadastro."
    },
    {
      id: "faq-2",
      question: "Meus arquivos são salvos ou mantidos no servidor?",
      answer: "Não. Garantimos sua total privacidade. O processamento dos seus arquivos é feito de forma segura e temporária, e seus documentos são descartados após a conclusão."
    },
    {
      id: "faq-3",
      question: "Quais formatos de áudio são suportados?",
      answer: "Aceitamos os principais formatos de áudio incluindo MP3, WAV, AAC, OGG, M4A, FLAC, WMA, OPUS e AIFF para conversão em alta definição."
    },
    {
      id: "faq-4",
      question: "Como juntar vários arquivos PDF em um único documento?",
      answer: "Acesse a seção 'Ferramentas PDF', escolha 'Juntar PDFs', envie os arquivos desejados, organize a ordem das páginas e clique em 'Juntar PDFs' para baixar o documento final."
    }
  ]
};

// Singleton DB instance
function getFirestoreDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
}

// React Hook to inject SEO tags dynamically into DOM <head>
export function useSeoHead(routeKey: string = "home", customTitle?: string, customDescription?: string) {
  const [seoConfig, setSeoConfig] = useState<SeoConfig>(DEFAULT_SEO_CONFIG);

  useEffect(() => {
    try {
      const db = getFirestoreDb();
      const seoRef = doc(db, "site_settings", "seo");

      const unsubscribe = onSnapshot(seoRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<SeoConfig>;
          setSeoConfig({
            ...DEFAULT_SEO_CONFIG,
            ...data,
            openGraph: { ...DEFAULT_SEO_CONFIG.openGraph, ...(data.openGraph || {}) },
            twitter: { ...DEFAULT_SEO_CONFIG.twitter, ...(data.twitter || {}) },
            robotsConfig: { ...DEFAULT_SEO_CONFIG.robotsConfig, ...(data.robotsConfig || {}) },
            structuredData: { ...DEFAULT_SEO_CONFIG.structuredData, ...(data.structuredData || {}) },
            pages: { ...DEFAULT_SEO_CONFIG.pages, ...(data.pages || {}) },
            faqList: data.faqList || DEFAULT_SEO_CONFIG.faqList,
            keywords: data.keywords || DEFAULT_SEO_CONFIG.keywords
          });
        }
      }, (err) => {
        console.warn("[SEO HEAD] Listener on site_settings/seo failed, fallback default:", err);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn("[SEO HEAD] Error setting up listener:", e);
    }
  }, []);

  useEffect(() => {
    // Determine active page SEO settings
    const pageItem: PageSeoItem | undefined = seoConfig.pages[routeKey];
    
    const pageTitle = customTitle || pageItem?.title || seoConfig.defaultTitle || DEFAULT_SEO_CONFIG.defaultTitle;
    const pageDescription = customDescription || pageItem?.description || seoConfig.defaultDescription || DEFAULT_SEO_CONFIG.defaultDescription;
    const pageCanonical = pageItem?.canonicalUrl || seoConfig.canonicalUrl || DEFAULT_SEO_CONFIG.canonicalUrl;
    
    const pageKeywords = (pageItem?.keywords && pageItem.keywords.length > 0)
      ? pageItem.keywords.join(", ")
      : (seoConfig.keywords || []).join(", ");

    const ogTitle = pageItem?.ogTitle || seoConfig.openGraph?.title || pageTitle;
    const ogDesc = pageItem?.ogDescription || seoConfig.openGraph?.description || pageDescription;
    const ogImg = pageItem?.ogImage || seoConfig.openGraph?.image || DEFAULT_SEO_CONFIG.openGraph.image;

    const allowIndexing = pageItem?.allowIndexing !== undefined ? pageItem.allowIndexing : seoConfig.robotsConfig.allowIndexing;
    const allowFollow = pageItem?.allowFollow !== undefined ? pageItem.allowFollow : seoConfig.robotsConfig.allowFollow;

    // Is admin route?
    const isAdminRoute = window.location.pathname.startsWith("/admin");
    const robotsStr = (isAdminRoute && seoConfig.robotsConfig.blockAdmin)
      ? "noindex, nofollow"
      : `${allowIndexing ? "index" : "noindex"}, ${allowFollow ? "follow" : "nofollow"}`;

    // 1. Title
    document.title = pageTitle;

    // Helper helper to set or update meta element
    const setMeta = (attrName: string, attrVal: string, contentVal: string) => {
      let el = document.querySelector(`meta[${attrName}="${attrVal}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attrName, attrVal);
        document.head.appendChild(el);
      }
      el.setAttribute("content", contentVal);
    };

    // Helper to set link canonical
    const setCanonical = (hrefVal: string) => {
      let el = document.querySelector(`link[rel="canonical"]`);
      if (!el) {
        el = document.createElement("link");
        el.setAttribute("rel", "canonical");
        document.head.appendChild(el);
      }
      el.setAttribute("href", hrefVal);
    };

    // Helper to inject JSON-LD
    const setJsonLd = (id: string, jsonObj: any) => {
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement("script");
        el.setAttribute("id", id);
        el.setAttribute("type", "application/ld+json");
        document.head.appendChild(el);
      }
      el.textContent = JSON.stringify(jsonObj);
    };

    // Apply Meta Tags
    setMeta("name", "description", pageDescription);
    setMeta("name", "keywords", pageKeywords);
    setMeta("name", "author", seoConfig.author || DEFAULT_SEO_CONFIG.author);
    setMeta("name", "robots", robotsStr);
    setMeta("name", "theme-color", seoConfig.theme || DEFAULT_SEO_CONFIG.theme);

    // Open Graph Tags
    setMeta("property", "og:title", ogTitle);
    setMeta("property", "og:description", ogDesc);
    setMeta("property", "og:image", ogImg);
    setMeta("property", "og:url", pageCanonical);
    setMeta("property", "og:type", seoConfig.openGraph.type || "website");
    setMeta("property", "og:site_name", seoConfig.openGraph.siteName || seoConfig.siteName);
    setMeta("property", "og:locale", seoConfig.openGraph.locale || "pt_BR");

    // Twitter Card Tags
    setMeta("name", "twitter:card", seoConfig.twitter.card || "summary_large_image");
    setMeta("name", "twitter:title", seoConfig.twitter.title || ogTitle);
    setMeta("name", "twitter:description", seoConfig.twitter.description || ogDesc);
    setMeta("name", "twitter:image", seoConfig.twitter.image || ogImg);

    // Canonical link
    setCanonical(pageCanonical);

    // JSON-LD 1: WebSite Schema
    const websiteSchema = {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": seoConfig.structuredData.webSiteName || seoConfig.siteName,
      "url": seoConfig.canonicalUrl,
      "description": seoConfig.defaultDescription,
      "inLanguage": seoConfig.language || "pt-BR",
      "publisher": {
        "@type": "Organization",
        "name": seoConfig.author
      }
    };
    setJsonLd("jsonld-website", websiteSchema);

    // JSON-LD 2: WebApplication / SoftwareApplication Schema
    const appSchema = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": seoConfig.structuredData.appName || seoConfig.siteName,
      "applicationCategory": seoConfig.structuredData.appCategory || "MultimediaApplication",
      "operatingSystem": seoConfig.structuredData.operatingSystem || "Web/Browser",
      "browserRequirements": seoConfig.structuredData.browserRequirements,
      "offers": {
        "@type": "Offer",
        "price": seoConfig.structuredData.price || "0",
        "priceCurrency": seoConfig.structuredData.priceCurrency || "BRL"
      },
      "description": seoConfig.structuredData.description || pageDescription
    };
    setJsonLd("jsonld-app", appSchema);

    // JSON-LD 3: FAQPage Schema
    if (seoConfig.faqList && seoConfig.faqList.length > 0) {
      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": seoConfig.faqList.map(item => ({
          "@type": "Question",
          "name": item.question,
          "acceptedAnswer": {
            "@type": "Answer",
            "text": item.answer
          }
        }))
      };
      setJsonLd("jsonld-faq", faqSchema);
    }

  }, [seoConfig, routeKey, customTitle, customDescription]);

  return seoConfig;
}

export default useSeoHead;
