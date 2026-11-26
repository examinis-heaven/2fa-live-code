/**
 * Info, Legal & Quick QR Modal Controller
 */

import { animateModalIn, onModalClose } from './animations.js';
import { escapeHtml } from './toast.js';

const LEGAL_CONTENT = {
  privacy: {
    title: 'Privacy Policy',
    html: `
      <p><strong>Zero-Knowledge Guarantee:</strong> 2FA Live Code executes 100% inside your local browser using the Web Crypto API. Your secret keys, otpauth URIs, and generated tokens are never sent to any server.</p>
      <p><strong>Zero Ads &amp; Zero Tracking:</strong> Unlike ad-heavy 2FA websites, this app contains zero advertising scripts, zero analytics trackers, and zero third-party cookies.</p>
      <p><strong>Local Storage:</strong> Recent keys and theme preferences are saved exclusively in your browser's <code>localStorage</code> and can be wiped at any time via the Clear button.</p>
    `,
  },
  about: {
    title: 'About 2FA Live Code',
    html: `
      <p>2FA Live Code is an ultra-lightweight, open-standard RFC 6238 TOTP authenticator built for speed, privacy, and reliability.</p>
      <p>Designed with zero runtime bloat, it works seamlessly on desktop and mobile — even when completely offline.</p>
    `,
  },
  contact: {
    title: 'Contact Us',
    html: `
      <p>Have feedback, bug reports, or feature suggestions? Reach out to our maintainers anytime.</p>
      <p>Because this application is 100% client-side, we never have access to your accounts or secret keys — always keep a secure backup of your recovery codes.</p>
    `,
  },
  disclaimer: {
    title: 'Disclaimer',
    html: `
      <p>This tool is provided "as is" without warranty of any kind. Always store your 2FA secret keys and backup recovery codes in an encrypted password manager or offline safe.</p>
      <p>Accurate TOTP codes require your device's system clock to be synchronized.</p>
    `,
  },
  terms: {
    title: 'Terms & Conditions',
    html: `
      <p>By using 2FA Live Code, you agree that you are solely responsible for safeguarding your secret keys and accounts. All computations occur locally on your device.</p>
    `,
  },
};

export function createModalController({ modalEl, titleEl, bodyEl, closeBtn }) {
  function openCustom(title, html) {
    titleEl.textContent = title;
    bodyEl.innerHTML = html;
    modalEl.classList.remove('hidden');
    animateModalIn(modalEl);
  }

  function openLegal(key) {
    const data = LEGAL_CONTENT[key];
    if (data) openCustom(data.title, data.html);
  }

  function openQrPreview(title, svg, uri) {
    openCustom(
      title || '2FA QR Code',
      `
        <div class="flex flex-col items-center gap-3">
          <div class="qr-stage glass-qr-frame w-52 h-52 p-3 rounded-[24px] bg-white grid place-items-center">${svg}</div>
          <code class="mono text-xs break-all text-center opacity-80">${escapeHtml(uri)}</code>
        </div>
      `
    );
  }

  function close() {
    if (modalEl.classList.contains('hidden')) return;
    modalEl.classList.add('hidden');
    onModalClose();
  }

  closeBtn.addEventListener('click', close);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  document.querySelectorAll('[data-modal]').forEach((btn) => {
    btn.addEventListener('click', () => openLegal(btn.dataset.modal));
  });

  return { openLegal, openQrPreview, close };
}
