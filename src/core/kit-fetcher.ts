/**
 * Kit fetcher — clone the ccsk-kit from GitHub to local cache.
 * Single kit: ccsk-org/ccsk-kit
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { log } from '../util/log.js';
import { withShimmer } from '../util/shimmer-spinner.js';
import { detectAuthMethod, getCloneUrl } from './github-auth.js';
import { getCachePath, ensureCacheDirs, isCached, writeCacheMarker, removeCacheMarker } from './kit-cache.js';

const KIT_REPO = 'ccsk-org/ccsk-kit';

/**
 * Fallback kit version when resolution fails — derived from the CLI's own
 * package.json so it can never drift behind the published CLI (a stale
 * hand-maintained constant once stranded users on the oldest kit).
 */
function readCliVersion(): string {
  try {
    const pkgPath = fileURLToPath(new URL('../../package.json', import.meta.url));
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
    return typeof pkg.version === 'string' ? pkg.version : '1.0.0';
  } catch {
    return '1.0.0';
  }
}

const DEFAULT_VERSION = readCliVersion();

export interface FetchOptions {
  force?: boolean;
  version?: string;
}

export interface FetchResult {
  success: boolean;
  cachePath: string;
  version: string;
  fromCache: boolean;
  error?: string;
}

/** Fetch the kit to local cache. Returns the cache path. */
export async function fetchKit(options: FetchOptions = {}): Promise<FetchResult> {
  ensureCacheDirs();
  const auth = await detectAuthMethod();

  if (auth.method === 'none') {
    const fallbackVersion = options.version ?? DEFAULT_VERSION;
    return {
      success: false,
      cachePath: getCachePath(fallbackVersion),
      version: fallbackVersion,
      fromCache: false,
      error: 'GitHub authentication required. Run ccsk auth for setup instructions.',
    };
  }

  const cloneUrl = getCloneUrl(KIT_REPO, auth.method);

  // Resolve version: explicit flag → latest tag → fallback
  let version: string;
  if (options.version) {
    version = options.version;
  } else {
    const resolved = await resolveLatestVersion(cloneUrl);
    version = resolved ?? DEFAULT_VERSION;
    if (resolved) {
      log.info(`Latest kit release: v${resolved}`);
    } else {
      log.warn(`Could not resolve latest version; using fallback v${version}.`);
    }
  }

  const cachePath = getCachePath(version);

  // Check cache after resolution so new upstream tags bypass stale entries
  if (!options.force && isCached(version)) {
    log.info(`Using cached kit v${version}`);
    return { success: true, cachePath, version, fromCache: true };
  }

  // We've decided to (re)fetch: clear any existing dir + marker. This covers
  // --force AND a stale/partial dir that failed the marker check above, so a
  // later `git clone` never lands in a non-empty directory.
  if (fs.existsSync(cachePath)) {
    fs.rmSync(cachePath, { recursive: true });
  }
  removeCacheMarker(version);

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });

  try {
    let sha = '';
    await withShimmer(`Downloading kit v${version}…`, async () => {
      await execa('git', [
        'clone',
        '--depth', '1',
        '--branch', `v${version}`,
        cloneUrl,
        cachePath,
      ], { timeout: 120_000 });

      // Capture the resolved commit before stripping .git (provenance).
      const probe = await execa('git', ['-C', cachePath, 'rev-parse', 'HEAD'], { reject: false });
      sha = probe.stdout.trim();

      // Remove .git directory to save space
      const gitDir = path.join(cachePath, '.git');
      if (fs.existsSync(gitDir)) {
        fs.rmSync(gitDir, { recursive: true });
      }
    });

    // Mark the clone complete so it is trusted on the next run.
    writeCacheMarker({ version, sha, completedAt: new Date().toISOString() });

    return { success: true, cachePath, version, fromCache: false };
  } catch (err) {
    // Clean up partial clone
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true });
    }

    const message = err instanceof Error ? err.message : String(err);

    if (message.includes('could not find remote branch') || message.includes('did not match any')) {
      return {
        success: false,
        cachePath,
        version,
        fromCache: false,
        error: `Version v${version} not found. Check available versions.`,
      };
    }

    if (message.includes('Permission denied') || message.includes('Repository not found')) {
      return {
        success: false,
        cachePath,
        version,
        fromCache: false,
        error: 'Access denied to kit repo. Ensure you have GitHub access configured.',
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
 * Tries `gh api releases/latest` first, then `git ls-remote --tags`.
 */
async function resolveLatestVersion(cloneUrl: string): Promise<string | null> {
  const viaGh = await resolveViaGhRelease();
  if (viaGh) return viaGh;
  return resolveViaGitTags(cloneUrl);
}

async function resolveViaGhRelease(): Promise<string | null> {
  try {
    const { exitCode, stdout } = await execa(
      'gh',
      ['api', `repos/${KIT_REPO}/releases/latest`, '--jq', '.tag_name'],
      { reject: false, timeout: 10_000 },
    );
    if (exitCode !== 0) return null;
    return stripVPrefix(stdout.trim()) || null;
  } catch {
    return null;
  }
}

async function resolveViaGitTags(cloneUrl: string): Promise<string | null> {
  try {
    const { exitCode, stdout } = await execa(
      'git',
      ['ls-remote', '--tags', '--refs', cloneUrl],
      { reject: false, timeout: 15_000 },
    );
    if (exitCode !== 0) return null;

    const tags: string[] = [];
    for (const line of stdout.split('\n')) {
      const ref = line.split('\t')[1];
      if (!ref) continue;
      const tag = ref.replace(/^refs\/tags\//, '');
      if (/^v?\d+\.\d+\.\d+$/.test(tag)) tags.push(stripVPrefix(tag));
    }
    if (tags.length === 0) return null;

    tags.sort(compareSemver);
    return tags[tags.length - 1];
  } catch {
    return null;
  }
}

function stripVPrefix(tag: string): string {
  return tag.startsWith('v') ? tag.slice(1) : tag;
}

function compareSemver(a: string, b: string): number {
  const [a1, a2, a3] = a.split('.').map(Number);
  const [b1, b2, b3] = b.split('.').map(Number);
  return a1 - b1 || a2 - b2 || a3 - b3;
}

/** Export repo and default version for other modules */
export const KIT_LABEL = 'Claude Code Starter Kit';
export { KIT_REPO, DEFAULT_VERSION };
