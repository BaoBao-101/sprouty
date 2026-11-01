import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { ProductVideos } from '@/components/media';
import { ProductTile, score, Stars } from '@/components/shop';
import { SpeciesProfile } from '@/components/SpeciesProfile';
import { useToast } from '@/components/Toast';
import { ActionBar, Button, Card, Empty, IconButton, IconTile, Loading, Press, Screen, SectionHead, Segmented, Stepper, T, tap } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { webUrl } from '@/lib/config';
import { formatDate, formatPrice } from '@/lib/format';
import { BADGE_LABEL, fetchProducts, normalizeProduct } from '@/lib/products';
import type { Product, Review } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, gutter, maxWidth, radius, shadow, surface } from '@/theme';

type Tab = 'info' | 'videos' | 'reviews';
type Variant = 'standard' | 'smart';
const cap = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
const VARIANT_NAME: Record<Variant, string> = { standard: 'Tiêu chuẩn', smart: 'Smart · IoT' };
const CATEGORY_LABEL: Record<string, string> = { kit: 'Bộ kit trồng cây', book: 'Sách hướng dẫn', membership: 'Gói thành viên' };
/** What is in the box shows this many lines until "Xem thêm". */
const BOX_SHOWN = 5;

/** What Sprouty promises on every kit, a word or two each. */
const PROMISES: Array<{ icon: IconName; title: string; tint: string; ink: string }> = [
  { icon: 'bolt', title: 'Có mã ngay', tint: '#FFEBD0', ink: colors.warn },
  { icon: 'gift', title: 'Giao tận nhà', tint: colors.mint, ink: colors.greenDark },
  { icon: 'chat', title: 'AI đồng hành', tint: '#DCEFF1', ink: '#2F6F78' },
  { icon: 'shield', title: 'Hoàn tiền 7 ngày', tint: colors.earthSoft, ink: colors.earth },
];

