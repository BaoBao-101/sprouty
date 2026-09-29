/** A workshop as the public API returns it. */
export interface PublicWorkshop {
  id: string;
  title: string;
  description?: string | null;
  emoji?: string | null;
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
