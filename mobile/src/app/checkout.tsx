import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AddressFields, EMPTY_ADDRESS, joinAddress, missingAddressField, splitAddress, type AddressParts } from '@/components/AddressFields';
import { useToast } from '@/components/Toast';
import { ActionBar, Button, Card, CardTitle, Empty, Field, Screen, T } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import { colors, fonts } from '@/theme';

type Errors = Partial<Record<'name' | 'phone' | 'address', string>>;

/** Who received the last order on this phone, so the next checkout starts filled in (per account). */
const contactKey = (userId?: string) => `sprouty.checkout.contact.${userId ?? 'guest'}`;

/**
 * Who receives the box, and where. The order is created here — the payment
 * screen needs it for its QR code — and the cart empties once it exists.
 */
export default function Checkout() {
  const { user, ready } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<AddressParts>(EMPTY_ADDRESS);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [remembered, setRemembered] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(contactKey(user?.id)).then((raw) => {
      if (!raw) return;
      const saved = JSON.parse(raw) as { name: string; phone: string; address: string };
      setName(saved.name || user?.name || '');
      setPhone(saved.phone || '');
      setAddress(splitAddress(saved.address || ''));
      setRemembered(true);
    }).catch(() => {});
  }, [user?.id, user?.name]);

  if (ready && !user) return <Redirect href="/login?next=/checkout" />;

  async function submit() {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = 'Nhập họ tên người nhận.';
    if (!/^[0-9]{9,11}$/.test(phone.trim())) next.phone = 'Số điện thoại gồm 9–11 chữ số.';
    const missing = missingAddressField(address);
    if (missing) next.address = missing;
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const { order } = await API.orders.create({
        items: cart.lines.map((l) => ({ productId: l.id, qty: l.qty, variant: l.variant })),
        shippingName: name.trim(),
        shippingPhone: phone.trim(),
        shippingAddress: joinAddress(address),
        note: note.trim() || undefined,
      });
      await AsyncStorage.setItem(contactKey(user?.id), JSON.stringify({ name: name.trim(), phone: phone.trim(), address: joinAddress(address) }));
      cart.clear();
      router.replace(`/payment?orderId=${order.id}`);
    } catch (err: any) {
      toast(err?.message || 'Đặt hàng chưa được. Vui lòng thử lại.', 'error');
      setBusy(false);
    }
  }

  if (!cart.lines.length) {
    return (
      <Screen title="Thông tin nhận hàng" back="/cart">
        <Empty icon="cart" title="Giỏ hàng đang trống" text="Thêm một bộ kit vào giỏ rồi quay lại đây nhé."><Button title="Xem bộ kit" onPress={() => router.replace('/shop')} /></Empty>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen title="Thông tin nhận hàng" back="/cart" bar>
        <View style={s.steps}>
          <Text style={[s.step, s.stepDone]}>✓ Giỏ hàng</Text>
          <Text style={[s.step, s.stepNow]}>Nhận hàng</Text>
          <Text style={s.step}>Thanh toán</Text>
        </View>

        <Card>
          <CardTitle icon="user">Người nhận</CardTitle>
          <Field label="Họ tên *" value={name} onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: undefined })); }} autoComplete="name" error={errors.name} />
          <Field label="Số điện thoại *" value={phone} keyboardType="phone-pad" placeholder="0901234567" autoComplete="tel"
            onChangeText={(t) => { setPhone(t.replace(/[^\d]/g, '').slice(0, 11)); setErrors((e) => ({ ...e, phone: undefined })); }} error={errors.phone} />
        </Card>

        <Card>
          <CardTitle icon="pin">Địa chỉ giao hộp kit</CardTitle>
          <T muted>Phường/xã và tỉnh/thành theo địa giới mới (không còn quận/huyện).</T>
          <AddressFields value={address} onChange={(next) => { setAddress(next); setErrors((e) => ({ ...e, address: undefined })); }} error={errors.address} />
        </Card>

        <Card>
          <CardTitle icon="pencil">Ghi chú (không bắt buộc)</CardTitle>
          <Field label="Lời nhắn cho người giao hàng" value={note} onChangeText={setNote} multiline maxLength={300} placeholder="Giao giờ hành chính, gọi trước khi giao…" />
        </Card>

        <Card>
          <CardTitle icon="cart">Đơn hàng ({cart.count})</CardTitle>
          {cart.lines.map((l) => (
            <View key={`${l.id}:${l.variant}`} style={s.mini}>
              <View style={[s.thumb, { backgroundColor: l.bg }]}>{imageSource(l.images[0]) && <Image source={imageSource(l.images[0])} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>
              <View style={{ flex: 1 }}><T bold numberOfLines={1}>{l.name}</T><T muted>{l.variant === 'smart' ? 'Bản Smart · ' : ''}{formatPrice(l.price)} × {l.qty}</T></View>
              <T bold>{formatPrice(l.price * l.qty)}</T>
            </View>
          ))}
          <View style={s.sum}><T muted>Phí giao hàng</T><T>Miễn phí</T></View>
          <View style={[s.sum, { borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 }]}><T bold>Tổng thanh toán</T><Text style={s.total}>{formatPrice(cart.total)}</Text></View>
        </Card>
        {remembered && <T muted style={{ textAlign: 'center' }}>Đã điền sẵn thông tin bạn dùng lần trước.</T>}
      </Screen>

      <ActionBar>
        <View style={{ flex: 1 }}><T muted>Tổng thanh toán</T><Text style={s.total}>{formatPrice(cart.total)}</Text></View>
        <Button title={busy ? 'Đang tạo đơn…' : 'Tới thanh toán'} icon="arrow-right" grow busy={busy} onPress={submit} />
      </ActionBar>
    </View>
  );
}

const s = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, textAlign: 'center', paddingVertical: 8, borderRadius: 999, backgroundColor: '#EEF2E8', fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink4, overflow: 'hidden' },
  stepDone: { backgroundColor: colors.greenSoft, color: colors.greenDark },
  stepNow: { backgroundColor: colors.green, color: colors.white },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 48, height: 48, borderRadius: 10, overflow: 'hidden' },
  sum: { flexDirection: 'row', justifyContent: 'space-between' },
  total: { fontFamily: fonts.bold, fontSize: 19, color: colors.price },
});
