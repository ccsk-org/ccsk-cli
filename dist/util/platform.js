import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
export const platform = {
    isWindows: process.platform === 'win32',
    isMac: process.platform === 'darwin',
    isLinux: process.platform === 'linux',
    arch: process.arch,
};
export function homeDir() {
    return os.homedir();
}
export function templatesRoot() {
    // Resolved relative to the compiled platform.js (dist/util/) → ../../templates.
    // Use fileURLToPath so Windows paths and spaces are decoded correctly.
    return fileURLToPath(new URL('../../templates', import.meta.url));
}
/**
 * Cross-platform PATH probe. Uses `where` on Windows and `which` elsewhere
 * (both real binaries) so we never need a shell. Returns true if found.
 */
export async function binExists(bin) {
    const probe = platform.isWindows ? 'where' : 'which';
    const { exitCode } = await execa(probe, [bin], { reject: false });
    return exitCode === 0;
}
//# sourceMappingURL=platform.js.map