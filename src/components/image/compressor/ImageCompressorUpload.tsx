import React, { useRef, useState } from "react";
import { UploadCloud, Image as ImageIcon, AlertCircle } from "lucide-react";
import { ALLOWED_INPUT_IMAGE_TYPES, ALLOWED_INPUT_EXTENSIONS } from "../../../utils/imageFormatSupport";

interface ImageCompressorUploadProps {
  onFilesSelected: (files: File[]) => void;
  currentCount: number;
  currentTotalSize: number;
}

const MAX_IMAGES_COUNT = 50;
const MAX_SINGLE_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_TOTAL_SIZE = 300 * 1024 * 1024; // 300 MB

export default function ImageCompressorUpload({
  onFilesSelected,
  currentCount,
  currentTotalSize
}: ImageCompressorUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validateAndProcessFiles = (rawFiles: FileList | File[]) => {
    setErrorMessage(null);
    const filesArray = Array.from(rawFiles);

    if (filesArray.length === 0) return;

    if (currentCount + filesArray.length > MAX_IMAGES_COUNT) {
      setErrorMessage(`Você pode enviar no máximo ${MAX_IMAGES_COUNT} imagens por vez. (Já selecionadas: ${currentCount})`);
      return;
    }

    let addedSize = 0;
    const validFiles: File[] = [];

    for (const file of filesArray) {
      if (file.size === 0) {
        setErrorMessage(`O arquivo "${file.name}" está vazio (0 bytes).`);
        return;
      }

      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      const isTypeAllowed =
        ALLOWED_INPUT_IMAGE_TYPES.includes(file.type.toLowerCase()) || ALLOWED_INPUT_EXTENSIONS.includes(ext);

      if (!isTypeAllowed) {
        setErrorMessage(`O arquivo "${file.name}" não é uma imagem suportada (JPG, PNG, WEBP, AVIF ou BMP).`);
        return;
      }

      if (file.size > MAX_SINGLE_FILE_SIZE) {
        setErrorMessage(`A imagem "${file.name}" excede o limite de 25 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`);
        return;
      }

      addedSize += file.size;
      validFiles.push(file);
    }

    if (currentTotalSize + addedSize > MAX_TOTAL_SIZE) {
      setErrorMessage(`O tamanho total das imagens excede o limite de 300 MB.`);
      return;
    }

    onFilesSelected(validFiles);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3.5 bg-red-950/40 border border-red-900/60 rounded-xl text-red-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-8 md:p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center space-y-4 ${
          isDragging
            ? "border-green-primary bg-green-primary/10 scale-[1.01]"
            : "border-border-main bg-card-inner hover:border-green-primary/50 hover:bg-card-inner/80"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif,image/bmp,.jpg,.jpeg,.png,.webp,.avif,.bmp"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              validateAndProcessFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />

        <div className="p-4 bg-bg-sec rounded-2xl border border-border-main text-green-primary shadow-inner">
          <UploadCloud className="h-8 w-8" />
        </div>

        <div className="space-y-1.5 max-w-md">
          <h3 className="font-extrabold text-base md:text-lg text-text-main">
            Arraste suas imagens aqui ou <span className="text-green-primary underline decoration-2">clique para selecionar</span>
          </h3>
          <p className="text-xs text-text-muted font-semibold">
            Formatos aceitos: JPG, PNG, WEBP, AVIF e BMP
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-2 text-[11px] text-text-sec font-semibold pt-2">
          <span className="bg-bg-main/60 px-3 py-1 rounded-full border border-border-main/50">
            Até 50 imagens
          </span>
          <span className="bg-bg-main/60 px-3 py-1 rounded-full border border-border-main/50">
            Até 25 MB por imagem
          </span>
          <span className="bg-bg-main/60 px-3 py-1 rounded-full border border-border-main/50">
            Até 300 MB no total
          </span>
        </div>
      </div>
    </div>
  );
}
