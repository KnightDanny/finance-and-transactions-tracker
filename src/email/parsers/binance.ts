import { EmailParser, ParsedEmailTransaction, RawEmail } from '../types';

const num = (s: string) => parseFloat(s.replace(/,/g, ''));
const isoDate = (ms: number) => new Date(ms).toISOString().split('T')[0];

/**
 * Binance transaction emails. Transaction notices come from
 * donotreply@directmail.binance.com and do-not-reply@ses.binance.com.
 * (Announcements come from smailer2.binance.com — deliberately not claimed.)
 *
 * Formats (2026):
 * - "Your deposit of 22 USDT is now available in your Binance account."
 * - "You have successfully withdrawn 50 USDT from your account.
 *    Withdrawal Address: 0x... Transaction ID: 0x..."
 * - "You made the following payment: Time: ... Amount: 120 USDC"
 * - "You received an incoming transfer ... From: User-9a285 Amount: 5 USDC"
 */
export class BinanceParser implements EmailParser {
  source = 'BINANCE';
  senders = ['directmail.binance.com', 'ses.binance.com'];

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

    const deposit = body.match(/deposit of\s+([\d,]+(?:\.\d+)?)\s+([A-Z]{2,6})/i);
    if (deposit) {
      return {
        ...base,
        type: 'credit',
        amount: num(deposit[1]),
        currency: deposit[2].toUpperCase(),
        counterparty: 'Binance deposit',
        referenceNo: `BINANCE-${email.id}`,
      };
    }

    const withdrawal = body.match(/withdrawn\s+([\d,]+(?:\.\d+)?)\s+([A-Z]{2,6})/i);
    if (withdrawal) {
      const address = body.match(/Withdrawal Address:\s*(\S+)/i)?.[1];
      const txId = body.match(/Transaction ID:\s*(\S+)/i)?.[1];
      return {
        ...base,
        type: 'debit',
        amount: num(withdrawal[1]),
        currency: withdrawal[2].toUpperCase(),
        counterparty: address ? `Withdrawal to ${address.slice(0, 10)}…${address.slice(-6)}` : 'Binance withdrawal',
        referenceNo: txId ?? `BINANCE-${email.id}`,
      };
    }

    if (/received an incoming transfer/i.test(body)) {
      const transfer = body.match(/Amount:\s*([\d,]+(?:\.\d+)?)\s+([A-Z]{2,6})/i);
      if (transfer) {
        const from = body.match(/From:\s*(\S+)/i)?.[1];
        return {
          ...base,
          type: 'credit',
          amount: num(transfer[1]),
          currency: transfer[2].toUpperCase(),
          counterparty: from ? `Binance Pay from ${from}` : 'Binance Pay',
          referenceNo: `BINANCE-${email.id}`,
        };
      }
    }

    if (/made the following payment/i.test(body)) {
      const payment = body.match(/Amount:\s*([\d,]+(?:\.\d+)?)\s+([A-Z]{2,6})/i);
      if (payment) {
        return {
          ...base,
          type: 'debit',
          amount: num(payment[1]),
          currency: payment[2].toUpperCase(),
          counterparty: 'Binance Pay',
          referenceNo: `BINANCE-${email.id}`,
        };
      }
    }

    return null;
  }
}
