import React, { useState, useEffect } from "react";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebase";
import {
  Image,
  Upload,
  RotateCcw,
  Trash2,
  Check,
  AlertTriangle,
  RefreshCw,
  Info,
  Sparkles,
  ShieldCheck,
  Tag
} from "lucide-react";

interface BrandingConfig {
  logoUrl: string;
  logoStoragePath: string;
  logoAlt: string;
  updatedAt?: string;
}

const DEFAULT_LOGO_PATH = "/logo-somdrive.png";
const DEFAULT_ALT_TEXT = "Conversor SomDrive";

export default function AdminBrandingManager() {
  const [brandingConfig, setBrandingConfig] = useState<BrandingConfig>({
    logoUrl: "",
    logoStoragePath: "",
    logoAlt: DEFAULT_ALT_TEXT
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [saving, setSaving] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [logoAlt, setLogoAlt] = useState<string>(DEFAULT_ALT_TEXT);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Subscribe to real-time branding config from Firestore
  useEffect(() => {
    setLoading(true);
    const docRef = doc(db, "site_settings", "branding");

    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as BrandingConfig;
          setBrandingConfig({
            logoUrl: data.logoUrl || "",
            logoStoragePath: data.logoStoragePath || "",
            logoAlt: data.logoAlt || DEFAULT_ALT_TEXT,
            updatedAt: data.updatedAt
          });
          setLogoAlt(data.logoAlt || DEFAULT_ALT_TEXT);
        } else {
          // If branding doc doesn't exist, try loading from legacy site_settings/seo or default
          getDoc(doc(db, "site_settings", "seo")).then((seoSnap) => {
            if (seoSnap.exists()) {
              const seoData = seoSnap.data();
              if (seoData.siteLogoUrl) {
                setBrandingConfig(prev => ({
                  ...prev,
                  logoUrl: seoData.siteLogoUrl
                }));
              }
            }
          }).catch(() => {});
        }
        setLoading(false);
      },
      (err) => {
        console.error("[BRANDING MANAGER] Error listening to branding config:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Helper to upload file to Cloudflare R2
  const uploadToR2 = async (file: File, destinationPath: string, onProgress?: (pct: number) => void) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error("Sessão expirada ou usuário não autenticado no cliente.");
    }

    const idToken = await currentUser.getIdToken();

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
      throw new Error(errorData.message || `Falha ao obter URL de envio (${presignedResponse.status})`);
    }

    const { uploadUrl, storagePath } = await presignedResponse.json();
    if (onProgress) onProgress(60);

    let uploadResult;
    try {
      uploadResult = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type
        }
      });
    } catch (directErr) {
      console.warn("[CLIENT] Direct R2 PUT blocked by CORS or network, falling back to server proxy upload...", directErr);
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
      throw new Error(`Upload falhou com status ${uploadResult.status}: ${errorText}`);
    }

    if (onProgress) onProgress(100);

    // Build standard public proxy URL for R2 object
    const finalPublicUrl = `/api/ads-public-image?path=${encodeURIComponent(storagePath)}`;
    return { publicUrl: finalPublicUrl, storagePath };
  };

  // Helper to delete object from Cloudflare R2
  const deleteFromR2 = async (storagePath: string) => {
    if (!storagePath || !storagePath.startsWith("branding/")) return;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const idToken = await currentUser.getIdToken(true);

      await fetch("/api/ads-delete-object", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ storagePath })
      });
    } catch (err) {
      console.warn("[CLIENT] Error deleting previous logo from R2:", err);
    }
  };

  // Handle local file selection and strict validations
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    // Validate format: PNG, JPG, JPEG, WEBP, SVG
    const validMimes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    const isSvgExt = file.name.toLowerCase().endsWith(".svg");
    if (!validMimes.includes(file.type) && !isSvgExt) {
      setErrorMessage("Formato inválido. Por favor envie uma imagem nos formatos PNG, JPG, JPEG, WEBP ou SVG.");
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    // Validate size: max 2 MB (2,097,152 bytes)
    if (file.size > 2 * 1024 * 1024) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setErrorMessage(`O arquivo selecionado (${fileSizeMB} MB) excede o limite máximo permitido de 2 MB.`);
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    setSelectedFile(file);

    // Preview
    const reader = new FileReader();
    reader.onload = (evt) => {
      setPreviewUrl(evt.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Upload and replace logo
  const handleUploadAndSave = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(10);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const ext = selectedFile.name.split('.').pop() || 'png';
      const cleanExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
      const timestamp = Date.now();
      const destinationPath = `branding/logo-site-${timestamp}.${cleanExt}`;

      // 1. Upload to Cloudflare R2
      const { publicUrl, storagePath } = await uploadToR2(selectedFile, destinationPath, (pct) => {
        setUploadProgress(pct);
      });

      // 2. Confirm object uploaded > 0
      if (!publicUrl || !storagePath) {
        throw new Error("Não foi possível confirmar o salvamento do objeto no Cloudflare R2.");
      }

      const oldStoragePath = brandingConfig.logoStoragePath;

      // 3. Save configuration in Firestore `site_settings/branding`
      const newBrandingData: BrandingConfig = {
        logoUrl: publicUrl,
        logoStoragePath: storagePath,
        logoAlt: logoAlt.trim() || DEFAULT_ALT_TEXT,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "site_settings", "branding"), newBrandingData, { merge: true });

      // Also sync site_settings/seo for backwards compatibility
      await setDoc(doc(db, "site_settings", "seo"), {
        siteLogoUrl: publicUrl,
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      // 4. Delete previous logo from R2 after success
      if (oldStoragePath && oldStoragePath !== storagePath && oldStoragePath.startsWith("branding/")) {
        await deleteFromR2(oldStoragePath);
      }

      setBrandingConfig(newBrandingData);
      setSelectedFile(null);
      setPreviewUrl(null);
      setSuccessMessage("Nova logo do site enviada, armazenada no R2 e atualizada com sucesso!");
      setTimeout(() => setSuccessMessage(null), 4000);

    } catch (err: any) {
      console.error("[BRANDING MANAGER] Error uploading logo:", err);
      setErrorMessage("Erro ao enviar/salvar logotipo: " + (err.message || String(err)));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Restore default logo
  const handleRestoreDefault = async () => {
    if (!window.confirm("Deseja realmente remover a logo personalizada e restaurar a logo padrão do sistema (/logo-somdrive.png)?")) {
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const oldStoragePath = brandingConfig.logoStoragePath;

      const defaultData: BrandingConfig = {
        logoUrl: "",
        logoStoragePath: "",
        logoAlt: DEFAULT_ALT_TEXT,
        updatedAt: new Date().toISOString()
      };

      // Update Firestore document `site_settings/branding`
      await setDoc(doc(db, "site_settings", "branding"), defaultData);

      // Sync site_settings/seo
      await setDoc(doc(db, "site_settings", "seo"), {
        siteLogoUrl: "",
        updatedAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});

      // Delete old logo from R2 if existed
      if (oldStoragePath && oldStoragePath.startsWith("branding/")) {
        await deleteFromR2(oldStoragePath);
      }

      setBrandingConfig(defaultData);
      setLogoAlt(DEFAULT_ALT_TEXT);
      setSelectedFile(null);
      setPreviewUrl(null);
      setSuccessMessage("Logo padrão do sistema restaurada com sucesso!");
      setTimeout(() => setSuccessMessage(null), 4000);

    } catch (err: any) {
      console.error("[BRANDING MANAGER] Error restoring default logo:", err);
      setErrorMessage("Erro ao restaurar logo padrão: " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Save Alt text only
  const handleSaveAltText = async () => {
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const updatedData: BrandingConfig = {
        ...brandingConfig,
        logoAlt: logoAlt.trim() || DEFAULT_ALT_TEXT,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "site_settings", "branding"), updatedData, { merge: true });
      setBrandingConfig(updatedData);
      setSuccessMessage("Texto alternativo (Alt) da marca salvo com sucesso!");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage("Erro ao salvar texto alternativo: " + (err.message || String(err)));
    } finally {
      setSaving(false);
    }
  };

  // Compute current display image source with fallback chain
  const activeLogoSrc = previewUrl
    ? previewUrl
    : brandingConfig.logoUrl
      ? brandingConfig.logoUrl
      : brandingConfig.logoStoragePath
        ? `/api/ads-public-image?path=${encodeURIComponent(brandingConfig.logoStoragePath)}`
        : DEFAULT_LOGO_PATH;

  const isCustomLogoActive = !!(brandingConfig.logoUrl || brandingConfig.logoStoragePath);

  if (loading) {
    return (
      <div className="bg-bg-sec border border-border-main p-8 rounded-2xl flex items-center justify-center gap-3 text-text-muted font-bold text-xs">
        <RefreshCw className="h-5 w-5 animate-spin text-green-primary" />
        <span>Carregando configurações de Identidade Visual...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      {/* HEADER SECTION */}
      <div className="border-b border-border-main pb-4">
        <h2 className="font-display font-extrabold text-[#F5F7F8] text-base uppercase tracking-wider flex items-center gap-2">
          <Image className="h-5 w-5 text-green-primary" />
          <span>Identidade Visual & Logotipo</span>
        </h2>
        <p className="text-[11px] text-text-muted font-medium mt-1">
          Gerencie a logo principal exibida no cabeçalho e marca do aplicativo Conversor SomDrive.
        </p>
      </div>

      {/* MESSAGES */}
      {errorMessage && (
        <div className="p-3.5 bg-red-950/40 border border-red-800/40 rounded-xl text-red-300 text-xs font-bold flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-emerald-300 text-xs font-bold flex items-center gap-2.5">
          <Check className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT COLUMN: LOGO MANAGEMENT */}
        <div className="bg-bg-sec border border-border-main p-5 rounded-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-border-main pb-3">
            <h3 className="font-extrabold text-xs text-[#F5F7F8] uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-primary" />
              <span>Logo Principal do Site</span>
            </h3>

            {isCustomLogoActive ? (
              <span className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 text-[10px] font-extrabold rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Logo Personalizada (R2)
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-card-inner border border-border-main text-text-sec text-[10px] font-extrabold rounded-full">
                Logo Padrão Local
              </span>
            )}
          </div>

          {/* LOGO DISPLAY PREVIEW BOX */}
          <div className="space-y-2">
            <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">
              Prévia Visual do Logotipo:
            </label>
            <div className="bg-card-main border border-border-main rounded-xl p-6 flex flex-col items-center justify-center gap-3 min-h-[140px] relative overflow-hidden group">
              <div className="w-20 h-20 bg-card-inner rounded-2xl border border-border-main p-2 shadow-inner flex items-center justify-center overflow-hidden">
                <img
                  src={activeLogoSrc}
                  alt={logoAlt || DEFAULT_ALT_TEXT}
                  className="max-w-full max-h-full object-contain"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_LOGO_PATH;
                  }}
                />
              </div>

              <div className="text-center space-y-0.5">
                <p className="text-xs font-bold text-text-main">
                  {selectedFile ? `Arquivo selecionado: ${selectedFile.name}` : isCustomLogoActive ? "Logotipo Personalizado Ativo" : "Logotipo Padrão do Sistema"}
                </p>
                <p className="text-[10px] text-text-muted font-mono">
                  {selectedFile ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB (${selectedFile.type || "imagem"})` : isCustomLogoActive ? brandingConfig.logoStoragePath || "Armazenado no Cloudflare R2" : DEFAULT_LOGO_PATH}
                </p>
              </div>
            </div>
          </div>

          {/* FILE UPLOAD & ACTIONS */}
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">
                Selecionar Nova Imagem para Substituir:
              </label>

              <div className="relative">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml"
                  onChange={handleFileChange}
                  disabled={uploading || saving}
                  className="hidden"
                  id="branding-logo-file-input"
                />
                <label
                  htmlFor="branding-logo-file-input"
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-card-inner hover:bg-card-selected border border-border-main hover:border-green-primary/30 rounded-xl text-xs font-bold text-text-main cursor-pointer transition-all w-full text-center"
                >
                  <Upload className="h-4 w-4 text-green-primary" />
                  <span>{selectedFile ? `Alterar arquivo (${selectedFile.name})` : "Escolher arquivo de imagem..."}</span>
                </label>
              </div>

              <div className="flex items-center justify-between text-[10px] text-text-muted font-medium px-1">
                <span>Formatos: PNG, JPG, JPEG, WEBP, SVG</span>
                <span>Tamanho máximo: 2 MB</span>
              </div>
            </div>

            {/* UPLOAD PROGRESS BAR */}
            {uploading && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold text-green-primary">
                  <span>Enviando para o Cloudflare R2...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-card-main rounded-full h-2 overflow-hidden border border-border-main">
                  <div
                    className="bg-green-primary h-full transition-all duration-300 rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              {selectedFile && (
                <button
                  type="button"
                  onClick={handleUploadAndSave}
                  disabled={uploading || saving}
                  className="flex-1 py-2.5 px-4 bg-green-primary hover:bg-green-dark disabled:opacity-50 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      <span>Enviando ({uploadProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span>Enviar & Substituir Logo</span>
                    </>
                  )}
                </button>
              )}

              {isCustomLogoActive && (
                <button
                  type="button"
                  onClick={handleRestoreDefault}
                  disabled={uploading || saving}
                  className="py-2.5 px-4 bg-card-inner hover:bg-red-950/30 text-text-sec hover:text-red-300 border border-border-main hover:border-red-800/40 rounded-xl font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restaurar Logo Padrão</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: BRAND ALT TEXT & INFO */}
        <div className="space-y-6">
          <div className="bg-bg-sec border border-border-main p-5 rounded-2xl space-y-4">
            <div className="border-b border-border-main pb-3">
              <h3 className="font-extrabold text-xs text-[#F5F7F8] uppercase tracking-wider flex items-center gap-2">
                <Tag className="h-4 w-4 text-green-primary" />
                <span>Texto Alternativo & Identidade</span>
              </h3>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-text-sec uppercase tracking-wider block">
                  Texto Alternativo da Logo (Alt Text para Acessibilidade e SEO):
                </label>
                <input
                  type="text"
                  value={logoAlt}
                  onChange={(e) => setLogoAlt(e.target.value)}
                  placeholder="Conversor SomDrive"
                  className="w-full bg-card-main border border-border-main focus:border-green-primary/50 text-text-main text-xs rounded-xl px-3.5 py-2.5 font-bold outline-none transition-colors"
                />
                <p className="text-[10px] text-text-muted">
                  Valor padrão: <span className="font-mono text-text-sec">Conversor SomDrive</span>
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveAltText}
                disabled={saving || uploading}
                className="w-full py-2.5 bg-card-inner hover:bg-card-selected text-text-main border border-border-main hover:border-green-primary/30 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {saving ? <RefreshCw className="h-3.5 w-3.5 animate-spin text-green-primary" /> : <Check className="h-3.5 w-3.5 text-green-primary" />}
                <span>Salvar Texto Alternativo</span>
              </button>
            </div>
          </div>

          {/* R2 & FALLBACK INFORMATION BOX */}
          <div className="bg-bg-sec border border-border-main p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2 text-green-primary font-bold text-xs uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" />
              <span>Infraestrutura & Fallback Seguro</span>
            </div>

            <ul className="text-[11px] text-text-muted space-y-2 leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-green-primary font-bold">•</span>
                <span>
                  <strong className="text-text-main">Armazenamento no Cloudflare R2:</strong> A logo enviada é salva na pasta <code className="bg-card-main px-1.5 py-0.5 rounded border border-border-main text-green-light">branding/</code> no mesmo bucket R2.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-primary font-bold">•</span>
                <span>
                  <strong className="text-text-main">Persistência no Firestore:</strong> Salva no documento <code className="bg-card-main px-1.5 py-0.5 rounded border border-border-main text-green-light">site_settings/branding</code>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-primary font-bold">•</span>
                <span>
                  <strong className="text-text-main">Ordem de Carregamento & Fallback:</strong> 
                  1. Logo do Firestore → 2. URL proxy do R2 → 3. Logo local padrão <code className="bg-card-main px-1.5 py-0.5 rounded border border-border-main text-green-light">/logo-somdrive.png</code>.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-primary font-bold">•</span>
                <span>
                  <strong className="text-text-main">Zero Ícones Quebrados:</strong> Tratamento <code className="bg-card-main px-1 py-0.5 rounded border border-border-main text-text-sec">onError</code> automático redireciona para a logo local se a imagem falhar.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
