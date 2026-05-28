/**
 * Shimmer-wave spinner with elapsed timer.
 *
 * A lavender → teal gradient (matching the ccsk wordmark) sweeps left-to-right
 * across the label while a braille spinner ticks at the front and an elapsed
 * timer ticks at the end. Drops to a plain static line in non-TTY / NO_COLOR
 * environments so logs stay clean.
 *
 *   ⠹ A̲c̲t̲i̲v̲a̲t̲i̲n̲g̲ free license…  (02s — this may take a moment)
 *
 * Usage:
 *   await withShimmer('Activating free license…', async () => {
 *     return registerFreeLicense();
 *   });
 */
import pc from 'picocolors';
// Same lavender→teal palette as the banner wordmark. Index 0 = lavender, last = teal.
const GRADIENT = [183, 147, 111, 110, 73, 80];
const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const TICK_MS = 90;
const HINT = 'this may take a moment';
function paint256(code, s) {
    return pc.isColorSupported ? `\x1b[38;5;${code}m${s}\x1b[0m` : s;
}
function formatElapsed(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 60)
        return `${s.toString().padStart(2, '0')}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}m${rem.toString().padStart(2, '0')}s`;
}
// Highlight a 3-char window centered at `pos` using the gradient; rest is dim.
function shimmerLabel(label, tick) {
    if (!pc.isColorSupported)
        return label;
    const span = GRADIENT.length;
    const total = label.length + span;
    const pos = tick % total;
    let out = '';
    for (let i = 0; i < label.length; i++) {
        const ch = label[i];
        const offset = i - (pos - span);
        if (offset >= 0 && offset < span) {
            out += paint256(GRADIENT[offset], ch);
        }
        else {
            out += pc.dim(ch);
        }
    }
    return out;
}
function isInteractive() {
    return Boolean(process.stdout.isTTY) && !process.env.NO_COLOR && !process.env.CI;
}
export async function withShimmer(label, fn) {
    if (!isInteractive()) {
        console.log(pc.blue('→'), pc.bold(label));
        return fn();
    }
    const start = Date.now();
    let tick = 0;
    const out = process.stdout;
    out.write('\x1b[?25l'); // hide cursor
    const render = () => {
        const frame = paint256(GRADIENT[tick % GRADIENT.length], FRAMES[tick % FRAMES.length]);
        const body = shimmerLabel(label, tick);
        const elapsed = pc.dim(`  (${formatElapsed(Date.now() - start)} — ${HINT})`);
        out.write(`\r\x1b[2K${frame} ${body}${elapsed}`);
    };
    render();
    const interval = setInterval(() => {
        tick++;
        render();
    }, TICK_MS);
    const finish = (icon, color, suffix) => {
        clearInterval(interval);
        out.write('\r\x1b[2K');
        out.write(`${color(icon)} ${color(label)} ${pc.dim(suffix)}\n`);
        out.write('\x1b[?25h'); // restore cursor
    };
    try {
        const result = await fn();
        finish('✓', pc.green, `(done in ${formatElapsed(Date.now() - start)})`);
        return result;
    }
    catch (err) {
        finish('✗', pc.red, `(failed after ${formatElapsed(Date.now() - start)})`);
        throw err;
    }
}
//# sourceMappingURL=shimmer-spinner.js.map