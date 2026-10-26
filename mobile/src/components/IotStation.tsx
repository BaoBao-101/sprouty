import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Line, Path, Polyline } from 'react-native-svg';
import type { PlantDevice, SensorReading } from '@/lib/types';
import { colors, fonts, radius } from '@/theme';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { Button, Sheet, T, tap } from './ui';

/*
 * "Bàn lắp mạch" — the kit's devices as parts on a board, as on the website
 * (frontend/src/components/IotWorkbench.tsx). A part works only once it is
 * wired to the Sprouty Hub: a sensor shows its reading, an actuator can be
 * switched on. Taking an actuator off the board switches it off. What is
 * wired is the family's own arrangement, kept per plant on this phone; what
 * a part does (auto mode) is the server's.
 */

const key = (plantId: string) => `sprouty.iot.${plantId}`;
const usable = (d?: PlantDevice) => Boolean(d?.unlocked && !d.vipLocked);
const reading = (d: PlantDevice) => (d.reading === null ? null : `${Math.round(d.reading)}${d.unit}`);

export interface IotBoard {
  /** Wired parts, in the order they went on the board (it decides their place). */
  wired: string[];
  isWired: (type: string) => boolean;
  wire: (type: string) => void;
  unwire: (type: string) => Promise<void>;
  wireAll: () => void;
  clearAll: () => Promise<void>;
}

/** The board's state for one plant, remembered on the phone. */
export function useIotBoard(plantId: string, devices: PlantDevice[], onToggle: (type: string, next: boolean) => Promise<void>): IotBoard {
  const toast = useToast();
  const [order, setOrder] = useState<string[] | null>(null);

  const hasDevices = devices.length > 0;
  useEffect(() => {
    if (!hasDevices) return;
    let live = true;
    AsyncStorage.getItem(key(plantId)).then((raw) => {
      if (!live) return;
      // First visit: whatever is already running is already on the board.
      setOrder(raw ? JSON.parse(raw) : devices.filter((d) => usable(d) && d.kind === 'actuator' && d.autoMode).map((d) => d.type));
    }).catch(() => live && setOrder([]));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantId, hasDevices]);

  const byType = useMemo(() => new Map(devices.map((d) => [d.type, d])), [devices]);
  // A part no longer usable (locked again, VIP ended) leaves the board.
  const wired = (order || []).filter((t) => usable(byType.get(t)));

  const save = useCallback((next: string[]) => {
    setOrder(next);
    void AsyncStorage.setItem(key(plantId), JSON.stringify(next)).catch(() => {});
  }, [plantId]);

  function wire(type: string) {
    const d = byType.get(type);
    if (!usable(d) || wired.includes(type)) return;
    save([...wired, type]);
    toast(d!.kind === 'sensor' ? `Đã cắm ${d!.label} vào chậu — chỉ số đã hiện.` : `Đã lắp ${d!.label}. Bấm vào để bật.`, 'success');
  }

  async function unwire(type: string) {
    save(wired.filter((t) => t !== type));
    const d = byType.get(type);
    // A part off the board has no power: it cannot keep running.
    if (d?.kind === 'actuator' && d.autoMode) await onToggle(type, false);
  }

  function wireAll() {
    save([...wired, ...devices.filter((d) => usable(d) && !wired.includes(d.type)).map((d) => d.type)]);
  }

  async function clearAll() {
    const running = wired.map((t) => byType.get(t)).filter((d) => d?.kind === 'actuator' && d.autoMode);
    save([]);
    for (const d of running) if (d) await onToggle(d.type, false);
  }

  return { wired, isWired: (t) => wired.includes(t), wire, unwire, wireAll, clearAll };
}

/** Places around the hub, as fractions of the board; the order parts take them in. */
const SLOTS = [
  { x: 0.13, y: 0.2 }, { x: 0.37, y: 0.15 }, { x: 0.63, y: 0.15 }, { x: 0.87, y: 0.2 },
  { x: 0.13, y: 0.8 }, { x: 0.37, y: 0.85 }, { x: 0.63, y: 0.85 }, { x: 0.87, y: 0.8 },
  { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 },
];
const HUB = { x: 0.5, y: 0.5 };
const PART_W = 80;
const PART_H = 70;

