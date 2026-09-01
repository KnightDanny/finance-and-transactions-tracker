import { EmailParser, ParsedEmailTransaction, RawEmail } from '../types';

const num = (s: string) => parseFloat(s.replace(/,/g, ''));
const isoDate = (ms: number) => new Date(ms).toISOString().split('T')[0];

/**
 * Morse (morsemoney.com) — USD remittance/wallet app. Senders:
 * hello@email.morsemoney.com and noreply@notify.morsemoney.com.
 *
 * The Morse balance is USD-denominated (USDG is their 1:1 USD token); even a
 * EUR receipt converts, with the credited amount given as "Digital currency
 * X USDG". So every event maps onto ONE USD account:
 * - "You received €200.00 from NAME ... Digital currency 233.845002 USDG"  → credit
 * - "You received $37.46 from BANK OF AMERICA ... Digital currency 37.46 USDG" → credit
 * - "You deposited 500.7 USDC from a wallet ... You received500.70 USD"    → credit
 *   (older template: "You receivedUSD 73.17" — currency-first)
 * - "You withdrew 38.16 USDG to a wallet ... You sent38.16 USD"            → debit
 * - "You sent 500.00 USD to Abel Teka"                                     → debit
 * Every transaction email carries deep.morse.link/transaction?id=tx_... → dedupe.
 * Login/reminder/request emails have no tx id or amounts → null.
 */
export class MorseParser implements EmailParser {
  source = 'MORSE';
  senders = ['morsemoney.com'];

  canParse(email: RawEmail): boolean {
    return this.senders.some((s) => email.from.toLowerCase().includes(s));
  }

  parse(email: RawEmail): ParsedEmailTransaction | null {
    const body = email.body;
    const txId = body.match(/morse\.link\/transaction\?id=(tx_\w+)/i)?.[1];
    if (!txId) return null; // not a transaction email

    const base = {
      source: this.source,
      currency: 'USD',
      date: isoDate(email.internalDate),
      rawEmail: body,
      emailTimestamp: email.internalDate,
      referenceNo: txId,
    };

    // "You received X USD" in either order (newer: "received500.70 USD",
    // older: "receivedUSD 73.17")
    const usdReceived =
      body.match(/You received\s*([\d,]+(?:\.\d+)?)\s*USD\b/i) ??
      body.match(/You received\s*USD\s*([\d,]+(?:\.\d+)?)/i);
    const usdSent =
      body.match(/You sent\s*([\d,]+(?:\.\d+)?)\s*USD\b/i) ??
      body.match(/You sent\s*USD\s*([\d,]+(?:\.\d+)?)/i);
    const usdg = body.match(/Digital currency\s*([\d,]+(?:\.\d+)?)\s*USDG/i);

    if (/You deposited/i.test(body)) {
      // Case-sensitive: the template concatenates "FromSolana - ..." — a
      // case-insensitive match would latch onto "from a wallet" instead
      const from = body.match(/From([A-Z].*?)You sent/)?.[1]?.trim();
      const amount = usdReceived ?? usdg;
      if (!amount) return null;
      return {
        ...base,
        type: 'credit',
        amount: num(amount[1]),
        counterparty: from ? `Deposit from ${from}` : 'Morse deposit',
      };
    }

    if (/You withdrew/i.test(body)) {
      const to = body.match(/To([A-Z].*?)Sent on/)?.[1]?.trim();
      const amount = usdSent ?? body.match(/You withdrew\s*([\d,]+(?:\.\d+)?)\s*USDG/i);
      if (!amount) return null;
      return {
        ...base,
        type: 'debit',
        amount: num(amount[1]),
        counterparty: to ? `Withdrawal to ${to}` : 'Morse withdrawal',
      };
    }

    const sentTo = body.match(/You sent\s*([\d,]+(?:\.\d+)?)\s*USD\s*to\s+([^*(]+)/i);
    if (sentTo) {
      return {
        ...base,
        type: 'debit',
        amount: num(sentTo[1]),
        counterparty: sentTo[2].trim(),
      };
    }

    if (/You received/i.test(body)) {
      // Credited amount is the USDG (=USD) figure — a EUR receipt converts;
      // the € headline is NOT what lands on the balance
      const from = body.match(/From([A-Z].*?)Received on/)?.[1]?.trim();
      const amount = usdg ?? usdReceived ?? body.match(/You received\s*[€$£]?\s*([\d,]+(?:\.\d+)?)/i);
      if (!amount) return null;
      return {
        ...base,
        type: 'credit',
        amount: num(amount[1]),
        counterparty: from ?? 'Morse transfer',
      };
    }

    return null;
  }
}
