import React, { useState, useEffect } from "react";
import { 
  Lock, 
  ShieldCheck, 
  Plus, 
  Edit2, 
  Trash2, 
  Eye, 
  Settings, 
  Globe, 
  Layout, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Calendar, 
  CheckCircle2, 
  X, 
  LogOut,
  Sparkles,
  AlertCircle,
  Volume2
} from "lucide-react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, onSnapshot } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "../firebase";
import { Ad, SeoConfig, resolveAdImageSrc } from "../types";
import PublicAdCard from "../components/PublicAdCard";
import config from "../../firebase-applet-config.json";

const AdThumbnail = ({ ad, posId }: { ad: any; posId: string }) => {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{
    status?: number;
    errorType?: string;
    message?: string;
    src: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const src = resolveAdImageSrc(ad);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorDetails(null);

    // If it's a data URL or base64, we don't need to fetch it
    if (src.startsWith("data:")) {
      setImgSrc(src);
      setLoading(false);
      return;
    }

    fetch(src)
      .then(async (response) => {
        if (!active) return;
        if (response.ok) {
          setImgSrc(src);
          setLoading(false);
        } else {
          let errMsg = "Falha no carregamento";
          let errType = "HTTP_ERROR";
          try {
            const json = await response.json();
            errMsg = json.message || errMsg;
            errType = json.error || errType;
          } catch (e) {
            try {
              const text = await response.text();
              if (text && text.length < 200) errMsg = text;
            } catch (err) {}
          }
          setErrorDetails({
            status: response.status,
            errorType: errType,
            message: errMsg,
            src: src
          });
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!active) return;
        setErrorDetails({
          errorType: "FETCH_FAILED",
          message: err.message || String(err),
          src: src
        });
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [src]);

  if (loading) {
    return (
      <div className="w-full h-full bg-card-inner flex items-center justify-center">
        <span className="text-[8px] text-text-muted animate-pulse">Carregando…</span>
      </div>
    );
  }

  if (errorDetails) {
    return (
      <div 
        className="w-12 h-12 bg-red-950/40 border border-red-900/50 rounded-lg flex flex-col items-center justify-center p-1 text-[7px] leading-tight text-red-400 overflow-hidden select-none" 
        title={`ID Anúncio: ${ad.id}\nSrc Tentado: ${errorDetails.src}\nStatus do Proxy: ${errorDetails.status || "N/A"}\nCódigo de Erro: ${errorDetails.errorType || "N/A"}\nMensagem: ${errorDetails.message}`}
      >
        <span className="font-bold text-[8px] text-red-500 mb-0.5">ERRO</span>
        <span className="truncate w-full text-center">ID: {ad.id}</span>
        <span className="truncate w-full text-center">Status: {errorDetails.status || "N/A"}</span>
        <span className="truncate w-full text-center font-mono text-[6px]">Code: {errorDetails.errorType || "N/A"}</span>
      </div>
    );
  }

  return (
    <img 
      src={imgSrc || src}
      alt={ad.altText} 
      className="w-full h-full object-cover" 
      referrerPolicy="no-referrer"
      onError={() => {
        setErrorDetails({
          errorType: "IMG_ON_ERROR",
          message: "Triggered onError on img tag",
          src: src
        });
      }}
    />
  );
};

interface AdminPanelProps {
  onNavigate: (path: string) => void;
}

export default function AdminPanel({ onNavigate }: AdminPanelProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // General App states
  const [activeTab, setActiveTab] = useState<"ads" | "seo" | "analytics">("ads");
  const [ads, setAds] = useState<Ad[]>([]);

  // GA4 Analytics States
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState<boolean>(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    if (!currentUser) return;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch("/api/admin/analytics", {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Erro HTTP ${res.status}`);
      }
      const data = await res.json();
      setAnalyticsData(data);
    } catch (err: any) {
      console.error("[GA4 FETCH ERROR]", err);
      setAnalyticsError(err.message || String(err));
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "analytics" && currentUser) {
      fetchAnalytics();
    }
  }, [activeTab, currentUser]);

  const [seo, setSeo] = useState<SeoConfig>({
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

  // Form states for adding/editing Ads
  const [isAdFormOpen, setIsAdFormOpen] = useState<boolean>(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [adTitle, setAdTitle] = useState<string>("");
  const [adPublicTitle, setAdPublicTitle] = useState<string>("");
  const [adDescription, setAdDescription] = useState<string>("");
  const [adButtonText, setAdButtonText] = useState<string>("Saiba mais");
  const [adFormat, setAdFormat] = useState<string>("medium_rectangle");
  const [adOrder, setAdOrder] = useState<number>(0);
  const [adCustomWidth, setAdCustomWidth] = useState<number>(1100);
  const [adCustomHeight, setAdCustomHeight] = useState<number>(250);
  const [adImageUrl, setAdImageUrl] = useState<string>("");
  const [adStoragePath, setAdStoragePath] = useState<string>("");
  const [adDestinationUrl, setAdDestinationUrl] = useState<string>("");
  const [adAltText, setAdAltText] = useState<string>("");
  const [adPosition, setAdPosition] = useState<string>("sidebar_top");
  const [adIsActive, setAdIsActive] = useState<boolean>(true);
  const [adStartDate, setAdStartDate] = useState<string>("");
  const [adEndDate, setAdEndDate] = useState<string>("");
  const [adImageFile, setAdImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [deletingAdId, setDeletingAdId] = useState<string | null>(null);
  const [confirmDeleteAd, setConfirmDeleteAd] = useState<Ad | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'selecting' | 'sending' | 'saving' | 'completed' | 'error'>('idle');

  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!adImageUrl) {
      setNaturalWidth(null);
      setNaturalHeight(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      setNaturalWidth(img.naturalWidth);
      setNaturalHeight(img.naturalHeight);
    };
    img.onerror = () => {
      setNaturalWidth(null);
      setNaturalHeight(null);
    };
    img.src = adImageUrl;
  }, [adImageUrl]);



  const [authStatus, setAuthStatus] = useState<'loading' | 'unauthenticated' | 'forbidden' | 'authorized' | 'error'>('loading');
  const [authError, setAuthError] = useState<any>(null);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  // Brand Logo upload states
  const [logoUploading, setLogoUploading] = useState<boolean>(false);
  const [logoUploadProgress, setLogoUploadProgress] = useState<number>(0);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/image\/(jpeg|png|webp|gif)/)) {
      alert("Apenas imagens JPG, PNG, GIF ou WEBP são permitidas.");
      return;
    }

    setLogoUploading(true);
    setLogoUploadProgress(10);

    try {
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, "_");
      const path = `branding/logo_${Date.now()}_${sanitizedName}`;
      
      const uploadResult = await uploadToR2(file, path, (pct) => {
        setLogoUploadProgress(pct);
      });

      setSeo(prev => ({
        ...prev,
        siteLogoUrl: uploadResult.publicUrl
      }));
      alert("Logotipo enviado com sucesso e atualizado no formulário! Clique em 'Salvar Configuração de SEO' abaixo para persistir as alterações.");
    } catch (err: any) {
      console.error("Erro ao enviar logotipo para R2:", err);
      alert("Erro ao enviar logotipo: " + (err.message || String(err)));
    } finally {
      setLogoUploading(false);
      setLogoUploadProgress(0);
    }
  };

  // Secure API: helper to upload to Cloudflare R2 via Express presigned PUT URL
  const uploadToR2 = async (file: File, destinationPath: string, onProgress?: (pct: number) => void) => {
    if (!currentUser) {
      throw new Error("Usuário não autenticado no cliente.");
    }

    // Get the Firebase ID token for the authenticated user
    const idToken = await currentUser.getIdToken();

    // 1. Ask custom Vercel/Express backend for the presigned upload URL
    if (onProgress) onProgress(15);
    const presignedResponse = await fetch("/api/ads-presigned-upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({
        storagePath: destinationPath,
        contentType: file.type
      })
    });

    if (onProgress) onProgress(40);
    if (!presignedResponse.ok) {
      const errorData = await presignedResponse.json().catch(() => ({}));
      const err: any = new Error(errorData.message || `Falha ao obter URL assinada (${presignedResponse.status})`);
      err.code = errorData.error || "PRESIGNED_URL_ERROR";
      err.serverResponse = JSON.stringify(errorData);
      throw err;
    }

    const { uploadUrl, publicUrl, storagePath } = await presignedResponse.json();
    if (onProgress) onProgress(60);

    // 2. PUT the file directly to Cloudflare R2 with the exact content type
    let uploadResult;
    try {
      uploadResult = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type
        }
      });
    } catch (directErr: any) {
      console.warn("[CLIENT] Direct R2 PUT failed or blocked by CORS. Falling back to server upload proxy...", directErr);
      
      // Fallback: PUT to our server-side upload proxy!
      const proxyUrl = `/api/ads-upload-proxy?token=${encodeURIComponent(idToken)}&storagePath=${encodeURIComponent(storagePath)}&contentType=${encodeURIComponent(file.type)}`;
      uploadResult = await fetch(proxyUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type
        }
      });
    }

    if (onProgress) onProgress(90);
    if (!uploadResult.ok) {
      const errorText = await uploadResult.text().catch(() => "");
      const err: any = new Error(`HTTP PUT falhou com status ${uploadResult.status}: ${errorText}`);
      err.code = "R2_PUT_ERROR";
      err.serverResponse = `HTTP ${uploadResult.status} ${uploadResult.statusText} - ${errorText}`;
      throw err;
    }

    if (onProgress) onProgress(100);
    return { publicUrl, storagePath };
  };

  // Secure API: helper to delete object from Cloudflare R2
  const deleteFromR2 = async (storagePath: string) => {
    if (!currentUser) {
      throw new Error("Usuário não autenticado.");
    }

    // Get the Firebase ID token for the authenticated user (force refresh)
    const idToken = await currentUser.getIdToken(true);

    const deleteResponse = await fetch("/api/ads-delete-object", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({
        storagePath
      })
    });

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json().catch(() => ({}));
      const err = new Error(errorData.message || `Falha ao excluir do R2 (${deleteResponse.status})`);
      (err as any).status = deleteResponse.status;
      throw err;
    }

    return await deleteResponse.json();
  };

  // Authentication & Verification
  useEffect(() => {
    let mounted = true;
    console.log("[ADMIN AUTH] Firebase inicializado");
    console.log("[ADMIN AUTH] Aguardando estado da autenticação");
    setLoading(true);

    const timeoutId = setTimeout(() => {
      if (mounted && authStatus === 'loading') {
        console.warn("[ADMIN AUTH] Timeout de 10 segundos atingido sem resposta de autenticação/Firestore.");
        const timeoutErr = new Error("Não foi possível verificar sua sessão administrativa (Timeout).");
        setAuthError(timeoutErr);
        setAuthStatus('error');
        setLoading(false);
      }
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('[ADMIN AUTH] Estado recebido');
      console.log('[ADMIN AUTH] Usuário:', user ? user.uid : "null");

      if (!user) {
        console.log('[ADMIN AUTH] Acesso negado');
        if (mounted) {
          clearTimeout(timeoutId);
          setAuthStatus('unauthenticated');
          setLoading(false);
        }
        onNavigate("/admin-login");
        return;
      }

      const adminRef = doc(db, 'admins', user.uid);
      console.log('[ADMIN AUTH] Consultando ' + adminRef.path);

      try {
        const adminSnapshot = await getDoc(adminRef);
        console.log('[ADMIN AUTH] Documento existe: ' + adminSnapshot.exists());

        if (!adminSnapshot.exists()) {
          console.log('[ADMIN AUTH] Acesso negado');
          if (mounted) {
            clearTimeout(timeoutId);
            setAuthStatus('forbidden');
            setLoading(false);
          }
          return;
        }

        const adminData = adminSnapshot.data();
        const isActive = adminData?.active === true;
        console.log('[ADMIN AUTH] active: ' + isActive);

        if (!isActive) {
          console.log('[ADMIN AUTH] Acesso negado');
          if (mounted) {
            clearTimeout(timeoutId);
            setAuthStatus('forbidden');
            setLoading(false);
          }
          return;
        }

        console.log('[ADMIN AUTH] Acesso liberado');
        if (mounted) {
          clearTimeout(timeoutId);
          setCurrentUser(user);
          setAuthStatus('authorized');
          setLoading(false);
        }

        // Load dashboard data
        await loadAds();
        await loadSeo();
      } catch (error: any) {
        console.error('[ADMIN AUTH] Erro:', error);
        console.log('[ADMIN AUTH] Erro: ' + (error?.code || 'unknown') + ' - ' + (error?.message || String(error)));
        if (mounted) {
          clearTimeout(timeoutId);
          setAuthError(error);
          setAuthStatus('error');
          setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [onNavigate, retryTrigger]);

  // Load ads from Firestore
  const loadAds = async () => {
    try {
      console.log("[ADMIN ADS] Manual loadAds initiated...");
      const q = query(collection(db, "ads"));
      const snapshot = await getDocs(q);
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
            internalTitle: data.internalTitle || data.title || "",
            publicTitle: data.publicTitle || "",
            description: data.description || "",
            buttonText: data.buttonText || "Saiba mais",
            format: data.format || "medium_rectangle",
            order: data.order !== undefined ? Number(data.order) : 0,
            customWidth: data.customWidth !== undefined ? Number(data.customWidth) : undefined,
            customHeight: data.customHeight !== undefined ? Number(data.customHeight) : undefined,
            imageUrl: data.imageUrl || "",
            storagePath: data.storagePath || "",
            destinationUrl: data.destinationUrl || "",
            altText: data.altText || "",
            position: data.position || "sidebar_top",
            active: isCurrentlyActive,
            isActive: isCurrentlyActive, // backwards compatibility
            startDate: data.startDate || "",
            endDate: data.endDate || "",
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || ""),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || "")
          } as Ad;
        });
      setAds(list);
    } catch (err: any) {
      console.error("Error manually loading ads from Firestore:", err);
      handleFirestoreError(err, OperationType.LIST, "ads");
    }
  };

  // Real-time listener for all ads in Admin Panel
  useEffect(() => {
    if (authStatus !== 'authorized') return;

    console.log("[ADMIN ADS] Setting up real-time onSnapshot listener for Ads...");
    const q = query(collection(db, "ads"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
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
              internalTitle: data.internalTitle || data.title || "",
              publicTitle: data.publicTitle || "",
              description: data.description || "",
              buttonText: data.buttonText || "Saiba mais",
              format: data.format || "medium_rectangle",
              order: data.order !== undefined ? Number(data.order) : 0,
              customWidth: data.customWidth !== undefined ? Number(data.customWidth) : undefined,
              customHeight: data.customHeight !== undefined ? Number(data.customHeight) : undefined,
              imageUrl: data.imageUrl || "",
              storagePath: data.storagePath || "",
              destinationUrl: data.destinationUrl || "",
              altText: data.altText || "",
              position: data.position || "sidebar_top",
              active: isCurrentlyActive,
              isActive: isCurrentlyActive, // backwards compatibility
              startDate: data.startDate || "",
              endDate: data.endDate || "",
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || ""),
              updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : (data.updatedAt || "")
            } as Ad;
          });
        setAds(list);
      } catch (err) {
        console.error("[ADMIN ADS] Error processing snapshot for admin ads:", err);
      }
    }, (err) => {
      console.error("[ADMIN ADS] Error in real-time snapshot listener:", err);
      handleFirestoreError(err, OperationType.LIST, "ads");
    });

    return () => {
      console.log("[ADMIN ADS] Unsubscribing from real-time ads...");
      unsubscribe();
    };
  }, [authStatus]);

  // Load SEO config from local storage or Firestore (local storage fallback for compatibility)
  const loadSeo = async () => {
    const storedSeo = localStorage.getItem("somdrive_seo");
    if (storedSeo) {
      try {
        setSeo(JSON.parse(storedSeo));
      } catch (e) {
        console.error("Error loading local SEO", e);
      }
    }

    try {
      const docRef = doc(db, "ads", "seo_config");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSeo(prev => {
          const merged = { ...prev, ...data } as SeoConfig;
          localStorage.setItem("somdrive_seo", JSON.stringify(merged));
          return merged;
        });
      }
    } catch (err) {
      console.warn("Could not load branding or SEO config from Firestore in AdminPanel:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onNavigate("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Toggle Ad status in Firestore
  const handleToggleAd = async (ad: Ad) => {
    try {
      const adRef = doc(db, "ads", ad.id);
      const newActiveState = !ad.isActive;
      await updateDoc(adRef, {
        active: newActiveState,
        updatedAt: serverTimestamp()
      });
      setAds(prev => prev.map(item => item.id === ad.id ? { ...item, isActive: newActiveState } : item));
    } catch (err: any) {
      alert("Erro ao alterar status: " + err.message);
      handleFirestoreError(err, OperationType.UPDATE, `ads/${ad.id}`);
    }
  };

  // Delete Ad
  const handleDeleteAd = async (ad: Ad, forceConfirmed = false) => {
    // 1. Confirm action
    if (!forceConfirmed) {
      setConfirmDeleteAd(ad);
      return;
    }

    // 2. Validate authentication
    if (!currentUser) {
      alert("Erro ao excluir: Usuário não autenticado.");
      return;
    }

    setDeletingAdId(ad.id);
    let currentStep = "Validação de Autenticação";

    try {
      // 3. Try to delete image from Cloudflare R2 if path exists
      if (ad.storagePath && ad.storagePath !== "base64_fallback") {
        currentStep = "Remoção no Cloudflare R2";
        try {
          console.log(`[ADMIN ADS] Attempting to delete object from R2: ${ad.storagePath}`);
          const r2Res = await deleteFromR2(ad.storagePath);
          if (r2Res && r2Res.deletedFromR2 === false && r2Res.reason === "object_not_found") {
            console.log(`[ADMIN ADS] Objeto não encontrado no R2 (${ad.storagePath}). Continuando com a exclusão no Firestore.`);
          } else {
            console.log(`[ADMIN ADS] Imagem deletada com sucesso do R2: ${ad.storagePath}`);
          }
        } catch (storageErr: any) {
          console.error("R2 image delete failed:", storageErr);
          
          const isObjectNotFound = storageErr.status === 404 || 
                                   (storageErr.message && storageErr.message.toLowerCase().includes("not found")) ||
                                   (storageErr.message && storageErr.message.toLowerCase().includes("não encontrado"));
          
          if (isObjectNotFound) {
            console.log(`[ADMIN ADS] Objeto não encontrado no R2 via catch (${ad.storagePath}). Continuando com a exclusão no Firestore.`);
          } else {
            const statusStr = storageErr.status ? `HTTP ${storageErr.status}` : "N/A";
            const msgStr = storageErr.message || "Erro desconhecido no servidor.";
            console.error(`[ADMIN ADS] Falha ao excluir imagem do Cloudflare R2 (${ad.storagePath}): HTTP ${statusStr} - ${msgStr}. Continuando com a exclusão no Firestore.`);
          }
        }
      }

      // 4. Delete Firestore Document
      currentStep = "Remoção do Documento no Firestore";
      console.log(`[ADMIN ADS] Deleting Firestore document: ${ad.id}`);
      await deleteDoc(doc(db, "ads", ad.id));

      // 5. Confirm that the document no longer exists
      currentStep = "Verificação de Exclusão no Firestore";
      const docRef = doc(db, "ads", ad.id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const err = new Error("O documento ainda existe no Firestore após a tentativa de exclusão.");
        (err as any).status = "N/A";
        throw err;
      }

      // 6. Remove from local list immediately
      setAds(prev => prev.filter(item => item.id !== ad.id));

      // 7. Execute loadAds again to trigger fresh sync
      await loadAds();

      // 8. Inform success
      alert("Anúncio excluído com sucesso.");

    } catch (err: any) {
      console.error(`[ADMIN ADS] Error in step "${currentStep}":`, err);
      const statusStr = err.status ? `HTTP ${err.status}` : "N/A";
      const msgStr = err.message || String(err);
      const errorMsg = `Erro ao excluir anúncio:\n\n` +
        `- Etapa: ${currentStep}\n` +
        `- Código HTTP: ${statusStr}\n` +
        `- Mensagem do Servidor: ${msgStr}\n` +
        `- Storage Path: ${ad.storagePath || "N/A"}\n` +
        `- ID do Documento: ${ad.id}`;
      alert(errorMsg);
      handleFirestoreError(err, OperationType.DELETE, `ads/${ad.id}`);
    } finally {
      setDeletingAdId(null);
    }
  };

  // Handle Image input upload and validation
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("[ADMIN ADS] Arquivo selecionado: " + file.name + " / " + file.size + " / " + file.type);

    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      setImageError("Formato inválido. Carregue um arquivo JPG, PNG ou WEBP.");
      console.warn("[ADMIN ADS] Formato de arquivo inválido: " + file.type);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setImageError("Tamanho do banner excede o limite de 2 MB.");
      console.warn("[ADMIN ADS] Tamanho excedido: " + file.size);
      return;
    }

    setAdImageFile(file);
    setUploadStatus('selecting');

    // Dynamic preview
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setAdImageUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save or Edit Ad in Firestore and Cloudflare R2
  const handleSaveAdForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adTitle || !adDestinationUrl) {
      alert("Por favor, preencha os campos obrigatórios.");
      return;
    }

    if (!adImageUrl && !adImageFile) {
      alert("Por favor, carregue uma imagem para o banner.");
      return;
    }

    setFormSubmitting(true);
    setUploadProgress(0);
    setUploadStatus('sending');

    const adId = editingAd ? editingAd.id : "ad-" + Date.now();

    console.log("[ADMIN ADS] Usuário autenticado: " + (currentUser?.uid || "N/A"));
    console.log("[ADMIN ADS] Status de administrador: " + (currentUser ? "Autenticado" : "Não autenticado"));

    try {
      let finalImageUrl = adImageUrl;
      let finalStoragePath = adStoragePath;
      let oldStoragePath = editingAd ? editingAd.storagePath : "";

      // If new file is selected, upload it to Cloudflare R2
      if (adImageFile) {
        console.log("[ADMIN ADS] Novo arquivo selecionado para R2: " + adImageFile.name + " (" + adImageFile.size + " bytes)");
        setUploadStatus('sending');
        setUploadProgress(10);

        const sanitizedName = adImageFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const path = `ads/${adId}/${Date.now()}-${sanitizedName}`;

        const uploadResult = await uploadToR2(adImageFile, path, (pct) => {
          setUploadProgress(pct);
        });

        finalImageUrl = uploadResult.publicUrl;
        finalStoragePath = uploadResult.storagePath;
        console.log("[ADS UPLOAD] Upload para R2 concluído com sucesso! URL:", finalImageUrl);
      }

      setUploadStatus('saving');
      setUploadProgress(95);
      console.log("[ADMIN ADS] Salvando no Firestore");

      // Prepare firestore document payload
      const payload: any = {
        title: adTitle,
        internalTitle: adTitle,
        publicTitle: adPublicTitle,
        description: adDescription,
        buttonText: adButtonText,
        format: adFormat,
        order: Number(adOrder),
        customWidth: adFormat === "custom" ? Number(adCustomWidth) : null,
        customHeight: adFormat === "custom" ? Number(adCustomHeight) : null,
        imageUrl: finalImageUrl,
        storagePath: finalStoragePath,
        destinationUrl: adDestinationUrl,
        altText: adAltText || adTitle,
        position: adPosition,
        active: adIsActive,
        isActive: adIsActive,
        startDate: adStartDate || null,
        endDate: adEndDate || null,
        updatedAt: serverTimestamp(),
        createdBy: currentUser?.uid || ""
      };

      if (!editingAd) {
        payload.createdAt = serverTimestamp();
      }

      // Write to Firestore
      await setDoc(doc(db, "ads", adId), payload, { merge: true });
      console.log("[ADMIN ADS] Documento salvo: " + adId);

      // If update was successful and image changed, safely delete the old one from R2
      if (editingAd && adImageFile && oldStoragePath && oldStoragePath !== finalStoragePath && oldStoragePath !== "base64_fallback") {
        try {
          await deleteFromR2(oldStoragePath);
          console.log("[ADMIN ADS] Imagem antiga deletada com sucesso do R2: " + oldStoragePath);
        } catch (delErr) {
          console.error("[ADMIN ADS] Falha ao deletar imagem antiga do R2:", delErr);
        }
      }

      setUploadProgress(100);
      setUploadStatus('completed');
      alert(editingAd ? "Anúncio atualizado com sucesso!" : "Novo anúncio cadastrado!");
      
      // Reset
      setIsAdFormOpen(false);
      setEditingAd(null);
      setAdTitle("");
      setAdPublicTitle("");
      setAdDescription("");
      setAdButtonText("Saiba mais");
      setAdFormat("medium_rectangle");
      setAdOrder(0);
      setAdCustomWidth(1100);
      setAdCustomHeight(250);
      setAdImageUrl("");
      setAdStoragePath("");
      setAdDestinationUrl("");
      setAdAltText("");
      setAdPosition("sidebar_top");
      setAdIsActive(true);
      setAdStartDate("");
      setAdEndDate("");
      setAdImageFile(null);
      setUploadStatus('idle');
      setUploadProgress(0);

      // Reload
      loadAds();
    } catch (err: any) {
      setUploadStatus('error');
      console.error("[ADMIN ADS] Erro completo:", err);
      console.error("[ADMIN ADS] Código do erro:", err.code || "unknown");
      console.error("[ADMIN ADS] Mensagem do erro:", err.message || String(err));

      let friendlyError = err.message || String(err);
      if (err.code === "PRESIGNED_URL_ERROR") {
        friendlyError = `Falha ao obter link de upload assinado. Verifique as credenciais R2_ADS_* no servidor. Detalhes: ${err.message}`;
      } else if (err.code === "R2_PUT_ERROR") {
        friendlyError = `Falha na transmissão da imagem para o Cloudflare R2. Verifique se o bucket existe e se as credenciais têm permissão de escrita.`;
      } else if (err.code === "permission-denied" || err.message?.includes("permission-denied") || err.message?.includes("Missing or insufficient permissions")) {
        friendlyError = "Seu usuário não tem permissão de administrador no Firestore.";
      } else if (err.code === "unauthenticated" || err.message?.includes("unauthenticated")) {
        friendlyError = "Faça login novamente.";
      }

      alert("Erro ao salvar anúncio: " + friendlyError);
      
      if (err.code?.startsWith("storage/") || err.code?.startsWith("R2_") || err.code === "PRESIGNED_URL_ERROR") {
        // R2 or Presigned URL error, skip handleFirestoreError
      } else {
        try {
          handleFirestoreError(err, editingAd ? OperationType.UPDATE : OperationType.CREATE, `ads/${adId}`);
        } catch (ignored) {}
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  // Edit action trigger
  const startEditAd = (ad: Ad) => {
    setEditingAd(ad);
    setAdTitle(ad.internalTitle || ad.title || "");
    setAdPublicTitle(ad.publicTitle || "");
    setAdDescription(ad.description || "");
    setAdButtonText(ad.buttonText || "Saiba mais");
    setAdFormat(ad.format || "medium_rectangle");
    setAdOrder(ad.order !== undefined ? Number(ad.order) : 0);
    setAdCustomWidth(ad.customWidth !== undefined ? Number(ad.customWidth) : 1100);
    setAdCustomHeight(ad.customHeight !== undefined ? Number(ad.customHeight) : 250);
    setAdImageUrl(ad.imageUrl);
    setAdStoragePath(ad.storagePath || "");
    setAdDestinationUrl(ad.destinationUrl);
    setAdAltText(ad.altText);
    setAdPosition(ad.position);
    setAdIsActive(ad.isActive);
    setAdStartDate(ad.startDate || "");
    setAdEndDate(ad.endDate || "");
    setIsAdFormOpen(true);
    setAdImageFile(null);
    setImageError(null);
  };

  // Save general SEO config to local storage and Firestore
  const handleSaveSeo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem("somdrive_seo", JSON.stringify(seo));
      
      // Save to Firestore so it is persistent across all clients
      const docRef = doc(db, "ads", "seo_config");
      await setDoc(docRef, seo, { merge: true });
      
      alert("Configurações salvas com sucesso no banco de dados e localmente!");
    } catch (err: any) {
      console.error("Error saving SEO config:", err);
      alert("Configurações salvas localmente, mas falhou ao enviar para o banco de dados: " + err.message);
    }
  };

  // Update specific page SEO helper
  const handlePageSeoChange = (pageKey: keyof SeoConfig["pages"], field: "title" | "description", value: string) => {
    setSeo(prev => ({
      ...prev,
      pages: {
        ...prev.pages,
        [pageKey]: {
          ...prev.pages[pageKey],
          [field]: value
        }
      }
    }));
  };



  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-bg-main text-text-main flex flex-col justify-center items-center">
        <div className="space-y-4 text-center">
          <Settings className="h-10 w-10 text-green-primary animate-spin mx-auto" />
          <p className="text-sm font-semibold text-text-sec">Verificando credenciais...</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-bg-main text-text-main flex flex-col justify-center items-center">
        <div className="space-y-4 text-center">
          <Settings className="h-10 w-10 text-green-primary animate-spin mx-auto" />
          <p className="text-sm font-semibold text-text-sec">Redirecionando para login...</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'forbidden') {
    return (
      <div className="min-h-screen bg-bg-main text-text-main flex flex-col justify-center items-center p-4">
        <div className="bg-card-main border border-border-main rounded-[28px] max-w-md w-full p-8 text-center space-y-6 shadow-2xl">
          <div className="p-3 bg-red-500/10 text-red-500 rounded-2xl w-fit mx-auto border border-red-500/20 animate-pulse">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display font-extrabold text-lg text-text-main">Acesso Negado</h2>
            <p className="text-sm text-text-sec">Este usuário não possui acesso administrativo.</p>
          </div>
          <button
            onClick={async () => {
              await signOut(auth);
              onNavigate("/admin-login");
            }}
            className="w-full py-3 bg-card-inner hover:bg-card-elevated border border-border-main hover:border-text-muted text-text-main rounded-xl font-bold text-xs transition-all uppercase tracking-wider cursor-pointer"
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  if (authStatus === 'error') {
    return (
      <div className="min-h-screen bg-bg-main text-text-main flex flex-col justify-center items-center p-4">
        <div className="bg-card-main border border-border-main rounded-[28px] max-w-md w-full p-8 text-center space-y-6 shadow-2xl">
          <div className="p-3 bg-yellow-500/10 text-yellow-500 rounded-2xl w-fit mx-auto border border-yellow-500/20">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h2 className="font-display font-extrabold text-lg text-text-main">Não foi possível verificar sua sessão</h2>
            <p className="text-sm text-text-sec">Não foi possível verificar sua sessão administrativa.</p>
            {authError && (
              <p className="text-xs font-mono text-red-400 bg-black/30 p-2.5 rounded-lg break-all">
                {authError.code || authError.message || String(authError)}
              </p>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setAuthStatus('loading');
                setLoading(true);
                setAuthError(null);
                setRetryTrigger(prev => prev + 1);
              }}
              className="flex-1 py-3 bg-green-primary hover:bg-green-dark text-white rounded-xl font-extrabold text-xs transition-colors shadow-md uppercase tracking-wider cursor-pointer"
            >
              Tentar novamente
            </button>
            <button
              onClick={async () => {
                await signOut(auth);
                onNavigate("/admin-login");
              }}
              className="flex-1 py-3 bg-card-inner hover:bg-card-elevated border border-border-main text-text-sec hover:text-text-main rounded-xl font-bold text-xs transition-all uppercase tracking-wider cursor-pointer"
            >
              Voltar ao login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-main text-text-main flex flex-col font-sans">
      
      {/* Top Header */}
      <header className="bg-bg-sec border-b border-border-main py-4 px-6 md:px-8 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-card-main rounded-xl border border-border-main text-green-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-base md:text-lg tracking-tight">
              Painel Administrativo
            </h1>
            <p className="text-[10px] md:text-xs text-green-primary font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-primary animate-ping" />
              Sessão Administrador Segura (Firebase)
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 bg-card-inner hover:bg-red-500/10 hover:border-red-500/20 text-xs text-text-sec hover:text-red-400 border border-border-main rounded-xl font-bold transition-all cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sair da Conta</span>
        </button>
      </header>

      {/* Main Container Grid */}
      <div className="flex-grow max-w-7xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 items-start">
        
        {/* Navigation Sidebar */}
        <aside className="bg-bg-sec border border-border-main rounded-2xl p-4 space-y-4">
          <nav className="flex flex-row lg:flex-col gap-1.5 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
            <button
              onClick={() => { setActiveTab("ads"); setIsAdFormOpen(false); }}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap lg:w-full ${
                activeTab === "ads" 
                  ? "bg-card-selected text-green-primary border border-green-primary/15" 
                  : "text-text-sec hover:bg-card-inner hover:text-text-main"
              }`}
            >
              <Layout className="h-4 w-4" />
              <span>Gerenciar Anúncios</span>
            </button>

            <button
              onClick={() => { setActiveTab("seo"); setIsAdFormOpen(false); }}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap lg:w-full ${
                activeTab === "seo" 
                  ? "bg-card-selected text-green-primary border border-green-primary/15" 
                  : "text-text-sec hover:bg-card-inner hover:text-text-main"
              }`}
            >
              <Globe className="h-4 w-4" />
              <span>SEO & Meta Tags</span>
            </button>



            <button
              onClick={() => { setActiveTab("analytics"); setIsAdFormOpen(false); }}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap lg:w-full ${
                activeTab === "analytics" 
                  ? "bg-card-selected text-green-primary border border-green-primary/15" 
                  : "text-text-sec hover:bg-card-inner hover:text-text-main"
              }`}
            >
              <Eye className="h-4 w-4" />
              <span>Relatório de Acessos</span>
            </button>
          </nav>

          <button
            onClick={() => onNavigate("/")}
            className="w-full py-2.5 bg-card-inner hover:bg-card-elevated border border-border-main text-text-sec hover:text-text-main rounded-xl text-xs font-bold transition-all cursor-pointer text-center"
          >
            Voltar ao Site Público
          </button>
        </aside>

        {/* Content Area */}
        <main className="bg-card-main border border-border-main rounded-2xl p-6 md:p-8 shadow-md">
          
          {/* TAB 1: ADS MANAGER */}
          {activeTab === "ads" && (
            <div className="space-y-6">
              {!isAdFormOpen ? (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-main pb-4">
                    <div>
                      <h2 className="font-display font-extrabold text-[#F5F7F8] text-base uppercase tracking-wider">Gerenciar Anúncios</h2>
                      <p className="text-[11px] text-text-muted font-medium mt-1">Crie e configure os dois espaços de anúncios ativos para a barra lateral.</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingAd(null);
                        setAdTitle("");
                        setAdPublicTitle("");
                        setAdDescription("");
                        setAdButtonText("Saiba mais");
                        setAdFormat("medium_rectangle");
                        setAdOrder(0);
                        setAdImageUrl("");
                        setAdStoragePath("");
                        setAdDestinationUrl("");
                        setAdAltText("");
                        setAdPosition("sidebar_top");
                        setAdIsActive(true);
                        setAdStartDate("");
                        setAdEndDate("");
                        setIsAdFormOpen(true);
                        setAdImageFile(null);
                        setImageError(null);
                      }}
                      className="bg-green-primary hover:bg-green-dark text-white px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/15 cursor-pointer transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Novo Anúncio</span>
                    </button>
                  </div>

                  {(() => {
                    const validPositions = ["sidebar_top", "sidebar_middle", "sidebar_bottom", "below_how_it_works", "below_pdf_tools", "page_bottom"];
                    const invalidAds = ads.filter(ad => !validPositions.includes(ad.position));
                    if (invalidAds.length === 0) return null;

                    return (
                      <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-2xl text-left space-y-3">
                        <div className="flex items-center gap-2 font-extrabold text-xs uppercase tracking-wider text-red-400">
                          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                          Há anúncios com posições inválidas no banco de dados!
                        </div>
                        <p className="text-[11px] text-text-sec font-medium leading-relaxed">
                          Os seguintes anúncios estão cadastrados com posições incorretas ou antigas e não serão exibidos publicamente no site. Clique em editar para corrigir a posição deles:
                        </p>
                        <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                          {invalidAds.map(ad => (
                            <div key={ad.id} className="bg-bg-sec/50 border border-border-main/50 p-2.5 rounded-xl flex items-center justify-between gap-3 text-xs">
                              <div className="min-w-0">
                                <span className="font-bold text-text-main block truncate">{ad.title}</span>
                                <span className="text-[10px] text-red-400 font-mono">Posição atual: "{ad.position || 'vazio'}"</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => startEditAd(ad)}
                                className="px-2.5 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-extrabold text-[10px] rounded-lg transition-colors shrink-0 uppercase tracking-wide cursor-pointer"
                              >
                                Editar Posição
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      { id: "sidebar_top", name: "Lateral Superior (sidebar_top)" },
                      { id: "sidebar_middle", name: "Lateral Meio (sidebar_middle)" },
                      { id: "sidebar_bottom", name: "Lateral Inferior (sidebar_bottom)" },
                      { id: "below_how_it_works", name: "Abaixo de 'Como funciona' (below_how_it_works)" },
                      { id: "below_pdf_tools", name: "Abaixo de 'Ferramentas PDF' (below_pdf_tools)" },
                      { id: "page_bottom", name: "Final da Página (page_bottom)" }
                    ].map(pos => {
                      const posAds = ads
                        .filter(ad => ad.position === pos.id)
                        .sort((a, b) => (a.order !== undefined ? Number(a.order) : 0) - (b.order !== undefined ? Number(b.order) : 0));
                      return (
                        <div key={pos.id} className="bg-bg-sec p-5 rounded-2xl border border-border-main space-y-4">
                          <div className="border-b border-border-main pb-3 flex items-center justify-between">
                            <span className="text-xs font-extrabold text-text-main uppercase tracking-wider flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-green-primary" />
                              {pos.name}
                            </span>
                            <span className="bg-card-main text-text-muted text-[10px] px-2.5 py-0.5 rounded-full font-bold">{pos.id}</span>
                          </div>

                          <div className="space-y-3">
                            {posAds.length === 0 ? (
                              <div className="p-6 text-center border border-dashed border-border-main rounded-xl text-xs text-text-muted font-semibold">
                                Nenhum anúncio cadastrado para esta posição.
                              </div>
                            ) : (
                              posAds.map(ad => (
                                <div key={ad.id} className="bg-card-main border border-border-main p-3 rounded-xl flex items-center justify-between gap-3 hover:border-green-primary/30 transition-all">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-12 h-12 bg-card-inner rounded-lg border border-border-main overflow-hidden shrink-0 flex items-center justify-center">
                                      <AdThumbnail ad={ad} posId={pos.id} />
                                    </div>
                                    <div className="min-w-0">
                                      <h5 className="text-xs font-extrabold text-text-main truncate">{ad.title}</h5>
                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${ad.isActive ? "bg-green-primary/10 text-green-primary border border-green-primary/20" : "bg-[#46515D]/20 text-text-muted"}`}>
                                          {ad.isActive ? "Ativo" : "Inativo"}
                                        </span>
                                        <span className="bg-cyan-950/40 text-cyan-400 border border-cyan-800/20 text-[9px] px-1.5 py-0.5 rounded-full font-mono">
                                          Ordem: {ad.order !== undefined ? ad.order : 0}
                                        </span>
                                        <span className="bg-amber-950/40 text-amber-400 border border-amber-800/20 text-[9px] px-1.5 py-0.5 rounded-full font-mono">
                                          Formato: {ad.format || "auto"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleAd(ad)}
                                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${ad.isActive ? "border-green-primary/30 text-green-primary hover:bg-card-selected" : "border-border-main text-text-muted hover:bg-card-inner"}`}
                                      title={ad.isActive ? "Desativar" : "Ativar"}
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => startEditAd(ad)}
                                      className="p-1.5 rounded-lg border border-border-main text-text-sec hover:text-text-main hover:bg-card-inner transition-all cursor-pointer"
                                      title="Editar"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={deletingAdId !== null}
                                      onClick={() => handleDeleteAd(ad)}
                                      className={`p-1.5 rounded-lg border border-border-main transition-all ${deletingAdId === ad.id ? "text-red-400 bg-card-inner animate-pulse flex items-center gap-1.5 px-2.5" : "text-text-muted hover:text-red-400 hover:bg-card-inner cursor-pointer"}`}
                                      title="Remover"
                                    >
                                      {deletingAdId === ad.id ? (
                                        <>
                                          <div className="h-3 w-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin shrink-0" />
                                          <span className="text-[10px] font-extrabold uppercase tracking-wide">Excluindo...</span>
                                        </>
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Ad Form
                <form onSubmit={handleSaveAdForm} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-border-main pb-3">
                    <span className="text-xs font-extrabold text-text-main uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="h-4.5 w-4.5 text-green-primary" />
                      {editingAd ? `Editar Anúncio: ${editingAd.title}` : "Novo Anúncio"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAdFormOpen(false)}
                      className="text-xs text-text-sec hover:text-text-main flex items-center gap-1 cursor-pointer bg-card-inner px-3 py-1.5 border border-border-main rounded-lg transition-colors"
                    >
                      Voltar ao Painel
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-8">
                    
                    {/* Form Fields */}
                    <div className="space-y-4 text-left">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Título Interno (Identificação):</label>
                          <input
                            type="text"
                            required
                            value={adTitle}
                            onChange={(e) => setAdTitle(e.target.value)}
                            placeholder="Ex: Campanha de Julho 2026"
                            className="w-full bg-bg-sec border border-border-main rounded-xl px-4 py-3 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-green-primary font-medium"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Título Público (Opcional):</label>
                          <input
                            type="text"
                            value={adPublicTitle}
                            onChange={(e) => setAdPublicTitle(e.target.value)}
                            placeholder="Ex: Oferta Imperdível!"
                            className="w-full bg-bg-sec border border-border-main rounded-xl px-4 py-3 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-green-primary font-medium"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Descrição Pública (Opcional):</label>
                        <textarea
                          value={adDescription}
                          onChange={(e) => setAdDescription(e.target.value)}
                          placeholder="Ex: Assine nosso plano premium e converta arquivos sem anúncios com velocidade ilimitada."
                          rows={3}
                          className="w-full bg-bg-sec border border-border-main rounded-xl px-4 py-3 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-green-primary font-medium resize-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Texto do Botão:</label>
                          <input
                            type="text"
                            value={adButtonText}
                            onChange={(e) => setAdButtonText(e.target.value)}
                            placeholder="Ex: Saiba mais"
                            className="w-full bg-bg-sec border border-border-main rounded-xl px-4 py-3 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-green-primary font-medium"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Link de Destino:</label>
                          <div className="relative">
                            <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
                            <input
                              type="url"
                              required
                              value={adDestinationUrl}
                              onChange={(e) => setAdDestinationUrl(e.target.value)}
                              placeholder="https://suamarca.com/campanha"
                              className="w-full bg-bg-sec border border-border-main rounded-xl pl-11 pr-4 py-3 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-green-primary font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Posição:</label>
                          <select
                            value={adPosition}
                            onChange={(e) => setAdPosition(e.target.value)}
                            className="w-full bg-bg-sec border border-border-main rounded-xl px-3 py-3 text-xs text-text-main focus:outline-none focus:border-green-primary cursor-pointer font-bold"
                          >
                            <option value="sidebar_top">Lateral Sup</option>
                            <option value="sidebar_middle">Lateral Meio</option>
                            <option value="sidebar_bottom">Lateral Inf</option>
                            <option value="below_how_it_works">Abaixo Como Funciona</option>
                            <option value="below_pdf_tools">Abaixo PDF</option>
                            <option value="page_bottom">Fim da Página</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Formato:</label>
                          <select
                            value={adFormat}
                            onChange={(e) => setAdFormat(e.target.value)}
                            className="w-full bg-bg-sec border border-border-main rounded-xl px-3 py-3 text-xs text-text-main focus:outline-none focus:border-green-primary cursor-pointer font-bold"
                          >
                            <option value="medium_rectangle">Retângulo Médio (300x250)</option>
                            <option value="square">Quadrado (300x300)</option>
                            <option value="horizontal_banner">Banner Horizontal (728x90)</option>
                            <option value="wide_banner">Banner 970×250 (exige arquivo realmente exportado em 970×250)</option>
                            <option value="automatic">Formato Automático (respeita a proporção real do arquivo)</option>
                            <option value="custom">Personalizado (Custom)</option>
                            <option value="horizontal_rectangle">Banner Fino (728x90 - Legado)</option>
                            <option value="horizontal_card">Card Horizontal (Legado)</option>
                          </select>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Ordem:</label>
                          <input
                            type="number"
                            min="0"
                            value={adOrder}
                            onChange={(e) => setAdOrder(Number(e.target.value))}
                            className="w-full bg-bg-sec border border-border-main rounded-xl px-4 py-3 text-xs text-text-main focus:outline-none focus:border-green-primary font-bold"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Status:</label>
                          <select
                            value={adIsActive ? "true" : "false"}
                            onChange={(e) => setAdIsActive(e.target.value === "true")}
                            className="w-full bg-bg-sec border border-border-main rounded-xl px-3 py-3 text-xs text-text-main focus:outline-none focus:border-green-primary cursor-pointer font-bold"
                          >
                            <option value="true">Ativo</option>
                            <option value="false">Inativo</option>
                          </select>
                        </div>
                      </div>

                      {adFormat === "custom" && (
                        <div className="bg-bg-sec/50 border border-border-main p-4 rounded-xl space-y-4 text-left">
                          <span className="text-[10px] font-extrabold text-[#F5F7F8] uppercase tracking-wider block">Dimensões Personalizadas:</span>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Largura (200 - 1400px):</label>
                              <input
                                type="number"
                                min="200"
                                max="1400"
                                required
                                value={adCustomWidth}
                                onChange={(e) => setAdCustomWidth(Number(e.target.value))}
                                className="w-full bg-bg-sec border border-border-main rounded-xl px-4 py-2.5 text-xs text-text-main focus:outline-none focus:border-green-primary font-bold"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Altura (80 - 600px):</label>
                              <input
                                type="number"
                                min="80"
                                max="600"
                                required
                                value={adCustomHeight}
                                onChange={(e) => setAdCustomHeight(Number(e.target.value))}
                                className="w-full bg-bg-sec border border-border-main rounded-xl px-4 py-2.5 text-xs text-text-main focus:outline-none focus:border-green-primary font-bold"
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-text-muted font-medium">Ajuste os valores dentro do intervalo seguro para evitar problemas de quebra de layout responsivo.</p>
                        </div>
                      )}

                      {(() => {
                        const sidebarPositions = ["sidebar_top", "sidebar_middle", "sidebar_bottom"];
                        const isSidebarPos = sidebarPositions.includes(adPosition);
                        const isHorizontalFormat = adFormat === "horizontal_banner" || 
                                                   adFormat === "wide_banner" || 
                                                   adFormat === "horizontal_rectangle" || 
                                                   adFormat === "horizontal_card" || 
                                                   (adFormat === "custom" && adCustomWidth > 320);
                        return isSidebarPos && isHorizontalFormat ? (
                          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-200 p-4 rounded-xl text-left space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide text-amber-400">
                              <AlertCircle className="h-4 w-4 shrink-0" />
                              Aviso de Posicionamento
                            </div>
                            <p className="text-[11px] leading-relaxed text-text-sec font-medium">
                              Este formato pode ficar pequeno na lateral. Use uma posição inferior para melhor visualização.
                            </p>
                          </div>
                        ) : null;
                      })()}

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Texto Alternativo (Acessibilidade):</label>
                        <input
                          type="text"
                          value={adAltText}
                          onChange={(e) => setAdAltText(e.target.value)}
                          placeholder="Descrição de acessibilidade para leitores de tela"
                          className="w-full bg-bg-sec border border-border-main rounded-xl px-4 py-3 text-xs text-text-main placeholder-text-muted focus:outline-none focus:border-green-primary font-medium"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-text-muted" /> Data Início (opcional):
                          </label>
                          <input
                            type="date"
                            value={adStartDate}
                            onChange={(e) => setAdStartDate(e.target.value)}
                            className="w-full bg-bg-sec border border-border-main rounded-xl px-4 py-3 text-xs text-text-main focus:outline-none focus:border-green-primary cursor-pointer font-bold"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-text-muted" /> Data Fim (opcional):
                          </label>
                          <input
                            type="date"
                            value={adEndDate}
                            onChange={(e) => setAdEndDate(e.target.value)}
                            className="w-full bg-bg-sec border border-border-main rounded-xl px-4 py-3 text-xs text-text-main focus:outline-none focus:border-green-primary cursor-pointer font-bold"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Enviar Imagem de Banner:</label>
                        <div className="bg-bg-sec border border-border-main rounded-xl p-4 space-y-2">
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp"
                            onChange={handleImageFileChange}
                            className="text-xs text-text-muted cursor-pointer file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-border-main file:text-xs file:font-bold file:bg-card-main file:text-text-main hover:file:bg-card-inner file:cursor-pointer"
                          />
                          <p className="text-[10px] text-text-muted font-medium">Formatos aceitos: JPG, PNG, WEBP. Tamanho máximo: 2MB.</p>
                          {imageError && (
                            <p className="text-[10px] text-red-400 font-bold flex items-center gap-1">
                              <AlertCircle className="h-3.5 w-3.5" /> {imageError}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Banner Preview Area */}
                    <div className="space-y-4 flex flex-col items-center">
                      <span className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block self-start">
                        Prévia Real do Anúncio (Formato: {adFormat}):
                      </span>

                      <div className="bg-bg-sec p-4 rounded-2xl border border-border-main w-full flex flex-col items-center justify-center shadow-inner min-h-[300px]">
                        <PublicAdCard
                          ad={{
                            id: "preview",
                            title: adTitle || "Título Interno de Identificação",
                            internalTitle: adTitle || "Título Interno",
                            publicTitle: adPublicTitle,
                            description: adDescription,
                            buttonText: adButtonText,
                            format: adFormat,
                            customWidth: adFormat === "custom" ? adCustomWidth : undefined,
                            customHeight: adFormat === "custom" ? adCustomHeight : undefined,
                            destinationUrl: adDestinationUrl || "#",
                            imageUrl: adImageUrl || "",
                            storagePath: adStoragePath,
                            altText: adAltText,
                            position: adPosition,
                            active: adIsActive,
                            isActive: adIsActive,
                            startDate: adStartDate,
                            endDate: adEndDate,
                            order: adOrder,
                            createdAt: "",
                            updatedAt: "",
                            createdBy: ""
                          }}
                          position={adPosition}
                          onImageError={() => {}}
                        />
                      </div>

                      {adFormat === "wide_banner" && naturalWidth !== null && naturalHeight !== null && (naturalWidth !== 970 || naturalHeight !== 250) && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl text-left space-y-1.5 w-full">
                          <div className="flex items-center gap-1.5 font-bold text-xs uppercase tracking-wide text-red-400">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            Aviso de Proporção Incompatível
                          </div>
                          <p className="text-[11px] leading-relaxed text-text-sec font-medium">
                            A imagem enviada mede <span className="font-bold text-text-main">{naturalWidth}×{naturalHeight}</span> e não possui proporção 970×250. Use formato automático ou envie uma imagem realmente criada em 970×250.
                          </p>
                        </div>
                      )}

                      {/* Painel de Diagnóstico do Anúncio */}
                      <div className="bg-[#111827] border border-border-main/50 rounded-xl p-3.5 w-full text-left space-y-2">
                        <span className="text-[10px] font-extrabold text-green-primary uppercase tracking-widest block">Painel de Diagnóstico do Banner</span>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] font-medium text-text-sec">
                          <div><span className="text-text-muted">Posição:</span> <span className="font-bold text-text-main uppercase">{adPosition}</span></div>
                          <div><span className="text-text-muted">Formato:</span> <span className="font-bold text-text-main uppercase">{adFormat}</span></div>
                          <div>
                            <span className="text-text-muted">Largura Real:</span>{" "}
                            <span className="font-bold text-text-main">
                              {adFormat === "custom" ? `${adCustomWidth}px` : adFormat === "medium_rectangle" ? "300px" : adFormat === "square" ? "300px" : adFormat === "horizontal_banner" ? "728px" : adFormat === "wide_banner" ? "970px" : "100% (Auto)"}
                            </span>
                          </div>
                          <div>
                            <span className="text-text-muted">Altura Real:</span>{" "}
                            <span className="font-bold text-text-main">
                              {adFormat === "custom" ? `${adCustomHeight}px` : adFormat === "medium_rectangle" ? "250px" : adFormat === "square" ? "300px" : adFormat === "horizontal_banner" ? "90px" : adFormat === "wide_banner" ? "250px" : "Auto"}
                            </span>
                          </div>
                          {naturalWidth !== null && naturalHeight !== null && (
                            <div className="col-span-2 border-t border-border-main/20 pt-1.5 mt-0.5">
                              <span className="text-text-muted text-[10px] uppercase tracking-wider block mb-1">Dimensões Reais da Imagem (Lida pelo Navegador):</span>
                              <span className={`font-bold text-[12px] ${adFormat === "wide_banner" && (naturalWidth !== 970 || naturalHeight !== 250) ? "text-red-400 animate-pulse" : "text-green-primary"}`}>
                                {naturalWidth}×{naturalHeight} px {adFormat === "wide_banner" && (naturalWidth !== 970 || naturalHeight !== 250) ? "⚠️ (Incompatível com Proporção 970x250)" : "✓ (Proporção Adequada)"}
                              </span>
                            </div>
                          )}
                          <div className="col-span-2">
                            <span className="text-text-muted">Aspecto (H:V):</span>{" "}
                            <span className="font-bold text-text-main">
                              {(() => {
                                let w = 300, h = 250;
                                if (adFormat === "custom") { w = adCustomWidth; h = adCustomHeight; }
                                else if (adFormat === "square") { w = 300; h = 300; }
                                else if (adFormat === "horizontal_banner") { w = 728; h = 90; }
                                else if (adFormat === "wide_banner") { w = 970; h = 250; }
                                const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
                                const divisor = gcd(w, h);
                                return `${w/divisor}:${h/divisor} (${(w/h).toFixed(2)})`;
                              })()}
                            </span>
                          </div>
                          <div className="col-span-2 text-[10px] text-text-muted leading-relaxed font-mono mt-1 border-t border-border-main/30 pt-1.5">
                            💻 Desktop: {["sidebar_top", "sidebar_middle", "sidebar_bottom"].includes(adPosition) ? "Será exibido na barra lateral direita com largura máxima de 300px." : "Será centralizado ocupando até 1220px de largura."}
                            <br />
                            📱 Mobile: Todos os banners se adaptam automaticamente à largura da tela do celular sem distorcer a proporção da imagem.
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={formSubmitting}
                        className="w-full py-3.5 bg-green-primary hover:bg-green-dark disabled:bg-green-primary/50 text-white rounded-xl font-extrabold text-xs transition-colors shadow-md uppercase tracking-wider cursor-pointer"
                      >
                        {formSubmitting ? (
                          uploadStatus === 'sending' ? `Enviando imagem… ${uploadProgress}%` :
                          uploadStatus === 'saving' ? "Salvando no Firestore..." :
                          "Processando..."
                        ) : "Salvar Anúncio"}
                      </button>
                    </div>

                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: SEO META MANAGER */}
          {activeTab === "seo" && (
            <form onSubmit={handleSaveSeo} className="space-y-6">
              <div className="border-b border-border-main pb-3 text-left">
                <h2 className="font-display font-extrabold text-[#F5F7F8] text-base uppercase tracking-wider">SEO & Identidade Visual</h2>
                <p className="text-[11px] text-text-muted font-medium mt-1">Configure as meta tags de indexação e a identidade de marca do aplicativo.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                <div className="space-y-6">
                  {/* Bloco 1: Meta Tags Globais */}
                  <div className="space-y-4 bg-bg-sec p-5 rounded-2xl border border-border-main text-left">
                    <span className="text-[11px] font-extrabold text-[#F5F7F8] uppercase tracking-wider block border-b border-border-main pb-2">Meta Tags Gerais</span>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Nome do Site:</label>
                        <input
                          type="text"
                          required
                          value={seo.siteName}
                          onChange={(e) => setSeo({ ...seo, siteName: e.target.value })}
                          className="w-full bg-card-main border border-border-main rounded-xl px-3 py-2.5 text-xs text-text-main font-semibold focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Diretiva robots:</label>
                        <input
                          type="text"
                          required
                          value={seo.robots}
                          onChange={(e) => setSeo({ ...seo, robots: e.target.value })}
                          className="w-full bg-card-main border border-border-main rounded-xl px-3 py-2.5 text-xs text-text-main font-semibold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">URL Canônica:</label>
                      <input
                        type="url"
                        required
                        value={seo.canonical}
                        onChange={(e) => setSeo({ ...seo, canonical: e.target.value })}
                        className="w-full bg-card-main border border-border-main rounded-xl px-3 py-2.5 text-xs text-text-main font-semibold focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">og:title:</label>
                        <input
                          type="text"
                          required
                          value={seo.ogTitle}
                          onChange={(e) => setSeo({ ...seo, ogTitle: e.target.value })}
                          className="w-full bg-card-main border border-border-main rounded-xl px-3 py-2.5 text-xs text-text-main font-semibold focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Twitter Card:</label>
                        <input
                          type="text"
                          required
                          value={seo.twitterCard}
                          onChange={(e) => setSeo({ ...seo, twitterCard: e.target.value })}
                          className="w-full bg-card-main border border-border-main rounded-xl px-3 py-2.5 text-xs text-text-main font-semibold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">og:image (Link):</label>
                      <input
                        type="url"
                        required
                        value={seo.ogImage}
                        onChange={(e) => setSeo({ ...seo, ogImage: e.target.value })}
                        className="w-full bg-card-main border border-border-main rounded-xl px-3 py-2.5 text-xs text-text-main font-semibold focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Bloco 2: Identidade Visual & Branding (R2 Upload) */}
                  <div className="space-y-4 bg-bg-sec p-5 rounded-2xl border border-border-main text-left">
                    <span className="text-[11px] font-extrabold text-[#F5F7F8] uppercase tracking-wider block border-b border-border-main pb-2">Identidade Visual & Branding</span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Título do Cabeçalho:</label>
                        <input
                          type="text"
                          value={seo.siteTitle || ""}
                          placeholder="Ex: Conversor SunDrive"
                          onChange={(e) => setSeo({ ...seo, siteTitle: e.target.value })}
                          className="w-full bg-card-main border border-border-main rounded-xl px-3 py-2.5 text-xs text-text-main font-semibold focus:outline-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Subtítulo do Cabeçalho:</label>
                        <input
                          type="text"
                          value={seo.siteSubtitle || ""}
                          placeholder="Ex: Ferramentas para áudio e PDF."
                          onChange={(e) => setSeo({ ...seo, siteSubtitle: e.target.value })}
                          className="w-full bg-card-main border border-border-main rounded-xl px-3 py-2.5 text-xs text-text-main font-semibold focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">URL do Logotipo:</label>
                      <input
                        type="url"
                        value={seo.siteLogoUrl || ""}
                        placeholder="Insira a URL do logotipo ou envie abaixo"
                        onChange={(e) => setSeo({ ...seo, siteLogoUrl: e.target.value })}
                        className="w-full bg-card-main border border-border-main rounded-xl px-3 py-2.5 text-xs text-text-main font-semibold focus:outline-none"
                      />
                    </div>

                    {/* R2 Logo uploader */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Upload do Logotipo para o Bucket R2:</label>
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-card-main rounded-xl border border-border-main overflow-hidden flex items-center justify-center p-1.5">
                          {seo.siteLogoUrl ? (
                            <img src={seo.siteLogoUrl.startsWith("data:") || seo.siteLogoUrl.startsWith("/") ? seo.siteLogoUrl : `/api/ads-public-image?url=${encodeURIComponent(seo.siteLogoUrl)}`} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                          ) : (
                            <Volume2 className="h-6 w-6 text-green-primary opacity-30" />
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            id="logo-upload-input"
                            onChange={handleLogoUpload}
                            className="hidden"
                            disabled={logoUploading}
                          />
                          <label
                            htmlFor="logo-upload-input"
                            className="inline-flex items-center justify-center px-4 py-2 bg-card-main hover:bg-card-inner border border-border-main rounded-xl text-[11px] font-extrabold text-text-main uppercase tracking-wider cursor-pointer select-none transition-colors"
                          >
                            {logoUploading ? `Enviando… ${logoUploadProgress}%` : "Selecionar Logotipo"}
                          </label>
                          <p className="text-[10px] text-text-muted mt-1.5">
                            Formatos recomendados: PNG, JPG, WEBP ou SVG, altura máx: 44px.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Snippet Preview */}
                <div className="space-y-4">
                  <div className="bg-bg-sec p-5 rounded-2xl border border-border-main space-y-3">
                    <span className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Snippet de Busca Google (Prévia):</span>
                    <div className="bg-[#1e1e1e] border border-border-main p-4 rounded-xl text-left space-y-1 font-sans text-sm">
                      <div className="text-[11px] text-[#A8B2BD] flex items-center gap-1">
                        somdrive.com <span className="opacity-50">&gt; início</span>
                      </div>
                      <h4 className="text-[#38bdf8] font-medium hover:underline cursor-pointer text-base leading-tight truncate">
                        {seo.pages.home.title}
                      </h4>
                      <p className="text-text-sec text-xs leading-normal line-clamp-2">
                        {seo.pages.home.description}
                      </p>
                    </div>
                  </div>

                  <div className="bg-[#2D343B] p-4 rounded-xl border border-border-main text-[11px] leading-relaxed text-text-sec">
                    <strong className="text-green-primary block mb-1">Dica de Produção:</strong>
                    Títulos com mais de 60 caracteres e descrições com mais de 160 caracteres podem ser truncados pelos motores de busca.
                  </div>
                </div>

              </div>

              {/* Specific page editing */}
              <div className="space-y-4 pt-4 border-t border-border-main">
                <h3 className="font-display font-extrabold text-[#F5F7F8] text-xs uppercase tracking-wider">Metas por Página</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <div className="bg-bg-sec p-4 rounded-xl border border-border-main space-y-3">
                    <span className="text-xs font-bold text-text-main block">Página Inicial (/)</span>
                    <input
                      type="text"
                      required
                      value={seo.pages.home.title}
                      onChange={(e) => handlePageSeoChange("home", "title", e.target.value)}
                      className="w-full bg-card-main border border-border-main rounded-lg px-3 py-2 text-xs focus:outline-none"
                    />
                    <textarea
                      required
                      value={seo.pages.home.description}
                      onChange={(e) => handlePageSeoChange("home", "description", e.target.value)}
                      rows={2}
                      className="w-full bg-card-main border border-border-main rounded-lg px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>

                  <div className="bg-bg-sec p-4 rounded-xl border border-border-main space-y-3">
                    <span className="text-xs font-bold text-text-main block">Converter Áudio (/converter-audio)</span>
                    <input
                      type="text"
                      required
                      value={seo.pages.audio.title}
                      onChange={(e) => handlePageSeoChange("audio", "title", e.target.value)}
                      className="w-full bg-card-main border border-border-main rounded-lg px-3 py-2 text-xs focus:outline-none"
                    />
                    <textarea
                      required
                      value={seo.pages.audio.description}
                      onChange={(e) => handlePageSeoChange("audio", "description", e.target.value)}
                      rows={2}
                      className="w-full bg-card-main border border-border-main rounded-lg px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>

                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button
                  type="submit"
                  className="bg-green-primary hover:bg-green-dark text-white px-5 py-3 rounded-xl font-extrabold text-xs transition-colors shadow-md uppercase tracking-wider cursor-pointer"
                >
                  Salvar Configuração de SEO
                </button>
              </div>
            </form>
          )}





          {/* TAB 5: RELATÓRIO DE ACESSOS (GA4) */}
          {activeTab === "analytics" && (
            <div className="space-y-6 text-left">
              <div className="border-b border-border-main pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="font-display font-extrabold text-[#F5F7F8] text-base uppercase tracking-wider flex items-center gap-2">
                    <Eye className="h-5 w-5 text-green-primary" />
                    Relatório de Acessos Real (Google Analytics 4)
                  </h2>
                  <p className="text-[11px] text-text-muted font-medium mt-1">
                    Visualização em tempo real de estatísticas consolidadas e telemetria agregada através da API oficial do GA4.
                  </p>
                </div>
                <button
                  onClick={fetchAnalytics}
                  disabled={analyticsLoading}
                  className="px-4 py-2 bg-green-primary hover:bg-green-dark disabled:bg-card-inner disabled:text-text-muted disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-colors shadow-md cursor-pointer whitespace-nowrap self-start"
                >
                  {analyticsLoading ? "Carregando..." : "Atualizar Relatório"}
                </button>
              </div>

              {/* Informative Security Banner */}
              <div className="bg-bg-sec p-4 rounded-xl border border-border-main space-y-1.5">
                <span className="text-xs font-extrabold text-[#39D977] uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" />
                  Privacidade, Segurança e Conformidade
                </span>
                <p className="text-[11px] text-text-sec leading-relaxed font-semibold">
                  Este painel exibe exclusivamente métricas de uso agregadas. Nomes de arquivos, conteúdos de PDF, tokens, endereços IP e UIDs administrativos de visitantes nunca são transmitidos, gravados ou armazenados, em conformidade total com a LGPD e as políticas de privacidade do Conversor SomDrive.
                </p>
              </div>

              {analyticsLoading && (
                <div className="bg-bg-sec p-12 rounded-2xl border border-border-main flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 rounded-full border-4 border-green-primary/30 border-t-green-primary animate-spin" />
                  <span className="text-xs text-text-muted font-mono font-bold">Solicitando dados da API do GA4...</span>
                </div>
              )}

              {analyticsError && (
                <div className="p-5 bg-red-500/5 border border-red-500/10 rounded-2xl text-left space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-red-500 uppercase tracking-wider">
                    <AlertCircle className="h-5 w-5" />
                    <span>Erro ao consultar API do Google Analytics 4</span>
                  </div>
                  <p className="text-xs text-text-sec font-semibold leading-relaxed">
                    A API retornou a seguinte mensagem de falha: <code className="bg-bg-sec px-1.5 py-0.5 rounded text-red-400 font-mono text-[11px] border border-border-main">{analyticsError}</code>
                  </p>
                  <div className="bg-bg-sec p-4 rounded-xl border border-border-main text-[11px] text-text-muted leading-relaxed font-medium space-y-2">
                    <span className="font-bold text-text-main block uppercase text-[10px] tracking-wider text-green-primary">Guia de Solução para Administradores:</span>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Certifique-se de que a variável <code className="text-white">GA4_PROPERTY_ID</code> está configurada corretamente com o ID numérico da propriedade no seu arquivo <code className="text-white">.env</code>.</li>
                      <li>Verifique se as variáveis de Conta de Serviço (<code className="text-white">GA4_CLIENT_EMAIL</code> e <code className="text-white">GA4_PRIVATE_KEY</code>) pertencem a uma conta de serviço válida com acesso à propriedade.</li>
                      <li>Certifique-se de que adicionou o e-mail da conta de serviço como "Leitor" nas permissões da propriedade Google Analytics 4.</li>
                    </ol>
                  </div>
                </div>
              )}

              {!analyticsLoading && !analyticsError && analyticsData && (
                <div className="space-y-6">
                  
                  {/* METRICAS PRINCIPAIS */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-bg-sec p-5 rounded-2xl border border-border-main space-y-1 shadow-sm">
                      <span className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Visualizações de Página</span>
                      <div className="text-2xl font-display font-extrabold text-green-primary">
                        {analyticsData.summary?.pageViews?.toLocaleString() || 0}
                      </div>
                      <span className="text-[9px] text-text-muted font-semibold block">Total de acessos nas páginas do site</span>
                    </div>

                    <div className="bg-bg-sec p-5 rounded-2xl border border-border-main space-y-1 shadow-sm">
                      <span className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Usuários Ativos</span>
                      <div className="text-2xl font-display font-extrabold text-green-primary">
                        {analyticsData.summary?.activeUsers?.toLocaleString() || 0}
                      </div>
                      <span className="text-[9px] text-text-muted font-semibold block">Visitantes únicos no período</span>
                    </div>

                    <div className="bg-bg-sec p-5 rounded-2xl border border-border-main space-y-1 shadow-sm">
                      <span className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">Sessões</span>
                      <div className="text-2xl font-display font-extrabold text-green-primary">
                        {analyticsData.summary?.sessions?.toLocaleString() || 0}
                      </div>
                      <span className="text-[9px] text-text-muted font-semibold block">Visitas iniciadas por usuários</span>
                    </div>
                  </div>

                  {/* GRID: PAGINAS MAIS VISITADAS & CONVERSOR DE AUDIO */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* PAGINAS VISITADAS */}
                    <div className="bg-bg-sec p-5 rounded-2xl border border-border-main space-y-4">
                      <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider border-b border-border-main pb-2">
                        Páginas e Telas Mais Acessadas
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-semibold">
                          <thead>
                            <tr className="border-b border-border-main text-text-muted text-[10px] uppercase tracking-wider">
                              <th className="pb-2 font-extrabold">Título / Caminho da Tela</th>
                              <th className="pb-2 text-right font-extrabold">Visualizações</th>
                              <th className="pb-2 text-right font-extrabold">Usuários</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-main/50 text-text-sec">
                            {analyticsData.pages && analyticsData.pages.length > 0 ? (
                              analyticsData.pages.map((page: any, i: number) => (
                                <tr key={i} className="hover:bg-card-inner/30 transition-colors">
                                  <td className="py-2.5 font-mono text-[11px] text-white truncate max-w-[200px]" title={page.title}>
                                    {page.path} <span className="text-[10px] text-text-muted block font-sans truncate">{page.title}</span>
                                  </td>
                                  <td className="py-2.5 text-right font-mono text-green-primary font-bold">{page.views?.toLocaleString() || 0}</td>
                                  <td className="py-2.5 text-right font-mono">{page.users?.toLocaleString() || 0}</td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3} className="py-4 text-center text-text-muted text-[11px]">Nenhum dado registrado para telas ainda.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* CONVERSOR DE AUDIO */}
                    <div className="bg-bg-sec p-5 rounded-2xl border border-border-main space-y-4">
                      <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider border-b border-border-main pb-2">
                        Desempenho do Conversor de Áudio
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-semibold">
                          <thead>
                            <tr className="border-b border-border-main text-text-muted text-[10px] uppercase tracking-wider">
                              <th className="pb-2 font-extrabold">Tipo de Ação</th>
                              <th className="pb-2 text-right font-extrabold">Contagem</th>
                              <th className="pb-2 text-right font-extrabold">Taxa de Conversão</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-main/50 text-text-sec font-mono text-[11px]">
                            {(() => {
                              const started = analyticsData.events?.find((e: any) => e.name === "audio_conversion_started")?.count || 0;
                              const completed = analyticsData.events?.find((e: any) => e.name === "audio_conversion_completed")?.count || 0;
                              const failed = analyticsData.events?.find((e: any) => e.name === "audio_conversion_failed")?.count || 0;

                              const conversionRate = started > 0 ? ((completed / started) * 100).toFixed(1) : "0.0";
                              const failureRate = started > 0 ? ((failed / started) * 100).toFixed(1) : "0.0";

                              return (
                                <>
                                  <tr className="hover:bg-card-inner/30 transition-colors">
                                    <td className="py-2.5 text-white font-sans font-bold">Iniciadas <code className="text-text-muted text-[10px] block font-mono">audio_conversion_started</code></td>
                                    <td className="py-2.5 text-right text-green-primary font-bold">{started.toLocaleString()}</td>
                                    <td className="py-2.5 text-right text-text-muted">—</td>
                                  </tr>
                                  <tr className="hover:bg-card-inner/30 transition-colors">
                                    <td className="py-2.5 text-white font-sans font-bold">Concluídas com Sucesso <code className="text-text-muted text-[10px] block font-mono">audio_conversion_completed</code></td>
                                    <td className="py-2.5 text-right text-green-primary font-bold">{completed.toLocaleString()}</td>
                                    <td className="py-2.5 text-right text-[#39D977] font-bold">{conversionRate}%</td>
                                  </tr>
                                  <tr className="hover:bg-card-inner/30 transition-colors">
                                    <td className="py-2.5 text-white font-sans font-bold">Falhas <code className="text-text-muted text-[10px] block font-mono">audio_conversion_failed</code></td>
                                    <td className="py-2.5 text-right text-red-500 font-bold">{failed.toLocaleString()}</td>
                                    <td className="py-2.5 text-right text-red-400 font-bold">{failureRate}%</td>
                                  </tr>
                                </>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>

                  {/* GRID: FERRAMENTAS PDF & ANUNCIOS */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* FERRAMENTAS PDF */}
                    <div className="bg-bg-sec p-5 rounded-2xl border border-border-main space-y-4">
                      <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider border-b border-border-main pb-2">
                        Utilização das Ferramentas PDF
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-semibold">
                          <thead>
                            <tr className="border-b border-border-main text-text-muted text-[10px] uppercase tracking-wider">
                              <th className="pb-2 font-extrabold">Ferramenta PDF</th>
                              <th className="pb-2 text-right font-extrabold">Iniciadas</th>
                              <th className="pb-2 text-right font-extrabold">Concluídas</th>
                              <th className="pb-2 text-right font-extrabold">Falhas</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-main/50 text-text-sec font-mono text-[11px]">
                            {(() => {
                              const tools = ["merge", "compress", "imgToPdf", "organize", "deleteRotate"];
                              const toolLabels: Record<string, string> = {
                                merge: "Juntar PDFs",
                                compress: "Comprimir PDF",
                                imgToPdf: "Imagens para PDF",
                                organize: "Organizar Páginas",
                                deleteRotate: "Excluir & Girar"
                              };

                              return tools.map((tool) => {
                                const started = analyticsData.events?.find((e: any) => e.name === "pdf_processing_started")?.toolCounts?.[tool] || 0;
                                const completed = analyticsData.events?.find((e: any) => e.name === "pdf_processing_completed")?.toolCounts?.[tool] || 0;
                                const failed = analyticsData.events?.find((e: any) => e.name === "pdf_processing_failed")?.toolCounts?.[tool] || 0;

                                return (
                                  <tr key={tool} className="hover:bg-card-inner/30 transition-colors">
                                    <td className="py-2.5 text-white font-sans font-bold">{toolLabels[tool]}</td>
                                    <td className="py-2.5 text-right font-bold">{started.toLocaleString()}</td>
                                    <td className="py-2.5 text-right text-[#39D977] font-bold">{completed.toLocaleString()}</td>
                                    <td className="py-2.5 text-right text-red-500 font-bold">{failed.toLocaleString()}</td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* ANUNCIOS PERFORMANCE */}
                    <div className="bg-bg-sec p-5 rounded-2xl border border-border-main space-y-4">
                      <h3 className="text-xs font-extrabold text-text-main uppercase tracking-wider border-b border-border-main pb-2">
                        Desempenho dos Anúncios
                      </h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-semibold">
                          <thead>
                            <tr className="border-b border-border-main text-text-muted text-[10px] uppercase tracking-wider">
                              <th className="pb-2 font-extrabold">ID do Anúncio</th>
                              <th className="pb-2 text-right font-extrabold">Visualizações</th>
                              <th className="pb-2 text-right font-extrabold">Cliques</th>
                              <th className="pb-2 text-right font-extrabold">CTR (Taxa de Clique)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border-main/50 text-text-sec font-mono text-[11px]">
                            {analyticsData.adsPerformance && analyticsData.adsPerformance.length > 0 ? (
                              analyticsData.adsPerformance.map((item: any, i: number) => {
                                const views = item.views || 0;
                                const clicks = item.clicks || 0;
                                const ctr = views > 0 ? ((clicks / views) * 100).toFixed(2) : "0.00";
                                return (
                                  <tr key={i} className="hover:bg-card-inner/30 transition-colors">
                                    <td className="py-2.5 text-white truncate max-w-[120px]" title={item.adId}>
                                      {item.adId}
                                    </td>
                                    <td className="py-2.5 text-right">{views.toLocaleString()}</td>
                                    <td className="py-2.5 text-right text-green-primary font-bold">{clicks.toLocaleString()}</td>
                                    <td className="py-2.5 text-right text-[#39D977] font-bold">{ctr}%</td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={4} className="py-4 text-center text-text-muted text-[11px]">Nenhuma interação com anúncios consolidada ainda.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>

                </div>
              )}
            </div>
          )}

        </main>
      </div>

      {/* Custom Confirmation Modal */}
      {confirmDeleteAd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#1C2530] border border-border-main rounded-2xl max-w-md w-full p-6 text-left shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-extrabold text-white">Excluir Anúncio</h3>
            <p className="text-xs text-text-sec mt-3 leading-relaxed">
              Deseja excluir este anúncio? A imagem e os dados serão removidos permanentemente.
            </p>
            <div className="bg-card-inner border border-border-main p-3 rounded-xl mt-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-[#161D26] rounded-lg border border-border-main overflow-hidden shrink-0 flex items-center justify-center">
                <img 
                  src={resolveAdImageSrc(confirmDeleteAd)} 
                  alt={confirmDeleteAd.altText} 
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{confirmDeleteAd.title}</p>
                <p className="text-[10px] text-text-muted font-mono mt-0.5 uppercase tracking-wider">{confirmDeleteAd.position}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 mt-6">
              <button
                type="button"
                onClick={() => setConfirmDeleteAd(null)}
                className="px-4 py-2 text-xs font-bold text-text-sec hover:text-white bg-card-inner border border-border-main rounded-xl hover:bg-[#25303D] cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const adToDel = confirmDeleteAd;
                  setConfirmDeleteAd(null);
                  handleDeleteAd(adToDel, true);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl cursor-pointer transition-colors"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
