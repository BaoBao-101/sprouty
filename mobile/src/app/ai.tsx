import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { useToast } from '@/components/Toast';
import { Button, Empty, Header, IconButton, T, tap } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { callName, formatPrice, plainAiText } from '@/lib/format';
import { pickMedia, toDataUrl } from '@/lib/photos';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme';

const aiMark = imageSource('/assets/images/sprouty-mark.png') as number;
const CONTEXT_TURNS = 6;

const PROMPTS: Array<{ icon: IconName; label: string; text: string }> = [
  { icon: 'gift', label: 'Chọn kit cho bé', text: 'Kit nào phù hợp cho bé 6 tuổi?' },
  { icon: 'water', label: 'Chăm cây mỗi ngày', text: 'Cách gieo hạt và tưới cây đúng cách' },
  { icon: 'camera', label: 'Viết một kỷ niệm', text: 'Gợi ý một caption cho ngày đầu bé gieo hạt' },
  { icon: 'bulb', label: 'Khám phá STEM', text: 'Giải thích cảm biến độ ẩm đất cho bé dễ hiểu' },
  { icon: 'ticket', label: 'Hẹn một workshop', text: 'Lịch workshop sắp tới' },
];

interface Suggested { id: number; name: string; price: number; ageRange?: string | null; image: string | null }
interface Message { id: string; role: 'user' | 'ai'; text: string; image?: string; products?: Suggested[] }

/**
 * Plant Buddy, the Sprouty assistant: questions about kits, care and the
 * child's plant, with a photo when words are not enough ("lá bị vàng thế
 * này là sao?"). The kits it names come back as cards to open.
 */
