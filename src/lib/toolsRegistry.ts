export interface ToolDefinition {
  toolId: string;
  name: string;
  route: string;
  category: "audio" | "video" | "pdf" | "image";
  analyticsPrefix: string;
  active: boolean;
  description: string;
}

export const TOOLS_LIST: ToolDefinition[] = [
  {
    toolId: "image_cropper",
    name: "Cortar Imagem",
    route: "/imagem/cortar",
    category: "image",
    analyticsPrefix: "image_crop",
    active: true,
    description: "Recorte suas imagens livremente ou crie vários tamanhos prontos de uma só vez."
  },
  {
    toolId: "image_resizer",
    name: "Redimensionador de Imagens",
    route: "/imagem/redimensionar",
    category: "image",
    analyticsPrefix: "image_resize",
    active: true,
    description: "Altere a largura e a altura das suas imagens em pixels, porcentagem ou tamanhos prontos."
  },
  {
    toolId: "image_compressor",
    name: "Compressor de Imagens",
    route: "/imagem/comprimir",
    category: "image",
    analyticsPrefix: "image_compression",
    active: true,
    description: "Reduza o tamanho de imagens JPG, PNG, WEBP e AVIF mantendo uma boa qualidade visual."
  },
  {
    toolId: "image_converter",
    name: "Conversor de Imagens",
    route: "/imagem/converter",
    category: "image",
    analyticsPrefix: "image_conversion",
    active: true,
    description: "Converta imagens entre JPG, PNG, WEBP, AVIF e BMP de forma rápida e fácil."
  },
  {
    toolId: "audio_converter",
    name: "Conversor de Áudio",
    route: "/audio",
    category: "audio",
    analyticsPrefix: "audio",
    active: true,
    description: "Converta arquivos de áudio para MP3, WAV, AAC, FLAC, OGG e outros formatos com qualidade personalizada."
  },
  {
    toolId: "video_to_audio",
    name: "Vídeo para Áudio",
    route: "/video-para-audio",
    category: "video",
    analyticsPrefix: "video_audio",
    active: true,
    description: "Extraia o áudio de vídeos MP4, MOV, M4V e WebM e baixe o resultado em MP3 ou WAV."
  },
  {
    toolId: "pdf_tools",
    name: "Ferramentas PDF",
    route: "/pdf",
    category: "pdf",
    analyticsPrefix: "pdf",
    active: true,
    description: "Junte, organize, gire, exclua páginas e compacte seus arquivos PDF com poucos cliques."
  },
  {
    toolId: "pdf_merge",
    name: "Juntar PDF",
    route: "/pdf/juntar-pdf",
    category: "pdf",
    analyticsPrefix: "pdf_merge",
    active: true,
    description: "Combine múltiplos arquivos PDF em um único documento de forma rápida."
  },
  {
    toolId: "pdf_compress",
    name: "Comprimir PDF",
    route: "/pdf/comprimir-pdf",
    category: "pdf",
    analyticsPrefix: "pdf_compress",
    active: true,
    description: "Reduza o tamanho de arquivos PDF mantendo a legibilidade."
  },
  {
    toolId: "pdf_organize",
    name: "Organizar PDF",
    route: "/pdf/organizar-pdf",
    category: "pdf",
    analyticsPrefix: "pdf_organize",
    active: true,
    description: "Reordene as páginas do seu documento PDF na ordem que desejar."
  },
  {
    toolId: "pdf_girar",
    name: "Girar PDF",
    route: "/pdf/girar-pdf",
    category: "pdf",
    analyticsPrefix: "pdf_girar",
    active: true,
    description: "Gire páginas de arquivos PDF individualmente ou em lote."
  },
  {
    toolId: "pdf_excluir",
    name: "Excluir Páginas PDF",
    route: "/pdf/excluir-paginas",
    category: "pdf",
    analyticsPrefix: "pdf_excluir",
    active: true,
    description: "Remova páginas indesejadas de documentos PDF."
  },
  {
    toolId: "images_to_pdf",
    name: "Imagens para PDF",
    route: "/pdf/imagens-para-pdf",
    category: "pdf",
    analyticsPrefix: "images_to_pdf",
    active: true,
    description: "Transforme imagens JPG, PNG e WEBP em um único arquivo PDF, organizando a ordem das páginas antes de baixar."
  },
  {
    toolId: "pdf_to_images",
    name: "PDF para Imagens",
    route: "/pdf/pdf-para-imagens",
    category: "pdf",
    analyticsPrefix: "pdf_to_images",
    active: true,
    description: "Converta cada página de um PDF em imagens JPG ou PNG e baixe individualmente ou em arquivo ZIP."
  }
];

export function getToolByRoute(path: string): ToolDefinition | undefined {
  return TOOLS_LIST.find((t) => t.route === path);
}

export function getToolById(id: string): ToolDefinition | undefined {
  return TOOLS_LIST.find((t) => t.toolId === id);
}
