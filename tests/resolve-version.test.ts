/**
 * Unit tests for init's resolveVersion matrix:
 *   --version (explicit) · --yes/CI (non-interactive) · --pre · interactive
 *   picker · the no-stable require-explicit failure.
 * kit-fetcher + version-picker are mocked so no network runs.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { stableMock, prereleaseMock, listMock, pickMock } = vi.hoisted(() => ({
  stableMock: vi.fn(),
  prereleaseMock: vi.fn(),
  listMock: vi.fn(),
  pickMock: vi.fn(),
}));

vi.mock('../src/core/kit-fetcher.js', () => ({
  fetchKit: vi.fn(),
  resolveLatestStable: stableMock,
  resolveLatestPrerelease: prereleaseMock,
  listAvailableVersions: listMock,
}));
vi.mock('../src/util/version-picker.js', () => ({ pickKitVersion: pickMock }));

import { resolveVersion, type InitOptions } from '../src/commands/init.js';
import type { AuthStatus } from '../src/core/github-auth.js';

const auth: AuthStatus = { method: 'gh' };
const base: InitOptions = { targetPath: '.', setup: false, add: false, yes: false };

let origTTY: PropertyDescriptor | undefined;
let origCI: string | undefined;

function setTTY(value: boolean): void {
  Object.defineProperty(process.stdout, 'isTTY', { value, configurable: true });
}

beforeEach(() => {
  stableMock.mockReset();
  prereleaseMock.mockReset();
  listMock.mockReset();
  pickMock.mockReset();
  origTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
  origCI = process.env.CI;
});

afterEach(() => {
  if (origTTY) Object.defineProperty(process.stdout, 'isTTY', origTTY);
  if (origCI === undefined) delete process.env.CI;
  else process.env.CI = origCI;
});

describe('resolveVersion', () => {
  it('explicit --version wins (skips picker + resolvers)', async () => {
    const r = await resolveVersion({ ...base, version: '1.2.3', yes: true }, auth);
    expect(r).toEqual({ kind: 'use', version: '1.2.3' });
    expect(stableMock).not.toHaveBeenCalled();
  });

  it('--yes resolves the latest stable', async () => {
    stableMock.mockResolvedValue('2.0.0');
    const r = await resolveVersion({ ...base, yes: true }, auth);
    expect(r).toEqual({ kind: 'use', version: '2.0.0' });
  });

  it('--yes with no stable and no --pre FAILS (require-explicit)', async () => {
    stableMock.mockResolvedValue(null);
    const r = await resolveVersion({ ...base, yes: true }, auth);
    expect(r.kind).toBe('fail');
  });

  it('--yes --pre resolves the newest prerelease', async () => {
    prereleaseMock.mockResolvedValue('2.1.0-beta-01');
    const r = await resolveVersion({ ...base, yes: true, pre: true }, auth);
    expect(r).toEqual({ kind: 'use', version: '2.1.0-beta-01' });
  });

  it('CI is non-interactive (uses latest stable, no picker)', async () => {
    delete process.env.CI;
    process.env.CI = '1';
    setTTY(true);
    stableMock.mockResolvedValue('2.0.0');
    const r = await resolveVersion({ ...base, yes: false }, auth);
    expect(r).toEqual({ kind: 'use', version: '2.0.0' });
    expect(pickMock).not.toHaveBeenCalled();
  });

  it('interactive shows the picker and returns the chosen version', async () => {
    delete process.env.CI;
    setTTY(true);
    listMock.mockResolvedValue([{ version: '2.0.0', tag: 'v2.0.0', prerelease: false }]);
    pickMock.mockResolvedValue('2.0.0');
    const r = await resolveVersion({ ...base, yes: false }, auth);
    expect(r).toEqual({ kind: 'use', version: '2.0.0' });
    expect(pickMock).toHaveBeenCalledOnce();
  });

  it('interactive cancel propagates as cancel', async () => {
    delete process.env.CI;
    setTTY(true);
    listMock.mockResolvedValue([{ version: '2.0.0', tag: 'v2.0.0', prerelease: false }]);
    pickMock.mockResolvedValue(null);
    const r = await resolveVersion({ ...base, yes: false }, auth);
    expect(r).toEqual({ kind: 'cancel' });
  });

  it('interactive with empty listing falls through to auto', async () => {
    delete process.env.CI;
    setTTY(true);
    listMock.mockResolvedValue([]);
    const r = await resolveVersion({ ...base, yes: false }, auth);
    expect(r).toEqual({ kind: 'auto' });
    expect(pickMock).not.toHaveBeenCalled();
  });
});
