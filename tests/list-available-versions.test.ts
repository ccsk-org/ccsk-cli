/**
 * Unit tests for listAvailableVersions — the gh-releases JSONL path, the
 * git-ls-remote fallback, and the all-fail → [] guarantee. execa + github-auth
 * are mocked so no network/process runs.
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

import { listAvailableVersions } from '../src/core/kit-fetcher.js';

beforeEach(() => {
  execaMock.mockReset();
  detectAuthMock.mockReset();
});

describe('listAvailableVersions', () => {
  it('parses gh JSONL releases newest-first, honoring the prerelease flag', async () => {
    execaMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'gh') {
        return {
          exitCode: 0,
          stdout: [
            JSON.stringify({ tag: 'v2.0.0', pre: false, at: '2026-06-01T00:00:00Z' }),
            JSON.stringify({ tag: 'v2.0.0-beta-01', pre: true, at: '2026-05-01T00:00:00Z' }),
            JSON.stringify({ tag: 'v1.0.0', pre: false, at: '2026-01-01T00:00:00Z' }),
            JSON.stringify({ tag: 'not-a-version', pre: false, at: null }),
          ].join('\n'),
        };
      }
      return { exitCode: 1, stdout: '' };
    });

    const list = await listAvailableVersions();

    expect(list.map((v) => v.version)).toEqual(['2.0.0', '2.0.0-beta-01', '1.0.0']);
    expect(list.find((v) => v.version === '2.0.0-beta-01')?.prerelease).toBe(true);
    expect(list[0].publishedAt).toBe('2026-06-01T00:00:00Z');
    // gh succeeded → never falls through to auth detection / git
    expect(detectAuthMock).not.toHaveBeenCalled();
  });

  it('falls back to git ls-remote tags when gh yields nothing', async () => {
    detectAuthMock.mockResolvedValue({ method: 'gh' });
    execaMock.mockImplementation(async (cmd: string) => {
      if (cmd === 'gh') return { exitCode: 1, stdout: '' };
      if (cmd === 'git') {
        return {
          exitCode: 0,
          stdout: [
            'abc123\trefs/tags/v2.0.0',
            'def456\trefs/tags/v2.0.0-beta-01',
            'ghi789\trefs/tags/random-tag',
          ].join('\n'),
        };
      }
      return { exitCode: 1, stdout: '' };
    });

    const list = await listAvailableVersions();

    expect(list.map((v) => v.version)).toEqual(['2.0.0', '2.0.0-beta-01']);
    const beta = list.find((v) => v.version === '2.0.0-beta-01');
    expect(beta?.prerelease).toBe(true); // inferred from the dash
    expect(beta?.publishedAt).toBeUndefined(); // git path has no dates
  });

  it('returns [] when gh is empty and there is no git auth', async () => {
    detectAuthMock.mockResolvedValue({ method: 'none' });
    execaMock.mockResolvedValue({ exitCode: 1, stdout: '' });
    expect(await listAvailableVersions()).toEqual([]);
  });

  it('never throws — execa rejection yields []', async () => {
    detectAuthMock.mockResolvedValue({ method: 'none' });
    execaMock.mockRejectedValue(new Error('spawn ENOENT'));
    expect(await listAvailableVersions()).toEqual([]);
  });
});
