import { BankParser, ParsedTransaction, RawSms } from '../types';
import { extractAllEtbAmounts, extractBalance, extractAmountAfterKeyword } from '@/src/utils/amount';
import { extractDateFromText } from '@/src/utils/date';

export class CbeParser implements BankParser {
  bankName = 'CBE' as const;

  canParse(smsBody: string, senderAddress: string): boolean {
    const lowerAddr = senderAddress.toLowerCase();
    const lowerBody = smsBody.toLowerCase();
    // Don't match on "commercial bank of ethiopia" — TeleBirr SMS mentions it in transfers
    return (
      lowerAddr.includes('cbe') ||
      lowerBody.includes('banking with cbe')
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

    // Extract charges — multiple formats:
    // Format 1: "S.charge of ETB X" or "service charge of ETB X"
    // Format 2: "Service charge ETB X" (no "of")
    // Format 3: "including Service charge ETB X"
    const serviceCharge =
      extractAmountAfterKeyword(body, 's.charge') ??
      extractAmountAfterKeyword(body, 'service charge');

    // VAT — "VAT of ETB X" or "VAT(15%) of ETB X" or "VAT(15%) ETB X"
    const vat = extractAmountAfterKeyword(body, 'vat');

    // Disaster Fund
    const disasterFund = extractAmountAfterKeyword(body, 'disaster fund');

    // Extract total amount for debits:
    // 1. Try "total of ETB X" from SMS
    // 2. Fallback: compute from amount + individual fees
    let totalAmount: number | undefined;
    if (type === 'debit') {
      totalAmount = extractAmountAfterKeyword(body, 'total of') ?? undefined;
      if (!totalAmount) {
        totalAmount = amount + (serviceCharge ?? 0) + (vat ?? 0) + (disasterFund ?? 0);
      }
    }

    // Extract account number — various masking patterns:
    // 1*********0000, 1****1111, 1********1111
    // Normalize: collapse any run of * to *** so all variants match the same account
    const accountMatch = body.match(/\d\*{2,}\d{2,}/);
    if (!accountMatch) return null; // Can't identify account
    const accountNumber = accountMatch[0].replace(/\*+/, '***');

    // Extract counterparty
    let counterparty: string | undefined;
    if (type === 'credit') {
      // "from Abebe Kebede," or "from Abebe Kebede on" or "from Mr Zufan,"
      const fromMatch = body.match(/from\s+([^,]+?)(?:\s*,|\s+on\s+\d)/i);
      if (fromMatch) counterparty = fromMatch[1].trim();
    } else {
      // "to Chaltu Bekele on" — transfer to person
      const toMatch = body.match(/to\s+([^(]+?)(?:\s+on\s+\d|\s*\()/i);
      if (toMatch) {
        counterparty = toMatch[1].trim();
        // Clean up: remove "ETB X,XXX.XX" if it snuck in
        counterparty = counterparty.replace(/ETB\s?[\d,]+(?:\.\d{0,2})?/gi, '').trim();
      }
    }

    // Extract reference number — multiple sources:
    let referenceNo: string | undefined;
    // 1. "Ref No FTXXXXX"
    const refMatch = body.match(/Ref\s+No\s+(\w+)/i);
    if (refMatch) {
      referenceNo = refMatch[1];
    } else {
      // 2. URL with ?id=XXXXX
      const urlIdMatch = body.match(/[?&]id=(\w+)/);
      if (urlIdMatch) {
        referenceNo = urlIdMatch[1];
      } else {
        // 3. URL path: BranchReceipt/FT00000TZT77&...
        const urlPathMatch = body.match(/\/(FT\w+)/);
        if (urlPathMatch) referenceNo = urlPathMatch[1];
      }
    }

    // Extract date — fall back to SMS timestamp if no date in body
    let date = extractDateFromText(body);
    if (!date && sms.date) {
      date = new Date(sms.date).toISOString().split('T')[0];
    }
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
