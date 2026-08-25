import { BankParser, ParsedTransaction, RawSms } from '../types';
import { extractDateFromText } from '@/src/utils/date';

/**
 * Awash Bank parser — built against real corpus messages (sender "Awash Bank").
 *
 * Observed formats:
 *  1. Telebirr transfer (debit):
 *     "Dear Customer; Telebirr Transfer of 30,000.00 ETB to Daniel H... - 251933563343
 *      from 01320963124700/BANK, Reason- Move, Charge 15.00 VAT: 2.25 EDRRF 0.75 ETB.
 *      Your Balance is ETB 25,181.39 . Receipt Link: https://awashpay.awashbank.com:8225/-2KG..."
 *  2. Credit from person:
 *     "Dear Customer, ETB 55,100 has been credited to your account from DAGMAWI WOSEN
 *      on : 2026-08-05 19:33:54 with Txn ID: 260805193341353 . Your available balance is now ETB 55,199.39. ..."
 *  3. Transfer to other bank (debit):
 *     "You have transferred to other bank ETB 50,000 To 1000495221807 (NAME) In Commercial
 *      Bank of Ethiopia with charge of 180.00 VAT: 27.00 EDRRF 9.00 ETB. Your available Balance is ETB 5,361.39. ..."
 *  4. Sent (debit): "You have sent ETB 1,000 To (01301769836000) - AGENCY NAME by Transaction ID: 2607...
 *      charge- 1.00 VAT- 0.15 Date 2026-07-18 14:02:12 . Your Available Balance is 1,083.94. ..."
 *      (note: balance sometimes has NO "ETB"; "To 2519.../WALLET" variant exists)
 *  5. Credit via TeleBirr C2B: "your Account 01320xxxxx4700 has been Credited with ETB 2000.00 ...
 *      with reference DGI20Y196C. Your balance now is ETB 2085.14."
 *  6. Credit via IPS — carries NO balance line → intentionally dropped (balance-driven model).
 *
 * Amounts appear BOTH as "ETB 1,234.56" and "1,234.56 ETB"; fee numbers carry no
 * currency marker at all ("Charge 15.00 VAT: 2.25 EDRRF 0.75").
 */
export class AwashParser implements BankParser {
  bankName = 'AWASH' as const;

  canParse(smsBody: string, senderAddress: string): boolean {
    const lowerAddr = senderAddress.toLowerCase();
    const lowerBody = smsBody.toLowerCase();
    // TeleBirr transfer SMS mention "Awash Bank" in bodies — the dispatcher
    // checks TeleBirr first; the receipt domain is the reliable body signal.
    return lowerAddr.includes('awash') || lowerBody.includes('awashpay.awashbank.com');
  }

