import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { PlantArt } from '@/components/PlantArt';
import { ProductTile } from '@/components/shop';
import { Button, Card, H, IconButton, Screen, SectionHead, T } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { callName, formatPrice, formatWorkshopWhen, greeting, isVipOrder, shortOrderId } from '@/lib/format';
import { fetchProducts } from '@/lib/products';
import type { BlogPost, MyWorkshopRegistration, Order, PlantAlert, PlantCard, PublicWorkshop, RewardSummary } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme';

const art = (name: string) => imageSource(`/assets/images/sprouty-icons/${name}.png`) as number;

const QUICK: Array<{ href: string; art: string; label: string }> = [
  { href: '/garden?activate=1', art: 'RedeemCode', label: 'Kích hoạt cây' },
  { href: '/ai', art: 'Tree', label: 'Hỏi Plant Buddy' },
  { href: '/workshop', art: 'Workshop', label: 'Workshop' },
  { href: '/vip', art: 'VIP', label: 'VIP Garden' },
];

/** A plant in the "Vườn của bé" row: how it is doing, at a glance. */
function PlantPeek({ plant, alert }: { plant: PlantCard; alert?: PlantAlert }) {
  return (
    <Pressable onPress={() => router.push(`/plant/${plant.id}`)} style={[s.peek, alert && { borderColor: '#F2C27A' }]}>
      <View style={[s.peekArt, { backgroundColor: plant.bgColor || '#F0FDF4' }]}>
        <PlantArt stage={plant.stage} progress={plant.stageProgress} health={plant.health} form={plant.form}
          fruitShape={plant.fruitShape} fruitColor={plant.fruitColor} flowerColor={plant.flowerColor} size={104} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={1} style={s.peekName}>{plant.nickname}</Text>
        <Text style={s.small}>{plant.stageLabel} · {plant.healthState.label}</Text>
        <View style={s.meter}>
          <Icon name="water" size={14} color={colors.info} />
          <View style={s.meterTrack}><View style={[s.meterFill, { width: `${Math.round(plant.moisture)}%` }]} /></View>
        </View>
        {alert && <Text numberOfLines={2} style={s.alert}>{alert.text}</Text>}
      </View>
    </Pressable>
  );
}

function Callout({ icon, title, text, tone, onPress }: { icon: IconName; title: string; text: string; tone?: 'warn' | 'info'; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.callout, tone === 'warn' && { backgroundColor: colors.warnSoft, borderColor: '#F6DDB0' }]}>
      <View style={[s.calloutIcon, tone === 'warn' && { backgroundColor: '#FDEBC8' }, tone === 'info' && { backgroundColor: colors.infoSoft }]}>
        <Icon name={icon} size={22} color={tone === 'warn' ? colors.warn : tone === 'info' ? colors.info : colors.greenDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.calloutTitle}>{title}</Text>
        <Text style={s.small}>{text}</Text>
      </View>
      <Icon name="arrow-right" size={20} color={colors.ink3} />
    </Pressable>
  );
}

