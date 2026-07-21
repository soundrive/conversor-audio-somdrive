import React, { ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[CRITICAL ERROR BOUNDARY CATCH]:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0D0F12] text-[#F5F7F8] flex flex-col justify-center items-center p-6 font-sans">
          <div className="bg-[#14181D] border border-red-900/40 rounded-[28px] max-w-lg w-full p-8 text-center space-y-6 shadow-2xl">
            <div className="p-3 bg-red-500/10 text-red-500 rounded-2xl w-fit mx-auto border border-red-500/20 animate-pulse">
              <AlertCircle className="h-10 w-10" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-extrabold text-[#F5F7F8]">
                Erro ao carregar o aplicativo
              </h1>
              <p className="text-xs text-text-sec text-gray-400 font-medium">
                Ocorreu uma falha inesperada na renderização da interface. A aplicação foi protegida contra travamentos graves.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-black/40 border border-gray-800 rounded-xl p-4 text-left space-y-1 font-mono text-[11px] text-red-400 overflow-x-auto max-h-40">
                <p className="font-bold">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.error.stack && (
                  <pre className="text-[10px] text-gray-500 whitespace-pre-wrap font-mono mt-2">
                    {this.state.error.stack.slice(0, 300)}...
                  </pre>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Recarregar Página</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex-1 py-3 bg-[#1B2028] hover:bg-[#222933] text-gray-200 border border-gray-700/60 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Home className="h-4 w-4 text-emerald-400" />
                <span>Ir para Página Inicial</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
