import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { API, imageSource } from '@/lib/api';
import { setGardenLook } from '@/lib/garden-look';
import { fonts } from '@/theme';
import { tap } from './ui';

/*
 * The garden's scene and pot, as the website's GardenStyle
 * (frontend/src/components/GardenStyle.tsx and garden-looks.ts): every look
 * is a picture; a VIP picks one and it is saved at once for all their
 * plants; anybody else can press a VIP look to try it on the 3D plant above,
 * which saves nothing.
 */

export type SceneKey = 'natural' | 'night' | 'autumn' | 'sakura';
export type PotKey = 'plain' | 'terracotta' | 'ceramic' | 'porcelain';

export interface GardenBenefits {
  vip: boolean;
  scene: SceneKey;
  decoration: PotKey;
  aiLimit: number | null;
  aiUsed: number;
}

interface SceneLook { key: SceneKey; label: string; vip: boolean; blurb: string; swatch: [string, string, string] }
interface PotLook { key: PotKey; label: string; vip: boolean; blurb: string; swatch: [string, string] }

export const SCENES: SceneLook[] = [
  { key: 'natural', label: 'Theo ngày và đêm', vip: false, blurb: 'Trời sáng tối theo giờ thật', swatch: ['#B9DCE0', '#F3F2DC', '#BFD0A1'] },
  { key: 'night', label: 'Đêm đầy sao', vip: true, blurb: 'Dải ngân hà, trăng tròn và đom đóm bay quanh cây', swatch: ['#0E1838', '#3B3F7A', '#1F3B3A'] },
  { key: 'autumn', label: 'Nắng mùa thu', vip: true, blurb: 'Hoàng hôn vàng cam, rừng phong đỏ và lá rơi', swatch: ['#F7A35C', '#FDE3B0', '#C9873F'] },
  { key: 'sakura', label: 'Xuân hoa anh đào', vip: true, blurb: 'Cành anh đào nở rộ, cánh hoa hồng bay trong gió', swatch: ['#F9D4E3', '#FFF4F6', '#C9DDB0'] },
];

export const POTS: PotLook[] = [
  { key: 'plain', label: 'Chậu đất cơ bản', vip: false, blurb: 'Chậu đất nung trơn', swatch: ['#B87551', '#C98A64'] },
  { key: 'terracotta', label: 'Đất nung khắc vân', vip: true, blurb: 'Vành cuộn dày, hoa văn nổi và đĩa lót', swatch: ['#9E4A2A', '#E0B07A'] },
  { key: 'ceramic', label: 'Gốm men ngọc', vip: true, blurb: 'Dáng tròn, men bóng và viền vàng', swatch: ['#6FA79A', '#D9B45A'] },
  { key: 'porcelain', label: 'Sứ men lam', vip: true, blurb: 'Sứ trắng vẽ hoa sen xanh lam kiểu Bát Tràng', swatch: ['#F4F6FA', '#2D4F9E'] },
];

export const sceneLook = (key?: string) => SCENES.find((s) => s.key === key) ?? SCENES[0];
export const potLook = (key?: string) => POTS.find((p) => p.key === key) ?? POTS[0];

const vipMark = imageSource('/assets/images/sprouty-icons/VIP.png') as number;

/* ── Previews ──────────────────────────────────────────────────────────── */

