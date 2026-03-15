import { requireNativeModule } from 'expo-modules-core';

interface NativeSmsMessage {
  id: string;
  address: string;
  body: string;
  date: number;
  read: number;
}

const SmsReader = requireNativeModule('SmsReader');

/**
 * Read SMS messages from the device inbox.
 * @param afterTimestamp - Only return messages with date > this value (epoch ms). Pass 0 for all.
 * @returns Array of SMS messages sorted by date ascending.
 */
export async function getMessages(afterTimestamp: number = 0): Promise<NativeSmsMessage[]> {
  return SmsReader.getMessages(afterTimestamp);
}
