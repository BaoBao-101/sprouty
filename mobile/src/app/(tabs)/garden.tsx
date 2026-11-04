import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { HarvestStars } from '@/components/HarvestSheet';
import { Icon, type IconName } from '@/components/Icon';
import { PlantArt } from '@/components/PlantArt';
import { PlantThumb } from '@/components/PlantThumb';
import { useToast } from '@/components/Toast';
import { Button, Chip, ChipRow, cheer, Empty, ErrorNote, Field, IconButton, Loading, Meter, Press, Screen, Sheet, Stat, T } from '@/components/ui';
import { API } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { alertBrief } from '@/lib/format';
import type { HarvestCollection, PlantAlert, PlantCard } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, gutter, maxWidth, radius, shadow, surface } from '@/theme';

/** Sowing a kit's code. Opened from the garden, from Home, or with the code already filled in from an order. */
function ActivateSheet({ open, initialCode, onClose }: { open: boolean; initialCode: string; onClose: () => void }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setCode(initialCode); setNickname(''); setError(''); setBusy(false); }
  }, [open, initialCode]);

  async function submit() {
    setError('');
    const clean = code.trim();
    if (clean.length < 4) return setError('Nhập mã kích hoạt in trên đơn hàng của bạn.');
    setBusy(true);
    try {
      const data = await API.plants.activate(clean, nickname.trim() || undefined);
      cheer();
      toast(data.message || 'Đã kích hoạt mã.', 'success');
      onClose();
      // A membership code grants features and plants nothing.
      if (data.plant?.id) router.push(`/plant/${data.plant.id}`);
    } catch (err: any) {
      setError(err?.message || 'Không kích hoạt được mã này.');
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} title="Kích hoạt cây mới" onClose={onClose}
      footer={<Button title={busy ? 'Đang gieo hạt…' : 'Gieo hạt'} icon="seed" busy={busy} onPress={submit} />}>
      <View style={s.sow}>
        <View style={s.sowArt}><PlantArt stage="seed" progress={30} health={95} size={64} /></View>
        <T style={{ flex: 1 }}>Nhập mã trong đơn hàng — hạt được gieo ngay.</T>
      </View>
      <Field label="Mã kích hoạt" value={code} onChangeText={setCode} placeholder="SPR-XXXX-XXXX-XXXX-XXXX" autoCapitalize="characters"
        autoCorrect={false} maxLength={128} error={error} style={{ fontFamily: fonts.bold, letterSpacing: 1 }} />
      <Field label="Tên cho cây (tuỳ chọn)" value={nickname} onChangeText={setNickname} placeholder="Bé Đậu, Cà Chua Nhỏ…" maxLength={40} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button small grow variant="ghost" icon="cart" title="Lấy mã ở đơn hàng" onPress={() => { onClose(); router.push('/orders'); }} />
        <Button small variant="soft" title="Mua kit" onPress={() => { onClose(); router.push('/shop'); }} />
      </View>
    </Sheet>
  );
}

type Filter = 'care' | 'growing' | 'done' | 'all';

/** Lower comes first: dead, then plants with something to do, then the rest by health. */
function urgency(p: PlantCard, alerts: number) {
  if (p.diedAt) return 0;
  if (alerts) return 1 + p.health / 1000;
  if (p.harvestedAt) return 4;
  return 2 + p.health / 1000;
}

const strip = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/**
 * One plant as a card: its picture, its name, how far along it is (a bar per
 * stage), and what it needs now as a tag. Water and food show as two short
 * bars when nothing is wrong.
 */
