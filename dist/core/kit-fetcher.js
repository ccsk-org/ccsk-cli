/**
 * Kit fetcher — clone kits from GitHub to local cache.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { log } from '../util/log.js';
import { withShimmer } from '../util/shimmer-spinner.js';
import { detectAuthMethod, getCloneUrl } from './github-auth.js';
import { getCachePath, ensureCacheDirs, isCached } from './kit-cache.js';
/** Fetch a kit to the local cache. Returns the cache path. */
export async function fetchKit(kit, options = {}) {
    // Auth must come before version resolution: SSH/HTTPS clone URL feeds both
    // `git ls-remote` (fallback resolver) and the final clone.
    ensureCacheDirs();
    const auth = await detectAuthMethod();
    if (auth.method === 'none') {
        const fallbackVersion = options.version ?? kit.defaultVersion;
        return {
            success: false,
            cachePath: getCachePath(kit.id, fallbackVersion),
            version: fallbackVersion,
            fromCache: false,
            error: 'GitHub authentication required. Run ccsk auth for setup instructions.',
        };
    }
    const cloneUrl = getCloneUrl(kit.repo, auth.method);
    // Resolve which version to install. Explicit `--version` wins. Otherwise we
    // ask the remote for the latest tag so a re-run of `ccsk init` picks up a
    // new kit release without the user needing `--force`. If both `gh` and
    // `git ls-remote` fail (offline), fall back to the registry's baseline.
    let version;
    if (options.version) {
        version = options.version;
    }
    else {
        const resolved = await resolveLatestVersion(kit, cloneUrl);
        version = resolved ?? kit.defaultVersion;
        if (resolved) {
            log.info(`Latest ${kit.label} release: v${resolved}`);
        }
        else {
            log.warn(`Could not resolve latest version for ${kit.label}; using fallback v${version}.`);
        }
    }
    const cachePath = getCachePath(kit.id, version);
    // Check cache after resolution so a new upstream tag bypasses stale entries.
    if (!options.force && isCached(kit.id, version)) {
        log.info(`Using cached ${kit.label} kit v${version}`);
        return { success: true, cachePath, version, fromCache: true };
    }
    // Remove existing cache if force
    if (options.force && fs.existsSync(cachePath)) {
        fs.rmSync(cachePath, { recursive: true });
    }
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    try {
        await withShimmer(`Downloading ${kit.label} v${version}…`, async () => {
            // Clone with depth 1 for efficiency
            await execa('git', [
                'clone',
                '--depth', '1',
                '--branch', `v${version}`,
                cloneUrl,
                cachePath,
            ], { timeout: 120_000 });
            // Remove .git directory to save space
            const gitDir = path.join(cachePath, '.git');
            if (fs.existsSync(gitDir)) {
                fs.rmSync(gitDir, { recursive: true });
            }
        });
        return { success: true, cachePath, version, fromCache: false };
    }
    catch (err) {
        // Clean up partial clone
        if (fs.existsSync(cachePath)) {
            fs.rmSync(cachePath, { recursive: true });
        }
        const message = err instanceof Error ? err.message : String(err);
        // Check for common errors
        if (message.includes('could not find remote branch') || message.includes('did not match any')) {
            return {
                success: false,
                cachePath,
                version,
                fromCache: false,
                error: `Version v${version} not found for ${kit.label} kit. Check available versions.`,
            };
        }
        if (message.includes('Permission denied') || message.includes('Repository not found')) {
            return {
                success: false,
                cachePath,
                version,
                fromCache: false,
                error: `Access denied to ${kit.label} kit. Ensure your license includes this kit and you have GitHub access.`,
            };
        }
        return {
            success: false,
            cachePath,
            version,
            fromCache: false,
            error: `Failed to download kit: ${message}`,
        };
    }
}
/**
 * Resolve the kit's latest released version.
 *
 * Tries `gh api releases/latest` first (cheapest, exact semantic), then falls
 * back to `git ls-remote --tags` so the resolver works for users on SSH-only
 * setups without `gh` installed. Returns `null` if both paths fail so the
 * caller can drop to the registry baseline.
 */
export async function resolveLatestVersion(kit, cloneUrl) {
    const viaGh = await resolveViaGhRelease(kit);
    if (viaGh)
        return viaGh;
    return resolveViaGitTags(cloneUrl);
}
async function resolveViaGhRelease(kit) {
    try {
        const { exitCode, stdout } = await execa('gh', ['api', `repos/${kit.repo}/releases/latest`, '--jq', '.tag_name'], { reject: false, timeout: 10_000 });
        if (exitCode !== 0)
            return null;
        return stripVPrefix(stdout.trim()) || null;
    }
    catch {
        return null;
    }
}
async function resolveViaGitTags(cloneUrl) {
    try {
        const { exitCode, stdout } = await execa('git', ['ls-remote', '--tags', '--refs', cloneUrl], { reject: false, timeout: 15_000 });
        if (exitCode !== 0)
            return null;
        // Each line: "<sha>\trefs/tags/<tag>"
        const tags = [];
        for (const line of stdout.split('\n')) {
            const ref = line.split('\t')[1];
            if (!ref)
                continue;
            const tag = ref.replace(/^refs\/tags\//, '');
            if (/^v?\d+\.\d+\.\d+$/.test(tag))
                tags.push(stripVPrefix(tag));
        }
        if (tags.length === 0)
            return null;
        tags.sort(compareSemver);
        return tags[tags.length - 1];
    }
    catch {
        return null;
    }
}
function stripVPrefix(tag) {
    return tag.startsWith('v') ? tag.slice(1) : tag;
}
function compareSemver(a, b) {
    const [a1, a2, a3] = a.split('.').map(Number);
    const [b1, b2, b3] = b.split('.').map(Number);
    return a1 - b1 || a2 - b2 || a3 - b3;
}
//# sourceMappingURL=kit-fetcher.js.map