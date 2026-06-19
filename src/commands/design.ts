import { confirm, isCancel, cancel } from '@clack/prompts';
import { execa } from 'execa';
import { log } from '../util/log.js';
import { withShimmer } from '../util/shimmer-spinner.js';
import { DESIGNS, getCategoryGroups } from '../core/design-catalog.js';
import { pickDesignByCategory } from '../util/category-accordion-prompt.js';

export interface DesignOptions {
  targetPath: string;
  yes: boolean;
}

export async function runDesignSetup(opts: DesignOptions): Promise<void> {
  // The category accordion is interactive-only. Under --yes / non-TTY / CI there
  // is no way to answer it, so skip the optional design step rather than hang.
  if (opts.yes || !process.stdout.isTTY || process.env.CI) return;

  const want = await confirm({
    message: 'Add a design reference for your UI?',
    initialValue: false,
  });
  if (isCancel(want) || !want) return;

  const designChoice = await pickDesignByCategory(getCategoryGroups());

  if (isCancel(designChoice)) {
    cancel('Cancelled.');
    return;
  }

  const slug = designChoice as string;
  const entry = DESIGNS.find((d) => d.slug === slug);

  await withShimmer(`Adding ${entry?.name ?? slug} design reference…`, async () => {
    await execa('npx', ['--yes', 'getdesign@latest', 'add', slug, '--force'], {
      cwd: opts.targetPath,
      stdio: 'pipe',
    });
  });

  log.success('DESIGN.md added — Claude will use it as visual context when building UI.');
}

export async function runDesign(opts: DesignOptions): Promise<void> {
  return runDesignSetup({ ...opts, yes: false });
}
