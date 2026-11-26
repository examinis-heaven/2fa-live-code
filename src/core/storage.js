/**
 * Safe localStorage Persistence Layer
 * Encapsulates theme preferences and the local recent-keys vault.
 */

import { normalizeSecret } from './totp.js';

const STORAGE_RECENT_KEY = '2fa_live_recent_v1';
const STORAGE_THEME_KEY = '2fa_live_theme_v3';
const MAX_RECENT_KEYS = 10;

export function getSavedTheme(fallback = 'dark') {
  try {
    return localStorage.getItem(STORAGE_THEME_KEY) || fallback;
  } catch {
    return fallback;
  }
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_THEME_KEY, theme);
  } catch {
    // Ignore storage quota / private-mode restrictions
  }
}

export function loadRecentKeys() {
  try {
    const raw = localStorage.getItem(STORAGE_RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistRecentKeys(keys) {
  try {
    localStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(keys));
  } catch {
    // Ignore storage quota issues
  }
}

export function upsertRecentKey(keys, { secret, label = '', digits = 6, period = 30, algorithm = 'SHA-1' }) {
  const clean = normalizeSecret(secret);
  const next = [...keys];
  const existingIdx = next.findIndex((k) => k.secret === clean);

  const entry = {
    secret: clean,
    label: label || (existingIdx >= 0 ? next[existingIdx].label : ''),
    digits,
    period,
    algorithm,
    updatedAt: Date.now(),
  };

  if (existingIdx >= 0) next.splice(existingIdx, 1);
  next.unshift(entry);
  if (next.length > MAX_RECENT_KEYS) next.length = MAX_RECENT_KEYS;

  persistRecentKeys(next);
  return next;
}

export function clearRecentKeys() {
  try {
    localStorage.removeItem(STORAGE_RECENT_KEY);
  } catch {
    // Ignore
  }
  return [];
}
