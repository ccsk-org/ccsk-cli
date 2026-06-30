/**
 * Kit fetcher — clone the ccsk-kit from GitHub to local cache.
 * Single kit: ccsk-org/ccsk-kit
 *
 * Version resolution is prerelease-aware (semver §11 precedence). Prereleases
 * are OPT-IN: `resolveLatestStable` + the strict tag regex skip them, while
 * `listAvailableVersions` + `resolveLatestPrerelease` surface them for the
 * picker and the `--pre` flag.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';
import { log } from '../util/log.js';
import { withShimmer } from '../util/shimmer-spinner.js';
import { detectAuthMethod, getCloneUrl } from './github-auth.js';
import {
  getCachePath,
  ensureCacheDirs,
  isCached,
  writeCacheMarker,
  removeCacheMarker,
  listCachedVersions,
} from './kit-cache.js';

const KIT_REPO = 'ccsk-org/ccsk-kit';

/** Strict: stable releases only (no prerelease suffix) — used for "latest stable". */
const STABLE_TAG_RE = /^v?\d+\.\d+\.\d+$/;
/** Permissive: stable OR prerelease — used for listing + cached resolution. */
const LIST_TAG_RE = /^v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

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

/** A kit release/tag discovered on the remote. */
export interface KitVersion {
  version: string;
  tag: string;
  prerelease: boolean;
  publishedAt?: string;
}

/** Fetch the kit to local cache. Returns the cache path. */
export async function fetchKit(options: FetchOptions = {}): Promise<FetchResult> {
  ensureCacheDirs();
  const auth = await detectAuthMethod();

  if (auth.method === 'none') {
    return {
      success: false,
      cachePath: options.version ? getCachePath(options.version) : '',
      version: options.version ?? '',
      fromCache: false,
      error: 'GitHub authentication required. Run ccsk auth for setup instructions.',
    };
  }

  const cloneUrl = getCloneUrl(KIT_REPO, auth.method);

  // Resolve version: explicit flag → latest STABLE → newest valid CACHED → fail.
  // We never fabricate a tag — an unresolved version is a hard, explicit error.
  let version: string;
  if (options.version) {
    version = options.version;
  } else {
    const resolved = await resolveLatestVersion(cloneUrl);
    if (resolved) {
      version = resolved;
      log.info(`Latest kit release: v${resolved}`);
    } else {
      const cachedFallback = newestCachedVersion();
      if (cachedFallback) {
        version = cachedFallback;
        log.warn(`Could not resolve latest version; using newest cached v${version}.`);
      } else {
        return {
          success: false,
          cachePath: '',
          version: '',
          fromCache: false,
          error:
            'Could not resolve a kit version — offline and nothing cached, or no stable release yet. Pass --version or --pre.',
        };
      }
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
        error: `Version v${version} not found. Run \`ccsk versions\` to see available versions.`,
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

/* -------------------------------------------------------------------------- */
/* Version resolution                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the kit's latest released STABLE version.
 * Tries `gh api releases/latest` first (GitHub already skips prereleases),
 * then `git ls-remote --tags` filtered by the strict tag regex.
 */
async function resolveLatestVersion(cloneUrl: string): Promise<string | null> {
  const viaGh = await resolveViaGhRelease();
  if (viaGh) return viaGh;
  return resolveViaGitTags(cloneUrl);
}

/** Public: newest STABLE version, or null when none is resolvable. */
export async function resolveLatestStable(): Promise<string | null> {
  const viaGh = await resolveViaGhRelease();
  if (viaGh) return viaGh;
  const auth = await detectAuthMethod();
  if (auth.method === 'none') return null;
  return resolveViaGitTags(getCloneUrl(KIT_REPO, auth.method));
}

/** Public: newest version INCLUDING prereleases, or null when none found. */
export async function resolveLatestPrerelease(): Promise<string | null> {
  const all = await listAvailableVersions();
  return all.length > 0 ? all[0].version : null;
}

async function resolveViaGhRelease(): Promise<string | null> {
  try {
    const { exitCode, stdout } = await execa(
      'gh',
      ['api', `repos/${KIT_REPO}/releases/latest`, '--jq', '.tag_name'],
      { reject: false, timeout: 10_000 },
    );
    if (exitCode !== 0) return null;
    const tag = stdout.trim();
    if (!STABLE_TAG_RE.test(tag)) return null;
    return stripVPrefix(tag) || null;
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
      if (STABLE_TAG_RE.test(tag)) tags.push(stripVPrefix(tag));
    }
    if (tags.length === 0) return null;

    tags.sort(compareKitVersion);
    return tags[tags.length - 1];
  } catch {
    return null;
  }
}

/**
 * List every available kit version (stable + prerelease), sorted DESC by
 * semver precedence. Tries `gh api releases` (authoritative `prerelease`
 * flag + publish dates), falls back to `git ls-remote --tags` (prerelease
 * inferred from a `-` in the tag). Never throws — any failure yields [].
 */
export async function listAvailableVersions(): Promise<KitVersion[]> {
  const viaGh = await listViaGhReleases();
  if (viaGh.length > 0) return viaGh;

  const auth = await detectAuthMethod();
  if (auth.method === 'none') return [];
  return listViaGitTags(getCloneUrl(KIT_REPO, auth.method));
}

async function listViaGhReleases(): Promise<KitVersion[]> {
  try {
    const { exitCode, stdout } = await execa(
      'gh',
      [
        'api',
        `repos/${KIT_REPO}/releases`,
        '--paginate',
        '--jq',
        '.[]|{tag:.tag_name,pre:.prerelease,at:.published_at}',
      ],
      { reject: false, timeout: 15_000 },
    );
    if (exitCode !== 0 || !stdout.trim()) return [];

    const versions: KitVersion[] = [];
    for (const line of stdout.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed) as { tag?: string; pre?: boolean; at?: string };
        if (!obj.tag || !LIST_TAG_RE.test(obj.tag)) continue;
        versions.push({
          version: stripVPrefix(obj.tag),
          tag: obj.tag,
          prerelease: !!obj.pre,
          publishedAt: obj.at ?? undefined,
        });
      } catch {
        // Skip malformed JSONL line.
      }
    }
    return dedupeSortDesc(versions);
  } catch {
    return [];
  }
}

