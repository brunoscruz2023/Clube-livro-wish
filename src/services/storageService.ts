import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

/**
 * Uploads a blob to Firebase Storage and returns the download URL and GS path.
 * @param blob The image blob to upload
 * @param path The path in storage (e.g., 'book_covers/isbn_123.jpg')
 */
export async function uploadImage(blob: Blob, path: string): Promise<{ downloadUrl: string; gsPath: string }> {
  // Use the explicit bucket from config to be safe
  const storageRef = ref(storage, path);
  const bucket = storage.app.options.storageBucket || 'gen-lang-client-0243519410.firebasestorage.app';
  const gsPath = `gs://${bucket}/${path}`;
  
  console.log(`[StorageService] Starting upload to ${gsPath} (${blob.size} bytes)...`);
  
  try {
    const snapshot = await uploadBytes(storageRef, blob);
    console.log(`[StorageService] Upload successful. Metadata:`, snapshot.metadata);
    
    const downloadUrl = await getDownloadURL(snapshot.ref);
    console.log(`[StorageService] Download URL: ${downloadUrl}`);
    console.log(`[StorageService] GS Path: ${gsPath}`);
    
    return { downloadUrl, gsPath };
  } catch (error: any) {
    console.error('[StorageService] Error in uploadImage:', error);
    const errorCode = error?.code || 'unknown';
    const errorMessage = error?.message || String(error);
    throw new Error(`Upload failed (${errorCode}): ${errorMessage}`);
  }
}

/**
 * Resizes an image before upload using a canvas.
 * @param dataUrl The data URL of the image
 * @param maxWidth Maximum width
 * @param maxHeight Maximum height
 */
export async function resizeImage(dataUrl: string, maxWidth = 800, maxHeight = 1000): Promise<Blob> {
  console.log('[StorageService] Starting resizeImage process');
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      console.log(`[StorageService] Image loaded for resizing: ${img.width}x${img.height}`);
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions (contained within bounds)
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      if (ratio < 1) {
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        if (blob) {
          console.log(`[StorageService] Resize complete: ${width.toFixed(0)}x${height.toFixed(0)}, blob size: ${blob.size}`);
          resolve(blob);
        } else {
          reject(new Error('Canvas to Blob conversion failed'));
        }
      }, 'image/jpeg', 0.85); // 85% quality JPEG
    };

    img.onerror = (err) => {
      console.error('[StorageService] Image load error in resizeImage:', err);
      reject(new Error('Failed to load image for resizing.'));
    };
    
    img.src = dataUrl;
  });
}
