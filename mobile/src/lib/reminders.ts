import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type * as NotificationsModule from 'expo-notifications';
import type { MyWorkshopRegistration } from './types';

/**
 * Reminders, scheduled on the phone itself: "nhắc bé chăm cây mỗi tối" and
 * "đừng quên buổi workshop". The time the parent chose and the bookings the
 * app has loaded are all known here, so these need no push server and work
 * offline (and in Expo Go, which has no remote push on Android).
 */

export interface ReminderSettings {
  care: boolean;
  /** "18:30" */
  careAt: string;
  workshops: boolean;
}

const KEY = 'sprouty.reminders';
const DEFAULTS: ReminderSettings = { care: false, careAt: '18:30', workshops: true };

/*
 * Loaded defensively: an Expo Go older than this app's notifications module
 * lacks one of its native parts, and a failed import must cost the reminders,
 * not the whole app.
 */
let Notifications: typeof NotificationsModule;
let available = true;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications');
  // Show reminders while the app is open too.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
} catch {
  available = false;
}

/** Whether this build can schedule reminders at all. */
export const remindersAvailable = () => available;

/** Calls `open` with the screen a tapped reminder is about. */
export function onReminderTap(open: (url: string) => void) {
  if (!available) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string' && url.startsWith('/')) open(url);
  });
  return () => sub.remove();
}

export async function readReminders(): Promise<ReminderSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

async function saveReminders(settings: ReminderSettings) {
  await AsyncStorage.setItem(KEY, JSON.stringify(settings));
}

/** Android 13+ asks only once a channel exists, so the channels come first. */
async function ensureChannels() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('care', {
    name: 'Nhắc chăm cây',
    description: 'Lời nhắc hằng ngày để bé chăm cây',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('workshop', {
    name: 'Nhắc lịch workshop',
    description: 'Trước buổi workshop bé đã đăng ký',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function ensurePermission() {
  if (!available) return false;
  await ensureChannels();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

const isOurs = (request: NotificationsModule.NotificationRequest, kind: string) => request.content.data?.kind === kind;

async function cancelKind(kind: string) {
  if (!available) return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(all.filter((r) => isOurs(r, kind)).map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier)));
}

/** The evening reminder on (at `careAt`) or off. False when notifications are not allowed. */
export async function setCareReminder(on: boolean, careAt: string, plantName?: string) {
  await cancelKind('care');
  if (on) {
    if (!(await ensurePermission())) return false;
    const [hour, minute] = careAt.split(':').map(Number);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: plantName ? `${plantName} đang chờ bé đấy!` : 'Đến giờ chăm cây rồi!',
        body: 'Mở Sprouty xem cây có khát nước không, rồi chụp một tấm ảnh kỷ niệm nhé.',
        data: { kind: 'care', url: '/garden' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'care' },
    });
  }
  await saveReminders({ ...(await readReminders()), care: on, careAt });
  return true;
}

export async function setWorkshopReminders(on: boolean) {
  const settings = { ...(await readReminders()), workshops: on };
  await saveReminders(settings);
  if (!on) await cancelKind('workshop');
  return settings;
}

/**
 * Reschedules the reminders for the bookings just loaded: the evening before
 * at 19:00, and two hours before. Called by "Vé của tôi" on every load, so a
 * cancelled booking loses its reminders and a new one gains them.
 */
export async function syncWorkshopReminders(bookings: MyWorkshopRegistration[]) {
  if (!available) return;
  const settings = await readReminders();
  await cancelKind('workshop');
  if (!settings.workshops) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await ensureChannels();

  const now = Date.now();
  for (const b of bookings) {
    if (b.status === 'cancelled' || b.workshop.status === 'cancelled' || !b.upcoming || b.checkedInAt) continue;
    const start = new Date(b.workshop.dateTime).getTime();
    const eve = new Date(start - 24 * 3600_000);
    eve.setHours(19, 0, 0, 0);
    const time = new Date(start).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const data = { kind: 'workshop', url: '/workshop?tab=tickets' };
    if (eve.getTime() > now) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Ngày mai bé có buổi workshop', body: `${b.workshop.title} lúc ${time} tại ${b.workshop.location}. Vé QR nằm trong mục Vé của tôi.`, data },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: eve, channelId: 'workshop' },
      });
    }
    if (start - 2 * 3600_000 > now) {
      await Notifications.scheduleNotificationAsync({
        content: { title: 'Còn 2 tiếng nữa là tới giờ học', body: `${b.workshop.title} — nhớ mở vé QR khi tới nơi nhé.`, data },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(start - 2 * 3600_000), channelId: 'workshop' },
      });
    }
  }
}

/** Signing out: nothing about this family should keep ringing on the phone. */
export async function clearAllReminders() {
  if (available) await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  await AsyncStorage.removeItem(KEY).catch(() => {});
}
