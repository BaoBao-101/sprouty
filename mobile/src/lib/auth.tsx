import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { API, ApiError, session } from './api';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'employee' | 'admin';
  isVip?: boolean;
  vipUntil?: string | null;
  vipExpired?: boolean;
  createdAt?: string;
}

interface AuthValue {
  user: User | null;
  /** false until the stored session has been checked against the API. */
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
  deleteAccount: (password: string) => Promise<string>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** In the phone's keychain/keystore, not plain storage: it is the account. */
const TOKEN_KEY = 'sprouty.session';
const STAFF_MESSAGE = 'Ứng dụng Sprouty dành cho phụ huynh. Tài khoản nhân viên vui lòng dùng trang web sprouty.id.vn.';

/**
 * Staying signed in. The token from sign-in is kept in SecureStore, so a
 * parent who opens the app tomorrow is still in; the CSRF token and the media
 * pass are fetched again on every launch and kept in memory only.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const mediaTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** A pass for private photos and videos, renewed before it runs out. */
  const refreshMediaToken = useCallback(async () => {
    clearTimeout(mediaTimer.current);
    try {
      const { token, expiresAt } = await API.auth.mediaToken();
      session.setMediaToken(token);
      const msLeft = new Date(expiresAt).getTime() - Date.now();
      mediaTimer.current = setTimeout(refreshMediaToken, Math.max(60_000, msLeft * 0.75));
    } catch {
      // An older API has no media passes; everything but private media still works.
      session.setMediaToken(null);
    }
  }, []);

  /** After any sign-in: the CSRF token for changes, and the media pass. */
  const startSession = useCallback(async (token: string | undefined, csrf: string | undefined) => {
    if (token) {
      session.setToken(token);
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    }
    session.setCsrf(csrf ?? null);
    await refreshMediaToken();
  }, [refreshMediaToken]);

  const forget = useCallback(async () => {
    clearTimeout(mediaTimer.current);
    session.setToken(null);
    session.setCsrf(null);
    session.setMediaToken(null);
    setUser(null);
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
  }, []);

  // Launch: restore the stored session.
  useEffect(() => {
    let live = true;
    (async () => {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      if (stored) session.setToken(stored);
      try {
        const { user: me } = await API.auth.me();
        if (!live) return;
        if (me && me.role === 'customer') {
          setUser(me);
          const { csrfToken } = await API.auth.csrf().catch(() => ({ csrfToken: undefined }));
          await startSession(undefined, csrfToken);
        } else if (stored) {
          await forget(); // revoked, expired, or a deleted account
        }
      } catch {
        // Offline at launch: keep the token, the screens will retry.
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => { live = false; };
  }, [forget, startSession]);

  // Back in the foreground: the media pass may have lapsed while asleep.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && user) void refreshMediaToken();
    });
    return () => sub.remove();
  }, [user, refreshMediaToken]);

  const value = useMemo<AuthValue>(() => ({
    user,
    ready,
    async login(email, password) {
      const data = await API.auth.login(email, password);
      if (data.user?.role !== 'customer') {
        // An API from before the app existed lets staff sign in; the app is not theirs.
        await API.auth.logout().catch(() => {});
        throw new ApiError(STAFF_MESSAGE, 403);
      }
      await startSession(data.token, data.csrfToken);
      setUser(data.user);
      return data.user;
    },
    async register(name, email, password) {
      const data = await API.auth.register(name, email, password);
      await startSession(data.token, data.csrfToken);
      setUser(data.user);
      return data.user;
    },
    async logout() {
      await API.auth.logout().catch(() => {});
      await forget();
    },
    async refreshUser() {
      try {
        const { user: me } = await API.auth.me();
        if (me) setUser(me);
      } catch { /* keep what we have */ }
    },
    setUser,
    async deleteAccount(password) {
      const { message } = await API.auth.deleteAccount(password);
      await forget();
      return message as string;
    },
  }), [user, ready, startSession, forget]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside <AuthProvider>');
  return ctx;
}
