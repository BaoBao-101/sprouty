import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { PlantThumb } from '@/components/PlantThumb';
import { ProductTile } from '@/components/shop';
import { Button, Group, IconButton, IconTile, Label, ListRow, Meter, Press, Screen, SectionHead } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { alertBrief, callName, formatDate, formatPrice, greeting, isVipOrder, shortOrderId, workshopDateParts } from '@/lib/format';
import { fetchProducts } from '@/lib/products';
import type { BlogPost, MyWorkshopRegistration, Order, PlantAlert, PlantCard, PublicWorkshop, RewardSummary } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, gutter, maxWidth, radius, surface } from '@/theme';

const go = (href: string) => () => router.push(href as never);

/** Kits on Home: a few to tempt, not the whole shop. */
const KITS_SHOWN = 4;

/** The four ways in: an icon and two words each; the colour tells them apart at a glance. */
const QUICK: Array<{ href: string; icon: IconName; label: string; tint: string; ink: string }> = [
  { href: '/garden?activate=1', icon: 'seed', label: 'Kích hoạt', tint: colors.mint, ink: colors.greenDark },
  { href: '/ai', icon: 'chat', label: 'Plant Buddy', tint: '#DCEFF1', ink: '#2F6F78' },
  { href: '/workshop', icon: 'ticket', label: 'Workshop', tint: '#F6E6D6', ink: colors.earth },
  { href: '/vip', icon: 'star', label: 'VIP Garden', tint: '#FBEBC4', ink: colors.gold },
];

/** How a plant is doing, as a colour pair. */
function healthTone(plant: PlantCard) {
  const state = plant.healthState.id;
  if (plant.diedAt || state === 'critical' || state === 'wilting') return { bg: colors.badSoft, fg: colors.bad };
  if (state === 'stressed') return { bg: colors.warnSoft, fg: colors.warn };
  return { bg: colors.mint, fg: colors.greenDark };
}

/** A plant at a glance: the picture, its name, how it is, and what it needs — as a tag, not a sentence. */
function PlantPeek({ plant, alert, width }: { plant: PlantCard; alert?: PlantAlert; width: number }) {
  const dead = Boolean(plant.diedAt);
  const tone = healthTone(plant);
  const need = dead ? { icon: 'seed' as const, label: 'Gieo lại' } : alert ? alertBrief(alert.text) : null;
  return (
    <Press onPress={go(`/plant/${plant.id}`)} accessibilityLabel={`${plant.nickname}, ${plant.healthState.label}${need ? `, ${need.label}` : ''}`}
      style={[s.peek, { width }]}>
      <View style={[s.peekArt, { backgroundColor: plant.bgColor || '#F0FDF4' }]}>
        <PlantThumb plant={plant} size={width - 12} />
        <View style={[s.health, { backgroundColor: tone.bg }]}>
          <Icon name="heart" size={11} color={tone.fg} />
          <Text style={[s.healthText, { color: tone.fg }]}>{dead ? 'Đã héo' : plant.healthState.label}</Text>
        </View>
      </View>
      <View style={s.peekBody}>
        <Text numberOfLines={1} style={s.peekName}>{plant.nickname}</Text>
        <Text numberOfLines={1} style={s.peekStage}>{plant.stageLabel} · {Math.round(plant.stageProgress)}%</Text>
        {need ? (
          <View style={[s.need, dead && { backgroundColor: colors.badSoft }]}>
            <Icon name={need.icon} size={13} color={dead ? colors.bad : colors.warn} />
            <Text numberOfLines={1} style={[s.needText, dead && { color: colors.bad }]}>{need.label}</Text>
          </View>
        ) : (
          <View style={s.water}>
            <Icon name="water" size={13} color={colors.sky} />
            <Meter value={plant.moisture} color={colors.sky} height={5} style={{ flex: 1 }} />
          </View>
        )}
      </View>
    </Press>
  );
}

/** A day of the month, like a page torn off a calendar. */
function CalDay({ weekday, day }: { weekday?: string; day?: string | number }) {
  return (
    <View style={s.cal}>
      <Text style={s.calWd}>{weekday}</Text>
      <Text style={s.calDay}>{day}</Text>
    </View>
  );
}

/**
 * Trang chủ. For a family already growing something, the first thing on the
 * screen is their garden in a green panel with the day's numbers, then the
 * plants themselves; then what is waiting on them, then kits, sessions and
 * reading. A visitor sees what Sprouty is and two ways in.
 */
