import {
  normalizeSecret,
  isValidBase32,
  parseInput,
  generateTOTP,
  formatToken,
  maskSecret,
  generateRandomSecret,
  buildOtpAuthUri,
  getTimeStepInfo,
} from './totp.js';
import { generateQRSvg, decodeQRFromSource } from './qr.js';
import {
  initAnimations,
  moveLiquidTabPill,
  animatePanelIn,
  animateDynamicCards,
  animateModalIn,
  onModalClose,
} from './animations.js';

const STORAGE_RECENT_KEY = '2fa_live_recent_v1';
const STORAGE_THEME_KEY = '2fa_live_theme_v3';
const DEMO_SECRET = 'JBSWY3DPEHPK3PXP';

// --- DOM References ---
const $ = (id) => document.getElementById(id);

const els = {
  secretInput: $('secretInput'),
  clearInputBtn: $('clearInputBtn'),
  tryDemoBtn: $('tryDemoBtn'),
  inputFeedback: $('inputFeedback'),
  pasteBtn: $('pasteBtn'),
  scanQrBtn: $('scanQrBtn'),
  uploadQrBtn: $('uploadQrBtn'),
  qrFileInput: $('qrFileInput'),
  advancedToggle: $('advancedToggle'),
  advancedDrawer: $('advancedDrawer'),
  paramSummary: $('paramSummary'),
  accountLabelInput: $('accountLabelInput'),
  digitsSelect: $('digitsSelect'),
  periodSelect: $('periodSelect'),
  algoSelect: $('algoSelect'),
  countdownPill: $('countdownPill'),
  countdownText: $('countdownText'),
  ledBar: $('ledBar'),
  liquidFill: $('liquidFill'),
  hudSyncLabel: $('hudSyncLabel'),
  hudHexLabel: $('hudHexLabel'),
  tokenDisplayBox: $('tokenDisplayBox'),
  tokenValue: $('tokenValue'),
  nextTokenPreview: $('nextTokenPreview'),
  copyCodeBtn: $('copyCodeBtn'),
  copyBtnLabel: $('copyBtnLabel'),
  recentList: $('recentList'),
  clearRecentBtn: $('clearRecentBtn'),
  // Bulk tab
  bulkInput: $('bulkInput'),
  bulkDemoBtn: $('bulkDemoBtn'),
  bulkGrid: $('bulkGrid'),
  bulkCount: $('bulkCount'),
  bulkCountdownPill: $('bulkCountdownPill'),
  bulkCountdownText: $('bulkCountdownText'),
  // QR Export tab
  qrSecretInput: $('qrSecretInput'),
  qrIssuerInput: $('qrIssuerInput'),
  qrAccountInput: $('qrAccountInput'),
  qrUriOutput: $('qrUriOutput'),
  qrSvgContainer: $('qrSvgContainer'),
  genRandomSecretBtn: $('genRandomSecretBtn'),
  downloadQrSvgBtn: $('downloadQrSvgBtn'),
  copyQrUriBtn: $('copyQrUriBtn'),
  // Modals & Header
  themeToggle: $('themeToggle'),
  offlineStatus: $('offlineStatus'),
  scannerModal: $('scannerModal'),
  scannerVideo: $('scannerVideo'),
  scannerStatus: $('scannerStatus'),
  closeScannerBtn: $('closeScannerBtn'),
  infoModal: $('infoModal'),
  infoModalTitle: $('infoModalTitle'),
  infoModalBody: $('infoModalBody'),
  closeInfoModalBtn: $('closeInfoModalBtn'),
  toastContainer: $('toastContainer'),
};

// --- App State ---
const state = {
  activeTab: 'single',
  secret: '',
  label: '',
  digits: 6,
  period: 30,
  algorithm: 'SHA-1',
  currentCode: '',
  nextCode: '',
  lastStepIndex: -1,
  recentKeys: loadRecentKeys(),
  bulkEntries: [],
  scannerStream: null,
  scannerRaf: null,
  lastRenderedQrSvg: '',
};

// --- Initialization ---
initTheme();
initOfflineIndicator();
initTabs();
initEvents();
renderRecentKeys();
initQrExportDefaults();
startTicker();
initAnimations();

