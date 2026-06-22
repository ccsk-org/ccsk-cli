/**
 * Unit tests for donation-qr — pure VietQR payload/URL builders and layout.
 * No network: VietQR payloads are built locally.
 */
import { describe, it, expect } from 'vitest';
import {
  buildDonationMemo,
  buildVietQRUrl,
  padRight,
  renderSideBySide,
} from '../src/core/donation-qr.js';
import type { Bank } from '../src/core/payment-config.js';

const bank: Bank = {
  bin: '970407',
  account_number: '19034526108011',
  account_name: 'CCSK MAINTAINER',
  label: 'Techcombank',
};

describe('buildDonationMemo', () => {
  it('uppercases and de-underscores the tier id', () => {
    expect(buildDonationMemo('coffee')).toBe('CCSK DONATE COFFEE');
    expect(buildDonationMemo('bubble_tea')).toBe('CCSK DONATE BUBBLE TEA');
  });
});

describe('buildVietQRUrl', () => {
  it('encodes account name, amount, and memo into the image URL', () => {
    const url = buildVietQRUrl(bank, 50_000, 'CCSK DONATE COFFEE');
    expect(url).toContain(`${bank.bin}-${bank.account_number}-`);
    expect(url).toContain('amount=50000');
    expect(url).toContain('addInfo=CCSK+DONATE+COFFEE');
    expect(url).toContain('accountName=CCSK+MAINTAINER');
  });
});

describe('padRight', () => {
  it('pads short lines and leaves long lines untouched', () => {
    expect(padRight('ab', 5)).toBe('ab   ');
    expect(padRight('abcdef', 3)).toBe('abcdef');
  });
});

describe('renderSideBySide', () => {
  it('places labels on the first row and aligns blocks in columns', () => {
    const out = renderSideBySide([
      { label: '[A]', qr: ['##', '..'] },
      { label: '[B]', qr: ['@@', '++'] },
    ]);
    const lines = out.split('\n');
    expect(lines[0]).toContain('[A]');
    expect(lines[0]).toContain('[B]');
    expect(lines).toHaveLength(3); // label row + 2 qr rows
  });
});
