import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { ProductVideos } from '@/components/media';
import { ProductTile, Stars } from '@/components/shop';
import { useToast } from '@/components/Toast';
import { ActionBar, Button, Card, CardTitle, Empty, H, IconButton, Loading, Screen, Stepper, T, tap } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { webUrl } from '@/lib/config';
import { formatDate, formatPrice } from '@/lib/format';
import { BADGE_LABEL, fetchProducts, normalizeProduct } from '@/lib/products';
import type { Product, Review } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme';

type Tab = 'info' | 'videos' | 'reviews';
const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/** Photos the width of the screen, swiped sideways, with dots under them. */
function Gallery({ product }: { product: Product }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width, maxWidth + 32);
  const [index, setIndex] = useState(0);
  const images = product.images.length ? product.images : [''];
  return (
    <View style={{ marginHorizontal: -gutter, backgroundColor: product.bg }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / w))}>
        {images.map((src, i) => (
          <View key={i} style={{ width: w, height: Math.min(w * 0.75, 460), alignItems: 'center', justifyContent: 'center' }}>
            {imageSource(src) ? <Image source={imageSource(src)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              : <Icon name="sprout" size={48} color={colors.greenDark} />}
          </View>
        ))}
      </ScrollView>
      {images.length > 1 && (
        <View style={s.dots}>{images.map((_, i) => <View key={i} style={[s.dot, i === index && s.dotOn]} />)}</View>
      )}
      {product.badge && <View style={s.badge}><Text style={s.badgeText}>{BADGE_LABEL[product.badge]}</Text></View>}
    </View>
  );
}

