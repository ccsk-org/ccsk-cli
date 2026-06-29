/**
 * Kit cache management — ~/.ccsk/kit/{version}/
 * Single kit architecture: no kit ID in path.
 *
 * Each cached version dir has a sibling provenance marker
 * `~/.ccsk/kit/{version}.meta.json` written only after a clone fully
 * completes. A version is "cached" only when both the dir AND a matching
 * marker exist — so a partial/corrupt/legacy clone is treated as a miss
 * and re-fetched, never silently reused. The marker is a sibling (not
 * inside the dir) so it is never copied into a user project by copy-kit.
 */

import fs from 'node:fs';
import path from 'node:path';
import { homeDir } from '../util/platform.js';

/** Computed live (not a module-load constant) so $HOME overrides work in tests. */
function kitDir(): string {
  return path.join(homeDir(), '.ccsk', 'kit');
}

export interface CachedVersion {
  version: string;
  path: string;
  sizeBytes: number;
}

export interface CacheMarker {
  version: string;
  sha: string;
  completedAt: string;
}

/** Ensure the ccsk directories exist. */
export function ensureCacheDirs(): void {
  fs.mkdirSync(kitDir(), { recursive: true });
}

/** Get the cache path for a specific version. */
export function getCachePath(version: string): string {
  return path.join(kitDir(), version);
}

/** Sibling provenance marker path for a version (outside the copied tree). */
export function cacheMarkerPath(version: string): string {
  return `${getCachePath(version)}.meta.json`;
}

/** Write the provenance marker after a successful clone. */
export function writeCacheMarker(marker: CacheMarker): void {
  fs.writeFileSync(cacheMarkerPath(marker.version), JSON.stringify(marker, null, 2), 'utf8');
}

/** Read the provenance marker, or null if missing/corrupt/mismatched. */
export function readCacheMarker(version: string): CacheMarker | null {
  try {
    const raw = fs.readFileSync(cacheMarkerPath(version), 'utf8');
    const parsed = JSON.parse(raw) as CacheMarker;
    return parsed && parsed.version === version ? parsed : null;
  } catch {
    return null;
  }
}

/** Remove a version's provenance marker if present. */
export function removeCacheMarker(version: string): void {
  fs.rmSync(cacheMarkerPath(version), { force: true });
}

/**
 * A version is cached only when its dir exists AND a valid provenance
 * marker is present — a dir without a marker is a partial/legacy clone
 * and must be re-fetched.
 */
export function isCached(version: string): boolean {
  return fs.existsSync(getCachePath(version)) && readCacheMarker(version) !== null;
}

/** Get directory size recursively. */
function getDirSize(dirPath: string): number {
  let size = 0;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += getDirSize(fullPath);
      } else {
        size += fs.statSync(fullPath).size;
      }
    }
  } catch {
    // Ignore errors
  }
  return size;
}

/** List all cached versions. */
export function listCachedVersions(): CachedVersion[] {
  const result: CachedVersion[] = [];
  const dir = kitDir();

  if (!fs.existsSync(dir)) {
    return result;
  }

  const versionDirs = fs.readdirSync(dir, { withFileTypes: true });
  for (const versionDir of versionDirs) {
    if (!versionDir.isDirectory()) continue;

    const version = versionDir.name;
    const versionPath = path.join(dir, version);

    result.push({
      version,
      path: versionPath,
      sizeBytes: getDirSize(versionPath),
    });
  }

  return result;
}

/** Clear cached version (specific or all). */
export function clearCache(version?: string): boolean {
  if (version) {
    const cachePath = getCachePath(version);
    if (fs.existsSync(cachePath)) {
      fs.rmSync(cachePath, { recursive: true });
      removeCacheMarker(version);
      return true;
    }
    return false;
  }

  // Clear all versions (the whole kit dir, markers included)
  const dir = kitDir();
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true });
    ensureCacheDirs();
    return true;
  }
  return false;
}

/** Format bytes to human-readable size. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
