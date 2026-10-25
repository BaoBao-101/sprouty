/**
 * Where the app talks to. Not secrets — they end up inside the app.
 *
 * Defaults to the real Sprouty API. To try the app against the backend in
 * Docker on this computer, start Expo with the address the phone can reach:
 *
 *   EXPO_PUBLIC_API_ORIGIN=http://192.168.1.10:3000 npx expo start   (a phone on the same Wi-Fi)
 *   EXPO_PUBLIC_API_ORIGIN=http://10.0.2.2:3000 npx expo start       (the Android emulator)
 */
export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_ORIGIN || 'https://api.sprouty.id.vn').replace(/\/$/, '');
export const API_BASE = `${API_ORIGIN}/api/v1`;

/** The website, for shared links, help pages and pictures not bundled in the app. */
export const WEB_ORIGIN = (process.env.EXPO_PUBLIC_WEB_ORIGIN || 'https://sprouty.id.vn').replace(/\/$/, '');

/**
 * Google Play / App Store builds (`EXPO_PUBLIC_STORE=1`). VIP Garden is a
 * digital membership, which both stores require to be sold through their own
 * billing; those builds show VIP and sell nothing. The APK from the website
 * keeps the bank-transfer purchase.
 */
export const STORE_BUILD = process.env.EXPO_PUBLIC_STORE === '1';

export const webUrl = (path = '/') => WEB_ORIGIN + path;

/** Set once the welcome screens have been seen on this phone. */
export const ONBOARDED_KEY = 'sprouty.onboarded';
