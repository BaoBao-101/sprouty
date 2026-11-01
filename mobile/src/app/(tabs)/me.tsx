import { Alert, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Group, IconTile, Label, ListRow, Press, Screen } from '@/components/ui';
import { imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { daysLeft, formatDate } from '@/lib/format';
import { HELP_PAGES, openWeb } from '@/lib/help';
import { clearAllReminders } from '@/lib/reminders';
import { colors, fonts, radius, surface } from '@/theme';

/** The four places a parent comes back to most, one tap each, each its own colour. */
const SHORTCUTS: Array<{ icon: IconName; label: string; href: string; tint: string; ink: string }> = [
  { icon: 'cart', label: 'Đơn hàng', href: '/orders', tint: '#F6E6D6', ink: colors.earth },
  { icon: 'sprout', label: 'Khu vườn', href: '/garden', tint: colors.mint, ink: colors.greenDark },
  { icon: 'album', label: 'Album', href: '/album', tint: '#DCEFF1', ink: '#2F6F78' },
  { icon: 'ticket', label: 'Vé', href: '/workshop?tab=tickets', tint: '#FBEBC4', ink: colors.gold },
];

const go = (href: string) => () => router.push(href as never);

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
          <View pointerEvents="none" style={s.profileLeaf}><Icon name="leaf" size={120} color="rgba(255,255,255,0.07)" /></View>
          <Press onPress={go('/profile')} accessibilityLabel="Thông tin tài khoản" scaleTo={0.98} style={s.profileTop}>
            <View style={s.avatar}><Text style={s.avatarText}>{initial}</Text></View>
            <View style={{ flex: 1, gap: 1 }}>
              <Text numberOfLines={1} style={s.name}>{user.name}</Text>
              <Text numberOfLines={1} style={s.email}>{user.email}</Text>
            </View>
            <View style={s.edit}><Icon name="pencil" size={16} color={colors.white} /></View>
          </Press>
          <Press onPress={go('/vip')} scaleTo={0.98} style={[s.member, user.isVip && s.memberVip]}>
            <Icon name="star" size={16} color={user.isVip ? colors.gold : '#FFC266'} />
            <Text numberOfLines={1} style={[s.memberText, user.isVip && { color: colors.gold }]}>
              {user.isVip ? `VIP · còn ${daysLeft(user.vipUntil)} ngày` : 'Tài khoản thường'}
            </Text>
            <Text style={[s.memberLink, user.isVip && { color: colors.gold }]}>
              {user.isVip ? `đến ${formatDate(user.vipUntil)}` : 'Lên VIP'}
            </Text>
            <Icon name="arrow-right" size={14} color={user.isVip ? colors.gold : colors.white} />
          </Press>
        </View>
      ) : (
        <View style={[s.profile, { gap: 14, padding: 20 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={s.guestArt}><Image source={imageSource('/assets/images/sprouty-icons/Tree.png') as number} style={{ width: 52, height: 52 }} contentFit="contain" /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.name}>Chào mừng tới Sprouty</Text>
              <Text style={s.email}>Đăng nhập để chăm cây cùng bé.</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button grow small variant="light" title="Đăng nhập" onPress={go('/login')} />
            <Button grow small title="Tạo tài khoản" style={s.ghostOnDark} onPress={go('/register')} />
          </View>
        </View>
      )}

      {user && (
        <View style={s.shortcuts}>
          {SHORTCUTS.map((item) => (
            <Press key={item.href} onPress={go(item.href)} accessibilityLabel={item.label} scaleTo={0.94} style={s.shortcut}>
              <IconTile icon={item.icon} size={46} tint={item.tint} color={item.ink} />
              <Text numberOfLines={1} style={s.shortcutLabel}>{item.label}</Text>
            </Press>
          ))}
        </View>
      )}

      <View style={s.section}>
        <Label>Tiện ích</Label>
        <Group>
          <ListRow icon="chat" tint="#DCEFF1" iconColor="#2F6F78" title="Hỏi Plant Buddy" onPress={go('/ai')} />
          <ListRow icon="book" tint={colors.earthSoft} iconColor={colors.earth} title="Góc chia sẻ" onPress={go('/blog')} last={!user} />
          {user && <ListRow icon="bell" tint="#FBEBC4" iconColor={colors.gold} title="Lời nhắc" onPress={go('/settings')} last />}
        </Group>
      </View>

      <View style={s.section}>
        <Label>Hỗ trợ</Label>
        <Group>
          {HELP_PAGES.map((p, i) => <ListRow key={p.path} icon={p.icon} title={p.label} onPress={() => openWeb(p.path)} last={i === HELP_PAGES.length - 1} />)}
        </Group>
      </View>

      {user && (
        <View style={s.section}>
          <Label>Tài khoản</Label>
          <Group>
            <ListRow icon="user" title="Thông tin tài khoản" onPress={go('/profile')} />
            <ListRow icon="logout" tint={colors.badSoft} iconColor={colors.bad} title="Đăng xuất" titleStyle={{ color: colors.bad }} onPress={signOut} last />
          </Group>
        </View>
      )}

      <View style={s.version}>
        <Icon name="leaf" size={14} color={colors.ink5} />
        <Text style={s.versionText}>Sprouty · phiên bản {version}</Text>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  profile: { borderRadius: radius.xl, backgroundColor: colors.forest, overflow: 'hidden' },
  profileLeaf: { position: 'absolute', right: -20, top: -24 },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)' },
  avatarText: { fontFamily: fonts.display, fontSize: 26, lineHeight: 34, color: colors.forest },
  name: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: colors.white },
  email: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: '#C6E2BF' },
  edit: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  member: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, marginHorizontal: 10, marginBottom: 10, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.1)' },
  memberVip: { backgroundColor: colors.goldSoft },
  memberText: { flex: 1, fontFamily: fonts.semi, fontSize: 14, color: colors.white },
  memberLink: { fontFamily: fonts.bold, fontSize: 13, color: colors.white },
  guestArt: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  ghostOnDark: { backgroundColor: 'rgba(255,255,255,0.14)', shadowOpacity: 0, elevation: 0 },
  shortcuts: { flexDirection: 'row', gap: 10 },
  shortcut: { ...surface, flex: 1, alignItems: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 4 },
  shortcutLabel: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.ink2 },
  section: { gap: 8 },
  version: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 8 },
  versionText: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink4 },
});
