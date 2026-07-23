import React from "react";
import { Sliders, Lock, Unlock, AlertTriangle, Palette, Grid, Maximize2 } from "lucide-react";
import { ResizeMode, FitMode, RESIZE_PRESETS, PERCENTAGE_OPTIONS } from "../../../utils/imageResizePresets";

export interface ResizerSettingsState {
  mode: ResizeMode;
  targetWidth: number;
  targetHeight: number;
  keepAspectRatio: boolean;
  percentage: number;
  presetId: string;
  presetWidth: number;
  presetHeight: number;
  fitMode: FitMode;
  bgColor: "transparent" | "white" | "black" | string;
}

interface ImageResizerSettingsProps {
  settings: ResizerSettingsState;
  onChange: (newSettings: ResizerSettingsState) => void;
  sampleOriginalWidth?: number;
  sampleOriginalHeight?: number;
  disabled?: boolean;
}

export default function ImageResizerSettings({
  settings,
  onChange,
  sampleOriginalWidth = 1920,
  sampleOriginalHeight = 1080,
  disabled
}: ImageResizerSettingsProps) {
  const aspectRatio = sampleOriginalWidth > 0 && sampleOriginalHeight > 0 ? sampleOriginalWidth / sampleOriginalHeight : 1;

  const handleWidthChange = (val: number) => {
    const w = Math.max(1, Math.min(10000, val));
    if (settings.keepAspectRatio) {
      const h = Math.max(1, Math.round(w / aspectRatio));
      onChange({ ...settings, targetWidth: w, targetHeight: h });
    } else {
      onChange({ ...settings, targetWidth: w });
    }
  };

  const handleHeightChange = (val: number) => {
    const h = Math.max(1, Math.min(10000, val));
    if (settings.keepAspectRatio) {
      const w = Math.max(1, Math.round(h * aspectRatio));
      onChange({ ...settings, targetWidth: w, targetHeight: h });
    } else {
      onChange({ ...settings, targetHeight: h });
    }
  };

  const handlePresetSelect = (presetId: string) => {
    const found = RESIZE_PRESETS.find((p) => p.id === presetId);
    if (found) {
      onChange({
        ...settings,
        presetId,
        presetWidth: found.width,
        presetHeight: found.height
      });
    }
  };

  const isUpscaling = () => {
    if (settings.mode === "percentage") return settings.percentage > 100;
    if (settings.mode === "presets") return settings.presetWidth > sampleOriginalWidth || settings.presetHeight > sampleOriginalHeight;
    return settings.targetWidth > sampleOriginalWidth || settings.targetHeight > sampleOriginalHeight;
  };

  return (
    <div className="bg-card-inner rounded-2xl border border-border-main p-5 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-main/60 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-green-primary" />
          <h4 className="font-extrabold text-sm text-text-main">Configuração de Redimensionamento</h4>
        </div>

        {isUpscaling() && (
          <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold bg-amber-950/40 px-2.5 py-1 rounded-lg border border-amber-800/40">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Aumentar a imagem pode reduzir a nitidez.</span>
          </div>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-3 gap-2 p-1 bg-bg-sec rounded-xl border border-border-main text-xs font-extrabold">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ ...settings, mode: "pixels" })}
          className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${
            settings.mode === "pixels"
              ? "bg-green-primary text-white shadow-sm"
              : "text-text-sec hover:text-text-main"
          }`}
        >
          Pixels (px)
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ ...settings, mode: "percentage" })}
          className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${
            settings.mode === "percentage"
              ? "bg-green-primary text-white shadow-sm"
              : "text-text-sec hover:text-text-main"
          }`}
        >
          Porcentagem (%)
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange({ ...settings, mode: "presets" })}
          className={`py-2 px-3 rounded-lg transition-all cursor-pointer ${
            settings.mode === "presets"
              ? "bg-green-primary text-white shadow-sm"
              : "text-text-sec hover:text-text-main"
          }`}
        >
          Tamanhos Prontos
        </button>
      </div>

      {/* MODE A: PIXELS */}
      {settings.mode === "pixels" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-text-sec">Largura (px)</label>
              <input
                type="number"
                min="1"
                max="10000"
                disabled={disabled}
                value={settings.targetWidth}
                onChange={(e) => handleWidthChange(Number(e.target.value))}
                className="w-full bg-bg-sec border border-border-main rounded-xl px-3.5 py-2.5 text-sm font-bold text-text-main focus:outline-none focus:border-green-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-text-sec">Altura (px)</label>
              <input
                type="number"
                min="1"
                max="10000"
                disabled={disabled}
                value={settings.targetHeight}
                onChange={(e) => handleHeightChange(Number(e.target.value))}
                className="w-full bg-bg-sec border border-border-main rounded-xl px-3.5 py-2.5 text-sm font-bold text-text-main focus:outline-none focus:border-green-primary"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...settings, keepAspectRatio: !settings.keepAspectRatio })}
              className={`py-2 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                settings.keepAspectRatio
                  ? "bg-green-primary/10 border-green-primary text-green-primary"
                  : "bg-bg-sec border-border-main text-text-muted hover:text-text-main"
              }`}
            >
              {settings.keepAspectRatio ? (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Manter Proporção (Ativado)</span>
                </>
              ) : (
                <>
                  <Unlock className="h-4 w-4" />
                  <span>Proporção Livre (Desativado)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* MODE B: PORCENTAGEM */}
      {settings.mode === "percentage" && (
        <div className="space-y-3">
          <label className="text-xs font-extrabold text-text-sec uppercase tracking-wider block">
            Escolha a Porcentagem do Tamanho Original
          </label>
          <div className="flex flex-wrap gap-2">
            {PERCENTAGE_OPTIONS.map((pct) => (
              <button
                key={pct}
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...settings, percentage: pct })}
                className={`py-2 px-4 rounded-xl border text-xs font-extrabold transition-all cursor-pointer ${
                  settings.percentage === pct
                    ? "bg-green-primary border-green-primary text-white shadow-sm"
                    : "bg-bg-sec border-border-main text-text-sec hover:border-green-primary/50 hover:text-text-main"
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          <div className="pt-2 flex items-center gap-3">
            <span className="text-xs font-bold text-text-sec">Personalizado:</span>
            <input
              type="number"
              min="5"
              max="500"
              disabled={disabled}
              value={settings.percentage}
              onChange={(e) => onChange({ ...settings, percentage: Math.max(1, Number(e.target.value)) })}
              className="w-28 bg-bg-sec border border-border-main rounded-xl px-3 py-1.5 text-xs font-extrabold text-text-main focus:outline-none focus:border-green-primary"
            />
            <span className="text-xs font-extrabold text-green-primary">%</span>
          </div>
        </div>
      )}

      {/* MODE C: TAMANHOS PRONTOS (PRESETS) */}
      {settings.mode === "presets" && (
        <div className="space-y-3">
          <label className="text-xs font-extrabold text-text-sec uppercase tracking-wider block">
            Selecione um Formato Pré-definido
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {RESIZE_PRESETS.map((preset) => {
              const isSelected = settings.presetId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handlePresetSelect(preset.id)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                    isSelected
                      ? "bg-green-primary/10 border-green-primary text-green-primary shadow-sm"
                      : "bg-bg-sec border-border-main text-text-sec hover:border-green-primary/50 hover:text-text-main"
                  }`}
                >
                  <span className="font-extrabold text-xs">{preset.name}</span>
                  <span className="text-[10px] text-text-muted font-semibold">{preset.category}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* FIT MODE & BACKGROUND OPTIONS */}
      <div className="border-t border-border-main/60 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fit Mode */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold text-text-sec flex items-center gap-1.5">
            <Maximize2 className="h-3.5 w-3.5 text-green-primary" />
            <span>Modo de Enquadramento</span>
          </label>

          <select
            disabled={disabled}
            value={settings.fitMode}
            onChange={(e) => onChange({ ...settings, fitMode: e.target.value as FitMode })}
            className="w-full bg-bg-sec border border-border-main rounded-xl px-3 py-2 text-xs font-bold text-text-main focus:outline-none focus:border-green-primary cursor-pointer"
          >
            <option value="contain">Conter imagem inteira (Sem cortes)</option>
            <option value="cover">Preencher área (Preenche sem bordas vazias)</option>
            <option value="stretch">Esticar (Pode deformar)</option>
          </select>

          {settings.fitMode === "stretch" && (
            <p className="text-[11px] font-bold text-amber-400">
              * Nota: Essa opção pode deformar a proporção original da imagem.
            </p>
          )}
        </div>

        {/* Background Color */}
        <div className="space-y-2">
          <label className="text-xs font-extrabold text-text-sec flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5 text-green-primary" />
            <span>Fundo para Espaços Vazios</span>
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...settings, bgColor: "transparent" })}
              className={`py-1.5 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                settings.bgColor === "transparent"
                  ? "bg-green-primary border-green-primary text-white"
                  : "bg-bg-sec border-border-main text-text-sec"
              }`}
            >
              Transparente
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...settings, bgColor: "white" })}
              className={`py-1.5 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                settings.bgColor === "white"
                  ? "bg-green-primary border-green-primary text-white"
                  : "bg-bg-sec border-border-main text-text-sec"
              }`}
            >
              Branco
            </button>

            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...settings, bgColor: "black" })}
              className={`py-1.5 px-3 rounded-xl border text-xs font-bold cursor-pointer ${
                settings.bgColor === "black"
                  ? "bg-green-primary border-green-primary text-white"
                  : "bg-bg-sec border-border-main text-text-sec"
              }`}
            >
              Preto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
