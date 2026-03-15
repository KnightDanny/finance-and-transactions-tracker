import { BankParser, ParsedTransaction, RawSms } from '../types';
import { extractAllEtbAmounts, extractBalance, extractAmountAfterKeyword } from '@/src/utils/amount';
import { extractDateFromText } from '@/src/utils/date';

export class CbeParser implements BankParser {
  bankName = 'CBE' as const;

  canParse(smsBody: string, senderAddress: string): boolean {
    const lowerAddr = senderAddress.toLowerCase();
    const lowerBody = smsBody.toLowerCase();
    return (
      lowerAddr.includes('cbe') ||
      lowerBody.includes('banking with cbe') ||
      lowerBody.includes('commercial bank of ethiopia')
    );
  }

  parse(sms: RawSms): ParsedTransaction | null {
    const body = sms.body;
    const lowerBody = body.toLowerCase();

    // Determine transaction type
    let type: 'credit' | 'debit';
    if (lowerBody.includes('credited') || lowerBody.includes('received')) {
      type = 'credit';
    } else if (lowerBody.includes('debited') || lowerBody.includes('transferred') || lowerBody.includes('transfered')) {
      type = 'debit';
    } else {
      return null; // Can't determine type
    }

    // Extract balance
    const balanceAfter = extractBalance(body);
    if (balanceAfter === null) return null;

    // Extract amounts
    const allAmounts = extractAllEtbAmounts(body);
    if (allAmounts.length === 0) return null;

    // First ETB amount is the principal
    const amount = allAmounts[0];

    // Extract total amount for debits ("total of ETB X")
    let totalAmount: number | undefined;
    if (type === 'debit') {
      totalAmount = extractAmountAfterKeyword(body, 'total of') ?? undefined;
    }

    // Extract charges
    const serviceCharge =
      extractAmountAfterKeyword(body, 's.charge') ??
      extractAmountAfterKeyword(body, 'service charge');
    const vat = extractAmountAfterKeyword(body, 'vat');
    const disasterFund = extractAmountAfterKeyword(body, 'disaster fund');

    // Extract account number (masked format: 1*****0000)
    const accountMatch = body.match(/\d\*{3,}\d{2,}/);
    const accountNumber = accountMatch ? accountMatch[0] : 'unknown';

    // Extract counterparty
    let counterparty: string | undefined;
    if (type === 'credit') {
      // "from Abebe Kebede," or "from Abebe Kebede on"
      const fromMatch = body.match(/from\s+([^,]+?)(?:\s*,|\s+on\s+\d)/i);
      if (fromMatch) counterparty = fromMatch[1].trim();
    } else {
      // "to Chaltu Bekele on" or "transfered ETB ... to Name on"
      const toMatch = body.match(/to\s+([^(]+?)(?:\s+on\s+\d|\s*\()/i);
      if (toMatch) {
        counterparty = toMatch[1].trim();
        // Clean up: remove "ETB X,XXX.XX" if it snuck in
        counterparty = counterparty.replace(/ETB\s?[\d,]+\.\d{2}/i, '').trim();
      }
    }

    // Extract reference number
    let referenceNo: string | undefined;
    const refMatch = body.match(/Ref\s+No\s+(\w+)/i);
    if (refMatch) {
      referenceNo = refMatch[1];
    } else {
      // Try to extract from URL
      const urlMatch = body.match(/id=(\w+)/);
      if (urlMatch) referenceNo = urlMatch[1];
    }

    // Extract date
    const date = extractDateFromText(body);
    if (!date) return null;

    return {
      bank: 'CBE',
      type,
      amount,
      totalAmount,
      serviceCharge: serviceCharge ?? undefined,
      vat: vat ?? undefined,
      disasterFund: disasterFund ?? undefined,
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
