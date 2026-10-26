import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { ActionBar, Button, ErrorNote, Loading, Screen, tap } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { STORE_BUILD } from '@/lib/config';
import { daysLeft, formatDate, formatPrice, planLength, shortOrderId } from '@/lib/format';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, radius } from '@/theme';

interface Plan { id: number; name: string; description: string; price: number; oldPrice: number | null; images: string[]; badge: string | null; days: number }
interface Mine { isVip: boolean; vipUntil: string | null; vipExpired: boolean; pendingOrder: { id: string; total: number; planName: string | null } | null }

/** VIP's own warm tones, kept to this screen. */
const gold = { ink: '#9A5F0E', soft: '#FFF6E6', line: '#F1DAB0', deep: '#C98A1B' };

const PERKS: Array<{ icon: IconName; label: string }> = [
  { icon: 'shield', label: 'Bộ chăm tự động giữ cây không héo khô' },
  { icon: 'chat', label: 'Hỏi Plant Buddy AI không giới hạn' },
  { icon: 'album', label: 'Ảnh, video kỷ niệm không giới hạn' },
  { icon: 'pot', label: 'Chậu trang trí và khung cảnh vườn đặc biệt' },
  { icon: 'star', label: 'Huy hiệu VIP trên tài khoản' },
];

