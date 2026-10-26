import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { PlantThumb } from '@/components/PlantThumb';
import { ProductTile } from '@/components/shop';
import { Button, IconButton, Screen, SectionHead, tap } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { callName, formatDate, formatPrice, greeting, isVipOrder, shortOrderId, workshopDateParts } from '@/lib/format';
import { fetchProducts } from '@/lib/products';
import type { BlogPost, MyWorkshopRegistration, Order, PlantAlert, PlantCard, PublicWorkshop, RewardSummary } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme';

const art = (name: string) => imageSource(`/assets/images/sprouty-icons/${name}.png`) as number;
const go = (href: string) => () => { tap(); router.push(href as never); };

/** The four ways in, each saying what it is for; a tint of its own so the eye finds it again. */
const QUICK: Array<{ href: string; art: string; label: string; sub: string; tint: string; ink: string }> = [
  { href: '/garden?activate=1', art: 'RedeemCode', label: 'Kích hoạt cây', sub: 'Nhập mã trong bộ kit', tint: '#E8F5E3', ink: colors.greenDark },
  { href: '/ai', art: 'Tree', label: 'Plant Buddy', sub: 'Hỏi gì về cây cũng được', tint: '#E6F2F4', ink: '#2F6F78' },
  { href: '/workshop', art: 'Workshop', label: 'Workshop', sub: 'Lớp trồng cây cho bé', tint: '#F8EDE2', ink: colors.earth },
  { href: '/vip', art: 'VIP', label: 'VIP Garden', sub: 'Cảnh đẹp, AI không giới hạn', tint: '#FBF1D6', ink: '#8A6410' },
];

/** A bordered list; its rows carry their own dividers. */
function List({ children }: { children: ReactNode }) {
  return <View style={s.list}>{children}</View>;
}

/** A row in a List: something to look at on the left, the words, then a chevron. */
function Row({ lead, title, sub, extra, onPress, last, tone }: {
  lead: ReactNode; title: string; sub?: string; extra?: ReactNode; onPress: () => void; last?: boolean; tone?: 'warn';
}) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button"
      style={({ pressed }) => [s.row, tone === 'warn' && { backgroundColor: colors.warnSoft }, pressed && { opacity: 0.85 }]}>
      {lead}
      <View style={[s.rowBody, !last && s.divider]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={s.rowTitle}>{title}</Text>
          {sub ? <Text numberOfLines={2} style={s.rowSub}>{sub}</Text> : null}
          {extra}
        </View>
        <Icon name="arrow-right" size={16} color={colors.ink5} />
      </View>
    </Pressable>
  );
}

const RowIcon = ({ icon, color = colors.greenDark, bg = colors.greenSoft }: { icon: IconName; color?: string; bg?: string }) => (
  <View style={[s.rowIcon, { backgroundColor: bg }]}><Icon name={icon} size={20} color={color} /></View>
);

