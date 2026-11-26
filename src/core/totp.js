/**
 * RFC 6238 TOTP & Base32 Utilities
 * Uses native Web Crypto API (crypto.subtle) with CryptoKey memoization.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MAX_KEY_CACHE_SIZE = 64;
const keyCache = new Map();

export function normalizeSecret(raw) {
  if (!raw) return '';
  return raw.toUpperCase().replace(/[\s\-_=]+/g, '');
}

export function isValidBase32(secret) {
  const clean = normalizeSecret(secret);
  return clean.length >= 4 && /^[A-Z2-7]+$/.test(clean);
}

export function base32ToBytes(base32) {
  const clean = normalizeSecret(base32);
  let bits = 0;
  let value = 0;
  const output = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) {
      throw new Error(`Invalid Base32 character: "${clean[i]}"`);
    }
    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(output);
}

export function parseInput(rawInput) {
  const trimmed = (rawInput || '').trim();
  if (!trimmed) return null;

  if (trimmed.toLowerCase().startsWith('otpauth://')) {
    try {
      const url = new URL(trimmed);
      const params = url.searchParams;
      const secret = normalizeSecret(params.get('secret') || '');
      const rawLabel = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      let issuer = params.get('issuer') || '';
      let label = rawLabel;

      if (rawLabel.includes(':')) {
        const parts = rawLabel.split(':');
        if (!issuer) issuer = parts[0].trim();
        label = parts.slice(1).join(':').trim();
      }

      const digits = parseInt(params.get('digits') || '6', 10);
      const period = parseInt(params.get('period') || '30', 10);
      const algoRaw = (params.get('algorithm') || 'SHA1').toUpperCase().replace('-', '');
      const algorithm =
        algoRaw === 'SHA256' ? 'SHA-256' : algoRaw === 'SHA512' ? 'SHA-512' : 'SHA-1';

      return {
        secret,
        label,
        issuer,
        digits: digits === 8 ? 8 : 6,
        period: period > 0 && period <= 300 ? period : 30,
        algorithm,
        isUri: true,
      };
    } catch {
      return null;
    }
  }

  return {
    secret: normalizeSecret(trimmed),
    label: '',
    issuer: '',
    digits: 6,
    period: 30,
    algorithm: 'SHA-1',
    isUri: false,
  };
}

async function getImportedKey(cleanSecret, algorithm) {
  const cacheKey = `${algorithm}:${cleanSecret}`;
  const cached = keyCache.get(cacheKey);
  if (cached) return cached;

  const keyBytes = base32ToBytes(cleanSecret);
  if (keyBytes.length === 0) {
    throw new Error('Secret key is too short');
  }

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: algorithm } },
    false,
    ['sign']
  );

  if (keyCache.size >= MAX_KEY_CACHE_SIZE) {
    const oldestKey = keyCache.keys().next().value;
    keyCache.delete(oldestKey);
  }
  keyCache.set(cacheKey, cryptoKey);
  return cryptoKey;
}

export async function generateTOTP(
  secret,
  { digits = 6, period = 30, algorithm = 'SHA-1', timestamp = Date.now(), counterOffset = 0 } = {}
) {
  const cleanSecret = normalizeSecret(secret);
  const cryptoKey = await getImportedKey(cleanSecret, algorithm);

  const counter = Math.floor(timestamp / 1000 / period) + counterOffset;
  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  view.setUint32(0, Math.floor(counter / 0x100000000), false);
  view.setUint32(4, counter >>> 0, false);

  const hmac = new Uint8Array(await globalThis.crypto.subtle.sign('HMAC', cryptoKey, counterBuffer));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binary % Math.pow(10, digits)).toString().padStart(digits, '0');
}

export function formatToken(code) {
  if (!code) return '------';
  const mid = Math.ceil(code.length / 2);
  return `${code.slice(0, mid)} ${code.slice(mid)}`;
}

export function maskSecret(secret) {
  const clean = normalizeSecret(secret);
  if (clean.length <= 8) return `${clean.slice(0, 2)}••••${clean.slice(-2)}`;
  return `${clean.slice(0, 4)} •••• ${clean.slice(-4)}`;
}

export function generateRandomSecret(length = 16) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += BASE32_ALPHABET[bytes[i] % 32];
  }
  return out;
}

export function buildOtpAuthUri({
  secret,
  account = 'user@example.com',
  issuer = '2FA Live',
  digits = 6,
  period = 30,
  algorithm = 'SHA-1',
}) {
  const cleanSecret = normalizeSecret(secret);
  const label = issuer
    ? `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`
    : encodeURIComponent(account);
  const params = new URLSearchParams({
    secret: cleanSecret,
    issuer,
    algorithm: algorithm.replace('-', ''),
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function getTimeStepInfo(period = 30, nowMs = Date.now()) {
  const nowSec = nowMs / 1000;
  const elapsed = nowSec % period;
  const remaining = period - elapsed;
  return {
    remainingSeconds: Math.ceil(remaining),
    remainingFloat: remaining,
    progress: remaining / period,
    stepIndex: Math.floor(nowSec / period),
  };
}
