/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  Volume2, 
  Video, 
  FileText, 
  ShieldCheck, 
  ArrowRight, 
  Music, 
  Sparkles,
  Info
} from "lucide-react";
import { motion } from "motion/react";

interface HomeProps {
  onNavigate: (path: "audio" | "videoToAudio" | "pdf") => void;
}

export default function Home({ onNavigate }: HomeProps) {
  return (
    <div className="space-y-10 py-4">
      {/* Hero Welcome Banner */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-400"
        >
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          <span>Ferramentas Online Grátis</span>
        </motion.div>
        
        <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-slate-100" id="home-title">
          Conversor de Áudio e Ferramentas Online Grátis
        </h2>
        
        <p className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-xl mx-auto" id="home-subtitle">
          Converta arquivos de áudio, extraia o som de vídeos e organize documentos PDF de forma rápida, fácil e sem cadastro.
        </p>

        {/* Highlights Badges */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {[
            "Ferramentas gratuitas",
            "Conversão rápida",
            "Diversos formatos",
            "Sem necessidade de cadastro",
            "Baixe o resultado na hora",
            "Seus arquivos não ficam salvos"
          ].map((highlight, idx) => (
            <span key={idx} className="bg-slate-900 border border-slate-800 text-slate-300 text-[11px] font-semibold px-3 py-1 rounded-full">
              ✓ {highlight}
            </span>
          ))}
        </div>
      </div>

      {/* Grid structure for main cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto" id="categories-grid">
        {/* Card 1: Audio Converter */}
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-slate-900/40 rounded-3xl border border-slate-900 p-6 md:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden group cursor-pointer"
          onClick={() => onNavigate("audio")}
          id="card-audio-converter"
        >
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
          
          <div className="space-y-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400 inline-block">
              <Music className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-100 flex items-center gap-1.5 group-hover:text-emerald-400 transition-colors">
                <span>Conversor de Áudio</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Converta seus arquivos para MP3, WAV, AAC, FLAC, OGG e outros formatos com qualidade personalizada.
              </p>
            </div>
            <ul className="text-[11px] text-slate-400 space-y-1.5 pt-2 font-medium">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Conversão em lote
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Várias opções de qualidade
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Prévia antes do download
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Download imediato
              </li>
            </ul>
          </div>

          <div className="pt-6 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
            <span>Acessar Conversor de Áudio</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </motion.div>

        {/* Card 2: Vídeo para Áudio */}
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-slate-900/40 rounded-3xl border border-slate-900 p-6 md:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden group cursor-pointer"
          onClick={() => onNavigate("videoToAudio")}
          id="card-extract-audio"
        >
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
          
          <div className="space-y-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400 inline-block">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-100 flex items-center gap-1.5 group-hover:text-emerald-400 transition-colors">
                <span>Vídeo para Áudio</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Extraia o áudio de vídeos MP4, MOV, M4V e WebM e baixe o resultado em MP3 ou WAV.
              </p>
            </div>
            <ul className="text-[11px] text-slate-400 space-y-1.5 pt-2 font-medium">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                MP3 ou WAV
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Escolha de qualidade
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Processo rápido
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Download na hora
              </li>
            </ul>
            <p className="text-[11px] text-emerald-400/90 font-semibold pt-1">
              🔒 Seus arquivos não ficam salvos.
            </p>
          </div>

          <div className="pt-6 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
            <span>Acessar Vídeo para Áudio</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </motion.div>

        {/* Card 3: Ferramentas PDF */}
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-slate-900/40 rounded-3xl border border-slate-900 p-6 md:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden group cursor-pointer"
          onClick={() => onNavigate("pdf")}
          id="card-pdf-tools"
        >
          <div className="space-y-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400 inline-block">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-100 flex items-center gap-1.5 group-hover:text-emerald-400 transition-colors">
                <span>Ferramentas PDF Grátis</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Junte, organize, gire, exclua páginas e compacte seus arquivos PDF com poucos cliques.
              </p>
            </div>
            <ul className="text-[11px] text-slate-400 space-y-1.5 pt-2 font-medium">
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Juntar PDFs
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Organizar páginas
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Girar e excluir páginas
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                Compactar documentos
              </li>
            </ul>
          </div>

          <div className="pt-6 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
            <span>Acessar Ferramentas PDF</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </motion.div>
      </div>

      {/* Info Warning */}
      <div className="bg-slate-950/40 rounded-2xl border border-slate-900/60 p-4 flex items-center justify-center space-x-3 max-w-3xl mx-auto text-center" id="local-security-card">
        <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" id="info-icon" />
        <p className="text-xs text-slate-300 font-medium leading-relaxed" id="security-disclaimer">
          Não guardamos seus arquivos. Ao fechar ou atualizar a página, o conteúdo da conversão é descartado.
        </p>
      </div>
    </div>
  );
}
