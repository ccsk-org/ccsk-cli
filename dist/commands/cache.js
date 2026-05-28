/**
 * ccsk cache — manage downloaded kit cache.
 */
import { select, confirm, isCancel } from '@clack/prompts';
import { KIT_REGISTRY, getKitMeta } from '../core/kit-registry.js';
import { validateLicenseForKit } from '../core/license.js';
import { ensureGitHubAuth } from '../core/github-auth.js';
import { fetchKit, fetchLatestVersion } from '../core/kit-fetcher.js';
import { listCachedKits, clearCache, clearAllCache, formatSize, } from '../core/kit-cache.js';
import { log } from '../util/log.js';
export async function runCache(opts) {
    // List cached kits
    if (opts.list) {
        const cached = listCachedKits();
        if (cached.length === 0) {
            log.info('No kits cached.');
            log.hint('Run: ccsk cache --kit <name> to download a kit for offline use.');
            return;
        }
        log.info('Cached kits:');
        log.info('');
        for (const kit of cached) {
            const meta = getKitMeta(kit.kitId);
            const label = meta?.label ?? kit.kitId;
            log.info(`  ${label.padEnd(12)} v${kit.version.padEnd(8)} (${formatSize(kit.sizeBytes)})`);
        }
        return;
    }
    // Clear all cache
    if (opts.clearAll) {
        const answer = await confirm({
            message: 'Clear all cached kits?',
            initialValue: false,
        });
        if (isCancel(answer) || !answer) {
            log.info('Cancelled.');
            return;
        }
        clearAllCache();
        log.success('All cached kits cleared.');
        return;
    }
    // Clear specific kit cache
    if (opts.clear) {
        if (!opts.kit) {
            log.error('Specify a kit to clear: ccsk cache --clear --kit <name>');
            return;
        }
        const cleared = clearCache(opts.kit, opts.version);
        if (cleared) {
            log.success(`Cleared cache for ${opts.kit}${opts.version ? ` v${opts.version}` : ''}`);
        }
        else {
            log.warn(`No cache found for ${opts.kit}${opts.version ? ` v${opts.version}` : ''}`);
        }
        return;
    }
    // Download kit to cache
    if (opts.kit) {
        const kit = getKitMeta(opts.kit);
        if (!kit) {
            log.error(`Unknown kit: ${opts.kit}`);
            log.hint(`Available: ${KIT_REGISTRY.map((k) => k.id).join(', ')}`);
            return;
        }
        // Validate license
        log.step(`Validating license for ${kit.label} kit...`);
        const license = await validateLicenseForKit(kit.id);
        if (!license.valid) {
            log.error(license.reason);
            return;
        }
        // Ensure GitHub auth
        const auth = await ensureGitHubAuth();
        if (auth.method === 'none') {
            return;
        }
        // Resolve version
        const version = opts.version ?? (await fetchLatestVersion(kit)) ?? kit.defaultVersion;
        // Fetch
        const result = await fetchKit(kit, { version, force: true });
        if (result.success) {
            log.success(`Cached ${kit.label} kit v${version}`);
            log.hint(`Path: ${result.cachePath}`);
        }
        else {
            log.error(result.error ?? 'Failed to cache kit');
        }
        return;
    }
    // Interactive mode
    const choice = await select({
        message: 'What would you like to do?',
        options: [
            { value: 'list', label: 'List cached kits' },
            { value: 'download', label: 'Download a kit for offline use' },
            { value: 'clear', label: 'Clear cached kits' },
        ],
    });
    if (isCancel(choice))
        return;
    if (choice === 'list') {
        await runCache({ list: true });
    }
    else if (choice === 'download') {
        const kitChoice = await select({
            message: 'Which kit to download?',
            options: KIT_REGISTRY.map((k) => ({
                value: k.id,
                label: k.label,
                hint: k.description,
            })),
        });
        if (!isCancel(kitChoice)) {
            await runCache({ kit: kitChoice });
        }
    }
    else if (choice === 'clear') {
        await runCache({ clearAll: true });
    }
}
//# sourceMappingURL=cache.js.map