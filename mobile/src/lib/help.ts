import * as WebBrowser from 'expo-web-browser';
import { colors } from '@/theme';
import { webUrl } from './config';

/**
 * The help pages — FAQ, contact, returns, privacy — are the website's, opened
 * in an in-app browser: one copy of the wording, always current, and the
 * policies the stores link to are the very pages the app shows.
 */
export const HELP_PAGES = [
  { path: '/faq', label: 'Câu hỏi thường gặp', icon: 'info' },
  { path: '/contact', label: 'Liên hệ Sprouty', icon: 'phone' },
  { path: '/returns', label: 'Đổi trả & hoàn tiền', icon: 'return' },
  { path: '/privacy', label: 'Chính sách bảo mật', icon: 'shield' },
  { path: '/about', label: 'Về Sprouty', icon: 'leaf' },
] as const;

/** Any web address, in the in-app browser. */
export function openUrl(url: string) {
  return WebBrowser.openBrowserAsync(url, {
    toolbarColor: colors.cream,
    controlsColor: colors.green,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  }).catch(() => undefined);
}

/** A page of the website, by its path. */
export const openWeb = (path: string) => openUrl(webUrl(path));
