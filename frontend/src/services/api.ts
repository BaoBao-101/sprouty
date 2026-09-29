/* ═══════════════════════════════════════════
   SPROUTY api.js — Backend API Client
   All calls go through /api/v1/... (proxied by nginx)
   ═══════════════════════════════════════════ */

// nginx proxies /api/v1/* to the backend container.
export const API_BASE = '/api/v1';

let _csrfToken = null;

function _showApiDownBanner() {
  if (document.getElementById('api-down-banner')) return;
  const div = document.createElement('div');
  div.id = 'api-down-banner';
  div.setAttribute('role', 'alert');
  div.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#FEF3C7;color:#92400E;border-bottom:1.5px solid #FDE68A;padding:10px 16px;font-family:system-ui,sans-serif;font-size:.9rem;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06)';
  div.textContent = '⚠️ Hệ thống đang bảo trì — một số tính năng tạm thời không khả dụng. Vui lòng thử lại sau ít phút.';
  document.body && document.body.appendChild(div);
}

function _hideApiDownBanner() {
  const el = document.getElementById('api-down-banner');
  if (el) el.remove();
}

/** An error thrown by _fetch: carries the HTTP status and the parsed body. */
export interface ApiError extends Error {
  status: number;
  data?: unknown;
  networkError?: boolean;
}