  parse(sms: RawSms): ParsedTransaction | null {
    const body = sms.body;
    const lowerBody = body.toLowerCase();

    // Skip security/PIN notices and promos early
    if (lowerBody.includes('wrong pin') || lowerBody.includes('attempt has been made')) {
      return null;
    }

    // Determine transaction type
    let type: 'credit' | 'debit';
    if (lowerBody.includes('credited')) {
      type = 'credit';
    } else if (
      lowerBody.includes('telebirr transfer of') ||
      lowerBody.includes('transferred') ||
      lowerBody.includes('transfered') ||
      lowerBody.includes('you have sent') ||
      lowerBody.includes('debited')
    ) {
      type = 'debit';
    } else {
      return null;
    }

    // Balance — variants: "Your Balance is ETB X", "available balance is now ETB X",
    // "Your Available Balance is 1,083.94" (no ETB!), "Your balance now is ETB X".
    // First match wins, which also keeps "ProCoin Balance is 0.00" (later in the
    // body) from being picked up.
    const balanceMatch = body.match(
      /balance\s+(?:is\s+now|now\s+is|is)\s+(?:ETB\s?)?([\d,]+(?:\.\d{0,2})?)/i
    );
    if (!balanceMatch) return null;
    const balanceAfter = parseFloat(balanceMatch[1].replace(/,/g, ''));
    if (isNaN(balanceAfter)) return null;

    // Principal — first amount in either order: "ETB 1,234[.56]" or "1,234.56 ETB"
    // (\s* — Awash sometimes double-spaces: "ETB  50,000")
    const prefixForm = body.match(/ETB\s*([\d,]+(?:\.\d{0,2})?)/);
    const suffixForm = body.match(/([\d,]+\.\d{2})\s+ETB\b/);
    let amountStr: string | null = null;
    if (prefixForm && suffixForm) {
      amountStr = (prefixForm.index ?? 0) <= (suffixForm.index ?? 0) ? prefixForm[1] : suffixForm[1];
    } else {
      amountStr = prefixForm?.[1] ?? suffixForm?.[1] ?? null;
    }
    if (!amountStr) return null;
    const amount = parseFloat(amountStr.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) return null;

    // Charges — bare numbers: "Charge 15.00" / "charge of 180.00" / "charge- 1.00",
    // "VAT: 2.25" / "VAT- 0.15", "EDRRF 0.75" (disaster fund)
    const serviceCharge = parseFeeNumber(body, /charge\s*(?:of|-|:)?\s*([\d,]+\.\d{1,2})/i);
    const vat = parseFeeNumber(body, /VAT\s*[:\-]?\s*([\d,]+\.\d{1,2})/i);
    const disasterFund = parseFeeNumber(body, /EDRRF\s*[:\-]?\s*([\d,]+\.\d{1,2})/i);

    let totalAmount: number | undefined;
    if (type === 'debit') {
      totalAmount = amount + (serviceCharge ?? 0) + (vat ?? 0) + (disasterFund ?? 0);
    }

    // Account — canonicalize both full numbers ("from 01320963124700/BANK") and
    // masks ("01320xxxxx4700", "01320******700") to first2 + *** + last4 so all
    // variants map to ONE account row.
    // Formats 3/4 carry no own-account number — sync.ts resolves those via the
    // existing single AWASH account.
    const rawAccount =
      body.match(/from\s+(\d{8,})\/BANK/i)?.[1] ??
      body.match(/your\s+account\s+([\dxX*]{8,})/i)?.[1];
    const accountNumber = rawAccount ? canonicalizeAwashAccount(rawAccount) : undefined;

    // Counterparty + other side's number (for own-transfer detection in sync)
    let counterparty: string | undefined;
    let counterpartyAccountNo: string | undefined;

    if (type === 'credit') {
      // "credited to your account from DAGMAWI WOSEN on :" / "by TeleBirr C2B to Awash"
      const fromMatch = body.match(/from\s+([A-Za-z][A-Za-z .'/-]+?)\s+on\s*:/i);
      const byMatch = body.match(/by\s+([A-Za-z][A-Za-z0-9 .'/-]+?)(?:\s+with\s+reference|\s+via|\s*[,.])/i);
      counterparty = fromMatch?.[1]?.trim() ?? byMatch?.[1]?.trim();
    } else if (lowerBody.includes('telebirr transfer of')) {
      // "Telebirr Transfer of X ETB to Name - 251933563343 from ..."
      const toMatch = body.match(/to\s+([A-Za-z][A-Za-z .'/-]+?)\s*-\s*(\d{9,})/i);
      counterparty = toMatch?.[1]?.trim();
      counterpartyAccountNo = toMatch?.[2];
    } else {
      // "To 1000495221807 (NAME) In Commercial Bank of Ethiopia" |
      // "To (01301769836000) - AGENCY" | "To 251933563343/WALLET"
      const toBank = body.match(/To\s+(\d{9,})\s*\(([^)]+)\)/);
      const toParen = body.match(/To\s+\((\d{9,})\)\s*-\s*([^.]+?)\s+by\s+Transaction/i);
      const toWallet = body.match(/To\s+(\d{9,})\/WALLET/i);
      if (toBank) {
        counterpartyAccountNo = toBank[1];
        counterparty = toBank[2].trim();
        const inBank = body.match(/\)\s+In\s+([A-Za-z ]+?)\s+with\s+charge/i);
        if (inBank) counterparty = `${counterparty} · ${inBank[1].trim()}`;
      } else if (toParen) {
        counterpartyAccountNo = toParen[1];
        counterparty = toParen[2].trim();
      } else if (toWallet) {
        counterpartyAccountNo = toWallet[1];
        counterparty = `Wallet ${toWallet[1]}`;
      }
    }

    // Reference — "Txn ID: 2608..." / "Transaction ID: 2607..." / "reference DGI20Y196C"
    // / receipt slug "https://awashpay.awashbank.com:8225/-2KG492QT99-5GW9EG"
    const referenceNo =
      body.match(/Txn\s+ID\s*:?\s*(\w{6,})/i)?.[1] ??
      body.match(/Transaction\s+ID\s*:?\s*(\w{6,})/i)?.[1] ??
      body.match(/with\s+reference\s+(\w{6,})/i)?.[1] ??
      body.match(/awashpay\.awashbank\.com[^\s/]*\/(-[\w-]+)/i)?.[1];

    // Date — "2026-08-05 19:33:54" when present, else SMS timestamp
    let date = extractDateFromText(body);
    if (!date && sms.date) {
      date = new Date(sms.date).toISOString().split('T')[0];
    }
    if (!date) return null;

    return {
      bank: 'AWASH',
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

function parseFeeNumber(body: string, re: RegExp): number | null {
  const m = body.match(re);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return isNaN(n) || n <= 0 ? null : n;
}

/** "01320963124700" | "01320xxxxx4700" | "01320******700" → "01***4700" */
function canonicalizeAwashAccount(raw: string): string {
  const digitsOnly = raw.replace(/[^0-9]/g, '');
  const lead = digitsOnly.slice(0, 2);
  const tail = digitsOnly.slice(-4);
  return `${lead}***${tail}`;
}
