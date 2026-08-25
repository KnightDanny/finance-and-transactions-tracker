export interface RawSms {
  id: string;
  address: string;  // sender phone number or name
  body: string;     // SMS text content
  date: number;     // epoch milliseconds
  read: number;
}

export type BankId = 'CBE' | 'TELEBIRR' | 'BOA' | 'AWASH';

export interface ParsedTransaction {
  bank: BankId;
  type: 'credit' | 'debit';
  amount: number;           // principal amount
  totalAmount?: number;     // amount + service charges (for debits)
  serviceCharge?: number;
  vat?: number;
  disasterFund?: number;
  balanceAfter: number;
  accountNumber?: string;
  counterparty?: string;
  /**
   * Full account/phone number of the OTHER side when the SMS carries one
   * (e.g. "to Commercial Bank of Ethiopia account number 1000495221807",
   * "credited with ETB X to 933563343"). sync.ts matches it against the
   * user's own accounts to relabel cross-bank own transfers.
   */
  counterpartyAccountNo?: string;
  referenceNo?: string;
  date: string;             // ISO date YYYY-MM-DD
  rawSms: string;
  smsTimestamp: number;
}

export interface BankParser {
  bankName: BankId;
  canParse(smsBody: string, senderAddress: string): boolean;
  parse(sms: RawSms): ParsedTransaction | null;
}
