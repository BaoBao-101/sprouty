import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { Button, Card, Field, H, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { openWeb } from '@/lib/help';
import { clearAllReminders } from '@/lib/reminders';
import { colors } from '@/theme';

const GONE = [
  'Khu vườn, các cây và album kỷ niệm của bé',
  'Trò chuyện với Sprouty AI, đánh giá đã viết',
  'Tên, email và mật khẩu đăng nhập',
];

/**
 * Deleting the account from inside the app, as both stores require. The
 * server refuses while something is still owed either way (an order on its
 * way, a booked session) and says what — that message is shown as it is.
 * Orders stay on record without the name, as the law on invoices requires.
 */
export default function DeleteAccount() {
  const { user, ready, deleteAccount } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (ready && !user) return <Redirect href="/" />;

  async function submit() {
    setError('');
    if (!password) return setError('Nhập mật khẩu để xác nhận.');
    setBusy(true);
    try {
      const message = await deleteAccount(password);
      await clearAllReminders();
      toast(message || 'Tài khoản đã được xoá.', 'success');
      router.replace('/');
    } catch (err: any) {
      setError(err?.message || 'Chưa xoá được tài khoản.');
      setBusy(false);
    }
  }

  return (
    <Screen title="Xoá tài khoản" back="/me">
      <View style={{ alignItems: 'center', gap: 8, paddingTop: 8 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.badSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="trash" size={32} color={colors.bad} />
        </View>
        <H style={{ textAlign: 'center' }}>Xoá tài khoản Sprouty?</H>
        <T muted style={{ textAlign: 'center' }}>Việc này không hoàn tác được. Những thứ sau sẽ bị xoá vĩnh viễn:</T>
      </View>
      <Card tone="danger">
        {GONE.map((g) => (
          <View key={g} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Icon name="close" size={16} color={colors.bad} />
            <T style={{ flex: 1 }}>{g}</T>
          </View>
        ))}
      </Card>
      <T muted style={{ fontSize: 13 }}>Đơn hàng và vé workshop vẫn giữ số tiền và ngày để làm sổ sách, nhưng bỏ tên, số điện thoại và địa chỉ. Nếu còn đơn đang chuẩn bị/đang giao, hoặc suất workshop đã trả tiền chưa diễn ra, hãy hoàn tất trước.</T>
      <Field label="Mật khẩu của bạn" value={password} onChangeText={(t) => { setPassword(t); setError(''); }} secureTextEntry autoComplete="current-password" error={error} />
      <Button variant="danger" title={busy ? 'Đang xoá…' : 'Xoá vĩnh viễn tài khoản'} busy={busy} onPress={submit} />
      <Button variant="ghost" title="Giữ tài khoản" onPress={() => router.back()} />
      <Button small variant="ghost" title="Xem chính sách bảo mật" onPress={() => openWeb('/privacy')} />
    </Screen>
  );
}
