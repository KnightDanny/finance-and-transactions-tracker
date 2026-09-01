import { EmailParser, ParsedEmailTransaction, RawEmail } from './types';
import { BinanceParser } from './parsers/binance';
import { BybitParser } from './parsers/bybit';
import { MorseParser } from './parsers/morse';
import { OkxParser } from './parsers/okx';

/**
 * Registered provider parsers. To add one:
 * 1. Create src/email/parsers/<provider>.ts implementing EmailParser
 *    (keyword matching, not exact formats — like the SMS parsers)
 * 2. Register it here. Its `senders` feed the Gmail query automatically.
 */
const parsers: EmailParser[] = [new BinanceParser(), new BybitParser(), new MorseParser(), new OkxParser()];

/** Every sender address/domain any parser claims — drives the Gmail query. */
export function allSenders(): string[] {
  return parsers.flatMap((p) => p.senders);
}

export function parseEmail(email: RawEmail): ParsedEmailTransaction | null {
  for (const parser of parsers) {
    if (parser.canParse(email)) {
      try {
        const parsed = parser.parse(email);
        if (parsed) return parsed;
      } catch (e) {
        console.warn(`Email parser ${parser.source} failed:`, e);
      }
    }
  }
  return null;
}
