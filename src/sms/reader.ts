import { Platform, PermissionsAndroid } from 'react-native';
import { RawSms } from './types';

/**
 * Request SMS read permission on Android.
 * Returns true if permission is granted.
 */
export async function requestSmsPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return false;

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_SMS,
      {
        title: 'SMS Permission',
        message: 'This app needs access to your SMS to read bank transaction messages.',
        buttonPositive: 'Allow',
        buttonNegative: 'Deny',
      }
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch (e) {
    console.error('SMS permission error:', e);
    return false;
  }
}

/**
 * Read SMS messages from the inbox using the custom native module.
 * Falls back to empty array if the native module isn't available
 * (e.g., running in Expo Go or on web).
 */
export async function readSmsInbox(afterTimestamp: number = 0): Promise<RawSms[]> {
  try {
    const { getMessages } = require('../../modules/sms-reader');
    const hasPermission = await requestSmsPermission();
    if (!hasPermission) {
      console.warn('SMS permission denied');
      return [];
    }
    const messages = await getMessages(afterTimestamp);
    return messages.map((m: any) => ({
      id: String(m.id),
      address: m.address ?? '',
      body: m.body ?? '',
      date: m.date,
      read: m.read,
    }));
  } catch (e) {
    console.warn('SMS reader native module not available:', e);
    return [];
  }
}

/**
 * Mock SMS data for development/testing purposes.
 * All names, phone numbers, account numbers, references, and links below are
 * fictional placeholders — they only mirror the real SMS *format* so the
 * parsers can be exercised. Do not put real personal/financial data here.
 * Remove or disable in production.
 */
