import { BankParser, ParsedTransaction, RawSms } from '../types';
import { extractAllEtbAmounts, extractBalance, extractAmountAfterKeyword } from '@/src/utils/amount';
import { extractDateFromText } from '@/src/utils/date';

/**
 * Reduce a person name to comparison tokens. Vowels are stripped per token
 * because CBE transliterates Amharic names inconsistently — the two legs of
 * one transfer can spell the same person "Habtamu" and "Habitamu".
 */
function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/[aeiou]/g, ''))
    .filter(Boolean);
}

/**
 * Does the counterparty name refer to the SMS recipient themself?
 * Requires the first TWO tokens to match, so a short greeting ("Dear Daniel")
 * can never relabel a genuine counterparty who shares a first name.
 */
function isSelfName(counterparty: string, greetingName: string | undefined): boolean {
  if (!greetingName) return false;
  const a = nameTokens(counterparty);
  const b = nameTokens(greetingName);
  if (a.length < 2 || b.length < 2) return false;
  return a[0] === b[0] && a[1] === b[1];
}

export class CbeParser implements BankParser {
  bankName = 'CBE' as const;

  canParse(smsBody: string, senderAddress: string): boolean {
    const lowerAddr = senderAddress.toLowerCase();
    const lowerBody = smsBody.toLowerCase();
    // CBE Birr is a separate wallet with its own SMS format ("X,XXX.00Br." amounts)
    // — its sender contains "CBE" and would misroute here
    if (lowerAddr.includes('cbebirr')) return false;
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
    // "A debit/credit transaction of ETB X. has occurred" is the newer CBE phrasing
    let type: 'credit' | 'debit';
    if (
      lowerBody.includes('credited') ||
      lowerBody.includes('received') ||
      lowerBody.includes('credit transaction')
    ) {
      type = 'credit';
    } else if (
      lowerBody.includes('debited') ||
      lowerBody.includes('transferred') ||
      lowerBody.includes('transfered') ||
      lowerBody.includes('debit transaction')
    ) {
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

    // First ETB amount is the principal (may be fee-inclusive in newer formats —
    // corrected below once fees and total are known)
    const allAmountsFirst = allAmounts[0];

    // Extract charges — multiple formats:
    // Format 1: "S.charge of ETB X" or "service charge of ETB X"
    // Format 2: "Service charge ETB X" (no "of")
    // Format 3: "including Service charge ETB X"
    const serviceCharge =
      extractAmountAfterKeyword(body, 's.charge') ??
      extractAmountAfterKeyword(body, 'service charge');

    // VAT — "VAT of ETB X" or "VAT(15%) of ETB X" or "VAT(15%) ETB X"
    const vat = extractAmountAfterKeyword(body, 'vat');

    // Disaster Fund — renamed "Disaster Recovery" in newer SMS
    const disasterFund =
      extractAmountAfterKeyword(body, 'disaster fund') ??
      extractAmountAfterKeyword(body, 'disaster recovery');

    // Extract total amount for debits:
    // 1. Try "total of ETB X" from SMS
    // 2. Fallback: compute from amount + individual fees
    let totalAmount: number | undefined;
    let amount = allAmountsFirst;
    if (type === 'debit') {
      totalAmount = extractAmountAfterKeyword(body, 'total of') ?? undefined;
      if (!totalAmount) {
        totalAmount = amount + (serviceCharge ?? 0) + (vat ?? 0) + (disasterFund ?? 0);
      }
      // Newer transfer SMS quote a fee-INCLUSIVE headline ("transferred ETB 300.61
      // ... total of ETB300.61" with fees itemized). Recover the principal so
      // `amount` means the same thing across old and new formats.
      const fees = (serviceCharge ?? 0) + (vat ?? 0) + (disasterFund ?? 0);
      if (fees > 0 && Math.abs(totalAmount - amount) < 0.005) {
        amount = Math.round((totalAmount - fees) * 100) / 100;
      }
    }

    // Extract account number — various masking patterns:
    // 1*********0000, 1****1111, 1********1111
    // A body can name TWO masked accounts (sender and receiver), so selection must
    // be type-aware — own-account transfers send one SMS per leg:
    //   debit:  "transferred ... from account 1****7477 to your account 1****1807"
    //           → the DEBITED account is the one after "from [your] account"
    //   credit: "received ... from [your] account 1****7477 to your account 1****1807"
    //           → the CREDITED account is the one after "to your account"
    // Fall back to "your account <mask>", then to the first mask in the body.
    // Normalize: collapse any run of * to *** so all variants match the same account
    const fromAccountMask = body.match(/from\s+(?:your\s+)?account\s+(\d\*{2,}\d{2,})/i)?.[1];
    const toYourAccountMask = body.match(/to\s+your\s+account\s+(\d\*{2,}\d{2,})/i)?.[1];
    const yourAccountMask = body.match(/your\s+account\s+(\d\*{2,}\d{2,})/i)?.[1];
    const accountMatch =
      (type === 'debit' ? fromAccountMask : toYourAccountMask) ??
      yourAccountMask ??
      body.match(/\d\*{2,}\d{2,}/)?.[0];
    if (!accountMatch) return null; // Can't identify account
    const accountNumber = accountMatch.replace(/\*+/, '***');

    // Own-account transfer? Use the OTHER leg's account as the counterparty —
    // the generic from/to name extraction would only produce junk here.
    const fromYourAccountMask = body.match(/from\s+your\s+account\s+(\d\*{2,}\d{2,})/i)?.[1];
    let ownTransferCounterparty: string | undefined;
    if (toYourAccountMask && (type === 'debit' ? fromAccountMask : fromYourAccountMask)) {
      const other = type === 'debit' ? toYourAccountMask : fromAccountMask!;
      ownTransferCounterparty = `Own account ${other.replace(/\*+/, '***')}`;
    }

    // Own transfers aren't always phrased with "your account" — some legs name
    // the holder instead ("from account X (Daniel Habtamu) ..."). Every CBE SMS
    // greets the recipient by name, so a counterparty matching the greeting is
    // the user themself. Grab the greeting here; compared after extraction below.
    const greetingName = body.match(
      /^\s*Dear\s+(?:Mr\.?\s+|Mrs\.?\s+|Ms\.?\s+)?([A-Za-z][A-Za-z .'/-]{2,40}?)(?:\s*,|\s+You\b|\s+your\b)/i
    )?.[1];
    // The other leg's mask, for labeling name-matched own transfers
    const toAccountMask = body.match(/to\s+account\s+(\d\*{2,}\d{2,})/i)?.[1];

    // Extract counterparty
    let counterparty: string | undefined = ownTransferCounterparty;
    if (counterparty) {
      // own-account transfer — already resolved above
    } else if (type === 'credit') {
      // Newer format: "from account 1****2553 (Haylye Aragaw Alebachew) to your account"
      const fromAccountMatch = body.match(/from\s+account\s+\S+\s*\(([^)]+)\)/i);
      // "from Abebe Kebede," or "from Abebe Kebede on" or "from Mr Zufan,"
      const fromMatch = body.match(/from\s+([^,]+?)(?:\s*,|\s+on\s+\d)/i);
      if (fromAccountMatch) {
        counterparty = fromAccountMatch[1].trim();
      } else if (fromMatch) {
        counterparty = fromMatch[1].trim();
      }
    } else {
      // Newer format: "to account 1****0214 (Tariku Girum G/hiwot)."
      const toAccountMatch = body.match(/to\s+account\s+\S+\s*\(([^)]+)\)/i);
      // "to Chaltu Bekele on" — transfer to person
      const toMatch = body.match(/to\s+([^(]+?)(?:\s+on\s+\d|\s*\()/i);
      if (toAccountMatch) {
        counterparty = toAccountMatch[1].trim();
      } else if (toMatch) {
        counterparty = toMatch[1].trim();
        // Clean up: remove "ETB X,XXX.XX" if it snuck in
        counterparty = counterparty.replace(/ETB\s?[\d,]+(?:\.\d{0,2})?/gi, '').trim();
      }
    }

    // Counterparty is the user themself → own-account transfer under a name label
    if (counterparty && !ownTransferCounterparty && isSelfName(counterparty, greetingName)) {
      const otherMask = type === 'credit' ? fromAccountMask : toAccountMask;
      counterparty = otherMask ? `Own account ${otherMask.replace(/\*+/, '***')}` : 'Own account';
    }

    // Cross-bank leg carrying the other side's full number, e.g. the telebirr→CBE
    // credit "credited with ETB 4012 to 933563343 with reference FT... /SEF".
    // sync.ts matches it against the user's own accounts.
    const counterpartyAccountNo = body.match(
      /(?:credited|debited)\s+with\s+ETB\s?[\d,.]+\s+to\s+(\d{6,})/i
    )?.[1];

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
        if (urlPathMatch) {
          referenceNo = urlPathMatch[1];
        } else {
          // 4. Newer receipt URL slug: https://Mbreciept.cbe.com.et/v2-hfHCxz...
          //    (these SMS carry no Ref No — the slug is unique per transaction,
          //    so it keeps UNIQUE(reference_no, account_id) dedupe working)
          const receiptMatch = body.match(/mbreciept\.cbe\.com\.et\/([\w-]+)/i);
          if (receiptMatch) referenceNo = receiptMatch[1];
        }
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
      counterpartyAccountNo,
      referenceNo,
      date,
      rawSms: body,
      smsTimestamp: sms.date,
    };
  }
}
