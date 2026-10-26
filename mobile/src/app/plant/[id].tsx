import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { ProductVideos } from '@/components/media';
import { BuddyBubble } from '@/components/BuddyBubble';
import { CareGame, type CareTool } from '@/components/CareGame';
import { GardenStyle, sceneLook, type GardenBenefits } from '@/components/GardenStyle';
import { IotWorkbench, SensorChart, useIotBoard } from '@/components/IotStation';
import { Plant3D } from '@/components/Plant3D';
import { useToast } from '@/components/Toast';
import { Button, Card, Field, H, IconButton, Loading, Screen, Sheet, T, tap } from '@/components/ui';
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

/**
 * Where each garden scene painted its sun (or moon), as a share of the
 * picture, and the way down from it to the plant — so "Đưa ra nắng" lights up
 * the sun that is actually in the sky. As the website's PlantDetail.
 */
const SUN_AT: Record<string, { x: number; y: number; deg: number }> = {
  natural: { x: 0.82, y: 0.145, deg: 148 },
  night: { x: 0.19, y: 0.15, deg: 32 },
  autumn: { x: 0.767, y: 0.47, deg: 172 },
  sakura: { x: 0.71, y: 0.21, deg: 150 },
};

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
function SensorTile({ icon, label, value, unit = '%', kind, ideal, band, device, width, wired, onPlug }: {
  icon: IconName; label: string; value: number; unit?: string; kind: string; ideal?: [number, number]; band: Band; device?: PlantDevice; width: number;
  /** A reading is known only through the sensor that takes it, once wired. */
  wired: boolean; onPlug: () => void;
}) {
  const locked = device && !device.unlocked;
  const off = !locked && !wired;
  const c = locked || off ? { fg: colors.ink4, bg: '#F1F4EE' } : BAND[band];
  if (off) {
    return (
      <Pressable onPress={() => { tap(); onPlug(); }} accessibilityRole="button" accessibilityLabel={`Nối ${device?.label ?? label}`}
        style={({ pressed }) => [s.sensor, { width, backgroundColor: c.bg, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.ink5 }, pressed && { opacity: 0.8 }]}>
        <View style={s.sensorHead}>
          <Icon name={icon} size={18} color={c.fg} />
          <Text numberOfLines={1} style={s.sensorLabel}>{label}</Text>
        </View>
        <Text style={[s.sensorVerdict, { color: c.fg }]}>Chưa đo</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}><Icon name="add" size={12} color={colors.green} /><Text style={[s.sensorNum, { color: colors.green, fontFamily: fonts.bold }]}>Nối cảm biến</Text></View>
      </Pressable>
    );
  }
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
 * One plant. In the order a child needs it: the plant with its care tools
 * right under it (dragged up onto the plant, as on the website), the one
 * thing to do next, then the tasks, the IoT station and the journal behind
 * tabs, and Sprouty AI in the corner. The recommended tool is flagged on the
 * belt, so doing what the coach said is one drag.
 */
