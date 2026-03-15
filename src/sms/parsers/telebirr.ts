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

    // Skip non-transaction messages
    if (lowerBody.includes('verification code') || lowerBody.includes('insufficient balance')) {
      return null;
    }

    // Determine transaction type — order matters:
    // "paid" = debit (purchases, packages, bills)
    // "transferred" = debit (person-to-person or to bank)
    // "received" / "credited" = credit
    // "deposited" to saving = debit from e-money (skip — internal transfer)
    // "withdraw" from saving = credit to e-money (skip — internal transfer)
    // "recharged" = debit (airtime)
    let type: 'credit' | 'debit';

    // Skip savings operations (internal transfers, not real transactions)
    if (lowerBody.includes('deposited') && lowerBody.includes('saving')) {
      return null;
    }
    if (lowerBody.includes('withdraw') && lowerBody.includes('saving')) {
      return null;
    }

    if (lowerBody.includes('received') || lowerBody.includes('credited')) {
      type = 'credit';
    } else if (
      lowerBody.includes('transferred') ||
      lowerBody.includes('transfered') ||
      lowerBody.includes('debited') ||
      lowerBody.includes('you have paid') ||
      lowerBody.includes('recharged')
    ) {
      type = 'debit';
    } else {
      return null;
    }

    // Extract balance — multiple patterns:
    // "current balance is ETB X"
    // "current E-Money Account balance is ETB X"
    // "current telebirr balance is ETB X"
    // "current telebirr Account balance is ETB X"
    const balanceAfter = extractBalance(body);
    if (balanceAfter === null) return null;

    // Extract amounts
    const allAmounts = extractAllEtbAmounts(body);
    if (allAmounts.length === 0) return null;

    const amount = allAmounts[0];

    // Extract service fee and VAT (only for transfers, not purchases)
    const serviceCharge = extractAmountAfterKeyword(body, 'service fee');
    const vat = extractAmountAfterKeyword(body, 'vat on the service fee');

    // Calculate total amount for debits
    let totalAmount: number | undefined;
    if (type === 'debit') {
      totalAmount = amount + (serviceCharge ?? 0) + (vat ?? 0);
    }

    // Extract account number (TeleBirr uses 251XXXXXXXXX format)
    // Try explicit "telebirr account XXXX" or "telebirr Account XXXX"
    let accountNumber: string | undefined;
    const fullAccountMatch = body.match(/telebirr\s+Account\s+(251\d{9,})/i);
    if (fullAccountMatch) {
      accountNumber = fullAccountMatch[1];
    } else {
      // Try "your telebirr account XXXX"
      const yourMatch = body.match(/your\s+telebirr\s+account\s+(251\d{9,})/i);
      if (yourMatch) accountNumber = yourMatch[1];
    }
    // Person-to-person transfers and payments don't include sender account
    // sync.ts will look up the existing TeleBirr account

    // Extract counterparty
    let counterparty: string | undefined;
    if (type === 'credit') {
      // Format 1: "from Commercial Bank of Ethiopia to your telebirr"
      const fromBankMatch = body.match(/from\s+(.+?)\s+to\s+your/i);
      if (fromBankMatch) {
        counterparty = fromBankMatch[1].trim();
      } else {
        // Format 2: "from Dagmawi Wossen(2519****6565)" — person-to-person
        const fromPersonMatch = body.match(/from\s+([^(]+?)(?:\s*\(|\s+on\s+\d)/i);
        if (fromPersonMatch) counterparty = fromPersonMatch[1].trim();
      }
    } else {
      // Debit counterparty extraction:
      // Format 1: "transferred ETB X to Name (phone) on"
      const toPersonMatch = body.match(/to\s+([^(]+?)(?:\s*\(|\s+on\s+\d)/i);
      if (toPersonMatch) {
        counterparty = toPersonMatch[1].trim();
        // Clean up ETB amounts and "successfully from your telebirr account..."
        counterparty = counterparty.replace(/ETB\s?[\d,]+(?:\.\d{0,2})?/gi, '').trim();
        counterparty = counterparty.replace(/successfully\s+from\s+.*/i, '').trim();
      }

      // Format 2: "paid ETB X for goods purchased from XXXX - MERCHANT NAME on"
      if (!counterparty) {
        const merchantMatch = body.match(/purchased\s+from\s+\S+\s+-\s+(.+?)\s+on\s+\d/i);
        if (merchantMatch) counterparty = merchantMatch[1].trim();
      }

      // Format 3: "paid ETB X for package PACKAGE_NAME purchase made for"
      if (!counterparty) {
        const packageMatch = body.match(/for\s+package\s+(.+?)\s+purchase\s+made/i);
        if (packageMatch) counterparty = packageMatch[1].trim();
      }

      // Format 4: "transferred ETB X to BANK account number XXXX"
      if (!counterparty) {
        const toBankMatch = body.match(/to\s+(.+?)\s+account\s+number/i);
        if (toBankMatch) {
          counterparty = toBankMatch[1].trim();
          counterparty = counterparty.replace(/ETB\s?[\d,]+(?:\.\d{0,2})?/gi, '').trim();
          counterparty = counterparty.replace(/successfully\s+from\s+.*/i, '').trim();
        }
      }

      // Format 5: "recharged ETB X airtime for PHONE"
      if (!counterparty && lowerBody.includes('recharged')) {
        counterparty = 'Airtime Recharge';
      }
    }

    // Extract reference number
    let referenceNo: string | undefined;
    // "transaction number is XXXX" or "telebirr transaction number is XXXX"
    const txnMatch = body.match(/transaction\s+number\s+is\s+(\w+)/i);
    if (txnMatch) {
      referenceNo = txnMatch[1];
    } else {
      // "by transaction number XXXX"
      const byTxnMatch = body.match(/by\s+transaction\s+number\s+(\w+)/i);
      if (byTxnMatch) referenceNo = byTxnMatch[1];
    }

    // Extract date — fall back to SMS timestamp if no date in body
    let date = extractDateFromText(body);
    if (!date && sms.date) {
      date = new Date(sms.date).toISOString().split('T')[0];
    }
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
