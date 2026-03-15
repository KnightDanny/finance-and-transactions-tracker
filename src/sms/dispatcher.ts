import { BankParser, ParsedTransaction, RawSms } from './types';
import { CbeParser } from './parsers/cbe';
import { TeleBirrParser } from './parsers/telebirr';

// TeleBirr first — its SMS mentions "Commercial Bank of Ethiopia" which would false-match CBE
const parsers: BankParser[] = [new TeleBirrParser(), new CbeParser()];

/**
 * Try to parse an SMS using all registered bank parsers.
 * Returns the parsed transaction or null if no parser can handle it.
 */
export function parseSms(sms: RawSms): ParsedTransaction | null {
  for (const parser of parsers) {
    if (parser.canParse(sms.body, sms.address)) {
      try {
        return parser.parse(sms);
      } catch (e) {
        console.warn(`Parser ${parser.bankName} failed for SMS:`, e);
        return null;
      }
    }
  }
  return null;
}

/**
 * Check if an SMS is from a known bank (useful for logging unparseable bank SMS).
 */
export function isFromKnownBank(sms: RawSms): boolean {
  return parsers.some((p) => p.canParse(sms.body, sms.address));
}
