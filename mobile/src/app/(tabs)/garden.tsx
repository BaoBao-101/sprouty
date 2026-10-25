import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { PlantArt } from '@/components/PlantArt';
import { useToast } from '@/components/Toast';
import { Button, Card, cheer, Empty, ErrorNote, Field, H, IconButton, Loading, Screen, Sheet, T } from '@/components/ui';
import { API } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { callName } from '@/lib/format';
import type { PlantAlert, PlantCard } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme';

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

function tone(value: number, low: number, warn: number, invert = false) {
  const bad = invert ? value > low : value < low;
  const meh = invert ? value > warn : value < warn;
  return bad ? colors.bad : meh ? colors.warn : colors.green;
}

function Metric({ icon, label, value, color }: { icon: IconName; label: string; value: number; color: string }) {
  return (
    <View style={s.metric}>
      <Icon name={icon} size={15} color={color} />
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={[s.metricValue, { color }]}>{Math.round(value)}%</Text>
    </View>
  );
}

function PlantCardView({ plant, alert, width, decoration }: { plant: PlantCard; alert?: PlantAlert; width: number; decoration?: string }) {
  const done = Boolean(plant.harvestedAt);
  return (
    <Pressable onPress={() => router.push(`/plant/${plant.id}`)} style={({ pressed }) => [s.card, { width }, alert && { borderColor: '#F2C27A' }, pressed && { opacity: 0.9 }]}>
      <View style={[s.art, { backgroundColor: plant.bgColor || '#F0FDF4' }]}>
        <PlantArt stage={plant.stage} progress={plant.stageProgress} health={plant.health} form={plant.form}
          fruitShape={plant.fruitShape} fruitColor={plant.fruitColor} flowerColor={plant.flowerColor} size={Math.min(170, width - 24)}
          decoration={decoration as never} />
      </View>
      <View style={{ padding: 12, gap: 8 }}>
        <View style={{ gap: 2 }}>
          <Text numberOfLines={1} style={s.name}>{plant.nickname}</Text>
          <Text numberOfLines={1} style={s.sub}>{plant.speciesLabel} · {plant.stageLabel}</Text>
          <View style={[s.health, plant.diedAt && { backgroundColor: colors.badSoft }, done && { backgroundColor: '#FFF1DE' }]}>
            <Icon name={done ? 'trophy' : 'heart'} size={13} color={plant.diedAt ? colors.bad : done ? colors.warn : colors.greenDark} />
            <Text style={[s.healthText, plant.diedAt && { color: colors.bad }, done && { color: colors.warn }]}>{done ? 'Đã thu hoạch' : plant.healthState.label}</Text>
          </View>
        </View>
        <View style={s.track}>
          {Array.from({ length: plant.stageCount }).map((_, i) => (
            <View key={i} style={[s.tick, i < plant.stageIndex && s.tickDone, i === plant.stageIndex && s.tickNow]} />
          ))}
        </View>
        {!done && !plant.diedAt && (
          <View style={{ gap: 4 }}>
            <Metric icon="moisture" label="Độ ẩm" value={plant.moisture} color={plant.moisture > 85 ? colors.warn : tone(plant.moisture, 35, 45)} />
            <Metric icon="nutrient" label="Dinh dưỡng" value={plant.nutrient} color={tone(plant.nutrient, 30, 45)} />
            <Metric icon="pest" label="Sâu bệnh" value={plant.pestRisk} color={tone(plant.pestRisk, 55, 40, true)} />
          </View>
        )}
        {plant.careStreak > 0 && (
          <View style={s.streak}><Icon name="bolt" size={14} color={colors.price} /><Text style={s.streakText}>{plant.careStreak} ngày liên tục</Text></View>
        )}
        {alert && <View style={s.alert}><Icon name="bell" size={14} color={colors.warn} /><Text numberOfLines={3} style={s.alertText}>{alert.text}</Text></View>}
        <View style={s.open}>
          <Text style={s.openText}>{plant.diedAt ? 'Gieo lại cây' : done ? 'Xem lại' : 'Vào chăm cây'}</Text>
          <Icon name="arrow-right" size={16} color={colors.green} />
        </View>
      </View>
    </Pressable>
  );
}

/**
 * Khu vườn: every plant the family is growing, with what each needs right
 * now, so a child can see which one is thirsty without opening it. Sowing a
 * new kit's code is the button at the top.
 */
