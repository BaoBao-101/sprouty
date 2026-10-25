import { API_BASE, API_ORIGIN, WEB_ORIGIN } from './config';
import { BUNDLED_IMAGES } from './bundled-images';

/*
 * The Sprouty API, from the app.
 *
 * The same endpoints the website uses (frontend/src/services/api.ts). Two
 * things differ because a phone is not a browser on sprouty.id.vn:
 *
 *  - Signing in returns a token, sent back as `Authorization: Bearer` with
 *    `X-Sprouty-Client: app` (backend/src/plugins/session.js). An API from
 *    before tokens existed sets its cookie instead, which the phone's HTTP
 *    stack keeps, so the app still works against it — just with the website's
 *    shorter sessions.
 *  - Private uploads (album photos, instruction videos) are opened by URL in
 *    <Image>/<Video>, which cannot carry the token; they get a short-lived
 *    `?mt=` pass instead (backend/src/services/media-token.js).
 */

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

let authToken: string | null = null;
let csrfToken: string | null = null;
let mediaToken: string | null = null;

export const session = {
  setToken(token: string | null) { authToken = token; },
  hasToken: () => Boolean(authToken),
  setCsrf(token: string | null) { csrfToken = token; },
  setMediaToken(token: string | null) { mediaToken = token; },
};

/** Kinds anyone may fetch; the rest need the media pass. Mirrors middleware/assetGuard.js. */
const PUBLIC_KINDS = new Set(['blog_cover', 'blog_inline', 'workshop_cover', 'product_image']);

/** An /uploads/ URL the app can open: on the API host, with the pass when the file is private. */
export function mediaUrl(value: string): string {
  // String work rather than URL: React Native's URL lacks searchParams.
  const at = value.indexOf('/uploads/');
  if (at < 0) return value;
  const origin = value.slice(0, at);
  // Relative, or on the API host — anything else is somebody else's file.
  if (origin && origin !== API_ORIGIN && origin !== 'https://api.sprouty.id.vn') return value;
  const path = value.slice(at);
  const kind = path.slice('/uploads/'.length).split(/[/?]/)[0];
  const pass = mediaToken && !PUBLIC_KINDS.has(kind) && !/[?&]mt=/.test(path)
    ? `${path.includes('?') ? '&' : '?'}mt=${encodeURIComponent(mediaToken)}`
    : '';
  return API_ORIGIN + path + pass;
}

/**
 * Something an <Image> can show: a bundled copy of a website picture, an
 * upload on the API, or the website's own file.
 */
export function imageSource(value?: string | null): number | { uri: string } | null {
  if (!value) return null;
  if (BUNDLED_IMAGES[value]) return BUNDLED_IMAGES[value];
  if (value.includes('/uploads/')) return { uri: mediaUrl(value) };
  if (/^(https?:|data:|file:)/.test(value)) return { uri: value };
  return { uri: WEB_ORIGIN + (value.startsWith('/') ? value : `/${value}`) };
}

/** Every /uploads/ string in a response, made openable (see mediaUrl). */
function withMedia<T>(value: T): T {
  if (typeof value === 'string') return (value.includes('/uploads/') && !value.includes('<') ? mediaUrl(value) : value) as T;
  if (Array.isArray(value)) return value.map(withMedia) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withMedia(v)])) as T;
  }
  return value;
}

type Body = Record<string, unknown> | FormData | undefined;

async function request<T = any>(path: string, method = 'GET', body?: Body, retried = false): Promise<T> {
  const mutation = method !== 'GET';
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Sprouty-Client': 'app' };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  if (mutation && csrfToken) headers['X-CSRF-Token'] = csrfToken;

  let payload: string | FormData | undefined;
  if (body instanceof FormData) {
    payload = body; // fetch writes the multipart boundary itself
  } else if (mutation) {
    // A bodiless POST/PATCH/DELETE still goes as JSON: the routes read an
    // empty object, and Fastify refuses a body-less request with no type.
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body ?? {});
  }

  let res: Response;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: payload, credentials: 'include' });
  } catch {
    throw new ApiError('Không kết nối được tới Sprouty. Kiểm tra mạng rồi thử lại nhé.', 0);
  }

  let data: any = null;
  try { data = await res.json(); } catch { data = null; }

  if (!res.ok) {
    const message = data?.message || `Lỗi ${res.status}`;
    // A CSRF token that lapsed (the app was asleep, the API restarted): fetch
    // a new one and send once more.
    if (res.status === 403 && mutation && !retried && /csrf/i.test(message)) {
      try {
        const fresh = await request<{ csrfToken: string }>('/auth/csrf');
        csrfToken = fresh.csrfToken;
        return request<T>(path, method, body, true);
      } catch { /* fall through to the original error */ }
    }
    throw new ApiError(message, res.status, data);
  }
  return withMedia(data ?? {}) as T;
}

