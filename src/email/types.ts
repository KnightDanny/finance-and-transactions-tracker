export interface RawEmail {
  id: string;          // Gmail message id
  from: string;        // From header, e.g. "Binance <donotreply@...>"
  subject: string;
  body: string;        // decoded text (plain part preferred, HTML stripped otherwise)
  internalDate: number; // epoch ms (Gmail internalDate)
}

/**
 * A transaction parsed from a provider email. Unlike SMS these live on
 * manual multi-currency accounts, so the parser names the currency and
 * (optionally) the account it belongs to.
 */
export interface ParsedEmailTransaction {
  source: string;           // parser id, e.g. 'BINANCE'
  currency: string;         // 'USDT', 'USDC', 'USD', ...
  type: 'credit' | 'debit';
  amount: number;           // in `currency`
  balanceAfter?: number;    // in `currency`, when the email states it
  counterparty?: string;
  referenceNo: string;      // provider txn id — dedupe key, required
  date: string;             // ISO YYYY-MM-DD
  rawEmail: string;
  emailTimestamp: number;
}

export interface EmailParser {
  /** Parser id, e.g. 'BINANCE'. */
  source: string;
  /** Gmail sender addresses/domains this parser owns — used to build the query. */
  senders: string[];
  canParse(email: RawEmail): boolean;
  parse(email: RawEmail): ParsedEmailTransaction | null;
}
