import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { AddressFields, joinAddress, splitAddress, type AddressParts } from '@/components/AddressFields';
import { Icon } from '@/components/Icon';
import { PayPanel } from '@/components/PayPanel';
import { useToast } from '@/components/Toast';
import { Button, Card, CardTitle, cheer, Empty, Field, H, Loading, Pill, Screen, Sheet, T } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { daysLeft, formatDate, formatPrice, isVipOrder, ORDER_STATUS_VN, planLength, realAddress, shortOrderId } from '@/lib/format';
import { fetchProducts } from '@/lib/products';
import type { MembershipInfo, Order, Transfer } from '@/lib/types';
import { colors, fonts, radius } from '@/theme';

/*
 * The bank webhook can land at any moment. The first stretch is polled
 * tightly — the parent has just switched back from their banking app and is
 * watching — then it backs off, and stops after a while with a button to
 * look again.
 */
const POLL_FAST_MS = 2000;
const POLL_SLOW_MS = 6000;
const FAST_WINDOW_MS = 90 * 1000;
const MAX_WAIT_MS = 15 * 60 * 1000;

type Phase = 'loading' | 'ready' | 'notfound' | 'timeout';

/** Who receives the box, correctable while the order is unpaid. */
function ContactSheet({ order, open, onClose, onSaved }: { order: Order; open: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<AddressParts>(splitAddress(''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(order.shippingName || '');
    setPhone(order.shippingPhone || '');
    setAddress(splitAddress(realAddress(order)));
    setError('');
  }, [open, order]);

  async function save() {
    setError('');
    if (name.trim().length < 2) return setError('Nhập tên người nhận.');
    if (!/^[0-9]{9,11}$/.test(phone.trim())) return setError('Số điện thoại gồm 9–11 chữ số.');
    setBusy(true);
    try {
      const { message } = await API.orders.updateShipping(order.id, {
        shippingName: name.trim(),
        shippingPhone: phone.trim(),
        ...(joinAddress(address) ? { shippingAddress: joinAddress(address) } : {}),
      });
      toast(message || 'Đã cập nhật thông tin nhận hàng', 'success');
      onClose();
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Không cập nhật được.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} title="Sửa thông tin nhận hàng" onClose={onClose}
      footer={<Button title={busy ? 'Đang lưu…' : 'Lưu thông tin'} busy={busy} onPress={save} />}>
      <Field label="Họ tên" value={name} onChangeText={setName} autoComplete="name" />
      <Field label="Số điện thoại" value={phone} keyboardType="phone-pad" autoComplete="tel" onChangeText={(t) => setPhone(t.replace(/[^\d]/g, '').slice(0, 11))} />
      <AddressFields value={address} onChange={setAddress} />
      {error ? <T style={{ color: colors.bad }}>{error}</T> : null}
    </Sheet>
  );
}

/** A code for a kit just bought: copy it, or sow the plant with one tap. */
function CodeCard({ code, busy, disabled, onActivate }: {
  code: NonNullable<Order['redeemCodes']>[number]; busy: boolean; disabled: boolean; onActivate: () => void;
}) {
  const toast = useToast();
  return (
    <View style={s.codeCard}>
      <Text style={s.kicker}>MÃ KÍCH HOẠT</Text>
      <T bold>{code.productName || `Sản phẩm #${code.productId}`}</T>
      <View style={s.codeRow}>
        <Text selectable style={s.code}>{code.code}</Text>
        <Pressable hitSlop={6} style={s.copyBtn} accessibilityLabel="Sao chép mã kích hoạt"
          onPress={async () => { await Clipboard.setStringAsync(code.code); toast('Đã sao chép mã kích hoạt', 'success'); }}>
          <Icon name="copy" size={18} color={colors.greenDark} />
        </Pressable>
      </View>
      {code.redeemed && code.kind === 'membership' ? (
        <View style={s.done}><Icon name="check" size={18} color={colors.greenDark} /><T bold style={{ color: colors.greenDark }}>Đã kích hoạt gói thành viên</T></View>
      ) : code.redeemed ? (
        <Button variant="soft" icon="sprout" title={`Xem cây${code.plantNickname ? ` “${code.plantNickname}”` : ''}`}
          onPress={() => router.push(code.plantId ? `/plant/${code.plantId}` : '/garden')} />
      ) : (
        <Button icon="seed" busy={busy} disabled={disabled} onPress={onActivate}
          title={busy ? 'Đang gieo hạt…' : code.kind === 'membership' ? 'Kích hoạt gói thành viên' : 'Kích hoạt & gieo hạt ngay'} />
      )}
      <T muted style={{ fontSize: 13 }}>{code.redeemed ? 'Mã này đã được dùng.' : 'Mã luôn xem lại được trong Đơn hàng của tôi.'}</T>
    </View>
  );
}

/**
 * Paying for an order, and what comes right after: the activation codes, or
 * the VIP upgrade. Polls the order until the bank says the money arrived.
 */
export default function PaymentScreen() {
  const { orderId: raw } = useLocalSearchParams<{ orderId?: string }>();
  const orderId = String(raw || '').trim();
  const { refreshUser } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [membership, setMembership] = useState<MembershipInfo | null>(null);
  const [canSimulate, setCanSimulate] = useState(false);
  const [phase, setPhase] = useState<Phase>('loading');
  const [hint, setHint] = useState('');
  const [simulating, setSimulating] = useState(false);
  const [activating, setActivating] = useState('');
  const [editing, setEditing] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const startedAt = useRef(Date.now());
  const celebrated = useRef(false);
  const refreshUserRef = useRef(refreshUser);
  refreshUserRef.current = refreshUser;
  const [pollKey, setPollKey] = useState(0);

  const refresh = useCallback(async (): Promise<'continue' | 'stop'> => {
    if (!orderId) { setPhase('notfound'); return 'stop'; }
    try {
      const data = await API.orders.get(orderId);
      if (!data.order) { setPhase('notfound'); return 'stop'; }
      setOrder(data.order);
      setTransfer(data.payment || null);
      setMembership(data.membership || null);
      setCanSimulate(Boolean(data.canSimulatePayment));
      setPhase('ready');
      setHint('');
      if (data.order.paidAt && !celebrated.current) {
        celebrated.current = true;
        cheer();
        if (isVipOrder(data.order)) {
          toast('Thanh toán thành công! Tài khoản đã lên VIP Garden.', 'success');
          void refreshUserRef.current();
        } else {
          toast('Thanh toán thành công! Mã kích hoạt đã sẵn sàng.', 'success');
        }
      }
      return data.order.status === 'pending' ? 'continue' : 'stop';
    } catch (err: any) {
      if ([401, 403, 404].includes(err?.status)) { setPhase('notfound'); return 'stop'; }
      setHint('Mất kết nối tạm thời, đang thử lại…');
      return 'continue';
    }
  }, [orderId, toast]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const loop = async () => {
      if (stopped) return;
      const outcome = await refresh();
      if (stopped || outcome === 'stop') return;
      const waited = Date.now() - startedAt.current;
      if (waited > MAX_WAIT_MS) { setPhase((p) => (p === 'ready' ? 'timeout' : p)); return; }
      timer = setTimeout(loop, waited < FAST_WINDOW_MS ? POLL_FAST_MS : POLL_SLOW_MS);
    };
    startedAt.current = Date.now();
    void loop();
    // Back from the banking app: the likeliest moment the answer changed.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') { startedAt.current = Date.now(); void refresh(); }
    });
    return () => { stopped = true; clearTimeout(timer); sub.remove(); };
  }, [refresh, pollKey]);

  async function simulate() {
    setSimulating(true);
    try {
      await API.orders.simulatePayment(orderId);
      await refresh();
    } catch (err: any) {
      toast(err?.message || 'Không ghi nhận được thanh toán thử.', 'error');
    } finally {
      setSimulating(false);
    }
  }

  async function activate(code: string) {
    setActivating(code);
    try {
      const data = await API.plants.activate(code);
      cheer();
      toast(data.message || 'Đã kích hoạt mã.', 'success');
      if (data.plant?.id) router.replace(`/plant/${data.plant.id}`);
      else { setActivating(''); void refresh(); }
    } catch (err: any) {
      toast(err?.message || 'Không kích hoạt được mã này.', 'error');
      setActivating('');
    }
  }

  /** The order already exists, so editing it means cancelling it and refilling the cart. */
  function editOrder() {
    if (!order) return;
    Alert.alert('Sửa sản phẩm trong đơn?', `Đơn #${shortOrderId(order.id)} sẽ được huỷ và sản phẩm về lại giỏ để bạn sửa rồi đặt lại.\n\nNếu đã chuyển khoản cho đơn này thì đừng sửa — hãy chờ app tự xác nhận.`, [
      { text: 'Để sau', style: 'cancel' },
      { text: 'Về giỏ để sửa', onPress: async () => {
        setEditing(true);
        try {
          const { order: fresh } = await API.orders.get(order.id);
          if (fresh.status !== 'pending' || fresh.paidAt) throw new Error('Đơn này đã được thanh toán — không sửa được nữa.');
          const byId = new Map((await fetchProducts()).map((p) => [p.id, p]));
          const missing: string[] = [];
          const lines = (fresh as Order).items.flatMap((item) => {
            const product = byId.get(item.productId ?? item.product?.id ?? -1);
            if (!product) { missing.push(item.product?.name || 'Một sản phẩm'); return []; }
            return [{ product, qty: item.qty, variant: item.variant }];
          });
          await API.orders.cancel(order.id);
          cart.restore(lines);
          toast(missing.length ? `${missing.join(', ')} không còn bán nên không thêm lại được.` : 'Sản phẩm đã về giỏ — sửa xong bấm Đặt hàng.', missing.length ? 'error' : 'success');
          router.replace('/cart');
        } catch (err: any) {
          toast(err?.message || 'Chưa sửa được đơn. Vui lòng thử lại.', 'error');
          setEditing(false);
          void refresh();
        }
      } },
    ]);
  }

  const vip = order ? isVipOrder(order) : false;
  const pending = order?.status === 'pending';
  const cancelled = order?.status === 'cancelled';
  const codes = order?.redeemCodes || [];
  const returnPath = `/payment?orderId=${orderId}`;

  return (
    <Screen title={vip ? 'Thanh toán VIP Garden' : 'Thanh toán'} back="/orders" onRefresh={() => refresh()}>
      {phase === 'loading' && <Loading label="Đang mở đơn hàng…" />}

      {phase === 'notfound' && (
        <Empty icon="search" title="Không tìm thấy đơn hàng" text="Đơn không tồn tại, hoặc tài khoản này không xem được đơn đó.">
          <Button title="Đơn hàng của tôi" variant="ghost" onPress={() => router.replace('/orders')} />
        </Empty>
      )}

      {order && phase === 'timeout' && (
        <Card tone="warn">
          <CardTitle icon="clock">Đã ngừng tự kiểm tra</CardTitle>
          <T>App đã chờ 15 phút. Nếu bạn đã chuyển khoản, bấm kiểm tra lại — không cần chuyển thêm.</T>
          <Button title="Kiểm tra lại" onPress={() => { setPhase('ready'); setPollKey((k) => k + 1); }} />
        </Card>
      )}

      {order && phase === 'ready' && pending && (
        <>
          {!vip && (
            <View style={s.steps}>
              <Text style={[s.step, s.stepDone]}>✓ Giỏ hàng</Text>
              <Text style={[s.step, s.stepDone]}>✓ Nhận hàng</Text>
              <Text style={[s.step, s.stepNow]}>Thanh toán</Text>
            </View>
          )}
          <Card>
            {transfer ? (
              <>
                <View style={s.live}><View style={s.dot} /><Text style={s.liveText}>Đang chờ thanh toán</Text></View>
                <PayPanel transfer={transfer} returnPath={returnPath} />
                <View style={s.waiting}>
                  <Icon name="clock" size={20} color={colors.greenDark} />
                  <View style={{ flex: 1 }}>
                    <T bold>App tự cập nhật khi ngân hàng báo có</T>
                    <T muted>Thường trong vòng một phút. Không cần bấm gì, cũng đừng chuyển thêm lần nữa.{hint ? ` ${hint}` : ''}</T>
                  </View>
                </View>
              </>
            ) : (
              <>
                <CardTitle icon="info">Chưa cấu hình cổng thanh toán</CardTitle>
                <T muted>Vui lòng liên hệ Sprouty để được hướng dẫn thanh toán cho đơn {shortOrderId(order.id)}.</T>
              </>
            )}
            {canSimulate && (
              <View style={s.dev}>
                <Text style={s.devTag}>CHẾ ĐỘ THỬ NGHIỆM</Text>
                <T muted>Máy chủ này cho phép ghi nhận thanh toán mà không cần chuyển khoản thật.</T>
                <Button small variant="ghost" busy={simulating} onPress={simulate}
                  title={simulating ? 'Đang ghi nhận…' : vip ? 'Thanh toán thử & lên VIP' : 'Thanh toán thử & lấy mã'} />
              </View>
            )}
          </Card>

          <Card>
            <CardTitle icon="cart" right={<Pill tone="warn">{ORDER_STATUS_VN[order.status]}</Pill>}>{vip ? 'Gói VIP của bạn' : 'Đơn hàng'}</CardTitle>
            <View style={s.orderCode}>
              <T muted>Mã đơn</T>
              <Text selectable style={s.mono}>{shortOrderId(order.id)}</Text>
            </View>
            {order.items.map((item, i) => (
              <View key={i} style={s.item}>
                <View style={s.thumb}>
                  {imageSource(item.product?.images?.[0]) ? <Image source={imageSource(item.product?.images?.[0])} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="pot" size={20} color={colors.greenDark} />}
                </View>
                <View style={{ flex: 1 }}>
                  <T bold numberOfLines={2}>{item.product?.name || 'Sản phẩm'}</T>
                  <T muted>{item.variant === 'smart' ? 'Bản Smart · ' : ''}{formatPrice(item.unitPrice)}{item.qty > 1 ? ` × ${item.qty}` : ''}</T>
                </View>
                <T bold>{formatPrice(item.unitPrice * item.qty)}</T>
              </View>
            ))}
            <View style={s.totalRow}><T bold>Tổng cộng</T><Text style={s.total}>{formatPrice(order.total)}</Text></View>
            {!vip && <Button small variant="ghost" icon="pencil" busy={editing} title={editing ? 'Đang đưa về giỏ…' : 'Sửa sản phẩm trong đơn'} onPress={editOrder} />}
          </Card>

          {vip ? (
            <Card tone="soft">
              <CardTitle icon="star">Sau khi thanh toán</CardTitle>
              <T>• Tài khoản tự lên VIP ngay khi tiền về — không cần nhập mã.</T>
              {membership?.days ? <T>• Thời hạn {planLength(membership.days)}{membership.isVip ? ', nối tiếp hạn VIP hiện tại' : ''}.</T> : null}
              <T>• Không giao hàng — mọi quyền lợi nằm trên tài khoản của bạn.</T>
            </Card>
          ) : (
            <Card>
              <CardTitle icon="user" right={<Button small variant="ghost" icon="pencil" title="Sửa" onPress={() => setContactOpen(true)} />}>Người nhận</CardTitle>
              <View style={{ gap: 6 }}>
                <T><T muted>Họ tên: </T>{order.shippingName || '—'}</T>
                <T><T muted>Điện thoại: </T>{order.shippingPhone || '—'}</T>
                <T><T muted>Địa chỉ: </T>{realAddress(order) || 'Chưa có — bấm Sửa để thêm'}</T>
              </View>
            </Card>
          )}
          <ContactSheet order={order} open={contactOpen} onClose={() => setContactOpen(false)} onSaved={() => void refresh()} />
        </>
      )}

      {order && phase === 'ready' && !pending && (
        vip && !cancelled ? (
          <Card tone="soft" style={{ alignItems: 'center' }}>
            <Image source={imageSource('/assets/images/sprouty-icons/VIP.png') as number} style={{ width: 96, height: 96 }} contentFit="contain" />
            <H style={{ textAlign: 'center' }}>Đã nâng cấp VIP Garden!</H>
            <T style={{ textAlign: 'center' }}>Thanh toán đã được ghi nhận, tài khoản của bạn đã tự lên VIP.</T>
            {membership?.isVip && <T bold>VIP đến {formatDate(membership.vipUntil)} · còn {daysLeft(membership.vipUntil)} ngày</T>}
            <Button block title="Xem quyền lợi VIP" onPress={() => router.replace('/vip')} />
            <Button block variant="ghost" title="Tới khu vườn" onPress={() => router.replace('/garden')} />
          </Card>
        ) : (
          <>
            <View style={{ alignItems: 'center', gap: 8, paddingTop: 8 }}>
              <View style={[s.badge, cancelled && { backgroundColor: colors.badSoft }]}>
                <Icon name={cancelled ? 'warning' : 'check'} size={40} color={cancelled ? colors.bad : colors.greenDark} />
              </View>
              <H style={{ textAlign: 'center', color: cancelled ? colors.bad : colors.ink }}>{cancelled ? 'Đơn hàng đã bị huỷ' : 'Thanh toán thành công!'}</H>
              <T muted style={{ textAlign: 'center' }}>
                {cancelled ? `Đơn ${shortOrderId(order.id)} đã bị huỷ. Liên hệ Sprouty nếu bạn cần hỗ trợ.`
                  : codes.length ? 'Mã kích hoạt đã sẵn sàng — bấm một nút là bé gieo hạt xong.' : `Đơn ${shortOrderId(order.id)} đã được ghi nhận.`}
              </T>
            </View>
            {codes.map((code) => (
              <CodeCard key={code.code} code={code} busy={activating === code.code} disabled={Boolean(activating)} onActivate={() => activate(code.code)} />
            ))}
            {order.needsShipping && !cancelled && (
              <Card tone="soft" style={{ flexDirection: 'row', gap: 10 }}>
                <Icon name="gift" size={22} color={colors.greenDark} />
                <T style={{ flex: 1 }}>Hộp kit sẽ được đóng gói và gửi tới {realAddress(order) || 'địa chỉ bạn đã nhập'}. Theo dõi ở Đơn hàng của tôi và bấm “Đã nhận được hàng” khi nhận.</T>
              </Card>
            )}
            <Button title="Tới khu vườn" icon="sprout" onPress={() => router.replace('/garden')} />
            <Button title="Xem đơn hàng" variant="ghost" onPress={() => router.replace('/orders')} />
          </>
        )
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, textAlign: 'center', paddingVertical: 8, borderRadius: 999, backgroundColor: '#EEF2E8', fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink4, overflow: 'hidden' },
  stepDone: { backgroundColor: colors.greenSoft, color: colors.greenDark },
  stepNow: { backgroundColor: colors.green, color: colors.white },
  live: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.warnSoft },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  liveText: { fontFamily: fonts.bold, fontSize: 13, color: colors.warn },
  waiting: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.sm, backgroundColor: colors.greenSoft },
  dev: { gap: 8, padding: 12, borderRadius: radius.sm, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.ink5 },
  devTag: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, color: colors.ink3 },
  orderCode: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mono: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: 1.2, color: colors.ink },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 52, height: 52, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
  total: { fontFamily: fonts.bold, fontSize: 19, color: colors.price },
  badge: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  codeCard: { gap: 10, padding: 16, borderRadius: radius.lg, borderWidth: 1.5, borderColor: '#CFE9C9', backgroundColor: colors.card },
  kicker: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1, color: colors.green },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14, borderRadius: radius.sm, backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.line },
  code: { flex: 1, fontFamily: fonts.bold, fontSize: 20, letterSpacing: 2, color: colors.ink, paddingVertical: 10 },
  copyBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
});
