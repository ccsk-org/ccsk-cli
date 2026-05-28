/**
 * VietQR payment flow for paid kits.
 */
import crypto from 'node:crypto';
import { log } from '../util/log.js';
const SUPABASE_URL = 'https://qorrssuqkblahzzlonhz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iYy5ExmiYqVIwxCD3e5SqQ_E1VNLSKK';
// Kit prices in VND
const KIT_PRICES = {
    frontend: 500_000,
    backend: 500_000,
    mobile: 500_000,
};
// Bank info for VietQR
const BANK_INFO = {
    bankId: 'VCB',
    accountNo: '1234567890',
    accountName: 'CRYSTAL D',
};
function generateUserHash() {
    const machineId = `${process.env.USER ?? 'user'}-${Date.now()}`;
    return crypto.createHash('sha256').update(machineId).digest('hex').slice(0, 12);
}
function getTransferMessage(kit, userHash) {
    const prefix = kit === 'frontend' ? 'FE' : kit === 'backend' ? 'BE' : 'MB';
    return `CCSK-${prefix}-${userHash}`;
}
function generateVietQRAscii(amount, message) {
    // Simple ASCII representation of QR payment info
    // In production, use a proper QR library
    const border = '─'.repeat(45);
    return `
┌${border}┐
│                                             │
│           SCAN TO PAY WITH VIETQR           │
│                                             │
│    ▄▄▄▄▄▄▄  ▄▄▄▄▄ ▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄         │
│    █ ▄▄▄ █ ▄█ ▄▄▀ █ ▄▄▄ █  █ ▄▄▄ █         │
│    █ ███ █ ▄▄▀█▄▄ █ ███ █  █ ███ █         │
│    █▄▄▄▄▄█ █ █ ▄ █▄▄▄▄▄█   █▄▄▄▄▄█         │
│    ▄▄ ▄  ▄▄▀▄▀▄▀▄ ▄▄▄▄▄▄   ▄ ▄ ▄▄▄         │
│    █▄██▀▄▄▄█▄▄▀▀█ ▀▄▀▄▀▄   ▀▄▀▄▀▄▀         │
│    ▄▄▄▄▄▄▄ █▀█▄█▄ ▄▄▄▄▄▄   ▄▄▄▄▄▄▄         │
│    █ ▄▄▄ █ ▄▄█▀▄▀ █ ▄▄▄ █  █ ▄▄▄ █         │
│    █ ███ █ █ ▀▄█▀ █ ███ █  █ ███ █         │
│    █▄▄▄▄▄█ ██▄▄▄█ █▄▄▄▄▄█  █▄▄▄▄▄█         │
│                                             │
├${border}┤
│  Bank:      ${BANK_INFO.bankId.padEnd(31)} │
│  Account:   ${BANK_INFO.accountNo.padEnd(31)} │
│  Name:      ${BANK_INFO.accountName.padEnd(31)} │
│  Amount:    ${amount.toLocaleString('vi-VN').padEnd(27)} VND │
│  Message:   ${message.padEnd(31)} │
└${border}┘`;
}
async function createPendingLicense(kit, userHash, email) {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/create-pending-license`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                userHash,
                kit: kit.id,
                email,
                amount: KIT_PRICES[kit.id] ?? 500_000,
            }),
        });
        return res.ok;
    }
    catch {
        return false;
    }
}
async function checkPaymentStatus(userHash, kitId) {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/check-payment-status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ userHash, kit: kitId }),
        });
        if (!res.ok) {
            return { paid: false };
        }
        return await res.json();
    }
    catch {
        return { paid: false };
    }
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function runPurchaseFlow(kit) {
    const price = KIT_PRICES[kit.id] ?? 500_000;
    const userHash = generateUserHash();
    const message = getTransferMessage(kit.id, userHash);
    log.info('');
    log.info(`${kit.label} Kit License Required`);
    log.info('');
    // Create pending license record
    await createPendingLicense(kit, userHash);
    // Display QR
    console.log(generateVietQRAscii(price, message));
    log.info('');
    log.info('Scan with your banking app to pay.');
    log.info('License activates automatically after payment.');
    log.info('');
    log.hint('Press Ctrl+C to cancel');
    log.info('');
    // Poll for payment
    const startTime = Date.now();
    const timeout = 10 * 60 * 1000; // 10 minutes
    while (Date.now() - startTime < timeout) {
        process.stdout.write('\r  Checking payment status...');
        const status = await checkPaymentStatus(userHash, kit.id);
        if (status.paid && status.licenseKey) {
            process.stdout.write('\r');
            log.success('Payment received! License activated.');
            return status.licenseKey;
        }
        await sleep(10_000); // Check every 10 seconds
    }
    process.stdout.write('\r');
    log.warn('Payment timeout. Run ccsk init again after paying.');
    return null;
}
//# sourceMappingURL=vietqr.js.map