/** The board: the hub in the middle, the wired parts around it, a wire to each. */
export function IotWorkbench({ board, devices, busy, onToggle, plantName, width }: {
  board: IotBoard; devices: PlantDevice[]; busy: boolean; onToggle: (type: string, next: boolean) => Promise<void>;
  plantName: string; width: number;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const byType = new Map(devices.map((d) => [d.type, d]));
  const W = width;
  const H = Math.round(Math.max(240, W * 0.68));
  const placed = board.wired.slice(0, SLOTS.length).map((type, i) => ({ type, d: byType.get(type)!, at: SLOTS[i] }));
  const tray = devices.filter((d) => usable(d) && !board.isWired(d.type));
  const vipParts = devices.filter((d) => d.unlocked && d.vipLocked);
  const lockedCount = devices.filter((d) => !d.unlocked).length;
  const usableCount = devices.filter(usable).length;
  const sel = selected ? byType.get(selected) : null;
  const selWired = selected ? board.isWired(selected) : false;

  return (
    <View style={{ gap: 10 }}>
      <View style={s.bar}>
        <Text style={s.count}><Text style={s.countN}>{board.wired.length}</Text>/{usableCount} linh kiện đã nối</Text>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Button small variant="soft" icon="bolt" title="Lắp tự động" disabled={board.wired.length >= usableCount} onPress={board.wireAll} />
          <Button small variant="ghost" title="Gỡ hết" disabled={!board.wired.length || busy} onPress={() => void board.clearAll()} />
        </View>
      </View>

      {(tray.length > 0 || vipParts.length > 0 || lockedCount > 0) && (
        <View style={s.tray}>
          {tray.map((d) => (
            <Pressable key={d.type} onPress={() => { tap(); board.wire(d.type); }} accessibilityRole="button" accessibilityLabel={`Lắp ${d.label}`}
              style={({ pressed }) => [s.chip, pressed && { backgroundColor: colors.greenSoft }]}>
              <View style={[s.chipIcon, d.kind === 'sensor' ? s.isSensor : s.isActuator]}><Icon name={d.icon} size={16} color={d.kind === 'sensor' ? colors.info : colors.greenDark} /></View>
              <View>
                <Text style={s.chipLabel}>{d.label}</Text>
                <Text style={s.chipSub}>{d.kind === 'sensor' ? 'Cảm biến' : 'Thiết bị'} · chạm để lắp</Text>
              </View>
            </Pressable>
          ))}
          {vipParts.map((d) => (
            <Pressable key={d.type} onPress={() => router.push('/vip')} accessibilityRole="button" style={[s.chip, s.vipChip]}>
              <View style={[s.chipIcon, { backgroundColor: '#FCE9C4' }]}><Icon name={d.icon} size={16} color={colors.warn} /></View>
              <View>
                <Text style={s.chipLabel}>{d.label}</Text>
                <Text style={[s.chipSub, { color: colors.warn }]}>Mở khoá với VIP</Text>
              </View>
            </Pressable>
          ))}
          {lockedCount > 0 && (
            <View style={s.lockedNote}><Icon name="lock" size={13} color={colors.ink4} /><Text style={s.chipSub}>+{lockedCount} linh kiện mở khi cây lớn hơn</Text></View>
          )}
        </View>
      )}

      <View style={[s.board, { width: W, height: H }]}>
        <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
          {placed.map(({ type, d, at }) => {
            const x1 = at.x * W, y1 = at.y * H, x2 = HUB.x * W, y2 = HUB.y * H;
            const mx = (x1 + x2) / 2;
            const live = d.kind === 'sensor' || d.autoMode;
            return (
              <Path key={type} d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`} fill="none"
                stroke={d.kind === 'sensor' ? '#5BA3D9' : live ? colors.green : colors.ink5}
                strokeWidth={2.5} strokeDasharray={live ? undefined : '6 5'} strokeLinecap="round" />
            );
          })}
        </Svg>

        <View style={[s.hub, { left: HUB.x * W - 62, top: HUB.y * H - 34 }]}>
          <View style={[s.led, board.wired.length > 0 && { backgroundColor: colors.greenLight }]} />
          <Text style={s.hubTitle}>SPROUTY HUB</Text>
          <Text numberOfLines={1} style={s.hubSub}>{board.wired.length} kết nối · {plantName}</Text>
        </View>

        {placed.length === 0 && (
          <View style={s.hint}><Icon name="arrow-down" size={14} color={colors.ink4} /><Text style={s.hintText}>Chạm linh kiện ở khay để nối vào Hub</Text></View>
        )}

        {placed.map(({ type, d, at }) => {
          const on = d.kind === 'actuator' && d.autoMode;
          return (
            <Pressable key={type} onPress={() => { tap(); setSelected(type); }} accessibilityRole="button"
              accessibilityLabel={`${d.label}${reading(d) ? `: ${reading(d)}` : ''}`}
              style={[s.part, { left: at.x * W - PART_W / 2, top: at.y * H - PART_H / 2 }, d.kind === 'sensor' ? { borderColor: '#A9CDEB' } : on ? { borderColor: colors.green } : null, d.battery < 20 && { borderColor: colors.warn }]}>
              <Icon name={d.icon} size={18} color={d.kind === 'sensor' ? colors.info : on ? colors.greenDark : colors.ink3} />
              <Text numberOfLines={1} style={s.partLabel}>{d.label}</Text>
              {d.kind === 'sensor'
                ? <Text style={s.partValue}>{reading(d) ?? 'Đang đọc'}</Text>
                : <View style={[s.power, on && s.powerOn]}><Text style={[s.powerText, on && { color: colors.white }]}>{on ? 'BẬT' : 'TẮT'}</Text></View>}
            </Pressable>
          );
        })}
      </View>

      <Sheet open={Boolean(sel)} title={sel?.label ?? ''} onClose={() => setSelected(null)}
        footer={sel ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {selWired ? (
              <Button variant="ghost" title="Gỡ khỏi bảng" disabled={busy} onPress={() => { const t = sel.type; setSelected(null); void board.unwire(t); }} />
            ) : (
              <Button title="Lắp vào bảng" onPress={() => board.wire(sel.type)} />
            )}
            {sel.kind === 'actuator' && selWired && (
              <Button grow busy={busy} variant={sel.autoMode ? 'soft' : 'primary'} title={sel.autoMode ? 'Tắt tự động' : 'Bật tự động'}
                onPress={() => void onToggle(sel.type, !sel.autoMode)} />
            )}
          </View>
        ) : undefined}>
        {sel && (
          <>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <View style={[s.tag, sel.kind === 'sensor' ? s.isSensor : s.isActuator]}><Text style={[s.tagText, { color: sel.kind === 'sensor' ? colors.info : colors.greenDark }]}>{sel.kind === 'sensor' ? 'Cảm biến' : 'Thiết bị'}</Text></View>
              {selWired && <View style={[s.tag, { backgroundColor: colors.greenSoft }]}><Text style={[s.tagText, { color: colors.greenDark }]}>Đã nối Hub</Text></View>}
              {sel.kind === 'actuator' && <View style={[s.tag, { backgroundColor: sel.autoMode ? colors.greenSoft : '#EEF1EA' }]}><Text style={[s.tagText, { color: sel.autoMode ? colors.greenDark : colors.ink3 }]}>{sel.autoMode ? 'Đang bật' : 'Đang tắt'}</Text></View>}
            </View>
            <T>{sel.about}</T>
            <View style={s.stats}>
              {reading(sel) && (
                <View style={s.stat}>
                  <Text style={s.statLabel}>Chỉ số</Text>
                  <Text style={s.statValue}>{reading(sel)}{sel.secondary ? ` · ${sel.secondary.label} ${Math.round(sel.secondary.value)}${sel.secondary.unit}` : ''}</Text>
                </View>
              )}
              <View style={s.stat}>
                <Text style={s.statLabel}>Pin</Text>
                <Text style={[s.statValue, sel.battery < 20 && { color: colors.warn }]}>{Math.round(sel.battery)}%</Text>
              </View>
            </View>
          </>
        )}
      </Sheet>
    </View>
  );
}

/** The last day of readings, one line per wired sensor; temperature 10–40°C is drawn on the same 0–100 scale. */
export function SensorChart({ readings, wired, width }: { readings: SensorReading[]; wired: string[]; width: number }) {
  const LINES = [
    { key: 'moisture' as const, sensor: 'moisture_sensor', label: 'Độ ẩm đất', color: '#5BA3D9', scale: (v: number) => v },
    { key: 'nutrient' as const, sensor: 'nutrient_sensor', label: 'Dinh dưỡng', color: colors.green, scale: (v: number) => v },
    { key: 'light' as const, sensor: 'light_sensor', label: 'Ánh sáng', color: '#D9A62E', scale: (v: number) => v },
    { key: 'temperature' as const, sensor: 'thermo_sensor', label: 'Nhiệt độ', color: '#D8735A', scale: (v: number) => ((v - 10) / 30) * 100 },
  ];
  const series = LINES.filter((l) => wired.includes(l.sensor));
  if (readings.length < 2) return <Text style={s.chartEmpty}>Biểu đồ sẽ hiện khi cảm biến ghi đủ dữ liệu — quay lại sau một lúc nhé.</Text>;
  if (!series.length) return <Text style={s.chartEmpty}>Nối cảm biến vào bảng mạch để vẽ biểu đồ của nó.</Text>;
  const H = 130;
  const P = 6;
  const step = (width - P * 2) / (readings.length - 1);
  const y = (pct: number) => H - P - (Math.min(100, Math.max(0, pct)) / 100) * (H - P * 2);
  return (
    <View style={{ gap: 8 }}>
      <Svg width={width} height={H}>
        {[25, 50, 75].map((g) => <Line key={g} x1={P} x2={width - P} y1={y(g)} y2={y(g)} stroke={colors.line} strokeWidth={1} />)}
        {series.map((l) => (
          <Polyline key={l.key} fill="none" stroke={l.color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round"
            points={readings.map((r, i) => `${P + i * step},${y(l.scale(r[l.key]))}`).join(' ')} />
        ))}
      </Svg>
      <View style={s.legend}>
        {series.map((l) => (
          <View key={l.key} style={s.legendItem}><View style={[s.legendDot, { backgroundColor: l.color }]} /><Text style={s.chipSub}>{l.label}</Text></View>
        ))}
        <Text style={[s.chipSub, { marginLeft: 'auto' }]}>24 giờ qua</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  count: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.ink3 },
  countN: { fontFamily: fonts.bold, color: colors.greenDark },
  tray: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, paddingLeft: 6, paddingRight: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  vipChip: { borderColor: '#F1DAB0', backgroundColor: '#FFF8EC' },
  chipIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  isSensor: { backgroundColor: colors.infoSoft },
  isActuator: { backgroundColor: colors.greenSoft },
  chipLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  chipSub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.ink4 },
  lockedNote: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 48 },
  board: { alignSelf: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: '#D6E4CF', backgroundColor: '#F3F8EE', overflow: 'hidden' },
  hub: { position: 'absolute', width: 124, height: 68, borderRadius: 16, backgroundColor: colors.greenDark, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 6 },
  led: { position: 'absolute', top: 7, right: 9, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ink4 },
  hubTitle: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1, color: colors.white },
  hubSub: { fontFamily: fonts.medium, fontSize: 10.5, color: '#CFE9C9' },
  hint: { position: 'absolute', left: 0, right: 0, bottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  hintText: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink4 },
  part: { position: 'absolute', width: PART_W, height: PART_H, borderRadius: 12, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 4 },
  partLabel: { fontFamily: fonts.semi, fontSize: 10.5, color: colors.ink2, maxWidth: PART_W - 8 },
  partValue: { fontFamily: fonts.bold, fontSize: 12, color: colors.info },
  power: { paddingHorizontal: 8, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: '#EEF1EA' },
  powerOn: { backgroundColor: colors.green },
  powerText: { fontFamily: fonts.bold, fontSize: 10, color: colors.ink3 },
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
  tagText: { fontFamily: fonts.bold, fontSize: 11.5 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: colors.cream2, borderWidth: 1, borderColor: colors.line, gap: 2 },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink4 },
  statValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  chartEmpty: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink3 },
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
