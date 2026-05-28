/**
 * QR renderer that uses Unicode quadrant glyphs (2x2 modules per character),
 * producing a QR roughly half the size of `qrcode-terminal`'s `small` mode
 * (half-blocks, 1x2 modules per character).
 *
 * Trade-offs:
 *   - Quiet zone is 1 module instead of the spec's 4. Bank scanners read fine
 *     at close range; if a reader ever rejects, bump QUIET_ZONE to 2.
 *   - Error correction set to 'L' to keep the matrix small. VietQR payloads
 *     are short (~150 chars), so version stays low; switch to 'M' if scan
 *     reliability ever becomes an issue.
 */

import QRCode from 'qrcode';

const QUIET_ZONE = 1;

/**
 * 16 Unicode codepoints, indexed by a 4-bit mask where:
 *   bit 0 = top-left, bit 1 = top-right, bit 2 = bottom-left, bit 3 = bottom-right.
 * A `1` bit means that quadrant is filled (dark module).
 */
const QUADRANT_GLYPHS = [
  ' ', '▘', '▝', '▀',
  '▖', '▌', '▞', '▛',
  '▗', '▚', '▐', '▜',
  '▄', '▙', '▟', '█',
];

/** Returns 1 if the module at (row, col) is dark, 0 otherwise. Out-of-bounds = 0 (light). */
function moduleAt(modules: Uint8Array, size: number, row: number, col: number): number {
  if (row < 0 || row >= size || col < 0 || col >= size) return 0;
  return modules[row * size + col] ? 1 : 0;
}

/** Renders the QR as an array of strings, one per text row. */
export function renderQrQuadrant(payload: string): string[] {
  const qr = QRCode.create(payload, { errorCorrectionLevel: 'L' });
  const size: number = qr.modules.size;
  const data: Uint8Array = qr.modules.data;

  const padded = size + QUIET_ZONE * 2;
  const lines: string[] = [];

  // Step by 2 so each text row covers 2 module rows.
  for (let r = 0; r < padded; r += 2) {
    let line = '';
    for (let c = 0; c < padded; c += 2) {
      const tl = moduleAt(data, size, r - QUIET_ZONE,     c - QUIET_ZONE);
      const tr = moduleAt(data, size, r - QUIET_ZONE,     c - QUIET_ZONE + 1);
      const bl = moduleAt(data, size, r - QUIET_ZONE + 1, c - QUIET_ZONE);
      const br = moduleAt(data, size, r - QUIET_ZONE + 1, c - QUIET_ZONE + 1);
      const mask = tl | (tr << 1) | (bl << 2) | (br << 3);
      line += QUADRANT_GLYPHS[mask];
    }
    lines.push(line);
  }

  return lines;
}