const qs = (params: Record<string, string | number | undefined> = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

export const API = {
  auth: {
    me: () => request('/auth/me'),
    csrf: () => request('/auth/csrf'),
    login: (email: string, password: string) => request('/auth/login', 'POST', { email, password }),
    register: (name: string, email: string, password: string) => request('/auth/register', 'POST', { name, email, password }),
    logout: () => request('/auth/logout', 'POST'),
    updateProfile: (name: string) => request('/auth/profile', 'PATCH', { name }),
    changePassword: (currentPassword: string, newPassword: string) => request('/auth/change-password', 'POST', { currentPassword, newPassword }),
    mediaToken: () => request('/auth/media-token'),
    deleteAccount: (password: string) => request('/auth/account', 'DELETE', { password }),
  },
  products: {
    list: () => request('/products'),
    get: (id: number | string) => request(`/products/${id}`),
    species: () => request('/products/species'),
    reviews: (id: number | string, params: Record<string, string | number> = {}) => request(`/products/${id}/reviews${qs(params)}`),
  },
  videos: {
    summary: (productId: number | string) => request(`/products/${productId}/videos/summary`),
    forProduct: (productId: number | string) => request(`/products/${productId}/videos`),
    get: (videoId: string) => request(`/videos/${videoId}`),
  },
  reviews: {
    mine: () => request('/me/reviews'),
    create: (data: Record<string, unknown>) => request('/me/reviews', 'POST', data),
    update: (id: string, data: Record<string, unknown>) => request(`/me/reviews/${id}`, 'PATCH', data),
    remove: (id: string) => request(`/me/reviews/${id}`, 'DELETE'),
    uploadImage: (form: FormData) => request('/me/review-images', 'POST', form),
  },
  workshopReviews: {
    list: (params: Record<string, string | number> = {}) => request(`/workshop-reviews${qs(params)}`),
    mine: () => request('/me/workshop-reviews'),
    create: (data: Record<string, unknown>) => request('/me/workshop-reviews', 'POST', data),
    update: (id: string, data: Record<string, unknown>) => request(`/me/workshop-reviews/${id}`, 'PATCH', data),
    remove: (id: string) => request(`/me/workshop-reviews/${id}`, 'DELETE'),
  },
  orders: {
    create: (data: Record<string, unknown>) => request('/orders', 'POST', data),
    list: (params: Record<string, string | number> = {}) => request(`/orders${qs(params)}`),
    get: (id: string) => request(`/orders/${id}`),
    cancel: (id: string) => request(`/orders/${id}/cancel`, 'PATCH'),
    received: (id: string) => request(`/orders/${id}/received`, 'POST'),
    updateShipping: (id: string, data: Record<string, unknown>) => request(`/orders/${id}/shipping`, 'PATCH', data),
    simulatePayment: (id: string) => request(`/orders/${id}/simulate-payment`, 'POST'),
  },
  workshops: {
    list: () => request('/workshops'),
    mine: () => request('/me/workshops'),
    register: (data: Record<string, unknown>) => request('/workshops/register', 'POST', data),
    payment: (id: string) => request(`/me/workshops/${id}/payment`),
    cancelMine: (id: string) => request(`/me/workshops/${id}/cancel`, 'PATCH'),
  },
  plants: {
    list: () => request('/me/plants'),
    get: (id: string) => request(`/me/plants/${id}`),
    activate: (code: string, nickname?: string) => request('/me/plants/activate', 'POST', { code, nickname }),
    care: (id: string, action: string) => request(`/me/plants/${id}/care`, 'POST', { action }),
    replant: (id: string) => request(`/me/plants/${id}/replant`, 'POST'),
    setDevice: (id: string, type: string, autoMode: boolean) => request(`/me/plants/${id}/devices`, 'PATCH', { type, autoMode }),
    rename: (id: string, nickname: string) => request(`/me/plants/${id}`, 'PATCH', { nickname }),
    coach: (id: string, question?: string) => request(`/me/plants/${id}/coach`, 'POST', { question }),
    clearCoach: (id: string) => request(`/me/plants/${id}/coach`, 'DELETE'),
  },
  garden: { benefits: () => request('/me/benefits') },
  /** What the account's codes unlock (the AI assistant may need one). */
  entitlements: () => request('/me/entitlements'),
  rewards: { mine: () => request('/me/rewards') },
  membership: {
    plans: () => request('/membership/plans'),
    mine: () => request('/me/membership'),
    checkout: (productId: number) => request('/membership/checkout', 'POST', { productId }),
  },
  chat: {
    send: (messages: Array<{ role: string; content: string }>, imageDataUrl?: string) =>
      request('/chat', 'POST', imageDataUrl ? { messages, imageDataUrl } : { messages }),
  },
  album: {
    list: (productId: number | string, plantId = '') => request(`/my-products/${productId}/images${qs({ plant: plantId })}`),
    upload: (productId: number | string, form: FormData, plantId = '') => request(`/my-products/${productId}/images${qs({ plant: plantId })}`, 'POST', form),
    update: (id: string, data: Record<string, unknown>) => request(`/my-images/${id}`, 'PATCH', data),
    remove: (id: string) => request(`/my-images/${id}`, 'DELETE'),
  },
  blog: {
    list: (params: Record<string, string | number> = {}) => request(`/blog${qs(params)}`),
    get: (slug: string) => request(`/blog/${encodeURIComponent(slug)}`),
  },
};
