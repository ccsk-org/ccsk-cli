/**
 * ccsk versions — list available kit versions (remote + cached + current).
 * Read-only. Prereleases are opt-in via `--pre` (or shown with `--all`).
 *
 *   ccsk versions            stable releases, marked latest/current/cached
 *   ccsk versions --pre      include prereleases (beta/rc/alpha)
 *   ccsk versions --all      full, untruncated list (incl. prereleases)
 *   ccsk versions --json     machine-readable output
 */

import {
  listAvailableVersions,
  compareKitVersion,
  type KitVersion,
} from '../core/kit-fetcher.js';
import { listCachedVersions } from '../core/kit-cache.js';
import { readInstalledVersion } from '../core/install-tracker.js';
import { log, pc } from '../util/log.js';

export interface VersionsOptions {
  all?: boolean;
  pre?: boolean;
  json?: boolean;
}

function channelTag(v: KitVersion): string {
  if (!v.prerelease) return '';
  const dash = v.tag.indexOf('-');
  const suffix = dash === -1 ? '' : v.tag.slice(dash + 1).toLowerCase();
  if (suffix.startsWith('rc')) return '(rc)';
  if (suffix.startsWith('beta')) return '(beta)';
  if (suffix.startsWith('alpha')) return '(alpha)';
  return '(pre)';
}

export async function runVersions(opts: VersionsOptions): Promise<void> {
  const available = await listAvailableVersions();
  const cached = new Set(listCachedVersions().map((c) => c.version));
  const current = readInstalledVersion();
  const latestStable = available.find((v) => !v.prerelease)?.version ?? null;

  // Filter: stable-only by default; prereleases with --pre/--all.
  const includePre = opts.pre || opts.all;
  let visible = includePre ? available : available.filter((v) => !v.prerelease);

  // Always surface the current version, even when filtered out.
  if (current && !visible.some((v) => v.version === current.version)) {
    const match = available.find((v) => v.version === current.version);
    if (match) {
      visible = [...visible, match].sort((a, b) => compareKitVersion(b.version, a.version));
    }
  }

  if (opts.json) {
    const payload = {
      current: current?.version ?? null,
      latest: latestStable,
      versions: visible.map((v) => ({
        version: v.version,
        tag: v.tag,
        prerelease: v.prerelease,
        publishedAt: v.publishedAt ?? null,
        latest: v.version === latestStable,
        current: v.version === current?.version,
        cached: cached.has(v.version),
      })),
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (available.length === 0) {
    log.warn('Could not list remote versions (offline or no GitHub access).');
    if (cached.size > 0) {
      log.info('Cached versions:');
      for (const v of [...cached].sort((a, b) => compareKitVersion(b, a))) {
        const markers = markerList(v, current?.version ?? null, latestStable, cached, true);
        log.info(`  v${v.padEnd(16)}${markers}`);
      }
    } else {
      log.hint('Run `ccsk auth` to configure GitHub access.');
    }
    return;
  }

  log.info('Available kit versions:');
  log.info('');
  for (const v of visible) {
    const tag = channelTag(v);
    const name = tag ? `v${v.version} ${tag}` : `v${v.version}`;
    const markers = markerList(
      v.version,
      current?.version ?? null,
      latestStable,
      cached,
      cached.has(v.version),
    );
    const line = `  ${name.padEnd(20)}${markers}`;
    log.info(v.prerelease ? pc.dim(line) : line);
  }

  if (!includePre && available.some((v) => v.prerelease)) {
    log.info('');
    log.hint('Prereleases hidden — pass --pre (or --all) to show them.');
  }
}

function markerList(
  version: string,
  current: string | null,
  latestStable: string | null,
  cached: Set<string>,
  isCached: boolean,
): string {
  const markers: string[] = [];
  if (version === latestStable) markers.push(pc.green('latest'));
  if (version === current) markers.push(pc.cyan('current'));
  if (isCached || cached.has(version)) markers.push(pc.dim('cached'));
  return markers.length ? markers.join(' · ') : '';
}
