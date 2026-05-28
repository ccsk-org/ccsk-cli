/**
 * Self-update logic for the ccsk CLI.
 *
 * Detects the package manager that owns the global install and runs the
 * appropriate `add/install -g` command. Streams stdio to the user so they
 * see the installer's progress directly.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { log } from '../util/log.js';
const PKG_NAME = '@ccsk/cli';
function readCurrentVersion() {
    try {
        const here = fileURLToPath(new URL('.', import.meta.url));
        const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'package.json'), 'utf8'));
        return pkg.version ?? 'unknown';
    }
    catch {
        return 'unknown';
    }
}
function detectPackageManager() {
    const ua = (process.env.npm_config_user_agent ?? '').toLowerCase();
    if (ua.startsWith('bun'))
        return 'bun';
    if (ua.startsWith('pnpm'))
        return 'pnpm';
    if (ua.startsWith('yarn'))
        return 'yarn';
    const execPath = (process.env.npm_execpath ?? process.execPath ?? '').toLowerCase();
    if (execPath.includes('bun'))
        return 'bun';
    if (execPath.includes('pnpm'))
        return 'pnpm';
    if (execPath.includes('yarn'))
        return 'yarn';
    return 'npm';
}
function buildInstallArgs(pm, spec) {
    switch (pm) {
        case 'pnpm':
            return { bin: 'pnpm', args: ['add', '-g', spec] };
        case 'yarn':
            return { bin: 'yarn', args: ['global', 'add', spec] };
        case 'bun':
            return { bin: 'bun', args: ['add', '-g', spec] };
        case 'npm':
        default:
            return { bin: 'npm', args: ['install', '-g', spec] };
    }
}
function isValidVersion(v) {
    // Accept "latest", "next", semver-ish strings, dist-tags.
    return /^[a-zA-Z0-9._-]+$/.test(v);
}
export async function runSelfUpdate(opts) {
    const requested = (opts.version || 'latest').trim();
    if (!isValidVersion(requested)) {
        throw new Error(`invalid version: ${requested}`);
    }
    const before = readCurrentVersion();
    const pm = detectPackageManager();
    const spec = `${PKG_NAME}@${requested}`;
    const { bin, args } = buildInstallArgs(pm, spec);
    log.info(`current version: ${before}`);
    log.step(`updating via ${pm}: ${bin} ${args.join(' ')}`);
    try {
        await execa(bin, args, { stdio: 'inherit' });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.error(`update failed: ${msg}`);
        log.hint(`run manually: ${bin} ${args.join(' ')}`);
        throw new Error('ccsk update failed');
    }
    try {
        const { stdout } = await execa('ccsk', ['--version'], { reject: false });
        const after = stdout?.trim() || 'unknown';
        log.success(`updated: ${before} → ${after}`);
    }
    catch {
        log.success(`update command completed (run \`ccsk --version\` to verify)`);
    }
}
//# sourceMappingURL=self-update.js.map