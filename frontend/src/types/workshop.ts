/** A workshop as the public API returns it. */
export interface PublicWorkshop {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  dateTime: string;
  endTime?: string | null;
  location: string;
  /** The street address the map looks up; absent, the map searches `location`. */
  address?: string | null;
  ageRange?: string | null;
  price: number;
  capacity: number;
  seatsTaken: number;
  seatsLeft: number;
  isFull: boolean;
  upcoming: boolean;
  /** Still open for registration: it has not started. */
  bookable?: boolean;
}

/** One place label, including addresses saved by the older two-field form. */
export function formatWorkshopLocation(workshop: { location: string; address?: string | null }) {
  const location = workshop.location.trim();
  const address = workshop.address?.trim();
  if (!address) return location;
  if (!location) return address;
  const normalise = (value: string) => value.toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');
  if (normalise(location).includes(normalise(address))) return location;
  if (normalise(address).includes(normalise(location))) return address;
  return `${location} – ${address}`;
}

/** Bank-transfer instructions for one booking. */
export interface WorkshopPayment {
  qrUrl: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  /** The reference that ties the transfer back to the booking. */
  memo: string;
  amount: number;
}

/** One of the signed-in customer's own bookings. */
export interface MyWorkshopRegistration {
  id: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  childAge?: string | null;
  childCount: number;
  note?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  paymentMethod: 'online' | 'onsite';
  amount: number;
  paidAt?: string | null;
  /** Six characters staff ask for at the door; also the QR payload. */
  ticket: string;
  /** Set once staff confirm the child arrived. */
  checkedInAt: string | null;
  attendedCount: number | null;
  createdAt: string;
  upcoming: boolean;
  workshop: PublicWorkshop & { status: string };
}

const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** "Thứ Bảy, 22/03/2026 · 9:00 – 11:30" — the end time only when there is one. */
export function formatWorkshopWhen(workshop: Pick<PublicWorkshop, 'dateTime' | 'endTime'>) {
  const start = new Date(workshop.dateTime);
  if (isNaN(start.getTime())) return '';

  const day = `${WEEKDAY[start.getDay()]}, ${pad(start.getDate())}/${pad(start.getMonth() + 1)}/${start.getFullYear()}`;
  const from = `${start.getHours()}:${pad(start.getMinutes())}`;

  if (!workshop.endTime) return `${day} · ${from}`;
  const end = new Date(workshop.endTime);
  if (isNaN(end.getTime())) return `${day} · ${from}`;
  return `${day} · ${from} – ${end.getHours()}:${pad(end.getMinutes())}`;
}
