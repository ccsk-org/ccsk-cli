/**
 * Terminal QR renderer using Unicode half-block glyphs (1 module wide, 2 modules
 * tall per character).
 *
 * Why half-blocks: a monospace terminal cell is roughly twice as tall as it is
 * wide (~1:2). Packing one module per character horizontally and two stacked
 * modules vertically makes each rendered module square, so the whole QR comes
 * out square instead of stretched ~2x tall. Half-blocks are also the most
 * scan-reliable shape for bank/VietQR readers (solid edges, no sub-cell gaps).
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
 * 4 half-block glyphs indexed by a 2-bit mask where:
 *   bit 0 = top module, bit 1 = bottom module.
 * A `1` bit means that module is dark.
 */
const HALF_BLOCK_GLYPHS = [' ', '▀', '▄', '█'];
/** Returns 1 if the module at (row, col) is dark, 0 otherwise. Out-of-bounds = 0 (light). */
function moduleAt(modules, size, row, col) {
    if (row < 0 || row >= size || col < 0 || col >= size)
        return 0;
    return modules[row * size + col] ? 1 : 0;
}
/** Renders the QR as an array of strings, one per text row. */
export function renderQrTerminal(payload) {
    const qr = QRCode.create(payload, { errorCorrectionLevel: 'L' });
    const size = qr.modules.size;
    const data = qr.modules.data;
    const padded = size + QUIET_ZONE * 2;
    const lines = [];
    // Step rows by 2 (two stacked modules per char), columns by 1 (one module per char).
    for (let r = 0; r < padded; r += 2) {
        let line = '';
        for (let c = 0; c < padded; c++) {
            const top = moduleAt(data, size, r - QUIET_ZONE, c - QUIET_ZONE);
            const bottom = moduleAt(data, size, r - QUIET_ZONE + 1, c - QUIET_ZONE);
            const mask = top | (bottom << 1);
            line += HALF_BLOCK_GLYPHS[mask];
        }
        lines.push(line);
    }
    return lines;
}
//# sourceMappingURL=qr-terminal.js.map