/**
 * One kit: photos, the price, Standard or Smart, the four facts a parent
 * checks, what is in the box; videos and reviews a tab away. The price and
 * the buttons stay pinned to the bottom, in reach of a thumb.
 */
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { add, count } = useCart();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [variant, setVariant] = useState<'standard' | 'smart'>('standard');
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<Tab>('info');

  const data = useLoad(async () => {
    const [detail, all] = await Promise.all([API.products.get(id), fetchProducts().catch(() => [] as Product[])]);
    const product = normalizeProduct(detail.product);
    return { product, related: all.filter((p) => p.id !== product.id && p.cat === product.cat).slice(0, 6) };
  }, [id]);
  const reviews = useLoad(async () => API.products.reviews(id, { limit: 10 }), [id]);

  if (!data.data) {
    return (
      <Screen title="Bộ kit" back="/shop">
        {data.loading ? <Loading /> : <Empty icon="warning" title="Chưa tải được sản phẩm" text={data.error}><Button title="Về cửa hàng" onPress={() => router.replace('/shop')} /></Empty>}
      </Screen>
    );
  }

  const { product, related } = data.data;
  const hasSmart = product.smartDelta != null;
  const price = variant === 'smart' && hasSmart ? product.price + (product.smartDelta || 0) : product.price;
  const discount = product.old ? Math.round((1 - product.price / product.old) * 100) : 0;

  function addToCart(go?: boolean) {
    add(product, qty, hasSmart ? variant : 'standard');
    toast(`Đã thêm "${product.name}"${variant === 'smart' ? ' (Smart)' : ''} vào giỏ`, 'success');
    if (go) router.push('/cart');
  }

  const facts: Array<{ icon: IconName; label: string; value: string }> = [
    { icon: 'child', label: 'Độ tuổi', value: product.age || '—' },
    ...(product.species ? [
      { icon: 'sprout' as IconName, label: 'Giống cây', value: product.species.label },
      { icon: 'harvest' as IconName, label: 'Thu hoạch', value: cap(product.species.harvest) },
    ] : []),
    { icon: 'bolt', label: 'Kích hoạt', value: 'Ngay khi thanh toán' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <Screen title={product.name} back="/shop" bar onRefresh={data.reload}
        actions={<>
          <IconButton icon="share" label="Chia sẻ" onPress={() => Share.share({ message: `${product.name} — bộ kit trồng cây cho bé: ${webUrl(`/shop/${product.id}`)}` })} />
          <IconButton icon="cart" label="Giỏ hàng" badge={count} onPress={() => router.push('/cart')} />
        </>}>
        <Gallery product={product} />

        <View style={{ gap: 6 }}>
          <Text style={s.kicker}>{[product.col, product.species?.label].filter(Boolean).join(' · ').toUpperCase()}</Text>
          <H size={24}>{product.name}</H>
          <Pressable onPress={() => setTab('reviews')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 }}>
            {product.reviewCount ? <><Stars value={product.rating} size={15} /><T bold>{product.rating.toFixed(1)}</T><T muted>{product.reviewCount} đánh giá</T></> : <T muted>Chưa có đánh giá</T>}
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <Text style={s.price}>{formatPrice(price)}</Text>
            {product.old && variant === 'standard' ? <>
              <Text style={s.old}>{formatPrice(product.old)}</Text>
              <View style={s.off}><Text style={s.offText}>−{discount}%</Text></View>
            </> : null}
          </View>
          <T muted>{product.desc}</T>
        </View>

        {hasSmart && (
          <View style={{ gap: 8 }}>
            <T bold>Chọn phiên bản</T>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {([
                { key: 'standard', name: 'Standard', price: product.price, note: 'Thiết bị IoT mở dần theo từng chặng cây lớn.', art: 'StandardVariant' },
                { key: 'smart', name: 'Smart · IoT', price: product.price + (product.smartDelta || 0), note: 'Mở sẵn cả 7 thiết bị IoT từ ngày đầu.', art: 'SmartVariant' },
              ] as const).map((v) => (
                <Pressable key={v.key} onPress={() => { tap(); setVariant(v.key); }} accessibilityRole="radio" accessibilityState={{ checked: variant === v.key }}
                  style={[s.variant, variant === v.key && s.variantOn]}>
                  <Image source={imageSource(`/assets/images/sprouty-icons/${v.art}.png`)} style={{ width: 44, height: 44 }} contentFit="contain" />
                  <Text style={s.variantName}>{v.name}</Text>
                  <Text style={s.variantPrice}>{formatPrice(v.price)}</Text>
                  <Text style={s.small}>{v.note}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View style={s.facts}>
          {facts.map((f) => (
            <View key={f.label} style={s.fact}>
              <Icon name={f.icon} size={20} color={colors.earth} />
              <View style={{ flex: 1 }}><Text style={s.small}>{f.label}</Text><Text style={s.factValue}>{f.value}</Text></View>
            </View>
          ))}
        </View>

        <View style={s.tabs}>
          {([['info', 'Tổng quan'], ['videos', 'Video'], ['reviews', `Đánh giá${product.reviewCount ? ` (${product.reviewCount})` : ''}`]] as const).map(([key, label]) => (
            <Pressable key={key} onPress={() => setTab(key)} style={[s.tab, tab === key && s.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
              <Text style={[s.tabText, tab === key && { color: colors.greenDark }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'info' && (
          <Card>
            <CardTitle icon="gift">Trong hộp có gì</CardTitle>
            {product.inc.length ? product.inc.map((item) => (
              <View key={item} style={s.check}><Icon name="check" size={16} color={colors.green} /><T style={{ flex: 1 }}>{item}</T></View>
            )) : <T muted>Thông tin đang được cập nhật.</T>}
            <CardTitle icon="heart">Sprouty hứa với ba mẹ</CardTitle>
            {['Có mã kích hoạt cây 3D ngay khi thanh toán', 'Hộp kit gửi tận nhà, theo dõi được đơn giao', 'Plant Buddy hướng dẫn bé từng bước', 'Hoàn tiền 100% nếu mã chưa kích hoạt (7 ngày)'].map((t) => (
              <View key={t} style={s.check}><Icon name="check" size={16} color={colors.green} /><T style={{ flex: 1 }}>{t}</T></View>
            ))}
          </Card>
        )}
        {tab === 'videos' && <ProductVideos productId={product.id} signedIn={Boolean(user)} />}
        {tab === 'reviews' && (
          <View style={{ gap: 10 }}>
            {reviews.data?.summary?.count ? (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Text style={s.score}>{Number(reviews.data.summary.average).toFixed(1)}</Text>
                <View style={{ gap: 4 }}><Stars value={reviews.data.summary.average} size={16} /><T muted>{reviews.data.summary.count} đánh giá · {reviews.data.summary.recommendPercent}% hài lòng</T></View>
              </Card>
            ) : null}
            {((reviews.data?.reviews || []) as Review[]).map((r) => (
              <Card key={r.id} style={{ gap: 6 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T bold>{r.author}</T><T muted>{formatDate(r.createdAt)}</T></View>
                <Stars value={r.rating} size={14} />
                {r.content ? <T>{r.content}</T> : null}
                {r.images?.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {r.images.map((src) => <Image key={src} source={imageSource(src)} style={s.reviewImg} contentFit="cover" />)}
                  </ScrollView>
                ) : null}
                {r.reply ? <View style={s.reply}><Text style={s.small}>Sprouty trả lời</Text><T>{r.reply.content}</T></View> : null}
              </Card>
            ))}
            {reviews.data && !reviews.data.reviews?.length && <T muted>Chưa có đánh giá. Nhận hàng xong, ba mẹ đánh giá trong mục Đơn hàng nhé.</T>}
          </View>
        )}

        {related.length > 0 && (
          <View style={{ gap: 10 }}>
            <H size={19}>Có thể bé cũng thích</H>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ gap: 12, paddingHorizontal: gutter }}>
              {related.map((p) => <ProductTile key={p.id} product={p} width={168} />)}
            </ScrollView>
          </View>
        )}
      </Screen>

      <ActionBar>
        <Stepper value={qty} onChange={setQty} max={10} label="Số lượng" />
        {/* On a phone the cart button is the icon alone, so "Mua ngay" keeps its words. */}
        {width < 430
          ? <IconButton icon="cart" label="Thêm vào giỏ" boxed color={colors.greenDark} onPress={() => addToCart()} />
          : <Button title="Thêm vào giỏ" icon="cart" variant="soft" grow onPress={() => addToCart()} />}
        <Button title="Mua ngay" grow onPress={() => addToCart(true)} />
      </ActionBar>
    </View>
  );
}

const s = StyleSheet.create({
  dots: { position: 'absolute', bottom: 10, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.7)' },
  dotOn: { width: 20, backgroundColor: colors.white },
  badge: { position: 'absolute', top: 12, left: gutter, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.orange },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  kicker: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.5, color: colors.earth },
  price: { fontFamily: fonts.bold, fontSize: 26, color: colors.price },
  old: { fontFamily: fonts.body, fontSize: 15, color: colors.ink4, textDecorationLine: 'line-through' },
  off: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.bad },
  offText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },
  variant: { flex: 1, gap: 4, padding: 12, borderRadius: radius.sm, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.card },
  variantOn: { borderColor: colors.green, backgroundColor: '#F6FBF4' },
  variantName: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  variantPrice: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.price },
  small: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.ink3 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fact: { flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.sm, backgroundColor: colors.earthSoft },
  factValue: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: '#EEF2E8' },
  tab: { flex: 1, minHeight: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.card },
  tabText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink3 },
  check: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  score: { fontFamily: fonts.display, fontSize: 40, color: colors.ink },
  reviewImg: { width: 84, height: 84, borderRadius: 12 },
  reply: { padding: 10, borderRadius: 12, backgroundColor: colors.greenSoft, gap: 2 },
});
