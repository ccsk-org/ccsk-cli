/**
 * License validation with per-kit entitlements.
 */

import { isCancel, text } from '@clack/prompts';
import fs from 'node:fs';
import path from 'node:path';
import { log } from '../util/log.js';
import { homeDir } from '../util/platform.js';

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

/** Validate a license key for a specific kit. */
async function validateKeyForKit(key: string, kitId: string): Promise<LicenseResult> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/validate-license`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ key, kit: kitId }),
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

/** Register a free license for common kit. */
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

    if (!res.ok) {
      return { valid: false, reason: 'Could not register free license. Try again later.' };
    }

    const data = (await res.json()) as { key: string; entitlements: string[] };

    saveKey(data.key);
    log.success('Free license activated.');
    return { valid: true, key: data.key, entitlements: data.entitlements };
  } catch {
    return {
      valid: false,
      reason: 'Could not register free license. Check your internet connection.',
    };
  }
}

async function promptForKey(): Promise<string | null> {
  log.info('A license key is required for this kit.');
  log.hint('Enter your license key or purchase one to continue.');

  const input = await text({
    message: 'Enter your license key:',
    placeholder: 'CCSK-XXXX-XXXX-XXXX',
    validate: (value) => {
      if (!value || !KEY_REGEX.test(value.trim().toUpperCase())) {
        return 'Invalid format. Expected: CCSK-XXXX-XXXX-XXXX';
      }
    },
  });

  if (isCancel(input)) {
    return null;
  }

  return (input as string).trim().toUpperCase();
}

/** Validate license for a specific kit. Handles free vs paid logic. */
export async function validateLicenseForKit(kitId: string): Promise<LicenseResult> {
  const savedKey = readSavedKey();

  // If user has a saved key, check if it includes this kit
  if (savedKey && KEY_REGEX.test(savedKey)) {
    const result = await validateKeyForKit(savedKey, kitId);
    if (result.valid) {
      return result;
    }

    // Key exists but doesn't include this kit
    if (result.entitlements && result.entitlements.length > 0) {
      log.warn(`Your license includes: ${result.entitlements.join(', ')}`);
      log.warn(`But does not include: ${kitId}`);
    }
  }

  // For free kits (common), auto-register if no valid license
  if (kitId === 'common') {
    if (!savedKey) {
      log.step('Activating free license...');
      return registerFreeLicense();
    }
    // Has a key but validation failed — prompt for new one
  }

  // For paid kits, prompt for key
  const newKey = await promptForKey();

  if (!newKey) {
    return {
      valid: false,
      reason: 'License key required for this kit.',
    };
  }

  const result = await validateKeyForKit(newKey, kitId);

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
