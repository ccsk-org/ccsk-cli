/**
 * Pure VietQR payload/URL builders and terminal layout helpers for the donation
 * flow. Kept separate from `donation.ts` so the formatting logic stays small and
 * unit-testable without touching prompts or the network.
 */

import { QRPay } from 'vietnam-qr-pay';
import { renderQrTerminal } from '../util/qr-terminal.js';
import type { Bank } from './payment-config.js';

/** Builds the transfer memo, e.g. `coffee` → `CCSK DONATE COFFEE`. */
export function buildDonationMemo(tierId: string): string {
  return `CCSK DONATE ${tierId.toUpperCase().replace('_', ' ')}`;
}

/** Builds an EMVCo VietQR payload string for the given bank/amount/memo. */
export function buildVietQRPayload(bank: Bank, amount: number, memo: string): string {
  const qr = QRPay.initVietQR({
    bankBin: bank.bin,
    bankNumber: bank.account_number,
  });
  qr.amount = amount.toString();
  qr.additionalData.purpose = memo;
  return qr.build();
}

/** Builds the vietqr.io image URL shown as a manual fallback (not auto-fetched). */
export function buildVietQRUrl(bank: Bank, amount: number, memo: string): string {
  const params = new URLSearchParams({
    accountName: bank.account_name,
    amount: amount.toString(),
    addInfo: memo,
  });
  return `https://api.vietqr.io/image/${bank.bin}-${bank.account_number}-i7ISzDh.jpg?${params.toString()}`;
}

/** Renders a QR payload to terminal lines (half-block characters). */
export function renderQrLines(content: string): string[] {
  return renderQrTerminal(content);
}

/** Right-pads a line to `width` columns; never truncates. */
export function padRight(line: string, width: number): string {
  if (line.length >= width) return line;
  return line + ' '.repeat(width - line.length);
}

/** Lays out labelled QR blocks side by side, aligned in columns. */
export function renderSideBySide(blocks: Array<{ label: string; qr: string[] }>): string {
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
