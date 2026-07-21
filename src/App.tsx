/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Volume2, 
  ShieldCheck, 
  Music, 
  FileText, 
  Info, 
  Lock, 
  Zap, 
  Award,
  ArrowRight,
  Layers,
  Scissors,
  Sparkles,
  Image,
  Smartphone,
  AlertTriangle,
  ExternalLink,
  HelpCircle,
  Settings as SettingsIcon,
  Sun
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import AudioConverter from "./pages/AudioConverter";
import PdfTools from "./pages/PdfTools";
import AdminPanel from "./pages/AdminPanel";
import AdminLogin from "./pages/AdminLogin";
import { Ad, SeoConfig } from "./types";
import { collection, getDocs, query, where, doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { initGA, trackPageView, trackEvent, updateGAConsent } from "./lib/gtag";
import PublicAdCard from "./components/PublicAdCard";
import useSeoHead from "./lib/useSeoHead";


type TabType = "inicio" | "audio" | "pdf";

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>("inicio");
  const [activePdfTool, setActivePdfTool] = useState<string>("none");
  
  // Dynamic Head SEO management from Firestore real-time config
  const currentRouteKey = activeTab === "audio" 
    ? "audio" 
    : activeTab === "pdf" 
      ? (["merge", "compress", "imgToPdf", "organize"].includes(activePdfTool) ? activePdfTool : "pdf") 
      : "home";
      
  useSeoHead(currentRouteKey);

  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [dismissedMobileWarning, setDismissedMobileWarning] = useState<boolean>(false);
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // SEO Config state
  const [seoConfig, setSeoConfig] = useState<SeoConfig>({
    siteName: "Conversor SunDrive",
    title: "Conversor de Áudio e Ferramentas PDF Grátis | Conversor SunDrive",
    description: "Converta arquivos de áudio para MP3, WAV e outros formatos e utilize ferramentas para comprimir, juntar e organizar PDFs. Sem login e sem salvar seus arquivos.",
    canonical: "https://somdrive.com",
    robots: "index, follow",
    ogTitle: "Conversor de Áudio e Ferramentas PDF Grátis | Conversor SunDrive",
    ogDescription: "Converta arquivos de áudio para MP3, WAV e outros formatos e utilize ferramentas para comprimir, juntar e organizar PDFs. Sem login e sem salvar seus arquivos.",
    ogImage: "https://somdrive.com/og-image.jpg",
    twitterCard: "summary_large_image",
    siteLogoUrl: "",
    siteTitle: "Conversor SunDrive",
    siteSubtitle: "Ferramentas para áudio e PDF.",
    pages: {
      home: { title: "Conversor de Áudio e Ferramentas PDF Grátis | Conversor SunDrive", description: "Converta arquivos de áudio para MP3, WAV e outros formatos e utilize ferramentas para comprimir, juntar e organizar PDFs. Sem login e sem salvar seus arquivos." },
      audio: { title: "Conversor de Áudio Grátis para MP3, WAV e Mais | SunDrive", description: "Converta seus arquivos de áudio online 100% no seu navegador de forma gratuita e segura. Suporta MP3, WAV, AAC, FLAC e OGG." },
      pdf: { title: "Comprimir, Juntar e Organizar PDF Grátis | SunDrive", description: "Ferramentas PDF grátis e seguras de nível profissional. Junte, comprima, reordene e exclua páginas de arquivos PDF 100% no seu navegador." },
      merge: { title: "Juntar PDF Grátis Online | SunDrive", description: "Combine múltiplos arquivos PDF em uma única sequência organizada sem perda de qualidade e com segurança total." },
      compress: { title: "Comprimir PDF Grátis sem Perda de Qualidade | SunDrive", description: "Reduza o tamanho do seu PDF online de forma rápida e segura sem comprometer a leitura dos textos." },
      imgToPdf: { title: "Converter Imagens JPG, PNG para PDF Grátis | SunDrive", description: "Transforme fotos e imagens em documentos PDF profissionais com formatação A4 e margens ajustáveis." },
      organize: { title: "Organizar e Reordenar Páginas PDF Grátis | SunDrive", description: "Mude a ordem das páginas do seu PDF de forma visual e simples através de arrastar e soltar." }
    }
  });

  // Ads state
  const [ads, setAds] = useState<Ad[]>([]);
  const [failedAdIds, setFailedAdIds] = useState<string[]>([]);

  // Navigate function for pathname routing
  const navigateTo = (path: string) => {
    window.history.pushState(null, "", path);
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Synchronize dynamic SEO configs
  const loadConfigAndAds = async () => {
    const storedSeo = localStorage.getItem("somdrive_seo");
    if (storedSeo) {
      try {
        setSeoConfig(JSON.parse(storedSeo));
      } catch (e) {
        console.error("Error loading SEO", e);
      }
    }

    try {
      const docRef = doc(db, "ads", "seo_config");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSeoConfig(prev => {
          const merged = { ...prev, ...data } as SeoConfig;
          localStorage.setItem("somdrive_seo", JSON.stringify(merged));
          return merged;
        });
      }
    } catch (err) {
      console.warn("Could not load branding or SEO config from Firestore:", err);
    }
  };

  // Load public active ads from Firestore (now handled in real-time by useEffect)
  const loadPublicAds = async () => {
    console.log("[PUBLIC ADS] real-time listener is active, manual loadPublicAds bypassed to avoid duplication.");
  };

  // Real-time listener for public active ads
  useEffect(() => {
    console.log("[PUBLIC ADS] Setting up real-time listener for Ads...");
    const q = collection(db, "ads");
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const now = new Date();
        const list = snapshot.docs
          .filter(docSnap => docSnap.id !== "seo_config")
          .map(docSnap => {
            const data = docSnap.data();
            const rawActive = data.active !== undefined ? data.active : data.isActive;
            const isCurrentlyActive = rawActive !== undefined 
              ? (typeof rawActive === "string" ? rawActive === "true" : !!rawActive)
              : true;
              
            return {
              id: docSnap.id,
              title: data.internalTitle || data.title || "",
              imageUrl: data.imageUrl || "",
              storagePath: data.storagePath || "",
              destinationUrl: data.destinationUrl || "",
              altText: data.altText || "",
              position: data.position || "sidebar_top",
              active: isCurrentlyActive,
              isActive: isCurrentlyActive, // backwards compatibility
              startDate: data.startDate || null,
              endDate: data.endDate || null,
              internalTitle: data.internalTitle || data.title || "",
              publicTitle: data.publicTitle || "",
              description: data.description || "",
              buttonText: data.buttonText || "Saiba mais",
              format: data.format || "medium_rectangle",
              order: data.order !== undefined ? Number(data.order) : 0,
              customWidth: data.customWidth !== undefined ? Number(data.customWidth) : undefined,
              customHeight: data.customHeight !== undefined ? Number(data.customHeight) : undefined,
              createdAt: data.createdAt || "",
              updatedAt: data.updatedAt || "",
              createdBy: data.createdBy || ""
            };
          })
          .filter(ad => {
            // 1. Filter by active state
            if (!ad.active) return false;

            // 2. Filter by date ranges
            const nowTime = now.getTime();
            if (ad.startDate) {
              let start: Date;
              if (typeof ad.startDate === "object" && (ad.startDate as any).toDate) {
                start = (ad.startDate as any).toDate();
              } else {
                start = new Date(ad.startDate);
              }
              if (!isNaN(start.getTime()) && nowTime < start.getTime()) {
                return false;
              }
            }
            if (ad.endDate) {
              let end: Date;
              if (typeof ad.endDate === "object" && (ad.endDate as any).toDate) {
                end = (ad.endDate as any).toDate();
              } else {
                end = new Date(ad.endDate);
              }
              if (!isNaN(end.getTime()) && nowTime > end.getTime()) {
                return false;
              }
            }
            return true;
          })
          .sort((a, b) => a.order - b.order) as Ad[];
          
        setAds(list);
      } catch (err) {
        console.error("Error processing public ads snapshot:", err);
      }
    }, (err) => {
      console.error("Error in public ads listener:", err);
    });

    return () => unsubscribe();
  }, []);

  // GA4 states & refs
  const [showConsentBanner, setShowConsentBanner] = useState<boolean>(false);
  const lastTrackedRef = useRef<string>("");
  const lastTrackedTopAdId = useRef<string>("");
  const lastTrackedBottomAdId = useRef<string>("");
  const lastTrackedTopBannerAdId = useRef<string>("");

  useEffect(() => {
    // Initialize Google Analytics 4
    initGA();

    // Check if consent has already been given or if a banner is needed
    if ((import.meta as any).env.VITE_GA_MEASUREMENT_ID) {
      const savedDecision = localStorage.getItem("somdrive_ga_consent");
      if (!savedDecision) {
        setShowConsentBanner(true);
      }
    }

    setIsMobile(/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));
    loadConfigAndAds();
    loadPublicAds();

    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);

    const handleStorageChange = () => loadConfigAndAds();
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // GA4 SPA Page View tracking hook
  useEffect(() => {
    let title = seoConfig.title;
    let path = "/";

    if (currentPath === "/admin-login") {
      title = "Login Administrativo | SomDrive";
      path = "/admin-login";
    } else if (currentPath === "/admin") {
      title = "Painel Administrativo | SomDrive";
      path = "/admin";
    } else {
      if (activeTab === "inicio") {
        title = seoConfig.pages.home.title;
        path = "/";
      } else if (activeTab === "audio") {
        title = seoConfig.pages.audio.title;
        path = "/audio";
      } else if (activeTab === "pdf") {
        if (activePdfTool === "none") {
          title = seoConfig.pages.pdf.title;
          path = "/pdf";
        } else if (activePdfTool === "merge") {
          title = seoConfig.pages.merge.title;
          path = "/pdf/juntar";
        } else if (activePdfTool === "compress") {
          title = seoConfig.pages.compress.title;
          path = "/pdf/comprimir";
        } else if (activePdfTool === "imgToPdf") {
          title = seoConfig.pages.imgToPdf.title;
          path = "/pdf/imagens-para-pdf";
        } else if (activePdfTool === "organize") {
          title = seoConfig.pages.organize.title;
          path = "/pdf/organizar";
        } else if (activePdfTool === "deleteRotate") {
          title = "Excluir e Girar Páginas de PDF | SomDrive";
          path = "/pdf/excluir-girar";
        }
      }
    }

    // Deduplicate and track page view
    const trackKey = `${path}:${title}`;
    if (lastTrackedRef.current !== trackKey) {
      lastTrackedRef.current = trackKey;
      trackPageView(title, path);
    }
  }, [currentPath, activeTab, activePdfTool, seoConfig]);

  // GA4 Ad Impression tracking hooks
  useEffect(() => {
    const topAd = getActiveAdByPosition("sidebar_top");
    if (topAd && lastTrackedTopAdId.current !== topAd.id) {
      lastTrackedTopAdId.current = topAd.id;
      trackEvent("ad_view", { ad_id: topAd.id, ad_position: "sidebar_top" });
    }
  }, [ads, failedAdIds]);

  useEffect(() => {
    const bottomAd = getActiveAdByPosition("sidebar_bottom");
    if (bottomAd && lastTrackedBottomAdId.current !== bottomAd.id) {
      lastTrackedBottomAdId.current = bottomAd.id;
      trackEvent("ad_view", { ad_id: bottomAd.id, ad_position: "sidebar_bottom" });
    }
  }, [ads, failedAdIds]);

  useEffect(() => {
    const topBannerAd = getActiveAdByPosition("top_banner");
    if (topBannerAd && lastTrackedTopBannerAdId.current !== topBannerAd.id) {
      lastTrackedTopBannerAdId.current = topBannerAd.id;
      trackEvent("ad_view", { ad_id: topBannerAd.id, ad_position: "top_banner" });
    }
  }, [ads, failedAdIds]);

  const handleAcceptConsent = () => {
    updateGAConsent("granted");
    setShowConsentBanner(false);
  };

  const handleDeclineConsent = () => {
    updateGAConsent("denied");
    setShowConsentBanner(false);
  };


  // Update SEO Head tags dynamically based on active tab and tools
  useEffect(() => {
    let currentPageTitle = seoConfig.title;
    let currentPageDesc = seoConfig.description;

    if (activeTab === "inicio") {
      currentPageTitle = seoConfig.pages.home.title;
      currentPageDesc = seoConfig.pages.home.description;
    } else if (activeTab === "audio") {
      currentPageTitle = seoConfig.pages.audio.title;
      currentPageDesc = seoConfig.pages.audio.description;
    } else if (activeTab === "pdf") {
      // Check which pdf tool is active
      if (activePdfTool === "none") {
        currentPageTitle = seoConfig.pages.pdf.title;
        currentPageDesc = seoConfig.pages.pdf.description;
      } else if (activePdfTool === "merge") {
        currentPageTitle = seoConfig.pages.merge.title;
        currentPageDesc = seoConfig.pages.merge.description;
      } else if (activePdfTool === "compress") {
        currentPageTitle = seoConfig.pages.compress.title;
        currentPageDesc = seoConfig.pages.compress.description;
      } else if (activePdfTool === "imgToPdf") {
        currentPageTitle = seoConfig.pages.imgToPdf.title;
        currentPageDesc = seoConfig.pages.imgToPdf.description;
      } else if (activePdfTool === "organize") {
        currentPageTitle = seoConfig.pages.organize.title;
        currentPageDesc = seoConfig.pages.organize.description;
      } else if (activePdfTool === "deleteRotate") {
        currentPageTitle = "Excluir e Girar Páginas de PDF | SomDrive";
        currentPageDesc = "Exclua páginas indesejadas e gire orientações de páginas de seus documentos PDF online de forma gratuita e rápida.";
      }
    }

    // Apply titles and meta tags
    document.title = currentPageTitle;

    // Helper to set or create meta tags
    const setMetaTag = (attribute: string, value: string, content: string) => {
      let element = document.querySelector(`meta[${attribute}="${value}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, value);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    setMetaTag("name", "description", currentPageDesc);
    setMetaTag("property", "og:title", currentPageTitle);
    setMetaTag("property", "og:description", currentPageDesc);
    setMetaTag("property", "og:image", seoConfig.ogImage || "https://somdrive.com/og-image.jpg");
    setMetaTag("property", "og:site_name", seoConfig.siteName || "Conversor SomDrive");
    setMetaTag("property", "og:locale", "pt_BR");
    setMetaTag("property", "og:type", "website");
    setMetaTag("name", "robots", seoConfig.robots || "index, follow");
    setMetaTag("name", "twitter:card", seoConfig.twitterCard || "summary_large_image");

    // Canonical link
    let canonicalElement = document.querySelector('link[rel="canonical"]');
    if (!canonicalElement) {
      canonicalElement = document.createElement("link");
      canonicalElement.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalElement);
    }
    canonicalElement.setAttribute("href", seoConfig.canonical || "https://somdrive.com");
  }, [activeTab, activePdfTool, seoConfig]);

  const getActiveAdsByPosition = (position: string) => {
    return ads.filter(ad => ad.position === position && !failedAdIds.includes(ad.id));
  };

  const getActiveAdByPosition = (position: string) => {
    const activeAds = getActiveAdsByPosition(position);
    return activeAds.length > 0 ? activeAds[0] : null;
  };

  const renderAdsArea = (position: string) => {
    const activeAds = getActiveAdsByPosition(position);
    if (activeAds.length === 0) return null;

    const sidebarPositions = ["sidebar_top", "sidebar_middle", "sidebar_bottom"];
    const isSidebarArea = sidebarPositions.includes(position);

    if (isSidebarArea) {
      return (
        <div className="w-full flex flex-col gap-6 items-center" id={`ads-area-${position}`}>
          {activeAds.map(ad => (
            <PublicAdCard
              key={ad.id}
              ad={ad}
              position={position}
              onImageError={(id) => setFailedAdIds(prev => [...prev, id])}
            />
          ))}
        </div>
      );
    }

    // For horizontal areas (below_how_it_works, below_pdf_tools, page_bottom)
    return (
      <div className="w-full py-6 px-1 flex flex-col items-center justify-center gap-6" id={`ads-area-${position}`}>
        {activeAds.map(ad => (
          <div key={ad.id} className="w-full max-w-[1220px] flex justify-center">
            <PublicAdCard
              ad={ad}
              position={position}
              onImageError={(id) => setFailedAdIds(prev => [...prev, id])}
            />
          </div>
        ))}
      </div>
    );
  };

  const handleNavigate = (tab: TabType) => {
    setActiveTab(tab);
    if (tab !== "pdf") {
      setActivePdfTool("none");
    }
    if (mainContentRef.current) {
      mainContentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleNavigateToPdfTool = (tool: string) => {
    setActivePdfTool(tool);
    setActiveTab("pdf");
    if (mainContentRef.current) {
      mainContentRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleScrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (currentPath === "/admin-login") {
    return <AdminLogin onNavigate={navigateTo} />;
  }

  if (currentPath === "/admin") {
    return <AdminPanel onNavigate={navigateTo} />;
  }

  return (
    <div className="min-h-screen bg-bg-main text-text-main font-sans flex flex-col justify-between selection:bg-green-primary/20 selection:text-green-light">
      
      {/* Mobile Device Alert Overlay */}
      <AnimatePresence>
        {isMobile && !dismissedMobileWarning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-bg-main/80 backdrop-blur-md"
            id="mobile-warning-overlay"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-card-main rounded-[28px] border border-border-main shadow-2xl max-w-lg w-full p-6 md:p-8 space-y-6 relative overflow-hidden text-text-main"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 to-yellow-400" />
              
              <div className="flex items-start gap-4">
                <div className="p-3 bg-card-inner border border-border-main text-amber-500 rounded-2xl shrink-0">
                  <Smartphone className="h-6 w-6" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-display font-extrabold text-[18px] md:text-[20px] text-text-main leading-tight">
                    Aviso: Otimizado para Computador
                  </h2>
                  <p className="text-[14px] md:text-[15px] text-text-sec font-semibold leading-relaxed">
                    Esta ferramenta foi desenvolvida para rodar diretamente no processador do seu dispositivo. Para melhor experiência e estabilidade, utilize em um computador.
                  </p>
                </div>
              </div>

              <div className="bg-card-inner rounded-2xl border border-border-main p-4 space-y-3.5 text-[13px] md:text-[14px] text-amber-500/90 font-medium">
                <p className="font-bold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  Limitações em celulares e tablets:
                </p>
                <ul className="space-y-2 pl-2 text-text-sec">
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span><strong>Arquivos Grandes:</strong> Processamento de múltiplos arquivos pesados na memória RAM do celular pode encerrar a aba.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span><strong>PDFs Complexos:</strong> Junção ou compressão de PDFs grandes exige alto uso de CPU local do aparelho.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-amber-500 mt-0.5">•</span>
                    <span><strong>Dispositivos iOS (iPhone):</strong> Restrições do sistema para downloads de arquivos ZIP e PDFs complexos.</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  onClick={() => setDismissedMobileWarning(true)}
                  className="w-full py-3.5 bg-green-primary hover:bg-green-dark text-white rounded-xl font-extrabold text-[15px] md:text-[16px] transition-all cursor-pointer shadow-md shadow-emerald-950/10 active:scale-[0.99] duration-150"
                >
                  Continuar mesmo assim
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Top Header */}
      <header className="bg-bg-sec border-b border-border-main sticky top-0 z-50 px-4 py-4 md:px-8 shadow-md backdrop-blur-md">
        <div className="max-w-[1220px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div 
            className="flex items-center space-x-3.5 cursor-pointer group"
            onClick={() => { navigateTo("/"); handleNavigate("inicio"); }}
          >
            <div className="w-12 h-12 bg-card-inner rounded-xl border border-border-main overflow-hidden shadow-inner flex items-center justify-center p-1 group-hover:scale-105 transition-transform duration-300">
              <img 
                src="/logo-somdrive.png" 
                alt="Conversor SomDrive" 
                className="max-w-full max-h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-[18px] md:text-[22px] tracking-tight text-text-main flex items-center gap-2 leading-tight" id="header-title">
                {seoConfig.siteTitle || seoConfig.siteName || "Conversor SunDrive"}
              </h1>
              <p className="text-[11px] md:text-[12px] text-text-muted font-semibold mt-0.5" id="header-subtitle">
                {seoConfig.siteSubtitle !== undefined && seoConfig.siteSubtitle !== "" 
                  ? seoConfig.siteSubtitle 
                  : "Ferramentas para áudio e PDF."}
              </p>
            </div>
          </div>
          
          {/* Navigation Links */}
          <nav className="flex items-center space-x-6 text-[13px] md:text-[14px] font-extrabold uppercase tracking-wider text-text-sec" id="header-nav">
            <button 
              onClick={() => handleNavigate("inicio")} 
              className={`hover:text-green-light transition-colors cursor-pointer relative py-1 ${activeTab === "inicio" ? "text-green-light" : ""}`}
            >
              Início
              {activeTab === "inicio" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-green-primary rounded-full" />}
            </button>
            <button 
              onClick={() => handleNavigate("audio")} 
              className={`hover:text-green-light transition-colors cursor-pointer relative py-1 ${activeTab === "audio" ? "text-green-light" : ""}`}
            >
              Converter Áudio
              {activeTab === "audio" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-green-primary rounded-full" />}
            </button>
            <button 
              onClick={() => handleNavigate("pdf")} 
              className={`hover:text-green-light transition-colors cursor-pointer relative py-1 ${activeTab === "pdf" ? "text-green-light" : ""}`}
            >
              Ferramentas PDF
              {activeTab === "pdf" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-green-primary rounded-full" />}
            </button>
            <button 
              onClick={() => handleScrollToSection("como-funciona")}
              className="hover:text-green-light transition-colors cursor-pointer uppercase py-1"
            >
              Como funciona
            </button>
          </nav>
 
          <div className="flex items-center space-x-2">
            {/* Keeping it simple and clean */}
          </div>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <main className="flex-grow max-w-[1380px] w-full mx-auto px-4 py-8 md:py-12 space-y-12" ref={mainContentRef}>
        
        {(() => {
          const sidebarTopAds = getActiveAdsByPosition("sidebar_top");
          const sidebarMiddleAds = getActiveAdsByPosition("sidebar_middle");
          const sidebarBottomAds = getActiveAdsByPosition("sidebar_bottom");
          const hasSidebarAds = sidebarTopAds.length > 0 || sidebarMiddleAds.length > 0 || sidebarBottomAds.length > 0;

          return (
            /* Layout Grid: Left (Main Card) & Right (Ads Sidebar) */
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
              
              {/* Left Column: Conversor & PDF Main Card */}
              <div className={`${hasSidebarAds ? "lg:col-span-3" : "lg:col-span-4"} space-y-6`}>
            
            <AnimatePresence mode="wait">
              {activeTab === "inicio" && (
                <motion.div
                  key="inicio-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-8"
                >
                  {/* Top Banner Ad Position */}
                  {renderAdsArea("top_banner")}

                  {/* Hero Welcome Banner */}
                  <div className="text-center max-w-2xl mx-auto space-y-4 py-4">
                    <div className="inline-flex items-center space-x-2 bg-[#2B333B] border border-border-main px-4 py-1.5 rounded-full text-xs font-semibold text-[#39D977]">
                      <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                      <span>Ferramentas de Conversão</span>
                    </div>
                    
                    <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-text-main" id="home-title">
                      Conversor de Áudio e Ferramentas PDF
                    </h2>
                    
                    <p className="text-sm text-text-sec leading-relaxed max-w-xl mx-auto font-semibold" id="home-subtitle">
                      Seus arquivos são processados 100% localmente no seu próprio navegador para total privacidade.
                    </p>
                  </div>

                  {/* Two Main Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto" id="categories-grid">
                    
                    {/* Card 1: Audio Converter */}
                    <div
                      className="bg-card-main rounded-[28px] border border-border-main p-6 md:p-8 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-green-primary transition-all duration-300 group cursor-pointer"
                      onClick={() => handleNavigate("audio")}
                      id="card-audio-converter"
                    >
                      <div className="space-y-4">
                        <div className="p-3.5 bg-[#303943] rounded-2xl border border-border-main text-[#39D977] inline-block group-hover:scale-105 transition-all shadow-inner">
                          <Music className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-display text-lg font-bold text-text-main group-hover:text-green-light transition-colors leading-tight">
                            Conversor de Áudio
                          </h3>
                          <p className="text-xs text-text-sec mt-2 leading-relaxed font-semibold">
                            Converta seus arquivos de som para MP3 com economia inteligente de tamanho e total controle da qualidade (64kbps até 320kbps).
                          </p>
                        </div>
                        <ul className="text-[11px] text-text-muted space-y-1.5 pt-2 font-semibold">
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-primary rounded-full" />
                            Conversão em lote ultra-rápida
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-primary rounded-full" />
                            Ajuste de bitrate (64k a 320k)
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-primary rounded-full" />
                            Escute o original e o convertido na hora
                          </li>
                        </ul>
                      </div>

                      <div className="pt-6 flex items-center justify-between text-xs font-bold text-[#39D977] group-hover:translate-x-1 transition-transform border-t border-border-main mt-4">
                        <span>Acessar Conversor</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>

                    {/* Card 2: PDF Tools */}
                    <div
                      className="bg-card-main rounded-[28px] border border-border-main p-6 md:p-8 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-green-primary transition-all duration-300 group cursor-pointer"
                      onClick={() => handleNavigate("pdf")}
                      id="card-pdf-tools"
                    >
                      <div className="space-y-4">
                        <div className="p-3.5 bg-[#303943] rounded-2xl border border-border-main text-[#39D977] inline-block group-hover:scale-105 transition-all shadow-inner">
                          <FileText className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-display text-lg font-bold text-text-main group-hover:text-green-light transition-colors leading-tight">
                            Ferramentas PDF
                          </h3>
                          <p className="text-xs text-text-sec mt-2 leading-relaxed font-semibold">
                            Reordene, junte, comprima, gire ou descarte páginas de documentos PDF em uma interface prática e 100% segura.
                          </p>
                        </div>
                        <ul className="text-[11px] text-text-muted space-y-1.5 pt-2 font-semibold">
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-primary rounded-full" />
                            Mesclagem e junção de múltiplos PDFs
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-primary rounded-full" />
                            Otimização de tamanho (Comprimir)
                          </li>
                          <li className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-primary rounded-full" />
                            Girar, deletar e reorganizar páginas visualmente
                          </li>
                        </ul>
                      </div>

                      <div className="pt-6 flex items-center justify-between text-xs font-bold text-[#39D977] group-hover:translate-x-1 transition-transform border-t border-border-main mt-4">
                        <span>Acessar Ferramentas PDF</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>

                  </div>

                  {/* Space for any other visual elements */}
                </motion.div>
              )}

              {activeTab === "audio" && (
                <motion.div
                  key="audio-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-card-main rounded-[24px] border border-border-main shadow-lg p-6 md:p-10 text-text-main"
                >
                  <AudioConverter />
                </motion.div>
              )}

              {activeTab === "pdf" && (
                <motion.div
                  key="pdf-view"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="bg-card-main rounded-[24px] border border-border-main shadow-lg p-6 md:p-10 text-text-main"
                >
                  <PdfTools activeTool={activePdfTool as any} setActiveTool={setActivePdfTool as any} />
                </motion.div>
              )}
            </AnimatePresence>

              </div>

              {/* Right Column: Ads Banners (Desktop Sidebar, below on Mobile) */}
              {hasSidebarAds && (
                <div className="lg:col-span-1 space-y-6 flex flex-col items-center justify-start h-full w-full max-w-[300px] lg:max-w-none mx-auto">
                  {sidebarTopAds.map(ad => (
                    <PublicAdCard
                      key={ad.id}
                      ad={ad}
                      position="sidebar_top"
                      onImageError={(id) => setFailedAdIds(prev => [...prev, id])}
                    />
                  ))}
                  {sidebarMiddleAds.map(ad => (
                    <PublicAdCard
                      key={ad.id}
                      ad={ad}
                      position="sidebar_middle"
                      onImageError={(id) => setFailedAdIds(prev => [...prev, id])}
                    />
                  ))}
                  {sidebarBottomAds.map(ad => (
                    <PublicAdCard
                      key={ad.id}
                      ad={ad}
                      position="sidebar_bottom"
                      onImageError={(id) => setFailedAdIds(prev => [...prev, id])}
                    />
                  ))}
                </div>
              )}

            </div>
          );
        })()}

        {/* Faixa com Ferramentas PDF */}
        <section className="bg-card-main border border-border-main rounded-[28px] p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border-main pb-4">
            <div>
              <h3 className="font-display text-lg font-extrabold text-text-main flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-green-primary rounded-full" />
                Soluções PDF Online Gratuitas
              </h3>
              <p className="text-xs text-text-sec font-semibold mt-0.5">Sem limites de arquivos e sem necessidade de cadastro ou instalação.</p>
            </div>
            <button 
              onClick={() => handleNavigate("pdf")}
              className="text-xs text-[#39D977] hover:text-[#24C96B] font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
            >
              Ver Todas as Ferramentas <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            
            {/* Tool 1: Comprimir PDF */}
            <div 
              onClick={() => handleNavigateToPdfTool("compress")}
              className="bg-card-inner border border-border-main hover:border-green-primary hover:bg-lime-950/20 p-4 rounded-2xl flex flex-col justify-between space-y-3 cursor-pointer group transition-all"
            >
              <div className="p-2.5 bg-lime-950/40 rounded-xl border border-lime-800/30 text-lime-400 inline-block w-fit">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-display font-extrabold text-[13px] text-text-main group-hover:text-green-light transition-colors">Comprimir PDF</h4>
                <p className="text-[10px] text-text-sec font-medium mt-1 leading-snug">Reduza o tamanho do arquivo sem perder qualidade.</p>
              </div>
            </div>

            {/* Tool 2: Juntar PDF */}
            <div 
              onClick={() => handleNavigateToPdfTool("merge")}
              className="bg-card-inner border border-border-main hover:border-green-primary hover:bg-orange-950/20 p-4 rounded-2xl flex flex-col justify-between space-y-3 cursor-pointer group transition-all"
            >
              <div className="p-2.5 bg-orange-950/40 rounded-xl border border-orange-800/30 text-orange-400 inline-block w-fit">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-display font-extrabold text-[13px] text-text-main group-hover:text-green-light transition-colors">Juntar PDF</h4>
                <p className="text-[10px] text-text-sec font-medium mt-1 leading-snug">Combine múltiplos PDFs em uma única sequência.</p>
              </div>
            </div>

            {/* Tool 3: Imagens para PDF */}
            <div 
              onClick={() => handleNavigateToPdfTool("imgToPdf")}
              className="bg-card-inner border border-border-main hover:border-green-primary hover:bg-purple-950/20 p-4 rounded-2xl flex flex-col justify-between space-y-3 cursor-pointer group transition-all"
            >
              <div className="p-2.5 bg-purple-950/40 rounded-xl border border-purple-800/30 text-purple-400 inline-block w-fit">
                <Image className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-display font-extrabold text-[13px] text-text-main group-hover:text-green-light transition-colors">Imagens para PDF</h4>
                <p className="text-[10px] text-text-sec font-medium mt-1 leading-snug">Converta JPG, PNG ou WEBP para PDF em segundos.</p>
              </div>
            </div>

            {/* Tool 4: Organizar PDF */}
            <div 
              onClick={() => handleNavigateToPdfTool("organize")}
              className="bg-card-inner border border-border-main hover:border-green-primary hover:bg-sky-950/20 p-4 rounded-2xl flex flex-col justify-between space-y-3 cursor-pointer group transition-all"
            >
              <div className="p-2.5 bg-sky-950/40 rounded-xl border border-sky-800/30 text-sky-400 inline-block w-fit">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-display font-extrabold text-[13px] text-text-main group-hover:text-green-light transition-colors">Organizar PDF</h4>
                <p className="text-[10px] text-text-sec font-medium mt-1 leading-snug">Reordene páginas arrastando e soltando.</p>
              </div>
            </div>

            {/* Tool 5: Excluir Páginas */}
            <div 
              onClick={() => handleNavigateToPdfTool("deleteRotate")}
              className="bg-card-inner border border-border-main hover:border-green-primary hover:bg-red-950/20 p-4 rounded-2xl flex flex-col justify-between space-y-3 cursor-pointer group transition-all"
            >
              <div className="p-2.5 bg-red-950/40 rounded-xl border border-red-800/30 text-red-400 inline-block w-fit">
                <Scissors className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-display font-extrabold text-[13px] text-text-main group-hover:text-green-light transition-colors">Excluir Páginas</h4>
                <p className="text-[10px] text-text-sec font-medium mt-1 leading-snug">Delete páginas desnecessárias do seu arquivo PDF.</p>
              </div>
            </div>

            {/* Tool 6: Girar Páginas */}
            <div 
              onClick={() => handleNavigateToPdfTool("deleteRotate")}
              className="bg-card-inner border border-border-main hover:border-green-primary hover:bg-cyan-950/20 p-4 rounded-2xl flex flex-col justify-between space-y-3 cursor-pointer group transition-all"
            >
              <div className="p-2.5 bg-cyan-950/40 rounded-xl border border-cyan-800/30 text-cyan-400 inline-block w-fit">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rotate-cw h-5 w-5"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="16 3 21 3 21 8"/></svg>
              </div>
              <div>
                <h4 className="font-display font-extrabold text-[13px] text-text-main group-hover:text-green-light transition-colors">Girar Páginas</h4>
                <p className="text-[10px] text-text-sec font-medium mt-1 leading-snug">Rotacione páginas vertical ou horizontalmente.</p>
              </div>
            </div>

          </div>
        </section>

        {renderAdsArea("below_pdf_tools")}

        {/* Como Funciona Section */}
        <section id="como-funciona" className="bg-card-main border border-border-main rounded-[28px] p-8 md:p-10 max-w-4xl mx-auto space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <h3 className="font-display text-xl font-extrabold text-text-main">Como Funciona o Conversor SomDrive</h3>
            <p className="text-xs text-text-sec font-semibold">Simplicidade e eficiência em apenas alguns passos.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
            <div className="bg-card-inner border border-border-main rounded-2xl p-5 space-y-3">
              <div className="w-8 h-8 rounded-lg bg-green-primary/10 border border-green-primary/20 flex items-center justify-center text-green-primary font-extrabold text-sm">1</div>
              <h4 className="font-display font-bold text-sm text-text-main">Adicione os Arquivos</h4>
              <p className="text-xs text-text-sec leading-relaxed font-semibold">
                Arraste seus arquivos de áudio ou PDF para a área de upload ou selecione-os diretamente de sua máquina.
              </p>
            </div>

            <div className="bg-card-inner border border-border-main rounded-2xl p-5 space-y-3">
              <div className="w-8 h-8 rounded-lg bg-green-primary/10 border border-green-primary/20 flex items-center justify-center text-green-primary font-extrabold text-sm">2</div>
              <h4 className="font-display font-bold text-sm text-text-main">Ajuste as Opções</h4>
              <p className="text-xs text-text-sec leading-relaxed font-semibold">
                Escolha a qualidade ou formato de áudio desejado, ou selecione a ferramenta PDF que deseja aplicar.
              </p>
            </div>

            <div className="bg-card-inner border border-border-main rounded-2xl p-5 space-y-3">
              <div className="w-8 h-8 rounded-lg bg-green-primary/10 border border-green-primary/20 flex items-center justify-center text-green-primary font-extrabold text-sm">3</div>
              <h4 className="font-display font-bold text-sm text-text-main">Baixe o Resultado</h4>
              <p className="text-xs text-text-sec leading-relaxed font-semibold">
                Inicie o processamento e faça o download instantâneo dos seus novos arquivos otimizados e prontos para uso.
              </p>
            </div>
          </div>
        </section>

        {renderAdsArea("below_how_it_works")}

        {renderAdsArea("page_bottom")}

      </main>

      {/* Footer */}
      <footer className="bg-bg-sec text-text-sec py-10 px-4 md:px-8 border-t border-border-main">
        <div className="max-w-[1220px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-[13px] text-center md:text-left">
          <p id="footer-text-left" className="text-text-sec font-semibold">
            &copy; {new Date().getFullYear()} Conversor SomDrive. Ferramentas para áudio e PDF.
          </p>
          <div className="flex flex-col items-center md:items-end gap-1" id="footer-links">
            <span className="text-text-sec font-semibold" id="footer-link-tech">
              Tecnologias: Web Audio, Web Workers e pdf-lib
            </span>
            {/* Invisible secret area for Admin login link */}
            <div className="group/admin py-0.5">
              <button
                onClick={() => navigateTo("/admin-login")}
                className="text-[10px] text-text-muted opacity-0 group-hover/admin:opacity-65 focus-visible:opacity-65 focus:outline-none transition-opacity duration-200 cursor-pointer select-none border-none bg-transparent"
                id="admin-secret-link"
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Google Analytics Consent Banner */}
      <AnimatePresence>
        {showConsentBanner && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-[#1E252B] border border-border-main p-5 rounded-2xl shadow-2xl z-[90] space-y-4 text-text-main"
          >
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-[#39D977] flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Privacidade & Cookies
              </h4>
              <p className="text-xs text-text-sec leading-relaxed font-semibold">
                Utilizamos cookies e tecnologias semelhantes para coletar dados agregados de navegação de forma 100% anônima e melhorar a sua experiência. Nenhum dado pessoal é coletado ou armazenado.
              </p>
            </div>
            <div className="flex items-center gap-3 justify-end text-xs font-bold">
              <button
                onClick={handleDeclineConsent}
                className="px-3.5 py-2 hover:bg-[#2B333B] border border-border-main rounded-lg text-text-sec transition-colors cursor-pointer"
              >
                Recusar
              </button>
              <button
                onClick={handleAcceptConsent}
                className="px-4 py-2 bg-[#39D977] hover:bg-[#24C96B] text-white rounded-lg transition-colors cursor-pointer shadow-md"
              >
                Aceitar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