const STEPS = ['Chọn gói', 'Quét QR chuyển khoản', 'Tự lên VIP, không cần mã'];

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
  const [picked, setPicked] = useState<number | null>(null);
  const [buying, setBuying] = useState(false);

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
  // Until one is tapped, the best value is the one offered.
  const chosen = plans.find((p) => p.id === picked) ?? plans.find((p) => p.id === best) ?? plans[0];
  const selling = !STORE_BUILD && plans.length > 0;

  async function buy() {
    if (!chosen) return;
    if (!user) return router.push('/login?next=/vip');
    setBuying(true);
    try {
      const res = await API.membership.checkout(chosen.id);
      router.push(`/payment?orderId=${res.order.id}`);
    } catch (err: any) {
      toast(err?.message || 'Không tạo được đơn VIP. Vui lòng thử lại.', 'error');
    } finally {
      setBuying(false);
    }
  }

  const status = !user ? null
    : mine?.isVip ? { icon: 'star' as IconName, text: `Bạn là thành viên VIP · còn ${daysLeft(mine.vipUntil)} ngày`, side: `đến ${formatDate(mine.vipUntil)}`, vip: true }
    : mine?.vipExpired ? { icon: 'clock' as IconName, text: 'Gói VIP đã hết hạn', side: 'Cây và kỷ niệm vẫn còn', vip: false }
    : { icon: 'sprout' as IconName, text: 'Bạn đang dùng tài khoản thường', side: '', vip: false };

  return (
    <View style={{ flex: 1 }}>
      <Screen title="VIP Garden" back="/me" onRefresh={data.reload} bar={selling}>
        <View style={s.hero}>
          <View style={s.heroTop}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.kicker}>VIP GARDEN</Text>
              <Text style={s.heroTitle}>Thêm không gian cho cây kỷ niệm của bé</Text>
              <Text style={s.heroText}>Cây được trông khi bé bận, kỷ niệm lưu không giới hạn, hỏi Plant Buddy thoải mái.</Text>
            </View>
            <Image source={imageSource('/assets/images/sprouty-icons/VIP.png') as number} style={s.crown} contentFit="contain" />
          </View>
          {status && (
            <View style={[s.status, status.vip && { backgroundColor: '#FCE9C4' }]}>
              <Icon name={status.icon} size={16} color={status.vip ? gold.ink : colors.greenDark} />
              <Text style={[s.statusText, status.vip && { color: gold.ink }]}>{status.text}</Text>
              {status.side ? <Text style={[s.statusSide, status.vip && { color: gold.ink }]}>{status.side}</Text> : null}
            </View>
          )}
        </View>

        {!STORE_BUILD && mine?.pendingOrder && (
          <Pressable onPress={() => router.push(`/payment?orderId=${mine.pendingOrder!.id}`)} style={({ pressed }) => [s.pending, pressed && { opacity: 0.85 }]}>
            <Icon name="clock" size={18} color={colors.warn} />
            <View style={{ flex: 1 }}>
              <Text style={s.pendingTitle}>Đơn VIP #{shortOrderId(mine.pendingOrder.id)} chưa thanh toán</Text>
              <Text style={s.pendingText}>{formatPrice(mine.pendingOrder.total)} · bấm để thanh toán tiếp</Text>
            </View>
            <Icon name="arrow-right" size={16} color={colors.warn} />
          </Pressable>
        )}

        {data.error ? <ErrorNote message={data.error} onRetry={data.reload} /> : null}
        {data.loading && !data.data && <Loading />}

        {selling && (
          <View style={{ gap: 8 }}>
            <Text style={s.sectionTitle}>Chọn gói</Text>
            <View style={s.plans}>
              {plans.map((plan) => {
                const on = chosen?.id === plan.id;
                const monthly = perMonth(plan.price, plan.days);
                return (
                  <Pressable key={plan.id} onPress={() => { tap(); setPicked(plan.id); }} accessibilityRole="radio" accessibilityState={{ checked: on }}
                    style={[s.plan, on && s.planOn]}>
                    <View style={s.planHead}>
                      <Text style={[s.planLen, on && { color: gold.ink }]}>{planLength(plan.days)}</Text>
                      <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
                    </View>
                    <Text style={s.planPrice}>{formatPrice(plan.price)}</Text>
                    {plan.oldPrice ? <Text style={s.planOld}>{formatPrice(plan.oldPrice)}</Text> : null}
                    <Text style={s.planNote}>{monthly ? `khoảng ${formatPrice(monthly)}/tháng` : plan.name}</Text>
                    {plan.id === best && <View style={s.bestTag}><Text style={s.bestText}>Tiết kiệm nhất</Text></View>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ gap: 8 }}>
          <Text style={s.sectionTitle}>Gói nào cũng có</Text>
          <View style={s.list}>
            {PERKS.map((perk, i) => (
              <View key={perk.label} style={s.perk}>
                <View style={s.perkIcon}><Icon name={perk.icon} size={17} color={gold.ink} /></View>
                <Text style={[s.perkText, i < PERKS.length - 1 && s.perkDivider]}>{perk.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {STORE_BUILD ? (
          <Text style={s.foot}>Gói VIP Garden chưa bán trong ứng dụng. Quyền lợi VIP có sẵn trên tài khoản của bạn vẫn dùng được đầy đủ tại đây.</Text>
        ) : (
          <View style={s.steps}>
            {STEPS.map((step, i) => (
              <View key={step} style={s.step}>
                <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                <Text style={s.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        )}
      </Screen>

      {selling && chosen && (
        <ActionBar>
          <View style={{ flex: 1 }}>
            <Text style={s.barLabel}>Gói {planLength(chosen.days)}</Text>
            <Text style={s.barPrice}>{formatPrice(chosen.price)}</Text>
          </View>
          <Button grow busy={buying} icon="arrow-right"
            title={!user ? 'Đăng nhập để mua' : mine?.isVip ? 'Gia hạn VIP' : 'Nâng cấp VIP'} onPress={buy} />
        </ActionBar>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: radius.lg, borderWidth: 1, borderColor: gold.line, backgroundColor: gold.soft, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  kicker: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 1.2, color: gold.ink },
  heroTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: colors.ink },
  heroText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.ink3 },
  crown: { width: 84, height: 84 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.7)', borderTopWidth: 1, borderTopColor: gold.line },
  statusText: { flex: 1, fontFamily: fonts.semi, fontSize: 13.5, color: colors.greenDark },
  statusSide: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink3 },
  pending: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, borderWidth: 1, borderColor: '#F6DDB0', backgroundColor: colors.warnSoft },
  pendingTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  pendingText: { fontFamily: fonts.body, fontSize: 13, color: colors.warn },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.ink4, marginLeft: 4 },
  plans: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  plan: { flexGrow: 1, flexBasis: '40%', minHeight: 132, padding: 14, gap: 2, borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card },
  planOn: { borderColor: gold.deep, backgroundColor: gold.soft },
  planHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  planLen: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.ink5, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: gold.deep },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: gold.deep },
  planPrice: { fontFamily: fonts.bold, fontSize: 22, color: colors.price },
  planOld: { fontFamily: fonts.body, fontSize: 13, color: colors.ink4, textDecorationLine: 'line-through' },
  planNote: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink3, marginTop: 2 },
  bestTag: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.green },
  bestText: { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14 },
  perkIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: gold.soft, alignItems: 'center', justifyContent: 'center' },
  perkText: { flex: 1, paddingVertical: 14, paddingRight: 14, fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 20, color: colors.ink },
  perkDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  steps: { flexDirection: 'row', gap: 8 },
  step: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 6, borderRadius: radius.md, backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.line },
  stepNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  stepText: { fontFamily: fonts.semi, fontSize: 12.5, lineHeight: 17, color: colors.ink2, textAlign: 'center' },
  foot: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.ink3, textAlign: 'center' },
  barLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3 },
  barPrice: { fontFamily: fonts.bold, fontSize: 19, color: colors.price },
});
