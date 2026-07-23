import React from "react";
import { Image, Sliders, Maximize2, Scissors } from "lucide-react";

interface ImageToolSwitcherProps {
  activeTool: "converter" | "comprimir" | "redimensionar" | "cortar";
  onNavigate?: (path: string) => void;
}

export default function ImageToolSwitcher({ activeTool, onNavigate }: ImageToolSwitcherProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 max-w-4xl mx-auto mb-6">
      {/* 1. Conversor */}
      <button
        type="button"
        onClick={() => onNavigate?.("/imagem/converter")}
        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-left ${
          activeTool === "converter"
            ? "bg-green-primary border-green-primary text-bg-main shadow-lg shadow-green-primary/20"
            : "bg-card-inner border-border-main text-text-sec hover:border-green-primary/50 hover:text-text-main group"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-2 rounded-xl border shrink-0 ${
              activeTool === "converter"
                ? "bg-bg-main text-green-primary border-green-primary/30"
                : "bg-card-main border-border-main text-green-primary group-hover:scale-105 transition-transform"
            }`}
          >
            <Image className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h4 className="font-extrabold text-xs uppercase tracking-wider truncate">Conversor</h4>
              {activeTool === "converter" && (
                <span className="text-[8px] font-black uppercase bg-bg-main text-green-primary px-1.5 py-0.2 rounded-full shrink-0">
                  Ativo
                </span>
              )}
            </div>
            <p className={`text-[10px] font-medium truncate ${activeTool === "converter" ? "text-bg-main/80 font-bold" : "text-text-muted"}`}>
              Formatos de foto
            </p>
          </div>
        </div>
      </button>

      {/* 2. Compressor */}
      <button
        type="button"
        onClick={() => onNavigate?.("/imagem/comprimir")}
        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-left ${
          activeTool === "comprimir"
            ? "bg-green-primary border-green-primary text-bg-main shadow-lg shadow-green-primary/20"
            : "bg-card-inner border-border-main text-text-sec hover:border-green-primary/50 hover:text-text-main group"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-2 rounded-xl border shrink-0 ${
              activeTool === "comprimir"
                ? "bg-bg-main text-green-primary border-green-primary/30"
                : "bg-card-main border-border-main text-green-primary group-hover:scale-105 transition-transform"
            }`}
          >
            <Sliders className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h4 className="font-extrabold text-xs uppercase tracking-wider truncate">Compressor</h4>
              {activeTool === "comprimir" && (
                <span className="text-[8px] font-black uppercase bg-bg-main text-green-primary px-1.5 py-0.2 rounded-full shrink-0">
                  Ativo
                </span>
              )}
            </div>
            <p className={`text-[10px] font-medium truncate ${activeTool === "comprimir" ? "text-bg-main/80 font-bold" : "text-text-muted"}`}>
              Reduzir KB/MB
            </p>
          </div>
        </div>
      </button>

      {/* 3. Redimensionador */}
      <button
        type="button"
        onClick={() => onNavigate?.("/imagem/redimensionar")}
        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-left ${
          activeTool === "redimensionar"
            ? "bg-green-primary border-green-primary text-bg-main shadow-lg shadow-green-primary/20"
            : "bg-card-inner border-border-main text-text-sec hover:border-green-primary/50 hover:text-text-main group"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-2 rounded-xl border shrink-0 ${
              activeTool === "redimensionar"
                ? "bg-bg-main text-green-primary border-green-primary/30"
                : "bg-card-main border-border-main text-green-primary group-hover:scale-105 transition-transform"
            }`}
          >
            <Maximize2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h4 className="font-extrabold text-xs uppercase tracking-wider truncate">Redimensionar</h4>
              {activeTool === "redimensionar" && (
                <span className="text-[8px] font-black uppercase bg-bg-main text-green-primary px-1.5 py-0.2 rounded-full shrink-0">
                  Ativo
                </span>
              )}
            </div>
            <p className={`text-[10px] font-medium truncate ${activeTool === "redimensionar" ? "text-bg-main/80 font-bold" : "text-text-muted"}`}>
              Pixels, % e Presets
            </p>
          </div>
        </div>
      </button>

      {/* 4. Cortar */}
      <button
        type="button"
        onClick={() => onNavigate?.("/imagem/cortar")}
        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2 text-left ${
          activeTool === "cortar"
            ? "bg-green-primary border-green-primary text-bg-main shadow-lg shadow-green-primary/20"
            : "bg-card-inner border-border-main text-text-sec hover:border-green-primary/50 hover:text-text-main group"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`p-2 rounded-xl border shrink-0 ${
              activeTool === "cortar"
                ? "bg-bg-main text-green-primary border-green-primary/30"
                : "bg-card-main border-border-main text-green-primary group-hover:scale-105 transition-transform"
            }`}
          >
            <Scissors className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h4 className="font-extrabold text-xs uppercase tracking-wider truncate">Cortar</h4>
              {activeTool === "cortar" && (
                <span className="text-[8px] font-black uppercase bg-bg-main text-green-primary px-1.5 py-0.2 rounded-full shrink-0">
                  Ativo
                </span>
              )}
            </div>
            <p className={`text-[10px] font-medium truncate ${activeTool === "cortar" ? "text-bg-main/80 font-bold" : "text-text-muted"}`}>
              Pacote e Presets
            </p>
          </div>
        </div>
      </button>
    </div>
  );
}
