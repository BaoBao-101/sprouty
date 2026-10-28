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

/** Attach, read and control devices in one compact list. */
export function IotWorkbench({ board, devices, busy, onToggle, plantName, width, preview, summaries = {} }: {
  board: IotBoard; devices: PlantDevice[]; busy: boolean; onToggle: (type: string, next: boolean) => Promise<void>;
  plantName: string; width: number; preview?: ReactNode; summaries?: Record<string, string>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showLocked, setShowLocked] = useState(false);
  const [showPlant, setShowPlant] = useState(true);
  const available = devices.filter(usable);
  const locked = devices.filter((d) => !usable(d));
  const remaining = available.filter((d) => !board.isWired(d.type)).length;
  const sel = devices.find((d) => d.type === selected);
  const selWired = Boolean(sel && board.isWired(sel.type));
  const rowWidth = width >= 600 ? (width - 8) / 2 : width;

  return (
    <View style={{ gap: 12 }}>
      <View style={s.bar}>
        <View style={{ flex: 1, minWidth: 120 }}>
          <Text style={s.chipLabel}>Thiết bị trên cây</Text>
          <Text style={s.count}>{board.wired.length}/{available.length} đã gắn</Text>
        </View>
        <Button small variant="soft" icon="add" title="Gắn tất cả" disabled={remaining === 0 || busy} onPress={board.wireAll} />
      </View>
      <Text style={s.help}>Chạm Gắn để lắp vào chậu. Thiết bị tự động có nút bật riêng.</Text>
      {preview && <View style={s.preview}>
        <Pressable onPress={() => setShowPlant((v) => !v)} accessibilityRole="button"
          accessibilityState={{ expanded: showPlant }} style={s.previewHead}>
          <Icon name="pot" size={18} color={colors.greenDark} />
          <Text style={[s.chipLabel, { flex: 1 }]}>{plantName}</Text>
          <Text style={s.actionText}>{showPlant ? 'Thu gọn' : 'Xem cây 3D'}</Text>
          <Icon name={showPlant ? 'minus' : 'add'} size={16} color={colors.greenDark} />
        </Pressable>
        {showPlant && preview}
      </View>}
      {(['sensor', 'actuator'] as const).map((kind) => {
        const group = available.filter((d) => d.kind === kind);
        if (!group.length) return null;
        return <View key={kind} style={{ gap: 6 }}>
          <Text style={s.groupTitle}>{kind === 'sensor' ? 'Cảm biến · số đo trực tiếp' : 'Chăm cây tự động'}</Text>
          <View style={s.tray}>
            {group.map((d) => {
              const attached = board.isWired(d.type);
              const status = !attached ? 'Chưa gắn' : kind === 'sensor'
                ? (reading(d) ?? 'Đang đọc') + (summaries[d.type] ? ' · ' + summaries[d.type] : '')
                : d.autoMode ? 'Đã gắn · Tự động bật' : 'Đã gắn · Đang tắt';
              return <View key={d.type} style={[s.deviceRow, { width: rowWidth }, attached && s.attached]}>
                <Pressable style={s.deviceInfo} accessibilityRole="button" accessibilityLabel={d.label + '. ' + status + '. Xem chi tiết'}
                  onPress={() => { tap(); setSelected(d.type); }}>
                  <View style={[s.chipIcon, attached ? s.isActuator : { backgroundColor: colors.cream2 }]}>
                    <Icon name={d.icon} size={18} color={attached ? colors.greenDark : colors.ink3} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <Text style={s.chipLabel}>{d.label.replace(/^Cảm biến /, '')}</Text>
                    <Text style={[s.status, attached && { color: colors.greenDark }]}>{status}</Text>
                    {attached && d.battery < 20 && <Text style={s.lowBattery}>Pin yếu · {Math.round(d.battery)}%</Text>}
                  </View>
                </Pressable>
                {!attached ? <Pressable disabled={busy} onPress={() => { tap(); board.wire(d.type); }} accessibilityRole="button"
                  accessibilityLabel={'Gắn ' + d.label + ' lên cây'} accessibilityState={{ disabled: busy }} style={[s.action, busy && { opacity: 0.5 }]}>
                  <Icon name="add" size={16} color={colors.greenDark} /><Text style={s.actionText}>Gắn</Text>
                </Pressable> : kind === 'actuator' ? <Pressable disabled={busy} onPress={() => { tap(); void onToggle(d.type, !d.autoMode); }}
                  accessibilityRole="switch" accessibilityLabel={'Tự động ' + d.label} accessibilityState={{ checked: d.autoMode, disabled: busy }}
                  style={[s.action, d.autoMode && { backgroundColor: colors.green }, busy && { opacity: 0.5 }]}>
                  <Text style={[s.actionText, d.autoMode && { color: colors.white }]}>{d.autoMode ? 'Bật' : 'Tắt'}</Text>
                </Pressable> : <Pressable onPress={() => setSelected(d.type)} accessibilityRole="button" accessibilityLabel={'Chi tiết ' + d.label} style={s.details}>
                  <Icon name="check" size={18} color={colors.greenDark} /><Text style={s.status}>Đã gắn</Text>
                </Pressable>}
              </View>;
            })}
          </View>
        </View>;
      })}
      {locked.length > 0 && <View>
        <Pressable style={s.previewHead} onPress={() => setShowLocked((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showLocked }}>
          <Icon name="lock" size={16} color={colors.ink3} />
          <Text style={[s.help, { flex: 1 }]}>Chưa mở khóa ({locked.length})</Text>
          <Icon name={showLocked ? 'minus' : 'add'} size={16} color={colors.ink3} />
        </Pressable>
        {showLocked && locked.map((d) => <View key={d.type} style={s.lockedRow}>
          <Icon name={d.icon} size={18} color={colors.ink3} />
          <View style={{ flex: 1 }}><Text style={s.chipLabel}>{d.label}</Text><Text style={s.status}>
            {!d.unlocked ? 'Mở ở chặng ' + d.unlockStageLabel : 'Cần gói VIP'}
          </Text></View>
          {d.unlocked && d.vipLocked && <Pressable style={s.action} accessibilityRole="button" onPress={() => router.push('/vip')}><Text style={s.actionText}>Xem VIP</Text></Pressable>}
        </View>)}
      </View>}

      <Sheet open={Boolean(sel)} title={sel?.label ?? ''} onClose={() => setSelected(null)}
        footer={sel ? (
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {selWired ? (
              <Button variant="ghost" title="Gỡ khỏi cây" disabled={busy} onPress={() => { const t = sel.type; setSelected(null); void board.unwire(t); }} />
            ) : (
              <Button title="Gắn lên cây" disabled={busy} onPress={() => { board.wire(sel.type); setSelected(null); }} />
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
              {selWired && <View style={[s.tag, { backgroundColor: colors.greenSoft }]}><Text style={[s.tagText, { color: colors.greenDark }]}>Đã gắn lên cây</Text></View>}
              {sel.kind === 'actuator' && <View style={[s.tag, { backgroundColor: sel.autoMode ? colors.greenSoft : '#EEF1EA' }]}><Text style={[s.tagText, { color: sel.autoMode ? colors.greenDark : colors.ink3 }]}>{sel.autoMode ? 'Đang bật' : 'Đang tắt'}</Text></View>}
            </View>
            <T>{sel.about}</T>
            <View style={s.stats}>
              {selWired && reading(sel) && (
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
  if (!series.length) return <Text style={s.chartEmpty}>Gắn cảm biến để xem lịch sử số đo ở đây.</Text>;
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
  chipIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  isSensor: { backgroundColor: colors.infoSoft },
  isActuator: { backgroundColor: colors.greenSoft },
  chipLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
  chipSub: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.ink3 },
  help: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.ink3 },
  groupTitle: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink3, marginTop: 2 },
  preview: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, overflow: 'hidden', paddingBottom: 4 },
  previewHead: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, padding: 6, backgroundColor: colors.card },
  attached: { borderColor: '#C7DCC2', backgroundColor: '#F7FBF4' },
  deviceInfo: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  status: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 16, color: colors.ink3 },
  lowBattery: { fontFamily: fonts.medium, fontSize: 11, color: colors.warn },
  action: { minWidth: 58, minHeight: 44, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: radius.sm, backgroundColor: colors.greenSoft },
  actionText: { fontFamily: fonts.bold, fontSize: 12, color: colors.greenDark },
  details: { minWidth: 58, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.line },
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