/** A plant at a glance: how it looks, its stage, its water, and what it needs. */
function PlantPeek({ plant, alert, width }: { plant: PlantCard; alert?: PlantAlert; width: number }) {
  const dead = Boolean(plant.diedAt);
  const state = plant.healthState.id;
  const health = dead || state === 'critical' || state === 'wilting' ? { bg: colors.badSoft, fg: colors.bad }
    : state === 'stressed' ? { bg: colors.warnSoft, fg: colors.warn }
    : { bg: colors.greenSoft, fg: colors.greenDark };
  return (
    <Pressable onPress={go(`/plant/${plant.id}`)} accessibilityRole="button"
      style={({ pressed }) => [s.peek, { width }, alert && !dead && { borderColor: '#F2C27A' }, pressed && { opacity: 0.9 }]}>
      <View style={[s.peekArt, { backgroundColor: plant.bgColor || '#F0FDF4' }]}>
        <PlantThumb plant={plant} size={96} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ gap: 1 }}>
          <Text numberOfLines={1} style={s.peekName}>{plant.nickname}</Text>
          <Text numberOfLines={1} style={s.peekStage}>{plant.speciesLabel} · {plant.stageLabel}</Text>
        </View>
        <View style={[s.pill, { backgroundColor: health.bg }]}>
          <Icon name="heart" size={12} color={health.fg} />
          <Text style={[s.pillText, { color: health.fg }]}>{plant.healthState.label}</Text>
        </View>
        {dead ? (
          <Text numberOfLines={2} style={[s.peekNote, { color: colors.bad }]}>Gieo lại miễn phí trong vườn</Text>
        ) : (
          <View style={s.meter}>
            <Icon name="water" size={13} color={colors.info} />
            <View style={s.meterTrack}><View style={[s.meterFill, { width: `${Math.round(plant.moisture)}%` }]} /></View>
            <Text style={s.meterValue}>{Math.round(plant.moisture)}%</Text>
          </View>
        )}
        {alert && !dead ? <Text numberOfLines={2} style={s.peekNote}>{alert.text}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * Trang chủ. For a family already growing something, the first thing on the
 * screen is their garden; then what is waiting on them (an unpaid order, a
 * workshop ticket, the free seat they are close to); then kits, sessions and
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
      API.blog.list({ limit: 3 }).catch(() => ({ posts: [] })),
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
  const quickCols = inner >= 600 ? 4 : 2;
  // Floored, so rounding never wraps a row.
  const quickW = Math.floor((inner - 10 * (quickCols - 1)) / quickCols);
  const plants = mine.data?.plants || [];
  const rewards = mine.data?.rewards && mine.data.rewards.threshold > 0 ? mine.data.rewards : null;
  const todo = [mine.data?.pending, mine.data?.ticket, rewards].filter(Boolean).length;

  // A slim bar stays on top; the greeting scrolls away with the page.
  const header = (
    <View style={s.head}>
      <View style={s.brand}>
        <Image source={imageSource('/assets/images/sprouty-mark.png') as number} style={{ width: 28, height: 28 }} contentFit="contain" />
        <Text style={s.brandText}>Sprouty</Text>
      </View>
      <IconButton icon="cart" label="Giỏ hàng" badge={count} onPress={() => router.push('/cart')} />
    </View>
  );

  return (
    <Screen header={header} onRefresh={() => Promise.all([shop.reload(), mine.reload()])}>
      <View style={{ gap: 2 }}>
        <Text style={s.hello}>{greeting()}{name ? `, ${name}` : ''}</Text>
        <Text style={s.headline}>{user ? 'Hôm nay vườn nhà mình thế nào?' : 'Gieo một hạt nhỏ, nuôi cả tuổi thơ'}</Text>
      </View>

      {!user && (
        <View style={s.hero}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.heroTitle}>Bé tự tay gieo hạt thật, chăm cây mỗi ngày</Text>
              <Text style={s.heroText}>Mỗi bộ kit có hạt giống, đất, chậu để trồng ở nhà và một cây lớn lên cùng bé trên Sprouty.</Text>
            </View>
            <Image source={art('Bean')} style={{ width: 76, height: 76 }} contentFit="contain" />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button small grow title="Tạo tài khoản" onPress={() => router.push('/register')} />
            <Button small grow variant="ghost" title="Đăng nhập" onPress={() => router.push('/login')} />
          </View>
        </View>
      )}

      {user && mine.data && (
        <View style={s.section}>
          <SectionHead title="Vườn của bé" more="Vào vườn" onMore={() => router.push('/garden')} />
          {plants.length === 0 ? (
            <List>
              <Row lead={<RowIcon icon="seed" />} title="Gieo cây đầu tiên của bé" sub="Có bộ kit rồi? Nhập mã kích hoạt để hạt nảy mầm ngay." onPress={() => router.push('/garden?activate=1')} last />
            </List>
          ) : plants.length === 1 ? (
            <PlantPeek plant={plants[0]} alert={mine.data.alerts.find((a) => a.plantId === plants[0].id)} width={inner} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hscroll} style={s.hscrollOuter}>
              {plants.map((p) => <PlantPeek key={p.id} plant={p} alert={mine.data!.alerts.find((a) => a.plantId === p.id)} width={Math.min(300, inner - 40)} />)}
            </ScrollView>
          )}
        </View>
      )}

      {/* Two by two on a phone, one row on a tablet; each card says what it opens. */}
      <View style={s.quick}>
        {QUICK.map((q) => (
          <Pressable key={q.href} onPress={go(q.href)} accessibilityRole="button" accessibilityLabel={`${q.label}: ${q.sub}`}
            style={({ pressed }) => [s.quickItem, { width: quickW }, pressed && { backgroundColor: q.tint, transform: [{ scale: 0.98 }] }]}>
            <View style={s.quickTop}>
              <View style={[s.quickArt, { backgroundColor: q.tint }]}>
                <Image source={art(q.art)} style={{ width: 32, height: 32 }} contentFit="contain" />
              </View>
              <Icon name="arrow-right" size={16} color={colors.ink5} />
            </View>
            <View style={{ gap: 2 }}>
              <Text numberOfLines={1} style={[s.quickLabel, { color: q.ink }]}>{q.label}</Text>
              <Text numberOfLines={2} style={s.quickSub}>{q.sub}</Text>
            </View>
          </Pressable>
        ))}
      </View>

      {todo > 0 && (
        <View style={s.section}>
          <Text style={s.label}>Đang chờ bạn</Text>
          <List>
            {mine.data?.pending && (
              <Row tone="warn" lead={<RowIcon icon="clock" color={colors.warn} bg="#FDEBC8" />}
                title={`Đơn #${shortOrderId(mine.data.pending.id)} chưa thanh toán`}
                sub={`${formatPrice(mine.data.pending.total)} · thanh toán xong là có mã gieo cây`}
                onPress={() => router.push(`/payment?orderId=${mine.data!.pending!.id}`)}
                last={!mine.data.ticket && !rewards} />
            )}
            {mine.data?.ticket && (() => {
              const t = mine.data!.ticket!;
              const d = workshopDateParts(t.workshop);
              return (
                <Row lead={<View style={s.cal}><Text style={s.calWd}>{d?.weekdayShort}</Text><Text style={s.calDay}>{d?.day}</Text></View>}
                  title={t.workshop.title} sub={`Vé của bé · ${d?.time ?? ''}`}
                  onPress={() => router.push('/workshop?tab=tickets')} last={!rewards} />
              );
            })()}
            {rewards && (
              <Row lead={<RowIcon icon="gift" color={colors.earth} bg={colors.earthSoft} />}
                title={rewards.availableCount > 0 ? `Bạn có ${rewards.availableCount} suất workshop miễn phí` : `Mua thêm ${rewards.unitsToNext} bộ kit, tặng 1 suất workshop`}
                sub={rewards.availableCount > 0 ? 'Dùng khi đăng ký một buổi cho bé' : `Ưu đãi mua ${rewards.threshold} tặng 1`}
                extra={(
                  <View style={s.dots}>
                    {Array.from({ length: rewards.threshold }, (_, i) => (
                      <View key={i} style={[s.dot, (rewards.availableCount > 0 || i < rewards.progressInCycle) && { backgroundColor: colors.earth }]} />
                    ))}
                  </View>
                )}
                onPress={() => router.push(rewards.availableCount > 0 ? '/workshop' : '/shop')} last />
            )}
          </List>
        </View>
      )}

      <View style={s.section}>
        <SectionHead title="Bộ kit cho bé" onMore={() => router.push('/shop')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hscroll} style={s.hscrollOuter}>
          {(shop.data?.kits || []).slice(0, 8).map((p) => <ProductTile key={p.id} product={p} width={164} />)}
        </ScrollView>
        {shop.error ? <Text style={s.rowSub}>{shop.error}</Text> : null}
      </View>

      {!!shop.data?.sessions.length && (
        <View style={s.section}>
          <SectionHead title="Workshop sắp tới" onMore={() => router.push('/workshop')} />
          <List>
            {shop.data.sessions.map((w, i, all) => {
              const d = workshopDateParts(w);
              const seats = w.isFull ? { t: 'Kín chỗ', c: colors.bad } : { t: `Còn ${w.seatsLeft} chỗ`, c: w.seatsLeft <= 3 ? colors.warn : colors.greenDark };
              return (
                <Row key={w.id} last={i === all.length - 1}
                  lead={<View style={s.cal}><Text style={s.calWd}>{d?.weekdayShort}</Text><Text style={s.calDay}>{d?.day}</Text></View>}
                  title={w.title}
                  sub={`${d?.time ?? ''}${w.ageRange ? ` · ${w.ageRange}` : ''}`}
                  extra={(
                    <Text style={s.sessionFoot}>
                      <Text style={{ color: colors.price }}>{w.price > 0 ? formatPrice(w.price) : 'Miễn phí'}</Text>
                      <Text style={{ color: colors.ink5 }}>{'  ·  '}</Text>
                      <Text style={{ color: seats.c }}>{seats.t}</Text>
                    </Text>
                  )}
                  onPress={() => router.push(`/workshop?session=${w.id}`)} />
              );
            })}
          </List>
        </View>
      )}

      {!!shop.data?.posts.length && (
        <View style={s.section}>
          <SectionHead title="Góc ba mẹ" onMore={() => router.push('/blog')} />
          <List>
            {shop.data.posts.map((post, i, all) => (
              <Row key={post.id} last={i === all.length - 1}
                lead={(
                  <View style={s.thumb}>
                    {imageSource(post.coverUrl)
                      ? <Image source={imageSource(post.coverUrl)} style={StyleSheet.absoluteFill} contentFit="cover" />
                      : <Icon name="book" size={20} color={colors.green} />}
                  </View>
                )}
                title={post.title}
                sub={formatDate(post.publishedAt || post.createdAt)}
                onPress={() => router.push(`/blog/${encodeURIComponent(post.slug)}`)} />
            ))}
          </List>
        </View>
      )}

      <View style={s.signoff}>
        <View style={s.signoffMark}>
          <View style={s.signoffLine} />
          <View style={s.signoffLeaf}><Icon name="leaf" size={16} color={colors.green} /></View>
          <View style={s.signoffLine} />
        </View>
        <Text style={s.signoffTitle}>Mỗi ngày một chút xanh</Text>
        <Text style={s.signoffText}>Cùng bé lớn lên với Sprouty</Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { height: 56, flexDirection: 'row', alignItems: 'center', paddingLeft: gutter, paddingRight: 8, width: '100%', maxWidth: maxWidth + 32, alignSelf: 'center' },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  brandText: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: colors.greenDark },
  hello: { fontFamily: fonts.semi, fontSize: 14, color: colors.earth },
  headline: { fontFamily: fonts.display, fontSize: 23, lineHeight: 29, color: colors.ink },
  section: { gap: 10 },
  label: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.ink4, marginLeft: 4 },

  hero: { gap: 14, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: '#D5EDCF', backgroundColor: colors.greenSoft },
  heroTitle: { fontFamily: fonts.display, fontSize: 19, lineHeight: 25, color: colors.ink },
  heroText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.ink3 },

  hscrollOuter: { marginHorizontal: -gutter },
  hscroll: { gap: 12, paddingHorizontal: gutter, paddingBottom: 4 },

  peek: { flexDirection: 'row', gap: 14, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  peekArt: { width: 96, height: 104, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  peekName: { fontFamily: fonts.display, fontSize: 18, lineHeight: 23, color: colors.ink },
  peekStage: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3 },
  peekNote: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.warn },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  pillText: { fontFamily: fonts.bold, fontSize: 11.5 },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meterTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E6EDF2', overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: '#5BA3D9', borderRadius: 3 },
  meterValue: { fontFamily: fonts.semi, fontSize: 12, color: colors.ink3, minWidth: 32, textAlign: 'right' },

  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quickItem: { gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  quickTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  quickArt: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontFamily: fonts.bold, fontSize: 14.5, lineHeight: 19 },
  quickSub: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: colors.ink3 },

  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 12, paddingTop: 12 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12, paddingBottom: 12, minHeight: 56 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink3 },
  rowIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 5, marginTop: 4 },
  dot: { width: 20, height: 6, borderRadius: 3, backgroundColor: '#E9DCCB' },
  cal: { width: 46, borderRadius: 12, borderWidth: 1, borderColor: '#CFE9C9', backgroundColor: colors.greenSoft, alignItems: 'center', paddingVertical: 5 },
  calWd: { fontFamily: fonts.bold, fontSize: 11, color: colors.green },
  calDay: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25, color: colors.ink },
  sessionFoot: { fontFamily: fonts.bold, fontSize: 13, marginTop: 2 },
  thumb: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },

  signoff: { alignItems: 'center', gap: 2, paddingTop: 8, paddingBottom: 12 },
  signoffMark: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  signoffLine: { width: 44, height: 1, backgroundColor: colors.line },
  signoffLeaf: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  signoffTitle: { fontFamily: fonts.display, fontSize: 17, lineHeight: 23, color: colors.greenDark },
  signoffText: { fontFamily: fonts.body, fontSize: 13, color: colors.ink4 },
});
