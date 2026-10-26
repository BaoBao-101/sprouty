import Constants from 'expo-constants';

/**
 * Where the app talks to. Not secrets — they end up inside the app.
 *
 * Defaults to the real Sprouty site and API. `npm run start:local` points
 * both at this computer instead: the website from `npm run dev` (Vite, which
 * also passes /api and /uploads on to the backend in Docker), at the address
 * Expo itself is served from — so the emulator and a phone on the same
 * Wi-Fi both reach it, and the 3D plant comes from the local website before
 * it is deployed. Either can still be set by hand:
 *
 *   EXPO_PUBLIC_API_ORIGIN=http://10.0.2.2:3000 npx expo start       (the Android emulator)
 */
const devHost = process.env.EXPO_PUBLIC_LOCAL === '1' ? Constants.expoConfig?.hostUri?.split(':')[0] : undefined;
const LOCAL_ORIGIN = devHost ? `http://${devHost}:5173` : undefined;

export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_ORIGIN || LOCAL_ORIGIN || 'https://api.sprouty.id.vn').replace(/\/$/, '');
export const API_BASE = `${API_ORIGIN}/api/v1`;

/** The website, for shared links, help pages, the 3D plant and pictures not bundled in the app. The www address: the bare one only redirects to it. */
export const WEB_ORIGIN = (process.env.EXPO_PUBLIC_WEB_ORIGIN || LOCAL_ORIGIN || 'https://www.sprouty.id.vn').replace(/\/$/, '');

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
