import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Icon, type IconName } from '@/components/Icon';
import { ProductVideos } from '@/components/media';
import { PlantArt } from '@/components/PlantArt';
import { useToast } from '@/components/Toast';
import { Button, Card, CardTitle, cheer, Field, H, IconButton, Loading, Screen, Sheet, T, tap } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { formatCountdown, formatDateTime, plainAiText } from '@/lib/format';
import type { CareSlot, CoachMessage, PlantDetail, PlantDevice, PlantEvent } from '@/lib/types';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme';

const aiMark = imageSource('/assets/images/sprouty-mark.png') as number;
const QUICK_ASKS = ['Tại sao lá bị vàng?', 'Bao lâu nữa cây lớn?', 'Nên bật thiết bị nào?'];

type Band = 'good' | 'warn' | 'bad';
const BAND: Record<Band, { fg: string; bg: string }> = {
  good: { fg: colors.greenDark, bg: colors.greenSoft },
  warn: { fg: colors.warn, bg: colors.warnSoft },
  bad: { fg: colors.bad, bg: colors.badSoft },
};

function metricBand(value: number, ideal?: [number, number]): Band {
  if (!ideal) return value >= 60 ? 'good' : value >= 35 ? 'warn' : 'bad';
  if (value < ideal[0] - 18 || value > ideal[1] + 18) return 'bad';
  if (value < ideal[0] || value > ideal[1]) return 'warn';
  return 'good';
}

/** What a reading means, in a child's words; the number follows, smaller. Same as the website. */
function verdict(kind: string, value: number, ideal?: [number, number]): string {
  switch (kind) {
    case 'moisture': {
      const [lo, hi] = ideal ?? [45, 70];
      if (value < lo - 18) return 'Khô cong';
      if (value < lo) return 'Hơi khô';
      if (value > hi + 15) return 'Úng nước';
      if (value > hi) return 'Hơi ướt';
      return 'Vừa đẹp';
    }
    case 'temperature': {
      const [lo, hi] = ideal ?? [20, 32];
      if (value < lo - 4) return 'Lạnh quá';
      if (value < lo) return 'Hơi lạnh';
      if (value > hi + 4) return 'Nóng quá';
      if (value > hi) return 'Hơi nóng';
      return 'Vừa đẹp';
    }
    case 'light':
      if (value > 60) return 'Nắng đẹp';
      if (value > 30) return 'Đủ sáng';
      if (value > 8) return 'Trời dịu';
      return 'Trời tối';
    case 'nutrient':
      if (value > 60) return 'Còn no';
      if (value > 40) return 'Hơi đói';
      if (value > 25) return 'Đói rồi';
      return 'Hết sạch';
    case 'pest':
      if (value < 20) return 'Sạch bong';
      if (value < 40) return 'Vẫn ổn';
      if (value < 58) return 'Có sâu';
      return 'Nhiều sâu';
    default:
      return '';
  }
}

/** Ticks every second, so cooldowns count down on screen rather than on refresh. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const secondsLeft = (slot: CareSlot, fetchedAt: number, now: number) => (slot.ready ? 0 : Math.max(0, slot.secondsLeft - (now - fetchedAt) / 1000));

function groupFeed(feed: PlantEvent[]) {
  const out: Array<PlantEvent & { count: number }> = [];
  for (const event of feed) {
    const same = out.find((e) => e.text === event.text && e.level === event.level);
    if (same) same.count += 1;
    else out.push({ ...event, count: 1 });
  }
  return out;
}

/** A sensor's reading: the plain-words verdict first, the measurement under it. */
function SensorTile({ icon, label, value, unit = '%', kind, ideal, band, device, width }: {
  icon: IconName; label: string; value: number; unit?: string; kind: string; ideal?: [number, number]; band: Band; device?: PlantDevice; width: number;
}) {
  const locked = device && !device.unlocked;
  const c = locked ? { fg: colors.ink4, bg: '#F1F4EE' } : BAND[band];
  return (
    <View style={[s.sensor, { width, backgroundColor: c.bg }]}>
      <View style={s.sensorHead}>
        <Icon name={locked ? 'lock' : icon} size={18} color={c.fg} />
        <Text numberOfLines={1} style={s.sensorLabel}>{label}</Text>
      </View>
      {locked ? (
        <>
          <Text style={[s.sensorVerdict, { color: c.fg }]}>Chưa đo</Text>
          <Text style={s.sensorNum}>Mở ở chặng {device?.unlockStageLabel}</Text>
        </>
      ) : (
        <>
          <Text style={[s.sensorVerdict, { color: c.fg }]}>{verdict(kind, value, ideal)}</Text>
          <Text style={s.sensorNum}>{Math.round(value)}{unit}</Text>
        </>
      )}
    </View>
  );
}

