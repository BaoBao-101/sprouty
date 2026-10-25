import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Svg, { Path, Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';
import { imageSource } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/format';
import { BADGE_LABEL } from '@/lib/products';
import type { Product } from '@/lib/types';
import { colors, fonts, radius } from '@/theme';
import { Icon } from './Icon';
import { tap } from './ui';
import { useToast } from './Toast';

/** Five stars, filled to `value`. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${value.toFixed(1)} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Text key={n} style={{ fontSize: size, color: value >= n - 0.25 ? '#F4A51C' : '#E2E6DC' }}>★</Text>
      ))}
    </View>
  );
}

/**
 * A kit in a grid or a row. The picture and name open it; the round button
 * adds the standard kit (Smart is chosen on the kit's own screen, where the
 * difference is explained).
 */
export function ProductTile({ product, width }: { product: Product; width?: number }) {
  const { add, lines } = useCart();
  const toast = useToast();
  const inCart = lines.filter((l) => l.id === product.id).reduce((n, l) => n + l.qty, 0);
  const source = imageSource(product.images[0]);

  return (
    <View style={[s.tile, width ? { width } : { flex: 1 }]}>
      <Pressable onPress={() => router.push(`/product/${product.id}`)} accessibilityRole="button" accessibilityLabel={product.name}>
        <View style={[s.tileImg, { backgroundColor: product.bg }]}>
          {source ? <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            : <Icon name="sprout" size={34} color={colors.greenDark} />}
          {product.badge && (
            <View style={[s.badge, product.badge === 'hot' && { backgroundColor: colors.orange }, product.badge === 'new' && { backgroundColor: colors.green }, product.badge === 'sale' && { backgroundColor: colors.bad }]}>
              <Text style={s.badgeText}>{BADGE_LABEL[product.badge]}</Text>
            </View>
          )}
        </View>
        <View style={s.tileBody}>
          <Text numberOfLines={1} style={s.meta}>{[product.species?.label, product.age].filter(Boolean).join(' · ')}</Text>
          <Text numberOfLines={2} style={s.name}>{product.name}</Text>
          {product.reviewCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Stars value={product.rating} size={12} />
              <Text style={s.meta}>({product.reviewCount})</Text>
            </View>
          )}
        </View>
      </Pressable>
      <View style={s.foot}>
        <View style={{ flexShrink: 1 }}>
          <Text style={s.price}>{formatPrice(product.price)}</Text>
          {product.old ? <Text style={s.old}>{formatPrice(product.old)}</Text> : null}
        </View>
        <Pressable
          onPress={() => { tap(); add(product, 1); toast(`Đã thêm "${product.name}" vào giỏ`, 'success'); }}
          style={[s.add, inCart > 0 && s.addIn]}
          accessibilityLabel={inCart ? `Thêm một ${product.name} nữa, đang có ${inCart} trong giỏ` : `Thêm ${product.name} vào giỏ`}
        >
          {inCart > 0 ? <Text style={s.addCount}>{inCart}</Text> : <Icon name="add" size={20} color={colors.white} />}
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The ticket as a QR code staff scan at the door. The code is the payload —
 * not a URL — so any scanner reads exactly what the lookup box expects
 * (same as the website's components/TicketQr.tsx).
 */
export function TicketQr({ value, size = 132 }: { value: string; size?: number }) {
  const { d, cells } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return { d: path, cells: count };
  }, [value]);
  const span = cells + 8;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${span} ${span}`} accessibilityLabel={`Mã QR vé ${value}`}>
      <Rect width={span} height={span} fill="#fff" />
      <Path d={d} fill={colors.ink} transform="translate(4 4)" />
    </Svg>
  );
}

const s = StyleSheet.create({
  tile: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  tileImg: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: { position: 'absolute', top: 8, left: 8, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.white },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: colors.white },
  tileBody: { paddingHorizontal: 12, paddingTop: 10, gap: 3 },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.ink4 },
  name: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink, minHeight: 40 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 12, paddingRight: 8, paddingVertical: 10, gap: 6 },
  price: { fontFamily: fonts.bold, fontSize: 16, color: colors.price },
  old: { fontFamily: fonts.body, fontSize: 12, color: colors.ink4, textDecorationLine: 'line-through' },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  addIn: { backgroundColor: colors.greenSoft },
  addCount: { fontFamily: fonts.bold, fontSize: 16, color: colors.greenDark },
});
