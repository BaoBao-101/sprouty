/** A review as anyone sees it on the product page. */
export interface PublicReview {
  id: string;
  rating: number;
  content: string;
  tags: string[];
  images: string[];
  /** "Mai Anh N." or "Khách hàng Sprouty". */
  author: string;
  initial: string;
  /** Always true: only buyers who received the product can review. */
  verified: boolean;
  edited: boolean;
  createdAt: string;
  reply: { content: string; at: string } | null;
}

/** A workshop review as anyone sees it, with the session it was about. */
export interface PublicWorkshopReview extends PublicReview {
  workshop: { id: string; title: string; dateTime: string } | null;
}

/** What the customer's own review adds: its moderation state. */
export interface OwnReview extends PublicReview {
  anonymous: boolean;
  status: 'published' | 'hidden';
  hiddenReason: string | null;
}

/** The customer's own product review. */
export interface MyReview extends OwnReview {
  productId: number;
}

/** The parent's own review of a session their child attended. */
export interface MyWorkshopReview extends OwnReview {
  workshopId: string;
  workshop: PublicWorkshopReview['workshop'];
}

export interface RatingSummary {
  average: number;
  count: number;
  distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  withPhotos: number;
  /** Share of reviews with four or five stars. */
  recommendPercent: number;
}

/** A product this customer received and may review. */
export interface EligibleProduct {
  productId: number;
  orderId: string;
  deliveredAt: string | null;
  product: { id: number; name: string; image: string | null };
}

/** A session this parent's child was checked in at, and so may review. */
export interface EligibleWorkshop {
  workshopId: string;
  registrationId: string;
  checkedInAt: string;
  workshop: {
    id: string;
    title: string;
    imageUrl: string | null;
    dateTime: string;
    endTime: string | null;
    location: string;
  };
}

export interface ReviewOptions {
  labels: Record<string, string>;
  tags: { good: string[]; bad: string[] };
  maxImages: number;
  maxLength: number;
}

/**
 * A review on the admin screen: who wrote it, what it is about, its state.
 * A product review carries product and orderId; a workshop review carries
 * workshop and the checked-in booking.
 */
export interface AdminReview {
  id: string;
  rating: number;
  content: string;
  tags: string[];
  images: string[];
  anonymous: boolean;
  publicName: string;
  status: 'published' | 'hidden';
  hiddenReason: string | null;
  reply: string | null;
  repliedAt: string | null;
  edited: boolean;
  createdAt: string;
  customer: { id: string; name: string; email: string } | null;
  product?: { id: number; name: string; image: string | null } | null;
  orderId?: string | null;
  workshop?: {
    id: string;
    title: string;
    image: string | null;
    dateTime: string;
    endTime: string | null;
    location: string;
  } | null;
  registration?: { id: string; children: number; checkedInAt: string | null } | null;
}

/** Used until the server's own labels arrive. */
export const RATING_LABELS: Record<number, string> = {
  1: 'Rất tệ',
  2: 'Chưa hài lòng',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Tuyệt vời',
};

/** "15/10/2026". */
export function reviewDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** The same masking the server uses, to preview "Hiển thị là …" in the form. */
export function maskedName(fullName: string, anonymous: boolean) {
  if (anonymous) return 'Khách hàng Sprouty';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Khách hàng Sprouty';
  if (parts.length === 1) return parts[0];
  return `${parts.slice(1).join(' ')} ${parts[0].charAt(0).toUpperCase()}.`;
}