/** A section that folds: the journal and videos are looked up now and then, not every visit. */
function Fold({ icon, title, sub, open, onToggle, dot, children }: {
  icon: IconName; title: string; sub: string; open: boolean; onToggle: () => void; dot?: boolean; children: ReactNode;
}) {
  return (
    <Card style={{ padding: 0, gap: 0 }}>
      <Pressable onPress={() => { tap(); onToggle(); }} style={s.foldHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Icon name={icon} size={20} color={colors.green} />
        <View style={{ flex: 1 }}>
          <T bold>{title}</T>
          <T muted style={{ fontSize: 13 }}>{sub}</T>
        </View>
        {dot && !open ? <View style={s.dot} /> : null}
        <View style={open ? { transform: [{ rotate: '180deg' }] } : undefined}><Icon name="arrow-down" size={18} color={colors.ink3} /></View>
      </Pressable>
      {open && <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>{children}</View>}
    </Card>
  );
}

/**
 * One plant. In the order a child needs it: the plant, the one thing to do
 * next, the care buttons, then the sensors that explain why, the devices,
 * and Sprouty AI to ask. The recommended care is highlighted among the
 * buttons, so doing what the coach said and pressing the button are one tap.
 */
export default function PlantScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const now = useNow();
  const { width } = useWindowDimensions();

  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [careBusy, setCareBusy] = useState<string | null>(null);
  const [deviceBusy, setDeviceBusy] = useState('');
  const [feed, setFeed] = useState<PlantEvent[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [videosOpen, setVideosOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [replanting, setReplanting] = useState(false);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [coachBusy, setCoachBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);

  const apply = useCallback((detail: PlantDetail, events: PlantEvent[] = []) => {
    setPlant(detail);
    setFetchedAt(Date.now());
    if (detail.coachMessages) setMessages(detail.coachMessages);
    if (events.length) setFeed((prev) => [...events, ...prev].slice(0, 12));
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await API.plants.get(id);
      apply(data.plant, data.events || []);
    } catch (err: any) {
      toast(err?.message || 'Không tải được cây này.', 'error');
      router.replace('/garden');
    } finally {
      setLoading(false);
    }
  }, [id, apply, toast]);

  useEffect(() => { void load(); }, [load]);

  async function care(action: string) {
    if (careBusy) return;
    setCareBusy(action);
    try {
      const data = await API.plants.care(id, action);
      apply(data.plant, data.messages || []);
      const headline = (data.messages || []).find((m: PlantEvent) => m.level === 'warn') ?? (data.messages || [])[0];
      if (headline?.level !== 'warn') cheer();
      toast(headline?.text || (data.growth > 0 ? `+${data.growth} điểm phát triển` : 'Đã chăm cây'), headline?.level === 'warn' ? 'error' : 'success');
      if (data.harvested) setTimeout(() => toast('Hành trình hoàn thành! Chúc mừng bé.', 'success'), 3200);
      for (const type of data.newlyUnlocked || []) {
        const unlocked = data.plant.devices.find((d: PlantDevice) => d.type === type);
        if (unlocked) setTimeout(() => toast(`Thiết bị mới: ${unlocked.label}`, 'success'), 3200);
      }
    } catch (err: any) {
      toast(err?.message || 'Không chăm cây được lúc này.', 'error');
      if (err?.status === 429 || err?.status === 409) void load();
    } finally {
      setCareBusy(null);
    }
  }

  async function replant() {
    setReplanting(true);
    try {
      const data = await API.plants.replant(id);
      apply(data.plant);
      toast(data.message || 'Đã gieo lại hạt mới.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Chưa gieo lại được, thử lại nhé.', 'error');
    } finally {
      setReplanting(false);
    }
  }

  async function toggleDevice(type: string, next: boolean) {
    setDeviceBusy(type);
    try {
      const data = await API.plants.setDevice(id, type, next);
      toast(data.message || (next ? 'Đã bật' : 'Đã tắt'), 'success');
      await load();
    } catch (err: any) {
      toast(err?.message || 'Không đổi được chế độ thiết bị.', 'error');
    } finally {
      setDeviceBusy('');
    }
  }

  async function ask(text?: string) {
    if (coachBusy) return;
    const asked = text?.trim() || 'Cây của mình giờ thế nào, mình nên làm gì tiếp theo?';
    const pending: CoachMessage = { id: `pending-${Date.now()}`, role: 'user', content: asked, createdAt: new Date().toISOString() };
    setMessages((prev) => [...prev, pending]);
    setQuestion('');
    setCoachBusy(true);
    try {
      const data = await API.plants.coach(id, text);
      setMessages((prev) => [...prev, { id: `reply-${Date.now()}`, role: 'assistant', content: data.reply, createdAt: new Date().toISOString() }]);
    } catch (err: any) {
      // Never recorded: leaving it would look like Sprouty AI chose not to answer.
      setMessages((prev) => prev.filter((m) => m.id !== pending.id));
      toast(err?.message || 'Sprouty AI đang nghỉ một chút, thử lại sau nhé.', 'error');
    } finally {
      setCoachBusy(false);
    }
  }

  function clearCoach() {
    Alert.alert('Xoá trò chuyện?', 'Xoá toàn bộ lịch sử trò chuyện với Sprouty AI về cây này?', [
      { text: 'Không', style: 'cancel' },
      { text: 'Xoá', style: 'destructive', onPress: async () => {
        try { await API.plants.clearCoach(id); setMessages([]); } catch (err: any) { toast(err?.message || 'Không xoá được lịch sử.', 'error'); }
      } },
    ]);
  }

  async function saveName() {
    const next = nameDraft.trim();
    if (!plant || !next || next === plant.nickname) return setRenaming(false);
    try {
      await API.plants.rename(id, next);
      setPlant({ ...plant, nickname: next });
      setRenaming(false);
      toast('Đã đổi tên cây.', 'success');
    } catch (err: any) {
      toast(err?.message || 'Không đổi được tên.', 'error');
    }
  }

  if (loading || !plant) {
    return <Screen title="Cây của bé" back="/garden"><Loading label="Đang mở vườn…" /></Screen>;
  }

  const harvested = Boolean(plant.harvestedAt);
  const dead = Boolean(plant.diedAt);
  const critical = !dead && plant.wilt.critical;
  const hoursLeft = plant.wilt.hoursLeft === null ? '' : plant.wilt.hoursLeft >= 48 ? `${Math.round(plant.wilt.hoursLeft / 24)} ngày` : `${plant.wilt.hoursLeft} giờ`;
  const slots = plant.care.filter((c) => c.allowedInStage || c.action !== 'harvest');
  const recommended = plant.nextStep.action;
  const device = (type: string) => plant.devices.find((d) => d.type === type);
  const actuators = plant.devices.filter((d) => d.kind === 'actuator');
  const hour = plant.environment.hour;
  const clock = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60) % 60).padStart(2, '0')}`;

  const inner = Math.min(width, maxWidth) - gutter * 2;
  const careCols = inner >= 600 ? 5 : inner >= 420 ? 4 : 3;
  // Inside a card: 16 padding and a 1px border each side. Floored, so rounding never wraps a row.
  const careWidth = Math.floor((inner - 34 - 8 * (careCols - 1)) / careCols);
  const sensorCols = inner >= 600 ? 5 : inner >= 420 ? 3 : 2;
  const sensorWidth = Math.floor((inner - 34 - 8 * (sensorCols - 1)) / sensorCols);
  const artSize = Math.min(300, inner - 40);

  return (
    <View style={{ flex: 1 }}>
      <Screen title={plant.nickname} back="/garden" onRefresh={load}
        actions={(
          <>
            <IconButton icon="pencil" label="Đổi tên cây" onPress={() => { setNameDraft(plant.nickname); setRenaming(true); }} />
            <IconButton icon="album" label="Album kỷ niệm" onPress={() => router.push(`/album?productId=${plant.productId}&plantId=${plant.id}`)} />
          </>
        )}>
        {/* The plant */}
        <View style={[s.artPane, { backgroundColor: plant.bgColor || '#F0FDF4' }]}>
          <View style={s.clock}>
            <Icon name={plant.environment.isDay ? 'sun' : 'moon'} size={15} color={colors.ink2} />
            <Text style={s.clockText}>{plant.environment.isDay ? 'Ban ngày' : 'Ban đêm'} · {clock}</Text>
          </View>
          <PlantArt stage={plant.stage} progress={plant.stageProgress} health={plant.health} form={plant.form} fruitShape={plant.fruitShape}
            fruitColor={plant.fruitColor} flowerColor={plant.flowerColor} isNight={!plant.environment.isDay} size={artSize} />
          {dead && (
            <View style={s.dead}>
              <Icon name="leaf" size={28} color={colors.earth} />
              <H size={19}>Cây đã héo khô</H>
              <T style={{ textAlign: 'center' }}>{plant.nickname} không được chăm quá lâu nên đã không qua khỏi. Bộ kit vẫn còn — gieo hạt mới miễn phí, lần này nhớ ghé chăm đều tay nhé.</T>
              <Button icon="seed" title={replanting ? 'Đang gieo…' : 'Gieo lại từ hạt'} busy={replanting} onPress={replant} />
            </View>
          )}
        </View>

        <View style={s.badges}>
          <View style={[s.badge, { backgroundColor: dead ? colors.badSoft : colors.greenSoft }]}>
            <Icon name="heart" size={15} color={dead ? colors.bad : colors.greenDark} />
            <Text style={[s.badgeText, dead && { color: colors.bad }]}>{plant.healthState.label}{dead ? '' : ` ${Math.round(plant.health)}%`}</Text>
          </View>
          {plant.careStreak > 0 && <View style={[s.badge, { backgroundColor: '#FFF1DE' }]}><Icon name="bolt" size={15} color={colors.price} /><Text style={[s.badgeText, { color: colors.warn }]}>{plant.careStreak} ngày liên tục</Text></View>}
          {plant.keeper?.on && !dead && <View style={[s.badge, { backgroundColor: colors.infoSoft }]}><Icon name="shield" size={15} color={colors.info} /><Text style={[s.badgeText, { color: colors.info }]}>Bộ chăm tự động</Text></View>}
          {plant.attempt > 1 && <View style={[s.badge, { backgroundColor: colors.earthSoft }]}><Icon name="seed" size={15} color={colors.earth} /><Text style={[s.badgeText, { color: colors.earth }]}>Lần trồng thứ {plant.attempt}</Text></View>}
        </View>
        <T muted>{plant.productName} · giống {plant.speciesLabel} · thu hoạch {plant.harvestLabel}</T>

        {/* What to do next */}
        {!dead && (
          <Card tone={critical ? 'danger' : harvested ? 'soft' : undefined} style={!critical && !harvested ? { borderColor: '#CFE9C9', backgroundColor: colors.cream2 } : undefined}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={[s.todoIcon, critical && { backgroundColor: '#F9D9DE' }]}>
                <Icon name={harvested ? 'trophy' : critical ? 'warning' : plant.nextStep.icon} size={24} color={critical ? colors.bad : colors.greenDark} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.kicker, critical && { color: colors.bad }]}>{harvested ? 'ĐÃ HOÀN THÀNH' : critical ? `CỨU CÂY NGAY — CÒN KHOẢNG ${hoursLeft.toUpperCase()}` : 'VIỆC NÊN LÀM'}</Text>
                <T bold style={{ fontSize: 16 }}>{harvested ? `Bé đã thu hoạch ${plant.harvestLabel}!` : plant.nextStep.label || 'Chờ dụng cụ hồi lại'}</T>
                <T muted>{harvested ? 'Mở một bộ kit mới để trồng cây khác nhé.' : critical ? `Cây đang héo nặng, để lâu nữa sẽ héo khô. ${plant.nextStep.why}` : plant.nextStep.why}</T>
              </View>
            </View>
            {critical && plant.keeper && !plant.keeper.vip && (
              <Button small variant="ghost" icon="star" title="VIP có Bộ chăm tự động giữ cây không héo" onPress={() => router.push('/vip')} />
            )}
          </Card>
        )}

        {/* Care */}
        {!dead && !harvested && (
          <Card>
            <CardTitle icon="water" right={<Pressable hitSlop={8} onPress={() => setGuideOpen(true)} style={s.help}><Icon name="info" size={16} color={colors.green} /><Text style={s.helpText}>Cây cần gì?</Text></Pressable>}>Chăm cây</CardTitle>
            <View style={s.grid}>
              {slots.map((slot) => {
                const left = secondsLeft(slot, fetchedAt, now);
                const locked = !slot.allowedInStage;
                const ready = !locked && left <= 0;
                const busy = careBusy === slot.action;
                const isRec = slot.action === recommended && ready;
                const task = plant.tasks.find((t) => t.action === slot.action);
                return (
                  <Pressable key={slot.action} disabled={!ready || Boolean(careBusy)} onPress={() => { tap(); void care(slot.action); }}
                    accessibilityRole="button" accessibilityLabel={`${slot.label}${ready ? '' : locked ? ', chưa dùng được ở chặng này' : `, còn ${formatCountdown(left)}`}`}
                    style={({ pressed }) => [s.care, { width: careWidth }, isRec && s.careRec, !ready && s.careOff, pressed && { transform: [{ scale: 0.96 }] }]}>
                    {task && task.done < task.need ? <View style={s.taskDot}><Text style={s.taskDotText}>{task.done}/{task.need}</Text></View> : null}
                    <View style={[s.careIcon, isRec && { backgroundColor: colors.green }]}>
                      <Icon name={locked ? 'lock' : slot.icon} size={24} color={isRec ? colors.white : ready ? colors.greenDark : colors.ink4} />
                    </View>
                    <Text numberOfLines={2} style={[s.careLabel, !ready && { color: colors.ink4 }]}>{busy ? 'Đang làm…' : slot.label}</Text>
                    {!ready && <Text style={s.careWait}>{locked ? 'Chưa mở' : formatCountdown(left)}</Text>}
                  </Pressable>
                );
              })}
            </View>
          </Card>
        )}

        {/* Stage */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
            <T muted>Chặng hiện tại</T>
            <T bold style={{ flex: 1, fontSize: 16 }}>{plant.stageLabel}</T>
            <Text style={s.percent}>{Math.round(plant.stageProgress)}%</Text>
          </View>
          <View style={s.bar}><View style={[s.barFill, { width: `${Math.round(plant.stageProgress)}%` }]} /></View>
          {plant.tasks.length > 0 && !dead && (
            <View style={{ gap: 6 }}>
              <T bold style={{ color: plant.tasksDone ? colors.greenDark : colors.ink2 }}>
                {plant.tasksDone ? 'Xong nhiệm vụ chặng này' : plant.pointsFull ? 'Đủ điểm rồi — làm nốt nhiệm vụ để lên chặng' : 'Nhiệm vụ để lên chặng'}
              </T>
              {plant.tasks.map((t) => (
                <View key={t.action} style={s.task}>
                  <Icon name={t.done >= t.need ? 'check' : t.icon} size={16} color={t.done >= t.need ? colors.green : colors.ink3} />
                  <T style={{ flex: 1 }}>{t.label}</T>
                  <T bold>{t.done}/{t.need}</T>
                </View>
              ))}
            </View>
          )}
          <T muted>{plant.stageStory}</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingVertical: 4 }}>
            {plant.stages.map((st, i) => (
              <View key={st.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {i > 0 && <View style={[s.journeyLine, st.reached && { backgroundColor: colors.greenLight }]} />}
                <View style={{ alignItems: 'center', gap: 4, width: 64 }}>
                  <View style={[s.journeyDot, st.reached && s.journeyReached, st.current && s.journeyNow]}>
                    <Icon name={st.reached && !st.current ? 'check' : st.icon} size={17} color={st.current ? colors.white : st.reached ? colors.greenDark : colors.ink4} />
                  </View>
                  <Text numberOfLines={2} style={[s.journeyLabel, st.current && { color: colors.ink, fontFamily: fonts.bold }]}>{st.label}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </Card>

        {/* Sensors */}
        <Card>
          <CardTitle icon="chart">Cảm biến</CardTitle>
          <T muted style={{ fontSize: 13 }}>Xanh là cây đang vui, vàng là hơi mệt, đỏ là cần giúp ngay. Chặng này cây thích đất ẩm {plant.idealMoisture[0]}–{plant.idealMoisture[1]}% và {plant.idealTemp[0]}–{plant.idealTemp[1]}°C.</T>
          <View style={s.grid}>
            <SensorTile width={sensorWidth} icon="moisture" kind="moisture" label="Nước trong đất" value={plant.moisture} ideal={plant.idealMoisture} band={metricBand(plant.moisture, plant.idealMoisture)} device={device('moisture_sensor')} />
            <SensorTile width={sensorWidth} icon="thermo" kind="temperature" label="Nhiệt độ" unit="°C" value={plant.environment.temperature} ideal={plant.idealTemp} band={metricBand(plant.environment.temperature, plant.idealTemp)} device={device('thermo_sensor')} />
            <SensorTile width={sensorWidth} icon="light" kind="light" label="Ánh sáng" value={plant.environment.light} band={plant.environment.light > 35 || !plant.environment.isDay ? 'good' : 'warn'} device={device('light_sensor')} />
            <SensorTile width={sensorWidth} icon="nutrient" kind="nutrient" label="Thức ăn của cây" value={plant.nutrient} band={plant.nutrient > 45 ? 'good' : plant.nutrient > 28 ? 'warn' : 'bad'} device={device('nutrient_sensor')} />
            <SensorTile width={sensorWidth} icon="pest" kind="pest" label="Sâu bệnh" value={plant.pestRisk} band={plant.pestRisk < 40 ? 'good' : plant.pestRisk < 58 ? 'warn' : 'bad'} device={device('camera')} />
          </View>
        </Card>

        {/* Devices that act on their own */}
        {actuators.length > 0 && (
          <Card>
            <CardTitle icon="bolt">Thiết bị tự động</CardTitle>
            {actuators.map((d) => {
              const off = !d.unlocked || d.vipLocked;
              return (
                <View key={d.type} style={s.device}>
                  <View style={[s.deviceIcon, off && { backgroundColor: '#F1F4EE' }]}><Icon name={off ? 'lock' : d.icon} size={20} color={off ? colors.ink4 : colors.greenDark} /></View>
                  <View style={{ flex: 1 }}>
                    <T bold>{d.label}</T>
                    <T muted style={{ fontSize: 13 }}>{!d.unlocked ? `Mở ở chặng ${d.unlockStageLabel}` : d.vipLocked ? 'Dành cho thành viên VIP Garden' : d.about}</T>
                  </View>
                  {d.vipLocked && d.unlocked ? (
                    <Button small variant="ghost" title="VIP" onPress={() => router.push('/vip')} />
                  ) : (
                    <Switch value={d.autoMode} disabled={off || Boolean(deviceBusy)} onValueChange={(v) => toggleDevice(d.type, v)}
                      trackColor={{ true: colors.green, false: colors.ink5 }} thumbColor={colors.white} accessibilityLabel={`Tự động ${d.label}`} />
                  )}
                </View>
              );
            })}
          </Card>
        )}

        {/* Sprouty AI */}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={s.aiAvatar}><Image source={aiMark} style={{ width: 26, height: 26 }} contentFit="contain" /></View>
            <View style={{ flex: 1 }}>
              <T bold>Sprouty AI</T>
              <T muted style={{ fontSize: 13 }}>{coachBusy ? 'đang xem cây…' : 'Bạn đồng hành chăm cây'}</T>
            </View>
            {messages.length > 0 && <IconButton icon="trash" label="Xoá lịch sử trò chuyện" onPress={clearCoach} />}
          </View>
          {messages.length === 0 && !coachBusy ? (
            <T muted>Chào bé! Mình là Sprouty AI. Mình nhìn được hết cảm biến của {plant.nickname} và sẽ nói cho bé biết cây đang cần gì.</T>
          ) : (
            <View style={{ gap: 8 }}>
              {messages.slice(-8).map((m) => (
                <View key={m.id} style={[s.bubble, m.role === 'user' ? s.bubbleMe : s.bubbleAi]}>
                  <Text selectable style={[s.bubbleText, m.role === 'user' && { color: colors.white }]}>{plainAiText(m.content)}</Text>
                </View>
              ))}
              {coachBusy && <View style={[s.bubble, s.bubbleAi]}><T muted>Sprouty AI đang trả lời…</T></View>}
            </View>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable disabled={coachBusy} onPress={() => ask()} style={[s.quick, s.quickLead]}><Text style={[s.quickText, { color: colors.white }]}>Xem cây giúp mình</Text></Pressable>
            {QUICK_ASKS.map((q) => (
              <Pressable key={q} disabled={coachBusy} onPress={() => ask(q)} style={s.quick}><Text style={s.quickText}>{q}</Text></Pressable>
            ))}
          </ScrollView>
          <View style={s.composer}>
            <TextInput value={question} onChangeText={setQuestion} placeholder="Hỏi điều bé thắc mắc…" placeholderTextColor={colors.ink5}
              maxLength={600} style={s.composerInput} returnKeyType="send" onSubmitEditing={() => question.trim() && ask(question.trim())}
              />
            <Pressable disabled={coachBusy || !question.trim()} onPress={() => ask(question.trim())} style={[s.send, (!question.trim() || coachBusy) && { opacity: 0.5 }]} accessibilityLabel="Gửi câu hỏi">
              <Icon name="arrow-right" size={20} color={colors.white} />
            </Pressable>
          </View>
        </Card>

        <Fold icon="camera" title="Video hướng dẫn" sub="Cách gieo, tưới và chăm bộ kit" open={videosOpen} onToggle={() => setVideosOpen((v) => !v)}>
          <ProductVideos productId={plant.productId} signedIn />
        </Fold>

        <Fold icon="clock" title="Nhật ký" sub={plant.history.length ? `${plant.history.length} việc bé đã làm cho cây` : 'Chưa có việc chăm cây nào'}
          open={logOpen} onToggle={() => setLogOpen((v) => !v)} dot={feed.length > 0}>
          {groupFeed(feed).map((e, i) => (
            <View key={i} style={s.feed}>
              <Icon name={e.level === 'warn' ? 'warning' : e.level === 'good' ? 'check' : 'info'} size={16} color={e.level === 'warn' ? colors.warn : e.level === 'good' ? colors.green : colors.info} />
              <T style={{ flex: 1 }}>{e.text}{e.count > 1 ? ` ×${e.count}` : ''}</T>
            </View>
          ))}
          {plant.history.length === 0 && <T muted>Chưa có lần chăm cây nào — bấm một nút chăm cây để bắt đầu.</T>}
          {plant.history.map((h) => (
            <View key={h.id} style={s.history}>
              <View style={s.historyIcon}><Icon name={h.auto ? 'shield' : h.icon} size={16} color={h.warned ? colors.warn : colors.greenDark} /></View>
              <View style={{ flex: 1 }}>
                <T bold>{h.auto ? `Bộ chăm tự động: ${h.label.toLowerCase()}${h.count > 1 ? ` ×${h.count}` : ''}` : h.label}</T>
                <T muted style={{ fontSize: 12.5 }}>{formatDateTime(h.createdAt)} · {h.stageLabel}</T>
              </View>
              {h.growth > 0 && <Text style={s.growth}>+{h.growth.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</Text>}
            </View>
          ))}
        </Fold>

        {plant.cultivation && (
          <Card tone="soft">
            <CardTitle icon="book">Hồ sơ giống · {plant.speciesLabel}</CardTitle>
            <T style={{ fontStyle: 'italic' }}>{plant.cultivation.name}</T>
            <T>{plant.cultivation.sow}</T>
            <T>{plant.cultivation.support}</T>
            <T>{plant.cultivation.mature}</T>
            <T muted style={{ fontSize: 12.5 }}>Mô phỏng giáo dục: thời gian và thang độ ẩm được giản lược.</T>
          </Card>
        )}
      </Screen>

      <Sheet open={renaming} title="Đổi tên cây" onClose={() => setRenaming(false)} footer={<Button title="Lưu tên" onPress={saveName} />}>
        <Field label="Tên mới" value={nameDraft} onChangeText={setNameDraft} maxLength={40} autoFocus onSubmitEditing={saveName} />
      </Sheet>

      <Sheet open={guideOpen} title="Cây cần gì?" onClose={() => setGuideOpen(false)}>
        {[
          ['water', 'Tưới nước khi đất khô. Tưới khi đất còn ướt sẽ làm úng rễ.'],
          ['fertilize', 'Bón phân khi cây đói (thức ăn dưới 45%). Bón quá nhiều cũng không tốt.'],
          ['pest', 'Bắt sâu khi camera báo có sâu. Lá sạch thì cây lớn nhanh hơn.'],
          ['sun', 'Đưa ra nắng vào ban ngày. Ban đêm cây nghỉ ngơi.'],
          ['clock', 'Mỗi việc cần chờ một lúc mới làm lại được — con số dưới nút là thời gian còn lại.'],
          ['star', 'Nút màu xanh đậm là việc Sprouty AI khuyên làm ngay lúc này.'],
        ].map(([icon, text]) => (
          <View key={icon} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View style={s.historyIcon}><Icon name={icon as IconName} size={16} color={colors.greenDark} /></View>
            <T style={{ flex: 1 }}>{text}</T>
          </View>
        ))}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  artPane: { borderRadius: radius.xl, overflow: 'hidden', alignItems: 'center', paddingTop: 36, borderWidth: 1, borderColor: colors.line },
  clock: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.88)' },
  clockText: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.ink2 },
  dead: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,253,248,0.94)', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.greenDark },
  todoIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: fonts.bold, fontSize: 11.5, letterSpacing: 0.8, color: colors.green },
  help: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36 },
  helpText: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  care: { minHeight: 104, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 },
  careRec: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  careOff: { backgroundColor: '#F6F8F3' },
  careIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  careLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink, textAlign: 'center' },
  careWait: { fontFamily: fonts.semi, fontSize: 11, color: colors.ink4, textAlign: 'center' },
  taskDot: { position: 'absolute', top: 6, right: 6, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: '#FFF1DE' },
  taskDotText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.warn },
  percent: { fontFamily: fonts.display, fontSize: 20, color: colors.greenDark },
  bar: { height: 10, borderRadius: 5, backgroundColor: '#E6ECE0', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5, backgroundColor: colors.green },
  task: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 30 },
  journeyLine: { width: 14, height: 2, backgroundColor: '#E6ECE0', marginBottom: 22 },
  journeyDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2E8' },
  journeyReached: { backgroundColor: colors.greenSoft },
  journeyNow: { backgroundColor: colors.green },
  journeyLabel: { fontFamily: fonts.semi, fontSize: 11, color: colors.ink4, textAlign: 'center' },
  sensor: { borderRadius: radius.md, padding: 12, gap: 4, minHeight: 96 },
  sensorHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sensorLabel: { flex: 1, fontFamily: fonts.semi, fontSize: 12, color: colors.ink3 },
  sensorVerdict: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24 },
  sensorNum: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.ink3 },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  deviceIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  aiAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.green, borderBottomRightRadius: 6 },
  bubbleAi: { alignSelf: 'flex-start', backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  quick: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, justifyContent: 'center' },
  quickLead: { backgroundColor: colors.green, borderColor: colors.green },
  quickText: { fontFamily: fonts.semi, fontSize: 13.5, color: colors.ink2 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composerInput: { flex: 1, minHeight: 48, borderWidth: 1.5, borderColor: '#CFE9C9', borderRadius: radius.pill, paddingHorizontal: 16, fontFamily: fonts.body, fontSize: 15.5, color: colors.ink, backgroundColor: colors.card },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  foldHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 64 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange },
  feed: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  history: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  historyIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  growth: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
});