export default function Home() {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { count } = useCart();

  const shop = useLoad(async () => {
    const [products, workshops, blog] = await Promise.all([
      fetchProducts(),
      API.workshops.list().catch(() => ({ workshops: [] })),
      API.blog.list({ limit: 4 }).catch(() => ({ posts: [] })),
    ]);
    return {
      kits: products.filter((p) => p.cat === 'kit').sort((a, b) => Number(b.badge === 'hot') - Number(a.badge === 'hot')),
      sessions: ((workshops.workshops || []) as PublicWorkshop[])
        .filter((w) => w.upcoming && w.bookable !== false)
        .sort((a, b) => +new Date(a.dateTime) - +new Date(b.dateTime))
        .slice(0, 3),
      posts: (blog.posts || []) as BlogPost[],
    };
  });

  const mine = useLoad(async () => {
    if (!user) return null;
    const [plants, pending, bookings, rewards] = await Promise.all([
      API.plants.list().catch(() => ({ plants: [], alerts: [] })),
      API.orders.list({ status: 'pending', limit: 5 }).catch(() => ({ orders: [] })),
      API.workshops.mine().catch(() => ({ registrations: [] })),
      API.rewards.mine().catch(() => null),
    ]);
    const soon = ((bookings.registrations || []) as MyWorkshopRegistration[])
      .filter((r) => r.upcoming && r.status !== 'cancelled' && r.workshop.status !== 'cancelled')
      .sort((a, b) => +new Date(a.workshop.dateTime) - +new Date(b.workshop.dateTime));
    return {
      plants: ((plants.plants || []) as PlantCard[]).filter((p) => !p.harvestedAt),
      alerts: (plants.alerts || []) as PlantAlert[],
      pending: ((pending.orders || []) as Order[]).find((o) => !isVipOrder(o)) || null,
      ticket: soon[0] || null,
      rewards: rewards as RewardSummary | null,
    };
  }, [user?.id]);

  const name = callName(user?.name);
  const inner = Math.min(width, maxWidth) - gutter * 2;
  const plants = mine.data?.plants || [];
  const alerts = mine.data?.alerts || [];
  // Plants with something to do come first.
  const ordered = [...plants].sort((a, b) => Number(Boolean(b.diedAt) || alerts.some((x) => x.plantId === b.id)) - Number(Boolean(a.diedAt) || alerts.some((x) => x.plantId === a.id)));
  const needCare = plants.filter((p) => p.diedAt || alerts.some((a) => a.plantId === p.id)).length;
  const streak = Math.max(0, ...plants.map((p) => p.careStreak));
  const rewards = mine.data?.rewards && mine.data.rewards.threshold > 0 ? mine.data.rewards : null;
  const todo = [mine.data?.pending, mine.data?.ticket, rewards].filter(Boolean).length;
  const kits = shop.data?.kits || [];
  const peekW = inner >= 600 ? 180 : 152;
  const quickW = Math.floor((inner - 8 * 3) / 4);

  // A slim bar stays on top; the greeting scrolls away with the page.
  const header = (
    <View style={s.head}>
      <View style={s.brand}>
        <Image source={imageSource('/assets/images/sprouty-mark.png') as number} style={{ width: 30, height: 30 }} contentFit="contain" />
        <Text style={s.brandText}>Sprouty</Text>
      </View>
      <IconButton icon="cart" label="Giỏ hàng" boxed badge={count} onPress={() => router.push('/cart')} />
    </View>
  );

  return (
    <Screen header={header} onRefresh={() => Promise.all([shop.reload(), mine.reload()])}>
      {/* The day, in a green panel: hello, and the garden in three numbers */}
      <View style={s.hero}>
        <View pointerEvents="none" style={s.heroLeaf}><Icon name="sprout" size={150} color="rgba(255,255,255,0.07)" /></View>
        <Text style={s.hello}>{greeting()}{name ? `, ${name}` : ''}</Text>
        <Text style={s.headline}>{user ? 'Vườn của bé hôm nay' : 'Gieo một hạt nhỏ,\nnuôi cả tuổi thơ'}</Text>
        {user && plants.length > 0 && (
          <View style={s.heroStats}>
            <View style={s.heroStat}>
              <Text style={s.heroNum}>{plants.length}</Text>
              <Text style={s.heroLabel}>cây đang lớn</Text>
            </View>
            <View style={s.heroRule} />
            <View style={s.heroStat}>
              <Text style={[s.heroNum, needCare > 0 && { color: '#FFC266' }]}>{needCare}</Text>
              <Text style={s.heroLabel}>cần chăm</Text>
            </View>
            <View style={s.heroRule} />
            <View style={s.heroStat}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                <Icon name="bolt" size={16} color="#FFC266" />
                <Text style={s.heroNum}>{streak}</Text>
              </View>
              <Text style={s.heroLabel}>ngày liên tục</Text>
            </View>
          </View>
        )}
        {user && mine.data && plants.length === 0 && (
          <Button small variant="light" icon="seed" title="Gieo cây đầu tiên" style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={go('/garden?activate=1')} />
        )}
        {!user && (
          <>
            <Text style={s.heroText}>Hạt giống thật trong hộp, cây 3D lớn lên cùng bé trong app.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Button small grow variant="light" title="Tạo tài khoản" onPress={go('/register')} />
              <Button small grow title="Đăng nhập" style={s.heroGhost} onPress={go('/login')} />
            </View>
          </>
        )}
      </View>

      {/* Two words and an icon each */}
      <View style={s.quick}>
        {QUICK.map((q) => (
          <Press key={q.href} onPress={go(q.href)} accessibilityLabel={q.label} scaleTo={0.92} style={[s.quickItem, { width: quickW }]}>
            <IconTile icon={q.icon} size={54} tint={q.tint} color={q.ink} />
            <Text numberOfLines={1} style={s.quickLabel}>{q.label}</Text>
          </Press>
        ))}
      </View>

      {user && plants.length > 0 && (
        <View style={s.section}>
          <SectionHead title="Cây của bé" more="Vào vườn" onMore={go('/garden')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hscroll} style={s.hscrollOuter}>
            {ordered.map((p) => <PlantPeek key={p.id} plant={p} alert={alerts.find((a) => a.plantId === p.id)} width={peekW} />)}
          </ScrollView>
        </View>
      )}

      {todo > 0 && (
        <View style={s.section}>
          <Label>Đang chờ bạn</Label>
          <Group>
            {mine.data?.pending && (
              <ListRow tone="warn" icon="clock" tint="#FDE5BC" iconColor={colors.warn}
                title={`Đơn #${shortOrderId(mine.data.pending.id)} chưa thanh toán`}
                sub={formatPrice(mine.data.pending.total)}
                onPress={go(`/payment?orderId=${mine.data.pending.id}`)}
                last={!mine.data.ticket && !rewards} />
            )}
            {mine.data?.ticket && (() => {
              const t = mine.data!.ticket!;
              const d = workshopDateParts(t.workshop);
              return (
                <ListRow lead={<CalDay weekday={d?.weekdayShort} day={d?.day} />}
                  title={t.workshop.title} sub={`Vé của bé · ${d?.time ?? ''}`}
                  onPress={go('/workshop?tab=tickets')} last={!rewards} />
              );
            })()}
            {rewards && (
              <ListRow icon="gift" tint={colors.earthSoft} iconColor={colors.earth}
                title={rewards.availableCount > 0 ? `${rewards.availableCount} suất workshop miễn phí` : `Mua thêm ${rewards.unitsToNext} kit, tặng 1 suất`}
                extra={(
                  <View style={s.dots}>
                    {Array.from({ length: rewards.threshold }, (_, i) => (
                      <View key={i} style={[s.dot, (rewards.availableCount > 0 || i < rewards.progressInCycle) && { backgroundColor: colors.earth }]} />
                    ))}
                  </View>
                )}
                onPress={go(rewards.availableCount > 0 ? '/workshop' : '/shop')} last />
            )}
          </Group>
        </View>
      )}

      <View style={s.section}>
        <SectionHead title="Bộ kit cho bé" onMore={go('/shop')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hscroll} style={s.hscrollOuter}>
          {/* A taste of the shop, best sellers first; the rest is one tap away. */}
          {kits.slice(0, KITS_SHOWN).map((p) => <ProductTile key={p.id} product={p} width={164} />)}
          {kits.length > KITS_SHOWN && (
            <Press onPress={go('/shop')} accessibilityLabel={`Xem thêm ${kits.length - KITS_SHOWN} bộ kit trong cửa hàng`} style={s.moreKits}>
              <View style={s.moreKitsIcon}><Icon name="arrow-right" size={22} color={colors.white} /></View>
              <Text style={s.moreKitsText}>Xem thêm{'\n'}{kits.length - KITS_SHOWN} bộ kit</Text>
            </Press>
          )}
        </ScrollView>
        {shop.error ? <Text style={s.error}>{shop.error}</Text> : null}
      </View>

      {!!shop.data?.sessions.length && (
        <View style={s.section}>
          <SectionHead title="Workshop sắp tới" onMore={go('/workshop')} />
          <Group>
            {shop.data.sessions.map((w, i, all) => {
              const d = workshopDateParts(w);
              const full = w.isFull;
              return (
                <ListRow key={w.id} last={i === all.length - 1}
                  lead={<CalDay weekday={d?.weekdayShort} day={d?.day} />}
                  title={w.title}
                  extra={(
                    <View style={s.sessionFoot}>
                      <Text style={s.sessionTime}>{d?.time}</Text>
                      <Text style={s.sessionPrice}>{w.price > 0 ? formatPrice(w.price) : 'Miễn phí'}</Text>
                      <Text style={[s.sessionSeats, full ? { color: colors.bad } : w.seatsLeft <= 3 && { color: colors.warn }]}>
                        {full ? 'Kín chỗ' : `${w.seatsLeft} chỗ`}
                      </Text>
                    </View>
                  )}
                  onPress={go(`/workshop?session=${w.id}`)} />
              );
            })}
          </Group>
        </View>
      )}

      {!!shop.data?.posts.length && (
        <View style={s.section}>
          <SectionHead title="Góc ba mẹ" onMore={go('/blog')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hscroll} style={s.hscrollOuter}>
            {shop.data.posts.map((post) => (
              <Press key={post.id} onPress={go(`/blog/${encodeURIComponent(post.slug)}`)} accessibilityLabel={post.title} style={s.post}>
                <View style={s.postCover}>
                  {imageSource(post.coverUrl)
                    ? <Image source={imageSource(post.coverUrl)} style={StyleSheet.absoluteFill} contentFit="cover" />
                    : <Icon name="book" size={28} color={colors.green} />}
                </View>
                <View style={{ padding: 12, gap: 4 }}>
                  <Text numberOfLines={2} style={s.postTitle}>{post.title}</Text>
                  <Text style={s.postDate}>{formatDate(post.publishedAt || post.createdAt)}</Text>
                </View>
              </Press>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={s.signoff}>
        <View style={s.signoffMark}>
          <View style={s.signoffLine} />
          <Icon name="leaf" size={18} color={colors.green} />
          <View style={s.signoffLine} />
        </View>
        <Text style={s.signoffTitle}>Mỗi ngày một chút xanh</Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { height: 60, flexDirection: 'row', alignItems: 'center', paddingLeft: gutter, paddingRight: 12, width: '100%', maxWidth: maxWidth + 32, alignSelf: 'center' },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontFamily: fonts.display, fontSize: 23, lineHeight: 30, color: colors.greenDark },
  section: { gap: 10 },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.ink3 },

  hero: { gap: 2, padding: 20, borderRadius: radius.xl, backgroundColor: colors.forest, overflow: 'hidden' },
  heroLeaf: { position: 'absolute', right: -24, bottom: -30 },
  hello: { fontFamily: fonts.semi, fontSize: 14, color: '#B9DDB0' },
  headline: { fontFamily: fonts.display, fontSize: 25, lineHeight: 32, color: colors.white },
  heroText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: '#D5E9CF', marginTop: 4 },
  heroGhost: { backgroundColor: 'rgba(255,255,255,0.14)', shadowOpacity: 0, elevation: 0 },
  heroStats: { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingVertical: 12, paddingHorizontal: 6, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.09)' },
  heroStat: { flex: 1, alignItems: 'center', gap: 1 },
  heroNum: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.white },
  heroLabel: { fontFamily: fonts.medium, fontSize: 12, color: '#C6E2BF' },
  heroRule: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.14)' },

  quick: { flexDirection: 'row', justifyContent: 'space-between' },
  quickItem: { alignItems: 'center', gap: 7 },
  quickLabel: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.ink2, textAlign: 'center' },

  hscrollOuter: { marginHorizontal: -gutter },
  hscroll: { gap: 12, paddingHorizontal: gutter, paddingTop: 2, paddingBottom: 10 },

  peek: { ...surface, padding: 6 },
  peekArt: { aspectRatio: 1, borderRadius: radius.md, overflow: 'hidden' },
  health: { position: 'absolute', top: 7, left: 7, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill },
  healthText: { fontFamily: fonts.bold, fontSize: 11 },
  peekBody: { paddingHorizontal: 6, paddingTop: 9, paddingBottom: 6, gap: 3 },
  peekName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  peekStage: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink3 },
  need: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%', marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.warnSoft },
  needText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 11.5, color: colors.warn },
  water: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7, minHeight: 18 },

  dots: { flexDirection: 'row', gap: 5, marginTop: 5 },
  dot: { width: 22, height: 6, borderRadius: 3, backgroundColor: '#EADFD0' },
  cal: { width: 44, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', paddingVertical: 5 },
  calWd: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.green },
  calDay: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23, color: colors.ink },
  sessionFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  sessionTime: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink3 },
  sessionPrice: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.price },
  sessionSeats: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.greenDark },

  moreKits: { width: 120, alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: radius.lg, backgroundColor: colors.mint },
  moreKitsIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  moreKitsText: { fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 19, color: colors.greenDark, textAlign: 'center' },
  post: { ...surface, width: 220 },
  postCover: { height: 120, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  postTitle: { fontFamily: fonts.bold, fontSize: 14, lineHeight: 19, color: colors.ink, minHeight: 38 },
  postDate: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink4 },

  signoff: { alignItems: 'center', gap: 4, paddingTop: 6, paddingBottom: 18 },
  signoffMark: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  signoffLine: { width: 44, height: 1, backgroundColor: colors.line },
  signoffTitle: { fontFamily: fonts.displaySemi, fontSize: 15, lineHeight: 21, color: colors.ink4 },
});
