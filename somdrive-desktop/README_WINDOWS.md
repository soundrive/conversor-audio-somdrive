# Conversor SomDrive Desktop - Guia de Configuração e Compilação no Windows

Este guia contém as instruções passo a passo para configurar o ambiente de desenvolvimento, executar e gerar o instalador final do **Conversor SomDrive Desktop** no sistema operacional Windows.

---

## 🛠️ Requisitos de Software (Instalação no Windows)

Para compilar aplicativos Tauri para Windows, você precisará instalar três componentes essenciais. Siga a ordem abaixo:

### 1. Microsoft C++ Build Tools (Compilador C++)
O compilador do Rust no Windows necessita do compilador C++ da Microsoft para linkar os binários.
1. Acesse o site oficial: [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) e baixe o instalador.
2. Execute o instalador e escolha a carga de trabalho:
   * **"Desenvolvimento para desktop com C++"** (Desktop development with C++).
3. No painel direito, certifique-se de que os seguintes componentes opcionais estejam marcados:
   * *MSVC v143 - ferramentas de build do VS 2022 C++ x64/x86* (ou mais recente)
   * *SDK do Windows 10* ou *Windows 11 SDK*
4. Clique em **Instalar** (isso pode levar alguns minutos devido ao tamanho dos pacotes).

### 2. Node.js (Ambiente JavaScript/TypeScript)
Responsável por rodar o frontend em React e o CLI do Tauri.
1. Acesse [nodejs.org](https://nodejs.org/) e faça o download da versão **LTS** (Recomendada).
2. Execute o instalador seguindo as etapas padrão "Next" até concluir.
3. Para validar a instalação, abra o Prompt de Comando (cmd) ou PowerShell e execute:
   ```bash
   node -v
   npm -v
   ```

### 3. Rust e Rustup (Linguagem de Programação)
O Tauri utiliza a linguagem Rust para o backend do aplicativo desktop.
1. Acesse [rustup.rs](https://rustup.rs/) e baixe o instalador do Windows (`rustup-init.exe`).
2. Execute o `rustup-init.exe`.
3. Uma janela de terminal será aberta perguntando pelo tipo de instalação. Digite **1** (instalação padrão) e pressione **Enter**.
4. Reinicie seu terminal (ou o computador) para garantir que as variáveis de ambiente sejam carregadas.
5. Para validar, execute:
   ```bash
   rustc --version
   ```

---

## 🚀 Como Executar o Projeto em Desenvolvimento

Agora que seu ambiente está configurado, siga as etapas abaixo para rodar o aplicativo localmente:

1. Abra o **PowerShell** ou o **Prompt de Comando** do Windows.
2. Navegue até a pasta independente do projeto desktop:
   ```powershell
   cd somdrive-desktop
   ```
3. Instale todas as dependências do frontend e das ferramentas Tauri:
   ```bash
   npm install
   ```
4. Execute o aplicativo em modo de desenvolvimento:
   ```bash
   npm run tauri dev
   ```
   * O Tauri irá compilar o backend em Rust pela primeira vez, baixar as crates necessárias e em seguida abrirá a janela nativa do Conversor SomDrive com a interface React ativa e suporte a Hot Module Replacement (HMR).

---

## 📦 Como Gerar o Instalador Final (.msi / .exe)

Para empacotar o projeto em um instalador independente do Windows:

1. Certifique-se de estar na pasta `somdrive-desktop`.
2. Execute o comando de compilação oficial do Tauri:
   ```bash
   npm run tauri build
   ```
3. O Tauri irá otimizar o código Rust, compilar o frontend para produção e empacotar tudo junto com os binários sidecars do **FFmpeg** e **FFprobe**.

### 📂 Onde localizar o instalador gerado?
Uma vez concluído o build com sucesso, o instalador oficial do Windows estará disponível na seguinte pasta:
`somdrive-desktop/src-tauri/target/release/bundle/msi/`

O arquivo gerado será semelhante a:
* **`somdrive-desktop_1.0.0_x64_en-US.msi`** (Instalador pronto para ser distribuído e instalado em qualquer computador Windows 10/11 x64).

---

## 🔍 Diagnóstico de Erros Comuns (Troubleshooting)

### 1. Erro: `link.exe not found` ou `Failed to find MSVC`
* **Causa**: O compilador Rust não encontrou o compilador C++ da Microsoft.
* **Solução**: Abra o "Visual Studio Installer", clique em "Modificar" na sua instalação do C++ Build Tools e garanta que a opção **"Desenvolvimento para desktop com C++"** esteja marcada e totalmente instalada.

### 2. Erro: `sidecar bin/ffmpeg-x86_64-pc-windows-msvc.exe not found`
* **Causa**: O Tauri não conseguiu localizar os binários do FFmpeg e FFprobe específicos para a arquitetura do Windows.
* **Solução**: Confirme se os dois arquivos binários reais estão localizados fisicamente na pasta:
  `somdrive-desktop/src-tauri/bin/ffmpeg-x86_64-pc-windows-msvc.exe`
  `somdrive-desktop/src-tauri/bin/ffprobe-x86_64-pc-windows-msvc.exe`
  Eles já vêm pré-empacotados e configurados corretamente nesta distribuição para você.

### 3. Erro de Permissão de Execução de Scripts no PowerShell
* **Causa**: O Windows restringe a execução de scripts npm por padrão no PowerShell.
* **Solução**: Abra o PowerShell como Administrador e execute o comando:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```
  Isso liberará a execução local de scripts seguros compilados por você ou assinados digitalmente.

### 4. Erro: `Vite not found` ou `tauri: command not found`
* **Causa**: As dependências do Node.js não foram instaladas localmente na pasta desktop.
* **Solução**: Certifique-se de estar dentro da pasta `somdrive-desktop` e execute `npm install` antes de iniciar o comando de desenvolvimento ou build.