/** A thumbnail of the scene: its sky, its ground, and its signature detail. */
function ScenePreview({ look }: { look: SceneLook }) {
  const [top, bottom, ground] = look.swatch;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id={`sky-${look.key}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={top} />
          <Stop offset="1" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      <Rect width={120} height={80} fill={`url(#sky-${look.key})`} />
      {look.key === 'natural' && (
        <>
          <Circle cx={94} cy={20} r={9} fill="#FFF0B0" />
          <Ellipse cx={30} cy={22} rx={14} ry={6} fill="#FFFFFF" opacity={0.85} />
        </>
      )}
      {look.key === 'night' && (
        <>
          <Path d="M-5 40 L125 8" stroke="#B9B6FF" strokeWidth={14} opacity={0.18} />
          {[[12, 10], [30, 26], [52, 8], [70, 22], [88, 12], [104, 30], [20, 40], [62, 36], [110, 8]].map(([x, y]) => (
            <Circle key={`${x}-${y}`} cx={x} cy={y} r={x % 3 ? 0.9 : 1.5} fill="#F1F3FF" />
          ))}
          <Circle cx={24} cy={18} r={13} fill="#FFF4D6" opacity={0.25} />
          <Circle cx={24} cy={18} r={8} fill="#FBF4DC" />
          {[[40, 58], [78, 54], [96, 62], [58, 66]].map(([x, y]) => <Circle key={`f${x}`} cx={x} cy={y} r={1.8} fill="#FFE38A" />)}
        </>
      )}
      {look.key === 'autumn' && (
        <>
          <Circle cx={86} cy={44} r={16} fill="#FFE2A8" opacity={0.55} />
          <Circle cx={86} cy={44} r={9} fill="#FFF4D2" />
          {([[14, 50, '#D9452B'], [30, 46, '#F07A2C'], [100, 48, '#B8321F'], [112, 52, '#F2A531']] as const).map(([x, y, c]) => (
            <Circle key={`t${x}`} cx={x} cy={y} r={9} fill={c} />
          ))}
          {([[48, 20, '#E2542C'], [66, 32, '#F2A531'], [40, 40, '#C8402A']] as const).map(([x, y, c]) => (
            <Path key={`l${x}`} d={`M${x} ${y} l3 -4 l3 4 l-3 4 z`} fill={c} />
          ))}
        </>
      )}
      {look.key === 'sakura' && (
        <>
          <Path d="M-2 6 C 20 14, 30 18, 46 28" stroke="#5A3A32" strokeWidth={2.5} fill="none" />
          {[[16, 10], [26, 16], [36, 20], [44, 27], [20, 20], [32, 26]].map(([x, y]) => <Circle key={`b${x}-${y}`} cx={x} cy={y} r={3.4} fill="#F39BBB" />)}
          <Path d="M54 54 L70 30 L86 54 z" fill="#D6C9E4" />
          {[[100, 22], [80, 14], [62, 40], [108, 44]].map(([x, y]) => <Ellipse key={`p${x}`} cx={x} cy={y} rx={2.2} ry={1.4} fill="#F7B8CF" />)}
        </>
      )}
      <Path d="M0 62 C 30 54, 90 56, 120 62 L120 80 L0 80 Z" fill={ground} />
    </Svg>
  );
}

/** A drawing of the pot: the shape and the glaze, as they will look in 3D. */
function PotPreview({ look }: { look: PotLook }) {
  const [body, accent] = look.swatch;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice">
      <Rect width={120} height={80} fill="#F6F3EA" />
      {look.key === 'plain' && (
        <>
          <Path d="M38 26 h44 l-6 40 h-32 z" fill={body} />
          <Rect x={35} y={22} width={50} height={8} rx={3} fill={accent} />
        </>
      )}
      {look.key === 'terracotta' && (
        <>
          <Ellipse cx={60} cy={70} rx={30} ry={4} fill={body} />
          <Path d="M39 28 h42 l-6 38 h-30 z" fill={body} />
          <Rect x={33} y={21} width={54} height={10} rx={5} fill="#B4603A" />
          <Path d="M42 40 h36 M44 56 h32" stroke={accent} strokeWidth={2} />
          {[46, 53, 60, 67, 74].map((x) => <Path key={x} d={`M${x} 44 l3 4 l-3 4 l-3 -4 z`} fill={accent} />)}
        </>
      )}
      {look.key === 'ceramic' && (
        <>
          <Path d="M46 24 h28 l2 4 C 96 34, 96 62, 72 68 h-24 C 24 62, 24 34, 44 28 z" fill={body} />
          <Ellipse cx={54} cy={40} rx={6} ry={12} fill="#FFFFFF" opacity={0.35} />
          <Rect x={44} y={21} width={32} height={5} rx={2.5} fill={accent} />
          <Path d="M33 46 C 50 50, 70 50, 87 46" stroke={accent} strokeWidth={1.4} fill="none" />
        </>
      )}
      {look.key === 'porcelain' && (
        <>
          <Path d="M38 26 h44 l-2 34 l-6 8 h-28 l-6 -8 z" fill={body} stroke="#D5DCEB" />
          <Rect x={36} y={22} width={48} height={6} rx={3} fill={body} stroke={accent} strokeWidth={1.5} />
          <Path d="M40 32 q4 -3 8 0 q4 3 8 0 q4 -3 8 0 q4 3 8 0 q4 -3 8 0" stroke={accent} strokeWidth={1.4} fill="none" />
          <Path d="M60 38 c5 4 5 11 0 14 c-5 -3 -5 -10 0 -14 z" fill="#5E7FC8" stroke={accent} />
          <Path d="M51 44 c4 2 6 7 4 10 c-4 -1 -6 -6 -4 -10 z M69 44 c-4 2 -6 7 -4 10 c4 -1 6 -6 4 -10 z" fill="#5E7FC8" stroke={accent} />
          <Path d="M42 62 h36" stroke={accent} strokeWidth={1.4} />
        </>
      )}
    </Svg>
  );
}

