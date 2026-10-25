import { useState } from 'react';
import { Redirect } from 'expo-router';
import { useToast } from '@/components/Toast';
import { Button, Card, CardTitle, Field, Screen, T } from '@/components/ui';
import { API } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { colors } from '@/theme';

/** Thông tin tài khoản: the name Sprouty uses, and the password. */
export default function Profile() {
  const { user, ready, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  if (ready && !user) return <Redirect href="/login?next=/profile" />;
  if (!user) return null;

  async function saveName() {
    setNameError('');
    const clean = name.trim();
    if (clean.length < 2) return setNameError('Họ tên phải có ít nhất 2 ký tự.');
    setSavingName(true);
    try {
      const data = await API.auth.updateProfile(clean);
      if (data.user) setUser(data.user);
      else setUser({ ...user!, name: clean });
      toast(data.message || 'Đã cập nhật họ tên', 'success');
    } catch (err: any) {
      setNameError(err?.message || 'Không lưu được họ tên.');
    } finally {
      setSavingName(false);
    }
  }

  async function changePassword() {
    setPwError('');
    if (!current) return setPwError('Nhập mật khẩu hiện tại.');
    if (next.length < 6) return setPwError('Mật khẩu mới phải có ít nhất 6 ký tự.');
    if (next !== confirm) return setPwError('Hai lần nhập mật khẩu mới không khớp.');
    if (next === current) return setPwError('Mật khẩu mới phải khác mật khẩu hiện tại.');
    setSavingPw(true);
    try {
      const { message } = await API.auth.changePassword(current, next);
      toast(message || 'Đã đổi mật khẩu', 'success');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err: any) {
      setPwError(err?.message || 'Không đổi được mật khẩu.');
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <Screen title="Thông tin tài khoản" back="/me">
      <Card>
        <CardTitle icon="user">Hồ sơ</CardTitle>
        <Field label="Họ và tên" value={name} onChangeText={(t) => { setName(t); setNameError(''); }} autoComplete="name" error={nameError} maxLength={80} />
        <Field label="Email" value={user.email} editable={false} style={{ color: colors.ink3, backgroundColor: colors.cream2 }} hint="Email đăng nhập không đổi được." />
        {user.createdAt ? <T muted style={{ fontSize: 13 }}>Thành viên từ {formatDate(user.createdAt)}</T> : null}
        <Button title={savingName ? 'Đang lưu…' : 'Lưu họ tên'} busy={savingName} disabled={name.trim() === user.name} onPress={saveName} />
      </Card>

      <Card>
        <CardTitle icon="lock">Đổi mật khẩu</CardTitle>
        <Field label="Mật khẩu hiện tại" value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" />
        <Field label="Mật khẩu mới" value={next} onChangeText={setNext} secureTextEntry autoComplete="new-password" placeholder="Ít nhất 6 ký tự" />
        <Field label="Nhập lại mật khẩu mới" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" error={pwError} />
        <T muted style={{ fontSize: 13 }}>Đổi xong, các máy khác đang đăng nhập tài khoản này sẽ bị đăng xuất.</T>
        <Button variant="soft" title={savingPw ? 'Đang đổi…' : 'Đổi mật khẩu'} busy={savingPw} onPress={changePassword} />
      </Card>
    </Screen>
  );
}