export default function Garden() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ activate?: string }>();
  const { width } = useWindowDimensions();
  const [activating, setActivating] = useState(false);
  const [initialCode, setInitialCode] = useState('');

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

  const plants = data.data?.plants || [];
  const alerts = data.data?.alerts || [];
  const growing = plants.filter((p) => !p.harvestedAt);
  const harvested = plants.filter((p) => p.harvestedAt);
  const alertFor = (id: string) => alerts.find((a) => a.plantId === id);

  const inner = Math.min(width, maxWidth) - gutter * 2;
  const columns = inner >= 640 ? 3 : 2;
  const cardWidth = Math.floor((inner - 12 * (columns - 1)) / columns);

  return (
    <Screen title="Khu vườn" large onRefresh={data.reload}
      actions={<IconButton icon="album" label="Album ảnh" onPress={() => router.push('/album')} />}>
      <View style={s.hero}>
        <View style={{ flex: 1, gap: 4 }}>
          <H size={21}>Vườn của {callName(user.name) || 'bé'}</H>
          <T muted>Chăm đúng lúc, đọc cảm biến — Plant Buddy đi cùng bé từ hạt tới ngày thu hoạch.</T>
        </View>
      </View>
      {data.data && <View style={s.stats}>
        {[
          { n: growing.length, label: 'đang lớn' },
          { n: harvested.length, label: 'đã thu hoạch' },
          { n: Math.max(0, ...plants.map((p) => p.careStreak)), label: 'ngày liên tục' },
        ].map((x) => (
          <View key={x.label} style={s.stat}><Text style={s.statN}>{x.n}</Text><Text style={s.statL}>{x.label}</Text></View>
        ))}
      </View>}
      <Button title="Kích hoạt cây mới" icon="seed" onPress={() => { setInitialCode(''); setActivating(true); }} />

      {data.error ? <ErrorNote message={data.error} onRetry={data.reload} /> : null}
      {data.loading && !data.data && <Loading label="Đang tải vườn của bé…" />}

      {alerts.length > 0 && (
        <Card tone="warn">
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Icon name="bell" size={20} color={colors.warn} />
            <T bold>{alerts.length} việc cây đang cần bạn</T>
          </View>
          {alerts.slice(0, 3).map((a, i) => (
            <Pressable key={i} onPress={() => router.push(`/plant/${a.plantId}`)} style={s.alertRow}>
              <T style={{ flex: 1 }}><T bold>{a.nickname}</T> — {a.text}</T>
              <Icon name="arrow-right" size={16} color={colors.ink3} />
            </Pressable>
          ))}
        </Card>
      )}

      {!data.loading && data.data && plants.length === 0 && (
        <Empty art={<PlantArt stage="seed" progress={20} health={95} size={150} />} title="Vườn của bé đang trống" text="Mua một bộ kit, nhập mã kích hoạt, và bé sẽ có cây đầu tiên cùng cảm biến độ ẩm, nhiệt độ và Plant Buddy đi kèm.">
          <Button title="Khám phá các bộ kit" icon="arrow-right" onPress={() => router.push('/shop')} />
        </Empty>
      )}

      {growing.length > 0 && (
        <>
          <View style={s.group}><Icon name="leaf" size={20} color={colors.green} /><H size={19}>Đang lớn</H></View>
          <View style={s.grid}>
            {growing.map((p) => <PlantCardView key={p.id} plant={p} alert={alertFor(p.id)} width={cardWidth} decoration={data.data?.decoration} />)}
          </View>
        </>
      )}
      {harvested.length > 0 && (
        <>
          <View style={s.group}><Icon name="trophy" size={20} color={colors.price} /><H size={19}>Đã thu hoạch</H></View>
          <View style={s.grid}>
            {harvested.map((p) => <PlantCardView key={p.id} plant={p} width={cardWidth} decoration={data.data?.decoration} />)}
          </View>
        </>
      )}

      <ActivateSheet open={activating} initialCode={initialCode} onClose={() => { setActivating(false); void data.reload(); }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, paddingVertical: 10, borderRadius: radius.md, backgroundColor: colors.greenSoft, alignItems: 'center' },
  statN: { fontFamily: fonts.display, fontSize: 24, color: colors.greenDark, lineHeight: 30 },
  statL: { fontFamily: fonts.semi, fontSize: 12, color: colors.ink3 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 40 },
  group: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  art: { alignItems: 'center', justifyContent: 'flex-end', paddingTop: 8 },
  health: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.greenSoft },
  healthText: { fontFamily: fonts.bold, fontSize: 11, color: colors.greenDark },
  name: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.ink },
  sub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3 },
  track: { flexDirection: 'row', gap: 3 },
  tick: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#E6ECE0' },
  tickDone: { backgroundColor: colors.greenLight },
  tickNow: { backgroundColor: colors.green },
  metric: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricLabel: { flex: 1, fontFamily: fonts.body, fontSize: 12, color: colors.ink3 },
  metricValue: { fontFamily: fonts.bold, fontSize: 12.5 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakText: { fontFamily: fonts.bold, fontSize: 12, color: colors.price },
  alert: { flexDirection: 'row', gap: 6, padding: 8, borderRadius: 10, backgroundColor: colors.warnSoft },
  alertText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.warn },
  open: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 },
  openText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.green },
});
