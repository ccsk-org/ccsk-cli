import { select, confirm, isCancel, cancel } from '@clack/prompts';
import { execa } from 'execa';
import { log } from '../util/log.js';
import { withShimmer } from '../util/shimmer-spinner.js';
import { DESIGNS, getCategories, getByCategory, CATEGORY_ORDER } from '../core/design-catalog.js';

export interface DesignOptions {
  targetPath: string;
  yes: boolean;
}

export async function runDesignSetup(opts: DesignOptions): Promise<void> {
  if (!opts.yes) {
    const want = await confirm({
      message: 'Add a design reference for your UI?',
      initialValue: false,
    });
    if (isCancel(want) || !want) return;
  }

  const categories = getCategories();

  const categoryChoice = await select({
    message: 'Browse by category:',
    options: [
      ...CATEGORY_ORDER.map((name) => {
        const count = categories.find((c) => c.name === name)?.count ?? 0;
        return { value: name, label: name, hint: `${count} designs` };
      }),
      { value: '__all__', label: 'All designs', hint: `${DESIGNS.length} total` },
    ],
  });

  if (isCancel(categoryChoice)) {
    cancel('Cancelled.');
    return;
  }

  const pool =
    categoryChoice === '__all__'
      ? DESIGNS
      : getByCategory(categoryChoice as string);

  if (pool.length === 0) {
    log.warn('No designs found.');
    return;
  }

  const designChoice = await select({
    message: 'Choose a design:',
    options: pool.map((d) => ({
      value: d.slug,
      label: d.name,
      hint: d.desc,
    })),
  });

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
