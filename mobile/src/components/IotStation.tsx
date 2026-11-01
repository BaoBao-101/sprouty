import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Line, Polyline } from 'react-native-svg';
import type { PlantDevice, SensorReading } from '@/lib/types';
import { colors, fonts, radius } from '@/theme';
import { Icon } from './Icon';
import { useToast } from './Toast';
import { Button, Sheet, T, tap } from './ui';

/*
 * Devices attach to the pot in one tap. Sensors reveal readings; actuators
 * have a separate automatic-mode control. Attachment is kept per plant on
 * this phone, while automatic mode is stored on the server.
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

/** "Cảm biến độ ẩm đất" → "Độ ẩm đất": the tile already says it is a sensor. */
const shortName = (label: string) => {
  const t = label.replace(/^Cảm biến /i, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/**
 * Attach, read and control devices as a grid of tiles: a sensor shows its
 * number big and what it means under it; a device that cares for the plant
 * has its on/off switch on the tile. A tap on a tile tells what it does.
 */
export function IotWorkbench({ board, devices, busy, onToggle, plantName, width, preview, summaries = {} }: {
  board: IotBoard; devices: PlantDevice[]; busy: boolean; onToggle: (type: string, next: boolean) => Promise<void>;
  plantName: string; width: number; preview?: ReactNode; summaries?: Record<string, string>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showLocked, setShowLocked] = useState(false);
  const [showPlant, setShowPlant] = useState(false);
  const available = devices.filter(usable);
  const locked = devices.filter((d) => !usable(d));
  const remaining = available.filter((d) => !board.isWired(d.type)).length;
  const sel = devices.find((d) => d.type === selected);
  const selWired = Boolean(sel && board.isWired(sel.type));
  // One device a line on a phone; two side by side on a tablet.
  const rowW = width >= 560 ? Math.floor((width - 8) / 2) : width;
  const onCount = available.filter((d) => board.isWired(d.type)).length;

  return (
    <View style={{ gap: 14 }}>
      <View style={s.bar}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={s.title}>Thiết bị trên cây</Text>
          <View style={s.progress}>
            <View style={s.track}><View style={[s.fill, { width: `${available.length ? (onCount / available.length) * 100 : 0}%` }]} /></View>
            <Text style={s.count}>{onCount}/{available.length}</Text>
          </View>
        </View>
        <Button small variant="soft" icon="add" title="Gắn hết" disabled={remaining === 0 || busy} onPress={board.wireAll} />
      </View>

      {(['sensor', 'actuator'] as const).map((kind) => {
        const group = available.filter((d) => d.kind === kind);
        if (!group.length) return null;
        return (
          <View key={kind} style={{ gap: 8 }}>
            <Text style={s.groupTitle}>{kind === 'sensor' ? 'Cảm biến' : 'Chăm tự động'}</Text>
            <View style={s.grid}>
              {group.map((d) => {
                const attached = board.isWired(d.type);
                const value = reading(d);
                const low = attached && d.battery < 20;
                return (
                  <Pressable key={d.type} onPress={() => { tap(); setSelected(d.type); }} accessibilityRole="button"
                    accessibilityLabel={`${d.label}. ${attached ? (kind === 'sensor' ? `${value ?? 'đang đọc'} ${summaries[d.type] ?? ''}` : d.autoMode ? 'đang bật' : 'đang tắt') : 'chưa gắn'}`}
                    style={({ pressed }) => [s.row, { width: rowW }, attached && s.rowOn, pressed && { opacity: 0.85 }]}>
                    <View style={[s.icon, attached && { backgroundColor: kind === 'sensor' ? colors.infoSoft : colors.mint }]}>
                      <Icon name={d.icon} size={17} color={attached ? (kind === 'sensor' ? colors.info : colors.greenDark) : colors.ink4} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={[s.name, !attached && { color: colors.ink3 }]}>{shortName(d.label)}</Text>
                      <Text numberOfLines={1} style={[s.sub, low && { color: colors.warn }]}>
                        {!attached ? 'Chưa gắn' : low ? `Pin yếu · ${Math.round(d.battery)}%` : kind === 'sensor' ? (summaries[d.type] || 'Đang đo') : 'Tự động'}
                      </Text>
                    </View>
                    {!attached ? (
                      <Pressable disabled={busy} onPress={() => { tap(); board.wire(d.type); }} accessibilityRole="button" accessibilityLabel={`Gắn ${d.label} lên cây`}
                        hitSlop={6} style={[s.wire, busy && { opacity: 0.5 }]}>
                        <Icon name="add" size={18} color={colors.greenDark} />
                      </Pressable>
                    ) : kind === 'sensor' ? (
                      <Text style={s.value}>{value ?? '…'}</Text>
                    ) : (
                      <Pressable disabled={busy} onPress={() => { tap(); void onToggle(d.type, !d.autoMode); }} accessibilityRole="switch"
                        accessibilityLabel={`Tự động ${d.label}`} accessibilityState={{ checked: d.autoMode, disabled: busy }}
                        hitSlop={6} style={[s.switch, d.autoMode && s.switchOn, busy && { opacity: 0.5 }]}>
                        <View style={s.knob} />
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      {locked.length > 0 && (
        <View style={s.lockedBox}>
          <Pressable style={s.lockedHead} onPress={() => { tap(); setShowLocked((v) => !v); }} accessibilityRole="button" accessibilityState={{ expanded: showLocked }}>
            <Icon name="lock" size={16} color={colors.ink3} />
            <Text style={[s.groupTitle, { flex: 1 }]}>{locked.length} thiết bị chưa mở</Text>
            <View style={showLocked ? { transform: [{ rotate: '180deg' }] } : undefined}><Icon name="arrow-down" size={15} color={colors.ink3} /></View>
          </Pressable>
          {showLocked && locked.map((d) => (
            <View key={d.type} style={s.lockedRow}>
              <Icon name={d.icon} size={17} color={colors.ink4} />
              <Text numberOfLines={1} style={[s.name, { flex: 1, color: colors.ink2 }]}>{shortName(d.label)}</Text>
              {!d.unlocked
                ? <Text style={s.unlockAt}>Chặng {d.unlockStageLabel}</Text>
                : <Pressable style={s.vip} accessibilityRole="button" onPress={() => router.push('/vip')}><Icon name="star" size={12} color={colors.gold} /><Text style={s.vipText}>VIP</Text></Pressable>}
            </View>
          ))}
        </View>
      )}

      {preview && (
        <View style={s.preview}>
          <Pressable onPress={() => { tap(); setShowPlant((v) => !v); }} accessibilityRole="button" accessibilityState={{ expanded: showPlant }} style={s.previewHead}>
            <Icon name="pot" size={17} color={colors.greenDark} />
            <Text style={[s.groupTitle, { flex: 1, color: colors.greenDark }]}>{showPlant ? plantName : 'Xem thiết bị trên cây 3D'}</Text>
            <View style={showPlant ? { transform: [{ rotate: '180deg' }] } : undefined}><Icon name="arrow-down" size={15} color={colors.greenDark} /></View>
          </Pressable>
          {showPlant && <View style={{ paddingBottom: 10 }}>{preview}</View>}
        </View>
      )}

      <Sheet open={Boolean(sel)} title={sel ? shortName(sel.label) : ''} onClose={() => setSelected(null)}
        footer={sel ? (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {selWired ? (
              <Button variant="ghost" title="Gỡ khỏi cây" disabled={busy} onPress={() => { const t = sel.type; setSelected(null); void board.unwire(t); }} />
            ) : (
              <Button grow title="Gắn lên cây" icon="add" disabled={busy} onPress={() => { board.wire(sel.type); setSelected(null); }} />
            )}
            {sel.kind === 'actuator' && selWired && (
              <Button grow busy={busy} variant={sel.autoMode ? 'soft' : 'primary'} title={sel.autoMode ? 'Tắt tự động' : 'Bật tự động'}
                onPress={() => void onToggle(sel.type, !sel.autoMode)} />
            )}
          </View>
        ) : undefined}>
        {sel && (
          <>
            <View style={s.stats}>
              <View style={s.stat}>
                <Text style={s.statLabel}>{sel.kind === 'sensor' ? 'Chỉ số' : 'Chế độ'}</Text>
                <Text style={s.statValue}>
                  {sel.kind === 'sensor'
                    ? (selWired ? `${reading(sel) ?? '…'}${sel.secondary ? ` · ${sel.secondary.label} ${Math.round(sel.secondary.value)}${sel.secondary.unit}` : ''}` : 'Chưa gắn')
                    : (selWired ? (sel.autoMode ? 'Đang bật' : 'Đang tắt') : 'Chưa gắn')}
                </Text>
                {sel.kind === 'sensor' && selWired && summaries[sel.type] ? <Text style={s.verdict}>{summaries[sel.type]}</Text> : null}
              </View>
              <View style={s.stat}>
                <Text style={s.statLabel}>Pin</Text>
                <Text style={[s.statValue, sel.battery < 20 && { color: colors.warn }]}>{Math.round(sel.battery)}%</Text>
              </View>
            </View>
            <T>{sel.about}</T>
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
  if (readings.length < 2) return <Text style={s.chartEmpty}>Biểu đồ hiện khi cảm biến ghi đủ dữ liệu.</Text>;
  if (!series.length) return <Text style={s.chartEmpty}>Gắn cảm biến để xem biểu đồ.</Text>;
  const H = 130;
  const P = 6;
  const step = (width - P * 2) / (readings.length - 1);
  const y = (pct: number) => H - P - (Math.min(100, Math.max(0, pct)) / 100) * (H - P * 2);
  return (
    <View style={{ gap: 8 }}>
      <Svg width={width} height={H}>
        {[25, 50, 75].map((g) => <Line key={g} x1={P} x2={width - P} y1={y(g)} y2={y(g)} stroke={colors.sand} strokeWidth={1} />)}
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
  bar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.ink },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.sand, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.green },
  count: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.greenDark },
  groupTitle: { fontFamily: fonts.bold, fontSize: 12.5, letterSpacing: 0.3, color: colors.ink3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingLeft: 10, paddingRight: 8, paddingVertical: 8, borderRadius: radius.md, backgroundColor: colors.canvas },
  rowOn: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.mint },
  icon: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink },
  sub: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink4 },
  verdict: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.greenDark },
  value: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, color: colors.ink, paddingRight: 4 },
  wire: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  // A small switch: the knob sits left when off, right when on.
  switch: { width: 50, height: 30, borderRadius: 15, padding: 3, backgroundColor: colors.ink5, alignItems: 'flex-start', justifyContent: 'center' },
  switchOn: { backgroundColor: colors.green, alignItems: 'flex-end' },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white },
  lockedBox: { borderRadius: radius.md, backgroundColor: colors.canvas, paddingHorizontal: 12 },
  lockedHead: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 42, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  unlockAt: { fontFamily: fonts.semi, fontSize: 12, color: colors.ink3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.sand, overflow: 'hidden' },
  vip: { flexDirection: 'row', alignItems: 'center', gap: 3, minHeight: 32, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: colors.goldSoft },
  vipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.gold },
  preview: { borderRadius: radius.md, backgroundColor: colors.mint, overflow: 'hidden' },
  previewHead: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 12, borderRadius: radius.md, backgroundColor: colors.card, gap: 2 },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink4 },
  statValue: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  chipSub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.ink3 },
  chartEmpty: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.ink3 },
  legend: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});
