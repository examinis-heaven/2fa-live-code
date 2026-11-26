/**
 * Multi / Bulk 2FA Live Board Controller
 */

import { isValidBase32, parseInput, generateTOTP, formatToken, maskSecret } from '../core/totp.js';
import { animateDynamicCards } from './animations.js';
import { showToast, copyText, escapeHtml } from './toast.js';

const SAMPLE_BULK_KEYS = [
  'GitHub: JBSWY3DPEHPK3PXP',
  'Binance: HXDMVJECJJWSRB3H',
  'Discord: GEZDGNBVGY3TQOJQ',
  'Cloudflare: MZXW6YTBOI======',
];

export function createBulkMode({ inputEl, demoBtn, gridEl, countEl }) {
  let entries = [];

  async function refreshCodes() {
    if (entries.length === 0) return;
    await Promise.all(
      entries.map(async (item, i) => {
        const codeEl = gridEl.querySelector(`[data-bulk-code="${i}"]`);
        if (!codeEl) return;
        try {
          const code = await generateTOTP(item.secret, {
            digits: item.digits,
            period: item.period,
            algorithm: item.algorithm,
          });
          codeEl.textContent = formatToken(code);
          codeEl.closest('.bulk-card').dataset.rawCode = code;
        } catch {
          codeEl.textContent = 'ERR';
        }
      })
    );
  }

  function render() {
    if (entries.length === 0) {
      gridEl.innerHTML =
        '<div class="col-span-full glass-inset rounded-[18px] p-5 text-center text-xs text-[var(--text-muted)]">Enter one or more secret keys above to monitor all live 2FA codes simultaneously.</div>';
      return;
    }

    gridEl.innerHTML = '';
    entries.forEach((item, idx) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'bulk-card';
      card.innerHTML = `
        <div class="bulk-card-top">
          <span class="bulk-card-title">${escapeHtml(item.label)}</span>
          <span class="bulk-card-mask mono">${maskSecret(item.secret)}</span>
        </div>
        <span class="bulk-card-code mono" data-bulk-code="${idx}">--- ---</span>
      `;
      card.addEventListener('click', () => {
        if (card.dataset.rawCode) copyText(card.dataset.rawCode, `Copied ${item.label} code!`);
      });
      gridEl.appendChild(card);
    });

    refreshCodes();
    animateDynamicCards(gridEl, '.bulk-card');
  }

  function parse() {
    const lines = inputEl.value
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    entries = [];
    lines.forEach((line, idx) => {
      let label = '';
      let rawKey = line;

      if (!line.toLowerCase().startsWith('otpauth://') && line.includes(':')) {
        const sep = line.indexOf(':');
        label = line.slice(0, sep).trim();
        rawKey = line.slice(sep + 1).trim();
      }

      const parsed = parseInput(rawKey);
      if (parsed && isValidBase32(parsed.secret)) {
        entries.push({
          label: label || [parsed.issuer, parsed.label].filter(Boolean).join(' • ') || `Key #${idx + 1}`,
          secret: parsed.secret,
          digits: parsed.digits,
          period: parsed.period,
          algorithm: parsed.algorithm,
        });
      }
    });

    countEl.textContent = String(entries.length);
    render();
  }

  inputEl.addEventListener('input', parse);
  demoBtn.addEventListener('click', () => {
    inputEl.value = SAMPLE_BULK_KEYS.join('\n');
    parse();
    showToast('Loaded 4 sample 2FA accounts');
  });

  return { refreshCodes };
}