/** Photos swiped sideways in a rounded frame, with dots on them. */
function Gallery({ product }: { product: Product }) {
  const { width } = useWindowDimensions();
  const w = Math.min(width, maxWidth + 32) - gutter * 2;
  const [index, setIndex] = useState(0);
  const images = product.images.length ? product.images : [''];
  return (
    <View style={[s.gallery, { backgroundColor: product.bg }]}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / w))}>
        {images.map((src, i) => (
          <View key={i} style={{ width: w, height: Math.min(Math.round(w * 0.7), 400), alignItems: 'center', justifyContent: 'center' }}>
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

/** One way to buy the kit, as a compact choice beside the other: a dot, its name, its price. */
function VariantOption({ selected, onPress, name, price, note }: {
  selected: boolean; onPress: () => void; name: string; price: number; note: string;
}) {
  return (
    <Press onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={`${name}, ${formatPrice(price)}, ${note}`}
      scaleTo={0.96} style={[s.variant, selected && s.variantOn]}>
      <View style={s.variantHead}>
        <View style={[s.radio, selected && s.radioOn]}>{selected && <View style={s.radioDot} />}</View>
        <Text numberOfLines={1} style={[s.variantName, selected && { color: colors.greenDark }]}>{name}</Text>
      </View>
      <Text style={s.variantPrice}>{formatPrice(price)}</Text>
      <Text numberOfLines={1} style={s.variantNote}>{note}</Text>
    </Press>
  );
}

/** A row that opens to show more, inside the details panel. */
function FoldRow({ icon, title, sub, open, onToggle, last, children }: {
  icon: IconName; title: string; sub?: string; open: boolean; onToggle: () => void; last?: boolean; children: React.ReactNode;
}) {
  return (
    <View style={!last && s.divider}>
      <Pressable onPress={() => { tap(); onToggle(); }} accessibilityRole="button" accessibilityState={{ expanded: open }} style={s.foldRow}>
        <IconTile icon={icon} size={36} />
        <View style={{ flex: 1 }}>
          <Text style={s.foldTitle}>{title}</Text>
          {sub ? <Text numberOfLines={1} style={s.foldSub}>{sub}</Text> : null}
        </View>
        <View style={[s.chev, open && { transform: [{ rotate: '180deg' }] }]}><Icon name="arrow-down" size={15} color={colors.ink3} /></View>
      </Pressable>
      {open && <View style={s.foldBody}>{children}</View>}
    </View>
  );
}

/**
 * One kit, kept short: the photos; the name, stars and price with the key
 * facts as tags; the version and how many in one panel; Sprouty's promises
 * as a strip of icons. What is in the box, the plant and the specifications
 * are below the tabs, the long parts folded. The total and the buttons stay
 * pinned in reach of a thumb, on one line.
 */
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { add, count } = useCart();
  const toast = useToast();
  const [variant, setVariant] = useState<Variant>('standard');
  const [qty, setQty] = useState(1);
  const [tab, setTab] = useState<Tab>('info');
  const [descOpen, setDescOpen] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);
  const [fold, setFold] = useState<'' | 'species' | 'specs'>('');

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
  const chosen: Variant = hasSmart ? variant : 'standard';
  const smartPrice = product.price + (product.smartDelta || 0);
  const price = chosen === 'smart' ? smartPrice : product.price;
  const discount = product.old ? Math.round((1 - product.price / product.old) * 100) : 0;
  const species = product.species;
  const profile = species?.profile;
  const boxCount = product.inc.length + (chosen === 'smart' ? product.smartInc.length : 0);
  const box = boxOpen ? product.inc : product.inc.slice(0, BOX_SHOWN);

  function addToCart(go?: boolean) {
    add(product, qty, chosen);
    toast(`Đã thêm "${product.name}"${chosen === 'smart' ? ' (Smart · IoT)' : ''} vào giỏ`, 'success');
    if (go) router.push('/cart');
  }

  // The facts a parent decides on, as tags under the price.
  const tags: Array<{ icon: IconName; text: string; tone?: 'green' | 'earth' }> = [
    ...(species ? [{ icon: 'sprout' as IconName, text: species.label, tone: 'green' as const }] : []),
    ...(product.age ? [{ icon: 'child' as IconName, text: product.age }] : []),
    ...(species ? [{ icon: 'harvest' as IconName, text: `Thu ${species.harvest}` }] : []),
    ...(product.col ? [{ icon: 'gift' as IconName, text: product.col, tone: 'earth' as const }] : []),
  ];

  const specs: Array<[string, string]> = [
    ['Loại sản phẩm', CATEGORY_LABEL[product.cat] ?? product.cat],
    ['Độ tuổi', product.age || '—'],
    ['Bộ sưu tập', product.col || '—'],
    ...(species ? [['Giống cây', species.label], ['Thu hoạch', cap(species.harvest)]] as Array<[string, string]> : []),
    ['Phiên bản', hasSmart ? 'Tiêu chuẩn · Smart · IoT' : 'Tiêu chuẩn'],
    ['Hình thức', 'Hộp kit giao tận nhà · cây 3D kích hoạt bằng mã'],
  ];

  return (
    <View style={{ flex: 1 }}>
      <Screen back="/shop" bar onRefresh={data.reload}
        actions={<>
          <IconButton icon="share" label="Chia sẻ" boxed size={20} onPress={() => Share.share({ message: `${product.name} — bộ kit trồng cây cho bé: ${webUrl(`/shop/${product.id}`)}` })} />
          <IconButton icon="cart" label="Giỏ hàng" boxed size={20} badge={count} onPress={() => router.push('/cart')} />
        </>}>
        <Gallery product={product} />

        {/* Who it is, what it costs, and the facts as tags */}
        <View style={{ gap: 8 }}>
          <View style={s.titleRow}>
            <Text style={s.name}>{product.name}</Text>
            <Pressable onPress={() => setTab('reviews')} style={s.rating} accessibilityRole="button" accessibilityLabel="Xem đánh giá">
              <Icon name="star" size={15} color="#E9A21B" />
              <Text style={s.ratingNum}>{product.reviewCount ? score(product.rating) : '—'}</Text>
              <Text style={s.ratingMeta}>({product.reviewCount})</Text>
            </Pressable>
          </View>
          <View style={s.priceRow}>
            <Text style={s.price}>{formatPrice(price)}</Text>
            {product.old && chosen === 'standard' ? <>
              <Text style={s.old}>{formatPrice(product.old)}</Text>
              <View style={s.off}><Text style={s.offText}>−{discount}%</Text></View>
            </> : null}
          </View>
          <View style={s.tags}>
            {tags.map((t) => (
              <View key={t.text} style={[s.tag, t.tone === 'green' && { backgroundColor: colors.mint }, t.tone === 'earth' && { backgroundColor: colors.earthSoft }]}>
                <Icon name={t.icon} size={13} color={t.tone === 'earth' ? colors.earth : colors.greenDark} />
                <Text style={[s.tagText, t.tone === 'earth' && { color: colors.earth }]}>{t.text}</Text>
              </View>
            ))}
          </View>
          {product.desc ? (
            <Pressable onPress={() => setDescOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: descOpen }}>
              <Text numberOfLines={descOpen ? undefined : 2} style={s.desc}>{product.desc}</Text>
              {product.desc.length > 90 && <Text style={s.moreLink}>{descOpen ? 'Thu gọn' : 'Đọc thêm'}</Text>}
            </Pressable>
          ) : null}
        </View>

        {/* The version and how many, in one panel */}
        <Card style={{ gap: 12 }}>
          {hasSmart && (
            <View style={s.variants}>
              <VariantOption selected={chosen === 'standard'} onPress={() => setVariant('standard')}
                name="Tiêu chuẩn" price={product.price} note="Bộ kit trồng cây" />
              <VariantOption selected={chosen === 'smart'} onPress={() => setVariant('smart')}
                name="Smart · IoT" price={smartPrice}
                note={product.smartInc.length ? `+ ${product.smartInc.length} thiết bị IoT thật` : '+ thiết bị IoT thật'} />
            </View>
          )}
          <View style={s.qtyRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.qtyLabel}>Số lượng</Text>
              {hasSmart && <Text style={s.foldSub}>Cả hai bản đều có cây 3D trong app</Text>}
            </View>
            <Stepper value={qty} onChange={setQty} max={10} label="Số lượng" />
          </View>
        </Card>

        <View style={s.promises}>
          {PROMISES.map((p) => (
            <View key={p.title} style={s.promise}>
              <IconTile icon={p.icon} size={36} tint={p.tint} color={p.ink} round />
              <Text numberOfLines={2} style={s.promiseTitle}>{p.title}</Text>
            </View>
          ))}
        </View>

        <Segmented
          items={[
            { key: 'info' as Tab, label: 'Chi tiết' },
            { key: 'videos' as Tab, label: 'Video' },
            { key: 'reviews' as Tab, label: `Đánh giá${product.reviewCount ? ` · ${product.reviewCount}` : ''}` },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'info' && (
          <>
            {/* What arrives, for the version chosen: the first few, the rest a tap away */}
            <Card style={{ gap: 10 }}>
              <View style={s.cardHead}>
                <IconTile icon="gift" size={34} />
                <Text style={s.cardTitle}>Trong hộp có gì</Text>
                {boxCount > 0 && <View style={s.count}><Text style={s.countText}>{boxCount} món</Text></View>}
              </View>
              {product.inc.length ? (
                <View style={{ gap: 8 }}>
                  {box.map((item) => (
                    <View key={item} style={s.item}><View style={s.tick}><Icon name="check" size={11} color={colors.greenDark} /></View><Text style={s.itemText}>{item}</Text></View>
                  ))}
                  {product.inc.length > BOX_SHOWN && (
                    <Pressable onPress={() => { tap(); setBoxOpen((v) => !v); }} accessibilityRole="button" style={s.boxMore}>
                      <Text style={s.moreText}>{boxOpen ? 'Thu gọn' : `Xem thêm ${product.inc.length - BOX_SHOWN} món`}</Text>
                      <View style={boxOpen ? { transform: [{ rotate: '180deg' }] } : undefined}><Icon name="arrow-down" size={14} color={colors.green} /></View>
                    </Pressable>
                  )}
                </View>
              ) : <T muted>Thông tin đang được cập nhật.</T>}
              {product.smartInc.length > 0 && (
                // The real IoT devices the Smart variant adds to the box.
                <View style={[s.smartInc, chosen === 'smart' && s.smartIncOn]}>
                  <View style={s.smartHead}>
                    <Icon name="bolt" size={15} color={colors.warn} />
                    <Text style={s.smartTitle}>Bản Smart có thêm</Text>
                    {chosen === 'smart'
                      ? <View style={s.included}><Text style={s.includedText}>Đã gồm</Text></View>
                      : <Pressable onPress={() => { tap(); setVariant('smart'); }} hitSlop={6} style={s.pickSmart}><Text style={s.pickSmartText}>+{formatPrice(product.smartDelta || 0)}</Text></Pressable>}
                  </View>
                  {product.smartInc.map((item) => (
                    <View key={item} style={s.item}><View style={[s.tick, { backgroundColor: '#FDE7C2' }]}><Icon name="add" size={11} color={colors.warn} /></View><Text style={s.itemText}>{item}</Text></View>
                  ))}
                </View>
              )}
            </Card>

            {/* The plant and the specifications, folded */}
            <View style={s.group}>
              {species && profile && (
                <FoldRow icon="leaf" title={`Về giống ${species.label.toLowerCase()}`} sub={profile.scientificName}
                  open={fold === 'species'} onToggle={() => setFold((f) => (f === 'species' ? '' : 'species'))}>
                  <SpeciesProfile label={species.label} profile={profile} title={false} />
                </FoldRow>
              )}
              <FoldRow icon="info" title="Thông số" sub={`${specs.length} mục`} last
                open={fold === 'specs'} onToggle={() => setFold((f) => (f === 'specs' ? '' : 'specs'))}>
                {specs.map(([label, value], i) => (
                  <View key={label} style={[s.spec, i < specs.length - 1 && s.divider]}>
                    <Text style={s.specLabel}>{label}</Text>
                    <Text style={s.specValue}>{value}</Text>
                  </View>
                ))}
              </FoldRow>
            </View>
          </>
        )}
        {tab === 'videos' && <ProductVideos productId={product.id} signedIn={Boolean(user)} />}
        {tab === 'reviews' && (
          <View style={{ gap: 10 }}>
            {reviews.data?.summary?.count ? (
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <Text style={s.score}>{score(Number(reviews.data.summary.average))}</Text>
                <View style={{ gap: 4, flex: 1 }}>
                  <Stars value={reviews.data.summary.average} size={17} />
                  <Text style={s.small}>{reviews.data.summary.count} đánh giá · {reviews.data.summary.recommendPercent}% hài lòng</Text>
                </View>
              </Card>
            ) : null}
            {((reviews.data?.reviews || []) as Review[]).map((r) => (
              <Card key={r.id} style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={s.reviewer}><Text style={s.reviewerText}>{(r.author || '?').trim().split(/\s+/).pop()?.charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.reviewName}>{r.author}</Text>
                    <Text style={s.small}>{formatDate(r.createdAt)}</Text>
                  </View>
                  <Stars value={r.rating} size={13} />
                </View>
                {r.content ? <T>{r.content}</T> : null}
                {r.images?.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {r.images.map((src) => <Image key={src} source={imageSource(src)} style={s.reviewImg} contentFit="cover" />)}
                  </ScrollView>
                ) : null}
                {r.reply ? <View style={s.reply}><Text style={s.replyHead}>Sprouty trả lời</Text><T>{r.reply.content}</T></View> : null}
              </Card>
            ))}
            {reviews.data && !reviews.data.reviews?.length && (
              <Empty icon="star" title="Chưa có đánh giá" text="Nhận hàng xong, ba mẹ đánh giá trong mục Đơn hàng nhé." />
            )}
          </View>
        )}

        {related.length > 0 && (
          <View style={{ gap: 10 }}>
            <SectionHead title="Có thể bé cũng thích" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -gutter }} contentContainerStyle={{ gap: 12, paddingHorizontal: gutter, paddingBottom: 10, paddingTop: 2 }}>
              {related.map((p) => <ProductTile key={p.id} product={p} width={164} />)}
            </ScrollView>
          </View>
        )}
      </Screen>

      {/* One line: what it comes to, then the two ways to buy */}
      <ActionBar>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={s.totalLabel}>{hasSmart ? VARIANT_NAME[chosen] : 'Tạm tính'} · {qty} bộ</Text>
          <Text numberOfLines={1} style={s.totalValue}>{formatPrice(price * qty)}</Text>
        </View>
        <Press onPress={() => addToCart()} accessibilityLabel="Thêm vào giỏ" scaleTo={0.9} style={s.cartBtn}><Icon name="cart" size={21} color={colors.greenDark} /></Press>
        <Button title="Mua ngay" onPress={() => addToCart(true)} style={{ paddingHorizontal: 26 }} />
      </ActionBar>
    </View>
  );
}

