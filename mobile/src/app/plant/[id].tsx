import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, AppState, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { ProductVideos } from '@/components/media';
import { BuddyBubble } from '@/components/BuddyBubble';
import { CareGame, type CareTool } from '@/components/CareGame';
import { GardenStyle, sceneLook, type GardenBenefits } from '@/components/GardenStyle';
import { SpeciesProfile } from '@/components/SpeciesProfile';
import { IotWorkbench, SensorChart, useIotBoard } from '@/components/IotStation';
import { Plant3D } from '@/components/Plant3D';
import { HarvestSheet, HarvestStars, type Celebration } from '@/components/HarvestSheet';
import { useToast } from '@/components/Toast';
import { Button, Card, Field, H, IconButton, IconTile, Loading, Meter, Press, Ring, Screen, Segmented, Sheet, T, cheer, tap } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { plantClock } from '@/lib/plant-clock';
import { formatCountdown, formatDateTime, plainAiText } from '@/lib/format';
import type { CareSlot, CoachMessage, HarvestCollection, HarvestRecord, PlantDetail, PlantDevice, PlantEvent } from '@/lib/types';
import { colors, fonts, gutter, maxWidth, radius, surface } from '@/theme';

const aiMark = imageSource('/assets/images/sprouty-mark.png') as number;
/** Care log entries shown at first, and how many more each "Xem thêm" adds (10). */
const LOG_PAGE = 8;
const QUICK_ASKS = ['Tại sao lá bị vàng?', 'Bao lâu nữa cây lớn?', 'Nên bật thiết bị nào?'];

