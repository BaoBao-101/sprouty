import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { ProductTile } from '@/components/shop';
import { Chip, Empty, ErrorNote, IconButton, Loading, Screen, Sheet, T } from '@/components/ui';
import { API } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { fetchProducts } from '@/lib/products';
import type { Product } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme';

type AgeBand = 'all' | '4-6' | '6-9' | '9-12';
type Sort = '' | 'pop' | 'rating' | 'pa' | 'pd';

const AGES: Array<{ value: AgeBand; label: string; years: string[] }> = [
  { value: 'all', label: 'Mọi tuổi', years: [] },
  { value: '4-6', label: '4–6 tuổi', years: ['4', '5', '6'] },
  { value: '6-9', label: '6–9 tuổi', years: ['6', '7', '8', '9'] },
  { value: '9-12', label: '9–12 tuổi', years: ['9', '10', '11', '12'] },
];

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: '', label: 'Gợi ý cho bạn' },
  { value: 'pop', label: 'Bán chạy' },
  { value: 'rating', label: 'Đánh giá cao' },
  { value: 'pa', label: 'Giá thấp đến cao' },
  { value: 'pd', label: 'Giá cao đến thấp' },
];

const CATEGORIES = [
  { value: 'all', label: 'Tất cả' },
  { value: 'kit', label: 'Bộ kit trồng cây' },
  { value: 'book', label: 'Sách hướng dẫn' },
];

/** The age label is free text ("4–10 tuổi"); a band matches if any of its years is in it. */
const matchesAge = (p: Product, band: AgeBand) => band === 'all' || AGES.find((a) => a.value === band)!.years.some((y) => p.age.includes(y));

/**
 * Cửa hàng. What a parent filters by, in the order they think of it: which
 * plant, then how old the child is — rows of chips one tap away. Sorting and
 * the kind of product are in a sheet, since they change far less often.
 */
export default function Shop() {
  const params = useLocalSearchParams<{ species?: string }>();
  const { width } = useWindowDimensions();
  const { count } = useCart();
  const [query, setQuery] = useState('');
  const [species, setSpecies] = useState(params.species || 'all');
  const [age, setAge] = useState<AgeBand>('all');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<Sort>('');
  const [sheet, setSheet] = useState(false);

  const data = useLoad(async () => {
    const [products, sp] = await Promise.all([fetchProducts(), API.products.species().catch(() => ({ species: [] }))]);
    return { products, species: (sp.species || []) as Array<{ key: string; label: string; icon: string }> };
  });

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    const list = (data.data?.products || []).filter((p) => {
      if (category !== 'all' && p.cat !== category) return false;
      if (species !== 'all' && p.species?.key !== species) return false;
      if (!matchesAge(p, age)) return false;
      if (q && !`${p.name} ${p.desc} ${p.col} ${p.age} ${p.species?.label || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    if (sort === 'pa') list.sort((a, b) => a.price - b.price);
    else if (sort === 'pd') list.sort((a, b) => b.price - a.price);
    else if (sort === 'pop') list.sort((a, b) => Number(b.badge === 'hot') - Number(a.badge === 'hot'));
    else if (sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [data.data, category, species, age, q, sort]);

  // Two columns on a phone, three or four on a tablet.
  const inner = Math.min(width, maxWidth) - gutter * 2;
  const columns = inner >= 640 ? 4 : inner >= 480 ? 3 : 2;
  const tileWidth = Math.floor((inner - 12 * (columns - 1)) / columns);
  const extra = Number(category !== 'all') + Number(sort !== '');

  return (
    <Screen title="Cửa hàng" large onRefresh={data.reload}
      actions={<IconButton icon="cart" label="Giỏ hàng" badge={count} onPress={() => router.push('/cart')} />}>
      <View style={s.searchRow}>
        <View style={s.search}>
          <Icon name="search" size={19} color={colors.ink4} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Tìm cây, độ tuổi, chủ đề…" placeholderTextColor={colors.ink5}
            style={s.searchInput} returnKeyType="search" accessibilityLabel="Tìm sản phẩm" />
          {query ? <IconButton icon="close" label="Xoá tìm kiếm" onPress={() => setQuery('')} /> : null}
        </View>
        <IconButton icon="filter" label="Sắp xếp và lọc" boxed badge={extra} onPress={() => setSheet(true)} />
      </View>

      {!!data.data?.species.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsOuter} contentContainerStyle={s.chips}>
          <Chip label="Tất cả cây" icon="leaf" on={species === 'all'} onPress={() => setSpecies('all')} />
          {data.data.species.map((sp) => (
            <Chip key={sp.key} label={sp.label} icon={(sp.icon as IconName) || 'sprout'} on={species === sp.key} onPress={() => setSpecies(species === sp.key ? 'all' : sp.key)} />
          ))}
        </ScrollView>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsOuter} contentContainerStyle={s.chips}>
        {AGES.map((a) => <Chip key={a.value} label={a.label} icon={a.value === 'all' ? 'child' : undefined} on={age === a.value} onPress={() => setAge(a.value)} />)}
      </ScrollView>

      {data.error && !data.data ? <ErrorNote message={data.error} onRetry={data.reload} /> : null}
      {data.loading && !data.data ? <Loading label="Đang tìm những bạn cây…" /> : null}

      {data.data && results.length === 0 && (
        <Empty icon="search" title="Chưa có bộ kit hợp" text="Thử bỏ bớt bộ lọc hoặc đổi từ khoá nhé." />
      )}
      {results.length > 0 && (
        <>
          <T muted>{results.length} sản phẩm{q ? ` cho “${query.trim()}”` : ''}</T>
          <View style={s.grid}>
            {results.map((p) => <ProductTile key={p.id} product={p} width={tileWidth} />)}
          </View>
        </>
      )}

      <Sheet open={sheet} title="Sắp xếp và lọc" onClose={() => setSheet(false)}>
        <Text style={s.sheetLabel}>SẮP XẾP</Text>
        {SORTS.map((o) => (
          <Pressable key={o.value} onPress={() => setSort(o.value)} style={[s.option, sort === o.value && s.optionOn]}>
            <Text style={[s.optionText, sort === o.value && { color: colors.greenDark }]}>{o.label}</Text>
            {sort === o.value && <Icon name="check" size={18} color={colors.green} />}
          </Pressable>
        ))}
        <Text style={s.sheetLabel}>LOẠI SẢN PHẨM</Text>
        {CATEGORIES.map((o) => (
          <Pressable key={o.value} onPress={() => setCategory(o.value)} style={[s.option, category === o.value && s.optionOn]}>
            <Text style={[s.optionText, category === o.value && { color: colors.greenDark }]}>{o.label}</Text>
            {category === o.value && <Icon name="check" size={18} color={colors.green} />}
          </Pressable>
        ))}
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingLeft: 14, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  chipsOuter: { marginHorizontal: -gutter, flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: gutter },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sheetLabel: { fontFamily: fonts.bold, fontSize: 12.5, letterSpacing: 0.6, color: colors.ink4, marginTop: 4 },
  option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card },
  optionOn: { borderColor: colors.green, backgroundColor: '#F6FBF4' },
  optionText: { fontFamily: fonts.semi, fontSize: 15, color: colors.ink2 },
});