export default function PlantScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const { width } = useWindowDimensions();

  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [careBusy, setCareBusy] = useState<string | null>(null);
  const [deviceBusy, setDeviceBusy] = useState('');
  const [feed, setFeed] = useState<PlantEvent[]>([]);
  const [videosOpen, setVideosOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [replanting, setReplanting] = useState(false);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [coachBusy, setCoachBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  const [tab, setTab] = useState<'care' | 'sensors' | 'log'>('care');
  const [coachOpen, setCoachOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toolAtWork, setToolAtWork] = useState(false);
  // The scene and pot the plant wears: the saved look, or one being tried on (GardenStyle loads it).
  const [garden, setGarden] = useState<GardenBenefits | null>(null);
  const [gardenOpen, setGardenOpen] = useState(false);
  const board = useIotBoard(id, plant?.devices || [], (type, next) => toggleDevice(type, next));

  const apply = useCallback((detail: PlantDetail, events: PlantEvent[] = []) => {
    setPlant(detail);
    setFetchedAt(Date.now());
    if (detail.coachMessages) setMessages(detail.coachMessages);
    if (events.length) setFeed((prev) => [...events, ...prev].slice(0, 12));
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await API.plants.get(id);
      if (!data?.plant) throw new Error('Chưa mở được cây này, thử lại nhé.');
      apply(data.plant, data.events || []);
    } catch (err: any) {
      toast(err?.message || 'Không tải được cây này.', 'error');
      router.replace('/garden');
    } finally {
      setLoading(false);
    }
  }, [id, apply, toast]);

  useEffect(() => { void load(); }, [load]);
  // The account's garden scene and pot, so the 3D plant looks as it does on the website.

  /** Does the care on the server; resolves with the points gained, or null when it did not happen. */
  async function care(action: string): Promise<number | null> {
    if (careBusy) return null;
    setCareBusy(action);
    try {
      const data = await API.plants.care(id, action);
      apply(data.plant, data.messages || []);
      // The game shows the points over the plant; a warning still needs saying.
      const warning = (data.messages || []).find((m: PlantEvent) => m.level === 'warn');
      if (warning) toast(warning.text, 'error');
      if (data.harvested) setTimeout(() => toast('Hành trình hoàn thành! Chúc mừng bé.', 'success'), 3200);
      for (const type of data.newlyUnlocked || []) {
        const unlocked = data.plant.devices.find((d: PlantDevice) => d.type === type);
        if (unlocked) setTimeout(() => toast(`Thiết bị mới: ${unlocked.label}`, 'success'), 3200);
      }
      return Number(data.growth) || 0;
    } catch (err: any) {
      toast(err?.message || 'Không chăm cây được lúc này.', 'error');
      if (err?.status === 429 || err?.status === 409) void load();
      return null;
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
  const recommended = plant.nextStep.action;
  // The belt: what can be done in this stage, and a count of what opens later (harvest is no surprise to keep).
  const tools: CareTool[] = dead || harvested ? [] : plant.care.filter((c) => c.allowedInStage || c.action !== 'harvest').map((c) => {
    const left = secondsLeft(c, fetchedAt, now);
    const task = plant.tasks.find((t) => t.action === c.action);
    return {
      action: c.action, label: c.label, icon: c.icon,
      state: !c.allowedInStage ? 'locked' : careBusy === c.action ? 'busy' : left > 0 ? 'cooldown' : 'ready',
      wait: formatCountdown(left),
      recommended: c.action === recommended,
      task: task ? { done: task.done, need: task.need } : undefined,
    };
  });
  const device = (type: string) => plant.devices.find((d) => d.type === type);
  const hour = plant.environment.hour;
  const clock = `${String(Math.floor(hour)).padStart(2, '0')}:${String(Math.round((hour % 1) * 60) % 60).padStart(2, '0')}`;
  const NEEDS: Partial<Record<string, [string, string]>> = {
    water: ['moisture_sensor', 'Lá có vẻ hơi rũ — nối cảm biến độ ẩm đất để biết cây khát đến đâu.'],
    fertilize: ['nutrient_sensor', 'Lá trông hơi nhạt màu — nối cảm biến dinh dưỡng để xem cây còn bao nhiêu thức ăn.'],
    pest_check: ['camera', 'Lá có vài vết lạ — nối camera theo dõi để xem sâu bệnh có nhiều không.'],
  };
  const need = recommended ? NEEDS[recommended] : undefined;
  const why = need && !board.isWired(need[0]) ? need[1] : plant.nextStep.why;
  const healthTone: Band = dead || ['critical', 'wilting', 'dead'].includes(plant.healthState.id) ? 'bad' : plant.healthState.id === 'stressed' ? 'warn' : 'good';

  const inner = Math.min(width, maxWidth) - gutter * 2;
  const scene = garden?.scene ?? 'natural';
  const artSize = Math.min(inner, 520);
  // A little wider than tall on a phone, so the plant and its tools fit one screen.
  const artHeight = artSize < 480 ? Math.round(artSize * 0.86) : artSize;
  const fan = plant.devices.find((d) => d.type === 'fan');
  // A VIP plant sways in a breeze, harder with the fan on; a regular one stands still.
  const wind = !plant.keeper?.vip || dead ? 'off' : fan?.unlocked && fan.autoMode ? 'fan' : 'breeze';
  const sensorCols = inner >= 600 ? 5 : inner >= 420 ? 3 : 2;
  const sensorWidth = Math.floor((inner - 8 * (sensorCols - 1)) / sensorCols);

  const TABS: Array<{ key: typeof tab; label: string; icon: IconName }> = [
    { key: 'care', label: 'Nhiệm vụ', icon: 'trophy' },
    { key: 'sensors', label: 'Trạm IoT', icon: 'chart' },
    { key: 'log', label: 'Nhật ký', icon: 'clock' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <Screen title={plant.nickname} back="/garden" onRefresh={load} scrollEnabled={!dragging}
        actions={(
          <>
            <IconButton icon="pencil" label="Đổi tên cây" onPress={() => { setNameDraft(plant.nickname); setRenaming(true); }} />
            <IconButton icon="album" label="Album kỷ niệm" onPress={() => router.push(`/album?productId=${plant.productId}&plantId=${plant.id}`)} />
          </>
        )}>
        {/* The plant, with the time of day pinned on it, and its care tools right under it */}
        <CareGame tools={tools} disabled={dead || harvested} onCare={care} onDragChange={setDragging} onPlayingChange={setToolAtWork}
          fruitColor={plant.fruitColor} sun={SUN_AT[scene]} width={artSize} height={artHeight}>
          <View style={[s.art, { width: artSize, height: artHeight }]}>
            <Plant3D plant={plant} width={artSize} height={artHeight} isNight={!plant.environment.isDay}
              scene={scene} decoration={garden?.decoration} wind={wind} hint={!toolAtWork}
              gadgets={board.wired.map((t) => device(t)).filter(Boolean).map((d) => ({ type: d!.type, on: d!.kind === 'sensor' || d!.autoMode }))} />
            {!toolAtWork && <View style={s.clock}>
              <Icon name={scene === 'night' ? 'moon' : scene !== 'natural' ? 'sparkle' : plant.environment.isDay ? 'sun' : 'moon'} size={14} color={colors.ink2} />
              {/* A VIP scene is the same place at any hour, so the pill names the scene instead of claiming it is daytime under a night sky. */}
              <Text style={s.clockText}>{scene !== 'natural' ? sceneLook(scene).label : plant.environment.isDay ? 'Ban ngày' : 'Ban đêm'} · {clock}</Text>
            </View>}
            {dead && (
              <View style={s.dead}>
                <Icon name="leaf" size={28} color={colors.earth} />
                <H size={19}>Cây đã héo khô</H>
                <T style={{ textAlign: 'center' }}>{plant.nickname} không được chăm quá lâu nên đã không qua khỏi. Gieo hạt mới miễn phí, lần này nhớ ghé chăm đều tay nhé.</T>
                <Button icon="seed" title={replanting ? 'Đang gieo…' : 'Gieo lại từ hạt'} busy={replanting} onPress={replant} />
              </View>
            )}
          </View>
        </CareGame>

        {/* The garden's look, folded, right under the plant: a pick shows on the 3D model above. Kept mounted while folded — it loads the look the model wears. */}
        <Card style={{ padding: 0, gap: 0 }}>
          <Pressable onPress={() => { tap(); setGardenOpen((v) => !v); }} style={s.foldHead} accessibilityRole="button" accessibilityState={{ expanded: gardenOpen }}>
            <Icon name="pot" size={20} color={colors.green} />
            <View style={{ flex: 1 }}>
              <T bold>Trang trí vườn</T>
              <T muted style={{ fontSize: 13 }}>Khung cảnh và chậu cho cây 3D</T>
            </View>
            <View style={gardenOpen ? { transform: [{ rotate: '180deg' }] } : undefined}><Icon name="arrow-down" size={18} color={colors.ink3} /></View>
          </Pressable>
          <View style={gardenOpen ? { paddingHorizontal: 12, paddingBottom: 12 } : undefined}>
            <GardenStyle hidden={!gardenOpen} onChange={setGarden} width={inner - 26} />
          </View>
        </Card>

        {/* The one thing to do now; its tool is flagged "Nên làm" on the belt */}
        {!dead && (
          <View style={[s.todo, critical && s.todoBad, harvested && s.todoDone]}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <View style={[s.todoIcon, critical && { backgroundColor: '#F9D9DE' }]}>
                <Icon name={harvested ? 'trophy' : critical ? 'warning' : plant.nextStep.icon} size={20} color={critical ? colors.bad : colors.greenDark} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.kicker, critical && { color: colors.bad }]}>{harvested ? 'ĐÃ HOÀN THÀNH' : critical ? `CỨU CÂY NGAY · CÒN KHOẢNG ${hoursLeft.toUpperCase()}` : 'VIỆC NÊN LÀM'}</Text>
                <Text style={s.todoTitle}>{harvested ? `Bé đã thu hoạch ${plant.harvestLabel}!` : plant.nextStep.label || 'Chờ dụng cụ hồi lại'}</Text>
                <Text numberOfLines={3} style={s.todoWhy}>{harvested ? 'Mở một bộ kit mới để trồng cây khác nhé.' : why}</Text>
              </View>
            </View>
            {critical && plant.keeper && !plant.keeper.vip && (
              <Button small variant="ghost" icon="star" title="VIP giữ cây không bao giờ héo" onPress={() => router.push('/vip')} />
            )}
          </View>
        )}

        {/* Where it stands */}
        <View style={{ gap: 10 }}>
          <View style={s.badges}>
            <View style={[s.badge, { backgroundColor: BAND[healthTone].bg }]}>
              <Icon name="heart" size={13} color={BAND[healthTone].fg} />
              <Text style={[s.badgeText, { color: BAND[healthTone].fg }]}>{plant.healthState.label}{dead ? '' : ` · ${Math.round(plant.health)}%`}</Text>
            </View>
            {plant.careStreak > 0 && <View style={[s.badge, { backgroundColor: '#FFF1DE' }]}><Icon name="bolt" size={13} color={colors.price} /><Text style={[s.badgeText, { color: colors.warn }]}>{plant.careStreak} ngày liên tục</Text></View>}
            {plant.keeper?.on && !dead && <View style={[s.badge, { backgroundColor: colors.infoSoft }]}><Icon name="shield" size={13} color={colors.info} /><Text style={[s.badgeText, { color: colors.info }]}>Chăm tự động</Text></View>}
            {plant.attempt > 1 && <View style={[s.badge, { backgroundColor: colors.earthSoft }]}><Icon name="seed" size={13} color={colors.earth} /><Text style={[s.badgeText, { color: colors.earth }]}>Lần thứ {plant.attempt}</Text></View>}
          </View>
          <View style={s.stageRow}>
            <Text style={s.stageLabel}>{plant.stageLabel}</Text>
            <Text style={s.stageMeta}>chặng {plant.stageIndex + 1}/{plant.stageCount} · {plant.speciesLabel}</Text>
            <Text style={s.percent}>{Math.round(plant.stageProgress)}%</Text>
          </View>
          <View style={s.bar}><View style={[s.barFill, { width: `${Math.round(plant.stageProgress)}%` }]} /></View>
        </View>

        {/* Tabs, so the page stays one screen of what matters */}
        <View style={s.tabs} accessibilityRole="tablist">
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => { tap(); setTab(t.key); }} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }}
              style={[s.tab, tab === t.key && s.tabOn]}>
              <Icon name={t.icon} size={16} color={tab === t.key ? colors.white : colors.ink3} />
              <Text numberOfLines={1} style={[s.tabText, tab === t.key && { color: colors.white }]}>{t.label}</Text>
              {t.key === 'log' && feed.length > 0 && tab !== 'log' ? <View style={s.tabDot} /> : null}
            </Pressable>
          ))}
        </View>

        {tab === 'care' && (
          <>
            <Pressable onPress={() => { tap(); setGuideOpen(true); }} accessibilityRole="button" style={s.help}>
              <Icon name="info" size={16} color={colors.green} /><Text style={s.helpText}>Cây cần gì? Cách chăm từng việc</Text>
            </Pressable>
            {plant.tasks.length > 0 && !dead && (
              <View style={s.panel}>
                <Text style={[s.panelTitle, plant.tasksDone && { color: colors.greenDark }]}>
                  {plant.tasksDone ? 'Xong nhiệm vụ chặng này' : plant.pointsFull ? 'Đủ điểm — làm nốt nhiệm vụ để lên chặng' : 'Nhiệm vụ để lên chặng'}
                </Text>
                {plant.tasks.map((t) => (
                  <View key={t.action} style={s.task}>
                    <Icon name={t.done >= t.need ? 'check' : t.icon} size={16} color={t.done >= t.need ? colors.green : colors.ink3} />
                    <Text style={[s.taskText, t.done >= t.need && { color: colors.ink4 }]}>{t.label}</Text>
                    <Text style={s.taskCount}>{t.done}/{t.need}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={s.panel}>
              <Text style={s.panelTitle}>Hành trình của cây</Text>
              <Text style={s.panelText}>{plant.stageStory}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4, paddingVertical: 4 }}>
                {plant.stages.map((st, i) => (
                  <View key={st.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {i > 0 && <View style={[s.journeyLine, st.reached && { backgroundColor: colors.greenLight }]} />}
                    <View style={{ alignItems: 'center', gap: 4, width: 60 }}>
                      <View style={[s.journeyDot, st.reached && s.journeyReached, st.current && s.journeyNow]}>
                        <Icon name={st.reached && !st.current ? 'check' : st.icon} size={16} color={st.current ? colors.white : st.reached ? colors.greenDark : colors.ink4} />
                      </View>
                      <Text numberOfLines={2} style={[s.journeyLabel, st.current && { color: colors.ink, fontFamily: fonts.bold }]}>{st.label}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </>
        )}

        {tab === 'sensors' && (
          <>
            <Text style={s.note}>Mỗi chỉ số cần cảm biến của nó: nối vào Hub là đọc được ngay, và linh kiện cũng gắn vào chậu cây ở trên. Chặng này cây thích đất ẩm {plant.idealMoisture[0]}–{plant.idealMoisture[1]}% và {plant.idealTemp[0]}–{plant.idealTemp[1]}°C.</Text>
            <View style={s.grid}>
              <SensorTile width={sensorWidth} icon="moisture" kind="moisture" label="Nước trong đất" value={plant.moisture} ideal={plant.idealMoisture} band={metricBand(plant.moisture, plant.idealMoisture)} device={device('moisture_sensor')} wired={board.isWired('moisture_sensor')} onPlug={() => board.wire('moisture_sensor')} />
              <SensorTile width={sensorWidth} icon="thermo" kind="temperature" label="Nhiệt độ" unit="°C" value={plant.environment.temperature} ideal={plant.idealTemp} band={metricBand(plant.environment.temperature, plant.idealTemp)} device={device('thermo_sensor')} wired={board.isWired('thermo_sensor')} onPlug={() => board.wire('thermo_sensor')} />
              <SensorTile width={sensorWidth} icon="light" kind="light" label="Ánh sáng" value={plant.environment.light} band={plant.environment.light > 35 || !plant.environment.isDay ? 'good' : 'warn'} device={device('light_sensor')} wired={board.isWired('light_sensor')} onPlug={() => board.wire('light_sensor')} />
              <SensorTile width={sensorWidth} icon="nutrient" kind="nutrient" label="Thức ăn của cây" value={plant.nutrient} band={plant.nutrient > 45 ? 'good' : plant.nutrient > 28 ? 'warn' : 'bad'} device={device('nutrient_sensor')} wired={board.isWired('nutrient_sensor')} onPlug={() => board.wire('nutrient_sensor')} />
              <SensorTile width={sensorWidth} icon="pest" kind="pest" label="Sâu bệnh" value={plant.pestRisk} band={plant.pestRisk < 40 ? 'good' : plant.pestRisk < 58 ? 'warn' : 'bad'} device={device('camera')} wired={board.isWired('camera')} onPlug={() => board.wire('camera')} />
            </View>

            <View style={s.panel}>
              <Text style={s.panelTitle}>Bàn lắp mạch</Text>
              <IotWorkbench board={board} devices={plant.devices} busy={Boolean(deviceBusy)} onToggle={toggleDevice} plantName={plant.nickname} width={inner - 30} />
            </View>

            <View style={s.panel}>
              <Text style={s.panelTitle}>Biểu đồ cảm biến 24 giờ</Text>
              <SensorChart readings={plant.readings || []} wired={board.wired} width={inner - 30} />
            </View>
          </>
        )}

        {tab === 'log' && (
          <>
            {feed.length > 0 && (
              <View style={s.panel}>
                <Text style={s.panelTitle}>Vừa xảy ra</Text>
                {groupFeed(feed).map((e, i) => (
                  <View key={i} style={s.feed}>
                    <Icon name={e.level === 'warn' ? 'warning' : e.level === 'good' ? 'check' : 'info'} size={15} color={e.level === 'warn' ? colors.warn : e.level === 'good' ? colors.green : colors.info} />
                    <Text style={s.feedText}>{e.text}{e.count > 1 ? ` ×${e.count}` : ''}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={s.list}>
              <Text style={s.listHead}>{plant.history.length ? `${plant.history.length} việc bé đã làm cho cây` : 'Nhật ký chăm cây'}</Text>
              {plant.history.length === 0 && <Text style={[s.deviceAbout, { padding: 14, paddingTop: 0 }]}>Chưa có lần chăm cây nào — kéo một dụng cụ lên cây để bắt đầu.</Text>}
              {plant.history.slice(0, 30).map((h, i, all) => (
                <View key={h.id} style={[s.history, i < all.length - 1 && s.divider]}>
                  <View style={s.historyIcon}><Icon name={h.auto ? 'shield' : h.icon} size={15} color={h.warned ? colors.warn : colors.greenDark} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.historyTitle}>{h.auto ? `Chăm tự động: ${h.label.toLowerCase()}${h.count > 1 ? ` ×${h.count}` : ''}` : h.label}</Text>
                    <Text style={s.deviceAbout}>{formatDateTime(h.createdAt)} · {h.stageLabel}</Text>
                  </View>
                  {h.growth > 0 && <Text style={s.growth}>+{h.growth.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</Text>}
                </View>
              ))}
            </View>
            <Fold icon="camera" title="Video hướng dẫn" sub="Cách gieo, tưới và chăm bộ kit" open={videosOpen} onToggle={() => setVideosOpen((v) => !v)}>
              <ProductVideos productId={plant.productId} signedIn />
            </Fold>
            {plant.cultivation && (
              <View style={s.panel}>
                <Text style={s.panelTitle}>Hồ sơ giống · {plant.speciesLabel}</Text>
                <Text style={[s.panelText, { fontStyle: 'italic' }]}>{plant.cultivation.name}</Text>
                <Text style={s.panelText}>{plant.cultivation.sow}</Text>
                <Text style={s.panelText}>{plant.cultivation.support}</Text>
                <Text style={s.panelText}>{plant.cultivation.mature}</Text>
                <Text style={s.deviceAbout}>Mô phỏng giáo dục: thời gian và thang độ ẩm được giản lược.</Text>
              </View>
            )}
          </>
        )}
        {/* Room for Sprouty AI's bubble, so it never sits on the last line */}
        <View style={{ height: 64 }} />
      </Screen>

      {/* Sprouty AI, one tap away from anywhere on the page */}
      <BuddyBubble bottom={20 + insets.bottom} label="Hỏi Sprouty AI về cây này" onPress={() => setCoachOpen(true)} />

      <Sheet open={coachOpen} title="Hỏi Sprouty AI" onClose={() => setCoachOpen(false)}
        footer={(
          <View style={{ gap: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable disabled={coachBusy} onPress={() => ask()} style={[s.quick, s.quickLead]}><Text style={[s.quickText, { color: colors.white }]}>Xem cây giúp mình</Text></Pressable>
              {QUICK_ASKS.map((q) => (
                <Pressable key={q} disabled={coachBusy} onPress={() => ask(q)} style={s.quick}><Text style={s.quickText}>{q}</Text></Pressable>
              ))}
            </ScrollView>
            <View style={s.composer}>
              <TextInput value={question} onChangeText={setQuestion} placeholder="Hỏi điều bé thắc mắc…" placeholderTextColor={colors.ink5}
                maxLength={600} style={s.composerInput} returnKeyType="send" onSubmitEditing={() => question.trim() && ask(question.trim())} />
              <Pressable disabled={coachBusy || !question.trim()} onPress={() => ask(question.trim())} style={[s.send, (!question.trim() || coachBusy) && { opacity: 0.5 }]} accessibilityLabel="Gửi câu hỏi">
                <Icon name="arrow-right" size={20} color={colors.white} />
              </Pressable>
            </View>
          </View>
        )}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={s.aiAvatar}><Image source={aiMark} style={{ width: 24, height: 24 }} contentFit="contain" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.deviceName}>Sprouty AI</Text>
            <Text style={s.deviceAbout}>{coachBusy ? 'đang xem cây…' : `Nhìn được mọi cảm biến của ${plant.nickname}`}</Text>
          </View>
          {messages.length > 0 && <IconButton icon="trash" label="Xoá lịch sử trò chuyện" onPress={clearCoach} />}
        </View>
        {messages.length > 0 || coachBusy ? (
          <View style={{ gap: 8 }}>
            {messages.slice(-8).map((m) => (
              <View key={m.id} style={[s.bubble, m.role === 'user' ? s.bubbleMe : s.bubbleAi]}>
                <Text selectable style={[s.bubbleText, m.role === 'user' && { color: colors.white }]}>{plainAiText(m.content)}</Text>
              </View>
            ))}
            {coachBusy && <View style={[s.bubble, s.bubbleAi]}><Text style={s.deviceAbout}>Sprouty AI đang trả lời…</Text></View>}
          </View>
        ) : null}
      </Sheet>

      <Sheet open={renaming} title="Đổi tên cây" onClose={() => setRenaming(false)} footer={<Button title="Lưu tên" onPress={saveName} />}>
        <Field label="Tên mới" value={nameDraft} onChangeText={setNameDraft} maxLength={40} autoFocus onSubmitEditing={saveName} />
      </Sheet>

      <Sheet open={guideOpen} title="Cây cần gì?" onClose={() => setGuideOpen(false)}>
        {[
          ['arrow-right', 'Kéo dụng cụ lên cây và giữ yên đến khi vòng tròn đầy. Chạm vào dụng cụ cũng được.'],
          ['water', 'Tưới nước khi đất khô. Tưới khi đất còn ướt sẽ làm úng rễ.'],
          ['fertilize', 'Bón phân khi cây đói (thức ăn dưới 45%). Bón quá nhiều cũng không tốt.'],
          ['pest', 'Bắt sâu khi camera báo có sâu. Lá sạch thì cây lớn nhanh hơn.'],
          ['sun', 'Đưa ra nắng vào ban ngày. Ban đêm cây nghỉ ngơi.'],
          ['clock', 'Mỗi việc cần chờ một lúc mới làm lại được — con số trên dụng cụ là thời gian còn lại.'],
          ['star', 'Dụng cụ có nhãn "Nên làm" là việc Sprouty AI khuyên làm ngay lúc này.'],
        ].map(([icon, text]) => (
          <View key={icon} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View style={s.historyIcon}><Icon name={icon as IconName} size={15} color={colors.greenDark} /></View>
            <T style={{ flex: 1 }}>{text}</T>
          </View>
        ))}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  art: { alignSelf: 'center', borderRadius: 22, overflow: 'hidden' },
  clock: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.9)' },
  clockText: { fontFamily: fonts.semi, fontSize: 12, color: colors.ink2 },
  dead: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,253,248,0.94)', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.bold, fontSize: 12, color: colors.greenDark },
  stageRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  stageLabel: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, color: colors.ink },
  stageMeta: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: colors.ink3 },
  percent: { fontFamily: fonts.display, fontSize: 18, color: colors.greenDark },
  bar: { height: 8, borderRadius: 4, backgroundColor: '#E6ECE0', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.green },

  todo: { gap: 10, padding: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: '#CFE9C9', backgroundColor: colors.cream2 },
  todoBad: { borderColor: '#F5C9CF', backgroundColor: colors.badSoft },
  todoDone: { borderColor: '#D5EDCF', backgroundColor: colors.greenSoft },
  todoIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, color: colors.green },
  todoTitle: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, color: colors.ink },
  todoWhy: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.ink3 },

  tabs: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: '#EEF2E8' },
  tab: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 4 },
  tabOn: { backgroundColor: colors.green },
  tabText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.ink2 },
  tabDot: { position: 'absolute', top: 8, right: 10, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.orange },

  help: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, alignSelf: 'flex-start' },
  helpText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.green },
  note: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.ink3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  panel: { gap: 10, padding: 14, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  panelTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  panelText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.ink3 },
  task: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  taskText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink2 },
  taskCount: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  journeyLine: { width: 12, height: 2, backgroundColor: '#E6ECE0', marginBottom: 22 },
  journeyDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2E8' },
  journeyReached: { backgroundColor: colors.greenSoft },
  journeyNow: { backgroundColor: colors.green },
  journeyLabel: { fontFamily: fonts.semi, fontSize: 10.5, color: colors.ink4, textAlign: 'center' },

  sensor: { borderRadius: radius.md, padding: 12, gap: 4, minHeight: 92 },
  sensorHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sensorLabel: { flex: 1, fontFamily: fonts.semi, fontSize: 12, color: colors.ink3 },
  sensorVerdict: { fontFamily: fonts.display, fontSize: 18, lineHeight: 24 },
  sensorNum: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.ink3 },

  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  listHead: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  device: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 8 },
  deviceIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  deviceName: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  deviceAbout: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.ink3 },

  aiAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.green, borderBottomRightRadius: 6 },
  bubbleAi: { alignSelf: 'flex-start', backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  quick: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, justifyContent: 'center' },
  quickLead: { backgroundColor: colors.green, borderColor: colors.green },
  quickText: { fontFamily: fonts.semi, fontSize: 13.5, color: colors.ink2 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composerInput: { flex: 1, minHeight: 46, borderWidth: 1.5, borderColor: '#CFE9C9', borderRadius: radius.pill, paddingHorizontal: 16, fontFamily: fonts.body, fontSize: 15, color: colors.ink, backgroundColor: colors.card },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },

  foldHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, minHeight: 64 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange },
  feed: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  feedText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.ink2 },
  history: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, paddingVertical: 8 },
  historyIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink },
  growth: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
});