function PlantTile({ plant, alerts, width }: { plant: PlantCard; alerts: PlantAlert[]; width: number }) {
  const dead = Boolean(plant.diedAt);
  const done = Boolean(plant.harvestedAt);
  const state = plant.healthState.id;
  const tone = dead || state === 'critical' || state === 'wilting' ? { bg: colors.badSoft, fg: colors.bad }
    : done ? { bg: colors.goldSoft, fg: colors.gold }
    : state === 'stressed' ? { bg: colors.warnSoft, fg: colors.warn }
    : { bg: colors.mint, fg: colors.greenDark };
  const need = dead ? { icon: 'seed' as const, label: 'Gieo lại' } : alerts[0] ? alertBrief(alerts[0].text) : null;
  return (
    <Press onPress={() => router.push(`/plant/${plant.id}`)} accessibilityLabel={`${plant.nickname}, ${plant.stageLabel}${need ? `, ${need.label}` : ''}`}
      style={[s.tile, { width }]}>
      <View style={[s.thumb, { backgroundColor: plant.bgColor || '#F0FDF4' }]}>
        <PlantThumb plant={plant} size={width - 12} />
        <View style={[s.health, { backgroundColor: tone.bg }]}>
          <Icon name={done ? 'trophy' : 'heart'} size={11} color={tone.fg} />
          <Text style={[s.healthText, { color: tone.fg }]}>{done ? 'Thu hoạch' : dead ? 'Đã héo' : plant.healthState.label}</Text>
        </View>
        {plant.careStreak > 0 && !dead && !done && (
          <View style={s.streak}><Icon name="bolt" size={11} color={colors.price} /><Text style={s.streakText}>{plant.careStreak}</Text></View>
        )}
      </View>
      <View style={s.body}>
        <Text numberOfLines={1} style={s.name}>{plant.nickname}</Text>
        <Text numberOfLines={1} style={s.sub}>{plant.speciesLabel} · {plant.stageLabel}</Text>
        <View style={s.stages} accessibilityLabel={`Chặng ${plant.stageIndex + 1} trên ${plant.stageCount}`}>
          {Array.from({ length: plant.stageCount }, (_, i) => (
            <View key={i} style={[s.stage, i < plant.stageIndex && { backgroundColor: colors.green }, i === plant.stageIndex && { backgroundColor: done ? colors.green : colors.greenLight }]} />
          ))}
        </View>
        {need ? (
          <View style={[s.need, dead && { backgroundColor: colors.badSoft }]}>
            <Icon name={need.icon} size={13} color={dead ? colors.bad : colors.warn} />
            <Text numberOfLines={1} style={[s.needText, dead && { color: colors.bad }]}>{need.label}{alerts.length > 1 ? ` +${alerts.length - 1}` : ''}</Text>
          </View>
        ) : !done ? (
          <View style={s.meters}>
            <Icon name="water" size={12} color={colors.sky} />
            <Meter value={plant.moisture} color={colors.sky} height={5} style={{ flex: 1 }} />
            <Icon name="nutrient" size={12} color={colors.green} />
            <Meter value={plant.nutrient} color={colors.greenLight} height={5} style={{ flex: 1 }} />
          </View>
        ) : plant.harvestCount == null ? (
          // An API from before the harvest journey: no stars to show.
          <View style={[s.need, { backgroundColor: colors.goldSoft }]}>
            <Icon name="harvest" size={13} color={colors.gold} />
            <Text style={[s.needText, { color: colors.gold }]}>Hoàn thành</Text>
          </View>
        ) : (
          // A finished plant: what it gave, not how thirsty it is.
          <View style={s.done}>
            <HarvestStars value={plant.bestStars} size={13} />
            {plant.seedsReady && (
              <View style={[s.need, { marginTop: 0, backgroundColor: colors.earthSoft }]}>
                <Icon name="seed" size={12} color={colors.earth} />
                <Text numberOfLines={1} style={[s.needText, { color: colors.earth }]}>Còn hạt</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Press>
  );
}

/**
 * Khu vườn: every plant the family is growing, as a grid of cards to skim by
 * picture. Chips narrow it to the ones that need care now (the default when
 * any do), the ones growing, or the harvest; a search box finds a plant by
 * name once the garden is big enough to need one.
 */
export default function Garden() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ activate?: string }>();
  const [activating, setActivating] = useState(false);
  const [initialCode, setInitialCode] = useState('');
  const [filter, setFilter] = useState<Filter | null>(null);
  const [query, setQuery] = useState('');

  const data = useLoad(async () => {
    if (!user) return null;
    const [list, look, collection] = await Promise.all([
      API.plants.list(), API.garden.benefits().catch(() => null), API.plants.collection().catch(() => null),
    ]);
    return {
      plants: (list.plants || []) as PlantCard[], alerts: (list.alerts || []) as PlantAlert[],
      decoration: look?.decoration as string | undefined, collection: collection as HarvestCollection | null,
    };
  }, [user?.id]);

  // /garden?activate=1 opens the form; /garden?activate=CODE opens it filled in.
  useEffect(() => {
    if (!params.activate || !user) return;
    setInitialCode(params.activate === '1' ? '' : String(params.activate));
    setActivating(true);
    router.setParams({ activate: undefined });
  }, [params.activate, user]);

  const plants = data.data?.plants || [];
  const alerts = data.data?.alerts || [];
  const collection = data.data?.collection;
  const alertsOf = useMemo(() => {
    const map = new Map<string, PlantAlert[]>();
    for (const a of alerts) map.set(a.plantId, [...(map.get(a.plantId) || []), a]);
    return map;
  }, [alerts]);

  const needsCare = (p: PlantCard) => !p.harvestedAt && (Boolean(p.diedAt) || (alertsOf.get(p.id)?.length ?? 0) > 0);
  const counts = {
    care: plants.filter(needsCare).length,
    growing: plants.filter((p) => !p.harvestedAt).length,
    done: plants.filter((p) => p.harvestedAt).length,
    all: plants.length,
  };
  const active: Filter = filter ?? (counts.care > 0 ? 'care' : 'growing');
  const q = strip(query.trim());
  const shown = plants
    .filter((p) => active === 'all' || (active === 'care' ? needsCare(p) : active === 'growing' ? !p.harvestedAt : Boolean(p.harvestedAt)))
    .filter((p) => !q || strip(`${p.nickname} ${p.speciesLabel}`).includes(q))
    .sort((a, b) => urgency(a, alertsOf.get(a.id)?.length ?? 0) - urgency(b, alertsOf.get(b.id)?.length ?? 0));

  const openActivate = () => { setInitialCode(''); setActivating(true); };

  if (!user) {
    return (
      <Screen title="Khu vườn" large>
        <Empty art={<PlantArt stage="sprout" progress={60} health={95} size={150} />} title="Khu vườn của bé" text="Đăng nhập để xem cây, nhận nhắc tưới và hỏi Plant Buddy.">
          <Button title="Đăng nhập" onPress={() => router.push('/login?next=/garden')} />
          <Button title="Tạo tài khoản" variant="ghost" onPress={() => router.push('/register?next=/garden')} />
        </Empty>
      </Screen>
    );
  }

  const streak = Math.max(0, ...plants.map((p) => p.careStreak));
  const CHIPS: Array<{ key: Filter; label: string; n: number }> = [
    ...(counts.care ? [{ key: 'care' as Filter, label: 'Cần chăm', n: counts.care }] : []),
    { key: 'growing', label: 'Đang lớn', n: counts.growing },
    ...(counts.done ? [{ key: 'done' as Filter, label: 'Đã thu hoạch', n: counts.done }] : []),
    { key: 'all', label: 'Tất cả', n: counts.all },
  ];
  const inner = Math.min(width, maxWidth) - gutter * 2;
  const columns = inner >= 640 ? 4 : inner >= 480 ? 3 : 2;
  const tileW = Math.floor((inner - 12 * (columns - 1)) / columns);
  const speciesW = Math.floor((inner - 28) / Math.min(6, Math.max(1, collection?.species.length ?? 1)));

  return (
    <Screen title="Khu vườn" large onRefresh={data.reload}
      actions={(
        <>
          <IconButton icon="album" label="Album ảnh" boxed onPress={() => router.push('/album')} />
          <Press onPress={openActivate} accessibilityLabel="Kích hoạt cây mới" scaleTo={0.94} style={s.add}>
            <Icon name="add" size={18} color={colors.white} />
            <Text style={s.addText}>Kích hoạt</Text>
          </Press>
        </>
      )}>
      {plants.length > 0 && (
        <View style={s.summary}>
          <Stat icon="sprout" value={counts.growing} label="đang lớn" style={{ flex: 1 }} />
          <Stat icon="harvest" value={counts.done} label="thu hoạch" color={colors.gold} tint={colors.goldSoft} style={{ flex: 1 }} />
          <Stat icon="bolt" value={streak} label="ngày liền" color={colors.price} tint="#FFEBD0" style={{ flex: 1 }} />
        </View>
      )}

      {/* The species harvested so far, out of those sold: a full set is a free workshop seat. */}
      {collection && collection.total > 0 && plants.length > 0 && (
        <View style={s.collection}>
          <View style={s.collectionHead}>
            <Icon name="trophy" size={18} color={colors.gold} />
            <Text style={s.collectionTitle}>Bộ sưu tập loài</Text>
            <Text style={s.collectionCount}>{collection.collected}/{collection.total}</Text>
          </View>
          {/* Every species in view at once, six to a row: the empty places are the point. */}
          <View style={s.speciesGrid}>
            {collection.species.map((sp) => (
              <View key={sp.key} style={[s.species, { width: speciesW }]} accessibilityLabel={`${sp.label}: ${sp.harvests ? `đã thu hoạch ${sp.harvests} lần` : 'chưa thu hoạch'}`}>
                <View style={[s.speciesIcon, sp.harvests > 0 && { backgroundColor: colors.mint }]}>
                  <Icon name={sp.icon as IconName} size={19} color={sp.harvests > 0 ? colors.greenDark : colors.ink5} />
                </View>
                <Text numberOfLines={2} style={[s.speciesLabel, sp.harvests > 0 && { color: colors.ink2 }]}>{sp.label}</Text>
                {sp.bestStars > 0 && <HarvestStars value={sp.bestStars} size={9} />}
              </View>
            ))}
          </View>
          <Text style={s.collectionHint}>
            {collection.collected < collection.total ? `Đủ ${collection.total} loài: tặng 1 suất workshop` : 'Đủ bộ! Mỗi vòng đủ loài thêm 1 suất workshop'}
          </Text>
        </View>
      )}

      {data.error ? <ErrorNote message={data.error} onRetry={data.reload} /> : null}
      {data.loading && !data.data && <Loading label="Đang tải vườn của bé…" />}

      {!data.loading && data.data && plants.length === 0 && (
        <Empty art={<PlantArt stage="seed" progress={20} health={95} size={150} />} title="Vườn của bé đang trống" text="Mua một bộ kit, nhập mã kích hoạt — cây đầu tiên nảy mầm ngay.">
          <Button title="Kích hoạt cây" icon="seed" onPress={openActivate} />
          <Button title="Xem các bộ kit" variant="ghost" onPress={() => router.push('/shop')} />
        </Empty>
      )}

      {plants.length > 0 && (
        <View style={{ gap: 10 }}>
          {plants.length > 6 && (
            <View style={s.search}>
              <Icon name="search" size={18} color={colors.ink4} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Tìm cây theo tên…" placeholderTextColor={colors.ink4}
                style={s.searchInput} returnKeyType="search" accessibilityLabel="Tìm cây" />
              {query ? <IconButton icon="close" label="Xoá tìm kiếm" size={18} onPress={() => setQuery('')} /> : null}
            </View>
          )}
          <ChipRow>
            {CHIPS.map((c) => <Chip key={c.key} label={c.label} count={c.n} icon={c.key === 'care' ? 'bell' : undefined} on={active === c.key} onPress={() => setFilter(c.key)} />)}
          </ChipRow>
        </View>
      )}

      {plants.length > 0 && shown.length === 0 && (
        <Empty icon={q ? 'search' : 'check'} title={q ? 'Không thấy cây nào' : 'Không có cây nào ở mục này'}
          text={q ? 'Thử tên khác, hoặc chọn “Tất cả”.' : active === 'care' ? 'Mọi cây đều ổn — bé chăm giỏi quá!' : 'Chọn một mục khác để xem cây.'} />
      )}

      {shown.length > 0 && (
        <View style={s.grid}>
          {shown.map((p) => <PlantTile key={p.id} plant={p} alerts={alertsOf.get(p.id) || []} width={tileW} />)}
        </View>
      )}

      <ActivateSheet open={activating} initialCode={initialCode} onClose={() => { setActivating(false); void data.reload(); }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 42, paddingLeft: 12, paddingRight: 16, borderRadius: radius.pill, backgroundColor: colors.green, ...shadow.sm },
  addText: { fontFamily: fonts.bold, fontSize: 14, color: colors.white },
  summary: { ...surface, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 12 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 50, paddingLeft: 16, paddingRight: 4, borderRadius: radius.pill, backgroundColor: colors.card, ...shadow.sm },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, paddingVertical: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { ...surface, padding: 6 },
  thumb: { aspectRatio: 1.1, borderRadius: radius.md, overflow: 'hidden' },
  health: { position: 'absolute', top: 7, left: 7, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill },
  healthText: { fontFamily: fonts.bold, fontSize: 11 },
  streak: { position: 'absolute', top: 7, right: 7, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.92)' },
  streakText: { fontFamily: fonts.bold, fontSize: 11, color: colors.warn },
  body: { paddingHorizontal: 6, paddingTop: 9, paddingBottom: 6, gap: 4 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  sub: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink3 },
  stages: { flexDirection: 'row', gap: 3, marginTop: 2 },
  stage: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.sand },
  need: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', maxWidth: '100%', marginTop: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.warnSoft },
  needText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 11.5, color: colors.warn },
  done: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4, minHeight: 20 },
  collection: { ...surface, gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  collectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  collectionTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  collectionCount: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, color: colors.gold },
  collectionHint: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink3 },
  speciesGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  species: { alignItems: 'center', gap: 3, paddingHorizontal: 2 },
  speciesIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  speciesLabel: { fontFamily: fonts.semi, fontSize: 11, lineHeight: 14, color: colors.ink4, textAlign: 'center' },
  meters: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, minHeight: 18 },
  sow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.card },
  sowArt: { width: 64, height: 64, borderRadius: 18, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
