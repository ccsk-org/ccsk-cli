/**
 * GitHub authentication — SSH-first, gh CLI fallback.
 */
import { execa } from 'execa';
import { log } from '../util/log.js';
import { binExists } from '../util/platform.js';
/** Check if SSH access to GitHub works. */
async function checkSshAccess() {
    try {
        const { stderr } = await execa('ssh', ['-T', 'git@github.com'], {
            reject: false,
            timeout: 10_000,
        });
        // GitHub returns "Hi {username}!" in stderr with exit code 1
        const match = stderr.match(/Hi ([^!]+)!/);
        if (match) {
            return { ok: true, username: match[1] };
        }
        return { ok: false };
    }
    catch {
        return { ok: false };
    }
}
/** Check if gh CLI is authenticated. */
async function checkGhAuth() {
    if (!binExists('gh')) {
        return { ok: false };
    }
    try {
        const { stdout } = await execa('gh', ['auth', 'status'], {
            reject: false,
            timeout: 10_000,
        });
        // Parse username from output
        const match = stdout.match(/Logged in to github\.com.*account (\S+)/);
        if (match) {
            return { ok: true, username: match[1] };
        }
        // Check if authenticated even without parsing username
        if (stdout.includes('Logged in to github.com')) {
            return { ok: true };
        }
        return { ok: false };
    }
    catch {
        return { ok: false };
    }
}
/** Detect the best available auth method. */
export async function detectAuthMethod() {
    // Try SSH first
    const ssh = await checkSshAccess();
    if (ssh.ok) {
        return { method: 'ssh', username: ssh.username };
    }
    // Try gh CLI
    const gh = await checkGhAuth();
    if (gh.ok) {
        return { method: 'gh', username: gh.username };
    }
    return { method: 'none' };
}
/** Get clone URL for a repo based on auth method. */
export function getCloneUrl(repo, method) {
    if (method === 'ssh') {
        return `git@github.com:${repo}.git`;
    }
    return `https://github.com/${repo}.git`;
}
/** Ensure GitHub auth is available, with user guidance if not. */
export async function ensureGitHubAuth() {
    const status = await detectAuthMethod();
    if (status.method !== 'none') {
        log.success(`GitHub: authenticated via ${status.method.toUpperCase()}${status.username ? ` as @${status.username}` : ''}`);
        return status;
    }
    log.error('GitHub authentication required to download kits.');
    log.info('');
    log.info('Option 1: Configure SSH keys');
    log.hint('  ssh-keygen -t ed25519');
    log.hint('  cat ~/.ssh/id_ed25519.pub');
    log.hint('  Add key at: https://github.com/settings/keys');
    log.info('');
    log.info('Option 2: Install and authenticate GitHub CLI');
    log.hint('  brew install gh');
    log.hint('  gh auth login');
    log.info('');
    return status;
}
/** Run ccsk auth command — display auth status. */
export async function runAuthCommand() {
    log.step('Checking GitHub authentication...');
    log.info('');
    const ssh = await checkSshAccess();
    if (ssh.ok) {
        log.success(`SSH: Connected as @${ssh.username ?? 'unknown'}`);
        log.hint('  (git@github.com works)');
    }
    else {
        log.warn('SSH: Not configured');
        log.hint('  Run: ssh-keygen -t ed25519 && cat ~/.ssh/id_ed25519.pub');
        log.hint('  Add to: https://github.com/settings/keys');
    }
    log.info('');
    const gh = await checkGhAuth();
    if (gh.ok) {
        log.success(`gh CLI: Authenticated${gh.username ? ` as @${gh.username}` : ''}`);
        log.hint('  Token stored for HTTPS access');
    }
    else if (await binExists('gh')) {
        log.warn('gh CLI: Installed but not authenticated');
        log.hint('  Run: gh auth login');
    }
    else {
        log.warn('gh CLI: Not installed');
        log.hint('  Install: brew install gh');
    }
}
//# sourceMappingURL=github-auth.js.map