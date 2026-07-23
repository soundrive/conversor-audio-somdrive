import React, { useEffect, useState } from "react";
import { Settings, Check, HelpCircle, Palette } from "lucide-react";
import { detectSupportedOutputFormats, SupportedFormats } from "../../utils/imageFormatSupport";

export type OutputFormatType = "JPG" | "PNG" | "WEBP" | "AVIF" | "BMP";
export type QualityPreset = "Máxima" | "Alta" | "Média" | "Econômica";

export interface ImageSettingsState {
  outputFormat: OutputFormatType;
  qualityPreset: QualityPreset;
  qualityValue: number;
  backgroundColor: string;
}

interface ImageSettingsProps {
  settings: ImageSettingsState;
  onChange: (newSettings: ImageSettingsState) => void;
  disabled?: boolean;
}

const QUALITY_PRESETS: { label: QualityPreset; value: number; desc: string }[] = [
  { label: "Máxima", value: 0.95, desc: "Qualidade quase perfeita, arquivo maior" },
  { label: "Alta", value: 0.85, desc: "Excelente equilíbrio (Recomendado)" },
  { label: "Média", value: 0.75, desc: "Boa qualidade, arquivo menor" },
  { label: "Econômica", value: 0.60, desc: "Máxima compressão" }
];

export default function ImageSettings({ settings, onChange, disabled }: ImageSettingsProps) {
  const [supportedFormats, setSupportedFormats] = useState<SupportedFormats>({
    jpeg: true,
    png: true,
    webp: true,
    avif: false,
    bmp: false
  });

  useEffect(() => {
    setSupportedFormats(detectSupportedOutputFormats());
  }, []);

  const handleFormatChange = (fmt: OutputFormatType) => {
    onChange({
      ...settings,
      outputFormat: fmt
    });
  };

  const handleQualityChange = (preset: QualityPreset, val: number) => {
    onChange({
      ...settings,
      qualityPreset: preset,
      qualityValue: val
    });
  };

  const handleBgColorChange = (color: string) => {
    onChange({
      ...settings,
      backgroundColor: color
    });
  };

  const isLossyFormat = settings.outputFormat === "JPG" || settings.outputFormat === "WEBP" || settings.outputFormat === "AVIF";
  const needsBgColor = settings.outputFormat === "JPG" || settings.outputFormat === "BMP";

  return (
    <div className="bg-card-inner rounded-2xl border border-border-main p-5 space-y-6">
      <div className="flex items-center gap-2 border-b border-border-main/60 pb-3">
        <Settings className="h-4 w-4 text-green-primary" />
        <h4 className="font-extrabold text-sm text-text-main">Configurações de Saída</h4>
      </div>

      {/* Format Selection */}
      <div className="space-y-2.5">
        <label className="text-xs font-extrabold text-text-sec uppercase tracking-wider block">
          Formato de Saída (Para todas as imagens)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          {(["PNG", "JPG", "WEBP", "AVIF", "BMP"] as OutputFormatType[]).map((fmt) => {
            const isSupported =
              fmt === "JPG"
                ? supportedFormats.jpeg
                : fmt === "PNG"
                ? supportedFormats.png
                : fmt === "WEBP"
                ? supportedFormats.webp
                : fmt === "AVIF"
                ? supportedFormats.avif
                : supportedFormats.bmp;

            const isSelected = settings.outputFormat === fmt;

            return (
              <button
                key={fmt}
                type="button"
                disabled={disabled || !isSupported}
                onClick={() => handleFormatChange(fmt)}
                className={`py-3 px-3 rounded-xl font-extrabold text-xs transition-all flex flex-col items-center justify-center gap-1 border ${
                  isSelected
                    ? "bg-green-primary border-green-primary text-white shadow-md shadow-emerald-950/20"
                    : isSupported
                    ? "bg-bg-sec border-border-main text-text-sec hover:border-green-primary/50 hover:text-text-main"
                    : "bg-bg-sec/40 border-border-main/40 text-text-muted/40 cursor-not-allowed opacity-60"
                }`}
              >
                <div className="flex items-center gap-1">
                  <span>{fmt}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                </div>
                {!isSupported && (
                  <span className="text-[9px] font-medium text-amber-400/80">Sem suporte</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quality Settings (only for lossy formats) */}
      {isLossyFormat && (
        <div className="space-y-2.5 border-t border-border-main/40 pt-4">
          <label className="text-xs font-extrabold text-text-sec uppercase tracking-wider block">
            Qualidade da Imagem ({settings.outputFormat})
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {QUALITY_PRESETS.map((q) => {
              const isSelected = settings.qualityPreset === q.label;
              return (
                <button
                  key={q.label}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleQualityChange(q.label, q.value)}
                  className={`py-2.5 px-3 rounded-xl font-bold text-xs transition-all border text-left ${
                    isSelected
                      ? "bg-green-primary/10 border-green-primary text-green-primary"
                      : "bg-bg-sec border-border-main text-text-sec hover:border-border-main/80"
                  }`}
                >
                  <div className="font-extrabold flex items-center justify-between">
                    <span>{q.label}</span>
                    {isSelected && <span className="text-[10px] bg-green-primary text-white px-1.5 py-0.2 rounded-full">✓</span>}
                  </div>
                  <span className="text-[10px] text-text-muted font-normal block truncate mt-0.5">{q.desc}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PNG Notice */}
      {settings.outputFormat === "PNG" && (
        <div className="text-[11px] text-text-muted font-semibold bg-bg-sec/50 p-3 rounded-xl border border-border-main/50">
          * O formato <strong>PNG</strong> preserva a qualidade original sem perdas e mantém áreas transparentes da imagem.
        </div>
      )}

      {/* Background Color for JPG / BMP */}
      {needsBgColor && (
        <div className="space-y-2.5 border-t border-border-main/40 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-extrabold text-text-sec uppercase tracking-wider block">
              Fundo da Imagem (Para transparências)
            </label>
            <span className="text-[10px] text-text-muted font-medium">O formato {settings.outputFormat} não suporta transparência</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {[
              { label: "Branco", color: "#FFFFFF" },
              { label: "Preto", color: "#000000" }
            ].map((bg) => {
              const isSelected = settings.backgroundColor.toUpperCase() === bg.color;
              return (
                <button
                  key={bg.label}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleBgColorChange(bg.color)}
                  className={`py-2 px-4 rounded-xl text-xs font-extrabold flex items-center gap-2 border transition-all ${
                    isSelected
                      ? "bg-green-primary/10 border-green-primary text-green-primary"
                      : "bg-bg-sec border-border-main text-text-sec hover:border-border-main/80"
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full border border-slate-600 inline-block shrink-0"
                    style={{ backgroundColor: bg.color }}
                  />
                  <span>{bg.label}</span>
                </button>
              );
            })}

            {/* Custom Color Input */}
            <div className="flex items-center gap-2 bg-bg-sec border border-border-main px-3 py-1.5 rounded-xl">
              <Palette className="h-3.5 w-3.5 text-text-muted shrink-0" />
              <span className="text-xs font-extrabold text-text-sec">Personalizada:</span>
              <input
                type="color"
                disabled={disabled}
                value={settings.backgroundColor}
                onChange={(e) => handleBgColorChange(e.target.value)}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
