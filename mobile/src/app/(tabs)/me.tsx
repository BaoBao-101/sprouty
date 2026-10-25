import type { ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Icon, type IconName } from '@/components/Icon';
import { Button, Card, H, Screen, T, tap } from '@/components/ui';
import { imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { daysLeft, formatDate } from '@/lib/format';
import { HELP_PAGES, openWeb } from '@/lib/help';
import { clearAllReminders } from '@/lib/reminders';
import { colors, fonts, radius } from '@/theme';

function Item({ icon, label, sub, onPress, danger }: { icon: IconName; label: string; sub?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={({ pressed }) => [s.item, pressed && { backgroundColor: colors.greenSoft }]} accessibilityRole="button">
      <View style={[s.itemIcon, danger && { backgroundColor: colors.badSoft }]}><Icon name={icon} size={20} color={danger ? colors.bad : colors.greenDark} /></View>
      <View style={{ flex: 1 }}>
        <Text style={[s.itemLabel, danger && { color: colors.bad }]}>{label}</Text>
        {sub ? <Text style={s.itemSub}>{sub}</Text> : null}
      </View>
      <Icon name="arrow-right" size={17} color={colors.ink4} />
    </Pressable>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <View style={s.group}>{children}</View>;
}

/** Của tôi: orders, the account, reminders, help — and signing out. */
export default function Me() {
  const { user, logout } = useAuth();
  const version = Constants.expoConfig?.version || '1.0.0';

  function signOut() {
    Alert.alert('Đăng xuất?', 'Giỏ hàng vẫn được giữ trên máy. Lời nhắc chăm cây sẽ tắt cho tới khi bạn đăng nhập lại.', [
      { text: 'Ở lại', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: async () => { await clearAllReminders(); await logout(); router.replace('/'); } },
    ]);
  }

  return (
    <Screen title="Của tôi" large>
      {user ? (
        <Card style={s.profile}>
          <View style={s.avatar}><Text style={s.avatarText}>{(user.name || '?').trim().split(/\s+/).pop()?.charAt(0).toUpperCase()}</Text></View>
          <View style={{ flex: 1, gap: 2 }}>
            <H size={19}>{user.name}</H>
            <T muted numberOfLines={1}>{user.email}</T>
            {user.isVip ? (
              <View style={s.vip}><Icon name="star" size={13} color={colors.warn} /><Text style={s.vipText}>VIP đến {formatDate(user.vipUntil)} · còn {daysLeft(user.vipUntil)} ngày</Text></View>
            ) : null}
          </View>
        </Card>
      ) : (
        <Card tone="soft" style={{ alignItems: 'center' }}>
          <Image source={imageSource('/assets/images/sprouty-icons/Tree.png') as number} style={{ width: 92, height: 92 }} contentFit="contain" />
          <H size={19} style={{ textAlign: 'center' }}>Chào mừng tới Sprouty</H>
          <T muted style={{ textAlign: 'center' }}>Đăng nhập để theo dõi đơn hàng, chăm cây cùng bé và giữ vé workshop.</T>
          <Button block title="Đăng nhập" onPress={() => router.push('/login')} />
          <Button block variant="ghost" title="Tạo tài khoản mới" onPress={() => router.push('/register')} />
        </Card>
      )}

      {user && (
        <Group>
          <Item icon="cart" label="Đơn hàng của tôi" sub="Thanh toán, mã kích hoạt, giao hàng" onPress={() => router.push('/orders')} />
          <Item icon="sprout" label="Khu vườn của bé" onPress={() => router.push('/garden')} />
          <Item icon="album" label="Album kỷ niệm" onPress={() => router.push('/album')} />
          <Item icon="ticket" label="Vé workshop" onPress={() => router.push('/workshop?tab=tickets')} />
          <Item icon="star" label="VIP Garden" sub={user.isVip ? 'Bạn đang là thành viên VIP' : 'Quyền lợi thành viên'} onPress={() => router.push('/vip')} />
        </Group>
      )}

      <Group>
        <Item icon="chat" label="Hỏi Plant Buddy" sub="Trợ lý AI trồng cây cho bé" onPress={() => router.push('/ai')} />
        <Item icon="book" label="Góc chia sẻ" sub="Bài viết trồng cây cùng con" onPress={() => router.push('/blog')} />
        {user && <Item icon="bell" label="Lời nhắc" sub="Nhắc chăm cây, nhắc lịch workshop" onPress={() => router.push('/settings')} />}
        {user && <Item icon="user" label="Thông tin tài khoản" sub="Họ tên, mật khẩu" onPress={() => router.push('/profile')} />}
      </Group>

      <Group>
        {HELP_PAGES.map((p) => <Item key={p.path} icon={p.icon} label={p.label} onPress={() => openWeb(p.path)} />)}
      </Group>

      {user && (
        <Group>
          <Item icon="logout" label="Đăng xuất" onPress={signOut} />
          <Item icon="trash" label="Xoá tài khoản" danger onPress={() => router.push('/delete-account')} />
        </Group>
      )}

      <T muted style={{ textAlign: 'center', fontSize: 12.5 }}>Sprouty · phiên bản {version}</T>
    </Screen>
  );
}

const s = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.display, fontSize: 26, color: colors.greenDark, lineHeight: 34 },
  vip: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: '#FFF1DE' },
  vipText: { fontFamily: fonts.bold, fontSize: 12, color: colors.warn },
  group: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  itemIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  itemLabel: { fontFamily: fonts.semi, fontSize: 15.5, color: colors.ink },
  itemSub: { fontFamily: fonts.body, fontSize: 12.5, color: colors.ink3 },
});
