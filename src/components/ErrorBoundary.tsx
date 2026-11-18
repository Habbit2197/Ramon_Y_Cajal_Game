/**
 * ErrorBoundary.tsx — Captura errores de renderizado de React y Three.js / WebGL
 *
 * Previene que fallos en shaders, contextos WebGL o carga asíncrona de WASM
 * dejen la pantalla completamente en negro.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturó un error en el árbol de renderizado:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6 bg-[#03050c] text-white">
          <div className="max-w-md w-full bg-neutral-950 border border-amber-500/40 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-serif font-bold text-amber-200">
              Recuperando Contexto Sináptico
            </h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Ocurrió una interrupción en el renderizado WebGL o en la inicialización física.
            </p>
            {this.state.error && (
              <pre className="text-[11px] font-mono text-rose-300 bg-neutral-900/80 p-3 rounded-xl border border-neutral-800 text-left overflow-auto max-h-28">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={this.handleRetry}
              className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              Reintentar Renderizado
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
