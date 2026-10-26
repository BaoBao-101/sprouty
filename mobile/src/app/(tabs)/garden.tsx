import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon } from '@/components/Icon';
import { PlantArt } from '@/components/PlantArt';
import { PlantThumb } from '@/components/PlantThumb';
import { useToast } from '@/components/Toast';
import { Button, Chip, cheer, Empty, ErrorNote, Field, IconButton, Loading, Screen, Sheet, T, tap } from '@/components/ui';
import { API } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { callName } from '@/lib/format';
import type { PlantAlert, PlantCard } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, radius } from '@/theme';

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
      <T muted>Nhập mã trong đơn hàng của bạn — hạt sẽ được gieo ngay.</T>
      <Field label="Mã kích hoạt" value={code} onChangeText={setCode} placeholder="SPR-XXXX-XXXX-XXXX-XXXX" autoCapitalize="characters"
        autoCorrect={false} maxLength={128} error={error} style={{ fontFamily: fonts.bold, letterSpacing: 1 }} />
      <Field label="Đặt tên cho cây (tuỳ chọn)" value={nickname} onChangeText={setNickname} placeholder="Bé Đậu, Cà Chua Nhỏ…" maxLength={40} />
      <T muted style={{ fontSize: 13 }}>Chưa có mã? Mã hiện ngay sau khi thanh toán một bộ kit, trong Đơn hàng của tôi.</T>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button small variant="ghost" title="Đơn hàng của tôi" onPress={() => { onClose(); router.push('/orders'); }} />
        <Button small variant="soft" title="Xem bộ kit" onPress={() => { onClose(); router.push('/shop'); }} />
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

/** One plant, one line high: how it looks, how it is doing, and what it needs now. */
function PlantRow({ plant, alerts, last }: { plant: PlantCard; alerts: PlantAlert[]; last: boolean }) {
  const dead = Boolean(plant.diedAt);
  const done = Boolean(plant.harvestedAt);
  const state = plant.healthState.id;
  const health = dead || state === 'critical' || state === 'wilting' ? { bg: colors.badSoft, fg: colors.bad }
    : done ? { bg: '#FFF1DE', fg: colors.warn }
    : state === 'stressed' ? { bg: colors.warnSoft, fg: colors.warn }
    : { bg: colors.greenSoft, fg: colors.greenDark };
  const note = dead ? 'Gieo lại miễn phí' : alerts[0]?.text;
  return (
    <Pressable onPress={() => { tap(); router.push(`/plant/${plant.id}`); }} accessibilityRole="button" accessibilityLabel={`${plant.nickname}, ${plant.stageLabel}`}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.cream2 }]}>
      <View style={[s.thumb, { backgroundColor: plant.bgColor || '#F0FDF4' }]}>
        <PlantThumb plant={plant} size={64} />
      </View>
      <View style={[s.rowBody, !last && s.divider]}>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={s.nameRow}>
            <Text numberOfLines={1} style={s.name}>{plant.nickname}</Text>
            <View style={[s.pill, { backgroundColor: health.bg }]}>
              <Text style={[s.pillText, { color: health.fg }]}>{done ? 'Đã thu hoạch' : plant.healthState.label}</Text>
            </View>
          </View>
          <Text numberOfLines={1} style={s.sub}>{plant.speciesLabel} · {plant.stageLabel} · chặng {plant.stageIndex + 1}/{plant.stageCount}</Text>
          {!dead && !done && (
            <View style={s.meters}>
              <View style={s.meter}><Icon name="moisture" size={12} color={colors.info} /><View style={s.track}><View style={[s.fill, { width: `${Math.round(plant.moisture)}%`, backgroundColor: '#5BA3D9' }]} /></View></View>
              <View style={s.meter}><Icon name="nutrient" size={12} color={colors.green} /><View style={s.track}><View style={[s.fill, { width: `${Math.round(plant.nutrient)}%`, backgroundColor: colors.greenLight }]} /></View></View>
              {plant.careStreak > 0 && <View style={s.streak}><Icon name="bolt" size={12} color={colors.price} /><Text style={s.streakText}>{plant.careStreak}</Text></View>}
            </View>
          )}
          {note ? (
            <View style={s.note}>
              <Icon name={dead ? 'seed' : 'bell'} size={12} color={dead ? colors.bad : colors.warn} />
              <Text numberOfLines={1} style={[s.noteText, dead && { color: colors.bad }]}>{note}{alerts.length > 1 ? ` (+${alerts.length - 1})` : ''}</Text>
            </View>
          ) : null}
        </View>
        <Icon name="arrow-right" size={16} color={colors.ink5} />
      </View>
    </Pressable>
  );
}

/**
 * Khu vườn: every plant the family is growing, one line each, so thirty
 * plants are a list to skim. Chips narrow it to the ones that need care now
 * (the default when any do), the ones growing, or the harvest; a search box
 * finds a plant by name once the garden is big enough to need one.
 */
