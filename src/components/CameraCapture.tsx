import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RotateCcw, Check, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CameraCaptureProps {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
}

export function CameraCapture({ onCapture, onClose }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);

  // Start camera and manage stream tracks
  const stopTracks = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const startCamera = async () => {
    stopTracks();
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
           setIsCameraReady(true);
           videoRef.current?.play().catch(console.error);
        };
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setError('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        // Set canvas dimensions to match video stream
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the full frame first
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Simple center crop to 2:3 ratio
        const targetRatio = 2/3;
        const videoRatio = video.videoWidth / video.videoHeight;
        
        let subWidth = video.videoWidth;
        let subHeight = video.videoHeight;
        let startX = 0;
        let startY = 0;

        if (videoRatio > targetRatio) {
          // Video is too wide (typical landscape)
          subWidth = video.videoHeight * targetRatio;
          startX = (video.videoWidth - subWidth) / 2;
        } else {
          // Video is too tall (portrait but maybe narrow)
          subHeight = video.videoWidth / targetRatio;
          startY = (video.videoHeight - subHeight) / 2;
        }

        console.log(`[CameraCapture] Cropping: ${subWidth.toFixed(0)}x${subHeight.toFixed(0)} at (${startX.toFixed(0)}, ${startY.toFixed(0)})`);

        // Create temporary canvas for crop
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = subWidth;
        cropCanvas.height = subHeight;
        const cropContext = cropCanvas.getContext('2d');
        if (cropContext) {
          cropContext.drawImage(video, startX, startY, subWidth, subHeight, 0, 0, subWidth, subHeight);
          const dataUrl = cropCanvas.toDataURL('image/jpeg', 0.9);
          console.log('[CameraCapture] Photo captured and cropped. Data length:', dataUrl.length);
          setCapturedImage(dataUrl);
        } else {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          setCapturedImage(dataUrl);
        }
        
        stopTracks();
      }
    }
  };

  const retake = async () => {
    console.log('[CameraCapture] Retaking photo...');
    setCapturedImage(null);
    setIsCameraReady(false);
    
    // Tiny delay to allow state to propagate and old stream to fully cleanup
    setTimeout(async () => {
       await startCamera();
    }, 100);
  };

  // Lifecycle
  useEffect(() => {
    startCamera();
    return () => stopTracks();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex flex-col bg-black overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white bg-black/50 z-10">
        <div className="flex items-center gap-2">
           <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
           <h3 className="text-sm font-bold tracking-tight uppercase">Câmera Ativa</h3>
        </div>
        <button onClick={onClose} className="rounded-full bg-white/10 p-2 transition-colors hover:bg-white/20">
          <X className="h-6 w-6" />
        </button>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 overflow-hidden flex items-center justify-center bg-zinc-900">
        {error ? (
          <div className="p-8 text-center text-white">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <p className="font-medium">{error}</p>
            <button onClick={onClose} className="mt-6 rounded-xl bg-white/10 px-6 py-2">Voltar</button>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            {capturedImage ? (
              <motion.img 
                initial={{ scale: 1.1, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                src={capturedImage} 
                className="h-full w-full object-contain" 
                alt="Captured cover" 
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="h-full w-full object-contain"
                />
                
                {/* Guide Frame / Crop Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6">
                   <div className="relative w-full max-w-[280px] aspect-[2/3] border-2 border-white/80 border-dashed rounded-2xl flex flex-col items-center justify-center shadow-[0_0_0_100vmax_rgba(0,0,0,0.5)]">
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 text-[10px] font-bold text-white uppercase tracking-widest">
                         Enquadre a Capa
                      </div>
                      
                      {/* Corner Accents */}
                      <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-indigo-500 rounded-tl-lg" />
                      <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-indigo-500 rounded-tr-lg" />
                      <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-indigo-500 rounded-bl-lg" />
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-indigo-500 rounded-br-lg" />
                   </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Controls Container */}
      <div className="flex flex-col items-center justify-center bg-black/90 p-6 pb-12 backdrop-blur-xl">
        <div className="flex items-center justify-center gap-12 w-full max-w-sm">
          {capturedImage ? (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex items-center gap-8"
            >
              <button
                onClick={retake}
                className="flex flex-col items-center gap-2 text-white/70 transition-all hover:text-white group"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5 transition-transform group-active:scale-95">
                  <RotateCcw className="h-6 w-6" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">Repetir</span>
              </button>

              <button
                onClick={() => onCapture(capturedImage)}
                className="group flex h-20 w-20 flex-col items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl shadow-emerald-600/20 transition-all active:scale-90 hover:bg-emerald-500"
              >
                <Check className="h-10 w-10" />
                <span className="absolute -bottom-1 text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Usar Foto</span>
              </button>
              
              <div className="w-14" /> {/* Visual Balance */}
            </motion.div>
          ) : (
            <div className="relative flex items-center justify-center">
              <button
                onClick={takePhoto}
                disabled={!isCameraReady}
                className="group relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/30 transition-all active:scale-90 disabled:opacity-30"
              >
                <div className="h-14 w-14 rounded-full bg-white transition-all group-hover:scale-110 group-active:scale-95 shadow-inner shadow-black/10" />
                <Camera className="absolute h-8 w-8 text-black" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Canvas */}
      <canvas ref={canvasRef} className="hidden opacity-0 pointer-events-none" />
    </motion.div>
  );
}
