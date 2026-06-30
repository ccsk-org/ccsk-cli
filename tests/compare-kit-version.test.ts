/**
 * Unit tests for the prerelease-aware semver comparator (compareKitVersion).
 * Covers semver §11 precedence, the no-network pure function only.
 */
import { describe, it, expect } from 'vitest';
import { compareKitVersion } from '../src/core/kit-fetcher.js';

/** Assert a < b under precedence (sign-normalized). */
const lt = (a: string, b: string): void =>
  expect(Math.sign(compareKitVersion(a, b))).toBe(-1);

describe('compareKitVersion', () => {
  it('orders prereleases ascending and below the stable release', () => {
    lt('2.0.0-beta-01', '2.0.0-beta-02');
    lt('2.0.0-beta-02', '2.0.0-rc-01');
    lt('2.0.0-rc-01', '2.0.0');
  });

  it('treats a stable release as greater than its own prereleases', () => {
    expect(compareKitVersion('2.0.0', '2.0.0-beta-01')).toBeGreaterThan(0);
    expect(compareKitVersion('2.0.0', '2.0.0-rc-01')).toBeGreaterThan(0);
  });

  it('parses both the -beta-01 (single id) and -beta.1 (dotted) forms', () => {
    lt('2.0.0-beta.1', '2.0.0-beta.2');
    lt('2.0.0-beta.2', '2.0.0');
    // dotted numeric identifiers compare numerically (2 < 10, not ASCII)
    lt('2.0.0-beta.2', '2.0.0-beta.10');
  });

  it('sorts a mixed list ascending', () => {
    const arr = ['2.0.0', '1.9.9', '2.0.0-rc-01', '2.0.0-beta-01'];
    expect([...arr].sort(compareKitVersion)).toEqual([
      '1.9.9',
      '2.0.0-beta-01',
      '2.0.0-rc-01',
      '2.0.0',
    ]);
  });

  it('compares numeric core fields (major/minor/patch)', () => {
    lt('1.2.3', '1.2.4');
    lt('1.2.3', '1.3.0');
    lt('1.2.3', '2.0.0');
    expect(compareKitVersion('1.2.3', '1.2.3')).toBe(0);
  });

  it('tolerates a leading v prefix', () => {
    expect(compareKitVersion('v2.0.0', '2.0.0')).toBe(0);
    lt('v1.0.0', 'v2.0.0');
  });
});
