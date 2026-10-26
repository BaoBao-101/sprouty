import type { ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Screen, tap } from '@/components/ui';
import { imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { daysLeft, formatDate } from '@/lib/format';
import { HELP_PAGES, openWeb } from '@/lib/help';
import { clearAllReminders } from '@/lib/reminders';
import { colors, fonts, radius } from '@/theme';

/** The four places a parent comes back to most, one tap each. */
const SHORTCUTS: Array<{ icon: IconName; label: string; href: string }> = [
  { icon: 'cart', label: 'Đơn hàng', href: '/orders' },
  { icon: 'sprout', label: 'Khu vườn', href: '/garden' },
  { icon: 'album', label: 'Album', href: '/album' },
  { icon: 'ticket', label: 'Vé workshop', href: '/workshop?tab=tickets' },
];

const go = (href: string) => () => router.push(href as never);

/** A titled list of rows. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.group}>{children}</View>
    </View>
  );
}

/** One row; the divider starts after the icon, so rows read as one list. */
function Row({ icon, label, onPress, last }: { icon: IconName; label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button"
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.cream2 }]}>
      <Icon name={icon} size={20} color={colors.greenDark} />
      <View style={[s.rowBody, !last && s.rowDivider]}>
        <Text style={s.rowLabel}>{label}</Text>
        <Icon name="arrow-right" size={16} color={colors.ink5} />
      </View>
    </Pressable>
  );
}

/** Của tôi: who is signed in, the shortcuts, and the rest in short titled lists. */
export default function Me() {
  const { user, logout } = useAuth();
  const version = Constants.expoConfig?.version || '1.0.0';

  function signOut() {
    Alert.alert('Đăng xuất?', 'Giỏ hàng vẫn được giữ trên máy. Lời nhắc chăm cây sẽ tắt cho tới khi bạn đăng nhập lại.', [
      { text: 'Ở lại', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: async () => { await clearAllReminders(); await logout(); router.replace('/'); } },
    ]);
  }

  const initial = (user?.name || '?').trim().split(/\s+/).pop()?.charAt(0).toUpperCase();

  return (
    <Screen title="Của tôi" large>
      {user ? (
        <View style={s.profile}>
          <Pressable onPress={go('/profile')} accessibilityRole="button" accessibilityLabel="Thông tin tài khoản"
            style={({ pressed }) => [s.profileTop, pressed && { opacity: 0.85 }]}>
            <View style={s.avatar}><Text style={s.avatarText}>{initial}</Text></View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text numberOfLines={1} style={s.name}>{user.name}</Text>
              <Text numberOfLines={1} style={s.email}>{user.email}</Text>
            </View>
            <Icon name="arrow-right" size={18} color={colors.ink4} />
          </Pressable>
          <Pressable onPress={go('/vip')} accessibilityRole="button"
            style={({ pressed }) => [s.member, user.isVip && s.memberVip, pressed && { opacity: 0.85 }]}>
            <Icon name="star" size={16} color={user.isVip ? colors.warn : colors.greenDark} />
            <Text style={[s.memberText, user.isVip && { color: colors.warn }]}>
              {user.isVip ? `Thành viên VIP · còn ${daysLeft(user.vipUntil)} ngày` : 'Tài khoản thường'}
            </Text>
            <Text style={[s.memberLink, user.isVip && { color: colors.warn }]}>
              {user.isVip ? `đến ${formatDate(user.vipUntil)}` : 'Xem VIP Garden'}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={[s.profile, { gap: 14, padding: 16 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Image source={imageSource('/assets/images/sprouty-icons/Tree.png') as number} style={{ width: 64, height: 64 }} contentFit="contain" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.name}>Chào mừng tới Sprouty</Text>
              <Text style={s.email}>Đăng nhập để theo dõi đơn hàng, chăm cây cùng bé và giữ vé workshop.</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button grow small title="Đăng nhập" onPress={go('/login')} />
            <Button grow small variant="ghost" title="Tạo tài khoản" onPress={go('/register')} />
          </View>
        </View>
      )}

      {user && (
        <View style={s.shortcuts}>
          {SHORTCUTS.map((item) => (
            <Pressable key={item.href} onPress={() => { tap(); go(item.href)(); }} accessibilityRole="button"
              style={({ pressed }) => [s.shortcut, pressed && { backgroundColor: colors.cream2 }]}>
              <View style={s.shortcutIcon}><Icon name={item.icon} size={22} color={colors.greenDark} /></View>
              <Text numberOfLines={1} style={s.shortcutLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Section title="Tiện ích">
        <Row icon="chat" label="Hỏi Plant Buddy" onPress={go('/ai')} />
        <Row icon="book" label="Góc chia sẻ" onPress={go('/blog')} last={!user} />
        {user && <Row icon="bell" label="Lời nhắc" onPress={go('/settings')} last />}
      </Section>

      <Section title="Hỗ trợ">
        {HELP_PAGES.map((p, i) => <Row key={p.path} icon={p.icon} label={p.label} onPress={() => openWeb(p.path)} last={i === HELP_PAGES.length - 1} />)}
      </Section>

      {user && (
        <Section title="Tài khoản">
          <Row icon="user" label="Thông tin tài khoản" onPress={go('/profile')} />
          <Row icon="logout" label="Đăng xuất" onPress={signOut} last />
        </Section>
      )}

      <Text style={s.version}>Sprouty · phiên bản {version}</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  profile: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32, color: colors.white },
  name: { fontFamily: fonts.display, fontSize: 19, lineHeight: 25, color: colors.ink },
  email: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.ink3 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 16, backgroundColor: colors.greenSoft },
  memberVip: { backgroundColor: '#FFF4E2' },
  memberText: { flex: 1, fontFamily: fonts.semi, fontSize: 13.5, color: colors.greenDark },
  memberLink: { fontFamily: fonts.bold, fontSize: 13, color: colors.green },
  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcut: { flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  shortcutIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  shortcutLabel: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.ink2 },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.ink4, marginLeft: 4 },
  group: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 16 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingRight: 14 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 15.5, color: colors.ink },
  version: { textAlign: 'center', fontFamily: fonts.body, fontSize: 12.5, color: colors.ink4 },
});
