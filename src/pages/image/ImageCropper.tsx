import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSeoHead } from "../../lib/useSeoHead";
import { trackEvent } from "../../lib/gtag";
import ImageToolSwitcher from "../../components/image/ImageToolSwitcher";
import AdBanner from "../../components/AdBanner";
import ImageCropUpload from "../../components/image/cropper/ImageCropUpload";
import ImageCropToolbar from "../../components/image/cropper/ImageCropToolbar";
import ImageCropPresetSelector from "../../components/image/cropper/ImageCropPresetSelector";
import ImageCropEditor from "../../components/image/cropper/ImageCropEditor";
import ImageCropBatchPreview from "../../components/image/cropper/ImageCropBatchPreview";
import ImageCropResults from "../../components/image/cropper/ImageCropResults";

import {
  CropPreset,
  CropRegion,
  FocalPoint,
  CropShape,
  PackagePresetConfig,
  SOCIAL_PRESETS,
  DOCUMENT_PRESETS,
  ALL_CROP_PRESETS
} from "../../utils/imageCropPresets";
import { calculateCropRegionForFocalPoint } from "../../utils/imageCropCalculations";
import {
  processSingleCrop,
  processPackageCrops,
  downloadCropResultsZip,
  CropProcessResult
} from "../../services/image/imageCropService";
import { decodeImageFile } from "../../services/image/imageDecoder";
import { MAX_SINGLE_IMAGE_SIZE } from "../../utils/imageValidation";

import {
  Crop as CropIcon,
  Sparkles,
  Scissors,
  CheckCircle2,
  Download,
  RefreshCw,
  Sliders,
  HelpCircle,
  FileImage,
  Layers,
  ArrowRight
} from "lucide-react";

interface ImageCropperProps {
  onNavigate?: (path: string) => void;
}

