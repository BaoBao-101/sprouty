export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  qty: number;
  /** Price paid per unit, captured at checkout. */
  unitPrice: number;
  /** 'standard' | 'smart' — which variant was bought, when one was offered. */
  variant?: string | null;
  /** The server selects images for this endpoint; the type never said so. */
  product?: { name?: string; emoji?: string; images?: string[] };
}

export interface RedeemCode {
  code: string;
  productId?: number;
  productName?: string;
  /** Entitlements the code unlocks; the payment page lists them. */
  features?: string[];
  /** True once this code has produced a plant — the code is then spent. */
  redeemed?: boolean;
  plantId?: string | null;
  plantNickname?: string | null;
  activatedAt?: string | null;
}

export interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  paidAt?: string | null;
  note?: string | null;
  shippingName: string;
  shippingPhone: string;
  shippingAddress?: string | null;
  items: OrderItem[];
  redeemCodes?: RedeemCode[];
}

export const ORDER_STATUS_VN: Record<OrderStatus, string> = {
  pending: 'Chờ xác nhận',
  processing: 'Đang xử lý',
  shipped: 'Đang giao',
  // Not "Đã giao": this is also where an order lands whose only
  // deliverable was an activation code, and nothing was delivered to
  // anywhere. "Hoàn tất" is true of both.
  delivered: 'Hoàn tất',
  cancelled: 'Đã hủy',
};

export const ORDER_STATUS_CLASS: Record<OrderStatus, string> = {
  pending: 'status-pending',
  processing: 'status-processing',
  shipped: 'status-shipped',
  delivered: 'status-delivered',
  cancelled: 'status-cancelled',
};

export const ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];

export function formatOrderDate(value: string) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Last 8 characters, as shown to customers and staff. */
export function shortOrderId(id: string) {
  return id.slice(-8).toUpperCase();
}
