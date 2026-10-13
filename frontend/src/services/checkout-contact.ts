/**
 * Who received the last order placed on this device, so the next checkout
 * starts filled in. Kept in the browser only — the same thing the browser's
 * own autofill would remember — and per account.
 */
export interface RememberedContact {
  name: string;
  phone: string;
  address: string;
}

const key = (userId?: string | number) => `sprouty.checkout.contact.${userId ?? 'guest'}`;

export function readRememberedContact(userId?: string | number): RememberedContact | null {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as RememberedContact) : null;
  } catch {
    return null;
  }
}

export function rememberContact(userId: string | number | undefined, value: RememberedContact) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(value));
  } catch {
    /* Private mode: the form simply starts empty next time. */
  }
}
