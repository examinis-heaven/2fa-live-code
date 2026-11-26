/**
 * Webcam QR Scanner & Image Upload Controller
 * Lazily imports `../core/qr-decoder.js` only when needed.
 */

import { animateModalIn, onModalClose } from './animations.js';
import { showToast } from './toast.js';

export function createScannerController({
  modalEl,
  videoEl,
  statusEl,
  closeBtn,
  scanBtn,
  uploadBtn,
  fileInput,
  onDecoded,
}) {
  let stream = null;
  let scanTimer = null;

  async function getDecoder() {
    const mod = await import('../core/qr-decoder.js');
    return mod.decodeQRFromSource;
  }

  async function open() {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Camera API not supported — use Upload QR instead', true);
      return;
    }

    modalEl.classList.remove('hidden');
    animateModalIn(modalEl);
    statusEl.textContent = 'Requesting camera permission...';

    try {
      const decodeQR = await getDecoder();
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      videoEl.srcObject = stream;
      await videoEl.play();
      statusEl.textContent = 'Point your camera at a 2FA QR code...';

      const scanLoop = async () => {
        if (!stream) return;
        try {
          const result = await decodeQR(videoEl);
          if (result) {
            close();
            onDecoded(result, 'QR code scanned successfully!');
            return;
          }
        } catch {
          // Continue scanning
        }
        scanTimer = setTimeout(scanLoop, 220);
      };
      scanLoop();
    } catch {
      statusEl.textContent = 'Unable to access camera. Check browser permissions or upload a QR image.';
    }
  }

  function close() {
    if (scanTimer) {
      clearTimeout(scanTimer);
      scanTimer = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    videoEl.srcObject = null;
    if (!modalEl.classList.contains('hidden')) {
      modalEl.classList.add('hidden');
      onModalClose();
    }
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const decodeQR = await getDecoder();
      const bitmap = await createImageBitmap(file);
      const decoded = await decodeQR(bitmap);
      bitmap.close?.();
      if (!decoded) {
        showToast('No QR code detected in that image', true);
        return;
      }
      onDecoded(decoded, 'QR code decoded from image!');
    } catch (err) {
      showToast(err.message || 'Failed to read QR image', true);
    }
  }

  scanBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });
  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleImageUpload);

  return { open, close };
}
