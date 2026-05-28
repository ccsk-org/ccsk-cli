/**
 * Payment config loader — banks + lifetime price live in Supabase so the operator
 * can edit them in the table editor without redeploying the CLI.
 */

import { log } from '../util/log.js';

const SUPABASE_URL = 'https://qorrssuqkblahzzlonhz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iYy5ExmiYqVIwxCD3e5SqQ_E1VNLSKK';

export interface Bank {
  label: string;
  bin: string;
  account_number: string;
  account_name: string;
}

export interface PaymentConfig {
  lifetime_price_vnd: number;
  banks: Bank[];
}

// Fallback only used when the config endpoint is unreachable. Values match seed migration.
const FALLBACK_CONFIG: PaymentConfig = {
  lifetime_price_vnd: 265_000,
  banks: [
    { label: 'Momo',        bin: '971025', account_number: '0915272291',     account_name: 'DUONG BAC DONG' },
    { label: 'Techcombank', bin: '970407', account_number: '19034526108011', account_name: 'DUONG BAC DONG' },
  ],
};

let cached: PaymentConfig | null = null;

export async function getPaymentConfig(): Promise<PaymentConfig> {
  if (cached) return cached;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/get-payment-config`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });

    if (!res.ok) {
      log.warn(`Payment config service returned HTTP ${res.status}; using fallback values.`);
      cached = FALLBACK_CONFIG;
      return cached;
    }

    const data = (await res.json()) as PaymentConfig;
    if (!data?.banks?.length || !data.lifetime_price_vnd) {
      log.warn('Payment config is empty; using fallback values.');
      cached = FALLBACK_CONFIG;
      return cached;
    }

    cached = data;
    return cached;
  } catch {
    log.warn('Could not reach payment config service; using fallback values.');
    cached = FALLBACK_CONFIG;
    return cached;
  }
}
