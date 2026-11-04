import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import Svg, { G, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { HarvestCollection, HarvestRecord, PlantDetail } from '@/lib/types';
import { colors, fonts, radius, surface } from '@/theme';
import { Icon, type IconName } from './Icon';
import { useToast } from './Toast';
import { Button, Press, Sheet } from './ui';

/*
 * What a harvest opens, as on the website (frontend/src/components/HarvestCelebration.tsx):
 * the basket filling, the picking's certificate to keep or send, a nudge to
 * photograph the real plant for the album, a dish to make with the harvest,
 * the species collection it counts towards, and what comes next — tend it for
 * the next picking, or sow the seeds a finished plant kept.
 */

export interface Celebration {
  harvest: HarvestRecord;
  collection: HarvestCollection | null;
  /** Free workshop seats this harvest won by completing the collection. */
  seatsWon: number;
  /** Opened by the harvest just now, rather than to look back at one. */
  fresh: boolean;
}

const dateVi = (iso: string) => new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const pickingLabel = (h: HarvestRecord) => (h.of > 1 ? ` · đợt ${h.number}/${h.of}` : '');

/** Why it earned its stars, in the child's terms. */
export const starReasons = (h: HarvestRecord) => [
  `Sức khoẻ TB ${h.avgHealth}%`,
  `${h.streak} ngày liền`,
  h.attempt > 1 ? `Gieo lại ${h.attempt - 1} lần` : 'Chưa lần nào héo khô',
];

function starPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
  }).join(' ');
}

/** Three stars, filled to `value`. */
export function HarvestStars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <Svg width={size * 3 + 6} height={size} accessibilityLabel={`${value} trên 3 sao`}>
      {[0, 1, 2].map((i) => (
        <Polygon key={i} points={starPoints(size / 2 + i * (size + 3), size / 2, size / 2)} fill={i < value ? '#E9A21B' : '#E2DED2'} />
      ))}
    </Svg>
  );
}

/**
 * "Chứng nhận Nhà nông nhí", drawn as one picture so it can be saved and
 * sent as it is seen (react-native-svg's toDataURL).
 */
function Certificate({ h, width, svgRef }: { h: HarvestRecord; width: number; svgRef: React.RefObject<any> }) {
  const W = 600, H = 430;
  const stats: Array<[string, string]> = [[String(h.days), 'ngày trồng'], [String(h.careCount), 'lần chăm'], [String(h.streak), 'ngày liền'], [`${h.avgHealth}%`, 'sức khoẻ']];
  return (
    <Svg ref={svgRef} width={width} height={(width * H) / W} viewBox={`0 0 ${W} ${H}`}>
      <Rect x={0} y={0} width={W} height={H} rx={28} fill="#FFFFFF" />
      <Rect x={10} y={10} width={W - 20} height={H - 20} rx={22} fill="none" stroke={colors.green} strokeWidth={4} />
      <Rect x={22} y={22} width={W - 44} height={H - 44} rx={16} fill="none" stroke={colors.mint} strokeWidth={2} />
      <SvgText x={W / 2} y={68} textAnchor="middle" fontFamily={fonts.bold} fontSize={15} letterSpacing={2} fill={colors.green}>CHỨNG NHẬN NHÀ NÔNG NHÍ</SvgText>
      <SvgText x={W / 2} y={124} textAnchor="middle" fontFamily={fonts.display} fontSize={40} fill={colors.ink}>{h.plantName}</SvgText>
      <SvgText x={W / 2} y={156} textAnchor="middle" fontFamily={fonts.body} fontSize={15} fill={colors.ink3}>
        {`${h.speciesLabel} · thu hoạch ${h.harvestLabel}${pickingLabel(h)}${h.season > 1 ? ` · vụ ${h.season}` : ''}`}
      </SvgText>
      {[0, 1, 2].map((i) => <Polygon key={i} points={starPoints(W / 2 + (i - 1) * 42, 196, 17)} fill={i < h.stars ? '#E9A21B' : '#E6E1D3'} />)}
      {stats.map(([value, label], i) => (
        <G key={label}>
          <Rect x={42 + i * 132} y={232} width={118} height={78} rx={16} fill={colors.greenSoft} />
          <SvgText x={101 + i * 132} y={274} textAnchor="middle" fontFamily={fonts.display} fontSize={28} fill={colors.greenDark}>{value}</SvgText>
          <SvgText x={101 + i * 132} y={296} textAnchor="middle" fontFamily={fonts.body} fontSize={12.5} fill={colors.ink3}>{label}</SvgText>
        </G>
      ))}
      <SvgText x={W / 2} y={344} textAnchor="middle" fontFamily={fonts.medium} fontSize={13.5} fill={colors.ink2}>{starReasons(h).join('  ·  ')}</SvgText>
      <SvgText x={W / 2} y={392} textAnchor="middle" fontFamily={fonts.body} fontSize={12.5} fill={colors.ink4}>{`Ngày ${dateVi(h.createdAt)}  ·  sprouty.id.vn`}</SvgText>
    </Svg>
  );
}

