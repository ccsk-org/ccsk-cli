/**
 * fetchKit version normalization — a user-supplied `--version` may include a
 * leading `v`. Since the clone uses tag `v${version}`, an un-stripped `v1.2.0`
 * would become `vv1.2.0` and fail. fetchKit must strip the prefix so both
 * `1.2.0` and `v1.2.0` clone tag `v1.2.0`. execa/auth/cache/fs are mocked so no
 * network/process/disk runs.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { execaMock, detectAuthMock } = vi.hoisted(() => ({
  execaMock: vi.fn(),
  detectAuthMock: vi.fn(),
}));

vi.mock('execa', () => ({ execa: execaMock }));
vi.mock('../src/core/github-auth.js', () => ({
  detectAuthMethod: detectAuthMock,
  getCloneUrl: (repo: string, method: string) =>
    method === 'ssh' ? `git@github.com:${repo}.git` : `https://github.com/${repo}.git`,
}));
vi.mock('../src/core/kit-cache.js', () => ({
  ensureCacheDirs: vi.fn(),
  isCached: vi.fn(() => false),
  getCachePath: (v: string) => `/tmp/ccsk-test-cache/${v}`,
  writeCacheMarker: vi.fn(),
  removeCacheMarker: vi.fn(),
}));
vi.mock('../src/util/shimmer-spinner.js', () => ({
  withShimmer: (_label: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock('../src/util/log.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), step: vi.fn(), success: vi.fn(), dim: vi.fn(), hint: vi.fn() },
  pc: {},
}));
vi.mock('node:fs', () => ({
  default: { existsSync: vi.fn(() => false), rmSync: vi.fn(), mkdirSync: vi.fn() },
}));

import { fetchKit } from '../src/core/kit-fetcher.js';

function cloneBranchArg(): string | undefined {
  const call = execaMock.mock.calls.find(
    (c) => c[0] === 'git' && Array.isArray(c[1]) && c[1].includes('clone'),
  );
  const args = call?.[1] as string[] | undefined;
  if (!args) return undefined;
  return args[args.indexOf('--branch') + 1];
}

beforeEach(() => {
  execaMock.mockReset();
  detectAuthMock.mockReset();
  detectAuthMock.mockResolvedValue({ method: 'ssh' });
  // git clone → ok; git rev-parse HEAD → a sha
  execaMock.mockImplementation(async (_cmd: string, args: string[]) => {
    if (args?.includes('rev-parse')) return { stdout: 'deadbeef', exitCode: 0 };
    return { stdout: '', exitCode: 0 };
  });
});

describe('fetchKit version normalization', () => {
  it('strips a leading v from --version so v1.2.0 clones tag v1.2.0 (not vv1.2.0)', async () => {
    const res = await fetchKit({ version: 'v1.2.0' });
    expect(res.success).toBe(true);
    expect(res.version).toBe('1.2.0');
    expect(cloneBranchArg()).toBe('v1.2.0');
  });

  it('accepts a bare 1.2.0 and clones the same tag v1.2.0', async () => {
    const res = await fetchKit({ version: '1.2.0' });
    expect(res.success).toBe(true);
    expect(res.version).toBe('1.2.0');
    expect(cloneBranchArg()).toBe('v1.2.0');
  });

  it('preserves a prerelease version (v2.0.0-beta-01 → tag v2.0.0-beta-01)', async () => {
    const res = await fetchKit({ version: 'v2.0.0-beta-01' });
    expect(res.success).toBe(true);
    expect(res.version).toBe('2.0.0-beta-01');
    expect(cloneBranchArg()).toBe('v2.0.0-beta-01');
  });
});
