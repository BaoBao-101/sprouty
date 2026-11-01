import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { ProductTile } from '@/components/shop';
import { Chip, ChipRow, Empty, ErrorNote, IconButton, Label, Loading, Screen, Sheet, tap } from '@/components/ui';
import { API } from '@/lib/api';
import { useCart } from '@/lib/cart';
import { fetchProducts } from '@/lib/products';
import type { Product } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, gutter, maxWidth, radius, shadow } from '@/theme';

type AgeBand = 'all' | '4-6' | '6-9' | '9-12';
type Sort = '' | 'pop' | 'rating' | 'pa' | 'pd';

const AGES: Array<{ value: AgeBand; label: string; years: string[] }> = [
  { value: 'all', label: 'Mọi tuổi', years: [] },
  { value: '4-6', label: '4–6 tuổi', years: ['4', '5', '6'] },
  { value: '6-9', label: '6–9 tuổi', years: ['6', '7', '8', '9'] },
  { value: '9-12', label: '9–12 tuổi', years: ['9', '10', '11', '12'] },
];

const SORTS: Array<{ value: Sort; label: string; icon: IconName }> = [
  { value: '', label: 'Gợi ý cho bạn', icon: 'sparkle' },
  { value: 'pop', label: 'Bán chạy', icon: 'bolt' },
  { value: 'rating', label: 'Đánh giá cao', icon: 'star' },
  { value: 'pa', label: 'Giá thấp đến cao', icon: 'arrow-down' },
  { value: 'pd', label: 'Giá cao đến thấp', icon: 'arrow-down' },
];

const CATEGORIES: Array<{ value: string; label: string; icon: IconName }> = [
  { value: 'all', label: 'Tất cả', icon: 'leaf' },
  { value: 'kit', label: 'Bộ kit trồng cây', icon: 'pot' },
  { value: 'book', label: 'Sách hướng dẫn', icon: 'book' },
];

/** The age label is free text ("4–10 tuổi"); a band matches if any of its years is in it. */
const matchesAge = (p: Product, band: AgeBand) => band === 'all' || AGES.find((a) => a.value === band)!.years.some((y) => p.age.includes(y));

/** A choice in the sort-and-filter sheet: its icon, its words, a tick when chosen. */
function Option({ label, icon, on, onPress, flip }: { label: string; icon: IconName; on: boolean; onPress: () => void; flip?: boolean }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="radio" accessibilityState={{ checked: on }}
      style={[s.option, on && s.optionOn]}>
      <View style={flip ? { transform: [{ scaleY: -1 }] } : undefined}><Icon name={icon} size={18} color={on ? colors.greenDark : colors.ink4} /></View>
      <Text style={[s.optionText, on && { color: colors.greenDark }]}>{label}</Text>
      {on && <Icon name="check" size={18} color={colors.green} />}
    </Pressable>
  );
}

/**
 * Cửa hàng. What a parent filters by, in the order they think of it: which
 * plant, then how old the child is — rows of chips one tap away. Sorting and
 * the kind of product live behind the filter button in the search bar, since
 * they change far less often.
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
  const sortLabel = SORTS.find((o) => o.value === sort)?.label;

  return (
    <Screen title="Cửa hàng" large onRefresh={data.reload}
      actions={<IconButton icon="cart" label="Giỏ hàng" boxed badge={count} onPress={() => router.push('/cart')} />}>
      <View style={s.search}>
        <Icon name="search" size={19} color={colors.ink4} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Tìm cây, độ tuổi, chủ đề…" placeholderTextColor={colors.ink4}
          style={s.searchInput} returnKeyType="search" accessibilityLabel="Tìm sản phẩm" />
        {query ? <IconButton icon="close" label="Xoá tìm kiếm" size={18} onPress={() => setQuery('')} /> : null}
        <Pressable onPress={() => { tap(); setSheet(true); }} accessibilityRole="button" accessibilityLabel="Sắp xếp và lọc"
          style={({ pressed }) => [s.filter, extra > 0 && s.filterOn, pressed && { opacity: 0.8 }]}>
          <Icon name="filter" size={18} color={extra > 0 ? colors.white : colors.greenDark} />
          {extra > 0 && <View style={s.filterBadge}><Text style={s.filterBadgeText}>{extra}</Text></View>}
        </Pressable>
      </View>

      <View style={{ gap: 10 }}>
        {!!data.data?.species.length && (
          <ChipRow>
            <Chip label="Tất cả cây" icon="leaf" on={species === 'all'} onPress={() => setSpecies('all')} />
            {data.data.species.map((sp) => (
              <Chip key={sp.key} label={sp.label} icon={(sp.icon as IconName) || 'sprout'} on={species === sp.key} onPress={() => setSpecies(species === sp.key ? 'all' : sp.key)} />
            ))}
          </ChipRow>
        )}
        <ChipRow>
          {AGES.map((a) => <Chip key={a.value} label={a.label} icon={a.value === 'all' ? 'child' : undefined} on={age === a.value} onPress={() => setAge(a.value)} />)}
        </ChipRow>
      </View>

      {data.error && !data.data ? <ErrorNote message={data.error} onRetry={data.reload} /> : null}
      {data.loading && !data.data ? <Loading label="Đang tìm những bạn cây…" /> : null}

      {data.data && results.length === 0 && (
        <Empty icon="search" title="Chưa có bộ kit hợp" text="Thử bỏ bớt bộ lọc hoặc đổi từ khoá nhé." />
      )}
      {results.length > 0 && (
        <View style={{ gap: 12 }}>
          <View style={s.countRow}>
            <Text style={s.count}><Text style={s.countN}>{results.length}</Text> sản phẩm{q ? ` cho “${query.trim()}”` : ''}</Text>
            {sort ? <Text style={s.sortNote}>{sortLabel}</Text> : null}
          </View>
          <View style={s.grid}>
            {results.map((p) => <ProductTile key={p.id} product={p} width={tileWidth} />)}
          </View>
        </View>
      )}

      <Sheet open={sheet} title="Sắp xếp và lọc" onClose={() => setSheet(false)}>
        <Label>Sắp xếp</Label>
        <View style={s.options}>
          {SORTS.map((o) => <Option key={o.value} label={o.label} icon={o.icon} flip={o.value === 'pa'} on={sort === o.value} onPress={() => setSort(o.value)} />)}
        </View>
        <Label>Loại sản phẩm</Label>
        <View style={s.options}>
          {CATEGORIES.map((o) => <Option key={o.value} label={o.label} icon={o.icon} on={category === o.value} onPress={() => setCategory(o.value)} />)}
        </View>
      </Sheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 54, paddingLeft: 16, paddingRight: 6, borderRadius: radius.pill, backgroundColor: colors.card, ...shadow.sm },
  searchInput: { flex: 1, height: '100%', fontFamily: fonts.body, fontSize: 15.5, color: colors.ink },
  filter: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  filterOn: { backgroundColor: colors.green },
  filterBadge: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.orange, borderWidth: 2, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  filterBadgeText: { fontFamily: fonts.bold, fontSize: 10, color: colors.white },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  count: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink3 },
  countN: { fontFamily: fonts.bold, color: colors.ink },
  sortNote: { fontFamily: fonts.semi, fontSize: 13, color: colors.greenDark },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  options: { borderRadius: radius.lg, backgroundColor: colors.card, overflow: 'hidden' },
  option: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  optionOn: { backgroundColor: '#F3FAF0' },
  optionText: { flex: 1, fontFamily: fonts.semi, fontSize: 15, color: colors.ink2 },
});