/** The basket, and the harvest dropping into it once. */
function Basket({ fresh, color }: { fresh: boolean; color: string }) {
  const drop = useRef(new Animated.Value(fresh ? 0 : 1)).current;
  const bounce = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!fresh) return;
    Animated.sequence([
      Animated.timing(drop, { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.spring(bounce, { toValue: 1.12, useNativeDriver: true, speed: 30, bounciness: 12 }),
      Animated.spring(bounce, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
  }, [fresh, drop, bounce]);
  return (
    <View style={s.hero} accessibilityElementsHidden>
      {fresh && [0, 1, 2, 3, 4].map((i) => (
        <Animated.View key={i} style={[s.drop, { backgroundColor: color, left: '50%', marginLeft: (i - 2) * 16 - 7,
          opacity: drop.interpolate({ inputRange: [0, 0.2, 0.9, 1], outputRange: [0, 1, 1, 0] }),
          transform: [{ translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-10 - i * 6, 60] }) }] }]} />
      ))}
      <Animated.View style={[s.basket, { transform: [{ scale: bounce }] }]}><Icon name="harvest" size={42} color={colors.greenDark} /></Animated.View>
    </View>
  );
}

export function HarvestSheet({ celebration, plant, sowing, onSow, onClose }: {
  celebration: Celebration | null;
  plant: PlantDetail;
  sowing: boolean;
  onSow: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const { width } = useWindowDimensions();
  const svgRef = useRef<any>(null);
  const [sharing, setSharing] = useState(false);
  if (!celebration) return <Sheet open={false} title="" onClose={onClose}><View /></Sheet>;
  const { harvest, collection, seatsWon, fresh } = celebration;
  const finished = Boolean(plant.harvestedAt);
  // The journey's end: its final picking, or the last one of a plant that finished early.
  const last = harvest.number >= harvest.of || (finished && harvest.number >= plant.harvestCount);
  // Looking back at a picking that more followed: told as done, not as still to come.
  const followed = plant.harvestCount > harvest.number;
  const certWidth = Math.min(width - 40, 560);

  function share() {
    if (!svgRef.current?.toDataURL) return;
    setSharing(true);
    svgRef.current.toDataURL(async (base64: string) => {
      try {
        const file = new File(Paths.cache, `chung-nhan-${harvest.id}.png`);
        if (file.exists) file.delete();
        file.create();
        file.write(base64, { encoding: 'base64' });
        await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: 'Chứng nhận Nhà nông nhí' });
      } catch {
        toast('Chưa lưu được ảnh chứng nhận. Bạn có thể chụp màn hình nhé.', 'error');
      } finally {
        setSharing(false);
      }
    }, { width: 1200, height: 860 });
  }

  const go = (href: string) => { onClose(); router.push(href as never); };

  return (
    <Sheet open title={fresh ? 'Chúc mừng thu hoạch!' : 'Giấy chứng nhận'} onClose={onClose}
      footer={(
        <View style={{ gap: 8 }}>
          {!finished ? (
            <Button title="Chăm tiếp cho đợt sau" onPress={onClose} />
          ) : plant.seedsReady ? (
            plant.seedsNeedVip
              ? <Button title="Gieo vụ tiếp với VIP Garden" icon="star" onPress={() => go('/vip')} />
              : <Button title={sowing ? 'Đang gieo…' : 'Gieo vụ mới từ hạt đã giữ'} icon="seed" busy={sowing} onPress={onSow} />
          ) : null}
          {finished && <Button title="Chọn bộ kit khác" variant="ghost" onPress={() => go('/shop')} />}
        </View>
      )}>
      <Basket fresh={fresh} color={plant.fruitColor} />
      <View style={{ gap: 2 }}>
        <Text style={s.title}>{last ? 'Hoàn thành hành trình!' : `Thu hoạch đợt ${harvest.number}/${harvest.of}!`}</Text>
        <Text style={s.lead}>
          {last ? `Bé đã hái ${harvest.harvestLabel} từ ${harvest.plantName}.`
            : followed ? `Bé đã hái ${harvest.harvestLabel} đợt ${harvest.number} từ ${harvest.plantName}.`
            : `${harvest.plantName} sẽ ra ${harvest.harvestLabel} tiếp — chăm thêm để hái đợt ${harvest.number + 1}.`}
        </Text>
      </View>

      {seatsWon > 0 && (
        <Press onPress={() => go('/workshop')} scaleTo={0.98} style={s.reward}>
          <Icon name="gift" size={22} color={colors.gold} />
          <Text style={s.rewardText}><Text style={{ fontFamily: fonts.bold }}>Tặng 1 suất workshop miễn phí!</Text> Bé đã thu hoạch đủ {collection?.total} loài.</Text>
          <Icon name="arrow-right" size={16} color={colors.gold} />
        </Press>
      )}

      <View style={s.cert}><Certificate h={harvest} width={certWidth} svgRef={svgRef} /></View>
      <Button title={sharing ? 'Đang tạo ảnh…' : 'Lưu / gửi giấy chứng nhận'} icon="share" variant="soft" busy={sharing} onPress={share} />

      {/* The real plant on the windowsill: photographed into the album. */}
      <Press onPress={() => go(`/album?productId=${plant.productId}&plantId=${plant.id}${plant.realHarvestPhoto ? '' : '&harvest=1'}`)} scaleTo={0.98} style={s.row}>
        <View style={[s.rowIcon, plant.realHarvestPhoto && { backgroundColor: colors.mint }]}>
          <Icon name={plant.realHarvestPhoto ? 'check' : 'camera'} size={20} color={plant.realHarvestPhoto ? colors.greenDark : '#2F6F78'} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle}>{plant.realHarvestPhoto ? 'Đã lưu ảnh cây thật' : 'Bé đã hái cây thật chưa?'}</Text>
          <Text style={s.rowSub}>{plant.realHarvestPhoto ? 'Xem lại trong Album kỷ niệm' : 'Chụp thành quả, lưu vào Album'}</Text>
        </View>
        <Icon name="arrow-right" size={16} color={colors.ink5} />
      </Press>

      {plant.recipe && (
        <View style={s.recipe}>
          <View style={s.recipeHead}><Icon name="heart" size={17} color={colors.gold} /><Text style={s.recipeTitle}>{plant.recipe.title}</Text></View>
          {plant.recipe.steps.map((step, i) => (
            <View key={step} style={s.step}><Text style={s.stepNum}>{i + 1}</Text><Text style={s.stepText}>{step}</Text></View>
          ))}
          <Text style={s.note}>{plant.recipe.note}</Text>
        </View>
      )}

      {collection && collection.total > 0 && (
        <View style={s.collection}>
          <View style={s.collectionHead}>
            <Text style={s.rowTitle}>Bộ sưu tập loài</Text>
            <Text style={s.count}>{collection.collected}/{collection.total} loài</Text>
          </View>
          <View style={s.chips}>
            {collection.species.map((sp) => (
              <View key={sp.key} style={[s.chip, sp.harvests > 0 && s.chipOn]}>
                <Icon name={sp.icon as IconName} size={13} color={sp.harvests > 0 ? colors.greenDark : colors.ink4} />
                <Text style={[s.chipText, sp.harvests > 0 && { color: colors.greenDark }]}>{sp.label}</Text>
              </View>
            ))}
          </View>
          {collection.collected < collection.total && <Text style={s.rowSub}>Đủ {collection.total} loài được tặng 1 suất workshop miễn phí.</Text>}
        </View>
      )}
    </Sheet>
  );
}