async function _fetch(path: string, options: RequestInit = {}): Promise<any> {
  const method = (options.method || 'GET').toUpperCase();
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  // Only send Content-Type: application/json when there's actually a JSON
  // body — Fastify rejects bodiless requests (GET, and DELETE calls like
  // "remove"/"revoke" that pass no body) that still carry this header with
  // "Body cannot be empty when content-type is set to 'application/json'".
  const headers = (options.body && !isFormData) ? { 'Content-Type': 'application/json' } : {};

  // Include CSRF token for mutating requests
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && _csrfToken) {
    headers['X-CSRF-Token'] = _csrfToken;
  }

  let res;
  try {
    res = await fetch(API_BASE + path, {
      credentials: 'include',
      headers: { ...headers, ...(options.headers || {}) },
      ...options,
    });
  } catch (networkErr) {
    // Network failure — show maintenance banner once.
    _showApiDownBanner();
    const err = new Error('Không thể kết nối đến máy chủ. Vui lòng thử lại sau.') as ApiError;
    err.status = 0;
    err.networkError = true;
    throw err;
  }

  // 5xx upstream failure (e.g. 502/503/504 when backend container is down)
  if (res.status >= 502 && res.status <= 504) {
    _showApiDownBanner();
  } else if (res.ok) {
    _hideApiDownBanner();
  }

  // Parse response
  let data;
  try { data = await res.json(); } catch { data = {}; }

  if (!res.ok) {
    const err = new Error(data.message || `HTTP ${res.status}`) as ApiError;
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const API = {
  auth: {
    me() { return _fetch('/auth/me'); },

    changePassword(currentPassword, newPassword) {
      return _fetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    },

    async login(email, password) {
      const data = await _fetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.csrfToken) _csrfToken = data.csrfToken;
      return data;
    },

    async register(name, email, password) {
      const data = await _fetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password }),
      });
      if (data.csrfToken) _csrfToken = data.csrfToken;
      return data;
    },

    async logout() {
      // _csrfToken lives in memory and is wiped on every full page navigation
      // (admin/employee pages are separate HTML documents, not an SPA). If the
      // page's own background CSRF-seed fetch hasn't resolved yet, this call
      // would otherwise go out with no token and get rejected. Make sure we
      // have a token first so a real, still-active session actually gets logged out.
      if (!_csrfToken) {
        try { await this.getCsrf(); } catch { /* not logged in / no session to refresh */ }
      }
      // Only drop the in-memory CSRF token when the session is *actually*
      // gone — i.e. on success or when the server says the session is already
      // invalid (401). On 5xx or network failure the session is likely
      // still alive on the server, so keeping the token enables a clean retry.
      try {
        const result = await _fetch('/auth/logout', { method: 'POST' });
        _csrfToken = null;
        return result;
      } catch (err) {
        if (err.status === 403) {
          // CSRF mismatch even after refreshing the token — retry once with a
          // freshly-fetched token before giving up, in case of a race with the
          // page's background seed fetch.
          try {
            await this.getCsrf();
            const result = await _fetch('/auth/logout', { method: 'POST' });
            _csrfToken = null;
            return result;
          } catch (retryErr) {
            if (retryErr.status === 401) _csrfToken = null;
            throw retryErr;
          }
        }
        if (err.status === 401) _csrfToken = null;
        throw err;
      }
    },

    async getCsrf() {
      const data = await _fetch('/auth/csrf');
      if (data.csrfToken) _csrfToken = data.csrfToken;
      return data;
    },
  },

  products: {
    list(params = {})  { return _fetch('/products?' + new URLSearchParams(params)); },
    get(id)            { return _fetch(`/products/${id}`); },
  },

  workshops: {
    list()       { return _fetch('/workshops'); },
    get(id)      { return _fetch(`/workshops/${id}`); },
    register(d)  { return _fetch('/workshops/register', { method: 'POST', body: JSON.stringify(d) }); },
    /** What the signed-in customer has booked. */
    mine()       { return _fetch('/me/workshops'); },
    payment(id)  { return _fetch(`/me/workshops/${id}/payment`); },
    cancelMine(id) {
      return _fetch(`/me/workshops/${id}/cancel`, { method: 'PATCH' });
    },
  },

  orders: {
    create(data) { return _fetch('/orders', { method: 'POST', body: JSON.stringify(data) }); },
    list()       { return _fetch('/orders'); },
    get(id)      { return _fetch(`/orders/${id}`); },
    cancel(id)   { return _fetch(`/orders/${id}/cancel`, { method: 'PATCH' }); },
  },

  admin: {
    users: {
      list(params = {}) { return _fetch('/admin/users?' + new URLSearchParams(params)); },
      create(d)       { return _fetch('/admin/users', { method: 'POST', body: JSON.stringify(d) }); },
      update(id, d)   { return _fetch(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(d) }); },
      resetPassword(id, password) {
        return _fetch(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) });
      },
      grantVip(id)    { return _fetch(`/admin/users/${id}/grant-vip`, { method: 'POST' }); },
      revokeVip(id)   { return _fetch(`/admin/users/${id}/grant-vip`, { method: 'DELETE' }); },
    },
    products: {
      list(params = {})   { return _fetch('/admin/products?' + new URLSearchParams(params)); },
      sales()             { return _fetch('/admin/products/sales'); },
      create(d)           { return _fetch('/admin/products', { method: 'POST', body: JSON.stringify(d) }); },
      update(id, d)       { return _fetch(`/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(d) }); },
      remove(id)          { return _fetch(`/admin/products/${id}`, { method: 'DELETE' }); },
    },
    videos: {
      list(productId)        { return _fetch(`/admin/products/${productId}/videos`); },
      create(productId, body){ return _fetch(`/admin/products/${productId}/videos`, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }); },
      update(id, d)          { return _fetch(`/admin/videos/${id}`, { method: 'PUT', body: JSON.stringify(d) }); },
      remove(id)             { return _fetch(`/admin/videos/${id}`, { method: 'DELETE' }); },
      thumbnail(id, form)    { return _fetch(`/admin/videos/${id}/upload-thumbnail`, { method: 'POST', body: form }); },
    },
    orders: {
      list(params = {})        { return _fetch('/admin/orders?' + new URLSearchParams(params)); },
      counts()                 { return _fetch('/admin/orders/counts'); },
      updateStatus(id, status) { return _fetch(`/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); },
    },
    redeemCodes: {
      list()             { return _fetch('/admin/redeem-codes'); },
      create(d)          { return _fetch('/admin/redeem-codes', { method: 'POST', body: JSON.stringify(d) }); },
      update(id, d)      { return _fetch(`/admin/redeem-codes/${id}`, { method: 'PATCH', body: JSON.stringify(d) }); },
      remove(id)         { return _fetch(`/admin/redeem-codes/${id}`, { method: 'DELETE' }); },
      redemptions(id)    { return _fetch(`/admin/redeem-codes/${id}/redemptions`); },
      revokeRedemption(id, redemptionId) { return _fetch(`/admin/redeem-codes/${id}/redemptions/${redemptionId}`, { method: 'DELETE' }); },
    },
    blog: {
      list(params = {})  { return _fetch('/admin/blog?' + new URLSearchParams(params)); },
      create(d)          { return _fetch('/admin/blog', { method: 'POST', body: JSON.stringify(d) }); },
      update(id, d)      { return _fetch(`/admin/blog/${id}`, { method: 'PUT', body: JSON.stringify(d) }); },
      status(id, status) { return _fetch(`/admin/blog/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); },
      remove(id)         { return _fetch(`/admin/blog/${id}`, { method: 'DELETE' }); },
      cover(id, form)    { return _fetch(`/admin/blog/${id}/cover`, { method: 'POST', body: form }); },
      image(form)        { return _fetch('/admin/blog-images', { method: 'POST', body: form }); },
    },
    audit: {
      list(params = {}) { return _fetch('/admin/audit-logs?' + new URLSearchParams(params)); },
      actions()         { return _fetch('/admin/audit-logs/actions'); },
    },
    userImages: {
      list(params = {})  { return _fetch('/admin/user-images?' + new URLSearchParams(params)); },
      counts()           { return _fetch('/admin/user-images/counts'); },
      status(id, status) { return _fetch(`/admin/user-images/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); },
    },
    workshops: {
      stats()            { return _fetch('/admin/workshops/stats'); },
      create(data)       { return _fetch('/admin/workshops', { method: 'POST', body: JSON.stringify(data) }); },
      update(id, data)   { return _fetch(`/admin/workshops/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
      remove(id)         { return _fetch(`/admin/workshops/${id}`, { method: 'DELETE' }); },
      registrations(id)  { return _fetch(`/admin/workshops/${id}/registrations`); },
      uploadCover(form)  { return _fetch('/admin/workshop-images', { method: 'POST', body: form }); },
      setRegistrationStatus(id, registrationId, status) {
        return _fetch(`/admin/workshops/${id}/registrations/${registrationId}`, {
          method: 'PATCH', body: JSON.stringify({ status }),
        });
      },
      cancelRegistration(id, registrationId) {
        return _fetch(`/admin/workshops/${id}/registrations/${registrationId}`, { method: 'DELETE' });
      },
    },
    stats() { return _fetch('/admin/stats'); },
  },

  chat: {
    // The server owns the system prompt now (finding F-07) — it knows who is
    // signed in and looks the catalogue up itself, so sending one from here
    // would only be a claim it has to ignore.
    send(messages, imageDataUrl?) {
      return _fetch('/chat', { method: 'POST', body: JSON.stringify({ messages, imageDataUrl }) });
    },
  },

  videos: {
    listForProduct(productId) { return _fetch(`/products/${productId}/videos`); },
    get(videoId)              { return _fetch(`/videos/${videoId}`); },
    progress(videoId, data)   { return _fetch(`/videos/${videoId}/progress`, { method: 'POST', body: JSON.stringify(data) }); },
  },

  myImages: {
    list(productId)        { return _fetch(`/my-products/${productId}/images`); },
    upload(productId, form){ return _fetch(`/my-products/${productId}/images`, { method: 'POST', body: form }); },
    update(id, data)       { return _fetch(`/my-images/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); },
    remove(id)             { return _fetch(`/my-images/${id}`, { method: 'DELETE' }); },
  },

  redeem: {
    apply(code)       { return _fetch('/redeem', { method: 'POST', body: JSON.stringify({ code }) }); },
    entitlements()    { return _fetch('/me/entitlements'); },
  },

  blog: {
    list(params = {}) { return _fetch('/blog?' + new URLSearchParams(params)); },
    get(slug)         { return _fetch(`/blog/${encodeURIComponent(slug)}`); },
  },
};

// Seed CSRF token from existing session on page load
(async () => {
  try {
    const data = await _fetch('/auth/me');
    if (data.user) {
      const csrf = await _fetch('/auth/csrf');
      if (csrf.csrfToken) _csrfToken = csrf.csrfToken;
    }
  } catch { /* not logged in */ }
})();
