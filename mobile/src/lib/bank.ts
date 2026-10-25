import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { webUrl } from './config';
import type { Transfer } from './types';

/**
 * Paying by bank transfer from the same phone.
 *
 * No banking app can scan a QR code shown on its own screen, so the payment
 * screens offer what a phone can do instead:
 *  1. open the parent's banking app with the transfer filled in — NAPAS's
 *     VietQR deeplinks (https://www.vietqr.io/danh-sach-api/deeplink-app-ngan-hang):
 *     https://dl.vietqr.io/pay?app=<app>&ba=<account>@<bank>&am=<amount>&tn=<memo>&url=<return>
 *  2. share the QR picture — to the photo library, or to Zalo for the other parent;
 *  3. copy each detail.
 */

export interface BankApp {
  appId: string;
  appName: string;
  bankName: string;
  appLogo: string;
  deeplink: string;
  /** VietQR's flag for apps that fill the form from the link. */
  autofill: number;
  monthlyInstall?: number;
}

/** The VietQR code of the receiving bank, from however SePay named it. */
const KNOWN_BANKS: Record<string, string> = {
  vietinbank: 'icb', icb: 'icb', ctg: 'icb', vietcombank: 'vcb', vcb: 'vcb', mbbank: 'mb', mb: 'mb',
  techcombank: 'tcb', tcb: 'tcb', bidv: 'bidv', acb: 'acb', vpbank: 'vpb', vpb: 'vpb', tpbank: 'tpb',
  tpb: 'tpb', sacombank: 'stb', stb: 'stb', agribank: 'vba', vba: 'vba', ocb: 'ocb', msb: 'msb',
  vib: 'vib', shb: 'shb', hdbank: 'hdb', hdb: 'hdb',
};
const squash = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const DAY = 24 * 3600_000;

async function cached<T>(key: string, load: () => Promise<T>): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw) {
      const saved = JSON.parse(raw) as { at: number; data: T };
      if (Date.now() - saved.at < DAY) return saved.data;
    }
  } catch { /* fetch it fresh */ }
  try {
    const data = await load();
    await AsyncStorage.setItem(key, JSON.stringify({ at: Date.now(), data })).catch(() => {});
    return data;
  } catch {
    return null;
  }
}

/** Banking apps that accept VietQR deeplinks on this platform, autofilling ones first. */
export async function bankApps(): Promise<BankApp[]> {
  const list = Platform.OS === 'ios' ? 'ios-app-deeplinks' : 'android-app-deeplinks';
  const apps = await cached(`sprouty.vietqr.${list}`, async () => {
    const res = await fetch(`https://api.vietqr.io/v2/${list}`);
    return ((await res.json()).apps || []) as BankApp[];
  });
  return (apps || []).slice().sort((a, b) => (b.autofill - a.autofill) || ((b.monthlyInstall || 0) - (a.monthlyInstall || 0)));
}

async function receivingBankCode(bankCode?: string): Promise<string | null> {
  const wanted = squash(bankCode);
  if (!wanted) return null;
  const banks = await cached('sprouty.vietqr.banks', async () => {
    const res = await fetch('https://api.vietqr.io/v2/banks');
    return ((await res.json()).data || []).map((b: any) => ({ code: b.code, names: [b.code, b.shortName, b.short_name, b.name].map(squash) }));
  });
  const hit = banks?.find((b: { names: string[] }) => b.names.includes(wanted));
  return hit ? String(hit.code).toLowerCase() : KNOWN_BANKS[wanted] || null;
}

/** Opens the chosen banking app on a transfer with every field filled. */
export async function openBankApp(app: BankApp, transfer: Transfer, returnPath: string) {
  const bank = await receivingBankCode(transfer.bankCode);
  const params: string[] = [];
  if (bank && transfer.accountNumber) {
    params.push(`ba=${encodeURIComponent(`${transfer.accountNumber}@${bank}`)}`, `am=${transfer.amount}`);
    if (transfer.memo) params.push(`tn=${encodeURIComponent(transfer.memo)}`);
    if (transfer.accountName) params.push(`bn=${encodeURIComponent(transfer.accountName)}`);
    params.push(`url=${encodeURIComponent(webUrl(returnPath))}`);
  }
  const url = params.length ? `${app.deeplink}${app.deeplink.includes('?') ? '&' : '?'}${params.join('&')}` : app.deeplink;
  await Linking.openURL(url);
}

/** Saves the QR picture and offers it to the share sheet (Photos, Zalo, Messenger…). */
export async function shareQrImage(transfer: Transfer) {
  const name = `sprouty-qr-${(transfer.memo || String(Date.now())).replace(/[^a-z0-9]/gi, '')}.png`;
  const target = new File(Paths.cache, name);
  if (target.exists) target.delete();
  const file = await File.downloadFileAsync(transfer.qrUrl, target);
  await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: 'Mã QR chuyển khoản Sprouty' });
}