export default function Assistant() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const toast = useToast();
  const scroller = useRef<ScrollViewInstance>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; width: number; height: number } | null>(null);
  const [typing, setTyping] = useState(false);
  const [locked, setLocked] = useState(false);

  // An account may need a kit's code before the assistant opens to it.
  useEffect(() => {
    if (!user) return;
    let live = true;
    API.entitlements()
      .then((state: any) => live && setLocked(Boolean(state.aiRequiresEntitlement && !state.features?.ai_assistant)))
      .catch(() => live && setLocked(false));
    return () => { live = false; };
  }, [user]);

  useEffect(() => {
    const id = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [messages, typing]);

  async function attach(from: 'library' | 'camera') {
    try {
      const picked = await pickMedia(from);
      if (picked?.[0]) setPhoto({ uri: picked[0].uri, width: picked[0].width, height: picked[0].height });
    } catch (err: any) {
      toast(err?.message || 'Chưa mở được ảnh.', 'error');
    }
  }

  async function send(text?: string) {
    const question = (text ?? input).trim();
    if (typing || (!question && !photo)) return;
    if (locked) return toast('Nhập mã kích hoạt để dùng trợ lý AI', 'error');
    const asked = question || 'Bạn xem giúp mình cây trong ảnh này đang thế nào?';
    const attached = photo;
    setInput('');
    setPhoto(null);
    setMessages((m) => [...m, { id: `u${Date.now()}`, role: 'user', text: asked, image: attached?.uri }]);
    const nextHistory = [...history, { role: 'user', content: asked }];
    setHistory(nextHistory);
    setTyping(true);
    try {
      const imageDataUrl = attached ? await toDataUrl(attached, 1024, 0.75) : undefined;
      const { reply, products } = await API.chat.send(nextHistory.slice(-CONTEXT_TURNS), imageDataUrl);
      setHistory((h) => [...h, { role: 'assistant', content: reply }]);
      setMessages((m) => [...m, { id: `a${Date.now()}`, role: 'ai', text: reply, products }]);
    } catch (err: any) {
      if (err?.status === 403 && /mã kích hoạt/i.test(err?.message || '')) setLocked(true);
      setMessages((m) => [...m, { id: `e${Date.now()}`, role: 'ai', text: err?.message || 'Xin lỗi, có lỗi kết nối. Vui lòng thử lại sau!' }]);
    } finally {
      setTyping(false);
    }
  }

  function clear() {
    setMessages([]);
    setHistory([]);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[s.screen, { paddingTop: insets.top }]}>
      <Header title="Plant Buddy" back="/" actions={messages.length ? <IconButton icon="trash" label="Xoá cuộc trò chuyện" onPress={clear} /> : undefined} />
      {!user ? (
        <View style={{ flex: 1, padding: gutter, justifyContent: 'center' }}>
          <Empty art={aiMark} title="Trò chuyện với Plant Buddy" text="Đăng nhập để hỏi về bộ kit, cách chăm cây và gửi ảnh cây cho trợ lý xem giúp.">
            <Button title="Đăng nhập" onPress={() => router.push('/login?next=/ai')} />
          </Empty>
        </View>
      ) : (
        <>
          <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" contentContainerStyle={s.thread}>
            <View style={s.inner}>
              {messages.length === 0 && (
                <View style={{ gap: 14 }}>
                  <View style={s.hello}>
                    <View style={s.avatarBig}><Image source={aiMark} style={{ width: 40, height: 40 }} contentFit="contain" /></View>
                    <T bold style={{ fontSize: 17, textAlign: 'center' }}>Chào {callName(user.name) || 'bạn'}! Mình là Plant Buddy.</T>
                    <T muted style={{ textAlign: 'center' }}>Chuyện chăm cây, chọn kit hay lưu kỷ niệm — cứ hỏi mình nhé. Gửi kèm ảnh cây nếu bạn muốn mình xem giúp.</T>
                  </View>
                  {PROMPTS.map((p) => (
                    <Pressable key={p.label} onPress={() => { tap(); void send(p.text); }} style={({ pressed }) => [s.prompt, pressed && { backgroundColor: colors.greenSoft }]}>
                      <View style={s.promptIcon}><Icon name={p.icon} size={19} color={colors.greenDark} /></View>
                      <View style={{ flex: 1 }}><T bold>{p.label}</T><T muted style={{ fontSize: 13 }}>{p.text}</T></View>
                      <Icon name="arrow-right" size={16} color={colors.ink4} />
                    </Pressable>
                  ))}
                </View>
              )}
              {messages.map((m) => (
                <View key={m.id} style={{ gap: 8 }}>
                  <View style={[s.msgRow, m.role === 'user' && { justifyContent: 'flex-end' }]}>
                    {m.role === 'ai' && <View style={s.avatar}><Image source={aiMark} style={{ width: 20, height: 20 }} contentFit="contain" /></View>}
                    <View style={[s.bubble, m.role === 'user' ? s.me : s.ai]}>
                      {m.image && <Image source={{ uri: m.image }} style={s.bubbleImage} contentFit="cover" />}
                      <Text selectable style={[s.bubbleText, m.role === 'user' && { color: colors.white }]}>{m.role === 'ai' ? plainAiText(m.text) : m.text}</Text>
                    </View>
                  </View>
                  {m.products?.length ? (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingLeft: 40 }}>
                      {m.products.map((p) => (
                        <Pressable key={p.id} onPress={() => router.push(`/product/${p.id}`)} style={s.kit}>
                          <View style={s.kitImage}>{imageSource(p.image) && <Image source={imageSource(p.image)} style={StyleSheet.absoluteFill} contentFit="cover" />}</View>
                          <Text numberOfLines={2} style={s.kitName}>{p.name}</Text>
                          <Text style={s.kitPrice}>{formatPrice(p.price)}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : null}
                </View>
              ))}
              {typing && (
                <View style={s.msgRow}>
                  <View style={s.avatar}><Image source={aiMark} style={{ width: 20, height: 20 }} contentFit="contain" /></View>
                  <View style={[s.bubble, s.ai]}><T muted>Plant Buddy đang trả lời…</T></View>
                </View>
              )}
              {locked && (
                <Button variant="soft" icon="seed" title="Nhập mã kích hoạt" onPress={() => router.push('/garden?activate=1')} />
              )}
            </View>
          </ScrollView>

          <View style={[s.composerWrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <View style={s.inner}>
              {photo && (
                <View style={s.attached}>
                  <Image source={{ uri: photo.uri }} style={s.attachedImage} contentFit="cover" />
                  <T muted style={{ flex: 1 }}>Ảnh sẽ được gửi kèm câu hỏi</T>
                  <IconButton icon="close" label="Bỏ ảnh" onPress={() => setPhoto(null)} />
                </View>
              )}
              <View style={s.composer}>
                <IconButton icon="camera" label="Chụp ảnh cây" onPress={() => attach('camera')} />
                <IconButton icon="album" label="Chọn ảnh từ máy" onPress={() => attach('library')} />
                <TextInput value={input} onChangeText={setInput} placeholder="Hỏi Plant Buddy…" placeholderTextColor={colors.ink5}
                  style={s.input} multiline maxLength={1000} />
                <Pressable onPress={() => send()} disabled={typing || (!input.trim() && !photo)} accessibilityLabel="Gửi"
                  style={[s.send, (typing || (!input.trim() && !photo)) && { opacity: 0.45 }]}>
                  <Icon name="arrow-right" size={20} color={colors.white} />
                </Pressable>
              </View>
              <T muted style={{ fontSize: 11.5, textAlign: 'center' }}>Plant Buddy là AI, có thể nhầm. Hỏi ý kiến người lớn khi cần nhé.</T>
            </View>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  thread: { flexGrow: 1, paddingHorizontal: gutter, paddingVertical: 16 },
  inner: { width: '100%', maxWidth, alignSelf: 'center', gap: 12 },
  hello: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  avatarBig: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 60, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  promptIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, gap: 8 },
  me: { backgroundColor: colors.green, borderBottomRightRadius: 6 },
  ai: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
  bubbleText: { fontFamily: fonts.body, fontSize: 15.5, lineHeight: 23, color: colors.ink },
  bubbleImage: { width: 200, height: 150, borderRadius: 12 },
  kit: { width: 150, padding: 8, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, gap: 4 },
  kitImage: { height: 100, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.greenSoft },
  kitName: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink },
  kitPrice: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.price },
  composerWrap: { paddingTop: 8, paddingHorizontal: gutter - 4, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderWidth: 1.5, borderColor: '#CFE9C9', borderRadius: 23, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, fontFamily: fonts.body, fontSize: 15.5, color: colors.ink, backgroundColor: colors.cream, marginHorizontal: 4 },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  attached: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 6, borderRadius: radius.sm, backgroundColor: colors.greenSoft },
  attachedImage: { width: 48, height: 48, borderRadius: 8 },
});
