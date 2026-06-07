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
  ];
}
