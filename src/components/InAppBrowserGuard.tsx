import React, { useEffect, useState } from 'react';
import { isInAppBrowser, isAndroid, isIOS, getExternalBrowserUrl } from '../lib/inAppBrowser';
import { ExternalLink, Info, Smartphone, Share2, MoreVertical, Globe } from 'lucide-react';
import { motion } from 'motion/react';

export function InAppBrowserGuard({ children }: { children: React.ReactNode }) {
  const [showGuard, setShowGuard] = useState(false);

  useEffect(() => {
    if (isInAppBrowser()) {
      setShowGuard(true);
    }
  }, []);

  if (!showGuard) {
    return <>{children}</>;
  }

  const handleOpenExternal = () => {
    window.location.href = getExternalBrowserUrl();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-slate-900/95 p-6 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="bg-indigo-600 p-6 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
            <Globe className="h-10 w-10" />
          </div>
          <h2 className="text-xl font-bold">Navegador Restrito</h2>
          <p className="mt-2 text-sm text-indigo-100">
            Para garantir que a autenticação e o acesso funcionem corretamente, abra o app no navegador padrão do seu celular.
          </p>
        </div>

        <div className="p-6">
          {isAndroid() ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <Smartphone className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Usuário Android</p>
                  <p className="text-xs text-slate-500">O botão abaixo tentará abrir o Google Chrome automaticamente.</p>
                </div>
              </div>

              <button
                onClick={handleOpenExternal}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 active:scale-95"
              >
                Abrir no Google Chrome
                <ExternalLink className="h-5 w-5" />
              </button>
            </div>
          ) : isIOS() ? (
            <div className="space-y-6">
              <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                  <Info className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Usuário iPhone (iOS)</p>
                  <p className="text-xs text-slate-500">Siga os passos abaixo para abrir no Safari:</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600 border border-indigo-100">1</div>
                  <p className="text-sm text-slate-600">
                    Toque no ícone de compartilhar <Share2 className="h-4 w-4 inline-block text-indigo-600 animate-pulse" /> ou nos três pontos <MoreVertical className="h-4 w-4 inline-block text-indigo-600 animate-pulse" /> (no topo ou rodapé).
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600 border border-indigo-100">2</div>
                  <p className="text-sm text-slate-600">
                    Selecione <strong>"Abrir no Safari"</strong> ou <strong>"Abrir no Navegador"</strong>.
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <p className="text-center text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3 underline decoration-indigo-200">Alternativa rápida</p>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Link copiado com sucesso! Agora saia do app e cole este link no Safari ou Chrome.');
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
                >
                  Copiar Link do App
                  <ExternalLink className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-slate-600">Detectamos que você está usando um navegador interno.</p>
              <p className="mt-2 text-xs text-slate-400">Copie o link e abra no seu navegador favorito para continuar.</p>
            </div>
          )}

          <div className="mt-8">
            <button
              onClick={() => setShowGuard(false)}
              className="w-full text-center text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              Tentar continuar mesmo assim (não recomendado)
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
