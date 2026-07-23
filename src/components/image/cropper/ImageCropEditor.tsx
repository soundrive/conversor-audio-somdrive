import React, { useRef, useEffect, useState, useCallback } from "react";
import { CropRegion, FocalPoint, CropShape } from "../../../utils/imageCropPresets";
import { Crosshair, Move, ZoomIn, ZoomOut } from "lucide-react";

interface ImageCropEditorProps {
  imageSrc: string;
  imgWidth: number;
  imgHeight: number;

  crop: CropRegion;
  onChangeCrop: (c: CropRegion) => void;

  focalPoint: FocalPoint | null;
  onSetFocalPoint: (fp: FocalPoint) => void;
  focalPointModeActive: boolean;

  safeAreaActive: boolean;
  shape: CropShape;

  rotation: number;
  flipH: boolean;
  flipV: boolean;

  aspectRatio?: number; // width / height constraint if set
}

type DragMode = "none" | "move" | "handle-tl" | "handle-tr" | "handle-bl" | "handle-br" | "handle-t" | "handle-b" | "handle-l" | "handle-r";

export default function ImageCropEditor({
  imageSrc,
  imgWidth,
  imgHeight,
  crop,
  onChangeCrop,
  focalPoint,
  onSetFocalPoint,
  focalPointModeActive,
  safeAreaActive,
  shape,
  rotation,
  flipH,
  flipV,
  aspectRatio
}: ImageCropEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>("none");
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialCrop, setInitialCrop] = useState<CropRegion>(crop);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Calculate container display scale factor
  const [displayScale, setDisplayScale] = useState<number>(1);

  const updateDisplayScale = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const scaleX = rect.width / imgWidth;
      const scaleY = 500 / imgHeight; // cap max height
      const scale = Math.min(scaleX, scaleY, 1);
      setDisplayScale(scale > 0 ? scale : 1);
    }
  }, [imgWidth, imgHeight]);

  useEffect(() => {
    updateDisplayScale();
    window.addEventListener("resize", updateDisplayScale);
    return () => window.removeEventListener("resize", updateDisplayScale);
  }, [updateDisplayScale]);

  // Convert image coords to container px coords
  const imgToDispX = (x: number) => x * displayScale;
  const imgToDispY = (y: number) => y * displayScale;
  const dispToImgX = (x: number) => x / displayScale;
  const dispToImgY = (y: number) => y / displayScale;

  // Handle Mouse / Touch down on editor container or handles
  const handlePointerDown = (e: React.PointerEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();

    if (focalPointModeActive) {
      // Set focal point on click!
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const imgX = dispToImgX(clickX);
      const imgY = dispToImgY(clickY);

      const xPct = Math.max(0, Math.min(100, (imgX / imgWidth) * 100));
      const yPct = Math.max(0, Math.min(100, (imgY / imgHeight) * 100));

      onSetFocalPoint({ xPct, yPct });
      return;
    }

    setDragMode(mode);
    setDragStart({ x: e.clientX, y: e.clientY });
    setInitialCrop({ ...crop });

    if ((e.target as HTMLElement).setPointerCapture) {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragMode === "none") return;
    e.preventDefault();

    const dx = dispToImgX(e.clientX - dragStart.x);
    const dy = dispToImgY(e.clientY - dragStart.y);

    let newX = initialCrop.x;
    let newY = initialCrop.y;
    let newW = initialCrop.width;
    let newH = initialCrop.height;

    const minSize = 20;

    if (dragMode === "move") {
      newX = Math.max(0, Math.min(imgWidth - initialCrop.width, initialCrop.x + dx));
      newY = Math.max(0, Math.min(imgHeight - initialCrop.height, initialCrop.y + dy));
    } else if (dragMode === "handle-br") {
      newW = Math.max(minSize, Math.min(imgWidth - initialCrop.x, initialCrop.width + dx));
      if (aspectRatio) {
        newH = newW / aspectRatio;
      } else {
        newH = Math.max(minSize, Math.min(imgHeight - initialCrop.y, initialCrop.height + dy));
      }
    } else if (dragMode === "handle-bl") {
      const maxW = initialCrop.x + initialCrop.width;
      newW = Math.max(minSize, Math.min(maxW, initialCrop.width - dx));
      newX = initialCrop.x + (initialCrop.width - newW);
      if (aspectRatio) {
        newH = newW / aspectRatio;
      } else {
        newH = Math.max(minSize, Math.min(imgHeight - initialCrop.y, initialCrop.height + dy));
      }
    } else if (dragMode === "handle-tr") {
      newW = Math.max(minSize, Math.min(imgWidth - initialCrop.x, initialCrop.width + dx));
      if (aspectRatio) {
        newH = newW / aspectRatio;
        newY = initialCrop.y + (initialCrop.height - newH);
      } else {
        const maxH = initialCrop.y + initialCrop.height;
        newH = Math.max(minSize, Math.min(maxH, initialCrop.height - dy));
        newY = initialCrop.y + (initialCrop.height - newH);
      }
    } else if (dragMode === "handle-tl") {
      const maxW = initialCrop.x + initialCrop.width;
      newW = Math.max(minSize, Math.min(maxW, initialCrop.width - dx));
      newX = initialCrop.x + (initialCrop.width - newW);
      if (aspectRatio) {
        newH = newW / aspectRatio;
        newY = initialCrop.y + (initialCrop.height - newH);
      } else {
        const maxH = initialCrop.y + initialCrop.height;
        newH = Math.max(minSize, Math.min(maxH, initialCrop.height - dy));
        newY = initialCrop.y + (initialCrop.height - newH);
      }
    }

    // Clamp within image bounds
    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX + newW > imgWidth) newW = imgWidth - newX;
    if (newY + newH > imgHeight) newH = imgHeight - newY;

    onChangeCrop({
      x: Math.round(newX),
      y: Math.round(newY),
      width: Math.round(newW),
      height: Math.round(newH)
    });
  };

  const handlePointerUp = () => {
    setDragMode("none");
  };

  // Display dimensions
  const dispW = imgToDispX(imgWidth);
  const dispH = imgToDispY(imgHeight);

  const cropDispX = imgToDispX(crop.x);
  const cropDispY = imgToDispY(crop.y);
  const cropDispW = imgToDispX(crop.width);
  const cropDispH = imgToDispY(crop.height);

  return (
    <div className="space-y-2">
      
      {/* Editor Container */}
      <div className="relative bg-[#1A2027] border border-border-main rounded-2xl overflow-hidden flex items-center justify-center min-h-[350px] p-4 select-none touch-none">
        <div
          ref={containerRef}
          style={{ width: dispW, height: dispH }}
          className={`relative overflow-hidden shadow-2xl rounded-lg ${
            focalPointModeActive ? "cursor-crosshair" : "cursor-default"
          }`}
          onPointerDown={(e) => handlePointerDown(e, "none")}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
          {/* Base Image */}
          <img
            src={imageSrc}
            alt="Original"
            style={{
              width: dispW,
              height: dispH,
              transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`
            }}
            className="absolute inset-0 object-contain pointer-events-none"
          />

          {/* Dark Overlay Outside Crop Area */}
          <div
            className="absolute inset-0 bg-black/60 pointer-events-none"
            style={{
              clipPath: `polygon(
                0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                ${cropDispX}px ${cropDispY}px,
                ${cropDispX}px ${cropDispY + cropDispH}px,
                ${cropDispX + cropDispW}px ${cropDispY + cropDispH}px,
                ${cropDispX + cropDispW}px ${cropDispY}px,
                ${cropDispX}px ${cropDispY}px
              )`
            }}
          />

          {/* Active Crop Box */}
          <div
            style={{
              left: cropDispX,
              top: cropDispY,
              width: cropDispW,
              height: cropDispH
            }}
            className={`absolute border-2 border-green-primary shadow-lg ${
              shape === "circle" ? "rounded-full" : "rounded-sm"
            } cursor-move`}
            onPointerDown={(e) => handlePointerDown(e, "move")}
          >
            {/* Rule of Thirds Grid Lines */}
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none border border-green-primary/30 opacity-60">
              <div className="border-r border-b border-green-primary/30" />
              <div className="border-r border-b border-green-primary/30" />
              <div className="border-b border-green-primary/30" />
              <div className="border-r border-b border-green-primary/30" />
              <div className="border-r border-b border-green-primary/30" />
              <div className="border-b border-green-primary/30" />
              <div className="border-r border-green-primary/30" />
              <div className="border-r border-green-primary/30" />
              <div />
            </div>

            {/* Safe Area Overlays if active */}
            {safeAreaActive && (
              <>
                {/* Center Safe Area */}
                <div className="absolute inset-[15%] border border-dashed border-amber-400/70 pointer-events-none rounded-sm flex items-center justify-center">
                  <span className="text-[9px] font-mono text-amber-300 bg-black/60 px-1 rounded">Área Central</span>
                </div>
                {/* Profile Circle Guide */}
                <div className="absolute inset-0 border border-emerald-400/40 rounded-full pointer-events-none" />
              </>
            )}

            {/* Dimension Badge */}
            <div className="absolute -top-7 left-0 bg-bg-main/90 border border-border-main text-green-primary text-[10px] font-mono font-extrabold px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap">
              {crop.width} × {crop.height} px
            </div>

            {/* Resize Handles */}
            {!focalPointModeActive && (
              <>
                {/* Top Left */}
                <div
                  className="absolute -top-2 -left-2 w-4 h-4 bg-green-primary border-2 border-bg-main rounded-full cursor-nwse-resize shadow"
                  onPointerDown={(e) => handlePointerDown(e, "handle-tl")}
                />
                {/* Top Right */}
                <div
                  className="absolute -top-2 -right-2 w-4 h-4 bg-green-primary border-2 border-bg-main rounded-full cursor-nesw-resize shadow"
                  onPointerDown={(e) => handlePointerDown(e, "handle-tr")}
                />
                {/* Bottom Left */}
                <div
                  className="absolute -bottom-2 -left-2 w-4 h-4 bg-green-primary border-2 border-bg-main rounded-full cursor-nesw-resize shadow"
                  onPointerDown={(e) => handlePointerDown(e, "handle-bl")}
                />
                {/* Bottom Right */}
                <div
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-green-primary border-2 border-bg-main rounded-full cursor-nwse-resize shadow"
                  onPointerDown={(e) => handlePointerDown(e, "handle-br")}
                />
              </>
            )}
          </div>

          {/* Focal Point Indicator */}
          {focalPoint && (
            <div
              style={{
                left: `${focalPoint.xPct}%`,
                top: `${focalPoint.yPct}%`
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
            >
              <div className="relative flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-amber-400 bg-amber-400/20 animate-ping absolute" />
                <div className="w-6 h-6 rounded-full border-2 border-amber-300 bg-amber-500/40 flex items-center justify-center text-amber-300 shadow-lg">
                  <Crosshair className="h-4 w-4" />
                </div>
                <span className="absolute left-7 bg-amber-950/90 text-amber-300 border border-amber-500/40 text-[9px] font-extrabold px-1.5 py-0.5 rounded shadow whitespace-nowrap">
                  Ponto Principal
                </span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Mode / Instructions helper */}
      <div className="flex items-center justify-between text-[11px] text-text-muted font-semibold px-2">
        <span className="flex items-center gap-1">
          <Move className="h-3.5 w-3.5 text-green-primary" />
          {focalPointModeActive
            ? "Clique na imagem para posicionar o Ponto Principal."
            : "Arraste a caixa de seleção ou as pontas para ajustar o corte."}
        </span>
        <span className="font-mono">
          Origem: {imgWidth} × {imgHeight} px
        </span>
      </div>

    </div>
  );
}
