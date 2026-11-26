/**
 * 2FA Live Code — Application Entrypoint & Bootstrapper
 */

import { getSavedTheme, saveTheme } from './core/storage.js';
import { initToast } from './ui/toast.js';
import { initAnimations, moveLiquidTabPill, animatePanelIn } from './ui/animations.js';
import { createModalController } from './ui/modal.js';
import { createScannerController } from './ui/scanner.js';
import { createSingleMode } from './ui/single-mode.js';
import { createBulkMode } from './ui/bulk-mode.js';
import { createQrExportMode } from './ui/qr-export-mode.js';
import { createTicker } from './ui/ticker.js';

const $ = (id) => document.getElementById(id);

function initTheme(toggleBtn) {
  const initial = getSavedTheme('dark');
  document.documentElement.setAttribute('data-theme', initial);
  toggleBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    saveTheme(next);
  });
}

function initOfflineIndicator(statusEl) {
  const label = statusEl.querySelector('.status-label');
  const update = () => {
    label.textContent = navigator.onLine ? '100% Local' : 'Offline Active';
  };
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
}

function bootstrap() {
  initToast($('toastContainer'));
  initTheme($('themeToggle'));
  initOfflineIndicator($('offlineStatus'));

  const modal = createModalController({
    modalEl: $('infoModal'),
    titleEl: $('infoModalTitle'),
    bodyEl: $('infoModalBody'),
    closeBtn: $('closeInfoModalBtn'),
  });

  let ticker = null;

  const singleMode = createSingleMode({
    els: {
      secretInput: $('secretInput'),
      clearInputBtn: $('clearInputBtn'),
      tryDemoBtn: $('tryDemoBtn'),
      inputFeedback: $('inputFeedback'),
      pasteBtn: $('pasteBtn'),
      advancedToggle: $('advancedToggle'),
      advancedDrawer: $('advancedDrawer'),
      paramSummary: $('paramSummary'),
      accountLabelInput: $('accountLabelInput'),
      digitsSelect: $('digitsSelect'),
      periodSelect: $('periodSelect'),
      algoSelect: $('algoSelect'),
      tokenDisplayBox: $('tokenDisplayBox'),
      tokenValue: $('tokenValue'),
      nextTokenPreview: $('nextTokenPreview'),
      copyCodeBtn: $('copyCodeBtn'),
      copyBtnLabel: $('copyBtnLabel'),
      recentList: $('recentList'),
      clearRecentBtn: $('clearRecentBtn'),
    },
    modal,
    onStepReset: () => ticker?.forceNextStep(),
  });

  const bulkMode = createBulkMode({
    inputEl: $('bulkInput'),
    demoBtn: $('bulkDemoBtn'),
    gridEl: $('bulkGrid'),
    countEl: $('bulkCount'),
  });

  const qrExportMode = createQrExportMode({
    secretInput: $('qrSecretInput'),
    issuerInput: $('qrIssuerInput'),
    accountInput: $('qrAccountInput'),
    uriOutput: $('qrUriOutput'),
    svgContainer: $('qrSvgContainer'),
    randomBtn: $('genRandomSecretBtn'),
    downloadBtn: $('downloadQrSvgBtn'),
    copyUriBtn: $('copyQrUriBtn'),
    getTotpParams: () => singleMode.getState(),
  });

  const scanner = createScannerController({
    modalEl: $('scannerModal'),
    videoEl: $('scannerVideo'),
    statusEl: $('scannerStatus'),
    closeBtn: $('closeScannerBtn'),
    scanBtn: $('scanQrBtn'),
    uploadBtn: $('uploadQrBtn'),
    fileInput: $('qrFileInput'),
    onDecoded: (val, msg) => singleMode.applyExternalInput(val, msg),
  });

  // Tabs with Flowing Liquid Pill
  let activeTab = 'single';
  const tabButtons = document.querySelectorAll('.tab-btn');
  const initialActive = document.querySelector('.tab-btn.active');
  if (initialActive) requestAnimationFrame(() => moveLiquidTabPill(initialActive, true));

  window.addEventListener('resize', () => {
    const current = document.querySelector('.tab-btn.active');
    if (current) moveLiquidTabPill(current, true);
  });

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      tabButtons.forEach((b) => {
        const isActive = b.dataset.tab === activeTab;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', String(isActive));
      });
      moveLiquidTabPill(btn, false);
      document.querySelectorAll('.tab-panel').forEach((panel) => {
        const isActive = panel.id === `panel-${activeTab}`;
        panel.classList.toggle('active', isActive);
        if (isActive) animatePanelIn(panel);
      });
      if (activeTab === 'qrgen') {
        qrExportMode.syncSecretIfEmpty(singleMode.getState().secret);
      }
    });
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      scanner.close();
      modal.close();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      const sel = window.getSelection()?.toString();
      if (!sel && activeTab === 'single' && singleMode.getState().currentCode) {
        e.preventDefault();
        singleMode.copyActiveCode();
      }
    }
  });

  // 60fps Ticker with visibility auto-pause
  ticker = createTicker({
    getPeriod: () => singleMode.getState().period,
    liquidFillEl: $('liquidFill'),
    ledBarEl: $('ledBar'),
    countdownPillEl: $('countdownPill'),
    countdownTextEl: $('countdownText'),
    hudSyncEl: $('hudSyncLabel'),
    hudHexEl: $('hudHexLabel'),
    bulkCountdownPillEl: $('bulkCountdownPill'),
    bulkCountdownTextEl: $('bulkCountdownText'),
    onStepRotate: async () => {
      await Promise.all([singleMode.refreshAll(), bulkMode.refreshCodes()]);
    },
  });

  ticker.start();
  initAnimations();
}

bootstrap();
