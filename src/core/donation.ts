/**
 * Donation flow — "Buy me a coffee" style support via VietQR.
 * Tiers: $2 (Black Coffee), $5 (Bubble Tea), $10 (Latte), $25 (Fancy Brunch)
 */

import { isCancel, select, text } from '@clack/prompts';
import { QRPay } from 'vietnam-qr-pay';
import { log } from '../util/log.js';
import { renderQrTerminal } from '../util/qr-terminal.js';
import { withShimmer } from '../util/shimmer-spinner.js';
import { getPaymentConfig, type Bank } from './payment-config.js';

const SUPABASE_URL = 'https://qorrssuqkblahzzlonhz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iYy5ExmiYqVIwxCD3e5SqQ_E1VNLSKK';

export interface DonationTier {
  id: string;
  label: string;
  emoji: string;
  amountUsd: number;
  amountVnd: number;
}

// VND amounts based on ~25,000 VND per USD
export const DONATION_TIERS: DonationTier[] = [
  { id: 'coffee',     label: 'Black Coffee',  emoji: '☕',  amountUsd: 2,  amountVnd: 50_000  },
  { id: 'bubble_tea', label: 'Bubble Tea',    emoji: '🧋',  amountUsd: 5,  amountVnd: 125_000 },
  { id: 'latte',      label: 'Latte',         emoji: '☕☕', amountUsd: 10, amountVnd: 250_000 },
  { id: 'brunch',     label: 'Fancy Brunch',  emoji: '🍳',  amountUsd: 25, amountVnd: 625_000 },
];

interface DonationRecord {
  tier: string;
  amount_usd: number;
  amount_vnd: number;
  email: string | null;
  memo: string;
}

function buildDonationMemo(tier: DonationTier): string {
  // Format: "CCSK DONATE COFFEE" or "CCSK DONATE BRUNCH"
  return `CCSK DONATE ${tier.id.toUpperCase().replace('_', ' ')}`;
}

function buildVietQRPayload(bank: Bank, amount: number, memo: string): string {
  const qr = QRPay.initVietQR({
    bankBin: bank.bin,
    bankNumber: bank.account_number,
  });
  qr.amount = amount.toString();
  qr.additionalData.purpose = memo;
  return qr.build();
}

function buildVietQRUrl(bank: Bank, amount: number, memo: string): string {
  const params = new URLSearchParams({
    accountName: bank.account_name,
    amount: amount.toString(),
    addInfo: memo,
  });
  return `https://api.vietqr.io/image/${bank.bin}-${bank.account_number}-i7ISzDh.jpg?${params.toString()}`;
}

function renderQrLines(content: string): string[] {
  return renderQrTerminal(content);
}

function padRight(line: string, width: number): string {
  if (line.length >= width) return line;
  return line + ' '.repeat(width - line.length);
}

function renderSideBySide(blocks: Array<{ label: string; qr: string[] }>): string {
  const widths = blocks.map((b) => b.qr.reduce((max, l) => Math.max(max, l.length), b.label.length));
  const rows = blocks.reduce((max, b) => Math.max(max, b.qr.length), 0);
  const gap = '    ';
  const lines: string[] = [];

  lines.push(blocks.map((b, i) => padRight(b.label, widths[i])).join(gap));

  for (let i = 0; i < rows; i++) {
    lines.push(blocks.map((b, idx) => padRight(b.qr[i] ?? '', widths[idx])).join(gap));
  }

  return lines.join('\n');
}

async function recordDonation(record: DonationRecord): Promise<boolean> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/record-donation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(record),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function promptOptionalEmail(): Promise<string | null> {
  const input = await text({
    message: 'Email for thank-you note (optional, press Enter to skip):',
    placeholder: 'you@example.com',
    validate: (value) => {
      if (!value) return;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
        return 'Please enter a valid email address or leave empty.';
      }
    },
  });

  if (isCancel(input) || !input) return null;
  return (input as string).trim().toLowerCase();
}

async function selectTier(): Promise<DonationTier | null> {
  const choice = await select({
    message: 'Choose your support level:',
    options: DONATION_TIERS.map((tier) => ({
      value: tier.id,
      label: `${tier.emoji} ${tier.label} — $${tier.amountUsd} (${tier.amountVnd.toLocaleString('vi-VN')} VND)`,
    })),
  });

  if (isCancel(choice)) return null;
  return DONATION_TIERS.find((t) => t.id === choice) ?? null;
}

/**
 * Run the donation flow. Shows tier picker, optional email, VietQR codes.
 * Returns true if user completed the flow, false if cancelled.
 */
export async function runDonateFlow(): Promise<boolean> {
  log.info('');
  log.info('☕ Thank you for considering a donation!');
  log.info('Your support helps maintain and improve ccsk.');
  log.info('');

  const tier = await selectTier();
  if (!tier) {
    log.info('No worries! You can always donate later with `ccsk donate`.');
    return false;
  }

  const email = await promptOptionalEmail();

  const config = await withShimmer('Loading payment info…', getPaymentConfig);

  if (config.banks.length === 0) {
    log.error('Payment banks not configured. Please try again later.');
    return false;
  }

  const memo = buildDonationMemo(tier);

  // Record donation attempt (fire and forget)
  recordDonation({
    tier: tier.id,
    amount_usd: tier.amountUsd,
    amount_vnd: tier.amountVnd,
    email,
    memo,
  });

  const blocks = config.banks.map((bank) => {
    const payload = buildVietQRPayload(bank, tier.amountVnd, memo);
    const url = buildVietQRUrl(bank, tier.amountVnd, memo);
    return { bank, url, qr: renderQrLines(payload) };
  });

  log.info('');
  log.info(`${tier.emoji} ${tier.label} — $${tier.amountUsd} (${tier.amountVnd.toLocaleString('vi-VN')} VND)`);
  log.info(`Account    : ${config.banks[0].account_name}`);
  log.info(`Memo       : ${memo}`);
  log.info('');
  log.info('Scan a QR with your phone camera, then complete the transfer in your banking app:');
  log.info('');

  console.log(
    renderSideBySide(blocks.map((b) => ({ label: `[${b.bank.label}]`, qr: b.qr }))),
  );

  log.info('');
  for (const b of blocks) {
    log.info(`${b.bank.label.padEnd(12)} : ${b.url}`);
  }
  log.info('');

  if (email) {
    log.success(`Thank you! 💙 We'll send a thank-you note to ${email}.`);
  } else {
    log.success('Thank you for your support! 💙');
  }

  log.info('');
  log.hint('Note: This uses VietQR (Vietnamese banking). International supporters can use GitHub Sponsors.');

  return true;
}

/**
 * Quick donate prompt shown after successful init.
 * Returns true if user chose to donate, false otherwise.
 */
export async function promptDonateAfterInit(): Promise<boolean> {
  const { confirm, isCancel } = await import('@clack/prompts');

  const answer = await confirm({
    message: '☕ Like ccsk? Support the project with a coffee?',
    initialValue: false,
  });

  if (isCancel(answer) || !answer) {
    return false;
  }

  return runDonateFlow();
}
