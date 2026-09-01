import { EmailParser, ParsedEmailTransaction, RawEmail } from '../types';

const num = (s: string) => parseFloat(s.replace(/,/g, ''));
const isoDate = (ms: number) => new Date(ms).toISOString().split('T')[0];

/**
 * OKX (okx.com) — crypto exchange. Transactional emails come from
 * noreply@{mailer1,mailer2,service2,service3}.okx.com (subdomain varies per
 * template); updates@okx.com and notice*.okx.com are pure marketing.
 *
 * Events (matched on body keywords):
 * - "You have withdrawn 120 USDT ... to the account: someone@gmail.com" → debit
 * - "119.988 USDT has been credited to your account"                    → credit
 *   (covers both the "Deposit Received" and "You've received USDT/USDC"
 *   templates — one completed-credit email per event)
 * - "We're currently processing your deposit/transfer"  → PENDING, skip —
 *   the completed email above follows minutes later; parsing both would
 *   double-count
 * - "successfully converted 1 USDC to 0.99985004 USDT" → skip — USDC/USDT
 *   are held 1:1 in one account here, so a conversion is balance-neutral
 *
 * No transaction ids in these emails — the Gmail message id is the dedupe
 * reference (stable across re-fetches of the same message).
 */
export class OkxParser implements EmailParser {
  source = 'OKX';
  senders = [
    'mailer1.okx.com', 'mailer2.okx.com', 'mailer3.okx.com',
    'service1.okx.com', 'service2.okx.com', 'service3.okx.com',
  ];

  canParse(email: RawEmail): boolean {
    const from = email.from.toLowerCase();
    return from.includes('okx.com') && !from.includes('updates@') && !from.includes('notice');
  }

  parse(email: RawEmail): ParsedEmailTransaction | null {
    const body = email.body;

    // Pending notices and internal stablecoin conversions are not transactions
    if (/currently processing/i.test(body)) return null;
    if (/successfully converted/i.test(body)) return null;

    const base = {
      source: this.source,
      date: isoDate(email.internalDate),
      rawEmail: body,
      emailTimestamp: email.internalDate,
      referenceNo: `OKX-${email.id}`,
    };

    const withdrawn = body.match(/You have withdrawn\s+([\d,]+(?:\.\d+)?)\s+([A-Z]{2,6})/i);
    if (withdrawn) {
      const to = body.match(/to the account:\s*(\S+)/i)?.[1];
      return {
        ...base,
        currency: withdrawn[2].toUpperCase(),
        type: 'debit',
        amount: num(withdrawn[1]),
        counterparty: to ? `Withdrawal to ${to}` : 'OKX withdrawal',
      };
    }

    const credited = body.match(/([\d,]+(?:\.\d+)?)\s+([A-Z]{2,6})\s+has been credited to your account/i);
    if (credited) {
      return {
        ...base,
        currency: credited[2].toUpperCase(),
        type: 'credit',
        amount: num(credited[1]),
        counterparty: 'OKX deposit',
      };
    }

    return null;
  }
}
