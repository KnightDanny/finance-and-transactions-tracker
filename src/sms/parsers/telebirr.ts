import { BankParser, ParsedTransaction, RawSms } from '../types';
import { extractAllEtbAmounts, extractBalance, extractAmountAfterKeyword } from '@/src/utils/amount';
import { extractDateFromText } from '@/src/utils/date';

export class TeleBirrParser implements BankParser {
  bankName = 'TELEBIRR' as const;

  canParse(smsBody: string, senderAddress: string): boolean {
    const lowerAddr = senderAddress.toLowerCase();
    const lowerBody = smsBody.toLowerCase();
    return lowerAddr.includes('telebirr') || lowerBody.includes('telebirr');
  }

  parse(sms: RawSms): ParsedTransaction | null {
    const body = sms.body;
    const lowerBody = body.toLowerCase();

    // Determine transaction type
    let type: 'credit' | 'debit';
    if (lowerBody.includes('received') || lowerBody.includes('credited')) {
      type = 'credit';
    } else if (lowerBody.includes('transferred') || lowerBody.includes('transfered') || lowerBody.includes('debited')) {
      type = 'debit';
    } else {
      return null;
    }

    // Extract balance
    const balanceAfter = extractBalance(body);
    if (balanceAfter === null) return null;

    // Extract amounts
    const allAmounts = extractAllEtbAmounts(body);
    if (allAmounts.length === 0) return null;

    const amount = allAmounts[0];

    // Extract service fee and VAT
    const serviceCharge = extractAmountAfterKeyword(body, 'service fee');
    const vat = extractAmountAfterKeyword(body, 'vat on the service fee');

    // Calculate total amount for debits
    let totalAmount: number | undefined;
    if (type === 'debit') {
      totalAmount = amount + (serviceCharge ?? 0) + (vat ?? 0);
    }

    // Extract account number (TeleBirr uses 251XXXXXXXXX format)
    let accountNumber = 'unknown';
    const fullAccountMatch = body.match(/(?:telebirr\s+account|your\s+telebirr\s+Account)\s+(251\d{9,})/i);
    if (fullAccountMatch) {
      accountNumber = fullAccountMatch[1];
    } else {
      // Try any 251 number
      const anyMatch = body.match(/251\d{9}/);
      if (anyMatch) accountNumber = anyMatch[0];
    }

    // Extract counterparty
    let counterparty: string | undefined;
    if (type === 'credit') {
      // "from Commercial Bank of Ethiopia to your telebirr"
      const fromMatch = body.match(/from\s+(.+?)\s+to\s+your/i);
      if (fromMatch) counterparty = fromMatch[1].trim();
    } else {
      // "to Tigist Alemu (2519****0000)" or "to Commercial Bank of Ethiopia account"
      const toMatch = body.match(/(?:transferred|transfered)\s+ETB\s?[\d,]+\.\d{2}\s+(?:successfully\s+)?(?:from\s+.+?\s+)?to\s+(.+?)(?:\s+on\s+\d|\s+account\s+number)/i);
      if (toMatch) {
        counterparty = toMatch[1].trim();
      } else {
        // Simpler pattern: "to Name (phone)" or "to Name on"
        const simpleToMatch = body.match(/to\s+([^(]+?)(?:\s*\(|\s+on\s+\d)/i);
        if (simpleToMatch) {
          counterparty = simpleToMatch[1].trim();
          // Clean up ETB amounts that might have been captured
          counterparty = counterparty.replace(/ETB\s?[\d,]+\.\d{2}/gi, '').trim();
          // Remove "successfully from your telebirr account XXXX" if present
          counterparty = counterparty.replace(/successfully\s+from\s+.*/i, '').trim();
        }
      }
    }

    // Extract reference number
    let referenceNo: string | undefined;
    const txnMatch = body.match(/(?:transaction\s+number|telebirr\s+transaction\s+number)\s+is\s+(\w+)/i);
    if (txnMatch) {
      referenceNo = txnMatch[1];
    } else {
      // Try: "by transaction number XXXX"
      const byTxnMatch = body.match(/by\s+transaction\s+number\s+(\w+)/i);
      if (byTxnMatch) referenceNo = byTxnMatch[1];
    }

    // Extract date
    const date = extractDateFromText(body);
    if (!date) return null;

    return {
      bank: 'TELEBIRR',
      type,
      amount,
      totalAmount,
      serviceCharge: serviceCharge ?? undefined,
      vat: vat ?? undefined,
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
