/** A workshop as the public API returns it. */
export interface PublicWorkshop {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  dateTime: string;
  endTime?: string | null;
  location: string;
  ageRange?: string | null;
  price: number;
  capacity: number;
  seatsTaken: number;
  seatsLeft: number;
  isFull: boolean;
  upcoming: boolean;
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
