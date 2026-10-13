export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderItem {
  productId?: number;
  qty: number;
  /** Price paid per unit, captured at checkout. */
  unitPrice: number;
  /** 'standard' | 'smart' — which variant was bought, when one was offered. */
  variant?: string | null;
  /** The server selects images for this endpoint; the type never said so. */
  product?: {
    id?: number;
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
  /** Whether there is a parcel to send (a kit, when kits are posted). */
  needsShipping?: boolean;
  /** Staff lists only: the steps allowed next. */
  nextStatuses?: OrderStatus[];
  /** The parcel: sent when, with whom, and the code to track it by. */
  shippedAt?: string | null;
  carrier?: string | null;
  trackingCode?: string | null;
  /** Arrived when, and who confirmed it. */
  deliveredAt?: string | null;
  deliveredBy?: 'customer' | 'staff' | 'auto' | null;
}

/** Who said the parcel arrived, as a customer or staff member reads it. */
export const DELIVERED_BY_VN: Record<string, string> = {
  customer: 'Khách xác nhận đã nhận',
  staff: 'Nhân viên xác nhận đã giao',
  auto: 'Tự hoàn tất sau 7 ngày',
};

/** The carriers staff pick from when sending a parcel. */
export const CARRIERS = ['Giao Hàng Nhanh', 'Giao Hàng Tiết Kiệm', 'Viettel Post', 'J&T Express', 'Ninja Van', 'VNPost', 'Sprouty tự giao'];

export const ORDER_STATUS_VN: Record<OrderStatus, string> = {
  // Waiting on the customer's transfer, not on anyone confirming anything.
  pending: 'Chờ thanh toán',
  // Paid: the code is out, the box is being packed.
  processing: 'Đang chuẩn bị',
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
  // The server says, when it has: it knows whether anything is posted.
  if (order.nextStatuses) return order.nextStatuses;
  if (order.status === 'pending') return order.paidAt ? ['processing'] : ['cancelled'];
  if (!order.paidAt) return [];
  if (order.status === 'processing') return ['shipped'];
  if (order.status === 'shipped') return ['delivered'];
  return [];
}
