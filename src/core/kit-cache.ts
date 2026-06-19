/**
 * Kit cache management — ~/.ccsk/kit/{version}/
 * Single kit architecture: no kit ID in path.
 */

import fs from 'node:fs';
import path from 'node:path';
import { homeDir } from '../util/platform.js';

const CCSK_DIR = path.join(homeDir(), '.ccsk');
const KIT_DIR = path.join(CCSK_DIR, 'kit');

export interface CachedVersion {
  version: string;
  path: string;
  sizeBytes: number;
}

/** Ensure the ccsk directories exist. */
export function ensureCacheDirs(): void {
  fs.mkdirSync(KIT_DIR, { recursive: true });
}

/** Get the cache path for a specific version. */
export function getCachePath(version: string): string {
  return path.join(KIT_DIR, version);
}

/** Check if a version is cached. */
export function isCached(version: string): boolean {
  const cachePath = getCachePath(version);
  return fs.existsSync(cachePath);
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

  if (!fs.existsSync(KIT_DIR)) {
    return result;
  }

  const versionDirs = fs.readdirSync(KIT_DIR, { withFileTypes: true });
  for (const versionDir of versionDirs) {
    if (!versionDir.isDirectory()) continue;

    const version = versionDir.name;
    const versionPath = path.join(KIT_DIR, version);

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
      return true;
    }
    return false;
  }

  // Clear all versions
  if (fs.existsSync(KIT_DIR)) {
    fs.rmSync(KIT_DIR, { recursive: true });
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
