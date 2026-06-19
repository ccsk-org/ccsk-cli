/**
 * ccsk cache — manage downloaded kit cache.
 * Single kit architecture: no kit selection needed.
 */

import { select, confirm, isCancel } from '@clack/prompts';
import { ensureGitHubAuth } from '../core/github-auth.js';
import { fetchKit, KIT_LABEL } from '../core/kit-fetcher.js';
import {
  listCachedVersions,
  clearCache,
  formatSize,
} from '../core/kit-cache.js';
import { log } from '../util/log.js';

export interface CacheOptions {
  version?: string;
  list?: boolean;
  clear?: boolean;
  clearAll?: boolean;
}

export async function runCache(opts: CacheOptions): Promise<void> {
  // List cached versions
  if (opts.list) {
    const cached = listCachedVersions();

    if (cached.length === 0) {
      log.info('No kit versions cached.');
      log.hint('Run: ccsk cache to download the kit for offline use.');
      return;
    }

    log.info(`Cached ${KIT_LABEL} versions:`);
    log.info('');

    for (const ver of cached) {
      log.info(`  v${ver.version.padEnd(10)} (${formatSize(ver.sizeBytes)})`);
    }

    return;
  }

  // Clear all cache
  if (opts.clearAll) {
    const answer = await confirm({
      message: 'Clear all cached kit versions?',
      initialValue: false,
    });

    if (isCancel(answer) || !answer) {
      log.info('Cancelled.');
      return;
    }

    clearCache();
    log.success('All cached versions cleared.');
    return;
  }

  // Clear specific version
  if (opts.clear) {
    if (opts.version) {
      const cleared = clearCache(opts.version);
      if (cleared) {
        log.success(`Cleared cache for v${opts.version}`);
      } else {
        log.warn(`No cache found for v${opts.version}`);
      }
    } else {
      // Clear all if no version specified
      const answer = await confirm({
        message: 'Clear all cached kit versions?',
        initialValue: false,
      });

      if (isCancel(answer) || !answer) {
        log.info('Cancelled.');
        return;
      }

      clearCache();
      log.success('All cached versions cleared.');
    }
    return;
  }

  // Download kit to cache (default action or explicit)
  const auth = await ensureGitHubAuth();
  if (auth.method === 'none') {
    return;
  }

  const result = await fetchKit({ version: opts.version, force: true });

  if (result.success) {
    log.success(`Cached ${KIT_LABEL} v${result.version}`);
    log.hint(`Path: ${result.cachePath}`);
  } else {
    log.error(result.error ?? 'Failed to cache kit');
  }
}