// --- Theme ---
function initTheme() {
  const saved = localStorage.getItem(STORAGE_THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  els.themeToggle.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_THEME_KEY, next);
  });
}

// --- Offline Status Indicator ---
function initOfflineIndicator() {
  const update = () => {
    const label = els.offlineStatus.querySelector('.status-label');
    if (navigator.onLine) {
      label.textContent = '100% Local';
    } else {
      label.textContent = 'Offline Active';
    }
  };
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
}

// --- Tabs ---
function initTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const initialActive = document.querySelector('.tab-btn.active');
  if (initialActive) {
    requestAnimationFrame(() => moveLiquidTabPill(initialActive, true));
  }
  window.addEventListener('resize', () => {
    const current = document.querySelector('.tab-btn.active');
    if (current) moveLiquidTabPill(current, true);
  });

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      state.activeTab = target;
      buttons.forEach((b) => {
        const isActive = b.dataset.tab === target;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', String(isActive));
      });
      moveLiquidTabPill(btn, false);
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        const isActive = panel.id === `panel-${target}`;
        panel.classList.toggle('active', isActive);
        if (isActive) animatePanelIn(panel);
      });

      if (target === 'qrgen' && state.secret && !els.qrSecretInput.value) {
        els.qrSecretInput.value = state.secret;
        updateQrExport();
      }
    });
  });
}