export function getMockSmsData(): RawSms[] {
  return [
    {
      id: 'mock-1',
      address: 'CBE',
      body: `Dear Mr your Account 1*****0000 has been Credited with ETB 970.00 from Abebe Kebede, on 09/03/2026 at 07:31:20 with Ref No FT00000AAAAA Your Current Balance is ETB 1,119.19. Thank you for Banking with CBE! https://apps.cbe.com.et:100/?id=FT00000AAAAA00000000`,
      date: Date.now() - 3600000,
      read: 1,
    },
    {
      id: 'mock-2',
      address: 'CBE',
      body: `Dear Sample User, You have transfered ETB 8,000.00 to Chaltu Bekele on 09/03/2026 at 11:27:53 from your account 1*****1111. Your account has been debited with a S.charge of ETB 2.00 and  15% and VAT(15%) of ETB0.30 and Disaster Fund (5%) of ETB0.10, with a total of ETB 8002.40. Your Current Balance is ETB 1,618.44. Thank you for Banking with CBE! https://apps.cbe.com.et:100/?id=FT00000BBBBB00001111`,
      date: Date.now() - 7200000,
      read: 1,
    },
    {
      id: 'mock-3',
      address: 'CBE',
      body: `Dear Sample User your Account 1*****1111 has been debited with ETB1,500.00. Service charge of  ETB 10.00 and VAT(15%) of ETB1.50 and Disaster Fund (5%) of ETB0.50 with a total of ETB 1512.00. Your Current Balance is ETB 106.44. Thank you for Banking with CBE! https://apps.cbe.com.et:100/?id=FT00000CCCCC00001111`,
      date: Date.now() - 10800000,
      read: 1,
    },
    {
      id: 'mock-4',
      address: 'telebirr',
      body: `Dear Sample User\nYou have transferred ETB 13,000.00 successfully from your telebirr account 251900000000 to Commercial Bank of Ethiopia account number 1000000000000 on 08/03/2026 12:03:08. Your telebirr transaction number is DC00000001 and your bank transaction number is FT00000DDDDD. The service fee is  ETB 13.04 and  15% VAT on the service fee is ETB 1.96. Your current balance is ETB 3,590.75. To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/DC00000001\nThank you for using telebirr\nEthio telecom`,
      date: Date.now() - 86400000,
      read: 1,
    },
    {
      id: 'mock-5',
      address: 'telebirr',
      body: `Dear Sample User \nYou have transferred ETB 1,500.00 to Tigist Alemu (2519****0000) on 08/03/2026 13:29:43. Your transaction number is DC00000002. The service fee is  ETB 3.48 and  15% VAT on the service fee is ETB 0.52. Your current E-Money Account  balance is ETB 5,769.75. To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/DC00000002.\n\nThank you for using telebirr\nEthio telecom`,
      date: Date.now() - 90000000,
      read: 1,
    },
    {
      id: 'mock-6',
      address: 'telebirr',
      body: `Dear Sample User,\nYou have received  ETB 1,000.00 by transaction number DC00000003 on 2026-03-09 10:48:00 from Commercial Bank of Ethiopia to your telebirr Account 251900000000 - Sample User. Your current balance is ETB 5,738.64.\nThank you for using telebirr\nEthio telecom`,
      date: Date.now() - 43200000,
      read: 1,
    },
    // --- Newer formats (mid-2026) ---
    {
      id: 'mock-7',
      address: 'telebirr',
      body: `Dear Sample User\nYou have paid ETB 500.00 to pay bill for 800000000 on 10/03/2026 09:15:00. Your transaction number is DC00000004. Your telebirr account balance is  ETB 5,238.64. To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/DC00000004\nThank you for using telebirr\nEthio telecom`,
      date: Date.now() - 21600000,
      read: 1,
    },
    {
      id: 'mock-8',
      address: 'telebirr',
      body: `Dear Sample User\nThe request to withdraw ETB 200.00 from your telebirr account 251900000000  via secret code 000000 on  2026-03-10 11:30:00 using Sample Bank ATM with transaction number  DC00000005 is successfully completed. The service fee (including 15% VAT) is ETB 1.15. Your current Account balance is ETB 5,037.49.To download your payment information please click this link: https://transactioninfo.ethiotelecom.et/receipt/DC00000005`,
      date: Date.now() - 14400000,
      read: 1,
    },
    {
      id: 'mock-9',
      address: 'CBE',
      body: `Dear Sample User You have received ETB 500.00 from account 1********2222 (Kebede Alemu) to your account 1********1111. Your current balance is ETB2,118.44. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-MOCK0AAAA001`,
      date: Date.now() - 3000000,
      read: 1,
    },
    {
      id: 'mock-10',
      address: 'CBE',
      body: `Dear  Sample User You have successfully transferred ETB 1,000.61 from account 1********1111 to account 1********3333 (Tariku Lemma). Service charge of ETB 0.50 and VAT(15%) of ETB0.08 and Disaster Recovery(5%) of 0.03 with total of ETB1000.61 .Your current balance is ETB1,117.83. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-MOCK0BBBB002`,
      date: Date.now() - 2400000,
      read: 1,
    },
    {
      id: 'mock-11',
      address: 'CBE',
      body: `Dear Sample User A debit transaction of ETB 1000.0. has occurred on your account 1********1111. Service charge of ETB 10.00 and VAT(15%) of ETB1.50 and Disaster Recovery(5%) of 0.50 with total of ETB1012.00 .Your current balance is ETB105.83. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-MOCK0CCCC003`,
      date: Date.now() - 1200000,
      read: 1,
    },
    // Own-account transfer — one SMS per leg; debit belongs to the "from" account,
    // credit to the "to your account" one
    {
      id: 'mock-12',
      address: 'CBE',
      body: `Dear Sample User You have successfully transferred ETB50.00 from account 1********1111 to your account 1********4444. Service charge of ETB 0.00 and VAT(15%) of 0.0 and Disaster Recovery(5%) of 0.00 with total of ETB50.00 .Your current balance is ETB55.83. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-MOCK0DDDD004`,
      date: Date.now() - 900000,
      read: 1,
    },
    {
      id: 'mock-13',
      address: 'CBE',
      body: `Dear Sample User You have received  ETB 50.00 from your account 1********1111 to your account 1********4444. Your current balance is ETB50.00. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-MOCK0EEEE005`,
      date: Date.now() - 890000,
      read: 1,
    },
    // Own-account transfer labeled with the HOLDER'S NAME instead of "your account"
    // — detected by matching the counterparty against the greeting name
    {
      id: 'mock-14',
      address: 'CBE',
      body: `Dear  Sample User Tester You have successfully transferred ETB25.00 from account 1********1111 to account 1********4444 (SAMPLE USER TESTER). Service charge of ETB 0.00 and VAT(15%) of 0.0 and Disaster Recovery(5%) of 0.00 with total of ETB25.00 .Your current balance is ETB30.83. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-MOCK0FFFF006`,
      date: Date.now() - 880000,
      read: 1,
    },
    {
      id: 'mock-15',
      address: 'CBE',
      body: `Dear Sample User Tester You have received ETB 25.00 from account 1********1111 (Sample User Tester) to your account 1********4444. Your current balance is ETB75.00. Thanks for Banking with CBE. https://mbreciept.cbe.com.et/v2-MOCK0GGGG007`,
      date: Date.now() - 870000,
      read: 1,
    },
    // --- BOA ---
    {
      id: 'mock-16',
      address: 'BOA',
      body: `Dear Sample User, your account 1*****11 was credited with ETB 1,000.00 by Kebede Alemu. Available Balance: ETB 1,000.00. Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT00000MOCK0010`,
      date: Date.now() - 860000,
      read: 1,
    },
    {
      id: 'mock-17',
      address: 'BOA',
      body: `Dear Sample User, your account 1*****11 was debited with ETB 250.00. Available Balance: ETB 750.00. Receipt: https://cs.bankofabyssinia.com/slip/?trx=FT00000MOCK0011`,
      date: Date.now() - 850000,
      read: 1,
    },
    // --- Awash (real formats, sanitized) ---
    {
      id: 'mock-18',
      address: 'Awash Bank',
      body: `Dear Customer, ETB 500 has been credited to your account from CHALTU BEKELE  on : 2026-03-10 12:00:00 with Txn ID: 000000000000001 . Your available balance is now ETB 500.00. Receipt Link: https://awashpay.awashbank.com:8225/-MOCK0AWASH-0001. Contact center 8980.`,
      date: Date.now() - 840000,
      read: 1,
    },
    {
      id: 'mock-19',
      address: 'Awash Bank',
      body: `Dear Customer; Telebirr Transfer of 100.00 ETB to Sample User - 251900000000 from 01320000004444/BANK,  Reason- Move, Charge 2.00 VAT: 0.30 . Your Balance is ETB 397.70 . Receipt Link: https://awashpay.awashbank.com:8225/-MOCK0AWASH-0002. Contact Center 8980.`,
      date: Date.now() - 830000,
      read: 1,
    },
  ];
}