const s = StyleSheet.create({
  hero: { height: 100, alignItems: 'center', justifyContent: 'flex-end' },
  basket: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', borderWidth: 5, borderColor: colors.white },
  drop: { position: 'absolute', top: 0, width: 14, height: 14, borderRadius: 7 },
  title: { fontFamily: fonts.display, fontSize: 23, lineHeight: 29, color: colors.ink, textAlign: 'center' },
  lead: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.ink3, textAlign: 'center' },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.goldSoft },
  rewardText: { flex: 1, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.gold },
  cert: { ...surface, alignItems: 'center', overflow: 'hidden' },
  row: { ...surface, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  rowIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#DCEFF1', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink },
  rowSub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.ink3 },
  recipe: { gap: 8, padding: 14, borderRadius: radius.lg, backgroundColor: '#FFF7E8' },
  recipeHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recipeTitle: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  step: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  stepNum: { width: 22, height: 22, borderRadius: 11, textAlign: 'center', lineHeight: 22, overflow: 'hidden', backgroundColor: '#F7DFAE', fontFamily: fonts.bold, fontSize: 12, color: colors.gold },
  stepText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.ink2 },
  note: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.gold },
  collection: { ...surface, gap: 10, padding: 14 },
  collectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.greenDark },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.sand },
  chipOn: { backgroundColor: colors.mint },
  chipText: { fontFamily: fonts.semi, fontSize: 12, color: colors.ink4 },
});
