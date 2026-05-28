/**
 * VietQR purchase flow for paid kits.
 *
 * UX: create pending license (Supabase) → render two side-by-side terminal QR codes
 * for each enabled bank → exit with "we'll email you" message. License key is issued
 * manually by the operator after payment is confirmed.
 *
 * Banks + price are loaded from Supabase via payment-config so the operator can edit
 * them without redeploying the CLI.
 */
import { QRPay } from 'vietnam-qr-pay';
import { log } from '../util/log.js';
import { renderQrQuadrant } from '../util/qr-quadrant.js';
import { withShimmer } from '../util/shimmer-spinner.js';
import { getPaymentConfig } from './payment-config.js';
const SUPABASE_URL = 'https://qorrssuqkblahzzlonhz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iYy5ExmiYqVIwxCD3e5SqQ_E1VNLSKK';
function kitShort(kitId) {
    if (kitId === 'frontend')
        return 'FE';
    if (kitId === 'backend')
        return 'BE';
    if (kitId === 'mobile')
        return 'MB';
    return kitId.toUpperCase().slice(0, 2);
}
function buildTransferMemo(kitId, displayTxnId) {
    // Example: "CCSK TT KIT FE 482917"
    return `CCSK TT KIT ${kitShort(kitId)} ${displayTxnId}`;
}
function buildVietQRPayload(bank, amount, memo) {
    const qr = QRPay.initVietQR({
        bankBin: bank.bin,
        bankNumber: bank.account_number,
    });
    qr.amount = amount.toString();
    qr.additionalData.purpose = memo;
    return qr.build();
}
function buildVietQRUrl(bank, amount, memo) {
    const params = new URLSearchParams({
        accountName: bank.account_name,
        amount: amount.toString(),
        addInfo: memo,
    });
    return `https://api.vietqr.io/image/${bank.bin}-${bank.account_number}-i7ISzDh.jpg?${params.toString()}`;
}
function renderQrLines(content) {
    return renderQrQuadrant(content);
}
function padRight(line, width) {
    if (line.length >= width)
        return line;
    return line + ' '.repeat(width - line.length);
}
function renderSideBySide(blocks) {
    const widths = blocks.map((b) => b.qr.reduce((max, l) => Math.max(max, l.length), b.label.length));
    const rows = blocks.reduce((max, b) => Math.max(max, b.qr.length), 0);
    const gap = '    ';
    const lines = [];
    lines.push(blocks.map((b, i) => padRight(b.label, widths[i])).join(gap));
    for (let i = 0; i < rows; i++) {
        lines.push(blocks.map((b, idx) => padRight(b.qr[i] ?? '', widths[idx])).join(gap));
    }
    return lines.join('\n');
}
async function createPendingLicense(email, githubUsername, kit, amountVnd) {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/create-pending-license`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
                email,
                github_username: githubUsername,
                kit: kit.id,
                amount_vnd: amountVnd,
            }),
        });
        const bodyText = await res.text();
        if (!res.ok) {
            return { ok: false, reason: `HTTP ${res.status}: ${bodyText.slice(0, 200)}` };
        }
        return { ok: true, data: JSON.parse(bodyText) };
    }
    catch (err) {
        return { ok: false, reason: `Network error: ${err.message}` };
    }
}
/**
 * Run the purchase flow. Always returns null because key issuance is manual.
 * Caller should treat null as "exit cleanly, do not continue install".
 */
export async function runPurchaseFlow(kit, email, githubUsername) {
    const config = await getPaymentConfig();
    const amount = config.lifetime_price_vnd;
    if (config.banks.length === 0) {
        log.error('No banks are configured for VietQR payments. Contact support.');
        return null;
    }
    const pending = await withShimmer('Reserving your transaction…', () => createPendingLicense(email, githubUsername, kit, amount));
    if (!pending.ok) {
        log.error(`Could not reserve a transaction id. ${pending.reason}`);
        return null;
    }
    const memo = buildTransferMemo(kit.id, pending.data.display_txn_id);
    const blocks = config.banks.map((bank) => {
        const payload = buildVietQRPayload(bank, amount, memo);
        const url = buildVietQRUrl(bank, amount, memo);
        return { bank, url, qr: renderQrLines(payload) };
    });
    log.info('');
    log.info(`${kit.label} Kit — lifetime license`);
    log.info(`Amount     : ${amount.toLocaleString('vi-VN')} VND`);
    log.info(`Account    : ${config.banks[0].account_name}`);
    log.info(`Memo       : ${memo}`);
    log.info(`Txn ID     : ${pending.data.display_txn_id}   (keep this if you need to follow up)`);
    log.info('');
    log.info('Scan a QR with your phone camera, then complete the transfer in your banking app:');
    log.info('');
    console.log(renderSideBySide(blocks.map((b) => ({ label: `[${b.bank.label}]`, qr: b.qr }))));
    log.info('');
    for (const b of blocks) {
        log.info(`${b.bank.label.padEnd(12)} : ${b.url}`);
    }
    log.info('');
    log.success(`After we confirm your payment we will email the license key to ${email}.`);
    log.hint('Then run `ccsk init` again and choose "Already have a license. Enter key".');
    log.info('');
    return null;
}
/** Exported so the license menu can show the price in its label. */
export async function getLifetimePriceVnd() {
    return (await getPaymentConfig()).lifetime_price_vnd;
}
//# sourceMappingURL=vietqr.js.map