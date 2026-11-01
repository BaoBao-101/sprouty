import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { ActionBar, Button, Card, Empty, IconButton, IconTile, Screen, Sheet, Stepper, T } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { MAX_QTY, useCart } from '@/lib/cart';
import { formatPrice, isVipOrder, shortOrderId } from '@/lib/format';
import { fetchProducts } from '@/lib/products';
import type { Order } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, radius, surface } from '@/theme';

const cartArt = imageSource('/assets/images/sprouty-icons/Cart.png') as number;

/** Why paying here is safe, in three short tags. */
const ASSURANCES: Array<{ icon: IconName; text: string }> = [
  { icon: 'lock', text: 'Xác nhận tự động' },
  { icon: 'bolt', text: 'Có mã ngay' },
  { icon: 'return', text: 'Hoàn tiền 7 ngày' },
];

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
      <Screen title={cart.count ? `Giỏ hàng · ${cart.count}` : 'Giỏ hàng'} back="/shop" bar={cart.lines.length > 0} onRefresh={pending.reload}
        actions={cart.lines.length ? <IconButton icon="trash" label="Xoá hết giỏ hàng" boxed size={19} onPress={() => Alert.alert('Xoá hết?', 'Bỏ tất cả sản phẩm khỏi giỏ hàng?', [{ text: 'Không', style: 'cancel' }, { text: 'Xoá hết', style: 'destructive', onPress: cart.clear }])} /> : undefined}>
        {order && (
          <Card tone="warn">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <IconTile icon="clock" size={40} tint="#FDE5BC" color={colors.warn} />
              <View style={{ flex: 1 }}>
                <Text style={s.pendTitle}>Còn một đơn chưa thanh toán</Text>
                <Text style={s.pendSub}>#{shortOrderId(order.id)} · {formatPrice(order.total)}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button small variant="ghost" title="Sửa đơn" busy={busy} onPress={() => editPending(order)} />
              <Button small grow title="Thanh toán đơn này" onPress={() => router.push(`/payment?orderId=${order.id}`)} />
            </View>
          </Card>
        )}

        {cart.lines.length === 0 ? (
          <Empty art={cartArt} title="Giỏ hàng đang trống" text="Chọn một bộ kit để bé gieo hạt thật và nuôi cây 3D.">
            <Button title="Xem bộ kit" icon="arrow-right" onPress={() => router.push('/shop')} />
          </Empty>
        ) : (
          <>
            <View style={{ gap: 12 }}>
              {cart.lines.map((line) => (
                <View key={`${line.id}:${line.variant}`} style={s.line}>
                  <Pressable onPress={() => router.push(`/product/${line.id}`)} style={[s.thumb, { backgroundColor: line.bg }]} accessibilityLabel={line.name}>
                    {imageSource(line.images[0]) ? <Image source={imageSource(line.images[0])} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="pot" size={24} color={colors.greenDark} />}
                  </Pressable>
                  <View style={{ flex: 1, gap: 3 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
                      <Text numberOfLines={2} style={s.name}>{line.name}</Text>
                      <Pressable onPress={() => cart.remove(line.id, line.variant)} hitSlop={8} style={s.remove} accessibilityLabel={`Bỏ ${line.name} khỏi giỏ`}>
                        <Icon name="close" size={14} color={colors.ink4} />
                      </Pressable>
                    </View>
                    {line.variant === 'smart' && <View style={s.smart}><Icon name="bolt" size={11} color={colors.warn} /><Text style={s.smartText}>Smart · IoT</Text></View>}
                    <View style={s.lineFoot}>
                      <Text style={s.lineTotal}>{formatPrice(line.price * line.qty)}</Text>
                      <Stepper value={line.qty} min={1} max={MAX_QTY} label={`Số lượng ${line.name}`} onChange={(v) => cart.setQty(line.id, line.variant, v)} />
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <Card style={{ gap: 10 }}>
              <View style={s.sum}><T muted>Tạm tính · {cart.count} sản phẩm</T><T>{formatPrice(cart.total + cart.saving)}</T></View>
              {cart.saving > 0 && <View style={s.sum}><T muted>Giảm giá</T><T style={{ color: colors.greenDark, fontFamily: fonts.bold }}>−{formatPrice(cart.saving)}</T></View>}
              <View style={s.sum}><T muted>Giao hàng</T><T style={{ color: colors.greenDark, fontFamily: fonts.bold }}>Miễn phí</T></View>
              <View style={[s.sum, s.total]}><Text style={s.totalLabel}>Tổng cộng</Text><Text style={s.totalValue}>{formatPrice(cart.total)}</Text></View>
            </Card>
            <View style={s.assure}>
              {ASSURANCES.map((a) => (
                <View key={a.text} style={s.assureItem}>
                  <Icon name={a.icon} size={18} color={colors.green} />
                  <Text style={s.assureText}>{a.text}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Screen>

      {cart.lines.length > 0 && (
        <ActionBar>
          <View style={{ flex: 1 }}><Text style={s.barLabel}>Tổng cộng</Text><Text style={s.totalValue}>{formatPrice(cart.total)}</Text></View>
          <Button title="Đặt hàng" icon="arrow-right" grow onPress={checkout} />
        </ActionBar>
      )}

      <Sheet open={askLogin} title="Đăng nhập để đặt hàng" onClose={() => setAskLogin(false)}>
        <View style={{ alignItems: 'center', gap: 12 }}>
          <Image source={cartArt} style={{ width: 84, height: 84 }} contentFit="contain" />
          <T muted style={{ textAlign: 'center' }}>Giỏ hàng vẫn được giữ nguyên. Đăng nhập để nhận mã kích hoạt và theo dõi đơn.</T>
        </View>
        <Button title="Đăng nhập" onPress={() => { setAskLogin(false); router.push('/login?next=/cart'); }} />
        <Button title="Tạo tài khoản mới" variant="ghost" onPress={() => { setAskLogin(false); router.push('/register?next=/cart'); }} />
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  pendTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  pendSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.warn },
  line: { ...surface, flexDirection: 'row', gap: 12, padding: 10 },
  thumb: { width: 76, height: 76, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  name: { flex: 1, fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink },
  remove: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  smart: { flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.warnSoft },
  smartText: { fontFamily: fonts.bold, fontSize: 11, color: colors.warn },
  lineFoot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' },
  lineTotal: { fontFamily: fonts.bold, fontSize: 16, color: colors.price },
  sum: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 12, marginTop: 2 },
  totalLabel: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  totalValue: { fontFamily: fonts.bold, fontSize: 20, color: colors.price },
  barLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3 },
  assure: { flexDirection: 'row', gap: 8 },
  assureItem: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4, borderRadius: radius.md, backgroundColor: colors.mint },
  assureText: { fontFamily: fonts.semi, fontSize: 12, lineHeight: 16, color: colors.greenDark, textAlign: 'center' },
});
