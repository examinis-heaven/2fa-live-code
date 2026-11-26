/**
 * Live Single-Key TOTP Generator & Recent Keys Local Vault Controller
 */

import {
  isValidBase32,
  parseInput,
  generateTOTP,
  formatToken,
  maskSecret,
  buildOtpAuthUri,
} from '../core/totp.js';
import { generateQRSvg } from '../core/qr-encoder.js';
import {
  loadRecentKeys,
  persistRecentKeys,
  upsertRecentKey,
  clearRecentKeys,
} from '../core/storage.js';
import { animateDynamicCards } from './animations.js';
import { showToast, copyText, escapeHtml } from './toast.js';

const DEMO_SECRET = 'JBSWY3DPEHPK3PXP';

export function createSingleMode({ els, modal, onStepReset }) {
  const state = {
    secret: '',
    label: '',
    digits: 6,
    period: 30,
    algorithm: 'SHA-1',
    currentCode: '',
    nextCode: '',
    recentKeys: loadRecentKeys(),
  };

  function updateParamSummary() {
    els.paramSummary.textContent = `${state.digits}d • ${state.period}s • ${state.algorithm}`;
  }

  async function refreshToken(animate = false) {
    if (!state.secret) return;
    try {
      const opts = { digits: state.digits, period: state.period, algorithm: state.algorithm };
      const [code, nextCode] = await Promise.all([
        generateTOTP(state.secret, opts),
        generateTOTP(state.secret, { ...opts, counterOffset: 1 }),
      ]);

      const changed = code !== state.currentCode;
      state.currentCode = code;
      state.nextCode = nextCode;

      els.tokenValue.textContent = formatToken(code);
      els.nextTokenPreview.textContent = `Next: ${formatToken(nextCode)}`;
      els.copyCodeBtn.disabled = false;

      if (animate || changed) {
        els.tokenValue.classList.remove('pulse');
        void els.tokenValue.offsetWidth;
        els.tokenValue.classList.add('pulse');
      }
    } catch {
      els.copyCodeBtn.disabled = true;
    }
  }

  async function refreshRecentCodes() {
    await Promise.all(
      state.recentKeys.map(async (item, i) => {
        const codeEl = els.recentList.querySelector(`[data-recent-code="${i}"]`);
        if (!codeEl) return;
        try {
          const code = await generateTOTP(item.secret, {
            digits: item.digits || 6,
            period: item.period || 30,
            algorithm: item.algorithm || 'SHA-1',
          });
          codeEl.textContent = formatToken(code);
        } catch {
          codeEl.textContent = 'ERR';
        }
      })
    );
  }

  function renderRecentKeys() {
    els.clearRecentBtn.classList.toggle('hidden', state.recentKeys.length === 0);

    if (state.recentKeys.length === 0) {
      els.recentList.innerHTML =
        '<div class="recent-empty glass-inset rounded-[16px] p-3.5 text-center text-xs text-[var(--text-muted)]">No recent keys yet. Paste a secret key or click <strong>Try Demo</strong>.</div>';
      return;
    }

    els.recentList.innerHTML = '';
    state.recentKeys.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = `recent-row${item.secret === state.secret ? ' active' : ''}`;
      row.innerHTML = `
        <div class="recent-meta">
          <span class="recent-label">${escapeHtml(item.label || `Account #${idx + 1}`)}</span>
          <span class="recent-mask mono">${maskSecret(item.secret)}</span>
        </div>
        <div class="recent-right">
          <span class="recent-code mono" data-recent-code="${idx}">------</span>
          <button type="button" class="row-mini-btn qr" title="Show QR Code" aria-label="Show QR Code">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zm4 4h3v3h-3z"/></svg>
          </button>
          <button type="button" class="row-mini-btn del" title="Remove" aria-label="Remove Key">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      `;

      row.addEventListener('click', async (e) => {
        if (e.target.closest('.row-mini-btn')) return;
        els.secretInput.value = item.secret;
        els.accountLabelInput.value = item.label || '';
        els.digitsSelect.value = String(item.digits || 6);
        els.periodSelect.value = String(item.period || 30);
        els.algoSelect.value = item.algorithm || 'SHA-1';
        state.digits = item.digits || 6;
        state.period = item.period || 30;
        state.algorithm = item.algorithm || 'SHA-1';
        updateParamSummary();
        handleInputChange(false);
        await refreshToken(true);
        if (state.currentCode) copyText(state.currentCode, 'Loaded & copied code!');
      });

      row.querySelector('.row-mini-btn.qr').addEventListener('click', (e) => {
        e.stopPropagation();
        const uri = buildOtpAuthUri({
          secret: item.secret,
          issuer: item.label || '2FA Live',
          account: item.label || 'Account',
          digits: item.digits || 6,
          period: item.period || 30,
          algorithm: item.algorithm || 'SHA-1',
        });
        modal.openQrPreview(item.label || '2FA QR Code', generateQRSvg(uri), uri);
      });

      row.querySelector('.row-mini-btn.del').addEventListener('click', (e) => {
        e.stopPropagation();
        state.recentKeys.splice(idx, 1);
        persistRecentKeys(state.recentKeys);
        renderRecentKeys();
      });

      els.recentList.appendChild(row);
    });

    refreshRecentCodes();
    animateDynamicCards(els.recentList, '.recent-row');
  }

  function handleInputChange(shouldSave) {
    const raw = els.secretInput.value;
    els.clearInputBtn.classList.toggle('hidden', raw.length === 0);

    if (!raw.trim()) {
      state.secret = '';
      state.currentCode = '';
      state.nextCode = '';
      els.inputFeedback.textContent = '';
      els.inputFeedback.className = 'input-feedback min-h-[18px] text-xs font-semibold';
      els.tokenValue.textContent = state.digits === 8 ? '---- ----' : '--- ---';
      els.nextTokenPreview.textContent = '';
      els.copyCodeBtn.disabled = true;
      return;
    }

    const parsed = parseInput(raw);
    if (!parsed || !isValidBase32(parsed.secret)) {
      state.secret = '';
      state.currentCode = '';
      els.inputFeedback.textContent = 'Invalid Base32 key — use characters A–Z and 2–7 (or a valid otpauth:// URI).';
      els.inputFeedback.className = 'input-feedback min-h-[18px] text-xs font-semibold error';
      els.tokenValue.textContent = state.digits === 8 ? '---- ----' : '--- ---';
      els.nextTokenPreview.textContent = '';
      els.copyCodeBtn.disabled = true;
      return;
    }

    if (parsed.isUri) {
      state.digits = parsed.digits;
      state.period = parsed.period;
      state.algorithm = parsed.algorithm;
      els.digitsSelect.value = String(parsed.digits);
      els.periodSelect.value = String(parsed.period);
      els.algoSelect.value = parsed.algorithm;
      const autoLabel = [parsed.issuer, parsed.label].filter(Boolean).join(' • ');
      if (autoLabel) {
        els.accountLabelInput.value = autoLabel;
        state.label = autoLabel;
      }
      updateParamSummary();
    } else {
      state.label = els.accountLabelInput.value.trim();
    }

    state.secret = parsed.secret;
    els.inputFeedback.textContent = parsed.isUri
      ? `Parsed otpauth:// URI (${state.digits}d • ${state.period}s • ${state.algorithm})`
      : `Valid Base32 key (${parsed.secret.length} chars)`;
    els.inputFeedback.className = 'input-feedback min-h-[18px] text-xs font-semibold valid';

    onStepReset();
    refreshToken(true);

    if (shouldSave && parsed.secret.length >= 8) {
      state.recentKeys = upsertRecentKey(state.recentKeys, state);
      renderRecentKeys();
    }
  }

  function copyActiveCode() {
    if (!state.currentCode) return;
    copyText(state.currentCode, 'Code copied to clipboard!');
    els.copyBtnLabel.textContent = 'Copied!';
    setTimeout(() => {
      els.copyBtnLabel.textContent = 'Copy Code';
    }, 1200);
  }

  function applyExternalInput(value, toastMessage) {
    els.secretInput.value = value;
    handleInputChange(true);
    if (toastMessage) showToast(toastMessage);
  }

  // Event bindings
  els.secretInput.addEventListener('input', () => handleInputChange(true));
  els.clearInputBtn.addEventListener('click', () => {
    els.secretInput.value = '';
    els.accountLabelInput.value = '';
    handleInputChange(false);
    els.secretInput.focus();
  });

  els.tryDemoBtn.addEventListener('click', () => {
    els.secretInput.value = DEMO_SECRET;
    els.accountLabelInput.value = 'Demo Account';
    handleInputChange(true);
    showToast('Loaded sample RFC 6238 secret key');
  });

  els.pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        showToast('Clipboard is empty', true);
        return;
      }
      applyExternalInput(text.trim(), 'Secret key pasted');
    } catch {
      showToast('Clipboard access denied — press Ctrl+V instead', true);
      els.secretInput.focus();
    }
  });

  els.advancedToggle.addEventListener('click', () => {
    const isHidden = els.advancedDrawer.classList.toggle('hidden');
    els.advancedToggle.setAttribute('aria-expanded', String(!isHidden));
  });

  const onParamChange = () => {
    state.digits = parseInt(els.digitsSelect.value, 10);
    state.period = parseInt(els.periodSelect.value, 10);
    state.algorithm = els.algoSelect.value;
    state.label = els.accountLabelInput.value.trim();
    updateParamSummary();
    onStepReset();
    refreshToken(true);
    if (state.secret && isValidBase32(state.secret)) {
      state.recentKeys = upsertRecentKey(state.recentKeys, state);
      renderRecentKeys();
    }
  };

  els.digitsSelect.addEventListener('change', onParamChange);
  els.periodSelect.addEventListener('change', onParamChange);
  els.algoSelect.addEventListener('change', onParamChange);
  els.accountLabelInput.addEventListener('change', onParamChange);

  els.copyCodeBtn.addEventListener('click', copyActiveCode);
  els.tokenDisplayBox.addEventListener('click', copyActiveCode);

  els.clearRecentBtn.addEventListener('click', () => {
    state.recentKeys = clearRecentKeys();
    renderRecentKeys();
    showToast('Local key cache cleared');
  });

  renderRecentKeys();

  return {
    getState: () => state,
    refreshAll: async () => {
      if (state.secret) await refreshToken(true);
      await refreshRecentCodes();
    },
    copyActiveCode,
    applyExternalInput,
  };
}