type Band = 'good' | 'warn' | 'bad';
const BAND: Record<Band, { fg: string; bg: string }> = {
  good: { fg: colors.greenDark, bg: colors.greenSoft },
  warn: { fg: colors.warn, bg: colors.warnSoft },
  bad: { fg: colors.bad, bg: colors.badSoft },
};

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
    const update = () => setNow(Date.now());
    const id = setInterval(update, 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => { clearInterval(id); subscription.remove(); };
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

/** A section that folds: the journal and videos are looked up now and then, not every visit. */
function Fold({ icon, title, sub, open, onToggle, dot, children }: {
  icon: IconName; title: string; sub: string; open: boolean; onToggle: () => void; dot?: boolean; children: ReactNode;
}) {
  return (
    <Card style={{ padding: 0, gap: 0 }}>
      <Pressable onPress={() => { tap(); onToggle(); }} style={s.foldHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <IconTile icon={icon} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={s.foldTitle}>{title}</Text>
          <Text numberOfLines={1} style={s.deviceAbout}>{sub}</Text>
        </View>
        {dot && !open ? <View style={s.dot} /> : null}
        <View style={[s.chev, open && { transform: [{ rotate: '180deg' }] }]}><Icon name="arrow-down" size={16} color={colors.ink3} /></View>
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
  const { id = '', certificate } = useLocalSearchParams<{ id: string; certificate?: string }>();
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
  const [profileOpen, setProfileOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  /** Which real-world growing step is read in full ('' for none). */
  const [growOpen, setGrowOpen] = useState('');
  /** How much of the care log shows; it grows every day, so it starts short. */
  const [historyShown, setHistoryShown] = useState(LOG_PAGE);
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
  const [rotating, setRotating] = useState(false);
  const [toolAtWork, setToolAtWork] = useState(false);
  // The scene and pot the plant wears: the saved look, or one being tried on (GardenStyle loads it).
  const [garden, setGarden] = useState<GardenBenefits | null>(null);
  const [gardenOpen, setGardenOpen] = useState(false);
  // After the harvest: a picking's certificate, open; the seeds being sown.
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [sowing, setSowing] = useState(false);
  const [harvestsOpen, setHarvestsOpen] = useState(false);
  const board =useIotBoard(id, plant?.devices || [], (type, next) => toggleDevice(type, next));

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
      // A picking opens its celebration once the game has shown it landing in the basket.
      if (data.harvest) {
        const next: Celebration = { harvest: data.harvest, collection: data.collection ?? null, seatsWon: data.seatsWon || 0, fresh: true };
        setTimeout(() => { cheer(); setCelebration(next); }, 3000);
      }
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

  /** Looks back at one picking's certificate; the collection is fetched on the way. */
  function openCertificate(harvest: HarvestRecord) {
    setCelebration({ harvest, collection: null, seatsWon: 0, fresh: false });
    API.plants.collection()
      .then((collection: HarvestCollection) => setCelebration((cur) => (cur && cur.harvest.id === harvest.id ? { ...cur, collection } : cur)))
      .catch(() => undefined);
  }

  // /plant/<id>?certificate=<picking>, from the album: that picking's certificate opens once the plant is in.
  useEffect(() => {
    if (!certificate || !plant) return;
    const picking = plant.harvests.find((h) => h.id === certificate);
    if (picking) openCertificate(picking);
    router.setParams({ certificate: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [certificate, plant]);

  /** Sows the seeds this finished plant kept: the next season, a plant of its own. */
  async function sowSeeds() {
    setSowing(true);
    try {
      const data = await API.plants.sowSeeds(id);
      toast(data.message || 'Đã gieo vụ mới.', 'success');
      setCelebration(null);
      router.replace(`/plant/${data.plant.id}`);
    } catch (err: any) {
      toast(err?.message || 'Chưa gieo được hạt, thử lại nhé.', 'error');
    } finally {
      setSowing(false);
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
  const lastHarvest = plant.harvests[plant.harvests.length - 1] ?? null;
  const dead = Boolean(plant.diedAt);
  const critical = !dead && plant.wilt.critical;
  const hoursLeft = plant.wilt.hoursLeft === null ? '' : plant.wilt.hoursLeft >= 48 ? `${Math.round(plant.wilt.hoursLeft / 24)} ngày` : `${plant.wilt.hoursLeft} giờ`;
  const recommended = plant.nextStep.action;
  // A different fun fact each day.
  const facts = plant.speciesProfile?.funFacts ?? [];
  const funFact = facts.length ? facts[Math.floor(Date.now() / 86_400_000) % facts.length] : null;
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
  const { clock, isDay } = plantClock(now);
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

  const TABS: Array<{ key: typeof tab; label: string; icon: IconName }> = [
    { key: 'care', label: 'Nhiệm vụ', icon: 'trophy' },
    { key: 'sensors', label: 'Trạm IoT', icon: 'chart' },
    { key: 'log', label: 'Nhật ký', icon: 'clock' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <Screen title={plant.nickname} back="/garden" onRefresh={load} scrollEnabled={!dragging && !rotating}
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
            <Plant3D plant={plant} width={artSize} height={artHeight} isNight={!isDay}
              scene={scene} decoration={garden?.decoration} wind={wind} hint={!toolAtWork}
              onInteractionChange={setRotating}
              gadgets={board.wired.map((t) => device(t)).filter(Boolean).map((d) => ({ type: d!.type, on: d!.kind === 'sensor' || d!.autoMode }))} />
            {!toolAtWork && <View pointerEvents="none" style={s.clock}>
              <Icon name={scene === 'night' ? 'moon' : scene !== 'natural' ? 'sparkle' : isDay ? 'sun' : 'moon'} size={14} color={colors.ink2} />
              {/* A VIP scene is the same place at any hour, so the pill names the scene instead of claiming it is daytime under a night sky. */}
              <Text style={s.clockText}>{scene !== 'natural' ? sceneLook(scene).label : isDay ? 'Ban ngày' : 'Ban đêm'} · {clock}</Text>
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
            <IconTile icon="pot" size={40} tint="#F6E6D6" color={colors.earth} />
            <View style={{ flex: 1 }}>
              <Text style={s.foldTitle}>Trang trí vườn</Text>
              <Text style={s.deviceAbout}>Khung cảnh và chậu</Text>
            </View>
            <View style={[s.chev, gardenOpen && { transform: [{ rotate: '180deg' }] }]}><Icon name="arrow-down" size={16} color={colors.ink3} /></View>
          </Pressable>
          <View style={gardenOpen ? { paddingHorizontal: 12, paddingBottom: 12 } : undefined}>
            <GardenStyle hidden={!gardenOpen} onChange={setGarden} width={inner - 26} />
          </View>
        </Card>

        {/* The one thing to do now; its tool is flagged "Nên làm" on the belt */}
        {!dead && (
          <View style={[s.todo, critical && s.todoBad, harvested && s.todoDone]}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <IconTile icon={harvested ? 'trophy' : critical ? 'warning' : plant.nextStep.icon} size={46}
                tint={critical ? '#F9D9DE' : colors.white} color={critical ? colors.bad : colors.greenDark} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={[s.kicker, critical && { color: colors.bad }]}>{harvested ? 'ĐÃ HOÀN THÀNH' : critical ? `CỨU CÂY · CÒN ${hoursLeft.toUpperCase()}` : 'VIỆC NÊN LÀM'}</Text>
                <Text style={s.todoTitle}>
                  {harvested ? `Bé đã thu hoạch ${plant.harvestLabel}${plant.harvestCount > 1 ? ` · ${plant.harvestCount} đợt` : ''}!` : plant.nextStep.label || 'Chờ dụng cụ hồi lại'}
                </Text>
                <Text numberOfLines={2} style={s.todoWhy}>
                  {harvested ? (plant.seedsReady ? 'Gieo hạt đã giữ thành vụ mới, hoặc chọn kit khác.' : 'Hạt của cây đã gieo thành vụ mới.') : why}
                </Text>
              </View>
              {harvested && lastHarvest && <HarvestStars value={lastHarvest.stars} size={15} />}
            </View>
            {critical && plant.keeper && !plant.keeper.vip && (
              <Button small variant="ghost" icon="star" title="VIP giữ cây không bao giờ héo" onPress={() => router.push('/vip')} />
            )}
            {/* Finished: its certificate, and its seeds for a new season. */}
            {harvested && lastHarvest && (
              <View style={s.todoActions}>
                <Button small grow icon="trophy" title="Chứng nhận" onPress={() => openCertificate(lastHarvest)} />
                {plant.seedsReady && (plant.seedsNeedVip
                  ? <Button small grow variant="light" icon="star" title="Gieo tiếp (VIP)" onPress={() => router.push('/vip')} />
                  : <Button small grow variant="light" icon="seed" title={sowing ? 'Đang gieo…' : 'Gieo vụ mới'} busy={sowing} onPress={sowSeeds} />)}
              </View>
            )}
          </View>
        )}

        {/* Where it stands: the stage as a ring, how it is as tags */}
        <View style={s.status}>
          <Ring value={plant.stageProgress} size={66} stroke={6}>
            <Text style={s.ringNum}>{Math.round(plant.stageProgress)}%</Text>
          </Ring>
          <View style={{ flex: 1, gap: 6 }}>
            <View>
              <Text style={s.stageLabel}>{plant.stageLabel}</Text>
              <Text style={s.stageMeta}>Chặng {plant.stageIndex + 1}/{plant.stageCount} · {plant.speciesLabel}</Text>
            </View>
            <View style={s.badges}>
              <View style={[s.badge, { backgroundColor: BAND[healthTone].bg }]}>
                <Icon name="heart" size={12} color={BAND[healthTone].fg} />
                <Text style={[s.badgeText, { color: BAND[healthTone].fg }]}>{plant.healthState.label}{dead ? '' : ` ${Math.round(plant.health)}%`}</Text>
              </View>
              {plant.careStreak > 0 && <View style={[s.badge, { backgroundColor: '#FFEBD0' }]}><Icon name="bolt" size={12} color={colors.price} /><Text style={[s.badgeText, { color: colors.warn }]}>{plant.careStreak} ngày</Text></View>}
              {plant.keeper?.on && !dead && <View style={[s.badge, { backgroundColor: colors.infoSoft }]}><Icon name="shield" size={12} color={colors.info} /><Text style={[s.badgeText, { color: colors.info }]}>Tự chăm</Text></View>}
              {plant.attempt > 1 && <View style={[s.badge, { backgroundColor: colors.earthSoft }]}><Icon name="seed" size={12} color={colors.earth} /><Text style={[s.badgeText, { color: colors.earth }]}>Lần {plant.attempt}</Text></View>}
              {plant.season > 1 && <View style={[s.badge, { backgroundColor: colors.earthSoft }]}><Icon name="sprout" size={12} color={colors.earth} /><Text style={[s.badgeText, { color: colors.earth }]}>Vụ {plant.season}</Text></View>}
              {plant.harvestCount > 0 && (
                <View style={[s.badge, { backgroundColor: colors.goldSoft }]}>
                  <Icon name="harvest" size={12} color={colors.gold} />
                  <Text style={[s.badgeText, { color: colors.gold }]}>{harvested ? `Hái ${plant.harvestCount} đợt` : `Hái ${plant.harvestCount}/${plant.harvestsMax}`}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Tabs, so the page stays one screen of what matters */}
        <Segmented
          items={TABS.map((t) => ({ key: t.key, label: t.label, icon: t.icon, dot: t.key === 'log' && feed.length > 0 }))}
          value={tab}
          onChange={setTab}
        />

        {tab === 'care' && (
          <>
            {/* What came of it: each picking's stars and certificate, and the dish to make. */}
            {plant.harvests.length > 0 && (
              <Fold icon="trophy" title={`Thành quả · ${plant.harvests.length} lần hái`} sub="Chứng nhận và món ngon từ cây"
                open={harvestsOpen} onToggle={() => setHarvestsOpen((v) => !v)}>
                <View style={{ marginHorizontal: -16 }}>
                  {plant.harvests.map((h, i, all) => (
                    <Pressable key={h.id} onPress={() => { tap(); openCertificate(h); }} accessibilityRole="button"
                      accessibilityLabel={`Xem chứng nhận ${h.of > 1 ? `đợt ${h.number}` : ''}`} style={[s.history, i < all.length - 1 && s.divider]}>
                      <View style={[s.historyIcon, { backgroundColor: colors.goldSoft }]}><Icon name="harvest" size={15} color={colors.gold} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.historyTitle}>{h.of > 1 ? `Đợt ${h.number}/${h.of}` : 'Thu hoạch'}</Text>
                        <Text style={s.deviceAbout}>{new Date(h.createdAt).toLocaleDateString('vi-VN')}</Text>
                      </View>
                      <HarvestStars value={h.stars} size={14} />
                      <Icon name="arrow-right" size={15} color={colors.ink5} />
                    </Pressable>
                  ))}
                </View>
                {plant.recipe && (
                  <View style={s.recipe}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="heart" size={16} color={colors.gold} />
                      <Text style={[s.panelTitle, { flex: 1 }]}>{plant.recipe.title}</Text>
                    </View>
                    {plant.recipe.steps.map((step, i) => <Text key={step} style={s.panelText}>{i + 1}. {step}</Text>)}
                    <Text style={[s.deviceAbout, { color: colors.gold }]}>{plant.recipe.note}</Text>
                  </View>
                )}
              </Fold>
            )}

            {plant.tasks.length > 0 && !dead && !harvested && (
              <View style={s.panel}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[s.panelTitle, { flex: 1 }, plant.tasksDone && { color: colors.greenDark }]}>
                    {plant.tasksDone ? 'Xong nhiệm vụ chặng này' : plant.pointsFull ? 'Làm nốt để lên chặng' : 'Nhiệm vụ lên chặng'}
                  </Text>
                  <Press onPress={() => setGuideOpen(true)} accessibilityLabel="Cách chăm từng việc" scaleTo={0.9} style={s.help}>
                    <Icon name="info" size={14} color={colors.greenDark} /><Text style={s.helpText}>Cách chăm</Text>
                  </Press>
                </View>
                <View style={s.tasks}>
                  {plant.tasks.map((t) => {
                    const ok = t.done >= t.need;
                    return (
                      <View key={t.action} style={[s.task, ok && s.taskOk]}>
                        <View style={[s.taskIcon, ok && { backgroundColor: colors.green }]}>
                          <Icon name={ok ? 'check' : t.icon} size={16} color={ok ? colors.white : colors.greenDark} />
                        </View>
                        <Text numberOfLines={2} style={[s.taskText, ok && { color: colors.ink3 }]}>{t.label}</Text>
                        <Text style={[s.taskCount, ok && { color: colors.greenDark }]}>{t.done}/{t.need}</Text>
                        <Meter value={(Math.min(t.done, t.need) / Math.max(1, t.need)) * 100} height={4} color={ok ? colors.green : colors.greenLight} style={{ alignSelf: 'stretch' }} />
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* One thing about the plant a day, from its species profile; the whole profile is in the journal. */}
            {funFact && (
              <Press onPress={() => { setTab('log'); setProfileOpen(true); }} scaleTo={0.98} style={s.fact}>
                <IconTile icon="star" size={36} tint="#F7DFAE" color={colors.gold} round />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.factTitle}>Bé có biết?</Text>
                  <Text numberOfLines={3} style={s.factText}>{funFact}</Text>
                </View>
                <Icon name="arrow-right" size={16} color={colors.gold} />
              </Press>
            )}

            <View style={s.panel}>
              <Text style={s.panelTitle}>Hành trình của cây</Text>
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
              {plant.stageStory ? <Text numberOfLines={2} style={s.panelText}>{plant.stageStory}</Text> : null}
            </View>
          </>
        )}

        {tab === 'sensors' && (
          <>
            <View style={s.panel}>
              <IotWorkbench board={board} devices={plant.devices} busy={Boolean(deviceBusy)} onToggle={toggleDevice} plantName={plant.nickname} width={inner - 30}
                summaries={{
                  moisture_sensor: verdict('moisture', plant.moisture, plant.idealMoisture),
                  thermo_sensor: verdict('temperature', plant.environment.temperature, plant.idealTemp),
                  light_sensor: verdict('light', plant.environment.light),
                  nutrient_sensor: verdict('nutrient', plant.nutrient),
                  camera: verdict('pest', plant.pestRisk),
                }}
                preview={<Plant3D plant={plant} width={Math.min(inner - 34, 420)} height={220} isNight={!isDay}
                  scene={scene} decoration={garden?.decoration} wind={wind} onInteractionChange={setRotating}
                  gadgets={board.wired.map((t) => device(t)).filter(Boolean).map((d) => ({ type: d!.type, on: d!.kind === 'sensor' || d!.autoMode }))} />} />
            </View>

            <View style={s.panel}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <Text style={[s.panelTitle, { flex: 1, minWidth: 120 }]}>24 giờ qua</Text>
                {/* What the plant likes, so a reading can be judged at a glance */}
                <View style={[s.badge, { backgroundColor: colors.infoSoft }]}><Icon name="water" size={12} color={colors.info} /><Text style={[s.badgeText, { color: colors.info }]}>{plant.idealMoisture[0]}–{plant.idealMoisture[1]}%</Text></View>
                <View style={[s.badge, { backgroundColor: '#FBE6DF' }]}><Icon name="thermo" size={12} color="#B5543B" /><Text style={[s.badgeText, { color: '#B5543B' }]}>{plant.idealTemp[0]}–{plant.idealTemp[1]}°C</Text></View>
              </View>
              <SensorChart readings={plant.readings || []} wired={board.wired} width={inner - 30} />
            </View>
          </>
        )}

        {tab === 'log' && (
          <>
            {/* What is looked up again and again comes first, folded: the care log below
                grows every day and used to push these further down each time. */}
            <Fold icon="camera" title="Video hướng dẫn" sub="Cách gieo, tưới và chăm bộ kit" open={videosOpen} onToggle={() => setVideosOpen((v) => !v)}>
              <ProductVideos productId={plant.productId} signedIn />
            </Fold>
            {(plant.speciesProfile || plant.cultivation) && (
              <Fold icon="book" title={`Hồ sơ giống · ${plant.speciesLabel}`} sub="Câu chuyện và điều thú vị"
                open={profileOpen} onToggle={() => setProfileOpen((v) => !v)}>
                {plant.speciesProfile && <SpeciesProfile label={plant.speciesLabel} profile={plant.speciesProfile} title={false} />}
                {plant.cultivation && (
                  <View style={s.realGrow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="pot" size={16} color={colors.greenDark} />
                      <Text style={s.panelTitle}>Trồng ngoài đời thật</Text>
                    </View>
                    {/* Three steps, one line each; the sentence behind each is a tap away. */}
                    {([
                      ['seed', 'Gieo', plant.cultivation.sow],
                      ['sprout', 'Chăm', plant.cultivation.support],
                      ['harvest', 'Thu hoạch', plant.cultivation.mature],
                    ] as Array<[IconName, string, string]>).map(([icon, step, text], i, all) => (
                      <Pressable key={step} onPress={() => { tap(); setGrowOpen((v) => (v === step ? '' : step)); }} accessibilityRole="button"
                        accessibilityState={{ expanded: growOpen === step }} style={s.growStep}>
                        <View style={{ alignItems: 'center' }}>
                          <View style={s.growIcon}><Icon name={icon} size={16} color={colors.greenDark} /></View>
                          {i < all.length - 1 && <View style={s.growLine} />}
                        </View>
                        <View style={{ flex: 1, paddingBottom: 10 }}>
                          <Text style={s.growLabel}>{step}</Text>
                          <Text numberOfLines={growOpen === step ? undefined : 1} style={s.panelText}>{text}</Text>
                        </View>
                      </Pressable>
                    ))}
                    <Text style={s.deviceAbout}>Trong app, thời gian được rút ngắn cho bé dễ theo dõi.</Text>
                  </View>
                )}
              </Fold>
            )}
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
            {/* The care log grows every day: one line until it is opened. */}
            <Fold icon="clock" title={plant.history.length ? `${plant.history.length} việc bé đã làm` : 'Nhật ký chăm cây'}
              sub={plant.history[0] ? `Gần nhất: ${plant.history[0].auto ? 'tự động ' : ''}${plant.history[0].label.toLowerCase()} · ${formatDateTime(plant.history[0].createdAt)}` : 'Kéo một dụng cụ lên cây để bắt đầu'}
              open={logOpen} onToggle={() => setLogOpen((v) => !v)}>
              {plant.history.length === 0 && <Text style={s.deviceAbout}>Chưa có lần chăm cây nào.</Text>}
              <View style={{ marginHorizontal: -16 }}>
              {plant.history.slice(0, historyShown).map((h, i, all) => (
                <View key={h.id} style={[s.history, i < all.length - 1 && s.divider]}>
                  <View style={s.historyIcon}><Icon name={h.auto ? 'shield' : h.icon} size={15} color={h.warned ? colors.warn : colors.greenDark} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.historyTitle}>{h.auto ? `Chăm tự động: ${h.label.toLowerCase()}${h.count > 1 ? ` ×${h.count}` : ''}` : h.label}</Text>
                    <Text style={s.deviceAbout}>{formatDateTime(h.createdAt)} · {h.stageLabel}</Text>
                  </View>
                  {h.growth > 0 && <Text style={s.growth}>+{h.growth.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}</Text>}
                </View>
              ))}
              {plant.history.length > LOG_PAGE && (
                <Pressable onPress={() => { tap(); setHistoryShown((n) => (n >= plant.history.length ? LOG_PAGE : n + 10)); }}
                  accessibilityRole="button" style={s.more}>
                  <Text style={s.moreText}>
                    {historyShown >= plant.history.length ? 'Thu gọn' : `Xem thêm ${Math.min(10, plant.history.length - historyShown)} việc`}
                  </Text>
                  <View style={historyShown >= plant.history.length ? { transform: [{ rotate: '180deg' }] } : undefined}>
                    <Icon name="arrow-down" size={16} color={colors.green} />
                  </View>
                </Pressable>
              )}
              </View>
            </Fold>
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

      <HarvestSheet celebration={celebration} plant={plant} sowing={sowing} onSow={sowSeeds} onClose={() => setCelebration(null)} />

      <Sheet open={renaming} title="Đổi tên cây" onClose={() => setRenaming(false)} footer={<Button title="Lưu tên" onPress={saveName} />}>
        <Field label="Tên mới" value={nameDraft} onChangeText={setNameDraft} maxLength={40} autoFocus onSubmitEditing={saveName} />
      </Sheet>

      <Sheet open={guideOpen} title="Cây cần gì?" onClose={() => setGuideOpen(false)}>
        <View style={s.guide}>
          {([
            ['arrow-right', 'Kéo dụng cụ lên cây', 'Giữ yên tới khi vòng tròn đầy'],
            ['water', 'Tưới khi đất khô', 'Đất còn ướt thì chờ thêm'],
            ['fertilize', 'Bón khi cây đói', 'Thức ăn dưới 45%'],
            ['pest', 'Bắt sâu khi có sâu', 'Camera sẽ báo'],
            ['sun', 'Ra nắng ban ngày', 'Ban đêm cây nghỉ'],
            ['clock', 'Số trên dụng cụ', 'Thời gian chờ còn lại'],
            ['star', 'Nhãn “Nên làm”', 'Việc nên làm ngay'],
          ] as Array<[IconName, string, string]>).map(([icon, title, text], i, all) => (
            <View key={icon} style={[s.guideRow, i < all.length - 1 && s.divider]}>
              <IconTile icon={icon} size={38} />
              <View style={{ flex: 1 }}>
                <Text style={s.historyTitle}>{title}</Text>
                <Text style={s.deviceAbout}>{text}</Text>
              </View>
            </View>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  art: { alignSelf: 'center', borderRadius: radius.xl, overflow: 'hidden' },
  clock: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.9)' },
  clockText: { fontFamily: fonts.semi, fontSize: 12, color: colors.ink2 },
  dead: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,253,248,0.94)', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20 },
  status: { ...surface, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  ringNum: { fontFamily: fonts.display, fontSize: 16, lineHeight: 20, color: colors.greenDark },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  badgeText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.greenDark },
  stageLabel: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25, color: colors.ink },
  stageMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink3 },

  todo: { gap: 10, padding: 14, borderRadius: radius.lg, backgroundColor: colors.mint },
  todoBad: { backgroundColor: colors.badSoft },
  todoDone: { backgroundColor: colors.goldSoft },
  kicker: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, color: colors.green },
  todoTitle: { fontFamily: fonts.bold, fontSize: 16.5, lineHeight: 22, color: colors.ink },
  todoWhy: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.ink2 },
  todoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recipe: { gap: 6, padding: 12, borderRadius: radius.md, backgroundColor: '#FFF7E8' },

  help: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 34, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.mint },
  helpText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.greenDark },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, backgroundColor: colors.goldSoft },
  factTitle: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.gold },
  factText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  note: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.ink3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  panel: { ...surface, gap: 12, padding: 14 },
  panelTitle: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.ink },
  panelText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.ink3 },
  tasks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  task: { flexBasis: '30%', flexGrow: 1, alignItems: 'center', gap: 5, padding: 10, borderRadius: radius.md, backgroundColor: colors.canvas },
  taskOk: { backgroundColor: '#EEF8EA' },
  taskIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  taskText: { fontFamily: fonts.semi, fontSize: 12.5, lineHeight: 16, color: colors.ink2, textAlign: 'center', minHeight: 32 },
  taskCount: { fontFamily: fonts.display, fontSize: 16, lineHeight: 20, color: colors.ink },
  journeyLine: { width: 12, height: 2, backgroundColor: colors.sand, marginBottom: 22 },
  journeyDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sand },
  journeyReached: { backgroundColor: colors.mint },
  journeyNow: { backgroundColor: colors.green },
  journeyLabel: { fontFamily: fonts.semi, fontSize: 10.5, color: colors.ink4, textAlign: 'center' },

  list: { ...surface },
  listHead: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.ink, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 6 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  deviceName: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  deviceAbout: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18, color: colors.ink3 },

  aiAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  bubbleMe: { alignSelf: 'flex-end', backgroundColor: colors.green, borderBottomRightRadius: 6 },
  bubbleAi: { alignSelf: 'flex-start', backgroundColor: colors.card, borderBottomLeftRadius: 6 },
  bubbleText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink },
  quick: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.mint, justifyContent: 'center' },
  quickLead: { backgroundColor: colors.green },
  quickText: { fontFamily: fonts.semi, fontSize: 13.5, color: colors.greenDark },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  composerInput: { flex: 1, minHeight: 48, borderRadius: radius.pill, paddingHorizontal: 18, fontFamily: fonts.body, fontSize: 15, color: colors.ink, backgroundColor: colors.canvas },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },

  foldHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 68 },
  foldTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  chev: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange },
  feed: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  feedText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.ink2 },
  realGrow: { gap: 10, marginTop: 4, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  growStep: { flexDirection: 'row', gap: 10 },
  growIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  growLine: { flex: 1, width: 2, minHeight: 10, marginTop: 2, borderRadius: 1, backgroundColor: colors.mint },
  growLabel: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.ink },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  moreText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  history: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingHorizontal: 14, paddingVertical: 8 },
  historyIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  historyTitle: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink },
  growth: { fontFamily: fonts.bold, fontSize: 13, color: colors.green, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.mint, overflow: 'hidden' },
  guide: { borderRadius: radius.lg, backgroundColor: colors.card },
  guideRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
});
