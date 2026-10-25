import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useToast } from '@/components/Toast';
import { Button, cheer, Field, goBack, H, IconButton, T } from '@/components/ui';
import { imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { callName } from '@/lib/format';
import { openWeb } from '@/lib/help';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, gutter } from '@/theme';

const logo = imageSource('/assets/images/sprouty-icons/Tree.png') as number;

/** Only paths inside the app, so a link cannot send someone off to another site after signing in. */
function safeNext(next?: string) {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/**
 * Đăng nhập / Đăng ký. One form for both, the same rules as the website's
 * pages/public/Auth.tsx. `?next=` brings the parent back to what they were
 * doing — the cart, a workshop — instead of to Home.
 */
export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ next?: string }>();
  const next = safeNext(params.next);
  const { login, register } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    if (mode === 'register' && name.trim().length < 2) return setError('Nhập họ và tên của bạn.');
    if (!cleanEmail || !password) return setError('Vui lòng điền đầy đủ thông tin.');
    if (!/\S+@\S+\.\S+/.test(cleanEmail)) return setError('Email không đúng định dạng.');
    if (mode === 'register' && password.length < 6) return setError('Mật khẩu phải có ít nhất 6 ký tự.');
    setBusy(true);
    try {
      const user = mode === 'login' ? await login(cleanEmail, password) : await register(name.trim(), cleanEmail, password);
      cheer();
      toast(mode === 'login' ? `Chào ${callName(user.name) || 'bạn'}!` : 'Tạo tài khoản thành công. Chào mừng tới Sprouty!', 'success');
      // Back to the screen that asked for an account, or on to it if it is not in the stack.
      router.dismissTo(next as never);
    } catch (err: any) {
      setError(err?.message || (mode === 'login' ? 'Đăng nhập thất bại.' : 'Đăng ký thất bại.'));
      setBusy(false);
    }
  }

  const other = mode === 'login' ? '/register' : '/login';
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.scroll, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 24 }]}>
        <View style={s.top}><IconButton icon="close" label="Đóng" onPress={() => goBack('/')} /></View>
        <View style={s.body}>
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Image source={logo} style={{ width: 96, height: 96 }} contentFit="contain" />
            <H size={26} style={{ textAlign: 'center' }}>{mode === 'login' ? 'Chào mừng trở lại' : 'Tạo tài khoản Sprouty'}</H>
            <T muted style={{ textAlign: 'center' }}>{mode === 'login' ? 'Đăng nhập để chăm cây cùng bé.' : 'Miễn phí — để mua kit, nuôi cây và giữ vé workshop của bé.'}</T>
          </View>
          {mode === 'register' && <Field label="Họ và tên" value={name} onChangeText={setName} autoComplete="name" placeholder="Nguyễn Văn A" textContentType="name" />}
          <Field label="Email" value={email} onChangeText={setEmail} autoComplete="email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} placeholder="email@example.com" textContentType="emailAddress" />
          <View>
            <Field label="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry={!show} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'login' ? 'Nhập mật khẩu' : 'Ít nhất 6 ký tự'} onSubmitEditing={submit} returnKeyType="go" style={{ paddingRight: 64 }} />
            <Pressable onPress={() => setShow((v) => !v)} style={s.show} hitSlop={6} accessibilityLabel={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
              <Text style={s.showText}>{show ? 'Ẩn' : 'Hiện'}</Text>
            </Pressable>
          </View>
          {error ? <T style={{ color: colors.bad }}>{error}</T> : null}
          <Button title={busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'} busy={busy} onPress={submit} />
          {mode === 'login' && (
            <Pressable onPress={() => openWeb('/contact')} style={s.link}><Text style={s.linkText}>Quên mật khẩu? Liên hệ Sprouty</Text></Pressable>
          )}
          <View style={s.switch}>
            <T muted>{mode === 'login' ? 'Chưa có tài khoản?' : 'Đã có tài khoản?'}</T>
            <Pressable onPress={() => router.replace(`${other}${params.next ? `?next=${encodeURIComponent(next)}` : ''}` as never)} hitSlop={8} style={s.link}>
              <Text style={s.linkText}>{mode === 'login' ? 'Tạo tài khoản' : 'Đăng nhập'}</Text>
            </Pressable>
          </View>
          {mode === 'register' && (
            <T muted style={{ textAlign: 'center', fontSize: 12.5 }}>Khi tạo tài khoản, bạn đồng ý với chính sách bảo mật của Sprouty.</T>
          )}
          {mode === 'register' && (
            <Pressable onPress={() => openWeb('/privacy')} style={[s.link, { alignSelf: 'center' }]}><Text style={s.linkText}>Đọc chính sách bảo mật</Text></Pressable>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  scroll: { flexGrow: 1, paddingHorizontal: gutter },
  top: { flexDirection: 'row', justifyContent: 'flex-end' },
  body: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 16, flexGrow: 1, justifyContent: 'center' },
  show: { position: 'absolute', right: 6, bottom: 4, height: 42, minWidth: 52, alignItems: 'center', justifyContent: 'center' },
  showText: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  switch: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  link: { minHeight: 40, justifyContent: 'center', alignItems: 'center' },
  linkText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.green },
});
