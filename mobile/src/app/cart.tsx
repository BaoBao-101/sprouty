import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { ActionBar, Button, Card, CardTitle, Empty, IconButton, Screen, Sheet, Stepper, T } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MAX_QTY, useCart } from '@/lib/cart';
import { formatPrice, isVipOrder, shortOrderId } from '@/lib/format';
import { fetchProducts } from '@/lib/products';
import type { Order } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, radius } from '@/theme';

const cartArt = imageSource('/assets/images/sprouty-icons/Cart.png') as number;

/**
 * Giỏ hàng. An order placed but not paid is named at the top: going back from
 * the payment screen lands here with an empty basket — the products became the
 * order — and filling it again would make a second order beside the first.
 */
export default function CartScreen() {
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const [askLogin, setAskLogin] = useState(false);
  const [busy, setBusy] = useState(false);

  const pending = useLoad(async () => {
    if (!user) return null;
    const data = await API.orders.list({ status: 'pending', limit: 5 });
    return ((data.orders || []) as Order[]).find((o) => !isVipOrder(o)) || null;
  }, [user?.id]);

  /** "Sửa đơn": the unpaid order goes back to being a cart (cancel, then restore). */
  function editPending(order: Order) {
    Alert.alert('Sửa đơn hàng?', `Đơn #${shortOrderId(order.id)} sẽ được huỷ và sản phẩm về lại giỏ để bạn sửa rồi đặt lại.\n\nNếu đã chuyển khoản cho đơn này thì đừng làm vậy — hãy mở đơn để chờ xác nhận.`, [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Về giỏ để sửa', onPress: async () => {
        setBusy(true);
        try {
          const { order: fresh } = await API.orders.get(order.id);
          if (fresh.status !== 'pending' || fresh.paidAt) throw new Error('Đơn này đã được thanh toán — không sửa được nữa.');
          const products = await fetchProducts();
          const byId = new Map(products.map((p) => [p.id, p]));
          const lines = (fresh as Order).items.flatMap((item) => {
            const product = byId.get(item.productId ?? item.product?.id ?? -1);
            return product ? [{ product, qty: item.qty, variant: item.variant }] : [];
          });
          await API.orders.cancel(order.id);
          cart.restore(lines);
          toast('Sản phẩm đã về giỏ hàng.', 'success');
          await pending.reload();
        } catch (err: any) {
          toast(err?.message || 'Chưa đưa đơn về giỏ được.', 'error');
        } finally {
          setBusy(false);
        }
      } },
    ]);
  }

  function checkout() {
    if (!user) return setAskLogin(true);
    router.push('/checkout');
  }

  const order = pending.data;
  return (
    <View style={{ flex: 1 }}>
      <Screen title={cart.count ? `Giỏ hàng (${cart.count})` : 'Giỏ hàng'} back="/shop" bar={cart.lines.length > 0} onRefresh={pending.reload}
        actions={cart.lines.length ? <IconButton icon="trash" label="Xoá hết giỏ hàng" onPress={() => Alert.alert('Xoá hết?', 'Bỏ tất cả sản phẩm khỏi giỏ hàng?', [{ text: 'Không', style: 'cancel' }, { text: 'Xoá hết', style: 'destructive', onPress: cart.clear }])} /> : undefined}>
        {order && (
          <Card tone="warn">
            <CardTitle icon="clock">{cart.lines.length ? 'Bạn còn một đơn chưa thanh toán' : 'Bạn có một đơn chưa thanh toán'}</CardTitle>
            <T muted>#{shortOrderId(order.id)} · {formatPrice(order.total)} · {order.items.map((i) => i.product?.name || 'Sản phẩm').join(', ')}</T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small variant="ghost" title="Sửa đơn" busy={busy} onPress={() => editPending(order)} />
              <Button small grow title="Thanh toán đơn này" onPress={() => router.push(`/payment?orderId=${order.id}`)} />
            </View>
          </Card>
        )}

        {cart.lines.length === 0 ? (
          <Empty art={cartArt} title="Giỏ hàng đang trống" text="Chọn một bộ kit để bé gieo hạt thật và nuôi cây 3D mỗi ngày.">
            <Button title="Xem bộ kit" onPress={() => router.push('/shop')} />
          </Empty>
        ) : (
          <>
            {cart.lines.map((line) => (
              <View key={`${line.id}:${line.variant}`} style={s.line}>
                <Pressable onPress={() => router.push(`/product/${line.id}`)} style={[s.thumb, { backgroundColor: line.bg }]}>
                  {imageSource(line.images[0]) ? <Image source={imageSource(line.images[0])} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="pot" size={24} color={colors.greenDark} />}
                </Pressable>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={2} style={s.name}>{line.name}</Text>
                  <T muted>{line.variant === 'smart' ? 'Bản Smart · ' : ''}{formatPrice(line.price)}</T>
                  <View style={s.lineFoot}>
                    {line.qty > 1 ? (
                      <Stepper value={line.qty} min={1} max={MAX_QTY} label={`Số lượng ${line.name}`} onChange={(v) => cart.setQty(line.id, line.variant, v)} />
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <IconButton icon="trash" label="Bỏ khỏi giỏ" onPress={() => cart.remove(line.id, line.variant)} />
                        <IconButton icon="add" label="Thêm một" onPress={() => cart.setQty(line.id, line.variant, 2)} />
                      </View>
                    )}
                    <Text style={s.lineTotal}>{formatPrice(line.price * line.qty)}</Text>
                  </View>
                </View>
              </View>
            ))}

            <Card>
              <View style={s.sum}><T muted>Tạm tính ({cart.count} sản phẩm)</T><T>{formatPrice(cart.total + cart.saving)}</T></View>
              {cart.saving > 0 && <View style={s.sum}><T muted>Giảm giá</T><T style={{ color: colors.greenDark }}>−{formatPrice(cart.saving)}</T></View>}
              <View style={s.sum}><T muted>Phí giao hàng</T><T>Miễn phí</T></View>
              <View style={[s.sum, s.total]}><T bold>Tổng cộng</T><Text style={s.totalValue}>{formatPrice(cart.total)}</Text></View>
            </Card>
            {['Chuyển khoản ngân hàng, tự xác nhận trong 1 phút', 'Có mã kích hoạt cây ngay khi thanh toán', 'Hoàn tiền trong 7 ngày nếu chưa kích hoạt'].map((t, i) => (
              <View key={t} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Icon name={(['lock', 'bolt', 'return'] as const)[i]} size={16} color={colors.green} />
                <T muted style={{ flex: 1 }}>{t}</T>
              </View>
            ))}
          </>
        )}
      </Screen>

      {cart.lines.length > 0 && (
        <ActionBar>
          <View style={{ flex: 1 }}><T muted>Tổng cộng</T><Text style={s.totalValue}>{formatPrice(cart.total)}</Text></View>
          <Button title="Đặt hàng" icon="arrow-right" grow onPress={checkout} />
        </ActionBar>
      )}

      <Sheet open={askLogin} title="Đăng nhập để đặt hàng" onClose={() => setAskLogin(false)}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Image source={cartArt} style={{ width: 84, height: 84 }} contentFit="contain" />
          <T muted style={{ textAlign: 'center' }}>Giỏ hàng của bạn vẫn được giữ nguyên. Đăng nhập để Sprouty gửi mã kích hoạt cây và theo dõi đơn giao cho bạn.</T>
        </View>
        <Button title="Đăng nhập" onPress={() => { setAskLogin(false); router.push('/login?next=/cart'); }} />
        <Button title="Tạo tài khoản mới" variant="ghost" onPress={() => { setAskLogin(false); router.push('/register?next=/cart'); }} />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  line: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  thumb: { width: 76, height: 76, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  lineFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  lineTotal: { fontFamily: fonts.bold, fontSize: 15, color: colors.price },
  sum: { flexDirection: 'row', justifyContent: 'space-between' },
  total: { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  totalValue: { fontFamily: fonts.bold, fontSize: 19, color: colors.price },
});
