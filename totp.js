/**
 * Lightweight RFC 6238 TOTP & RFC 4226 HOTP Engine
 * Uses native Web Crypto API (crypto.subtle) — zero external dependencies.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Clean and normalize a Base32 secret string.
 * Strips spaces, hyphens, and converts to uppercase.
 */
export function normalizeSecret(raw) {
  if (!raw) return '';
  return raw.toUpperCase().replace(/[\s\-_=]+/g, '');
}

/**
 * Validate whether a string is a valid Base32 secret (minimum 8 chars recommended,
 * accepts >= 4 valid base32 chars for testing).
 */
export function isValidBase32(secret) {
  const clean = normalizeSecret(secret);
  if (clean.length < 4) return false;
  return /^[A-Z2-7]+$/.test(clean);
}

/**
 * Decode a Base32 string into a Uint8Array.
 */
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

/**
 * Parse either a raw Base32 key OR an `otpauth://totp/...` URI.
 * Returns { secret, label, issuer, digits, period, algorithm, isUri }
 */
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

/**
 * Generate an RFC 6238 TOTP token using Web Crypto API.
 * @param {string} secret - Base32 secret
 * @param {object} [options]
 * @param {number} [options.digits=6] - 6 or 8 digits
 * @param {number} [options.period=30] - time step in seconds
 * @param {string} [options.algorithm='SHA-1'] - 'SHA-1' | 'SHA-256' | 'SHA-512'
 * @param {number} [options.timestamp=Date.now()] - Unix time in ms
 * @param {number} [options.counterOffset=0] - e.g. +1 for next token
 * @returns {Promise<string>} Zero-padded token string
 */
export async function generateTOTP(
  secret,
  { digits = 6, period = 30, algorithm = 'SHA-1', timestamp = Date.now(), counterOffset = 0 } = {}
) {
  const keyBytes = base32ToBytes(secret);
  if (keyBytes.length === 0) {
    throw new Error('Secret key is too short');
  }

  const counter = Math.floor(timestamp / 1000 / period) + counterOffset;
  const counterBuffer = new ArrayBuffer(8);
  const view = new DataView(counterBuffer);
  // Write 64-bit big-endian unsigned integer
  const high = Math.floor(counter / 0x100000000);
  const low = counter >>> 0;
  view.setUint32(0, high, false);
  view.setUint32(4, low, false);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: { name: algorithm } },
    false,
    ['sign']
  );

  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer));
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * Format a 6-digit or 8-digit token with a center space: "123 456" or "1234 5678".
 */
export function formatToken(code) {
  if (!code) return '------';
  const mid = Math.ceil(code.length / 2);
  return `${code.slice(0, mid)} ${code.slice(mid)}`;
}

/**
 * Mask a secret key for display in local cache: "JBSW •••• P3XP"
 */
export function maskSecret(secret) {
  const clean = normalizeSecret(secret);
  if (clean.length <= 8) return clean.slice(0, 2) + '••••' + clean.slice(-2);
  return `${clean.slice(0, 4)} •••• ${clean.slice(-4)}`;
}

/**
 * Generate a random cryptographically secure Base32 secret (default 16 or 32 chars).
 */
export function generateRandomSecret(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += BASE32_ALPHABET[bytes[i] % 32];
  }
  return out;
}

/**
 * Build an `otpauth://totp/...` URI string.
 */
export function buildOtpAuthUri({ secret, account = 'user@example.com', issuer = '2FA Live', digits = 6, period = 30, algorithm = 'SHA-1' }) {
  const cleanSecret = normalizeSecret(secret);
  const label = issuer ? `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}` : encodeURIComponent(account);
  const algoParam = algorithm.replace('-', '');
  const params = new URLSearchParams({
    secret: cleanSecret,
    issuer,
    algorithm: algoParam,
    digits: String(digits),
    period: String(period),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/**
 * Return remaining seconds and smooth progress [0..1] for a given period.
 */
export function getTimeStepInfo(period = 30, nowMs = Date.now()) {
  const nowSec = nowMs / 1000;
  const elapsed = nowSec % period;
  const remaining = period - elapsed;
  const remainingInt = Math.ceil(remaining);
  return {
    remainingSeconds: remainingInt,
    remainingFloat: remaining,
    progress: remaining / period, // 1 -> 0
    stepIndex: Math.floor(nowSec / period),
  };
}
