import React from "react";
import {
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crosshair,
  Shield,
  Square,
  Circle,
  RefreshCw,
  Palette
} from "lucide-react";
import { CropShape, FocalPoint } from "../../../utils/imageCropPresets";

interface ImageCropToolbarProps {
  rotation: number; // 0, 90, 180, 270
  onRotateLeft: () => void;
  onRotateRight: () => void;
  flipH: boolean;
  flipV: boolean;
  onToggleFlipH: () => void;
  onToggleFlipV: () => void;

  focalPointActive: boolean;
  onToggleFocalPoint: () => void;
  focalPoint: FocalPoint | null;
  onClearFocalPoint: () => void;

  safeAreaActive: boolean;
  onToggleSafeArea: () => void;

  shape: CropShape;
  onChangeShape: (s: CropShape) => void;

  backgroundColor: string;
  onChangeBackgroundColor: (bg: string) => void;

  onReset: () => void;
}

export default function ImageCropToolbar({
  rotation,
  onRotateLeft,
  onRotateRight,
  flipH,
  flipV,
  onToggleFlipH,
  onToggleFlipV,
  focalPointActive,
  onToggleFocalPoint,
  focalPoint,
  onClearFocalPoint,
  safeAreaActive,
  onToggleSafeArea,
  shape,
  onChangeShape,
  backgroundColor,
  onChangeBackgroundColor,
  onReset
}: ImageCropToolbarProps) {
  return (
    <div className="bg-card-main border border-border-main p-3 md:p-4 rounded-2xl space-y-3 shadow-sm">
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-bold text-text-sec">
        
        {/* Left Group: Transforms */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-text-muted uppercase tracking-wider font-extrabold mr-1 hidden sm:inline">
            Ajustes:
          </span>

          <button
            type="button"
            onClick={onRotateLeft}
            title="Girar 90° para esquerda"
            className="p-2 rounded-xl bg-card-inner border border-border-main hover:border-green-primary/50 text-text-sec hover:text-green-light transition-all cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="text-[10px] hidden md:inline">Girar -90°</span>
          </button>

          <button
            type="button"
            onClick={onRotateRight}
            title="Girar 90° para direita"
            className="p-2 rounded-xl bg-card-inner border border-border-main hover:border-green-primary/50 text-text-sec hover:text-green-light transition-all cursor-pointer flex items-center gap-1"
          >
            <RotateCw className="h-4 w-4" />
            <span className="text-[10px] hidden md:inline">Girar +90°</span>
          </button>

          <button
            type="button"
            onClick={onToggleFlipH}
            title="Espelhar horizontalmente"
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1 ${
              flipH
                ? "bg-green-primary/10 border-green-primary/50 text-green-primary"
                : "bg-card-inner border-border-main text-text-sec hover:text-green-light"
            }`}
          >
            <FlipHorizontal className="h-4 w-4" />
            <span className="text-[10px] hidden md:inline">Espelhar H</span>
          </button>

          <button
            type="button"
            onClick={onToggleFlipV}
            title="Espelhar verticalmente"
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1 ${
              flipV
                ? "bg-green-primary/10 border-green-primary/50 text-green-primary"
                : "bg-card-inner border-border-main text-text-sec hover:text-green-light"
            }`}
          >
            <FlipVertical className="h-4 w-4" />
            <span className="text-[10px] hidden md:inline">Espelhar V</span>
          </button>
        </div>

        {/* Center Group: Focal Point & Safe Area */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={onToggleFocalPoint}
            title="Definir Ponto Principal (clique na área de interesse)"
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
              focalPointActive || focalPoint
                ? "bg-green-primary border-green-primary text-bg-main font-extrabold shadow-sm"
                : "bg-card-inner border-border-main text-text-sec hover:border-green-primary/50 hover:text-text-main"
            }`}
          >
            <Crosshair className="h-4 w-4" />
            <span className="text-[11px]">
              {focalPoint ? "Ponto Definido" : "Definir Ponto Principal"}
            </span>
          </button>

          {focalPoint && (
            <button
              type="button"
              onClick={onClearFocalPoint}
              title="Remover ponto principal"
              className="px-2 py-1 text-[10px] font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
            >
              Remover Ponto
            </button>
          )}

          <button
            type="button"
            onClick={onToggleSafeArea}
            title="Mostrar áreas seguras e linhas-guia"
            className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
              safeAreaActive
                ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 font-extrabold"
                : "bg-card-inner border-border-main text-text-sec hover:border-green-primary/50 hover:text-text-main"
            }`}
          >
            <Shield className="h-4 w-4" />
            <span className="text-[11px]">Área Segura</span>
          </button>
        </div>

        {/* Right Group: Shape & Reset */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Shape Picker */}
          <div className="flex items-center p-1 bg-card-inner border border-border-main rounded-xl gap-0.5">
            <button
              type="button"
              onClick={() => onChangeShape("rect")}
              title="Forma Retangular / Quadrada"
              className={`p-1.5 rounded-lg transition-all ${
                shape === "rect" ? "bg-green-primary text-bg-main" : "text-text-muted hover:text-text-main"
              }`}
            >
              <Square className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangeShape("circle")}
              title="Forma Circular"
              className={`p-1.5 rounded-lg transition-all ${
                shape === "circle" ? "bg-green-primary text-bg-main" : "text-text-muted hover:text-text-main"
              }`}
            >
              <Circle className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Background selector if shape is non-rect or transparent */}
          {shape === "circle" && (
            <div className="flex items-center gap-1.5 bg-card-inner border border-border-main px-2 py-1 rounded-xl text-[10px]">
              <Palette className="h-3.5 w-3.5 text-green-primary" />
              <span className="text-text-muted">Fundo:</span>
              <select
                value={backgroundColor}
                onChange={(e) => onChangeBackgroundColor(e.target.value)}
                className="bg-transparent text-text-main font-bold focus:outline-none cursor-pointer"
              >
                <option value="transparent" className="bg-bg-main text-text-main">Transparente</option>
                <option value="#ffffff" className="bg-bg-main text-text-main">Branco</option>
                <option value="#000000" className="bg-bg-main text-text-main">Preto</option>
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={onReset}
            title="Redefinir todos os ajustes"
            className="p-2 rounded-xl bg-card-inner border border-border-main hover:border-red-500/50 text-text-sec hover:text-red-400 transition-all cursor-pointer flex items-center gap-1 text-[11px] font-bold"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Redefinir</span>
          </button>
        </div>

      </div>
    </div>
  );
}
