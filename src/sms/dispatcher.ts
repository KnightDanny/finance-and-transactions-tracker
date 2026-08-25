import { BankParser, ParsedTransaction, RawSms } from './types';
import { CbeParser } from './parsers/cbe';
import { TeleBirrParser } from './parsers/telebirr';
import { BoaParser } from './parsers/boa';
import { AwashParser } from './parsers/awash';

// TeleBirr first — its SMS mentions other banks by name ("Commercial Bank of
// Ethiopia account number ...", "Bank of Abyssinia ATM", "Awash Bank") which
// would false-match the bank parsers below.
const parsers: BankParser[] = [new TeleBirrParser(), new CbeParser(), new BoaParser(), new AwashParser()];

/**
 * Try to parse an SMS using all registered bank parsers.
 * A parser that claims a message (canParse) but returns null does NOT end the
 * search — cross-bank mentions are common ("Telebirr Transfer of ..." inside an
 * Awash SMS, "Bank of Abyssinia ATM" inside a TeleBirr one), so later parsers
 * still get their chance.
 * Returns the parsed transaction or null if no parser can handle it.
 */
export function parseSms(sms: RawSms): ParsedTransaction | null {
  for (const parser of parsers) {
    if (parser.canParse(sms.body, sms.address)) {
      try {
        const parsed = parser.parse(sms);
        if (parsed) return parsed;
      } catch (e) {
        console.warn(`Parser ${parser.bankName} failed for SMS:`, e);
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
