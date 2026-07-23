import React from "react";
import {
  CROP_ASPECT_RATIOS,
  SOCIAL_PRESETS,
  DOCUMENT_PRESETS,
  CropPreset,
  PackagePresetConfig
} from "../../../utils/imageCropPresets";
import { Layers, Zap, Check, Sparkles } from "lucide-react";

interface ImageCropPresetSelectorProps {
  mode: "single" | "package";
  onChangeMode: (mode: "single" | "package") => void;

  // Single mode props
  selectedAspectRatio: string; // "free" | "1:1" | "16:9" | etc.
  onSelectAspectRatio: (val: string) => void;
  selectedPreset: CropPreset | null;
  onSelectPreset: (preset: CropPreset | null) => void;

  // Custom dimensions for single mode
  customWidth: number;
  customHeight: number;
  onChangeCustomWidth: (w: number) => void;
  onChangeCustomHeight: (h: number) => void;

  // Package mode props
  packageConfigs: PackagePresetConfig[];
  onTogglePackagePreset: (presetId: string) => void;
  onSelectAllPackage: () => void;
  onDeselectAllPackage: () => void;
}

export default function ImageCropPresetSelector({
  mode,
  onChangeMode,
  selectedAspectRatio,
  onSelectAspectRatio,
  selectedPreset,
  onSelectPreset,
  customWidth,
  customHeight,
  onChangeCustomWidth,
  onChangeCustomHeight,
  packageConfigs,
  onTogglePackagePreset,
  onSelectAllPackage,
  onDeselectAllPackage
}: ImageCropPresetSelectorProps) {
  return (
    <div className="bg-card-main border border-border-main p-4 rounded-2xl space-y-4 shadow-sm">
      
      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-border-main pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeMode("single")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              mode === "single"
                ? "bg-green-primary text-bg-main shadow-sm"
                : "bg-card-inner border border-border-main text-text-sec hover:text-text-main"
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Recorte Rápido</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMode("package")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer relative ${
              mode === "package"
                ? "bg-green-primary text-bg-main shadow-sm"
                : "bg-card-inner border border-border-main text-text-sec hover:text-text-main hover:border-green-primary/50"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Pacote de Cortes</span>
            <span className="text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded-full flex items-center gap-0.5 ml-1">
              <Sparkles className="h-2.5 w-2.5" />
              Diferencial
            </span>
          </button>
        </div>

        <p className="text-[11px] text-text-muted font-semibold hidden md:block">
          {mode === "single"
            ? "Escolha um enquadramento ou proporção para corte instantâneo."
            : "Defina o ponto principal e escolha os formatos desejados de uma só vez."}
        </p>
      </div>

      {/* SINGLE MODE SELECTOR */}
      {mode === "single" && (
        <div className="space-y-4">
          
          {/* Quick Aspect Ratio Pills */}
          <div>
            <label className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider block mb-2">
              Proporções Rápidas:
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {CROP_ASPECT_RATIOS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    onSelectAspectRatio(item.value);
                    onSelectPreset(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                    selectedAspectRatio === item.value && !selectedPreset
                      ? "bg-card-selected border-green-primary text-green-primary"
                      : "bg-card-inner border-border-main text-text-sec hover:border-green-primary/40 hover:text-text-main"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Dimension Input if custom ratio selected */}
          {selectedAspectRatio === "custom" && (
            <div className="p-3 bg-card-inner border border-border-main rounded-xl flex items-center gap-3 max-w-md">
              <span className="text-xs font-extrabold text-text-sec">Dimensões Personalizadas:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="10"
                  max="10000"
                  value={customWidth || ""}
                  onChange={(e) => onChangeCustomWidth(parseInt(e.target.value) || 0)}
                  placeholder="Largura"
                  className="w-20 px-2 py-1 bg-card-main border border-border-main rounded-lg text-xs text-text-main font-bold focus:border-green-primary focus:outline-none"
                />
                <span className="text-xs text-text-muted font-bold">×</span>
                <input
                  type="number"
                  min="10"
                  max="10000"
                  value={customHeight || ""}
                  onChange={(e) => onChangeCustomHeight(parseInt(e.target.value) || 0)}
                  placeholder="Altura"
                  className="w-20 px-2 py-1 bg-card-main border border-border-main rounded-lg text-xs text-text-main font-bold focus:border-green-primary focus:outline-none"
                />
                <span className="text-xs text-text-muted font-bold">px</span>
              </div>
            </div>
          )}

          {/* Social Presets */}
          <div>
            <label className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider block mb-2">
              Tamanhos Prontos - Redes Sociais:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SOCIAL_PRESETS.map((p) => {
                const isSelected = selectedPreset?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelectPreset(p);
                      onSelectAspectRatio(p.aspectRatio ? `${p.width}:${p.height}` : "free");
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-card-selected border-green-primary text-green-light shadow-sm"
                        : "bg-card-inner border-border-main text-text-sec hover:border-green-primary/40 hover:text-text-main"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-text-main truncate">{p.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-green-primary shrink-0" />}
                    </div>
                    <p className="text-[10px] text-text-muted mt-0.5 font-mono">
                      {p.width} × {p.height} px
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Document Presets */}
          <div>
            <label className="text-[11px] font-extrabold text-text-muted uppercase tracking-wider block mb-2">
              Documentos & Impressão:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DOCUMENT_PRESETS.map((p) => {
                const isSelected = selectedPreset?.id === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSelectPreset(p);
                      onSelectAspectRatio(p.aspectRatio ? `${p.width}:${p.height}` : "free");
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-card-selected border-green-primary text-green-light shadow-sm"
                        : "bg-card-inner border-border-main text-text-sec hover:border-green-primary/40 hover:text-text-main"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-text-main truncate">{p.name}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-green-primary shrink-0" />}
                    </div>
                    <p className="text-[10px] text-text-muted mt-0.5 font-mono">
                      {p.width} × {p.height} px
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* PACKAGE MODE SELECTOR */}
      {mode === "package" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-extrabold text-xs text-text-main">
                Selecione os formatos que deseja gerar no Pacote
              </h4>
              <p className="text-[11px] text-text-muted">
                Todas as prévias serão centralizadas automaticamente no Ponto Principal.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={onSelectAllPackage}
                className="px-2.5 py-1 rounded-lg bg-card-inner border border-border-main text-text-sec hover:text-green-light transition-all cursor-pointer"
              >
                Selecionar Todos
              </button>
              <button
                type="button"
                onClick={onDeselectAllPackage}
                className="px-2.5 py-1 rounded-lg bg-card-inner border border-border-main text-text-sec hover:text-red-400 transition-all cursor-pointer"
              >
                Limpar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {packageConfigs.map((cfg) => (
              <div
                key={cfg.preset.id}
                onClick={() => onTogglePackagePreset(cfg.preset.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  cfg.enabled
                    ? "bg-green-primary/10 border-green-primary/60 text-text-main shadow-sm"
                    : "bg-card-inner border-border-main text-text-muted hover:border-border-main/80"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs text-text-main truncate">
                      {cfg.preset.name}
                    </span>
                    {cfg.preset.badge && (
                      <span className="text-[8px] font-black uppercase bg-green-primary text-bg-main px-1.5 py-0.2 rounded-full">
                        {cfg.preset.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-text-muted font-mono mt-0.5">
                    {cfg.preset.width} × {cfg.preset.height} px ({cfg.preset.category})
                  </p>
                </div>

                <div
                  className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                    cfg.enabled
                      ? "bg-green-primary border-green-primary text-bg-main"
                      : "border-border-main bg-card-main"
                  }`}
                >
                  {cfg.enabled && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