// --- Event Listeners ---
function initEvents() {
  // Single secret input
  els.secretInput.addEventListener('input', () => handleSecretInputChange(true));

  els.clearInputBtn.addEventListener('click', () => {
    els.secretInput.value = '';
    els.accountLabelInput.value = '';
    handleSecretInputChange(false);
    els.secretInput.focus();
  });

  els.tryDemoBtn.addEventListener('click', () => {
    els.secretInput.value = DEMO_SECRET;
    els.accountLabelInput.value = 'Demo Account';
    handleSecretInputChange(true);
    showToast('Loaded sample RFC 6238 secret key');
  });

  els.pasteBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        showToast('Clipboard is empty', true);
        return;
      }
      els.secretInput.value = text.trim();
      handleSecretInputChange(true);
      showToast('Secret key pasted');
    } catch {
      showToast('Clipboard access denied — press Ctrl+V instead', true);
      els.secretInput.focus();
    }
  });

  // Advanced drawer
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
    state.lastStepIndex = -1;
    refreshSingleToken(true);
    if (state.secret && isValidBase32(state.secret)) {
      saveRecentKey(state.secret, state.label, state.digits, state.period, state.algorithm);
    }
  };

  els.digitsSelect.addEventListener('change', onParamChange);
  els.periodSelect.addEventListener('change', onParamChange);
  els.algoSelect.addEventListener('change', onParamChange);
  els.accountLabelInput.addEventListener('change', onParamChange);

  // Copy active token
  const triggerCopyActive = () => {
    if (!state.currentCode) return;
    copyText(state.currentCode, 'Code copied to clipboard!');
    els.copyBtnLabel.textContent = 'Copied!';
    setTimeout(() => {
      els.copyBtnLabel.textContent = 'Copy Code';
    }, 1200);
  };

  els.copyCodeBtn.addEventListener('click', triggerCopyActive);
  els.tokenDisplayBox.addEventListener('click', triggerCopyActive);

  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeScanner();
      closeInfoModal();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      const sel = window.getSelection()?.toString();
      if (!sel && state.activeTab === 'single' && state.currentCode) {
        e.preventDefault();
        triggerCopyActive();
      }
    }
  });

  // Clear recent keys
  els.clearRecentBtn.addEventListener('click', () => {
    state.recentKeys = [];
    localStorage.removeItem(STORAGE_RECENT_KEY);
    renderRecentKeys();
    showToast('Local key cache cleared');
  });

  // QR Scan & Upload
  els.scanQrBtn.addEventListener('click', openScanner);
  els.closeScannerBtn.addEventListener('click', closeScanner);
  els.scannerModal.addEventListener('click', (e) => {
    if (e.target === els.scannerModal) closeScanner();
  });

  els.uploadQrBtn.addEventListener('click', () => els.qrFileInput.click());
  els.qrFileInput.addEventListener('change', handleQrImageUpload);

  // Bulk Tab
  els.bulkInput.addEventListener('input', parseBulkInput);
  els.bulkDemoBtn.addEventListener('click', () => {
    els.bulkInput.value = [
      'GitHub: JBSWY3DPEHPK3PXP',
      'Binance: HXDMVJECJJWSRB3H',
      'Discord: GEZDGNBVGY3TQOJQ',
      'Cloudflare: MZXW6YTBOI======',
    ].join('\n');
    parseBulkInput();
    showToast('Loaded 4 sample 2FA accounts');
  });

  // QR Export Tab
  [els.qrSecretInput, els.qrIssuerInput, els.qrAccountInput].forEach((el) => {
    el.addEventListener('input', updateQrExport);
  });
  els.genRandomSecretBtn.addEventListener('click', () => {
    els.qrSecretInput.value = generateRandomSecret(16);
    updateQrExport();
    showToast('Generated secure random Base32 secret');
  });
  els.copyQrUriBtn.addEventListener('click', () => {
    if (els.qrUriOutput.value) copyText(els.qrUriOutput.value, 'otpauth:// URI copied!');
  });
  els.downloadQrSvgBtn.addEventListener('click', () => {
    if (!state.lastRenderedQrSvg) return;
    const blob = new Blob([state.lastRenderedQrSvg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const name = (els.qrIssuerInput.value || '2fa-qr').replace(/[^a-z0-9-_]+/gi, '_').toLowerCase();
    a.download = `${name}-2fa-qr.svg`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('QR SVG downloaded');
  });

  // Info & Legal Modals
  document.querySelectorAll('[data-modal]').forEach((btn) => {
    btn.addEventListener('click', () => openLegalModal(btn.dataset.modal));
  });
  els.closeInfoModalBtn.addEventListener('click', closeInfoModal);
  els.infoModal.addEventListener('click', (e) => {
    if (e.target === els.infoModal) closeInfoModal();
  });
}

// --- Single Key Handling ---
function handleSecretInputChange(shouldSave) {
  const raw = els.secretInput.value;
  els.clearInputBtn.classList.toggle('hidden', raw.length === 0);

  if (!raw.trim()) {
    state.secret = '';
    state.currentCode = '';
    state.nextCode = '';
    els.inputFeedback.textContent = '';
    els.inputFeedback.className = 'input-feedback';
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
    els.inputFeedback.className = 'input-feedback error';
    els.tokenValue.textContent = state.digits === 8 ? '---- ----' : '--- ---';
    els.nextTokenPreview.textContent = '';
    els.copyCodeBtn.disabled = true;
    return;
  }

  // If user pasted an otpauth:// URI, apply its parameters automatically
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
  els.inputFeedback.className = 'input-feedback valid';

  state.lastStepIndex = -1;
  refreshSingleToken(true);

  if (shouldSave && parsed.secret.length >= 8) {
    saveRecentKey(parsed.secret, state.label, state.digits, state.period, state.algorithm);
  }
}

function updateParamSummary() {
  els.paramSummary.textContent = `${state.digits}d • ${state.period}s • ${state.algorithm}`;
}

async function refreshSingleToken(animate = false) {
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
      void els.tokenValue.offsetWidth; // trigger reflow for animation
      els.tokenValue.classList.add('pulse');
    }
  } catch {
    els.copyCodeBtn.disabled = true;
  }
}

