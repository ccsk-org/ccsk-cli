/**
 * Interactive kit-version picker — a `select` wrapper over `KitVersion[]`.
 *
 * Stable releases are listed newest-first; prereleases are labelled by channel
 * (beta/rc/alpha) and dimmed. The default view shows the most recent stable
 * releases plus any prereleases newer than the latest stable, with a
 * `Show all versions…` sentinel that re-renders the full list. The initial
 * selection is the latest stable, or the newest prerelease when no stable
 * release exists yet.
 */

import { select, isCancel } from '@clack/prompts';
import { compareKitVersion, type KitVersion } from '../core/kit-fetcher.js';
import { pc } from './log.js';

const SHOW_ALL = '__ccsk_show_all__';
const RECENT_STABLE_COUNT = 5;

export interface PickerInput {
  versions: KitVersion[];
  /** Versions already present in the local cache. */
  cached: Set<string>;
  /** The latest stable version, or null when none exists. */
  latestStable: string | null;
}

/** Derive a `(beta)`/`(rc)`/`(alpha)` channel tag from the prerelease suffix. */
function channelTag(v: KitVersion): string {
  if (!v.prerelease) return '';
  const dash = v.tag.indexOf('-');
  const suffix = dash === -1 ? '' : v.tag.slice(dash + 1).toLowerCase();
  if (suffix.startsWith('rc')) return '(rc)';
  if (suffix.startsWith('beta')) return '(beta)';
  if (suffix.startsWith('alpha')) return '(alpha)';
  return '(pre)';
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const day = 86_400_000;
  if (diffMs < day) return 'today';
  const days = Math.floor(diffMs / day);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function toOption(
  v: KitVersion,
  cached: Set<string>,
  latestStable: string | null,
): { value: string; label: string; hint?: string } {
  const tag = channelTag(v);
  let label = `v${v.version}`;
  if (tag) label = `${label} ${tag}`;
  if (v.prerelease) label = pc.dim(label);

  const markers: string[] = [];
  const rel = relativeTime(v.publishedAt);
  if (rel) markers.push(rel);
  if (latestStable === v.version) markers.push('latest');
  if (cached.has(v.version)) markers.push('cached');

  return { value: v.version, label, hint: markers.length ? markers.join(' · ') : undefined };
}

/**
 * Show the picker. Returns the chosen version string, or null on cancel.
 */
export async function pickKitVersion(input: PickerInput): Promise<string | null> {
  return renderPicker(input, false);
}

async function renderPicker(input: PickerInput, showAll: boolean): Promise<string | null> {
  const { versions, cached, latestStable } = input;

  let visible: KitVersion[];
  if (showAll) {
    visible = versions;
  } else {
    const recentStable = versions.filter((v) => !v.prerelease).slice(0, RECENT_STABLE_COUNT);
    const newerPre = versions.filter(
      (v) =>
        v.prerelease &&
        (latestStable === null || compareKitVersion(v.version, latestStable) > 0),
    );
    const merged = new Map<string, KitVersion>();
    for (const v of [...newerPre, ...recentStable]) merged.set(v.version, v);
    visible = [...merged.values()].sort((a, b) => compareKitVersion(b.version, a.version));
  }

  const options = visible.map((v) => toOption(v, cached, latestStable));
  const hasMore = !showAll && visible.length < versions.length;
  if (hasMore) {
    options.push({ value: SHOW_ALL, label: pc.dim('Show all versions…'), hint: undefined });
  }

  const initialValue = latestStable ?? versions.find((v) => v.prerelease)?.version;

  const choice = await select({
    message: 'Select a kit version to install:',
    options,
    initialValue,
  });

  if (isCancel(choice)) return null;
  if (choice === SHOW_ALL) return renderPicker(input, true);
  return choice as string;
}
