/**
 * ccsk init — select kit, validate license, fetch from GitHub, copy to target.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { select, confirm, isCancel, cancel } from '@clack/prompts';
import { KIT_REGISTRY, formatKitPrice, getKitMeta, getEnabledKits, isKitEnabled, } from '../core/kit-registry.js';
import { validateLicenseForKit } from '../core/license.js';
import { getPaymentConfig } from '../core/payment-config.js';
import { ensureGitHubAuth } from '../core/github-auth.js';
import { fetchKit } from '../core/kit-fetcher.js';
import { copyKit } from '../core/copy-kit.js';
import { runSetup } from '../core/setup-runner.js';
import { printBanner } from '../util/banner.js';
import { log } from '../util/log.js';
const BANNER_META = {
    slogan: 'Claude Code Starter Kit — scaffold Claude-ready projects in one command.',
    author: 'Crystal D.',
    contributors: 'E.Wallis',
    organization: 'Trustify Technology JSC · US',
};
function readVersion() {
    try {
        const here = fileURLToPath(new URL('.', import.meta.url));
        const pkg = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'package.json'), 'utf8'));
        return pkg.version ?? '0.0.0';
    }
    catch {
        return '0.0.0';
    }
}
export async function runInit(opts) {
    printBanner({ ...BANNER_META, version: readVersion() });
    // 1. Select kit
    const kit = opts.kit ? getKitMeta(opts.kit) : await selectKit(opts.yes);
    if (!kit)
        return;
    // 2. Validate license for this kit (handles free auto-register + 3-option paid menu).
    // The shimmer spinner is shown inside validateLicenseForKit around each network call.
    const licenseResult = await validateLicenseForKit(kit.id);
    if (!licenseResult.valid) {
        log.info(licenseResult.reason);
        process.exit(1);
    }
    // 3. Ensure GitHub auth
    const auth = await ensureGitHubAuth();
    if (auth.method === 'none') {
        process.exit(1);
    }
    // 4. Fetch kit (from cache or clone)
    const fetchResult = await fetchKit(kit, {
        version: opts.version,
        force: opts.force,
    });
    if (!fetchResult.success) {
        log.error(fetchResult.error ?? 'Failed to fetch kit');
        process.exit(1);
    }
    // 5. Confirm overwrite and copy
    const targetAbs = path.resolve(process.cwd(), opts.targetPath);
    if (!(await confirmOverwrite(targetAbs, opts.yes))) {
        cancel('Cancelled — no files were written.');
        return;
    }
    log.step(`Installing "${kit.label}" kit into ${targetAbs}`);
    const written = await copyKit(fetchResult.cachePath, targetAbs);
    log.success(`Copied: ${written.join(', ')}`);
    // 6. Optional tool setup
    if (opts.setup && (opts.yes || await confirmSetup())) {
        await runSetup(targetAbs);
    }
    log.success('Done. Open the project in Claude Code to get started.');
    printNextSteps(targetAbs);
}
/**
 * Post-init guidance. Shown after a successful kit install so the user knows
 * the exact next command to bootstrap their tech stack + architecture + plan
 * via the slash command shipped inside the kit.
 */
function printNextSteps(targetAbs) {
    const rel = path.relative(process.cwd(), targetAbs) || '.';
    log.info('');
    log.info('Next:');
    log.info(`  cd ${rel}`);
    log.info('  claude                       # open Claude Code in this project');
    log.info('  /bootstrap <one-line>        # canonical name: ccsk:bootstrap → tech-stacks, architecture, docs, plan');
    log.info('');
    log.hint('Examples: `/bootstrap B2B HR SaaS for VN SMEs` · `/bootstrap` (no args = interview-only)');
}
async function selectKit(yes) {
    const enabledKits = getEnabledKits();
    if (yes) {
        return enabledKits[0] ?? null;
    }
    // Aligned-column picker. Price is sourced from Supabase `payment-config` so
    // operators can re-price all paid kits without a CLI release; getPaymentConfig
    // caches the response for the process lifetime and falls back to a baked-in
    // value if the service is unreachable.
    const { lifetime_price_vnd } = await getPaymentConfig();
    const labelled = KIT_REGISTRY.map((k) => ({ kit: k, price: formatKitPrice(k, lifetime_price_vnd) }));
    const nameWidth = Math.max(...labelled.map(({ kit }) => kit.label.length));
    const priceWidth = Math.max(...labelled.map(({ price }) => price.length));
    const dotsTotal = 4; // minimum dot run between name and price
    const fmt = (kit, price) => {
        const dots = '.'.repeat(Math.max(dotsTotal, nameWidth + dotsTotal - kit.label.length));
        return `${kit.label} ${dots} ${price.padStart(priceWidth)}`;
    };
    const choice = await select({
        message: 'Which kit do you want to install?',
        initialValue: 'frontend',
        options: labelled.map(({ kit, price }) => ({
            value: kit.id,
            label: fmt(kit, price),
            hint: kit.description,
        })),
    });
    if (isCancel(choice)) {
        cancel('Cancelled.');
        return null;
    }
    const kit = getKitMeta(choice);
    if (!kit || !isKitEnabled(kit.id)) {
        log.warn(`The "${kit?.label ?? choice}" kit is coming soon.`);
        return null;
    }
    return kit;
}
async function confirmOverwrite(targetAbs, yes) {
    if (yes)
        return true;
    // Check if target has existing files
    if (fs.existsSync(targetAbs)) {
        const entries = fs.readdirSync(targetAbs);
        const kitFiles = entries.filter((e) => e === 'CLAUDE.md' || e === '.claude' || e === '.mcp.json' || e === 'docs');
        if (kitFiles.length > 0) {
            log.warn(`Target already contains kit files: ${kitFiles.join(', ')}`);
            const answer = await confirm({ message: 'Overwrite them?', initialValue: true });
            return !isCancel(answer) && answer === true;
        }
    }
    return true;
}
async function confirmSetup() {
    const answer = await confirm({
        message: 'Run tool setup (RTK-AI + context-mode)?',
        initialValue: true,
    });
    return !isCancel(answer) && answer === true;
}
//# sourceMappingURL=init.js.map