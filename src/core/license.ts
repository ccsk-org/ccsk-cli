/**
 * License validation with per-kit entitlements and per-GitHub-account binding.
 */

import { isCancel, select, text } from '@clack/prompts';
import fs from 'node:fs';
import path from 'node:path';
import { log } from '../util/log.js';
import { withShimmer } from '../util/shimmer-spinner.js';
import { homeDir } from '../util/platform.js';
import { detectAuthMethod } from './github-auth.js';
import { getKitMeta, type KitMeta } from './kit-registry.js';
import { getLifetimePriceVnd, runPurchaseFlow } from './vietqr.js';

const SUPABASE_URL = 'https://qorrssuqkblahzzlonhz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iYy5ExmiYqVIwxCD3e5SqQ_E1VNLSKK';

const LICENSE_DIR = path.join(homeDir(), '.ccsk');
const LICENSE_FILE = path.join(LICENSE_DIR, 'license');

const KEY_REGEX = /^CCSK-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export type LicenseResult =
  | { valid: true; key: string; entitlements: string[] }
  | { valid: false; reason: string; entitlements?: string[] };

interface ValidationResponse {
  valid: boolean;
  reason?: string;
  entitlements?: string[];
}

function readSavedKey(): string | null {
  try {
    if (fs.existsSync(LICENSE_FILE)) {
      return fs.readFileSync(LICENSE_FILE, 'utf8').trim();
    }
  } catch {
    // ignore read errors
  }
  return null;
}

function saveKey(key: string): void {
  fs.mkdirSync(LICENSE_DIR, { recursive: true });
  fs.writeFileSync(LICENSE_FILE, key, 'utf8');
}

async function resolveGitHubUsername(): Promise<string | null> {
  const status = await detectAuthMethod();
  return status.username ?? null;
}

async function validateKeyForKit(
  key: string,
  kitId: string,
  githubUsername: string | null,
): Promise<LicenseResult> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-license`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ key, kit: kitId, github_username: githubUsername }),
    });

    if (!res.ok) {
      return { valid: false, reason: 'License validation service unavailable.' };
    }

    const data = (await res.json()) as ValidationResponse;

    if (data.valid) {
      return { valid: true, key, entitlements: data.entitlements ?? [] };
    }
    return {
      valid: false,
      reason: data.reason ?? 'Invalid license key.',
      entitlements: data.entitlements,
    };
  } catch {
    return {
      valid: false,
      reason: 'Cannot verify license key. Check your internet connection.',
    };
  }
}

async function registerFreeLicense(): Promise<LicenseResult> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/register-free-license`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({}),
    });

    const bodyText = await res.text();

    if (!res.ok) {
      return {
        valid: false,
        reason: `Free license service returned HTTP ${res.status}: ${bodyText.slice(0, 200)}`,
      };
    }

    const data = JSON.parse(bodyText) as { key: string; entitlements: string[] };

    saveKey(data.key);
    return { valid: true, key: data.key, entitlements: data.entitlements };
  } catch (err) {
    return {
      valid: false,
      reason: `Could not register free license: ${(err as Error).message}`,
    };
  }
}

async function promptForKey(): Promise<string | null> {
  const input = await text({
    message: 'Enter your license key:',
    placeholder: 'CCSK-XXXX-XXXX-XXXX',
    validate: (value) => {
      if (!value || !KEY_REGEX.test(value.trim().toUpperCase())) {
        return 'Invalid format. Expected: CCSK-XXXX-XXXX-XXXX';
      }
    },
  });

  if (isCancel(input)) return null;
  return (input as string).trim().toUpperCase();
}

async function promptEmail(): Promise<string | null> {
  const input = await text({
    message: 'Email to receive your license key:',
    placeholder: 'you@example.com',
    validate: (value) => {
      if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        return 'Please enter a valid email address.';
      }
    },
  });

  if (isCancel(input)) return null;
  return (input as string).trim().toLowerCase();
}

type PaidMenuChoice = 'enter' | 'buy' | 'back';

async function showPaidKitMenu(kit: KitMeta, priceVnd: number): Promise<PaidMenuChoice> {
  const choice = await select({
    message: `${kit.label} kit requires a license.`,
    options: [
      { value: 'enter' as const, label: 'Already have a license. Enter key' },
      {
        value: 'buy' as const,
        label: `Purchase a license (${priceVnd.toLocaleString('vi-VN')} VND - lifetime)`,
      },
      { value: 'back' as const, label: 'Back' },
    ],
  });

  if (isCancel(choice)) return 'back';
  return choice as PaidMenuChoice;
}

/** Validate license for a specific kit. Handles free vs paid + 3-option menu. */
export async function validateLicenseForKit(kitId: string): Promise<LicenseResult> {
  const kit = getKitMeta(kitId);
  const isPaidKit = kit?.pricing === 'paid';

  const githubUsername = isPaidKit ? await resolveGitHubUsername() : null;

  const savedKey = readSavedKey();

  // Try saved key first.
  if (savedKey && KEY_REGEX.test(savedKey)) {
    const result = await withShimmer(
      `Validating license for ${kit?.label ?? kitId}…`,
      () => validateKeyForKit(savedKey, kitId, githubUsername),
    );
    if (result.valid) {
      return result;
    }
    if (result.entitlements && result.entitlements.length > 0) {
      log.warn(`Your license includes: ${result.entitlements.join(', ')}`);
      log.warn(`But does not include: ${kitId}`);
    }
  }

  // Free kit: never prompt. Auto-(re)register if no valid license.
  if (!isPaidKit) {
    return withShimmer('Activating free license…', () => registerFreeLicense());
  }

  // Paid kit: present 3-option menu.
  if (isPaidKit && kit) {
    if (!githubUsername) {
      return {
        valid: false,
        reason:
          'GitHub authentication is required for paid kits. Configure SSH (`ssh -T git@github.com`) or `gh auth login`, then retry.',
      };
    }

    const priceVnd = await getLifetimePriceVnd();
    const choice = await showPaidKitMenu(kit, priceVnd);

    if (choice === 'back') {
      return { valid: false, reason: 'Cancelled.' };
    }

    if (choice === 'buy') {
      const email = await promptEmail();
      if (!email) {
        return { valid: false, reason: 'Cancelled.' };
      }
      await runPurchaseFlow(kit, email, githubUsername);
      return {
        valid: false,
        reason: 'Awaiting payment confirmation. Re-run `ccsk init` after you receive the license key by email.',
      };
    }
    // choice === 'enter' → fall through to promptForKey.
  }

  const newKey = await promptForKey();

  if (!newKey) {
    return { valid: false, reason: 'License key required for this kit.' };
  }

  const result = await validateKeyForKit(newKey, kitId, githubUsername);

  if (result.valid) {
    saveKey(newKey);
    log.success('License key saved.');
  }

  return result;
}

/** Legacy: validate license without kit context (backward compat). */
export async function validateLicense(): Promise<LicenseResult> {
  return validateLicenseForKit('common');
}

/** Check if saved license includes a kit (without network call). */
export function hasSavedLicense(): boolean {
  const key = readSavedKey();
  return key !== null && KEY_REGEX.test(key);
}

/** Get the saved license key. */
export function getSavedKey(): string | null {
  return readSavedKey();
}

/** Generates a random license key (for admin use). */
export function generateKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `CCSK-${segment()}-${segment()}-${segment()}`;
}
