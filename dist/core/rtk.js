import { execa } from 'execa';
import { binExists, platform } from '../util/platform.js';
const INSTALL_URL = 'https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh';
const RELEASES_URL = 'https://github.com/rtk-ai/rtk/releases';
/** Runs the rtk install.sh by fetching it and piping the text into `sh` via stdin. */
async function installViaCurlScript() {
    const res = await fetch(INSTALL_URL);
    if (!res.ok)
        throw new Error(`download failed (HTTP ${res.status})`);
    const script = await res.text();
    await execa('sh', { input: script, stdio: ['pipe', 'inherit', 'inherit'] });
}
/**
 * Ensures the `rtk` binary is installed. macOS/Linux: brew → curl install → cargo.
 * Windows: cargo if present, otherwise reports a manual-download hint.
 */
export async function ensureRtk() {
    const name = 'rtk install';
    if (await binExists('rtk'))
        return { name, status: 'skipped', detail: 'already installed' };
    try {
        if (!platform.isWindows && (await binExists('brew'))) {
            await execa('brew', ['install', 'rtk'], { stdio: 'inherit' });
            return { name, status: 'ok', detail: 'via brew' };
        }
        if (!platform.isWindows && (await binExists('curl'))) {
            await installViaCurlScript();
            return { name, status: 'ok', detail: 'via install.sh' };
        }
        if (await binExists('cargo')) {
            await execa('cargo', ['install', '--git', 'https://github.com/rtk-ai/rtk', 'rtk'], {
                stdio: 'inherit',
            });
            return { name, status: 'ok', detail: 'via cargo' };
        }
    }
    catch (err) {
        return { name, status: 'failed', detail: err.message };
    }
    const hint = platform.isWindows
        ? `no cargo found — download a release from ${RELEASES_URL}`
        : `no brew, curl, or cargo found — see ${RELEASES_URL}`;
    return { name, status: 'failed', detail: hint };
}
/** Runs `rtk init` in the target project (enables the Claude Code hook). */
export async function rtkInit(targetAbs) {
    const name = 'rtk init';
    if (!(await binExists('rtk')))
        return { name, status: 'skipped', detail: 'rtk not on PATH' };
    const { exitCode, stderr } = await execa('rtk', ['init'], {
        cwd: targetAbs,
        reject: false,
        stdio: ['inherit', 'inherit', 'pipe'],
    });
    if (exitCode === 0)
        return { name, status: 'ok' };
    return { name, status: 'failed', detail: stderr?.trim() || `exit ${exitCode}` };
}
//# sourceMappingURL=rtk.js.map