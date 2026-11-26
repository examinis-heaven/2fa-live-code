/**
 * Lazy-loaded QR Code Decoder
 * Prefers native BarcodeDetector API (offline), falls back to jsQR on demand.
 */

let jsQRPromise = null;
let nativeDetector = null;

async function loadJsQR() {
  if (window.jsQR) return window.jsQR;
  if (!jsQRPromise) {
    jsQRPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.async = true;
      script.onload = () => (window.jsQR ? resolve(window.jsQR) : reject(new Error('jsQR failed to load')));
      script.onerror = () => reject(new Error('Could not load QR decoder offline'));
      document.head.appendChild(script);
    });
  }
  return jsQRPromise;
}

export async function decodeQRFromSource(source) {
  if ('BarcodeDetector' in window) {
    try {
      if (!nativeDetector) {
        nativeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      }
      const results = await nativeDetector.detect(source);
      if (results?.length > 0 && results[0].rawValue) {
        return results[0].rawValue;
      }
    } catch {
      // Fall through to canvas + jsQR
    }
  }

  const width = source.videoWidth || source.naturalWidth || source.width;
  const height = source.videoHeight || source.naturalHeight || source.height;
  if (!width || !height) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  const jsQR = await loadJsQR();
  const decoded = jsQR(imageData.data, width, height, { inversionAttempts: 'dontInvert' });
  return decoded ? decoded.data : null;
}
