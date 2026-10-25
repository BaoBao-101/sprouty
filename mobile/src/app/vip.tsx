import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { Button, Card, ErrorNote, H, Loading, Screen, T } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { STORE_BUILD } from '@/lib/config';
import { daysLeft, formatDate, formatPrice, planLength, shortOrderId } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, radius } from '@/theme';

interface Plan { id: number; name: string; description: string; price: number; oldPrice: number | null; images: string[]; badge: string | null; days: number }
interface Mine { isVip: boolean; vipUntil: string | null; vipExpired: boolean; pendingOrder: { id: string; total: number; planName: string | null } | null }

const PERKS: Array<{ icon: IconName; label: string }> = [
  { icon: 'shield', label: 'Bộ chăm tự động giữ cây không héo khô' },
  { icon: 'chat', label: 'Hỏi Plant Buddy AI không giới hạn' },
  { icon: 'album', label: 'Ảnh, video kỷ niệm không giới hạn' },
  { icon: 'pot', label: 'Chậu trang trí và khung cảnh vườn đặc biệt' },
  { icon: 'star', label: 'Huy hiệu VIP trên tài khoản' },
];

function perMonth(price: number, days: number) {
  if (days < 60 || !price) return null;
  const monthly = price / (days / 30);
  return monthly >= 10_000 ? Math.round(monthly / 1000) * 1000 : Math.max(100, Math.round(monthly / 100) * 100);
}

function bestValue(plans: Plan[]) {
  const priced = plans.filter((p) => p.days > 0 && p.price > 0);
  if (priced.length < 2) return null;
  const daily = (p: Plan) => p.price / p.days;
  const sorted = [...priced].sort((a, b) => daily(a) - daily(b));
  return daily(sorted[0]) < daily(sorted[sorted.length - 1]) * 0.95 ? sorted[0].id : null;
}

/**
 * VIP Garden. The plan is bought here, on its own order, and paying is the
 * upgrade — no code to type in. A Play Store or App Store build lists the
 * benefits and the account's standing but sells nothing: a digital
 * membership must go through the store's own billing there.
 */
export default function Vip() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [buying, setBuying] = useState<number | null>(null);

  const data = useLoad(async () => {
    const [plans, mine] = await Promise.all([
      API.membership.plans().then((d: any) => (d.plans || []) as Plan[]),
      user ? API.membership.mine().catch(() => null) as Promise<Mine | null> : Promise.resolve(null),
    ]);
    if (user) void refreshUser();
    return { plans, mine };
  }, [user?.id]);

  const plans = useMemo(() => [...(data.data?.plans || [])].sort((a, b) => a.days - b.days || a.price - b.price), [data.data]);
  const best = useMemo(() => bestValue(plans), [plans]);
  const mine = data.data?.mine;

  async function buy(plan: Plan) {
    if (!user) return router.push('/login?next=/vip');
    setBuying(plan.id);
    try {
      const res = await API.membership.checkout(plan.id);
      router.push(`/payment?orderId=${res.order.id}`);
    } catch (err: any) {
      toast(err?.message || 'Không tạo được đơn VIP. Vui lòng thử lại.', 'error');
    } finally {
      setBuying(null);
    }
  }

  return (
    <Screen title="VIP Garden" back="/me" onRefresh={data.reload}>
      <Card tone="soft" style={{ alignItems: 'center' }}>
        <Image source={imageSource('/assets/images/sprouty-icons/VIP.png') as number} style={{ width: 96, height: 96 }} contentFit="contain" />
        <H size={22} style={{ textAlign: 'center' }}>Thêm không gian cho cây kỷ niệm của bé</H>
        <T style={{ textAlign: 'center' }}>Bộ chăm tự động trông cây khi bé bận, kỷ niệm không giới hạn và Plant Buddy hỏi thoải mái.</T>
      </Card>

      {mine && (
        <Card tone={mine.isVip ? undefined : mine.vipExpired ? 'warn' : undefined} style={mine.isVip ? { borderColor: '#F2C27A', backgroundColor: '#FFF8EC' } : undefined}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name={mine.isVip ? 'star' : mine.vipExpired ? 'clock' : 'sprout'} size={22} color={mine.isVip ? colors.warn : colors.green} />
            <View style={{ flex: 1 }}>
              <T bold>{mine.isVip ? `Bạn là VIP đến ${formatDate(mine.vipUntil)}` : mine.vipExpired ? 'Gói VIP đã hết hạn' : 'Tài khoản thường'}</T>
              <T muted>{mine.isVip ? `Còn ${daysLeft(mine.vipUntil)} ngày.${STORE_BUILD ? '' : ' Gia hạn sớm sẽ cộng nối tiếp.'}` : mine.vipExpired ? 'Cây và kỷ niệm vẫn còn nguyên.' : 'Mọi bộ kit vẫn chăm được đầy đủ.'}</T>
            </View>
          </View>
          {!STORE_BUILD && mine.pendingOrder && (
            <Button small title={`Thanh toán đơn #${shortOrderId(mine.pendingOrder.id)} · ${formatPrice(mine.pendingOrder.total)}`}
              onPress={() => router.push(`/payment?orderId=${mine.pendingOrder!.id}`)} />
          )}
        </Card>
      )}

      <Card>
        <T bold style={{ fontSize: 16 }}>Gói nào cũng có đủ quyền lợi</T>
        {PERKS.map((p) => (
          <View key={p.label} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={s.perkIcon}><Icon name={p.icon} size={18} color={colors.greenDark} /></View>
            <T style={{ flex: 1 }}>{p.label}</T>
          </View>
        ))}
      </Card>

      {STORE_BUILD ? (
        <T muted style={{ textAlign: 'center' }}>Gói VIP Garden chưa bán trong ứng dụng. Quyền lợi VIP có sẵn trên tài khoản của bạn sẽ dùng được đầy đủ tại đây.</T>
      ) : (
        <>
          {data.error ? <ErrorNote message={data.error} onRetry={data.reload} /> : null}
          {data.loading && !data.data && <Loading />}
          {plans.map((plan) => {
            const monthly = perMonth(plan.price, plan.days);
            return (
              <Card key={plan.id} style={plan.id === best ? { borderColor: colors.green, borderWidth: 1.5 } : undefined}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <T bold style={{ fontSize: 17 }}>{plan.name}</T>
                    <T muted>{planLength(plan.days)}{monthly ? ` · khoảng ${formatPrice(monthly)}/tháng` : ''}</T>
                  </View>
                  {plan.id === best && <View style={s.best}><Text style={s.bestText}>Tiết kiệm nhất</Text></View>}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <Text style={s.price}>{formatPrice(plan.price)}</Text>
                  {plan.oldPrice ? <Text style={s.old}>{formatPrice(plan.oldPrice)}</Text> : null}
                </View>
                <Button title={buying === plan.id ? 'Đang tạo đơn…' : mine?.isVip ? 'Gia hạn gói này' : 'Chọn gói này'} busy={buying === plan.id}
                  disabled={buying !== null} onPress={() => buy(plan)} />
              </Card>
            );
          })}
          <T muted style={{ textAlign: 'center', fontSize: 13 }}>Chọn gói → quét QR chuyển khoản → tài khoản tự lên VIP, không cần nhập mã.</T>
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  perkIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  best: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.green },
  bestText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.white },
  price: { fontFamily: fonts.bold, fontSize: 24, color: colors.price },
  old: { fontFamily: fonts.body, fontSize: 14, color: colors.ink4, textDecorationLine: 'line-through' },
});