// --- Master Ticker (60fps smooth liquid clay + step-triggered TOTP refresh) ---
function startTicker() {
  let lastTextSec = -1;
  let lastBulkSec = -1;

  const frame = async () => {
    const now = Date.now();
    const { remainingSeconds, progress, stepIndex } = getTimeStepInfo(state.period, now);
    const expiring = remainingSeconds <= 5;

    // Smooth continuous 60fps liquid clay fill
    if (els.liquidFill) {
      els.liquidFill.style.width = `${Math.max(2, progress * 100).toFixed(2)}%`;
    }

    // Update text labels only when integer second changes
    if (remainingSeconds !== lastTextSec) {
      lastTextSec = remainingSeconds;
      els.countdownText.textContent = `${remainingSeconds}s`;
      els.countdownPill.classList.toggle('expiring', expiring);
      els.ledBar.classList.toggle('expiring', expiring);
      els.hudHexLabel.textContent = `0x${remainingSeconds.toString(16).toUpperCase().padStart(2, '0')}`;
      els.hudSyncLabel.textContent = expiring ? 'ROTATING' : 'SYNC_OK';
    }

    // Bulk countdown pill (30s standard)
    const stdStep = getTimeStepInfo(30, now);
    if (stdStep.remainingSeconds !== lastBulkSec) {
      lastBulkSec = stdStep.remainingSeconds;
      els.bulkCountdownText.textContent = `${stdStep.remainingSeconds}s`;
      els.bulkCountdownPill.classList.toggle('expiring', stdStep.remainingSeconds <= 5);
    }

    // Refresh tokens only when the time step rotates
    if (stepIndex !== state.lastStepIndex) {
      state.lastStepIndex = stepIndex;
      if (state.secret) await refreshSingleToken(true);
      await refreshRecentCodes();
      if (state.bulkEntries.length > 0) await refreshBulkCodes();
    }

    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

// --- Recent Keys Local Vault ---
function loadRecentKeys() {
  try {
    const raw = localStorage.getItem(STORAGE_RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveRecentKey(secret, label = '', digits = 6, period = 30, algorithm = 'SHA-1') {
  const clean = normalizeSecret(secret);
  const existingIdx = state.recentKeys.findIndex((k) => k.secret === clean);
  const entry = {
    secret: clean,
    label: label || (existingIdx >= 0 ? state.recentKeys[existingIdx].label : ''),
    digits,
    period,
    algorithm,
    updatedAt: Date.now(),
  };

  if (existingIdx >= 0) state.recentKeys.splice(existingIdx, 1);
  state.recentKeys.unshift(entry);
  if (state.recentKeys.length > 10) state.recentKeys.length = 10;

  try {
    localStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(state.recentKeys));
  } catch {
    // Ignore storage quota issues
  }
  renderRecentKeys();
}

function renderRecentKeys() {
  els.clearRecentBtn.classList.toggle('hidden', state.recentKeys.length === 0);

  if (state.recentKeys.length === 0) {
    els.recentList.innerHTML =
      '<div class="recent-empty">No recent keys yet. Paste a secret key or click <strong>Try Demo</strong>.</div>';
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
      handleSecretInputChange(false);
      await refreshSingleToken(true);
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
      const svg = generateQRSvg(uri);
      els.infoModalTitle.textContent = item.label || '2FA QR Code';
      els.infoModalBody.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;">
          <div class="qr-stage">${svg}</div>
          <code class="mono" style="font-size:0.75rem;word-break:break-all;text-align:center;">${escapeHtml(uri)}</code>
        </div>
      `;
      els.infoModal.classList.remove('hidden');
      animateModalIn(els.infoModal);
    });

    row.querySelector('.row-mini-btn.del').addEventListener('click', (e) => {
      e.stopPropagation();
      state.recentKeys.splice(idx, 1);
      localStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(state.recentKeys));
      renderRecentKeys();
    });

    els.recentList.appendChild(row);
  });

  refreshRecentCodes();
  animateDynamicCards(els.recentList, '.recent-row');
}

async function refreshRecentCodes() {
  for (let i = 0; i < state.recentKeys.length; i++) {
    const item = state.recentKeys[i];
    const codeEl = els.recentList.querySelector(`[data-recent-code="${i}"]`);
    if (!codeEl) continue;
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
  }
}

// --- Bulk / Multi-2FA Mode ---
function parseBulkInput() {
  const lines = els.bulkInput.value
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const entries = [];
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

  state.bulkEntries = entries;
  els.bulkCount.textContent = String(entries.length);
  renderBulkGrid();
}

function renderBulkGrid() {
  if (state.bulkEntries.length === 0) {
    els.bulkGrid.innerHTML =
      '<div class="recent-empty">Enter one or more secret keys above to monitor all live 2FA codes simultaneously.</div>';
    return;
  }

  els.bulkGrid.innerHTML = '';
  state.bulkEntries.forEach((item, idx) => {
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
      const code = card.dataset.rawCode;
      if (code) copyText(code, `Copied ${item.label} code!`);
    });
    els.bulkGrid.appendChild(card);
  });

  refreshBulkCodes();
  animateDynamicCards(els.bulkGrid, '.bulk-card');
}

async function refreshBulkCodes() {
  for (let i = 0; i < state.bulkEntries.length; i++) {
    const item = state.bulkEntries[i];
    const codeEl = els.bulkGrid.querySelector(`[data-bulk-code="${i}"]`);
    if (!codeEl) continue;
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
  }
}

// --- QR Export Tab ---
function initQrExportDefaults() {
  els.qrSecretInput.value = DEMO_SECRET;
  updateQrExport();
}

function updateQrExport() {
  const secret = normalizeSecret(els.qrSecretInput.value);
  if (!isValidBase32(secret)) {
    els.qrUriOutput.value = '';
    els.qrSvgContainer.innerHTML = '<span class="recent-empty">Enter a valid Base32 secret</span>';
    state.lastRenderedQrSvg = '';
    return;
  }

  const uri = buildOtpAuthUri({
    secret,
    issuer: els.qrIssuerInput.value.trim() || '2FA Live',
    account: els.qrAccountInput.value.trim() || 'user@example.com',
    digits: state.digits,
    period: state.period,
    algorithm: state.algorithm,
  });

  els.qrUriOutput.value = uri;
  try {
    const svg = generateQRSvg(uri);
    state.lastRenderedQrSvg = svg;
    els.qrSvgContainer.innerHTML = svg;
  } catch (err) {
    els.qrSvgContainer.innerHTML = `<span class="recent-empty">${escapeHtml(err.message)}</span>`;
  }
}

// --- Webcam QR Scanner & Image Upload ---
async function openScanner() {
  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('Camera API not supported in this browser — use Upload QR instead', true);
    return;
  }

  els.scannerModal.classList.remove('hidden');
  animateModalIn(els.scannerModal);
  els.scannerStatus.textContent = 'Requesting camera permission...';

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    state.scannerStream = stream;
    els.scannerVideo.srcObject = stream;
    await els.scannerVideo.play();
    els.scannerStatus.textContent = 'Point your camera at a 2FA QR code...';

    const scanLoop = async () => {
      if (!state.scannerStream) return;
      try {
        const result = await decodeQRFromSource(els.scannerVideo);
        if (result) {
          closeScanner();
          els.secretInput.value = result;
          handleSecretInputChange(true);
          showToast('QR code scanned successfully!');
          return;
        }
      } catch {
        // Continue scanning
      }
      state.scannerRaf = setTimeout(scanLoop, 220);
    };
    scanLoop();
  } catch {
    els.scannerStatus.textContent = 'Unable to access camera. Check browser permissions or upload a QR image.';
  }
}

function closeScanner() {
  if (state.scannerRaf) {
    clearTimeout(state.scannerRaf);
    state.scannerRaf = null;
  }
  if (state.scannerStream) {
    state.scannerStream.getTracks().forEach((t) => t.stop());
    state.scannerStream = null;
  }
  els.scannerVideo.srcObject = null;
  els.scannerModal.classList.add('hidden');
  onModalClose();
}

async function handleQrImageUpload(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;

  try {
    const bitmap = await createImageBitmap(file);
    const decoded = await decodeQRFromSource(bitmap);
    bitmap.close?.();
    if (!decoded) {
      showToast('No QR code detected in that image', true);
      return;
    }
    els.secretInput.value = decoded;
    handleSecretInputChange(true);
    showToast('QR code decoded from image!');
  } catch (err) {
    showToast(err.message || 'Failed to read QR image', true);
  }
}

// --- Legal / Info Modals ---
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

function openLegalModal(key) {
  const data = LEGAL_CONTENT[key];
  if (!data) return;
  els.infoModalTitle.textContent = data.title;
  els.infoModalBody.innerHTML = data.html;
  els.infoModal.classList.remove('hidden');
  animateModalIn(els.infoModal);
}

function closeInfoModal() {
  els.infoModal.classList.add('hidden');
  onModalClose();
}

// --- Utilities ---
async function copyText(text, successMsg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast(successMsg);
  }
}

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `toast${isError ? ' error' : ''}`;
  toast.textContent = message;
  els.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(6px)';
    toast.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    setTimeout(() => toast.remove(), 220);
  }, 2400);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}
