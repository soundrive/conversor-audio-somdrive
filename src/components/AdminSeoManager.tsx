import React, { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore/lite";
import { SeoConfig, PageSeoItem, FaqItem } from "../types";
import { DEFAULT_SEO_CONFIG } from "../lib/useSeoHead";
import firebaseConfig from "../../firebase-applet-config.json";
import AdminBrandingManager from "./AdminBrandingManager";
import {
  Globe,
  Search,
  Share2,
  Twitter,
  Bot,
  Code,
  FileText,
  HelpCircle,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  Tag,
  Upload,
  Check,
  Smartphone,
  Monitor,
  Copy,
  ExternalLink,
  Image
} from "lucide-react";

function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return getFirestore(app, firebaseConfig.firestoreDatabaseId || "(default)");
}

export default function AdminSeoManager() {
  const [config, setConfig] = useState<SeoConfig>(DEFAULT_SEO_CONFIG);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("main");
  const [newKeyword, setNewKeyword] = useState<string>("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [selectedPage, setSelectedPage] = useState<"home" | "audio" | "pdf" | "howItWorks">("home");

  // Load SEO config from Firestore site_settings/seo
  useEffect(() => {
    loadSeoConfig();
  }, []);

  const loadSeoConfig = async () => {
    setLoading(true);
    try {
      const db = getDb();
      const snap = await getDoc(doc(db, "site_settings", "seo"));
      if (snap.exists()) {
        const data = snap.data() as Partial<SeoConfig>;
        setConfig({
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
      } else {
        // Fallback to legacy settings/seo
        const legacySnap = await getDoc(doc(db, "settings", "seo"));
        if (legacySnap.exists()) {
          const legacyData = legacySnap.data() as Partial<SeoConfig>;
          setConfig(prev => ({ ...prev, ...legacyData }));
        }
      }
    } catch (err) {
      console.error("[SEO MANAGER] Error loading configuration:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const db = getDb();
      const updatedConfig = {
        ...config,
        updatedAt: new Date().toISOString()
      };
      
      // Save to primary collection site_settings/seo
      await setDoc(doc(db, "site_settings", "seo"), updatedConfig, { merge: true });
      // Also save copy to settings/seo for backwards compatibility
      await setDoc(doc(db, "settings", "seo"), updatedConfig, { merge: true }).catch(() => {});

      setConfig(updatedConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error("[SEO MANAGER] Error saving configuration:", err);
      alert("Erro ao salvar configurações de SEO: " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Keyword Helpers
  const addKeyword = () => {
    const trimmed = newKeyword.trim().toLowerCase();
    if (trimmed && !config.keywords.includes(trimmed)) {
      setConfig({ ...config, keywords: [...config.keywords, trimmed] });
      setNewKeyword("");
    }
  };

  const removeKeyword = (kwToRemove: string) => {
    setConfig({ ...config, keywords: config.keywords.filter(k => k !== kwToRemove) });
  };

  const seedDefaultKeywords = () => {
    const seeds = [
      "conversor de audio", "converter mp3", "juntar pdf", "comprimir pdf",
      "imagem para pdf", "somdrive", "converter audio online",
      "ferramentas de pdf gratis", "conversor de mp3 para wav", "organizar paginas de pdf"
    ];
    const unique = Array.from(new Set([...config.keywords, ...seeds]));
    setConfig({ ...config, keywords: unique });
  };

  // FAQ Helpers
  const addFaq = () => {
    const newItem: FaqItem = {
      id: `faq-${Date.now()}`,
      question: "Nova Pergunta Frequente",
      answer: "Resposta detalhada com informações úteis para os usuários e palavras-chave de SEO."
    };
    setConfig({ ...config, faqList: [...config.faqList, newItem] });
  };

  const updateFaq = (id: string, field: "question" | "answer", value: string) => {
    setConfig({
      ...config,
      faqList: config.faqList.map(item => item.id === id ? { ...item, [field]: value } : item)
    });
  };

  const removeFaq = (id: string) => {
    setConfig({ ...config, faqList: config.faqList.filter(item => item.id !== id) });
  };

  // Page SEO helper
  const updatePageSeo = (pageKey: "home" | "audio" | "pdf" | "howItWorks", field: keyof PageSeoItem, val: any) => {
    setConfig({
      ...config,
      pages: {
        ...config.pages,
        [pageKey]: {
          ...config.pages[pageKey],
          [field]: val
        }
      }
    });
  };

  // Length calculation indicators
  const activePageObj = config.pages[selectedPage] || config.pages.home;
  const currentTitle = activePageObj?.title || config.defaultTitle;
  const currentDesc = activePageObj?.description || config.defaultDescription;

  const titleLength = currentTitle.length;
  const descLength = currentDesc.length;

  const getLengthColor = (len: number, min: number, max: number) => {
    if (len >= min && len <= max) return "text-emerald-400 bg-emerald-950/40 border-emerald-800/30";
    if (len > 0 && len < min) return "text-amber-400 bg-amber-950/40 border-amber-800/30";
    return "text-red-400 bg-red-950/40 border-red-800/30";
  };

  if (loading) {
    return (
      <div className="bg-bg-sec border border-border-main p-8 rounded-2xl flex items-center justify-center gap-3 text-text-muted font-bold text-xs">
        <RefreshCw className="h-5 w-5 animate-spin text-green-primary" />
        <span>Carregando Painel Completo de SEO & Meta Tags...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      {/* HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-main pb-4">
        <div>
          <h2 className="font-display font-extrabold text-[#F5F7F8] text-lg uppercase tracking-wider flex items-center gap-2">
            <Globe className="h-5 w-5 text-green-primary" />
            <span>Gerenciador Completo de SEO & Meta Tags</span>
          </h2>
          <p className="text-xs text-text-muted font-medium mt-1">
            Configure títulos, meta descriptions, Open Graph, Twitter Cards, robôs, dados estruturados e FAQ para indexação máxima no Google.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-primary hover:bg-green-dark text-white px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 cursor-pointer transition-all disabled:opacity-50"
        >
          {saving ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Salvando no Firestore...</span>
            </>
          ) : saveSuccess ? (
            <>
              <Check className="h-4 w-4" />
              <span>Salvo com Sucesso!</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              <span>Salvar Alterações de SEO</span>
            </>
          )}
        </button>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin border-b border-border-main/60">
        {[
          { id: "branding", label: "0. Identidade Visual", icon: Image },
          { id: "main", label: "1. SEO Principal", icon: Globe },
          { id: "keywords", label: "2. Palavras-Chave", icon: Tag },
          { id: "og", label: "3. Open Graph", icon: Share2 },
          { id: "twitter", label: "4. Twitter Cards", icon: Twitter },
          { id: "robots", label: "5. Robôs & Indexação", icon: Bot },
          { id: "schema", label: "6. JSON-LD / Schemas", icon: Code },
          { id: "pages", label: "7. SEO por Página", icon: FileText },
          { id: "faq", label: "8. FAQ & Schema FAQ", icon: HelpCircle },
          { id: "preview", label: "9. Prévia Google", icon: Eye },
          { id: "status", label: "10. Status Técnico", icon: CheckCircle2 }
        ].map(tab => {
          const IconComp = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer border ${
                isActive
                  ? "bg-green-primary/10 text-green-primary border-green-primary/30 shadow-sm"
                  : "bg-bg-sec text-text-sec border-border-main hover:text-text-main hover:border-border-main/80"
              }`}
            >
              <IconComp className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 0: IDENTIDADE VISUAL */}
      {activeTab === "branding" && (
        <AdminBrandingManager />
      )}

      {/* TAB 1: SEO PRINCIPAL */}
      {activeTab === "main" && (
        <div className="bg-bg-sec p-6 rounded-2xl border border-border-main space-y-5">
          <div className="border-b border-border-main pb-3">
            <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wider flex items-center gap-2">
              <Globe className="h-4 w-4 text-green-primary" />
              SEO Principal do Site
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Configurações globais que definem a identidade do conversor nos buscadores.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Nome do Site (siteName):</label>
              <input
                type="text"
                value={config.siteName}
                onChange={(e) => setConfig({ ...config, siteName: e.target.value })}
                placeholder="Ex: Conversor SomDrive"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Título Padrão (defaultTitle):</label>
              <input
                type="text"
                value={config.defaultTitle}
                onChange={(e) => setConfig({ ...config, defaultTitle: e.target.value })}
                placeholder="Ex: Conversor SomDrive - Ferramentas de Áudio e PDF Online"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">
                Descrição Padrão (defaultDescription) - Ideal: 120 a 160 caracteres:
              </label>
              <textarea
                rows={3}
                value={config.defaultDescription}
                onChange={(e) => setConfig({ ...config, defaultDescription: e.target.value })}
                placeholder="Descrição persuasiva contendo palavras-chave principais..."
                className="w-full bg-card-main border border-border-main rounded-xl p-4 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
              <div className="flex items-center justify-between text-[10px] text-text-muted">
                <span>Total de caracteres: {config.defaultDescription.length}</span>
                <span className={config.defaultDescription.length >= 120 && config.defaultDescription.length <= 160 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                  {config.defaultDescription.length >= 120 && config.defaultDescription.length <= 160 ? "✓ Tamanho ideal para o Google" : " Recomendado entre 120 e 160 caracteres"}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">URL Canônica Principal (canonicalUrl):</label>
              <input
                type="text"
                value={config.canonicalUrl}
                onChange={(e) => setConfig({ ...config, canonicalUrl: e.target.value })}
                placeholder="https://conversor.somdrive.com.br"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Idioma Principal (language):</label>
              <input
                type="text"
                value={config.language}
                onChange={(e) => setConfig({ ...config, language: e.target.value })}
                placeholder="pt-BR"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Autor / Organização (author):</label>
              <input
                type="text"
                value={config.author}
                onChange={(e) => setConfig({ ...config, author: e.target.value })}
                placeholder="SomDrive"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Tema de Cor do Navegador (theme-color):</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.theme || "#10b981"}
                  onChange={(e) => setConfig({ ...config, theme: e.target.value })}
                  className="w-10 h-10 rounded-xl border border-border-main bg-card-main cursor-pointer"
                />
                <input
                  type="text"
                  value={config.theme}
                  onChange={(e) => setConfig({ ...config, theme: e.target.value })}
                  placeholder="#10b981"
                  className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-mono text-xs focus:outline-none focus:border-green-primary"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PALAVRAS-CHAVE */}
      {activeTab === "keywords" && (
        <div className="bg-bg-sec p-6 rounded-2xl border border-border-main space-y-5">
          <div className="border-b border-border-main pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wider flex items-center gap-2">
                <Tag className="h-4 w-4 text-green-primary" />
                Palavras-Chave Estratégicas
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">Gerencie os termos de pesquisa monitorados e injetados nas meta tags do site.</p>
            </div>
            <button
              onClick={seedDefaultKeywords}
              className="px-3 py-1.5 bg-card-main hover:bg-card-inner border border-border-main rounded-xl text-text-sec hover:text-text-main text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5 text-green-primary" />
              <span>Restaurar Lista Semente</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addKeyword())}
              placeholder="Digite uma nova palavra-chave e pressione Enter..."
              className="flex-1 bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-green-primary"
            />
            <button
              onClick={addKeyword}
              className="px-4 py-2.5 bg-green-primary hover:bg-green-dark text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {config.keywords.map((kw, idx) => (
              <span
                key={idx}
                className="bg-card-main border border-border-main text-text-main text-xs px-3 py-1.5 rounded-xl font-medium flex items-center gap-2 group hover:border-green-primary/40 transition-all"
              >
                <span>{kw}</span>
                <button
                  onClick={() => removeKeyword(kw)}
                  className="text-text-muted hover:text-red-400 transition-colors cursor-pointer"
                  title="Remover palavra-chave"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: OPEN GRAPH */}
      {activeTab === "og" && (
        <div className="bg-bg-sec p-6 rounded-2xl border border-border-main space-y-5">
          <div className="border-b border-border-main pb-3">
            <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wider flex items-center gap-2">
              <Share2 className="h-4 w-4 text-green-primary" />
              Open Graph (Redes Sociais, WhatsApp & LinkedIn)
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Controla a aparência ao compartilhar o link do Conversor em redes sociais.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Título Open Graph (ogTitle):</label>
              <input
                type="text"
                value={config.openGraph.title}
                onChange={(e) => setConfig({ ...config, openGraph: { ...config.openGraph, title: e.target.value } })}
                placeholder="Conversor SomDrive - Ferramentas de Áudio e PDF Grátis"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">URL do Site (ogUrl):</label>
              <input
                type="text"
                value={config.openGraph.url}
                onChange={(e) => setConfig({ ...config, openGraph: { ...config.openGraph, url: e.target.value } })}
                placeholder="https://conversor.somdrive.com.br"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Descrição Open Graph (ogDescription):</label>
              <textarea
                rows={2}
                value={config.openGraph.description}
                onChange={(e) => setConfig({ ...config, openGraph: { ...config.openGraph, description: e.target.value } })}
                placeholder="Descrição de compartilhamento..."
                className="w-full bg-card-main border border-border-main rounded-xl p-3 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Imagem de Compartilhamento OG (ogImage URL):</label>
              <input
                type="text"
                value={config.openGraph.image}
                onChange={(e) => setConfig({ ...config, openGraph: { ...config.openGraph, image: e.target.value } })}
                placeholder="https://conversor.somdrive.com.br/logo.svg"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Tipo de Conteúdo (ogType):</label>
              <input
                type="text"
                value={config.openGraph.type}
                onChange={(e) => setConfig({ ...config, openGraph: { ...config.openGraph, type: e.target.value } })}
                placeholder="website"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Localização (ogLocale):</label>
              <input
                type="text"
                value={config.openGraph.locale}
                onChange={(e) => setConfig({ ...config, openGraph: { ...config.openGraph, locale: e.target.value } })}
                placeholder="pt_BR"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TWITTER CARDS */}
      {activeTab === "twitter" && (
        <div className="bg-bg-sec p-6 rounded-2xl border border-border-main space-y-5">
          <div className="border-b border-border-main pb-3">
            <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wider flex items-center gap-2">
              <Twitter className="h-4 w-4 text-green-primary" />
              Twitter / X Cards
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Define como os links do seu site são exibidos na rede X/Twitter.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Tipo de Card (twitter:card):</label>
              <select
                value={config.twitter.card}
                onChange={(e) => setConfig({ ...config, twitter: { ...config.twitter, card: e.target.value } })}
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              >
                <option value="summary_large_image">summary_large_image (Banner Grande)</option>
                <option value="summary">summary (Quadrado com Miniatura)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Título no Twitter (twitter:title):</label>
              <input
                type="text"
                value={config.twitter.title}
                onChange={(e) => setConfig({ ...config, twitter: { ...config.twitter, title: e.target.value } })}
                placeholder="Conversor SomDrive"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Descrição no Twitter (twitter:description):</label>
              <textarea
                rows={2}
                value={config.twitter.description}
                onChange={(e) => setConfig({ ...config, twitter: { ...config.twitter, description: e.target.value } })}
                placeholder="Descrição do Twitter..."
                className="w-full bg-card-main border border-border-main rounded-xl p-3 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Imagem no Twitter (twitter:image):</label>
              <input
                type="text"
                value={config.twitter.image}
                onChange={(e) => setConfig({ ...config, twitter: { ...config.twitter, image: e.target.value } })}
                placeholder="https://conversor.somdrive.com.br/logo.svg"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: ROBOTS & INDEXING */}
      {activeTab === "robots" && (
        <div className="bg-bg-sec p-6 rounded-2xl border border-border-main space-y-5">
          <div className="border-b border-border-main pb-3">
            <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wider flex items-center gap-2">
              <Bot className="h-4 w-4 text-green-primary" />
              Indexação, Sitemap & Robôs
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Controle o acesso do Googlebot e rastreadores às páginas públicas e administrativas.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="bg-card-main p-4 rounded-xl border border-border-main flex items-center justify-between">
              <div>
                <span className="font-bold text-text-main block">Permitir Indexação Pública</span>
                <span className="text-[10px] text-text-muted">Injeta meta tag index / noindex</span>
              </div>
              <input
                type="checkbox"
                checked={config.robotsConfig.allowIndexing}
                onChange={(e) => setConfig({
                  ...config,
                  robotsConfig: { ...config.robotsConfig, allowIndexing: e.target.checked }
                })}
                className="w-5 h-5 accent-green-primary cursor-pointer"
              />
            </div>

            <div className="bg-card-main p-4 rounded-xl border border-border-main flex items-center justify-between">
              <div>
                <span className="font-bold text-text-main block">Permitir Seguir Links</span>
                <span className="text-[10px] text-text-muted">Injeta meta tag follow / nofollow</span>
              </div>
              <input
                type="checkbox"
                checked={config.robotsConfig.allowFollow}
                onChange={(e) => setConfig({
                  ...config,
                  robotsConfig: { ...config.robotsConfig, allowFollow: e.target.checked }
                })}
                className="w-5 h-5 accent-green-primary cursor-pointer"
              />
            </div>

            <div className="bg-card-main p-4 rounded-xl border border-border-main flex items-center justify-between">
              <div>
                <span className="font-bold text-text-main block">Bloquear Painel Admin (/admin)</span>
                <span className="text-[10px] text-text-muted">Injeta noindex, nofollow no painel</span>
              </div>
              <input
                type="checkbox"
                checked={config.robotsConfig.blockAdmin}
                onChange={(e) => setConfig({
                  ...config,
                  robotsConfig: { ...config.robotsConfig, blockAdmin: e.target.checked }
                })}
                className="w-5 h-5 accent-green-primary cursor-pointer"
              />
            </div>

            <div className="bg-card-main p-4 rounded-xl border border-border-main flex items-center justify-between">
              <div>
                <span className="font-bold text-text-main block">Bloquear Rotas de API (/api/*)</span>
                <span className="text-[10px] text-text-muted">Recomenda aos robôs não indexar endpoints</span>
              </div>
              <input
                type="checkbox"
                checked={config.robotsConfig.blockApi}
                onChange={(e) => setConfig({
                  ...config,
                  robotsConfig: { ...config.robotsConfig, blockApi: e.target.checked }
                })}
                className="w-5 h-5 accent-green-primary cursor-pointer"
              />
            </div>

            <div className="md:col-span-2 space-y-1.5 pt-2">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">URL Oficial do Sitemap XML:</label>
              <input
                type="text"
                value={config.robotsConfig.sitemapUrl}
                onChange={(e) => setConfig({
                  ...config,
                  robotsConfig: { ...config.robotsConfig, sitemapUrl: e.target.value }
                })}
                placeholder="https://conversor.somdrive.com.br/sitemap.xml"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: DADOS ESTRUTURADOS (JSON-LD) */}
      {activeTab === "schema" && (
        <div className="bg-bg-sec p-6 rounded-2xl border border-border-main space-y-5">
          <div className="border-b border-border-main pb-3">
            <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wider flex items-center gap-2">
              <Code className="h-4 w-4 text-green-primary" />
              Dados Estruturados Schema.org (JSON-LD)
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Injeta marcações ricas schema.org para exibição de carrosséis e Rich Snippets no Google.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Nome da Aplicação (appName):</label>
              <input
                type="text"
                value={config.structuredData.appName}
                onChange={(e) => setConfig({
                  ...config,
                  structuredData: { ...config.structuredData, appName: e.target.value }
                })}
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Categoria (applicationCategory):</label>
              <input
                type="text"
                value={config.structuredData.appCategory}
                onChange={(e) => setConfig({
                  ...config,
                  structuredData: { ...config.structuredData, appCategory: e.target.value }
                })}
                placeholder="MultimediaApplication"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Sistema Operacional (operatingSystem):</label>
              <input
                type="text"
                value={config.structuredData.operatingSystem}
                onChange={(e) => setConfig({
                  ...config,
                  structuredData: { ...config.structuredData, operatingSystem: e.target.value }
                })}
                placeholder="Web/Browser"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Preço / Gratuidade (price):</label>
              <input
                type="text"
                value={config.structuredData.price}
                onChange={(e) => setConfig({
                  ...config,
                  structuredData: { ...config.structuredData, price: e.target.value }
                })}
                placeholder="0"
                className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: SEO POR PÁGINA */}
      {activeTab === "pages" && (
        <div className="bg-bg-sec p-6 rounded-2xl border border-border-main space-y-5">
          <div className="border-b border-border-main pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-primary" />
                SEO Específico por Rota / Página
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">Customize meta tags individuais para cada seção pública do site.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-border-main pb-3">
            {[
              { id: "home", label: "Home (/)" },
              { id: "audio", label: "Conversor Áudio (/audio)" },
              { id: "pdf", label: "Ferramentas PDF (/pdf)" },
              { id: "howItWorks", label: "Como Funciona (/como-funciona)" }
            ].map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedPage(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedPage === p.id
                    ? "bg-green-primary text-white"
                    : "bg-card-main text-text-sec hover:text-text-main border border-border-main"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {(() => {
            const pageData = config.pages[selectedPage] || { title: "", description: "", canonicalUrl: "" };
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                <div className="md:col-span-2 space-y-1.5">
                  <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Título da Página:</label>
                  <input
                    type="text"
                    value={pageData.title || ""}
                    onChange={(e) => updatePageSeo(selectedPage, "title", e.target.value)}
                    placeholder="Título da rota..."
                    className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
                  />
                </div>

                <div className="md:col-span-2 space-y-1.5">
                  <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Meta Description:</label>
                  <textarea
                    rows={2}
                    value={pageData.description || ""}
                    onChange={(e) => updatePageSeo(selectedPage, "description", e.target.value)}
                    placeholder="Meta description da página..."
                    className="w-full bg-card-main border border-border-main rounded-xl p-3 text-text-main font-medium focus:outline-none focus:border-green-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">URL Canônica Específica:</label>
                  <input
                    type="text"
                    value={pageData.canonicalUrl || ""}
                    onChange={(e) => updatePageSeo(selectedPage, "canonicalUrl", e.target.value)}
                    placeholder="https://conversor.somdrive.com.br/rota"
                    className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-extrabold text-text-sec uppercase tracking-wider block text-[10px]">Título Open Graph Específico:</label>
                  <input
                    type="text"
                    value={pageData.ogTitle || ""}
                    onChange={(e) => updatePageSeo(selectedPage, "ogTitle", e.target.value)}
                    placeholder="OG Title da página..."
                    className="w-full bg-card-main border border-border-main rounded-xl px-4 py-2.5 text-text-main font-medium focus:outline-none focus:border-green-primary"
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* TAB 8: FAQ & SCHEMA FAQ */}
      {activeTab === "faq" && (
        <div className="bg-bg-sec p-6 rounded-2xl border border-border-main space-y-5">
          <div className="border-b border-border-main pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wider flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-green-primary" />
                Perguntas Frequentes (FAQ & Rich Snippet)
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">Perguntas cadastradas aqui geram automaticamente a marcação JSON-LD FAQPage.</p>
            </div>
            <button
              onClick={addFaq}
              className="px-3.5 py-2 bg-green-primary hover:bg-green-dark text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Nova Pergunta</span>
            </button>
          </div>

          <div className="space-y-4">
            {config.faqList.map((faq, idx) => (
              <div key={faq.id} className="bg-card-main p-4 rounded-xl border border-border-main space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-green-primary">
                    Pergunta #{idx + 1}
                  </span>
                  <button
                    onClick={() => removeFaq(faq.id)}
                    className="text-text-muted hover:text-red-400 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>

                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => updateFaq(faq.id, "question", e.target.value)}
                  placeholder="Digite a pergunta..."
                  className="w-full bg-bg-sec border border-border-main rounded-xl px-4 py-2.5 text-xs text-text-main font-extrabold focus:outline-none focus:border-green-primary"
                />

                <textarea
                  rows={2}
                  value={faq.answer}
                  onChange={(e) => updateFaq(faq.id, "answer", e.target.value)}
                  placeholder="Digite a resposta..."
                  className="w-full bg-bg-sec border border-border-main rounded-xl p-3 text-xs text-text-main font-medium focus:outline-none focus:border-green-primary"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 9: GOOGLE PREVIEW */}
      {activeTab === "preview" && (
        <div className="bg-bg-sec p-6 rounded-2xl border border-border-main space-y-5">
          <div className="border-b border-border-main pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wider flex items-center gap-2">
                <Eye className="h-4 w-4 text-green-primary" />
                Simulador de Prévia do Google (Google Search Snippet)
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">Visualização em tempo real de como o site aparecerá no resultado de busca orgânica.</p>
            </div>

            <div className="flex items-center gap-1 bg-card-main p-1 rounded-xl border border-border-main">
              <button
                onClick={() => setPreviewDevice("desktop")}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  previewDevice === "desktop" ? "bg-green-primary text-white" : "text-text-muted hover:text-text-main"
                }`}
              >
                <Monitor className="h-3.5 w-3.5" />
                <span>Desktop</span>
              </button>
              <button
                onClick={() => setPreviewDevice("mobile")}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  previewDevice === "mobile" ? "bg-green-primary text-white" : "text-text-muted hover:text-text-main"
                }`}
              >
                <Smartphone className="h-3.5 w-3.5" />
                <span>Mobile</span>
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-text-muted">Selecione a página para simular:</span>
              {(["home", "audio", "pdf", "howItWorks"] as const).map(pKey => (
                <button
                  key={pKey}
                  onClick={() => setSelectedPage(pKey)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer border ${
                    selectedPage === pKey
                      ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
                      : "bg-card-main text-text-muted border-border-main"
                  }`}
                >
                  {pKey}
                </button>
              ))}
            </div>

            {/* Simulated Google Card */}
            <div className={`bg-[#202124] p-5 rounded-2xl border border-[#3c4043] text-left space-y-2 font-sans ${previewDevice === "mobile" ? "max-w-[380px] mx-auto" : "w-full"}`}>
              {/* Site Header */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#303134] flex items-center justify-center text-emerald-400 font-extrabold text-[10px]">
                  S
                </div>
                <div className="min-w-0">
                  <span className="text-xs text-[#dadce0] font-medium block truncate">{config.siteName}</span>
                  <span className="text-[10px] text-[#bdc1c6] block truncate">{activePageObj?.canonicalUrl || config.canonicalUrl}</span>
                </div>
              </div>

              {/* Title Link */}
              <h4 className="text-base font-normal text-[#8ab4f8] hover:underline cursor-pointer leading-snug line-clamp-2">
                {currentTitle}
              </h4>

              {/* Snippet Description */}
              <p className="text-xs text-[#bdc1c6] leading-relaxed line-clamp-3">
                {currentDesc}
              </p>
            </div>

            {/* Character Metrics Progress */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-xs">
              <div className="bg-card-main p-4 rounded-xl border border-border-main space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-main">Tamanho do Título</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${getLengthColor(titleLength, 30, 60)}`}>
                    {titleLength} / 60 chars
                  </span>
                </div>
                <div className="w-full h-1.5 bg-bg-sec rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${titleLength >= 30 && titleLength <= 60 ? "bg-emerald-400" : titleLength > 60 ? "bg-red-400" : "bg-amber-400"}`}
                    style={{ width: `${Math.min(100, (titleLength / 60) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="bg-card-main p-4 rounded-xl border border-border-main space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-text-main">Tamanho da Meta Description</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${getLengthColor(descLength, 120, 160)}`}>
                    {descLength} / 160 chars
                  </span>
                </div>
                <div className="w-full h-1.5 bg-bg-sec rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${descLength >= 120 && descLength <= 160 ? "bg-emerald-400" : descLength > 160 ? "bg-red-400" : "bg-amber-400"}`}
                    style={{ width: `${Math.min(100, (descLength / 160) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 10: DIAGNÓSTICO TÉCNICO */}
      {activeTab === "status" && (
        <div className="bg-bg-sec p-6 rounded-2xl border border-border-main space-y-5">
          <div className="border-b border-border-main pb-3">
            <h3 className="text-sm font-extrabold text-text-main uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-primary" />
              Status Técnico & Audit do SEO
            </h3>
            <p className="text-[11px] text-text-muted mt-0.5">Diagnóstico automático das boas práticas de SEO aplicadas no projeto.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {[
              {
                title: "Título Padrão Configurado",
                status: config.defaultTitle.length >= 20,
                info: `${config.defaultTitle.length} caracteres`
              },
              {
                title: "Meta Description Otimizada",
                status: config.defaultDescription.length >= 100,
                info: `${config.defaultDescription.length} caracteres`
              },
              {
                title: "URL Canônica Válida",
                status: config.canonicalUrl.startsWith("https://"),
                info: config.canonicalUrl
              },
              {
                title: "Open Graph Ativo",
                status: !!config.openGraph.title && !!config.openGraph.image,
                info: "og:title & og:image definidos"
              },
              {
                title: "Twitter Cards Configurado",
                status: !!config.twitter.title,
                info: config.twitter.card
              },
              {
                title: "Robots & Indexação",
                status: config.robotsConfig.allowIndexing,
                info: config.robotsConfig.allowIndexing ? "Permitir Indexação" : "Bloqueado"
              },
              {
                title: "JSON-LD Schemas Injetados",
                status: !!config.structuredData.appName,
                info: "WebSite, WebApplication & FAQPage"
              },
              {
                title: "Perguntas Frequentes (FAQ)",
                status: config.faqList.length >= 3,
                info: `${config.faqList.length} perguntas ativas`
              }
            ].map((check, idx) => (
              <div key={idx} className="bg-card-main p-3.5 rounded-xl border border-border-main flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  {check.status ? (
                    <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <span className="font-bold text-text-main block truncate">{check.title}</span>
                    <span className="text-[10px] text-text-muted font-mono block truncate">{check.info}</span>
                  </div>
                </div>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${check.status ? "bg-emerald-950/40 text-emerald-400 border-emerald-800/30" : "bg-amber-950/40 text-amber-400 border-amber-800/30"}`}>
                  {check.status ? "OK" : "Atenção"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
