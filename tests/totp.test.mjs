import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeSecret,
  isValidBase32,
  parseInput,
  generateTOTP,
  formatToken,
  maskSecret,
  buildOtpAuthUri,
} from '../src/core/totp.js';
import { generateQRMatrix, generateQRSvg } from '../src/core/qr-encoder.js';

// Official RFC 6238 Appendix B test vectors
// ASCII secret: "12345678901234567890" -> Base32: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
const RFC_SHA1_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
// 32-byte ASCII secret for SHA-256: "12345678901234567890123456789012"
const RFC_SHA256_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQGEZA';

test('RFC 6238 TOTP SHA-1 official test vectors (8 digits)', async () => {
  const code59 = await generateTOTP(RFC_SHA1_SECRET, {
    digits: 8,
    period: 30,
    algorithm: 'SHA-1',
    timestamp: 59 * 1000,
  });
  assert.equal(code59, '94287082');

  const code1111111109 = await generateTOTP(RFC_SHA1_SECRET, {
    digits: 8,
    period: 30,
    algorithm: 'SHA-1',
    timestamp: 1111111109 * 1000,
  });
  assert.equal(code1111111109, '07081804');
});

test('RFC 6238 TOTP SHA-256 official test vector (8 digits)', async () => {
  const code59 = await generateTOTP(RFC_SHA256_SECRET, {
    digits: 8,
    period: 30,
    algorithm: 'SHA-256',
    timestamp: 59 * 1000,
  });
  assert.equal(code59, '46119246');
});

test('Base32 normalization, validation, formatting & masking', () => {
  assert.equal(normalizeSecret(' jbsw-y3dp ehpk 3pxp=== '), 'JBSWY3DPEHPK3PXP');
  assert.equal(isValidBase32('JBSWY3DPEHPK3PXP'), true);
  assert.equal(isValidBase32('INVALID_0189!'), false);
  assert.equal(formatToken('123456'), '123 456');
  assert.equal(formatToken('12345678'), '1234 5678');
  assert.equal(maskSecret('JBSWY3DPEHPK3PXP'), 'JBSW •••• 3PXP');
});

test('otpauth:// URI parsing and building', () => {
  const uri = buildOtpAuthUri({
    secret: 'JBSWY3DPEHPK3PXP',
    issuer: 'GitHub',
    account: 'dev@example.com',
    digits: 8,
    period: 60,
    algorithm: 'SHA-256',
  });
  const parsed = parseInput(uri);
  assert.equal(parsed.isUri, true);
  assert.equal(parsed.secret, 'JBSWY3DPEHPK3PXP');
  assert.equal(parsed.issuer, 'GitHub');
  assert.equal(parsed.label, 'dev@example.com');
  assert.equal(parsed.digits, 8);
  assert.equal(parsed.period, 60);
  assert.equal(parsed.algorithm, 'SHA-256');
});

test('Offline QR matrix & SVG encoder generates valid square matrix and SVG', () => {
  const uri = 'otpauth://totp/2FA%20Live:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=2FA%20Live';
  const matrix = generateQRMatrix(uri);
  assert.ok(matrix.length >= 21);
  assert.equal(matrix.length, matrix[0].length);

  const svg = generateQRSvg(uri);
  assert.ok(svg.startsWith('<svg '));
  assert.ok(svg.includes('<path d="M'));
});
