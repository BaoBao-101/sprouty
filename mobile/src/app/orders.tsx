import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { AddressFields, joinAddress, missingAddressField, splitAddress, type AddressParts } from '@/components/AddressFields';
import { Icon, type IconName } from '@/components/Icon';
import { ReviewSheet, type ReviewTarget } from '@/components/ReviewSheet';
import { Stars } from '@/components/shop';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, ChipRow, Empty, ErrorNote, Field, IconTile, Loading, Pill, Screen, Sheet, T, type Tone } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { DELIVERED_BY_VN, formatDate, formatPrice, isVipOrder, ORDER_STATUS_VN, realAddress, shortOrderId } from '@/lib/format';
import type { Order, OrderStatus, OwnReview, ReviewOptions } from '@/lib/types';
import { colors, fonts, radius, surface } from '@/theme';

type Step = { key: string; label: string; icon: IconName };
const TRACK: Step[] = [{ key: 'placed', label: 'Đặt hàng', icon: 'cart' }, { key: 'paid', label: 'Thanh toán', icon: 'ticket' }, { key: 'activate', label: 'Kích hoạt', icon: 'sprout' }];
const VIP_TRACK: Step[] = [{ key: 'placed', label: 'Đặt gói', icon: 'cart' }, { key: 'paid', label: 'Thanh toán', icon: 'ticket' }, { key: 'vip', label: 'Lên VIP', icon: 'star' }];
const PARCEL: Step[] = [
  { key: 'placed', label: 'Đặt', icon: 'cart' }, { key: 'paid', label: 'Trả tiền', icon: 'ticket' },
  { key: 'packing', label: 'Đóng gói', icon: 'gift' }, { key: 'shipping', label: 'Đang giao', icon: 'arrow-right' },
  { key: 'received', label: 'Đã nhận', icon: 'home' },
];

const FILTERS: Array<{ value: '' | OrderStatus; label: string }> = [
  { value: '', label: 'Tất cả' }, { value: 'pending', label: 'Chờ thanh toán' }, { value: 'processing', label: 'Đang chuẩn bị' },
  { value: 'shipped', label: 'Đang giao' }, { value: 'delivered', label: 'Hoàn tất' }, { value: 'cancelled', label: 'Đã huỷ' },
];

const STATUS_TONE: Record<OrderStatus, Tone> = {
  pending: 'warn', processing: 'info', shipped: 'info', delivered: 'good', cancelled: 'neutral',
};

const PAGE = 8;

interface ReviewData {
  reviews: Array<OwnReview & { productId: number }>;
  eligible: Array<{ productId: number; product: { id: number; name: string; image: string | null } }>;
  options: ReviewOptions;
}