export default function Garden() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ activate?: string }>();
  const [activating, setActivating] = useState(false);
  const [initialCode, setInitialCode] = useState('');
  const [filter, setFilter] = useState<Filter | null>(null);
  const [query, setQuery] = useState('');

  const data = useLoad(async () => {
    if (!user) return null;
    const [list, look] = await Promise.all([API.plants.list(), API.garden.benefits().catch(() => null)]);
    return { plants: (list.plants || []) as PlantCard[], alerts: (list.alerts || []) as PlantAlert[], decoration: look?.decoration as string | undefined };
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

  if (!user) {
    return (
      <Screen title="Khu vườn" large>
        <Empty art={<PlantArt stage="sprout" progress={60} health={95} size={150} />} title="Khu vườn của bé" text="Đăng nhập để xem cây của bé, nhận nhắc tưới và trò chuyện với Plant Buddy.">
          <Button title="Đăng nhập" onPress={() => router.push('/login?next=/garden')} />
          <Button title="Tạo tài khoản" variant="ghost" onPress={() => router.push('/register?next=/garden')} />
        </Empty>
      </Screen>
    );
  }

  const streak = Math.max(0, ...plants.map((p) => p.careStreak));
  const CHIPS: Array<{ key: Filter; label: string }> = [
    ...(counts.care ? [{ key: 'care' as Filter, label: `Cần chăm · ${counts.care}` }] : []),
    { key: 'growing', label: `Đang lớn · ${counts.growing}` },
    ...(counts.done ? [{ key: 'done' as Filter, label: `Đã thu hoạch · ${counts.done}` }] : []),
    { key: 'all', label: `Tất cả · ${counts.all}` },
  ];

  return (
    <Screen title="Khu vườn" large onRefresh={data.reload}
      actions={(
        <>
          <IconButton icon="album" label="Album ảnh" onPress={() => router.push('/album')} />
          <Pressable onPress={() => { tap(); setInitialCode(''); setActivating(true); }} accessibilityRole="button" accessibilityLabel="Kích hoạt cây mới"
            style={({ pressed }) => [s.add, pressed && { opacity: 0.85 }]}>
            <Icon name="add" size={18} color={colors.white} />
            <Text style={s.addText}>Kích hoạt</Text>
          </Pressable>
        </>
      )}>
      {plants.length > 0 && (
        <View style={s.summary}>
          <Text style={s.summaryTitle}>Vườn của {callName(user.name) || 'bé'}</Text>
          <View style={s.stats}>
            <Text style={s.stat}><Text style={s.statN}>{counts.growing}</Text> đang lớn</Text>
            <Text style={s.dot}>·</Text>
            <Text style={s.stat}><Text style={s.statN}>{counts.done}</Text> đã thu hoạch</Text>
            {streak > 0 && <><Text style={s.dot}>·</Text><Text style={s.stat}><Text style={[s.statN, { color: colors.price }]}>{streak}</Text> ngày liên tục</Text></>}
          </View>
        </View>
      )}

      {data.error ? <ErrorNote message={data.error} onRetry={data.reload} /> : null}
      {data.loading && !data.data && <Loading label="Đang tải vườn của bé…" />}

      {!data.loading && data.data && plants.length === 0 && (
        <Empty art={<PlantArt stage="seed" progress={20} health={95} size={150} />} title="Vườn của bé đang trống" text="Mua một bộ kit, nhập mã kích hoạt, và bé sẽ có cây đầu tiên cùng cảm biến độ ẩm, nhiệt độ và Plant Buddy đi kèm.">
          <Button title="Kích hoạt cây" icon="seed" onPress={() => { setInitialCode(''); setActivating(true); }} />
          <Button title="Khám phá các bộ kit" variant="ghost" onPress={() => router.push('/shop')} />
        </Empty>
      )}

      {plants.length > 0 && (
        <View style={{ gap: 10 }}>
          {plants.length > 6 && (
            <View style={s.search}>
              <Icon name="search" size={17} color={colors.ink4} />
              <TextInput value={query} onChangeText={setQuery} placeholder="Tìm cây theo tên…" placeholderTextColor={colors.ink5}
                style={s.searchInput} returnKeyType="search" accessibilityLabel="Tìm cây" />
              {query ? <IconButton icon="close" label="Xoá tìm kiếm" onPress={() => setQuery('')} /> : null}
            </View>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsOuter} contentContainerStyle={s.chips}>
            {CHIPS.map((c) => <Chip key={c.key} label={c.label} on={active === c.key} onPress={() => setFilter(c.key)} />)}
          </ScrollView>
        </View>
      )}

      {plants.length > 0 && shown.length === 0 && (
        <Empty icon={q ? 'search' : 'check'} title={q ? 'Không thấy cây nào' : 'Không có cây nào ở mục này'}
          text={q ? 'Thử tên khác, hoặc chọn “Tất cả”.' : active === 'care' ? 'Mọi cây đều ổn — bé chăm giỏi quá!' : 'Chọn một mục khác để xem cây.'} />
      )}

      {shown.length > 0 && (
        <View style={s.list}>
          {shown.map((p, i) => <PlantRow key={p.id} plant={p} alerts={alertsOf.get(p.id) || []} last={i === shown.length - 1} />)}
        </View>
      )}

      <ActivateSheet open={activating} initialCode={initialCode} onClose={() => { setActivating(false); void data.reload(); }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingLeft: 10, paddingRight: 14, marginLeft: 4, borderRadius: radius.pill, backgroundColor: colors.green },
  addText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.white },
  summary: { gap: 2 },
  summaryTitle: { fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.ink },
  stats: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  stat: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink3 },
  statN: { fontFamily: fonts.bold, color: colors.greenDark },
  dot: { color: colors.ink5 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, paddingLeft: 14, paddingRight: 4, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 15, color: colors.ink, paddingVertical: 8 },
  chipsOuter: { marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16 },
  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 12, paddingTop: 12 },
  thumb: { width: 64, height: 64, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'flex-end' },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12, paddingBottom: 12, minHeight: 76 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 15.5, color: colors.ink },
  pill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  pillText: { fontFamily: fonts.bold, fontSize: 11 },
  sub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink3 },
  meters: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  meter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  track: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#E8EEE6', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  streakText: { fontFamily: fonts.bold, fontSize: 12, color: colors.price },
  note: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.warn },
});