const s = StyleSheet.create({
  gallery: { borderRadius: radius.xl, overflow: 'hidden' },
  dots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.7)' },
  dotOn: { width: 20, backgroundColor: colors.white },
  badge: { position: 'absolute', top: 14, left: 14, paddingHorizontal: 11, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.orange },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.white },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { flex: 1, fontFamily: fonts.display, fontSize: 25, lineHeight: 31, color: colors.ink },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 32, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.card, ...shadow.sm },
  ratingNum: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  ratingMeta: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  price: { fontFamily: fonts.bold, fontSize: 27, color: colors.price },
  old: { fontFamily: fonts.body, fontSize: 15, color: colors.ink4, textDecorationLine: 'line-through' },
  off: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.badSoft },
  offText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.bad },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.card },
  tagText: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.ink2 },
  desc: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 22, color: colors.ink2 },
  moreLink: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.green, marginTop: 2 },

  variants: { flexDirection: 'row', gap: 10 },
  variant: { flex: 1, gap: 2, padding: 12, borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.canvas },
  variantOn: { borderColor: colors.green, backgroundColor: '#F3FAF0' },
  variantHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.ink5, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.green },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  variantName: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  variantPrice: { fontFamily: fonts.bold, fontSize: 16, color: colors.price, marginTop: 2 },
  variantNote: { fontFamily: fonts.body, fontSize: 12, color: colors.ink3 },
  qtyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink3 },

  promises: { ...surface, flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 4 },
  promise: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  promiseTitle: { fontFamily: fonts.semi, fontSize: 11.5, lineHeight: 15, color: colors.ink2, textAlign: 'center' },

  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  cardTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  count: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.mint },
  countText: { fontFamily: fonts.bold, fontSize: 12, color: colors.greenDark },
  item: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tick: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  itemText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink2 },
  boxMore: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingLeft: 30 },
  moreText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.green },
  smartInc: { gap: 8, padding: 12, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#F3CF8A', backgroundColor: '#FFFAEE' },
  smartIncOn: { borderStyle: 'solid', borderColor: '#EDB04A' },
  smartHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  smartTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 14, color: '#92400E' },
  included: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: '#E99B1F' },
  includedText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.white },
  pickSmart: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.white, ...shadow.sm },
  pickSmartText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.warn },

  group: { ...surface },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  foldRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingHorizontal: 14, paddingVertical: 10 },
  foldTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  foldSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3, fontStyle: 'italic' },
  foldBody: { paddingHorizontal: 14, paddingBottom: 14 },
  chev: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  spec: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, paddingVertical: 10 },
  specLabel: { fontFamily: fonts.body, fontSize: 13.5, color: colors.ink3 },
  specValue: { flex: 1, fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink, textAlign: 'right' },

  score: { fontFamily: fonts.display, fontSize: 42, lineHeight: 50, color: colors.ink },
  reviewer: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  reviewerText: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, color: colors.greenDark },
  reviewName: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  reviewImg: { width: 84, height: 84, borderRadius: 12 },
  reply: { padding: 12, borderRadius: 14, backgroundColor: colors.mint, gap: 2 },
  replyHead: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.greenDark },

  totalLabel: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink3 },
  totalValue: { fontFamily: fonts.bold, fontSize: 19, color: colors.price },
  cartBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
});
