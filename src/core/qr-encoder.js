/**
 * Pure JavaScript Offline QR Code Matrix & SVG Encoder
 * ISO/IEC 18004 — Byte mode, ECC Level M, Versions 1–10 (zero dependencies).
 */

const QR_VERSIONS_M = [
  null,
  [1, 26, 10, 1, []],
  [2, 44, 16, 1, [6, 18]],
  [3, 70, 26, 1, [6, 22]],
  [4, 100, 18, 2, [6, 26]],
  [5, 134, 24, 2, [6, 30]],
  [6, 172, 16, 4, [6, 34]],
  [7, 196, 18, 4, [6, 22, 38]],
  [8, 242, 22, 4, [6, 24, 42]],
  [9, 292, 22, 5, [6, 26, 46]],
  [10, 346, 26, 5, [6, 28, 50]],
];

const QR_BLOCKS_M = [
  null,
  [1, 16, 0, 0],
  [1, 28, 0, 0],
  [1, 44, 0, 0],
  [2, 32, 0, 0],
  [2, 43, 0, 0],
  [4, 27, 0, 0],
  [4, 31, 0, 0],
  [2, 38, 2, 39],
  [3, 36, 2, 37],
  [4, 43, 1, 44],
];

const FORMAT_BITS_M = [0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0];
const VERSION_BITS = { 7: 0x07c94, 8: 0x085bc, 9: 0x09a99, 10: 0x0a4d3 };

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
})();

function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGeneratorPoly(degree) {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data, ecLen) {
  const gen = rsGeneratorPoly(ecLen);
  const res = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) res[j] ^= gfMul(gen[j + 1], factor);
    }
  }
  return res;
}

function chooseVersion(byteLen) {
  for (let v = 1; v <= 10; v++) {
    const [g1b, g1d, g2b, g2d] = QR_BLOCKS_M[v];
    const dataCapacity = g1b * g1d + g2b * g2d;
    const countBits = v <= 9 ? 8 : 16;
    if (Math.ceil((4 + countBits + byteLen * 8) / 8) <= dataCapacity) return v;
  }
  throw new Error('Data too long for QR code');
}

function encodeDataBits(bytes, version) {
  const [g1b, g1d, g2b, g2d] = QR_BLOCKS_M[version];
  const totalDataBytes = g1b * g1d + g2b * g2d;
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  pushBits(0b0100, 4);
  pushBits(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) pushBits(b, 8);

  const maxBits = totalDataBytes * 8;
  pushBits(0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords = new Uint8Array(totalDataBytes);
  let idx = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b];
    codewords[idx++] = byte;
  }

  const pads = [0xec, 0x11];
  let padIdx = 0;
  while (idx < totalDataBytes) codewords[idx++] = pads[padIdx++ % 2];
  return codewords;
}

function interleaveBlocks(dataCW, version) {
  const ecPerBlock = QR_VERSIONS_M[version][2];
  const [g1b, g1d, g2b, g2d] = QR_BLOCKS_M[version];
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;

  for (let i = 0; i < g1b; i++) {
    const block = dataCW.slice(offset, offset + g1d);
    offset += g1d;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecPerBlock));
  }
  for (let i = 0; i < g2b; i++) {
    const block = dataCW.slice(offset, offset + g2d);
    offset += g2d;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecPerBlock));
  }

  const out = [];
  const maxDataLen = Math.max(g1d, g2d);
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of dataBlocks) if (i < blk.length) out.push(blk[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const blk of ecBlocks) out.push(blk[i]);
  }
  return new Uint8Array(out);
}

function createMatrix(size) {
  return Array.from({ length: size }, () => new Int8Array(size));
}

function drawFinder(m, isFunc, r, c) {
  const size = m.length;
  for (let dr = -1; dr <= 7; dr++) {
    for (let dc = -1; dc <= 7; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      const inOuter = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
      const isDark =
        inOuter &&
        (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      m[rr][cc] = isDark ? 1 : -1;
      isFunc[rr][cc] = 1;
    }
  }
}

function drawAlignment(m, isFunc, r, c) {
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      m[r + dr][c + dc] = Math.max(Math.abs(dr), Math.abs(dc)) !== 1 ? 1 : -1;
      isFunc[r + dr][c + dc] = 1;
    }
  }
}

