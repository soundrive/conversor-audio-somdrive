import React from "react";
import { Sliders, Sparkles, Check } from "lucide-react";
import { CompressionPreset, COMPRESSION_PRESETS } from "../../../utils/imageCompressionLevels";

export interface CompressorSettingsState {
  preset: CompressionPreset;
  customQualityPercentage: number; // 10 to 100
}

interface ImageCompressorSettingsProps {
  settings: CompressorSettingsState;
  onChange: (newSettings: CompressorSettingsState) => void;
  disabled?: boolean;
}

export default function ImageCompressorSettings({
  settings,
  onChange,
  disabled
}: ImageCompressorSettingsProps) {
  const presetsList: CompressionPreset[] = ["maxima", "alta", "media", "economica", "personalizada"];

  const handlePresetSelect = (preset: CompressionPreset) => {
    onChange({
      ...settings,
      preset
    });
  };

  const handleSliderChange = (val: number) => {
    onChange({
      ...settings,
      customQualityPercentage: val
    });
  };

  return (
    <div className="bg-card-inner rounded-2xl border border-border-main p-5 space-y-6">
      <div className="flex items-center justify-between border-b border-border-main/60 pb-3">
        <div className="flex items-center gap-2">
          <Sliders className="h-4 w-4 text-green-primary" />
          <h4 className="font-extrabold text-sm text-text-main">Nível de Compressão</h4>
        </div>
        <span className="text-[11px] font-semibold text-text-muted">
          Preserva formato original e transparência
        </span>
      </div>

      {/* Preset Buttons Grid */}
      <div className="space-y-2.5">
        <label className="text-xs font-extrabold text-text-sec uppercase tracking-wider block">
          Modo de Compressão
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {presetsList.slice(0, 4).map((key) => {
            const config = COMPRESSION_PRESETS[key];
            const isSelected = settings.preset === key;

            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                onClick={() => handlePresetSelect(key)}
                className={`p-3.5 rounded-xl text-left border transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                  isSelected
                    ? "bg-green-primary/10 border-green-primary text-green-primary shadow-sm"
                    : "bg-bg-sec border-border-main text-text-sec hover:border-green-primary/50 hover:text-text-main"
                }`}
              >
                <div className="flex items-center justify-between font-extrabold text-xs">
                  <span>{config.label}</span>
                  {isSelected && <Check className="h-4 w-4 text-green-primary shrink-0" />}
                </div>

                <p className="text-[10px] text-text-muted font-normal leading-relaxed">
                  {config.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Quality Slider Button Toggle */}
      <div className="border-t border-border-main/40 pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handlePresetSelect("personalizada")}
            className={`py-2 px-3 rounded-xl border text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              settings.preset === "personalizada"
                ? "bg-green-primary border-green-primary text-white shadow-md shadow-emerald-950/20"
                : "bg-bg-sec border-border-main text-text-sec hover:border-green-primary/50 hover:text-text-main"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>Opção Avançada: Qualidade Personalizada</span>
          </button>

          {settings.preset === "personalizada" && (
            <span className="text-xs font-black text-green-primary">
              {settings.customQualityPercentage}%
            </span>
          )}
        </div>

        {/* Custom Slider Input */}
        {settings.preset === "personalizada" && (
          <div className="bg-bg-sec p-4 rounded-xl border border-border-main space-y-2.5">
            <div className="flex justify-between text-xs font-bold text-text-sec">
              <span>Menor arquivo (10%)</span>
              <span className="text-green-primary font-black">{settings.customQualityPercentage}% de qualidade</span>
              <span>Melhor qualidade (100%)</span>
            </div>

            <input
              type="range"
              min="10"
              max="100"
              step="1"
              disabled={disabled}
              value={settings.customQualityPercentage}
              onChange={(e) => handleSliderChange(Number(e.target.value))}
              className="w-full accent-green-primary cursor-pointer h-2 bg-card-inner rounded-lg"
            />

            <p className="text-[10px] text-text-muted font-medium text-center pt-1">
              * Nota: A porcentagem de qualidade ajusta a precisão de codificação visual e varia por imagem.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
