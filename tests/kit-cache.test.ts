/**
 * Unit tests for kit-cache provenance — a cached version is trusted only
 * when its dir AND a valid sibling marker exist. Runs against a temp $HOME
 * so the real ~/.ccsk is never touched (kit-cache resolves the home dir
 * live, so overriding process.env.HOME redirects it).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  isCached,
  getCachePath,
  cacheMarkerPath,
  writeCacheMarker,
  readCacheMarker,
  clearCache,
  ensureCacheDirs,
} from '../src/core/kit-cache.js';

let tmpHome: string;
let origHome: string | undefined;

beforeEach(async () => {
  tmpHome = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ccsk-home-'));
  origHome = process.env.HOME;
  process.env.HOME = tmpHome;
  ensureCacheDirs();
});

afterEach(async () => {
  if (origHome === undefined) delete process.env.HOME;
  else process.env.HOME = origHome;
  await fs.promises.rm(tmpHome, { recursive: true, force: true });
});

describe('kit-cache provenance', () => {
  it('treats a version dir WITHOUT a marker as not cached', () => {
    fs.mkdirSync(getCachePath('9.9.9'), { recursive: true });
    expect(isCached('9.9.9')).toBe(false);
  });

  it('treats a version WITH a valid marker as cached', () => {
    fs.mkdirSync(getCachePath('9.9.9'), { recursive: true });
    writeCacheMarker({ version: '9.9.9', sha: 'abc123', completedAt: 'now' });
    expect(isCached('9.9.9')).toBe(true);
    expect(readCacheMarker('9.9.9')?.sha).toBe('abc123');
  });

  it('rejects a marker whose version does not match the dir', () => {
    fs.mkdirSync(getCachePath('9.9.9'), { recursive: true });
    fs.writeFileSync(
      cacheMarkerPath('9.9.9'),
      JSON.stringify({ version: '0.0.0', sha: 'x', completedAt: 'now' }),
    );
    expect(isCached('9.9.9')).toBe(false);
  });

  it('clearCache removes both the dir and its marker', () => {
    fs.mkdirSync(getCachePath('9.9.9'), { recursive: true });
    writeCacheMarker({ version: '9.9.9', sha: 'abc', completedAt: 'now' });
    expect(clearCache('9.9.9')).toBe(true);
    expect(isCached('9.9.9')).toBe(false);
    expect(fs.existsSync(cacheMarkerPath('9.9.9'))).toBe(false);
  });

  it('keeps the marker OUTSIDE the version dir (so copy-kit never ships it)', () => {
    fs.mkdirSync(getCachePath('9.9.9'), { recursive: true });
    writeCacheMarker({ version: '9.9.9', sha: 'abc', completedAt: 'now' });
    expect(fs.readdirSync(getCachePath('9.9.9'))).toEqual([]);
  });
});