function drawFormatBits(m, mask) {
  const size = m.length;
  const bits = FORMAT_BITS_M[mask];
  for (let i = 0; i <= 5; i++) m[8][i] = (bits >>> (14 - i)) & 1 ? 1 : -1;
  m[8][7] = (bits >>> 8) & 1 ? 1 : -1;
  m[8][8] = (bits >>> 7) & 1 ? 1 : -1;
  m[7][8] = (bits >>> 6) & 1 ? 1 : -1;
  for (let i = 9; i < 15; i++) m[14 - i][8] = (bits >>> (14 - i)) & 1 ? 1 : -1;
  for (let i = 0; i < 8; i++) m[size - 1 - i][8] = (bits >>> i) & 1 ? 1 : -1;
  for (let i = 8; i < 15; i++) m[8][size - 15 + i] = (bits >>> i) & 1 ? 1 : -1;
  m[size - 8][8] = 1;
}

function drawVersionBits(m, isFunc, version) {
  if (version < 7) return;
  const size = m.length;
  const bits = VERSION_BITS[version];
  for (let i = 0; i < 18; i++) {
    const dark = (bits >>> i) & 1 ? 1 : -1;
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    m[a][b] = dark;
    m[b][a] = dark;
    isFunc[a][b] = 1;
    isFunc[b][a] = 1;
  }
}

function maskCondition(mask, r, c) {
  switch (mask) {
    case 0: return (r + c) % 2 === 0;
    case 1: return r % 2 === 0;
    case 2: return c % 3 === 0;
    case 3: return (r + c) % 3 === 0;
    case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    default: return false;
  }
}

function computePenalty(m) {
  const n = m.length;
  let penalty = 0;

  for (let r = 0; r < n; r++) {
    let run = 1;
    for (let c = 1; c < n; c++) {
      if (m[r][c] === m[r][c - 1]) {
        run++;
        if (run === 5) penalty += 3;
        else if (run > 5) penalty += 1;
      } else run = 1;
    }
  }
  for (let c = 0; c < n; c++) {
    let run = 1;
    for (let r = 1; r < n; r++) {
      if (m[r][c] === m[r - 1][c]) {
        run++;
        if (run === 5) penalty += 3;
        else if (run > 5) penalty += 1;
      } else run = 1;
    }
  }

  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) penalty += 3;
    }
  }

  let dark = 0;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) if (m[r][c] === 1) dark++;
  }
  penalty += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return penalty;
}

export function generateQRMatrix(text) {
  const bytes = new TextEncoder().encode(text);
  const version = chooseVersion(bytes.length);
  const size = version * 4 + 17;
  const fullCW = interleaveBlocks(encodeDataBits(bytes, version), version);

  const base = createMatrix(size);
  const isFunc = createMatrix(size);

  drawFinder(base, isFunc, 0, 0);
  drawFinder(base, isFunc, 0, size - 7);
  drawFinder(base, isFunc, size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0 ? 1 : -1;
    base[6][i] = val;
    base[i][6] = val;
    isFunc[6][i] = 1;
    isFunc[i][6] = 1;
  }

  for (const r of QR_VERSIONS_M[version][4]) {
    for (const c of QR_VERSIONS_M[version][4]) {
      if (!isFunc[r][c]) drawAlignment(base, isFunc, r, c);
    }
  }

  for (let i = 0; i < 9; i++) {
    isFunc[8][i] = 1;
    isFunc[i][8] = 1;
  }
  for (let i = 0; i < 8; i++) {
    isFunc[8][size - 1 - i] = 1;
    isFunc[size - 1 - i][8] = 1;
  }
  drawVersionBits(base, isFunc, version);

  let bitIdx = 0;
  const totalBits = fullCW.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((size - 1 - right) / 2) % 2 === 0;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (isFunc[r][c]) continue;
        let dark = false;
        if (bitIdx < totalBits) {
          dark = ((fullCW[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) === 1;
          bitIdx++;
        }
        base[r][c] = dark ? 1 : -1;
      }
    }
  }

  let bestPenalty = Infinity;
  let bestMatrix = null;

  for (let mask = 0; mask < 8; mask++) {
    const candidate = base.map((row) => Int8Array.from(row));
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!isFunc[r][c] && maskCondition(mask, r, c)) candidate[r][c] = -candidate[r][c];
      }
    }
    drawFormatBits(candidate, mask);
    const p = computePenalty(candidate);
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMatrix = candidate;
    }
  }

  return bestMatrix.map((row) => Array.from(row, (v) => v === 1));
}

export function generateQRSvg(text, { fg = '#0B0F19', bg = '#FFFFFF', quietZone = 3 } = {}) {
  const matrix = generateQRMatrix(text);
  const n = matrix.length;
  const total = n + quietZone * 2;
  let path = '';

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) path += `M${c + quietZone},${r + quietZone}h1v1h-1z`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img" aria-label="2FA QR Code"><rect width="100%" height="100%" fill="${bg}"/><path d="${path}" fill="${fg}"/></svg>`;
}
