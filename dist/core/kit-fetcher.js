/**
 * Kit fetcher — clone kits from GitHub to local cache.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { log } from '../util/log.js';
import { detectAuthMethod, getCloneUrl } from './github-auth.js';
import { getCachePath, ensureCacheDirs, isCached } from './kit-cache.js';
/** Fetch a kit to the local cache. Returns the cache path. */
export async function fetchKit(kit, options = {}) {
    const version = options.version ?? kit.defaultVersion;
    const cachePath = getCachePath(kit.id, version);
    // Check cache first
    if (!options.force && isCached(kit.id, version)) {
        log.info(`Using cached ${kit.label} kit v${version}`);
        return { success: true, cachePath, fromCache: true };
    }
    // Ensure cache dirs exist
    ensureCacheDirs();
    // Detect auth method
    const auth = await detectAuthMethod();
    if (auth.method === 'none') {
        return {
            success: false,
            cachePath,
            fromCache: false,
            error: 'GitHub authentication required. Run ccsk auth for setup instructions.',
        };
    }
    const cloneUrl = getCloneUrl(kit.repo, auth.method);
    log.step(`Downloading ${kit.label} kit v${version}...`);
    // Remove existing cache if force
    if (options.force && fs.existsSync(cachePath)) {
        fs.rmSync(cachePath, { recursive: true });
    }
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    try {
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
        log.success(`Downloaded ${kit.label} kit v${version}`);
        return { success: true, cachePath, fromCache: false };
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
                fromCache: false,
                error: `Version v${version} not found for ${kit.label} kit. Check available versions.`,
            };
        }
        if (message.includes('Permission denied') || message.includes('Repository not found')) {
            return {
                success: false,
                cachePath,
                fromCache: false,
                error: `Access denied to ${kit.label} kit. Ensure your license includes this kit and you have GitHub access.`,
            };
        }
        return {
            success: false,
            cachePath,
            fromCache: false,
            error: `Failed to download kit: ${message}`,
        };
    }
}
/** Fetch latest version tag from GitHub API. */
export async function fetchLatestVersion(kit) {
    try {
        const { stdout } = await execa('gh', [
            'api',
            `repos/${kit.repo}/releases/latest`,
            '--jq', '.tag_name',
        ], { timeout: 10_000 });
        const tag = stdout.trim();
        // Remove 'v' prefix if present
        return tag.startsWith('v') ? tag.slice(1) : tag;
    }
    catch {
        // Fall back to default version
        return null;
    }
}
//# sourceMappingURL=kit-fetcher.js.map