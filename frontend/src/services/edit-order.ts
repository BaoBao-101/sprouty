import { API } from '@/services/api';
import { Cart } from '@/services/cart';
import { fetchProducts } from '@/services/products';
import { isVipOrder, type Order } from '@/types/order';

/**
 * "Sửa đơn hàng": an unpaid order goes back to being a cart.
 *
 * By the payment page the order already exists, so going back to change it
 * has to undo it; otherwise the customer ends up with two orders waiting and
 * may pay the wrong one. This checks the order is still unpaid (asking the
 * bank first, as the payment page does), loads the catalogue, and only then
 * cancels — so a failure part-way leaves the order as it was, not a cancelled
 * order and an empty cart. Prices come from the catalogue as it is now.
 */
export async function editOrder(orderId: string) {
  const { order } = (await API.orders.get(orderId)) as { order: Order };
  if (!order || order.status !== 'pending' || order.paidAt) {
    throw new Error('Đơn này đã được thanh toán hoặc không còn chờ — không sửa được nữa.');
  }
  if (isVipOrder(order)) throw new Error('Gói VIP được chọn lại ở trang VIP Garden.');

  const products = await fetchProducts();
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines: Array<{ product: any; qty: number; variant?: string }> = [];
  const missing: string[] = [];
  for (const item of order.items) {
    const product = byId.get(item.productId ?? item.product?.id ?? -1);
    if (product) lines.push({ product, qty: item.qty, variant: item.variant || 'standard' });
    else missing.push(item.product?.name || 'Một sản phẩm');
  }

  await API.orders.cancel(orderId);
  Cart.register(products);
  Cart.restore(lines);
  return { restored: lines.length, missing };
}