/** Where the order is, as icons on a line: done ones ticked, the current one ringed. */
function Track({ order }: { order: Order }) {
  if (order.status === 'cancelled') return null;
  const parcel = Boolean(order.needsShipping);
  const codes = order.redeemCodes || [];
  const reached = parcel
    ? ({ pending: 1, processing: 2, shipped: 3, delivered: 5 } as Record<string, number>)[order.status] ?? 1
    : (isVipOrder(order) ? Boolean(order.paidAt) : codes.length > 0 && codes.every((c) => c.redeemed)) ? 3 : order.paidAt ? 2 : 1;
  const steps = parcel ? PARCEL : isVipOrder(order) ? VIP_TRACK : TRACK;
  return (
    <View style={s.track}>
      {steps.map((step, i) => {
        const done = i < reached;
        const now = i === reached;
        return (
          <View key={step.key} style={s.trackStep}>
            {i > 0 && <View style={[s.trackLine, (done || now) && { backgroundColor: colors.green }]} />}
            <View style={[s.trackDot, done && s.trackDone, now && s.trackNow]}>
              <Icon name={done ? 'check' : step.icon} size={13} color={done ? colors.white : now ? colors.greenDark : colors.ink4} />
            </View>
            <Text numberOfLines={1} style={[s.trackLabel, (done || now) && { color: colors.ink2 }]}>{step.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function AddressSheet({ order, onClose, onSaved }: { order: Order | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<AddressParts>(splitAddress(''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!order) return;
    setName(order.shippingName || '');
    setPhone(order.shippingPhone || '');
    setAddress(splitAddress(realAddress(order)));
    setError('');
    setBusy(false);
  }, [order]);

  async function save() {
    if (!order) return;
    if (name.trim().length < 2) return setError('Nhập họ tên người nhận.');
    if (!/^[0-9]{9,11}$/.test(phone.trim())) return setError('Số điện thoại gồm 9–11 chữ số.');
    const missing = missingAddressField(address);
    if (missing) return setError(missing);
    setBusy(true);
    try {
      const { message } = await API.orders.updateShipping(order.id, { shippingName: name.trim(), shippingPhone: phone.trim(), shippingAddress: joinAddress(address) });
      toast(message || 'Đã cập nhật địa chỉ giao', 'success');
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Chưa lưu được. Vui lòng thử lại.');
      setBusy(false);
    }
  }

  return (
    <Sheet open={Boolean(order)} title="Địa chỉ giao hộp kit" onClose={onClose} footer={<Button title={busy ? 'Đang lưu…' : 'Lưu địa chỉ'} busy={busy} onPress={save} />}>
      <Field label="Họ tên *" value={name} onChangeText={(t) => { setName(t); setError(''); }} autoComplete="name" />
      <Field label="Số điện thoại *" value={phone} keyboardType="phone-pad" autoComplete="tel" onChangeText={(t) => { setPhone(t.replace(/[^\d]/g, '').slice(0, 11)); setError(''); }} />
      <AddressFields value={address} onChange={(next) => { setAddress(next); setError(''); }} />
      {error ? <T style={{ color: colors.bad }}>{error}</T> : null}
      <T muted style={{ fontSize: 13 }}>Sửa được cho tới lúc Sprouty gửi hộp đi.</T>
    </Sheet>
  );
}

function OrderCard({ order, reviews, onChanged, onReview, onAddress, onReceived }: {
  order: Order; reviews: ReviewData | null; onChanged: () => void;
  onReview: (target: ReviewTarget, existing: OwnReview | null) => void; onAddress: (order: Order) => void; onReceived: (order: Order) => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const vip = isVipOrder(order);
  const pending = order.status === 'pending';
  const parcel = Boolean(order.needsShipping);
  const codes = order.redeemCodes || [];
  const address = realAddress(order);
  const addressEditable = parcel && (order.status === 'pending' || order.status === 'processing');

  const copy = async (value: string, what: string) => { await Clipboard.setStringAsync(value); toast(what, 'success'); };

  function cancel() {
    Alert.alert('Huỷ đơn hàng?', 'Hành động này không thể hoàn tác.', [
      { text: 'Không', style: 'cancel' },
      { text: 'Huỷ đơn', style: 'destructive', onPress: async () => {
        setBusy('cancel');
        try { await API.orders.cancel(order.id); onChanged(); } catch (err: any) { toast(err?.message || 'Không huỷ được đơn.', 'error'); } finally { setBusy(''); }
      } },
    ]);
  }

  function received() {
    Alert.alert('Xác nhận đã nhận hàng', 'Bạn đã nhận được hộp kit? Đơn sẽ chuyển sang Hoàn tất.', [
      { text: 'Chưa', style: 'cancel' },
      { text: 'Đã nhận được hàng', onPress: async () => {
        setBusy('received');
        try {
          const { message } = await API.orders.received(order.id);
          toast(message || 'Đơn hàng đã hoàn tất.', 'success');
          onChanged();
          onReceived(order);
        } catch (err: any) {
          toast(err?.message || 'Chưa xác nhận được.', 'error');
        } finally {
          setBusy('');
        }
      } },
    ]);
  }

  return (
    <View style={[s.order, pending && s.orderPending, order.status === 'cancelled' && { opacity: 0.72 }]}>
      <View style={s.orderHead}>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={s.orderId}>#{shortOrderId(order.id)}</Text>
          <Text style={s.small}>{formatDate(order.createdAt)}</Text>
        </View>
        <Pill tone={STATUS_TONE[order.status]}>{ORDER_STATUS_VN[order.status]}</Pill>
      </View>

      <Track order={order} />

      <View style={{ gap: 10 }}>
        {order.items.map((item, i) => {
          const productId = item.productId ?? item.product?.id;
          const mine = productId ? reviews?.reviews.find((r) => r.productId === productId) || null : null;
          const canReview = order.status === 'delivered' && !vip && productId && (mine || reviews?.eligible.some((e) => e.productId === productId));
          const image = item.product?.images?.[0] || null;
          return (
            <View key={i} style={s.item}>
              <View style={s.thumb}>
                {vip ? <Image source={imageSource('/assets/images/sprouty-icons/VIP.png')} style={{ width: 34, height: 34 }} contentFit="contain" />
                  : imageSource(image) ? <Image source={imageSource(image)} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="pot" size={20} color={colors.greenDark} />}
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text numberOfLines={2} style={s.itemName}>{item.product?.name || 'Sản phẩm'}{item.variant === 'smart' ? ' · Smart' : ''}</Text>
                <Text style={s.small}>× {item.qty} · {formatPrice(item.unitPrice * item.qty)}</Text>
                {canReview ? (
                  <Pressable hitSlop={6} style={s.reviewBtn} onPress={() => onReview({ id: productId as number, name: item.product?.name || 'Sản phẩm', image }, mine)}>
                    {mine ? <Stars value={mine.rating} size={13} /> : <Icon name="star" size={15} color={colors.green} />}
                    <Text style={s.reviewText}>{mine ? 'Sửa đánh giá' : 'Đánh giá'}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>

      {codes.length > 0 && (
        <View style={s.codes}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Icon name="seed" size={16} color={colors.greenDark} />
            <Text style={s.codesTitle}>
              {codes.every((c) => c.redeemed) ? `${codes.length} mã · đã gieo hết` : codes.length === 1 ? 'Mã kích hoạt' : `${codes.length} mã · còn ${codes.filter((c) => !c.redeemed).length} chưa dùng`}
            </Text>
          </View>
          {codes.map((code) => (
            <View key={code.code} style={s.code}>
              <View style={{ flex: 1 }}>
                <Text selectable numberOfLines={1} style={[s.codeText, code.redeemed && { color: colors.ink4 }]}>{code.code}</Text>
                <Text numberOfLines={1} style={s.small}>
                  {code.redeemed ? `Đã gieo${code.plantNickname ? ` · ${code.plantNickname}` : ''}` : code.productName || `Sản phẩm #${code.productId}`}
                </Text>
              </View>
              {code.redeemed && code.kind === 'membership' ? (
                <Button small variant="ghost" title="Quyền lợi" onPress={() => router.push('/vip')} />
              ) : code.redeemed ? (
                <Button small variant="soft" title="Xem cây" onPress={() => router.push(code.plantId ? `/plant/${code.plantId}` : '/garden')} />
              ) : (
                <>
                  <Pressable hitSlop={4} style={s.iconBox} onPress={() => copy(code.code, 'Đã sao chép mã')} accessibilityLabel="Sao chép mã"><Icon name="copy" size={17} color={colors.greenDark} /></Pressable>
                  <Button small title="Gieo" icon="seed" onPress={() => router.push(`/garden?activate=${encodeURIComponent(code.code)}`)} />
                </>
              )}
            </View>
          ))}
        </View>
      )}

      {parcel && order.status === 'processing' && (
        <View style={s.parcel}><Icon name="gift" size={16} color={colors.greenDark} /><Text style={s.parcelText}>Đang đóng gói · bé gieo cây 3D được ngay</Text></View>
      )}
      {parcel && (order.status === 'shipped' || order.status === 'delivered') && (
        <View style={s.parcel}>
          <Icon name={order.status === 'delivered' ? 'check' : 'arrow-right'} size={16} color={colors.greenDark} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.parcelText}>
              {order.status === 'delivered'
                ? `Đã nhận${order.deliveredAt ? ` · ${formatDate(order.deliveredAt)}` : ''}${order.deliveredBy && order.deliveredBy !== 'customer' ? ` · ${DELIVERED_BY_VN[order.deliveredBy]}` : ''}`
                : `Đang giao${order.carrier ? ` · ${order.carrier}` : ''}${order.shippedAt ? ` · ${formatDate(order.shippedAt)}` : ''}`}
            </Text>
            {order.trackingCode ? (
              <Pressable onPress={() => copy(order.trackingCode as string, 'Đã sao chép mã vận đơn')} style={{ flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 32 }}>
                <Text selectable style={s.codeSmall}>{order.trackingCode}</Text><Icon name="copy" size={14} color={colors.greenDark} />
              </Pressable>
            ) : null}
          </View>
        </View>
      )}

      {!vip && parcel && order.status !== 'cancelled' && (
        <View style={s.addr}>
          <Icon name="pin" size={15} color={address ? colors.ink4 : colors.warn} />
          <Text numberOfLines={2} style={[s.small, { flex: 1 }, !address && { color: colors.warn, fontFamily: fonts.semi }]}>
            {address ? `${order.shippingName || ''}${order.shippingPhone ? ` · ${order.shippingPhone}` : ''}\n${address}` : 'Chưa có địa chỉ giao'}
          </Text>
        </View>
      )}

      <View style={s.foot}>
        <Text style={s.small}>{vip ? (order.paidAt ? 'Đã lên VIP' : 'Lên VIP khi trả xong') : 'Tổng'}</Text>
        <Text style={s.total}>{formatPrice(order.total)}</Text>
      </View>

      {pending && (
        <View style={s.actions}>
          <Button small variant="ghost" title="Huỷ" busy={busy === 'cancel'} onPress={cancel} />
          {addressEditable && <Button small variant="ghost" icon="pin" title={address ? 'Địa chỉ' : 'Thêm địa chỉ'} onPress={() => onAddress(order)} />}
          <Button small grow title="Thanh toán" icon="arrow-right" onPress={() => router.push(`/payment?orderId=${order.id}`)} />
        </View>
      )}
      {addressEditable && !pending && (
        <Button small variant={address ? 'ghost' : 'primary'} icon="pin" title={address ? 'Sửa địa chỉ' : 'Thêm địa chỉ giao'} onPress={() => onAddress(order)} />
      )}
      {order.status === 'shipped' && (
        <Button icon="check" title={busy === 'received' ? 'Đang lưu…' : 'Đã nhận được hàng'} busy={busy === 'received'} onPress={received} />
      )}
    </View>
  );
}

/** Đơn hàng của tôi: paying, the activation codes, delivery, and reviews of what arrived. */
export default function Orders() {
  const { user, ready } = useAuth();
  const [filter, setFilter] = useState<'' | OrderStatus>('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');
  const [reviews, setReviews] = useState<ReviewData | null>(null);
  const [writing, setWriting] = useState<{ target: ReviewTarget; existing: OwnReview | null } | null>(null);
  const [addressFor, setAddressFor] = useState<Order | null>(null);

  const load = useCallback(async (nextPage = 1) => {
    if (nextPage === 1) setLoading(true); else setMore(true);
    try {
      const data = await API.orders.list({ page: nextPage, limit: PAGE, ...(filter ? { status: filter } : {}) });
      setOrders((list) => (nextPage === 1 ? data.orders || [] : [...list, ...(data.orders || [])]));
      setCounts(data.counts || {});
      setPages(data.pages || 1);
      setPage(nextPage);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Không tải được đơn hàng.');
    } finally {
      setLoading(false);
      setMore(false);
    }
  }, [filter]);

  const loadReviews = useCallback(() => API.reviews.mine().then((d: ReviewData) => { setReviews(d); return d; }).catch(() => null), []);

  useEffect(() => { if (user) void load(1); }, [load, user]);
  useEffect(() => { if (user) void loadReviews(); }, [loadReviews, user]);

  if (ready && !user) return <Redirect href="/login?next=/orders" />;

  async function askForReview(order: Order) {
    const data = await loadReviews();
    if (!data) return;
    const reviewed = new Set(data.reviews.map((r) => r.productId));
    const next = data.eligible.find((e) => !reviewed.has(e.productId) && order.items.some((i) => (i.productId ?? i.product?.id) === e.productId));
    if (next) setWriting({ target: { id: next.product.id, name: next.product.name, image: next.product.image }, existing: null });
  }

  const total = Object.values(counts).reduce((n, c) => n + c, 0);
  const toReview = reviews ? reviews.eligible.filter((e) => !reviews.reviews.some((r) => r.productId === e.productId)) : [];

  return (
    <Screen title="Đơn hàng" back="/me" onRefresh={() => Promise.all([load(1), loadReviews()])}>
      {(counts.pending || 0) > 0 && filter !== 'pending' && (
        <Card tone="warn" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconTile icon="clock" size={38} tint="#FDE5BC" color={colors.warn} />
          <Text style={[s.bannerText, { color: colors.warn }]}>{counts.pending} đơn chờ thanh toán</Text>
          <Button small variant="ghost" title="Xem" onPress={() => setFilter('pending')} />
        </Card>
      )}

      {toReview.length > 0 && (
        <Card tone="soft" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconTile icon="star" size={38} tint={colors.white} color="#E9A21B" />
          <Text numberOfLines={2} style={s.bannerText}>{toReview.length === 1 ? `Bé thấy ${toReview[0].product.name} thế nào?` : `${toReview.length} sản phẩm chờ đánh giá`}</Text>
          <Button small title="Đánh giá" onPress={() => setWriting({ target: { id: toReview[0].product.id, name: toReview[0].product.name, image: toReview[0].product.image }, existing: null })} />
        </Card>
      )}

      {total > 0 && (
        <ChipRow>
          {FILTERS.map((f) => {
            const n = f.value ? counts[f.value] || 0 : total;
            if (f.value && !n && filter !== f.value) return null;
            return <Chip key={f.value} label={f.label} count={n} on={filter === f.value} onPress={() => setFilter(f.value)} />;
          })}
        </ChipRow>
      )}

      {error ? <ErrorNote message={error} onRetry={() => load(1)} /> : null}
      {loading && !orders.length && <Loading />}

      {!loading && !error && orders.length === 0 && (
        <Empty icon="cart" title={filter ? 'Không có đơn ở mục này' : 'Chưa có đơn hàng nào'}
          text={filter ? 'Chọn “Tất cả” để xem lại toàn bộ.' : 'Thanh toán một bộ kit là có mã gieo hạt ngay.'}>
          {filter ? <Button variant="ghost" title="Xem tất cả đơn" onPress={() => setFilter('')} /> : <Button title="Xem bộ kit" icon="arrow-right" onPress={() => router.push('/shop')} />}
        </Empty>
      )}

      {orders.map((order) => (
        <OrderCard key={order.id} order={order} reviews={reviews} onChanged={() => load(1)}
          onReview={(target, existing) => setWriting({ target, existing })} onAddress={setAddressFor} onReceived={askForReview} />
      ))}

      {page < pages && <Button variant="ghost" title={more ? 'Đang tải…' : 'Xem đơn cũ hơn'} busy={more} onPress={() => load(page + 1)} />}

      <AddressSheet order={addressFor} onClose={() => setAddressFor(null)} onSaved={() => load(1)} />
      <ReviewSheet target={writing?.target ?? null} existing={writing?.existing} options={reviews?.options}
        onClose={() => setWriting(null)} onSaved={() => { void loadReviews(); }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  small: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.ink3 },
  bannerText: { flex: 1, fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  order: { ...surface, gap: 14, padding: 16 },
  orderPending: { borderWidth: 1.5, borderColor: '#F3D49A' },
  orderHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderId: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23, letterSpacing: 0.5, color: colors.ink },
  track: { flexDirection: 'row' },
  trackStep: { flex: 1, alignItems: 'center', gap: 5 },
  trackLine: { position: 'absolute', top: 13, right: '50%', width: '100%', height: 2, borderRadius: 1, backgroundColor: colors.sand },
  trackDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand, borderWidth: 2, borderColor: colors.card },
  trackDone: { backgroundColor: colors.green },
  trackNow: { backgroundColor: colors.mint, borderColor: colors.green },
  trackLabel: { fontFamily: fonts.semi, fontSize: 11, color: colors.ink4 },
  item: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 54, height: 54, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  itemName: { fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 19, color: colors.ink },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 34, alignSelf: 'flex-start' },
  reviewText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.green },
  codes: { gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.mint },
  codesTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.greenDark },
  code: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.card },
  codeText: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: 1.2, color: colors.ink },
  codeSmall: { fontFamily: fonts.bold, fontSize: 13.5, letterSpacing: 0.8, color: colors.ink },
  iconBox: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint },
  parcel: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.canvas },
  parcelText: { flex: 1, fontFamily: fonts.semi, fontSize: 13, lineHeight: 18, color: colors.ink2 },
  addr: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: 12 },
  total: { fontFamily: fonts.bold, fontSize: 19, color: colors.price },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
