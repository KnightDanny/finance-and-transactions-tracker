import { BankParser, ParsedTransaction, RawSms } from '../types';
import { extractDateFromText } from '@/src/utils/date';

/**
 * Bank of Abyssinia parser.
 *
 * Observed formats (real corpus):
 *   Debit:  "Dear Daniel, your account 1*****09 was debited with ETB 5,012.00.
 *            Available Balance: ETB 110.24. Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT26083XJRMH26009"
 *   Debit (fee): "... was debited with ETB 3.01 for the Mobile Banking Monthly
 *            Maintenance Fee, including 15% VAT and 5% Disaster Fund. Available balance: ETB 123.28."
 *   Credit: "... was credited with ETB 5,011.05 by Getachew Ambachew Fenta.
 *            Available Balance: ETB 110.24. Receipt: ..."
 *
 * Notes: no date in the body (SMS timestamp is used); debits carry no
 * counterparty except fee notices ("for the ..."); reference comes from the
 * receipt URL's trx parameter.
 */
export class BoaParser implements BankParser {
  bankName = 'BOA' as const;

  canParse(smsBody: string, senderAddress: string): boolean {
    const lowerAddr = senderAddress.toLowerCase();
    const lowerBody = smsBody.toLowerCase();
    // Sender is simply "BOA"; the receipt domain is a reliable body signal.
    // Do NOT match plain "bank of abyssinia" in the body — TeleBirr ATM
    // cash-out SMS mention it (the dispatcher's TeleBirr-first order also
    // protects, but don't rely on ordering alone).
    return (
      lowerAddr === 'boa' ||
      lowerAddr.includes('abyssinia') ||
      lowerBody.includes('bankofabyssinia.com')
    );
  }

  parse(sms: RawSms): ParsedTransaction | null {
    const body = sms.body;
    const lowerBody = body.toLowerCase();

    // Determine transaction type
    let type: 'credit' | 'debit';
    if (lowerBody.includes('credited')) {
      type = 'credit';
    } else if (lowerBody.includes('debited')) {
      type = 'debit';
    } else {
      return null; // OTP, PIN, KYC, promos — not transactions
    }

    // Balance — "Available Balance: ETB 110.24" (case of "balance" varies)
    const balanceMatch = body.match(/available\s+balance\s*:?\s*ETB\s?([\d,]+(?:\.\d{0,2})?)/i);
    if (!balanceMatch) return null;
    const balanceAfter = parseFloat(balanceMatch[1].replace(/,/g, ''));
    if (isNaN(balanceAfter)) return null;

    // Principal — "debited/credited with ETB X"
    const amountMatch = body.match(/(?:debited|credited)\s+with\s+ETB\s?([\d,]+(?:\.\d{0,2})?)/i);
    if (!amountMatch) return null;
    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return null;

    // Account — "your account 1*****09"; collapse the star run like CBE masks
    const accountMatch = body.match(/your\s+account\s+(\d[\d*]{3,})/i)?.[1]
      ?? body.match(/\d\*{2,}\d{1,}/)?.[0];
    if (!accountMatch) return null;
    const accountNumber = accountMatch.replace(/\*+/, '***');

    // Counterparty — credit: "by <Name>."; debit fee notice: "for the <what>,"
    let counterparty: string | undefined;
    if (type === 'credit') {
      const byMatch = body.match(/credited\s+with\s+ETB\s?[\d,.]+\s+by\s+([^.]+?)\.\s/i)
        ?? body.match(/\bby\s+([^.]+?)\./i);
      if (byMatch) counterparty = byMatch[1].trim();
    } else {
      const forMatch = body.match(/debited\s+with\s+ETB\s?[\d,.]+\s+for\s+(?:the\s+)?([^,.]+)/i);
      if (forMatch) counterparty = forMatch[1].trim();
    }

    // Reference — receipt URL: ...?trx=FT26083XJRMH26009
    const referenceNo = body.match(/[?&]trx=(\w+)/i)?.[1];

    // BOA bodies carry no date — fall back to the SMS timestamp
    let date = extractDateFromText(body);
    if (!date && sms.date) {
      date = new Date(sms.date).toISOString().split('T')[0];
    }
    if (!date) return null;

    return {
      bank: 'BOA',
      type,
      amount,
      totalAmount: type === 'debit' ? amount : undefined,
      balanceAfter,
      accountNumber,
      counterparty,
      referenceNo,
      date,
      rawSms: body,
      smsTimestamp: sms.date,
    };
  }
}
