/**
 * Offline otpauth:// QR Code Export Controller
 */

import {
  normalizeSecret,
  isValidBase32,
  generateRandomSecret,
  buildOtpAuthUri,
} from '../core/totp.js';
import { generateQRSvg } from '../core/qr-encoder.js';
import { showToast, copyText, escapeHtml } from './toast.js';

const DEFAULT_SECRET = 'JBSWY3DPEHPK3PXP';

export function createQrExportMode({
  secretInput,
  issuerInput,
  accountInput,
  uriOutput,
  svgContainer,
  randomBtn,
  downloadBtn,
  copyUriBtn,
  getTotpParams,
}) {
  let lastRenderedSvg = '';

  function update() {
    const secret = normalizeSecret(secretInput.value);
    if (!isValidBase32(secret)) {
      uriOutput.value = '';
      svgContainer.innerHTML = '<span class="text-xs text-slate-400 text-center">Enter a valid Base32 secret</span>';
      lastRenderedSvg = '';
      return;
    }

    const { digits, period, algorithm } = getTotpParams();
    const uri = buildOtpAuthUri({
      secret,
      issuer: issuerInput.value.trim() || '2FA Live',
      account: accountInput.value.trim() || 'user@example.com',
      digits,
      period,
      algorithm,
    });

    uriOutput.value = uri;
    try {
      lastRenderedSvg = generateQRSvg(uri);
      svgContainer.innerHTML = lastRenderedSvg;
    } catch (err) {
      svgContainer.innerHTML = `<span class="text-xs text-rose-400 text-center">${escapeHtml(err.message)}</span>`;
    }
  }

  [secretInput, issuerInput, accountInput].forEach((el) => el.addEventListener('input', update));

  randomBtn.addEventListener('click', () => {
    secretInput.value = generateRandomSecret(16);
    update();
    showToast('Generated secure random Base32 secret');
  });

  copyUriBtn.addEventListener('click', () => {
    if (uriOutput.value) copyText(uriOutput.value, 'otpauth:// URI copied!');
  });

  downloadBtn.addEventListener('click', () => {
    if (!lastRenderedSvg) return;
    const blob = new Blob([lastRenderedSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = (issuerInput.value || '2fa-qr').replace(/[^a-z0-9-_]+/gi, '_').toLowerCase();
    a.download = `${name}-2fa-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('QR SVG downloaded');
  });

  secretInput.value = DEFAULT_SECRET;
  update();

  return {
    syncSecretIfEmpty: (secret) => {
      if (secret && !secretInput.value) {
        secretInput.value = secret;
        update();
      }
    },
  };
}