/* ── Tile ──────────────────────────────────────────────────────────────── */

function Tile({ label, blurb, vip, locked, selected, previewing, disabled, compact, width, onPick, children }: {
  label: string; blurb: string; vip: boolean; locked: boolean; selected: boolean; previewing: boolean; disabled: boolean;
  /** Thumbnail-sized: the VIP tag keeps its icon and drops the word. */
  compact: boolean;
  width: number;
  onPick: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable onPress={() => { tap(); onPick(); }} disabled={disabled} accessibilityRole="button"
      accessibilityState={{ selected: selected || previewing, disabled }}
      accessibilityLabel={locked ? `${label}: ${blurb}. Bấm để xem thử, nâng cấp VIP để giữ lại.` : `${label}: ${blurb}`}
      style={({ pressed }) => [s.tile, { width },
        selected && (vip ? s.tileVipOn : s.tileOn), previewing && s.tilePreview,
        disabled && { opacity: 0.75 }, pressed && { opacity: 0.85 }]}>
      <View style={s.tileArt}>
        {children}
        {vip && (
          <View style={[s.tag, locked && s.tagLocked, compact && s.tagCompact]}>
            {locked ? (
              <Svg width={11} height={11} viewBox="0 0 16 16">
                <Rect x={3} y={7} width={10} height={7} rx={1.5} fill="#fff" />
                <Path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="#fff" strokeWidth={1.6} fill="none" />
              </Svg>
            ) : <Image source={vipMark} style={{ width: 12, height: 12 }} contentFit="contain" />}
            {!compact && <Text style={[s.tagText, locked && { color: '#fff' }]}>VIP</Text>}
          </View>
        )}
        {(selected || previewing) && (
          <View style={[s.check, vip && selected && { backgroundColor: '#C08A12' }, previewing && { backgroundColor: '#E08A1E' }]}>
            <Text style={s.checkText}>{previewing ? 'Thử' : '✓'}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={[s.tileLabel, compact && { fontSize: 11 }]}>{label}</Text>
    </Pressable>
  );
}

/* ── Panel ─────────────────────────────────────────────────────────────── */

/**
 * Loads the account's look and reports what the plant should wear — the
 * saved look, or the one being tried on — through `onChange`. Keep it
 * mounted while folded away: the 3D plant is drawn with what it loads.
 */
export function GardenStyle({ onChange, width, hidden }: { onChange: (value: GardenBenefits) => void; width: number; hidden?: boolean }) {
  const [value, setValue] = useState<GardenBenefits | null>(null);
  const [preview, setPreview] = useState<{ scene?: SceneKey; decoration?: PotKey }>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    API.garden.benefits()
      .then((data: GardenBenefits) => { if (active) setValue(data); })
      .catch(() => { if (active) setError('Chưa tải được quyền lợi. Vui lòng tải lại trang.'); });
    return () => { active = false; };
  }, []);

  // What the viewer should show: the saved look, or the one being tried on.
  useEffect(() => {
    if (!value) return;
    onChange({ ...value, scene: preview.scene ?? value.scene, decoration: preview.decoration ?? value.decoration });
  }, [value, preview, onChange]);

  if (hidden) return null;

  const vip = Boolean(value?.vip);
  const trying = !vip && Boolean(preview.scene || preview.decoration);

  async function pick(patch: { scene?: SceneKey; decoration?: PotKey }, isVipLook: boolean) {
    if (!value) return;
    setError('');
    // A regular account trying a VIP look: show it, save nothing.
    if (!vip) {
      if (!isVipLook) setPreview((p) => ({ ...p, ...(patch.scene ? { scene: undefined } : {}), ...(patch.decoration ? { decoration: undefined } : {}) }));
      else setPreview((p) => ({ ...p, ...patch }));
      return;
    }
    // VIP: applied at once, saved behind it, put back if the save fails.
    const before = value;
    const next = { ...value, ...patch };
    setValue(next);
    setBusy(true);
    try {
      const stored = await API.garden.save({ scene: next.scene, decoration: next.decoration });
      setValue(stored);
      // The plant cards elsewhere wear the new look too.
      setGardenLook({ scene: stored.scene, decoration: stored.decoration });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e: any) {
      setValue(before);
      setError(e?.message || 'Chưa lưu được lựa chọn.');
    } finally {
      setBusy(false);
    }
  }

  const shownScene = preview.scene ?? value?.scene ?? 'natural';
  const shownPot = preview.decoration ?? value?.decoration ?? 'plain';
  // Scenes and pots side by side when there is room, one under the other on a phone.
  const inner = width - 2 * 14 - 2;
  const sideBySide = inner >= 640;
  const groupW = sideBySide ? (inner - 24) / 2 : inner;
  const tileW = Math.floor((groupW - 3 * 6) / 4);
  const compact = tileW < 84;

  const group = (title: string, look: { label: string; blurb: string }, tiles: ReactNode) => (
    <View style={{ gap: 7, width: groupW }}>
      <Text numberOfLines={1} style={s.groupLabel}>{title} <Text style={s.groupEm}>{look.label} — {look.blurb}</Text></Text>
      <View style={s.grid}>{tiles}</View>
    </View>
  );

  return (
    <View style={[s.panel, vip && s.panelVip]}>
      <View style={s.head}>
        <View style={s.title}>
          <Text style={s.titleText}>Góc vườn của bạn</Text>
          <View style={[s.badge, vip && s.badgeVip]}>
            {vip && <Image source={vipMark} style={{ width: 14, height: 14 }} contentFit="contain" />}
            <Text style={[s.badgeText, vip && { color: '#7A5410' }]}>{vip ? 'VIP Garden' : 'Tài khoản Thường'}</Text>
          </View>
          {saved && <Text style={s.saved}>Đã lưu</Text>}
        </View>
        <Text style={s.sub}>{vip ? 'Đổi ngay trên mô hình, lưu cho mọi cây của bạn.' : 'Bấm một lựa chọn VIP để xem thử trên cây của bạn.'}</Text>
      </View>

      {trying && (
        <View style={s.trying} accessibilityLiveRegion="polite">
          <Text style={s.tryingText}>
            <Text style={{ fontFamily: fonts.bold }}>Đang xem thử</Text> {sceneLook(shownScene).label} · {potLook(shownPot).label}. Chỉ hiện trên màn hình này — nâng cấp VIP để giữ lại cho khu vườn.
          </Text>
          <View style={s.tryingActions}>
            <Pressable onPress={() => { tap(); router.push('/vip'); }} style={s.cta} accessibilityRole="button"><Text style={s.ctaText}>Nâng cấp VIP</Text></Pressable>
            <Pressable onPress={() => { tap(); setPreview({}); }} style={s.ghost} accessibilityRole="button"><Text style={s.ghostText}>Thôi xem thử</Text></Pressable>
          </View>
        </View>
      )}

      <View style={[s.body, sideBySide && { flexDirection: 'row', columnGap: 24 }]}>
        {group('Khung cảnh', sceneLook(shownScene), SCENES.map((look) => (
          <Tile key={look.key} label={look.label} blurb={look.blurb} vip={look.vip} locked={look.vip && !vip} compact={compact} width={tileW}
            selected={!preview.scene && value?.scene === look.key} previewing={preview.scene === look.key}
            disabled={!value || busy} onPick={() => pick({ scene: look.key }, look.vip)}>
            <ScenePreview look={look} />
          </Tile>
        )))}
        {group('Chậu trang trí', potLook(shownPot), POTS.map((look) => (
          <Tile key={look.key} label={look.label} blurb={look.blurb} vip={look.vip} locked={look.vip && !vip} compact={compact} width={tileW}
            selected={!preview.decoration && value?.decoration === look.key} previewing={preview.decoration === look.key}
            disabled={!value || busy} onPick={() => pick({ decoration: look.key }, look.vip)}>
            <PotPreview look={look} />
          </Tile>
        )))}
      </View>

      {value && (
        <View style={s.usage}>
          <Text style={s.usageStrong}>
            Plant Buddy · {value.aiLimit === null ? 'Không giới hạn lượt hỏi AI' : `${Math.max(0, value.aiLimit - value.aiUsed)}/${value.aiLimit} lượt AI hôm nay`}
          </Text>
          <Text style={s.usageText}>{value.aiLimit === null ? 'Áp dụng trong thời gian VIP còn hiệu lực' : 'Làm mới lúc 00:00 giờ Việt Nam · VIP được hỏi không giới hạn'}</Text>
        </View>
      )}
      {!vip && value && !trying && (
        <Pressable onPress={() => { tap(); router.push('/vip'); }} accessibilityRole="link" style={s.more}>
          <Text style={s.moreText}>Mở khoá 3 khung cảnh và 3 mẫu chậu với VIP Garden →</Text>
        </Pressable>
      )}
      {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  panel: { gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#DCE5D6', backgroundColor: '#FFFDF7' },
  panelVip: { backgroundColor: '#FFF9E8', borderColor: '#F0D68A', boxShadow: '0px 8px 28px rgba(214, 160, 40, 0.12)' },
  head: { gap: 4 },
  title: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 8 },
  titleText: { fontFamily: fonts.bold, fontSize: 16, color: '#294730' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#D6E3CC', backgroundColor: '#EEF4E8' },
  badgeVip: { backgroundColor: '#FFF2C9', borderColor: '#ECC965' },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, color: '#4D6A4F' },
  saved: { fontFamily: fonts.bold, fontSize: 12, color: '#2E8447' },
  sub: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 19, color: '#617160' },

  trying: { gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#F1CF86', backgroundColor: '#FFF4DC' },
  tryingText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19.5, color: '#6E4B0D' },
  tryingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cta: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#B45309' },
  ctaText: { fontFamily: fonts.bold, fontSize: 13, color: '#fff' },
  ghost: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: '#E3C68A', backgroundColor: '#fff' },
  ghostText: { fontFamily: fonts.semi, fontSize: 13, color: '#6E4B0D' },

  body: { rowGap: 12 },
  groupLabel: { fontFamily: fonts.bold, fontSize: 13, color: '#36533C' },
  groupEm: { fontFamily: fonts.medium, color: '#7A8878' },
  grid: { flexDirection: 'row', gap: 6 },
  tile: { gap: 4, paddingTop: 5, paddingHorizontal: 5, paddingBottom: 7, borderRadius: 12, borderWidth: 1.5, borderColor: '#DFE7DA', backgroundColor: '#fff' },
  tileOn: { borderColor: '#2E8447', boxShadow: '0px 0px 0px 2px rgba(46, 132, 71, 0.18)' },
  tileVipOn: { borderColor: '#D9A520', boxShadow: '0px 0px 0px 2px rgba(217, 165, 32, 0.25)' },
  tilePreview: { borderColor: '#E7A02D', borderStyle: 'dashed', boxShadow: '0px 0px 0px 2px rgba(231, 160, 45, 0.2)' },
  tileArt: { overflow: 'hidden', borderRadius: 8, aspectRatio: 16 / 10, backgroundColor: '#F3F0E6' },
  tag: {
    position: 'absolute', top: 4, right: 4, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: 20, backgroundColor: '#FFF6D6', boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.15)',
  },
  tagLocked: { backgroundColor: 'rgba(32, 36, 48, 0.78)' },
  tagCompact: { top: 3, right: 3, padding: 3 },
  tagText: { fontFamily: fonts.bold, fontSize: 10, color: '#7A5410' },
  check: { position: 'absolute', left: 4, bottom: 4, paddingHorizontal: 7, paddingVertical: 1, borderRadius: 20, backgroundColor: '#2E8447' },
  checkText: { fontFamily: fonts.bold, fontSize: 10.5, color: '#fff' },
  tileLabel: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 15.6, color: '#294730', paddingHorizontal: 2 },

  usage: { gap: 2, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E4E9DC' },
  usageStrong: { fontFamily: fonts.semi, fontSize: 12, color: '#36533C' },
  usageText: { fontFamily: fonts.body, fontSize: 12, color: '#617160' },
  more: { minHeight: 40, justifyContent: 'center' },
  moreText: { fontFamily: fonts.semi, fontSize: 13, color: '#377448' },
  error: { fontFamily: fonts.body, fontSize: 13, color: '#A83C32' },
});
