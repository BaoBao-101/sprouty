/**
 * Sending a signed-out visitor to the sign-in page.
 *
 * Replaces the old `requireLogin()` modal store. A modal could be opened from
 * anywhere without routing, which is exactly why it was wrong: there was no
 * address to return to, so every sign-in landed on the home page and lost
 * whatever the visitor had been trying to reach.
 */

/** `/login?next=<where you are now>`, so signing in comes back here. */
export function loginHref(next?: string, mode: 'login' | 'register' = 'login') {
  const target = next ?? (typeof window !== 'undefined'
    ? window.location.pathname + window.location.search
    : '');
  // A `next` is only worth carrying when it says something the default does
  // not. Returning to the sign-in page is nonsense, and `next=/` just spelled
  // the home page out in the address bar as `?next=%2F` — noise on screen that
  // changed nothing about where anyone landed.
  const pointless =
    !target ||
    target === '/' ||
    target.startsWith('/login') ||
    target.startsWith('/register');
  return `/${mode}${pointless ? '' : `?next=${encodeURIComponent(target)}`}`;
}
