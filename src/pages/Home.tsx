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
  onNavigate: (path: "audio" | "extrair-audio") => void;
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
          <span>Central de Conversões Locais</span>
        </motion.div>
        
        <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-slate-100" id="home-title">
          Tudo processado no seu navegador
        </h2>
        
        <p className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-xl mx-auto" id="home-subtitle">
          Uma central de ferramentas seguras e offline. Sem cadastro, sem login, sem servidores de conversão. Seus arquivos nunca saem do seu dispositivo.
        </p>
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
                <span>Ferramentas de Áudio</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Converta seus arquivos para MP3 com controle total de qualidade (64kbps até 320kbps). Perfeito para guias musicais e reduzir o peso dos seus arquivos.
              </p>
            </div>
            <ul className="text-[11px] text-slate-500 space-y-1.5 pt-2 font-medium">
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-emerald-400 rounded-full" />
                Conversão em lote (até 15 arquivos)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-emerald-400 rounded-full" />
                Controle de qualidade (MP3 64k a 320k)
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-emerald-400 rounded-full" />
                Player de original e convertido
              </li>
            </ul>
          </div>

          <div className="pt-6 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
            <span>Acessar Ferramenta</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </motion.div>

        {/* Card 2: Extract Audio */}
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="bg-slate-900/40 rounded-3xl border border-slate-900 p-6 md:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden group cursor-pointer"
          onClick={() => onNavigate("extrair-audio")}
          id="card-extract-audio"
        >
          <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/10 transition-colors" />
          
          <div className="space-y-4">
            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-400 inline-block">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-100 flex items-center gap-1.5 group-hover:text-emerald-400 transition-colors">
                <span>Extrair Áudio de Vídeo</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Extraia a faixa de som de arquivos de vídeo MP4, MOV, MPEG, WEBM e outros diretamente para áudio MP3 no seu navegador.
              </p>
            </div>
            <ul className="text-[11px] text-slate-500 space-y-1.5 pt-2 font-medium">
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-emerald-400 rounded-full" />
                Suporta MP4, MOV, WEBM, AVI, MKV, etc.
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-emerald-400 rounded-full" />
                Ignora faixas visuais de vídeo
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-emerald-400 rounded-full" />
                Gera arquivos MP3 leves e otimizados
              </li>
            </ul>
          </div>

          <div className="pt-6 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
            <span>Extrair Som</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </motion.div>

        {/* Card 3: PDF Tools (Disabled for now) */}
        <div
          className="bg-slate-900/10 rounded-3xl border border-slate-900/60 p-6 md:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden opacity-60 cursor-not-allowed"
          id="card-pdf-tools"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 text-slate-500 inline-block">
                <FileText className="h-6 w-6" />
              </div>
              <span className="px-2.5 py-1 bg-slate-900 border border-slate-800 text-slate-400 text-[9px] uppercase font-bold rounded-full tracking-wider">
                Fase 2 & 3
              </span>
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-slate-400">
                Ferramentas de PDF
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Juntar PDFs, dividir páginas, comprimir, reordenar e proteger arquivos com senha 100% no navegador. Disponível nas próximas etapas do projeto.
              </p>
            </div>
            <ul className="text-[11px] text-slate-600 space-y-1.5 pt-2 font-medium">
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-slate-700 rounded-full" />
                Juntar e dividir arquivos PDF
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-slate-700 rounded-full" />
                Excluir, girar e reordenar páginas
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-1 h-1 bg-slate-700 rounded-full" />
                Imagens para PDF & PDF para Imagens
              </li>
            </ul>
          </div>

          <div className="pt-6 flex items-center justify-between text-xs font-bold text-slate-500">
            <span>Em Breve</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Info Warning */}
      <div className="bg-slate-950/40 rounded-2xl border border-slate-900/60 p-4 flex items-start space-x-3 max-w-3xl mx-auto" id="local-security-card">
        <Info className="h-4.5 w-4.5 text-emerald-400 mt-0.5 shrink-0" id="info-icon" />
        <p className="text-xs text-slate-400 leading-relaxed" id="security-disclaimer">
          Seus arquivos são processados diretamente no seu dispositivo e não ficam armazenados em nossos servidores. Ao atualizar ou fechar a aba, a memória local é 100% liberada.
        </p>
      </div>
    </div>
  );
}
