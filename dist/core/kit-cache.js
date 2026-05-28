/**
 * Kit cache management — ~/.ccsk/kits/{kit-id}/{version}/
 */
import fs from 'node:fs';
import path from 'node:path';
import { homeDir } from '../util/platform.js';
const CCSK_DIR = path.join(homeDir(), '.ccsk');
const KITS_DIR = path.join(CCSK_DIR, 'kits');
/** Ensure the ccsk directories exist. */
export function ensureCacheDirs() {
    fs.mkdirSync(KITS_DIR, { recursive: true });
}
/** Get the cache path for a specific kit version. */
export function getCachePath(kitId, version) {
    return path.join(KITS_DIR, kitId, version);
}
/** Check if a kit version is cached. */
export function isCached(kitId, version) {
    const cachePath = getCachePath(kitId, version);
    return fs.existsSync(cachePath);
}
/** Get directory size recursively. */
function getDirSize(dirPath) {
    let size = 0;
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                size += getDirSize(fullPath);
            }
            else {
                size += fs.statSync(fullPath).size;
            }
        }
    }
    catch {
        // Ignore errors
    }
    return size;
}
/** List all cached kits. */
export function listCachedKits() {
    const result = [];
    if (!fs.existsSync(KITS_DIR)) {
        return result;
    }
    const kitDirs = fs.readdirSync(KITS_DIR, { withFileTypes: true });
    for (const kitDir of kitDirs) {
        if (!kitDir.isDirectory())
            continue;
        const kitId = kitDir.name;
        const kitPath = path.join(KITS_DIR, kitId);
        const versionDirs = fs.readdirSync(kitPath, { withFileTypes: true });
        for (const versionDir of versionDirs) {
            if (!versionDir.isDirectory())
                continue;
            const version = versionDir.name;
            const versionPath = path.join(kitPath, version);
            result.push({
                kitId,
                version,
                path: versionPath,
                sizeBytes: getDirSize(versionPath),
            });
        }
    }
    return result;
}
/** Clear cached kit (all versions or specific version). */
export function clearCache(kitId, version) {
    if (version) {
        const cachePath = getCachePath(kitId, version);
        if (fs.existsSync(cachePath)) {
            fs.rmSync(cachePath, { recursive: true });
            return true;
        }
    }
    else {
        const kitPath = path.join(KITS_DIR, kitId);
        if (fs.existsSync(kitPath)) {
            fs.rmSync(kitPath, { recursive: true });
            return true;
        }
    }
    return false;
}
/** Clear all cached kits. */
export function clearAllCache() {
    if (fs.existsSync(KITS_DIR)) {
        fs.rmSync(KITS_DIR, { recursive: true });
    }
    ensureCacheDirs();
}
/** Format bytes to human-readable size. */
export function formatSize(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
//# sourceMappingURL=kit-cache.js.map