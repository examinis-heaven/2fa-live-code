/**
 * 60fps Liquid Countdown Ticker with Visibility Auto-Pause
 * Pauses rAF automatically when the browser tab is hidden (0% background CPU).
 */

import { getTimeStepInfo } from '../core/totp.js';

export function createTicker({
  getPeriod,
  liquidFillEl,
  ledBarEl,
  countdownPillEl,
  countdownTextEl,
  hudSyncEl,
  hudHexEl,
  bulkCountdownPillEl,
  bulkCountdownTextEl,
  onStepRotate,
}) {
  let rafId = 0;
  let lastStepIndex = -1;
  let lastTextSec = -1;
  let lastBulkSec = -1;

  function forceNextStep() {
    lastStepIndex = -1;
  }

  async function tick() {
    if (document.hidden) {
      rafId = 0;
      return;
    }

    const now = Date.now();
    const period = getPeriod();
    const { remainingSeconds, progress, stepIndex } = getTimeStepInfo(period, now);
    const expiring = remainingSeconds <= 5;

    if (liquidFillEl) {
      liquidFillEl.style.width = `${Math.max(2, progress * 100).toFixed(2)}%`;
    }

    if (remainingSeconds !== lastTextSec) {
      lastTextSec = remainingSeconds;
      countdownTextEl.textContent = `${remainingSeconds}s`;
      countdownPillEl.classList.toggle('expiring', expiring);
      ledBarEl.classList.toggle('expiring', expiring);
      hudHexEl.textContent = `0x${remainingSeconds.toString(16).toUpperCase().padStart(2, '0')}`;
      hudSyncEl.textContent = expiring ? 'ROTATING' : 'SYNC_OK';
    }

    const stdStep = getTimeStepInfo(30, now);
    if (stdStep.remainingSeconds !== lastBulkSec) {
      lastBulkSec = stdStep.remainingSeconds;
      bulkCountdownTextEl.textContent = `${stdStep.remainingSeconds}s`;
      bulkCountdownPillEl.classList.toggle('expiring', stdStep.remainingSeconds <= 5);
    }

    if (stepIndex !== lastStepIndex) {
      lastStepIndex = stepIndex;
      await onStepRotate();
    }

    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      lastTextSec = -1;
      lastBulkSec = -1;
      start();
    }
  });

  return { start, forceNextStep };
}