/**
 * Trang chủ. For a family already growing something, the first thing on the
 * screen is their garden and what it needs today; then whatever is waiting
 * on them (an unpaid order, a workshop ticket); then the shop and reading. A
 * visitor sees what Sprouty is and two ways in.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
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
      sessions: ((workshops.workshops || []) as PublicWorkshop[]).filter((w) => w.upcoming && w.bookable !== false).slice(0, 3),
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
  const header = (
    <View style={[s.head, { paddingTop: 10 }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.hello}>{greeting()}{name ? `, ${name}` : ''}!</Text>
        <H size={24}>{user ? 'Hôm nay vườn nhà mình thế nào?' : 'Gieo một hạt nhỏ, nuôi cả tuổi thơ'}</H>
      </View>
      <IconButton icon="plant-chat" label="Hỏi Plant Buddy" onPress={() => router.push('/ai')} />
      <IconButton icon="cart" label="Giỏ hàng" badge={count} onPress={() => router.push('/cart')} />
    </View>
  );

  return (
    <Screen header={header} onRefresh={() => Promise.all([shop.reload(), mine.reload()])}>
      {!user && (
        <Card tone="soft">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1, gap: 10 }}>
              <H size={19}>Bé tự tay gieo hạt thật, chăm cây 3D mỗi ngày</H>
              <T muted>Mỗi bộ kit có hạt giống, đất, chậu để trồng ở nhà và một cây ảo lớn lên cùng bé trên Sprouty.</T>
            </View>
            <Image source={art('Bean')} style={{ width: 80, height: 80 }} contentFit="contain" />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small grow title="Tạo tài khoản" onPress={() => router.push('/register')} />
            <Button small grow variant="ghost" title="Đăng nhập" onPress={() => router.push('/login')} />
          </View>
        </Card>
      )}

      {user && mine.data && (
        <View style={{ gap: 10 }}>
          <SectionHead title="Vườn của bé" more="Vào vườn" onMore={() => router.push('/garden')} />
          {mine.data.plants.length === 0 ? (
            <Callout icon="seed" title="Gieo cây đầu tiên của bé" text="Có bộ kit rồi? Nhập mã kích hoạt để cây 3D nảy mầm ngay." onPress={() => router.push('/garden?activate=1')} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hscroll} style={s.hscrollOuter}>
              {mine.data.plants.map((p) => <PlantPeek key={p.id} plant={p} alert={mine.data!.alerts.find((a) => a.plantId === p.id)} />)}
            </ScrollView>
          )}
        </View>
      )}

      <View style={s.quick}>
        {QUICK.map((q) => (
          <Pressable key={q.href} onPress={() => router.push(q.href as never)} style={({ pressed }) => [s.quickItem, pressed && { backgroundColor: colors.greenSoft }]}>
            <Image source={art(q.art)} style={{ width: 46, height: 46 }} contentFit="contain" />
            <Text style={s.quickLabel}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      {mine.data?.pending && (
        <Callout tone="warn" icon="clock" title={`Đơn #${shortOrderId(mine.data.pending.id)} đang chờ thanh toán`}
          text={`${formatPrice(mine.data.pending.total)} · thanh toán xong là có mã kích hoạt cây`}
          onPress={() => router.push(`/payment?orderId=${mine.data!.pending!.id}`)} />
      )}
      {mine.data?.ticket && (
        <Callout tone="info" icon="ticket" title={mine.data.ticket.workshop.title}
          text={`${formatWorkshopWhen(mine.data.ticket.workshop)} · vé ${mine.data.ticket.ticket}`}
          onPress={() => router.push('/workshop?tab=tickets')} />
      )}
      {mine.data?.rewards && mine.data.rewards.threshold > 0 && (
        <View style={s.reward}>
          <Icon name="gift" size={22} color={colors.earth} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={s.calloutTitle}>
              {mine.data.rewards.availableCount > 0 ? `Bạn có ${mine.data.rewards.availableCount} suất workshop miễn phí` : `Mua thêm ${mine.data.rewards.unitsToNext} bộ kit, tặng 1 suất workshop`}
            </Text>
            <Text style={s.small}>{mine.data.rewards.availableCount > 0 ? 'Dùng khi đăng ký một buổi workshop cho bé.' : `Ưu đãi mua ${mine.data.rewards.threshold} tặng 1 của Sprouty.`}</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              {Array.from({ length: mine.data.rewards.threshold }, (_, i) => (
                <View key={i} style={[s.dot, i < mine.data!.rewards!.progressInCycle && { backgroundColor: colors.earth }]} />
              ))}
            </View>
          </View>
        </View>
      )}

      <View style={{ gap: 10 }}>
        <SectionHead title="Bộ kit cho bé" onMore={() => router.push('/shop')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hscroll} style={s.hscrollOuter}>
          {(shop.data?.kits || []).slice(0, 8).map((p) => <ProductTile key={p.id} product={p} width={168} />)}
        </ScrollView>
        {shop.error ? <T muted>{shop.error}</T> : null}
      </View>

      {!!shop.data?.sessions.length && (
        <View style={{ gap: 10 }}>
          <SectionHead title="Workshop sắp tới" onMore={() => router.push('/workshop')} />
          {shop.data.sessions.map((w) => (
            <Pressable key={w.id} onPress={() => router.push(`/workshop?session=${w.id}`)} style={s.rowCard}>
              {w.imageUrl ? <Image source={imageSource(w.imageUrl)} style={s.rowImg} contentFit="cover" />
                : <View style={[s.rowImg, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft }]}><Icon name="ticket" size={24} color={colors.greenDark} /></View>}
              <View style={{ flex: 1, gap: 3 }}>
                <Text numberOfLines={2} style={s.calloutTitle}>{w.title}</Text>
                <Text style={s.small}>{formatWorkshopWhen(w)}</Text>
                <Text style={[s.small, w.isFull ? { color: colors.bad } : w.seatsLeft <= 3 ? { color: colors.warn } : null]}>
                  {w.isFull ? 'Đã kín chỗ' : `Còn ${w.seatsLeft} chỗ`} · {w.price > 0 ? formatPrice(w.price) : 'Miễn phí'}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      {!!shop.data?.posts.length && (
        <View style={{ gap: 10 }}>
          <SectionHead title="Góc ba mẹ" onMore={() => router.push('/blog')} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.hscroll} style={s.hscrollOuter}>
            {shop.data.posts.map((post) => (
              <Pressable key={post.id} onPress={() => router.push(`/blog/${encodeURIComponent(post.slug)}`)} style={{ width: 220, gap: 6 }}>
                <View style={s.postImg}>
                  {post.coverUrl ? <Image source={imageSource(post.coverUrl)} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="book" size={30} color={colors.greenDark} />}
                </View>
                <Text numberOfLines={2} style={s.calloutTitle}>{post.title}</Text>
                {post.excerpt ? <Text numberOfLines={2} style={s.small}>{post.excerpt}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={[{ flexDirection: 'row', justifyContent: 'center', gap: 6, paddingBottom: insets.bottom ? 0 : 8 }]}>
        <Icon name="leaf" size={16} color={colors.green} />
        <T muted>Mỗi ngày một chút xanh — cùng bé lớn lên với Sprouty.</T>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: gutter, paddingBottom: 6, width: '100%', maxWidth: maxWidth + 32, alignSelf: 'center' },
  hello: { fontFamily: fonts.semi, fontSize: 15, color: colors.earth },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink3 },
  hscrollOuter: { marginHorizontal: -gutter },
  hscroll: { gap: 12, paddingHorizontal: gutter, paddingBottom: 4 },
  peek: { width: 270, flexDirection: 'row', gap: 12, padding: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  peekArt: { width: 92, height: 104, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  peekName: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  meter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meterTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: '#E8EEF3', overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: '#5BA3D9', borderRadius: 4 },
  alert: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.warn },
  quick: { flexDirection: 'row', gap: 8 },
  quickItem: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  quickLabel: { fontFamily: fonts.bold, fontSize: 12.5, lineHeight: 16, color: colors.ink, textAlign: 'center' },
  callout: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  calloutIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenSoft },
  calloutTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink },
  reward: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.earthSoft },
  dot: { width: 22, height: 8, borderRadius: 4, backgroundColor: '#E9DCCB' },
  rowCard: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  rowImg: { width: 76, height: 76, borderRadius: 14 },
  postImg: { height: 124, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
});
