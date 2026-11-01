import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AddressFields, EMPTY_ADDRESS, joinAddress, missingAddressField, splitAddress, type AddressParts } from '@/components/AddressFields';
import { useToast } from '@/components/Toast';
import { Icon } from '@/components/Icon';
import { ActionBar, Button, Card, CardTitle, Empty, Field, Screen, Steps, T } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import { colors, fonts, radius } from '@/theme';

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
      <Screen title="Nhận hàng" back="/cart" bar>
        <Steps steps={['Giỏ hàng', 'Nhận hàng', 'Thanh toán']} current={1} />

        {remembered && (
          <View style={s.remembered}><Icon name="check" size={14} color={colors.greenDark} /><Text style={s.rememberedText}>Đã điền sẵn thông tin lần trước</Text></View>
        )}

        <Card>
          <CardTitle icon="user">Người nhận</CardTitle>
          <Field label="Họ tên *" value={name} onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: undefined })); }} autoComplete="name" error={errors.name} />
          <Field label="Số điện thoại *" value={phone} keyboardType="phone-pad" placeholder="0901234567" autoComplete="tel"
            onChangeText={(t) => { setPhone(t.replace(/[^\d]/g, '').slice(0, 11)); setErrors((e) => ({ ...e, phone: undefined })); }} error={errors.phone} />
        </Card>

        <Card>
          <CardTitle icon="pin" right={<View style={s.newTag}><Text style={s.newTagText}>Địa giới mới</Text></View>}>Địa chỉ giao</CardTitle>
          <AddressFields value={address} onChange={(next) => { setAddress(next); setErrors((e) => ({ ...e, address: undefined })); }} error={errors.address} />
          <Field label="Ghi chú cho shipper" value={note} onChangeText={setNote} multiline maxLength={300} placeholder="Gọi trước khi giao…" />
        </Card>

        <Card>
          <CardTitle icon="cart" right={<Text style={s.count}>{cart.count} món</Text>}>Đơn hàng</CardTitle>
          {cart.lines.map((l) => (
            <View key={`${l.id}:${l.variant}`} style={s.mini}>
              <View style={[s.thumb, { backgroundColor: l.bg }]}>{imageSource(l.images[0]) && <Image source={imageSource(l.images[0])} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={s.miniName}>{l.name}</Text>
                <Text style={s.miniSub}>{l.variant === 'smart' ? 'Smart · ' : ''}× {l.qty}</Text>
              </View>
              <Text style={s.miniPrice}>{formatPrice(l.price * l.qty)}</Text>
            </View>
          ))}
          <View style={s.sum}><T muted>Giao hàng</T><T style={{ color: colors.greenDark, fontFamily: fonts.bold }}>Miễn phí</T></View>
        </Card>
      </Screen>

      <ActionBar>
        <View style={{ flex: 1 }}><Text style={s.barLabel}>Tổng thanh toán</Text><Text style={s.total}>{formatPrice(cart.total)}</Text></View>
        <Button title={busy ? 'Đang tạo đơn…' : 'Thanh toán'} icon="arrow-right" grow busy={busy} onPress={submit} />
      </ActionBar>
    </View>
  );
}

const s = StyleSheet.create({
  remembered: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.mint },
  rememberedText: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.greenDark },
  newTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.sand },
  newTagText: { fontFamily: fonts.semi, fontSize: 11.5, color: colors.ink3 },
  count: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink3 },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden' },
  miniName: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  miniSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink3 },
  miniPrice: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  sum: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 12 },
  barLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3 },
  total: { fontFamily: fonts.bold, fontSize: 20, color: colors.price },
});