export default function ImageCropper({ onNavigate }: ImageCropperProps) {
  // Inject SEO metadata
  useSeoHead("imageCropper", "Cortar Imagem Grátis e Criar Tamanhos para Redes Sociais | SomDrive", "Recorte imagens livremente ou gere vários tamanhos prontos para Instagram, YouTube, Facebook e outras plataformas.");

  // States
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [imgWidth, setImgWidth] = useState<number>(0);
  const [imgHeight, setImgHeight] = useState<number>(0);

  const [mode, setMode] = useState<"single" | "package">("single");

  // Single Crop State
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>("1:1");
  const [selectedPreset, setSelectedPreset] = useState<CropPreset | null>(null);
  const [customWidth, setCustomWidth] = useState<number>(1080);
  const [customHeight, setCustomHeight] = useState<number>(1080);
  const [crop, setCrop] = useState<CropRegion>({ x: 0, y: 0, width: 100, height: 100 });

  // Transforms & Style
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [flipV, setFlipV] = useState<boolean>(false);
  const [focalPoint, setFocalPoint] = useState<FocalPoint | null>(null);
  const [focalPointModeActive, setFocalPointModeActive] = useState<boolean>(false);
  const [safeAreaActive, setSafeAreaActive] = useState<boolean>(false);
  const [shape, setShape] = useState<CropShape>("rect");
  const [backgroundColor, setBackgroundColor] = useState<string>("transparent");

  // Output options
  const [outputFormat, setOutputFormat] = useState<"JPG" | "PNG" | "WEBP">("JPG");
  const [quality, setQuality] = useState<number>(0.92);

  // Package Configs
  const [packageConfigs, setPackageConfigs] = useState<PackagePresetConfig[]>(() =>
    ALL_CROP_PRESETS.map((p) => ({
      preset: p,
      enabled: ["insta_square", "insta_feed", "insta_stories", "youtube_thumb"].includes(p.id)
    }))
  );

  // Processing & Results
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<CropProcessResult[] | null>(null);

  // Cleanup object URLs on unmount or reset
  const cleanupUrls = useCallback(() => {
    if (imageSrc) {
      URL.revokeObjectURL(imageSrc);
    }
    if (results) {
      results.forEach((r) => URL.revokeObjectURL(r.url));
    }
  }, [imageSrc, results]);

  useEffect(() => {
    return () => cleanupUrls();
  }, [cleanupUrls]);

  // Handle File Select
  const handleFileSelect = async (selectedFile: File) => {
    setError(null);
    setResults(null);

    if (selectedFile.size > MAX_SINGLE_IMAGE_SIZE) {
      setError(`A imagem excede o tamanho máximo permitido de 25 MB (${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB).`);
      return;
    }

    if (!selectedFile.type.startsWith("image/") && !selectedFile.name.match(/\.(jpg|jpeg|png|webp|avif|bmp)$/i)) {
      setError("Formato de arquivo não suportado. Por favor envie uma imagem JPG, PNG, WEBP, AVIF ou BMP.");
      return;
    }

    try {
      const decoded = await decodeImageFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);

      setFile(selectedFile);
      setImageSrc(url);
      setImgWidth(decoded.width);
      setImgHeight(decoded.height);

      // Default crop region to centered square or full
      const initialCrop = calculateCropRegionForFocalPoint(
        decoded.width,
        decoded.height,
        1, // 1:1
        undefined
      );
      setCrop(initialCrop);
      setFocalPoint(null);
      setFocalPointModeActive(false);

      // Auto-detect format to set default outputFormat
      const ext = selectedFile.name.split(".").pop()?.toUpperCase();
      if (ext === "PNG") setOutputFormat("PNG");
      else if (ext === "WEBP") setOutputFormat("WEBP");
      else setOutputFormat("JPG");

      decoded.cleanUp();
    } catch (err: any) {
      console.error("Erro ao carregar imagem:", err);
      setError("Não foi possível carregar esta imagem. Verifique se o arquivo não está corrompido.");
    }
  };

  // Target Aspect Ratio calculation
  const currentRatio = useMemo(() => {
    if (selectedPreset && selectedPreset.aspectRatio) {
      return selectedPreset.aspectRatio;
    }
    if (selectedAspectRatio === "free" || selectedAspectRatio === "original") {
      return undefined;
    }
    if (selectedAspectRatio === "custom") {
      return customWidth > 0 && customHeight > 0 ? customWidth / customHeight : 1;
    }
    const parts = selectedAspectRatio.split(":");
    if (parts.length === 2) {
      const w = parseFloat(parts[0]);
      const h = parseFloat(parts[1]);
      if (w > 0 && h > 0) return w / h;
    }
    return 1;
  }, [selectedPreset, selectedAspectRatio, customWidth, customHeight]);

  // Update crop box when ratio or focal point changes
  useEffect(() => {
    if (imgWidth > 0 && imgHeight > 0) {
      const newCrop = calculateCropRegionForFocalPoint(
        imgWidth,
        imgHeight,
        currentRatio,
        focalPoint || undefined
      );
      setCrop(newCrop);
    }
  }, [currentRatio, focalPoint, imgWidth, imgHeight]);

  // Handle Focal Point click set
  const handleSetFocalPoint = (fp: FocalPoint) => {
    setFocalPoint(fp);
    setFocalPointModeActive(false);
  };

  // Toggle Package Preset checkbox
  const handleTogglePackagePreset = (presetId: string) => {
    setPackageConfigs((prev) =>
      prev.map((c) => (c.preset.id === presetId ? { ...c, enabled: !c.enabled } : c))
    );
  };

  const handleSelectAllPackage = () => {
    setPackageConfigs((prev) => prev.map((c) => ({ ...c, enabled: true })));
  };

  const handleDeselectAllPackage = () => {
    setPackageConfigs((prev) => prev.map((c) => ({ ...c, enabled: false })));
  };

  // Execute Crop Process
  const handleProcessCrop = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);

    const inputFormat = file.name.split(".").pop()?.toUpperCase() || "JPG";

    try {
      if (mode === "single") {
        trackEvent("image_crop_started", {
          tool_name: "Cortar Imagem",
          crop_mode: "single",
          input_format: inputFormat,
          output_format: outputFormat,
          preset_name: selectedPreset?.name || selectedAspectRatio,
          shape,
          file_count: 1
        });

        const res = await processSingleCrop(file, {
          crop,
          outputFormat,
          quality,
          rotation,
          flipH,
          flipV,
          shape,
          backgroundColor,
          targetWidth: selectedPreset?.width,
          targetHeight: selectedPreset?.height,
          presetName: selectedPreset?.name
        });

        setResults([res]);

        trackEvent("image_crop_completed", {
          tool_name: "Cortar Imagem",
          crop_mode: "single",
          input_format: inputFormat,
          output_format: outputFormat,
          success: true
        });

      } else {
        // PACKAGE MODE
        const enabledItems = packageConfigs.filter((c) => c.enabled);
        if (enabledItems.length === 0) {
          setError("Selecione pelo menos um formato de saída para o Pacote de Cortes.");
          setIsProcessing(false);
          return;
        }

        trackEvent("image_crop_package_started", {
          tool_name: "Cortar Imagem",
          crop_mode: "package",
          input_format: inputFormat,
          output_format: outputFormat,
          preset_count: enabledItems.length,
          shape,
          file_count: 1
        });

        // Calculate crop region for each enabled preset based on focal point
        const packageItems = enabledItems.map((item) => {
          const itemCrop = calculateCropRegionForFocalPoint(
            imgWidth,
            imgHeight,
            item.preset.aspectRatio,
            focalPoint || undefined
          );
          return {
            preset: item.preset,
            crop: itemCrop
          };
        });

        const packageResults = await processPackageCrops(file, {
          items: packageItems,
          outputFormat,
          quality,
          rotation,
          flipH,
          flipV,
          shape,
          backgroundColor
        });

        setResults(packageResults);

        trackEvent("image_crop_package_completed", {
          tool_name: "Cortar Imagem",
          crop_mode: "package",
          input_format: inputFormat,
          output_format: outputFormat,
          preset_count: enabledItems.length,
          success: true
        });
      }
    } catch (err: any) {
      console.error("Erro ao cortar imagem:", err);
      setError(err.message || "Ocorreu um erro ao processar o recorte da imagem.");
      trackEvent("image_crop_failed", {
        tool_name: "Cortar Imagem",
        crop_mode: mode,
        input_format: inputFormat,
        success: false
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset to original upload state
  const handleReset = () => {
    cleanupUrls();
    setFile(null);
    setImageSrc(null);
    setResults(null);
    setError(null);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setFocalPoint(null);
    setFocalPointModeActive(false);
  };

  // Download handlers with GA4 tracking
  const handleDownloadSingle = (item: CropProcessResult) => {
    trackEvent("image_crop_download_clicked", {
      tool_name: "Cortar Imagem",
      output_format: item.format,
      crop_mode: mode
    });
    const link = document.createElement("a");
    link.href = item.url;
    link.download = item.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadZip = async () => {
    if (!results) return;
    trackEvent("image_crop_package_download_clicked", {
      tool_name: "Cortar Imagem",
      file_count: results.length,
      crop_mode: "package"
    });
    await downloadCropResultsZip(results, "pacote-de-cortes.zip");
  };

  return (
    <div className="min-h-screen bg-bg-main text-text-main py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      
      {/* Header SEO & Navigation */}
      <div className="max-w-4xl mx-auto text-center space-y-4">
        {/* Tool Switcher */}
        <ImageToolSwitcher activeTool="cortar" onNavigate={onNavigate} />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
          <Scissors className="h-3.5 w-3.5" />
          <span>Ferramenta de Imagem Grátis</span>
        </div>

        <h1 className="font-display text-3xl md:text-5xl font-extrabold tracking-tight text-text-main">
          Cortar Imagem Grátis
        </h1>

        <p className="text-sm md:text-base text-text-sec max-w-2xl mx-auto font-semibold leading-relaxed">
          Escolha o recorte ideal livremente ou gere vários tamanhos prontos para redes sociais usando o <span className="text-green-light font-bold">Pacote de Cortes</span>.
        </p>

        <p className="text-xs text-text-muted font-bold">
          Seus arquivos são processados diretamente no navegador e não ficam salvos em servidores.
        </p>
      </div>

      {/* Top Ad Banner */}
      <div className="max-w-4xl mx-auto">
        <AdBanner positionId="top-banner" toolName="Cortar Imagem" />
      </div>

      {/* MAIN STEP WORKFLOW */}
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Step 1: Upload */}
        {!file && (
          <ImageCropUpload onFileSelect={handleFileSelect} error={error} />
        )}

        {/* Step 2: Editor & Controls */}
        {file && imageSrc && !results && (
          <div className="space-y-6">
            
            {/* Toolbar */}
            <ImageCropToolbar
              rotation={rotation}
              onRotateLeft={() => setRotation((r) => (r - 90 + 360) % 360)}
              onRotateRight={() => setRotation((r) => (r + 90) % 360)}
              flipH={flipH}
              flipV={flipV}
              onToggleFlipH={() => setFlipH((f) => !f)}
              onToggleFlipV={() => setFlipV((f) => !f)}
              focalPointActive={focalPointModeActive}
              onToggleFocalPoint={() => setFocalPointModeActive((a) => !a)}
              focalPoint={focalPoint}
              onClearFocalPoint={() => setFocalPoint(null)}
              safeAreaActive={safeAreaActive}
              onToggleSafeArea={() => setSafeAreaActive((a) => !a)}
              shape={shape}
              onChangeShape={setShape}
              backgroundColor={backgroundColor}
              onChangeBackgroundColor={setBackgroundColor}
              onReset={handleReset}
            />

            {/* Presets & Mode Selector */}
            <ImageCropPresetSelector
              mode={mode}
              onChangeMode={setMode}
              selectedAspectRatio={selectedAspectRatio}
              onSelectAspectRatio={setSelectedAspectRatio}
              selectedPreset={selectedPreset}
              onSelectPreset={setSelectedPreset}
              customWidth={customWidth}
              customHeight={customHeight}
              onChangeCustomWidth={setCustomWidth}
              onChangeCustomHeight={setCustomHeight}
              packageConfigs={packageConfigs}
              onTogglePackagePreset={handleTogglePackagePreset}
              onSelectAllPackage={handleSelectAllPackage}
              onDeselectAllPackage={handleDeselectAllPackage}
            />

            {/* Canvas Interactive Editor */}
            <ImageCropEditor
              imageSrc={imageSrc}
              imgWidth={imgWidth}
              imgHeight={imgHeight}
              crop={crop}
              onChangeCrop={setCrop}
              focalPoint={focalPoint}
              onSetFocalPoint={handleSetFocalPoint}
              focalPointModeActive={focalPointModeActive}
              safeAreaActive={safeAreaActive}
              shape={shape}
              rotation={rotation}
              flipH={flipH}
              flipV={flipV}
              aspectRatio={currentRatio}
            />

            {/* Format & Export Options Footer Bar */}
            <div className="bg-card-main border border-border-main p-4 md:p-6 rounded-[28px] flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-4 flex-wrap w-full md:w-auto">
                <div>
                  <label className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider block mb-1">
                    Formato de Saída:
                  </label>
                  <div className="flex items-center p-1 bg-card-inner border border-border-main rounded-xl">
                    {(["JPG", "PNG", "WEBP"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setOutputFormat(fmt)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                          outputFormat === fmt
                            ? "bg-green-primary text-bg-main shadow-sm"
                            : "text-text-sec hover:text-text-main"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {outputFormat !== "PNG" && (
                  <div>
                    <label className="text-[10px] font-extrabold text-text-muted uppercase tracking-wider block mb-1">
                      Qualidade: {Math.round(quality * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0.5"
                      max="1.0"
                      step="0.05"
                      value={quality}
                      onChange={(e) => setQuality(parseFloat(e.target.value))}
                      className="w-32 accent-green-primary cursor-pointer"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-3 rounded-2xl bg-card-inner border border-border-main hover:border-red-500/50 text-text-sec hover:text-red-400 font-extrabold text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleProcessCrop}
                  disabled={isProcessing}
                  className="flex-1 md:flex-initial px-8 py-3.5 rounded-2xl bg-green-primary hover:bg-green-light text-bg-main font-extrabold text-sm transition-all shadow-lg hover:shadow-green-primary/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <div className="h-4 w-4 border-2 border-bg-main border-t-transparent rounded-full animate-spin" />
                      <span>Processando Recorte...</span>
                    </>
                  ) : (
                    <>
                      <Scissors className="h-4 w-4 stroke-[3]" />
                      <span>
                        {mode === "single" ? "Cortar Imagem Agora" : "Gerar Pacote de Cortes"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-semibold">
                {error}
              </div>
            )}

          </div>
        )}

        {/* Step 3: Results Display */}
        {results && (
          <ImageCropResults
            results={results}
            onReset={handleReset}
            onDownloadSingle={handleDownloadSingle}
            onDownloadZip={handleDownloadZip}
          />
        )}

      </div>

      {/* Middle Ad Banner */}
      <div className="max-w-4xl mx-auto pt-4">
        <AdBanner positionId="mid-banner" toolName="Cortar Imagem" />
      </div>

      {/* Educational & SEO FAQ Section */}
      <div className="max-w-4xl mx-auto space-y-6 pt-8 border-t border-border-main/50">
        <div className="text-center space-y-2">
          <h2 className="font-display text-2xl font-extrabold text-text-main">
            Como funciona o Cortar Imagem com Pacote de Cortes?
          </h2>
          <p className="text-xs text-text-sec font-semibold">
            Respostas simples para as dúvidas mais comuns sobre o corte e enquadramento de fotos
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 bg-card-main border border-border-main rounded-2xl space-y-2">
            <h3 className="font-extrabold text-sm text-text-main flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-primary shrink-0" />
              O que é o Pacote de Cortes?
            </h3>
            <p className="text-xs text-text-sec leading-relaxed font-semibold">
              O Pacote de Cortes permite recortar uma única foto em múltiplos formatos simultaneamente (Instagram Quadrado, Feed, Stories, YouTube, Facebook, TikTok) ajustando o enquadramento em torno do seu ponto de interesse.
            </p>
          </div>

          <div className="p-5 bg-card-main border border-border-main rounded-2xl space-y-2">
            <h3 className="font-extrabold text-sm text-text-main flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-primary shrink-0" />
              Para que serve o Ponto Principal?
            </h3>
            <p className="text-xs text-text-sec leading-relaxed font-semibold">
              Ao clicar no Ponto Principal (um rosto, produto ou objeto), todos os tamanhos do pacote serão automaticamente centralizados nessa região, garantindo que o elemento importante nunca fique cortado.
            </p>
          </div>

          <div className="p-5 bg-card-main border border-border-main rounded-2xl space-y-2">
            <h3 className="font-extrabold text-sm text-text-main flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-primary shrink-0" />
              As imagens perdem qualidade ao recortar?
            </h3>
            <p className="text-xs text-text-sec leading-relaxed font-semibold">
              Não. O processamento utiliza renderização Canvas de alta definição, mantendo os pixels originais da seleção e exportando no formato de sua preferência.
            </p>
          </div>

          <div className="p-5 bg-card-main border border-border-main rounded-2xl space-y-2">
            <h3 className="font-extrabold text-sm text-text-main flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-primary shrink-0" />
              Minhas fotos são enviadas para algum servidor?
            </h3>
            <p className="text-xs text-text-sec leading-relaxed font-semibold">
              Não. Todo o processo de leitura, corte e exportação em lote acontece 100% no seu próprio navegador, garantindo máxima velocidade e privacidade total.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
