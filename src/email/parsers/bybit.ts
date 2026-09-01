import { EmailParser, ParsedEmailTransaction, RawEmail } from '../types';

const num = (s: string) => parseFloat(s.replace(/,/g, ''));
const isoDate = (ms: number) => new Date(ms).toISOString().split('T')[0];

/**
 * Bybit transaction emails, from noreply@email-service.bybit.com.
 * (marketing@mail.bybit.com is deliberately not claimed.)
 *
 * Formats (2026):
 * - Deposit: "Your deposit has been confirmed. Deposit amount: 49.99 USDT
 *   Chain type: BSC (BEP20) Deposit address: 0x... Timestamp: ..."
 * - Withdrawal (two emails per withdrawal, SAME TXID so dedupe collapses them):
 *   "You've successfully withdrawn 6.3326 USDT from your Bybit account ... TXID: 0x..."
 *   "The status of your withdrawal has been updated to: Sent ...
 *    Withdrawal amount: 6.3326 USDT ... TXID: 0x..."
 * - Security/login/reward/card notices carry none of these patterns → null.
 */
export class BybitParser implements EmailParser {
  source = 'BYBIT';
  senders = ['email-service.bybit.com'];

  canParse(email: RawEmail): boolean {
    return this.senders.some((s) => email.from.toLowerCase().includes(s));
  }

  parse(email: RawEmail): ParsedEmailTransaction | null {
    const body = email.body;
    const base = {
      source: this.source,
      date: isoDate(email.internalDate),
      rawEmail: body,
      emailTimestamp: email.internalDate,
    };

    const deposit = body.match(/Deposit amount:\s*([\d,]+(?:\.\d+)?)\s*([A-Z]{2,6})/i);
    if (deposit) {
      return {
        ...base,
        type: 'credit',
        amount: num(deposit[1]),
        currency: deposit[2].toUpperCase(),
        counterparty: 'Bybit deposit',
        referenceNo: `BYBIT-${email.id}`,
      };
    }

    const withdrawal =
      body.match(/Withdrawal amount:\s*([\d,]+(?:\.\d+)?)\s*([A-Z]{2,6})/i) ??
      body.match(/successfully withdrawn\s+([\d,]+(?:\.\d+)?)\s*([A-Z]{2,6})/i);
    if (withdrawal) {
      const txId = body.match(/TXID:\s*(\S+)/i)?.[1];
      const address = body.match(/withdrawal address:\s*(\S+)/i)?.[1];
      return {
        ...base,
        type: 'debit',
        amount: num(withdrawal[1]),
        currency: withdrawal[2].toUpperCase(),
        counterparty: address ? `Withdrawal to ${address.slice(0, 10)}…${address.slice(-6)}` : 'Bybit withdrawal',
        // TXID keys dedupe: the "Success" and "have been sent" emails for one
        // withdrawal share it, so only one transaction lands
        referenceNo: txId ?? `BYBIT-${email.id}`,
      };
    }

    return null;
  }
}
