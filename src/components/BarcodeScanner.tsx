import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, AlertCircle, Loader2 } from 'lucide-react';

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode('reader');
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 280, height: 180 },
          aspectRatio: 1.0,
        };

        // Solicita câmera e inicia se permitido
        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            onScan(decodedText);
            onClose();
          },
          (errorMessage) => {
            // Ignora erros de scan contínuo
          }
        );
        setIsInitializing(false);
      } catch (err: any) {
        console.error('Falha ao iniciar scanner:', err);
        setIsInitializing(false);
        if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
          setError('Permissão de câmera negada. Por favor, habilite o acesso nas configurações do seu navegador.');
        } else {
          setError('Não foi possível acessar a câmera. Verifique se ela está sendo usada por outro app.');
        }
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
        }).catch(err => console.error("Erro ao fechar scanner:", err));
      }
    };
  }, [onScan, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-indigo-50 p-2 text-indigo-600">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Escanear Livro</h2>
              <p className="text-xs text-slate-500">Aponte para o código de barras no verso</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 aspect-square flex flex-col items-center justify-center">
            {isInitializing && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
                <p className="text-sm font-medium text-slate-500 tracking-tight">Solicitando acesso à câmera...</p>
              </div>
            )}
            
            {error ? (
              <div className="p-6 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <h3 className="mb-2 text-sm font-bold text-slate-900">Erro de Permissão</h3>
                <p className="px-4 text-xs leading-relaxed text-slate-500">{error}</p>
                <button 
                  onClick={() => window.location.reload()}
                  className="mt-6 rounded-xl bg-slate-900 px-6 py-2 text-xs font-bold text-white transition-all hover:bg-slate-800"
                >
                  Recarregar Página
                </button>
              </div>
            ) : (
              <div id="reader" className="w-full h-full"></div>
            )}
          </div>
          
          <div className="mt-6 flex flex-col gap-3">
            <div className="rounded-xl bg-amber-50 p-4 border border-amber-100">
              <p className="text-[11px] sm:text-xs leading-relaxed text-amber-800">
                <strong>Dica:</strong> Mantenha o livro em um local bem iluminado e evite reflexos plásticos para uma leitura mais rápida.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
