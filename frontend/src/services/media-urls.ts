/** Private local uploads must use the same-origin proxy to carry the session cookie. */
export function sameOriginMediaUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname === 'api.sprouty.id.vn' && !url.port && url.pathname.startsWith('/uploads/')) {
      return url.pathname + url.search + url.hash;
    }
  } catch { /* Relative URLs already use the current origin. */ }
  return value;
}

/** Handles nested assets in album, admin, product and video API responses. */
export function normalizeMediaUrls<T>(value: T): T {
  if (typeof value === 'string') return sameOriginMediaUrl(value) as T;
  if (Array.isArray(value)) return value.map(normalizeMediaUrls) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeMediaUrls(item)])) as T;
  }
  return value;
}
