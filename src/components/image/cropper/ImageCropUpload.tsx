import React, { useRef } from "react";
import { Upload, FileImage, ShieldCheck, AlertCircle } from "lucide-react";

interface ImageCropUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
  error?: string | null;
}

export default function ImageCropUpload({
  onFileSelect,
  disabled = false,
  error = null
}: ImageCropUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith("image/")) {
        onFileSelect(file);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-[28px] p-8 md:p-12 text-center transition-all cursor-pointer relative overflow-hidden group ${
          disabled
            ? "opacity-50 pointer-events-none border-border-main bg-card-main"
            : "border-border-main hover:border-green-primary bg-card-main hover:bg-card-inner/60 shadow-sm hover:shadow-lg"
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleInputChange}
          accept="image/jpeg,image/jpg,image/png,image/webp,image/avif,image/bmp"
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-[#303943] rounded-2xl border border-border-main text-green-primary group-hover:scale-110 transition-transform shadow-inner">
            <Upload className="h-8 w-8" />
          </div>

          <div>
            <h3 className="font-display text-xl md:text-2xl font-extrabold text-text-main group-hover:text-green-light transition-colors">
              Arraste e solte sua imagem aqui
            </h3>
            <p className="text-xs md:text-sm text-text-sec mt-1.5 font-semibold">
              ou clique para selecionar do computador ou celular
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center text-[11px] font-bold text-text-muted pt-2">
            <span className="px-2.5 py-1 rounded-full bg-card-inner border border-border-main flex items-center gap-1">
              <FileImage className="h-3.5 w-3.5 text-green-primary" />
              JPG, PNG, WEBP, AVIF e BMP
            </span>
            <span className="px-2.5 py-1 rounded-full bg-card-inner border border-border-main">
              Até 25 MB
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-text-muted px-2 font-semibold">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 text-green-primary" />
          Seus arquivos são processados localmente e não ficam salvos.
        </span>
      </div>
    </div>
  );
}
