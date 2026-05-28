import pc from 'picocolors';
// 256-color accents, gated on color support so pipes / NO_COLOR stay clean.
const ansi256 = (code) => (s) => pc.isColorSupported ? `\x1b[38;5;${code}m${s}\x1b[0m` : s;
const lavender = ansi256(183); // identity
export const teal = ansi256(80); // accent mark
// Vertical gradient applied one color per wordmark row: lavender (top) → teal (bottom).
const GRADIENT = [183, 147, 111, 110, 73, 80];
// Hand-rolled 6-row pixel-block font. Covers every glyph in "ccsk". No new deps.
const LETTERS = {
    c: [' █████  ', '██   ██ ', '██      ', '██      ', '██   ██ ', ' █████  '],
    s: [' █████  ', '██      ', ' █████  ', '     ██ ', '     ██ ', ' █████  '],
    k: ['██   ██ ', '██  ██  ', '████    ', '██ ██   ', '██  ██  ', '██   ██ '],
    ' ': ['  ', '  ', '  ', '  ', '  ', '  '],
};
function renderText(text) {
    const rows = ['', '', '', '', '', ''];
    for (const ch of text.toLowerCase()) {
        const glyph = LETTERS[ch];
        if (!glyph)
            continue;
        for (let i = 0; i < 6; i++)
            rows[i] += glyph[i];
    }
    return rows;
}
function wrapText(text, width) {
    if (width <= 0 || text.length <= width)
        return [text];
    const out = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
        if (!line) {
            line = word;
        }
        else if (line.length + 1 + word.length <= width) {
            line += ' ' + word;
        }
        else {
            out.push(line);
            line = word;
        }
    }
    if (line)
        out.push(line);
    return out;
}
/**
 * Print the ccsk identity header: gradient pixel wordmark, version + slogan,
 * author/contributor/org metadata, and a Claude-ready capability rail.
 * Rendered once at the top of `runInit`.
 */
export function printBanner(meta) {
    const out = process.stdout;
    const color = pc.isColorSupported;
    // 1. Gradient wordmark (plain rows when color is unsupported).
    const rows = renderText('ccsk');
    out.write('\n');
    rows.forEach((row, i) => {
        const painted = color ? `\x1b[38;5;${GRADIENT[i]}m${row}\x1b[0m` : row;
        out.write('  ' + painted + '\n');
    });
    out.write('\n');
    // 2. Title: ccsk vX.Y.Z
    out.write('  ' + pc.bold(teal('ccsk')) + pc.dim(` v${meta.version}`) + '\n');
    // 3. Slogan, wrapped to the terminal width.
    const cols = (out.columns ?? 80) - 4;
    const width = cols > 20 ? cols : 76;
    for (const line of wrapText(meta.slogan, width)) {
        out.write('  ' + pc.dim(line) + '\n');
    }
    out.write('\n');
    // 4. Aligned metadata rows.
    const rowsMeta = [
        ['Author', meta.author],
        ['Contributors', meta.contributors || 'N/A'],
        ['Organization', meta.organization],
    ];
    const labelWidth = Math.max(...rowsMeta.map(([l]) => l.length));
    for (const [label, value] of rowsMeta) {
        out.write('  ' + pc.bold(label.padEnd(labelWidth)) + '  ' + pc.dim(value) + '\n');
    }
    out.write('\n');
    // 5. Capability rail + audience line.
    out.write('  ' +
        teal('◆') +
        ' ' +
        pc.bold('Claude-ready') +
        pc.dim('  CLAUDE.md · docs · prompts · MCPs · skills · plugins') +
        '\n');
    out.write('  ' + pc.dim('Built for Claude Code, Codex & other AI coding agents.') + '\n');
    out.write('\n');
}
export { lavender };
//# sourceMappingURL=banner.js.map