import { execa } from 'execa';
import { binExists, platform } from '../util/platform.js';
import type { StepResult } from './step-result.js';

const RELEASES_URL = 'https://github.com/cli/cli/releases';

/**
 * Ensures the `gh` CLI is installed.
 * - macOS: brew
 * - Linux: apt/dnf/pacman, snap, or brew
 * - Windows: winget, choco, or scoop
 */
export async function ensureGhCli(): Promise<StepResult> {
  const name = 'gh cli install';

  if (await binExists('gh')) {
    return { name, status: 'skipped', detail: 'already installed' };
  }

  try {
    if (platform.isMac) {
      if (await binExists('brew')) {
        await execa('brew', ['install', 'gh'], { stdio: 'inherit' });
        return { name, status: 'ok', detail: 'via brew' };
      }
    }

    if (platform.isLinux) {
      if (await binExists('brew')) {
        await execa('brew', ['install', 'gh'], { stdio: 'inherit' });
        return { name, status: 'ok', detail: 'via brew' };
      }
      if (await binExists('apt')) {
        await execa('sudo', ['apt', 'update'], { stdio: 'inherit' });
        await execa('sudo', ['apt', 'install', '-y', 'gh'], { stdio: 'inherit' });
        return { name, status: 'ok', detail: 'via apt' };
      }
      if (await binExists('dnf')) {
        await execa('sudo', ['dnf', 'install', '-y', 'gh'], { stdio: 'inherit' });
        return { name, status: 'ok', detail: 'via dnf' };
      }
      if (await binExists('pacman')) {
        await execa('sudo', ['pacman', '-S', '--noconfirm', 'github-cli'], { stdio: 'inherit' });
        return { name, status: 'ok', detail: 'via pacman' };
      }
      if (await binExists('snap')) {
        await execa('sudo', ['snap', 'install', 'gh'], { stdio: 'inherit' });
        return { name, status: 'ok', detail: 'via snap' };
      }
    }

    if (platform.isWindows) {
      if (await binExists('winget')) {
        await execa('winget', ['install', '--id', 'GitHub.cli', '-e', '--source', 'winget'], {
          stdio: 'inherit',
        });
        return { name, status: 'ok', detail: 'via winget' };
      }
      if (await binExists('choco')) {
        await execa('choco', ['install', 'gh', '-y'], { stdio: 'inherit' });
        return { name, status: 'ok', detail: 'via choco' };
      }
      if (await binExists('scoop')) {
        await execa('scoop', ['install', 'gh'], { stdio: 'inherit' });
        return { name, status: 'ok', detail: 'via scoop' };
      }
    }
  } catch (err) {
    return { name, status: 'failed', detail: (err as Error).message };
  }

  const hint = `no supported package manager found — download from ${RELEASES_URL}`;
  return { name, status: 'failed', detail: hint };
}
