export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  qty: number;
  /** Price paid per unit, captured at checkout. */
  unitPrice: number;
  /** 'standard' | 'smart' — which variant was bought, when one was offered. */
  variant?: string | null;
  /** The server selects images for this endpoint; the type never said so. */
  product?: {
    name?: string;
    emoji?: string;
    images?: string[];
    category?: string;
    /** Days one unit of a VIP plan lasts. */
    membershipDays?: number | null;
  };
}

/**
 * The account's tier as the order endpoint reports it alongside a VIP order,
 * so the payment page can say how long the upgrade lasts.
 */
export interface MembershipInfo {
  /** Days this order adds. */
  days: number;
  tier: 'regular' | 'vip';
  isVip: boolean;
  vipUntil: string | null;
  vipExpired: boolean;
}

export interface RedeemCode {
  code: string;
  productId?: number;
  productName?: string;
  /** Entitlements the code unlocks; the payment page lists them. */
  features?: string[];
  /**
   * A kit grows a plant; a membership grants features and nothing grows.
   * The two need different buttons — offering "gieo hạt" for a membership
   * promised a plant that could never exist.
   */
  kind?: 'kit' | 'membership';
  /** True once the code is spent: the plant exists, or the membership is active. */
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

/**
 * A VIP Garden purchase: bought on /vip, paid on its own, and switched on by
 * the payment rather than by a code. Every screen that shows an order needs
 * to tell these apart — there is nothing to activate and nothing to deliver.
 */
export function isVipOrder(order: Pick<Order, 'items'>) {
  const items = order.items || [];
  return items.length > 0 && items.every((i) => i.product?.category === 'membership');
}

/** Last 8 characters, as shown to customers and staff. */
export function shortOrderId(id: string) {
  return id.slice(-8).toUpperCase();
}

export function allowedOrderTransitions(order: Order): OrderStatus[] {
  if (order.status === 'pending') return order.paidAt ? ['processing'] : ['cancelled'];
  if (!order.paidAt) return [];
  if (order.status === 'processing') return ['shipped'];
  if (order.status === 'shipped') return ['delivered'];
  return [];
}
