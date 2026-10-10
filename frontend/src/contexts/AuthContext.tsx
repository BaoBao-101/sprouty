import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';

export interface User {
  id: number;
  name: string;
  email: string;
  role: 'customer' | 'employee' | 'admin';
  status?: string;
  /** Account tier. 'vip' while vipUntil is in the future. */
  tier?: 'regular' | 'vip';
  isVip?: boolean;
  vipUntil?: string | null;
  /** Was VIP, has run out — worded differently from never having been. */
  vipExpired?: boolean;
  /** When the account was made, for "thành viên từ". */
  createdAt?: string;
}

interface AuthValue {
  user: User | null;
  /** false until the session check against the backend has finished. */
  ready: boolean;
  isLoggedIn: boolean;
  isEmployee: boolean;
  isAdmin: boolean;
  /** Resolves with the signed-in user so the caller can route by role. */
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  /**
   * Re-reads the session. The tier changes underneath a signed-in user —
   * a VIP payment lands, a plan runs out — and the header should not wait
   * for a page reload to notice.
   */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/**
 * Where a role belongs right after signing in. Customers get null: they stay on
 * whatever page they were on, because the login modal is usually opened
 * mid-task (checking out, redeeming a code) and moving them would lose it.
 */
export function roleLandingPath(role: User['role']): string | null {
  if (role === 'admin') return '/admin';
  if (role === 'employee') return '/employee/orders';
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Resolve the session cookie once, on mount.
  useEffect(() => {
    let cancelled = false;
    API.auth
      .me()
      .then((data: any) => {
        if (!cancelled) setUser(data.user || null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      ready,
      isLoggedIn: !!user,
      isEmployee: user?.role === 'employee',
      isAdmin: user?.role === 'admin',

      async login(email, password) {
        const data = await API.auth.login(email, password);
        setUser(data.user);
        return data.user as User;
      },

      async register(name, email, password) {
        const data = await API.auth.register(name, email, password);
        setUser(data.user);
        return data.user as User;
      },

      async logout() {
        // 401 means the session is already gone, which is the state we want.
        // API.auth.logout() retries once on 403 with a fresh CSRF token, so a
        // 403 reaching here means the server session is very likely still
        // alive — don't claim to have signed out.
        let cleared = true;
        try {
          await API.auth.logout();
        } catch (err: any) {
          if (err?.status !== 401) cleared = false;
        }
        if (!cleared) {
          showToast('Đăng xuất thất bại — vui lòng thử lại. Phiên đăng nhập vẫn còn.', 'error');
          return;
        }
        setUser(null);
        showToast('Đã đăng xuất. Hẹn gặp lại!');
        // Full reload rather than a route change, so any admin/employee data
        // held in component state is dropped instead of merely unmounted.
        setTimeout(() => window.location.replace('/'), 400);
      },

      setUser,

      async refreshUser() {
        try {
          const data = await API.auth.me();
          setUser(data.user || null);
        } catch {
          /* Keep what we have; a blip should not sign anyone out. */
        }
      },
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong <AuthProvider>');
  return ctx;
}
