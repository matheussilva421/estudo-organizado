// Synchronous SHA-256 keeps T1 and T2 usable in browsers and Node.
// Fractional square/cube roots of the first primes are the FIPS 180-4 constants.
const SHA_INITIAL = [];
const SHA_K = [];
for (let candidate = 2; SHA_K.length < 64; candidate++) {
  let prime = true;
  for (let factor = 2; factor * factor <= candidate; factor++) {
    if (candidate % factor === 0) { prime = false; break; }
  }
  if (!prime) continue;
  if (SHA_INITIAL.length < 8) SHA_INITIAL.push((Math.sqrt(candidate) % 1 * 0x100000000) >>> 0);
  SHA_K.push((Math.cbrt(candidate) % 1 * 0x100000000) >>> 0);
}
const rotate = (word, bits) => (word >>> bits) | (word << (32 - bits));

/** Return lowercase SHA-256 of the exact UTF-8 bytes of a string. */
export function sha256Utf8(text) {
  const bytes = Array.from(new globalThis.TextEncoder().encode(text));
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(Math.floor(bitLength / 2 ** (i * 8)) & 0xff);
  const hash = [...SHA_INITIAL];
  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = [];
    for (let i = 0; i < 64; i++) {
      if (i < 16) {
        const j = offset + i * 4;
        words[i] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3];
      } else {
        const x = words[i - 15], y = words[i - 2];
        words[i] = (words[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) +
          words[i - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10))) | 0;
      }
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
        ((e & f) ^ (~e & g)) + SHA_K[i] + words[i]) | 0;
      const t2 = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) +
        ((a & b) ^ (a & c) ^ (b & c))) | 0;
      [a, b, c, d, e, f, g, h] = [(t1 + t2) | 0, a, b, c, (d + t1) | 0, e, f, g];
    }
    [a, b, c, d, e, f, g, h].forEach((word, i) => { hash[i] = (hash[i] + word) | 0; });
  }
  return hash.map(word => (word >>> 0).toString(16).padStart(8, '0')).join('');
}
