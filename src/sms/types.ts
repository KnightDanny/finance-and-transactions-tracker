export interface RawSms {
  id: string;
  address: string;  // sender phone number or name
  body: string;     // SMS text content
  date: number;     // epoch milliseconds
  read: number;
}

export interface ParsedTransaction {
  bank: 'CBE' | 'TELEBIRR';
  type: 'credit' | 'debit';
  amount: number;           // principal amount
  totalAmount?: number;     // amount + service charges (for debits)
  serviceCharge?: number;
  vat?: number;
  disasterFund?: number;
  balanceAfter: number;
  accountNumber: string;
  counterparty?: string;
  referenceNo?: string;
  date: string;             // ISO date YYYY-MM-DD
  rawSms: string;
  smsTimestamp: number;
}

export interface BankParser {
  bankName: 'CBE' | 'TELEBIRR';
  canParse(smsBody: string, senderAddress: string): boolean;
  parse(sms: RawSms): ParsedTransaction | null;
}