async function listViaGitTags(cloneUrl: string): Promise<KitVersion[]> {
  try {
    const { exitCode, stdout } = await execa(
      'git',
      ['ls-remote', '--tags', '--refs', cloneUrl],
      { reject: false, timeout: 15_000 },
    );
    if (exitCode !== 0) return [];

    const versions: KitVersion[] = [];
    for (const line of stdout.split('\n')) {
      const ref = line.split('\t')[1];
      if (!ref) continue;
      const tag = ref.replace(/^refs\/tags\//, '');
      if (!LIST_TAG_RE.test(tag)) continue;
      versions.push({
        version: stripVPrefix(tag),
        tag,
        prerelease: tag.includes('-'),
      });
    }
    return dedupeSortDesc(versions);
  } catch {
    return [];
  }
}

/** De-duplicate by version (first wins) and sort DESC by precedence. */
function dedupeSortDesc(versions: KitVersion[]): KitVersion[] {
  const seen = new Map<string, KitVersion>();
  for (const v of versions) {
    if (!seen.has(v.version)) seen.set(v.version, v);
  }
  return [...seen.values()].sort((a, b) => compareKitVersion(b.version, a.version));
}

/** Newest valid cached version (prerelease-aware), or null when none cached. */
function newestCachedVersion(): string | null {
  const cached = listCachedVersions()
    .map((c) => c.version)
    .filter((v) => LIST_TAG_RE.test(v));
  if (cached.length === 0) return null;
  cached.sort(compareKitVersion);
  return cached[cached.length - 1];
}

/* -------------------------------------------------------------------------- */
/* Semver precedence (§11) — prerelease-aware                                  */
/* -------------------------------------------------------------------------- */

interface ParsedVersion {
  core: [number, number, number];
  /** Prerelease identifiers; empty array == a stable release. */
  pre: string[];
}

function parseVersion(raw: string): ParsedVersion {
  const v = stripVPrefix(String(raw).trim());
  const dash = v.indexOf('-');
  const corePart = dash === -1 ? v : v.slice(0, dash);
  const prePart = dash === -1 ? '' : v.slice(dash + 1);
  const nums = corePart.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const core: [number, number, number] = [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
  // A single identifier like `beta-01` is kept whole (split only on `.`), so
  // both `-beta-01` and `-beta.1` parse correctly.
  const pre = prePart === '' ? [] : prePart.split('.');
  return { core, pre };
}

function comparePreIdentifier(a: string, b: string): number {
  const aNum = /^\d+$/.test(a);
  const bNum = /^\d+$/.test(b);
  if (aNum && bNum) return Number(a) - Number(b);
  if (aNum) return -1; // numeric identifiers have lower precedence than alphanumeric
  if (bNum) return 1;
  return a < b ? -1 : a > b ? 1 : 0; // ASCII sort
}

/**
 * Compare two versions by semver §11 precedence. Returns <0, 0, >0 so it can
 * drive `Array.prototype.sort` (ascending). Handles both `-beta-01` (single
 * identifier) and `-beta.1` (dotted identifiers).
 */
export function compareKitVersion(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);

  for (let i = 0; i < 3; i++) {
    if (pa.core[i] !== pb.core[i]) return pa.core[i] - pb.core[i];
  }

  const aPre = pa.pre.length > 0;
  const bPre = pb.pre.length > 0;
  if (!aPre && !bPre) return 0;
  if (!aPre) return 1; // a is a release, b is a prerelease → a wins
  if (!bPre) return -1; // a is a prerelease, b is a release → b wins

  const len = Math.min(pa.pre.length, pb.pre.length);
  for (let i = 0; i < len; i++) {
    const cmp = comparePreIdentifier(pa.pre[i], pb.pre[i]);
    if (cmp !== 0) return cmp;
  }
  return pa.pre.length - pb.pre.length; // larger identifier set wins ties
}

function stripVPrefix(tag: string): string {
  return tag.startsWith('v') ? tag.slice(1) : tag;
}

/** Export repo + label for other modules */
export const KIT_LABEL = 'Claude Code Starter Kit';
export { KIT_REPO };
