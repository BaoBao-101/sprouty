import { useEffect, useState } from 'react';
import { Linking, StyleSheet, Switch, View } from 'react-native';
import { useToast } from '@/components/Toast';
import { Card, CardTitle, Chip, Empty, Screen, T } from '@/components/ui';
import { API } from '@/lib/api';
import { readReminders, remindersAvailable, setCareReminder, setWorkshopReminders, syncWorkshopReminders, type ReminderSettings } from '@/lib/reminders';
import type { PlantCard } from '@/lib/types';
import { colors } from '@/theme';

const TIMES = ['17:00', '18:00', '18:30', '19:00', '19:30', '20:00'];

/**
 * Lời nhắc. Scheduled on the phone (lib/reminders.ts): an evening nudge to
 * look after the plant, and a reminder before each workshop booked.
 */
export default function Settings() {
  const toast = useToast();
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [plantName, setPlantName] = useState<string | undefined>();

  useEffect(() => {
    readReminders().then(setSettings);
    // One plant growing: the reminder can call it by name.
    API.plants.list().then((d: { plants: PlantCard[] }) => {
      const growing = (d.plants || []).filter((p) => !p.harvestedAt && !p.diedAt);
      if (growing.length === 1) setPlantName(growing[0].nickname);
    }).catch(() => {});
  }, []);

  async function denied() {
    toast('Điện thoại đang chặn thông báo của Sprouty. Mở Cài đặt để cho phép nhé.', 'error');
    setTimeout(() => Linking.openSettings().catch(() => {}), 1200);
  }

  async function care(on: boolean, careAt = settings?.careAt || '18:30') {
    setBusy(true);
    try {
      const ok = await setCareReminder(on, careAt, plantName);
      if (on && !ok) { await denied(); return; }
      setSettings(await readReminders());
      if (on) toast(`Sprouty sẽ nhắc bé chăm cây lúc ${careAt} mỗi ngày.`, 'success');
    } finally {
      setBusy(false);
    }
  }

  async function workshops(on: boolean) {
    setBusy(true);
    try {
      const next = await setWorkshopReminders(on);
      setSettings(next);
      if (on) {
        const { registrations } = await API.workshops.mine();
        await syncWorkshopReminders(registrations || []);
      }
    } catch {
      // Bookings could not be loaded; they are scheduled the next time the tickets open.
    } finally {
      setBusy(false);
    }
  }

  if (!remindersAvailable()) {
    return (
      <Screen title="Lời nhắc" back="/me">
        <Empty icon="bell" title="Chưa dùng được lời nhắc" text="Bản Expo Go này chưa hỗ trợ thông báo. Cài app Sprouty bản chính thức để nhận lời nhắc." />
      </Screen>
    );
  }

  return (
    <Screen title="Lời nhắc" back="/me">
      <Card>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <CardTitle icon="water">Nhắc chăm cây mỗi ngày</CardTitle>
            <T muted style={{ fontSize: 13 }}>Một lời nhắc nhẹ mỗi tối để bé ghé xem cây có khát nước không.</T>
          </View>
          <Switch value={Boolean(settings?.care)} disabled={busy || !settings} onValueChange={(v) => care(v)}
            trackColor={{ true: colors.green, false: colors.ink5 }} thumbColor={colors.white} accessibilityLabel="Nhắc chăm cây mỗi ngày" />
        </View>
        {settings?.care && (
          <View style={{ gap: 8 }}>
            <T bold>Giờ nhắc</T>
            <View style={s.wrap}>
              {TIMES.map((t) => <Chip key={t} label={t} on={settings.careAt === t} onPress={() => care(true, t)} />)}
            </View>
          </View>
        )}
      </Card>

      <Card>
        <View style={s.row}>
          <View style={{ flex: 1 }}>
            <CardTitle icon="ticket">Nhắc lịch workshop</CardTitle>
            <T muted style={{ fontSize: 13 }}>19:00 tối hôm trước và 2 tiếng trước mỗi buổi bé đã đăng ký.</T>
          </View>
          <Switch value={Boolean(settings?.workshops)} disabled={busy || !settings} onValueChange={workshops}
            trackColor={{ true: colors.green, false: colors.ink5 }} thumbColor={colors.white} accessibilityLabel="Nhắc lịch workshop" />
        </View>
      </Card>
      <T muted style={{ fontSize: 13 }}>Lời nhắc nằm ngay trên điện thoại này, không cần mạng và không gửi đi đâu.</T>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
