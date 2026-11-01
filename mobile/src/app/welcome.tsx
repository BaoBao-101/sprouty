import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ScrollViewInstance } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Button, H, T, tap } from '@/components/ui';
import { imageSource } from '@/lib/api';
import { ONBOARDED_KEY } from '@/lib/config';
import { colors, fonts, gutter } from '@/theme';

const art = (name: string) => imageSource(`/assets/images/sprouty-icons/${name}.png`) as number;

const SLIDES = [
  { art: 'Tree', title: 'Gieo hạt thật,\nnuôi cây cùng bé', text: 'Chậu cây thật ở nhà, cây 3D lớn lên trong app.' },
  { art: 'MyTree', title: 'Chăm cây mỗi ngày', text: 'Cảm biến báo cây khát hay đói, Plant Buddy giải thích cho bé.' },
  { art: 'Workshop', title: 'Workshop cuối tuần', text: 'Đăng ký buổi học cho cả nhà, giữ vé QR ngay trên điện thoại.' },
];

/** Three screens, once, on the first launch. */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scroller = useRef<ScrollViewInstance>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  async function finish(to: '/' | '/login' | '/register' = '/') {
    await AsyncStorage.setItem(ONBOARDED_KEY, '1').catch(() => {});
    router.replace('/');
    if (to !== '/') router.push(to);
  }

  function go(next: number) {
    tap();
    scroller.current?.scrollTo({ x: next * width, animated: true });
    setPage(next);
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + 12 }]}>
      <View style={s.top}>
        {!last && (
          <Pressable onPress={() => finish()} hitSlop={8} style={s.skip} accessibilityRole="button">
            <Text style={s.skipText}>Bỏ qua</Text>
          </Pressable>
        )}
      </View>
      <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
        {SLIDES.map((slide) => (
          <View key={slide.title} style={[s.slide, { width }]}>
            <View style={s.inner}>
              <View style={[s.artWrap, { width: Math.min(280, width * 0.72), height: Math.min(280, width * 0.72) }]}>
                <Image source={art(slide.art)} style={{ width: Math.min(240, width * 0.6), height: Math.min(240, width * 0.6) }} contentFit="contain" />
              </View>
              <H size={28} style={{ textAlign: 'center' }}>{slide.title}</H>
              <T style={{ textAlign: 'center', fontSize: 16.5, lineHeight: 25, color: colors.ink3 }}>{slide.text}</T>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={s.foot}>
        <View style={s.dots}>
          {SLIDES.map((_, i) => <View key={i} style={[s.dot, i === page && s.dotOn]} />)}
        </View>
        {last ? (
          <>
            <Button title="Bắt đầu khám phá" icon="arrow-right" onPress={() => finish()} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, alignItems: 'center' }}>
              <T muted>Đã có tài khoản?</T>
              <Pressable onPress={() => finish('/login')} hitSlop={8} style={{ minHeight: 40, justifyContent: 'center' }}>
                <Text style={s.skipText}>Đăng nhập</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Button title="Tiếp tục" icon="arrow-right" onPress={() => go(page + 1)} />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  top: { height: 52, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: gutter },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  skipText: { fontFamily: fonts.bold, fontSize: 15, color: colors.green },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  inner: { maxWidth: 460, alignItems: 'center', gap: 16 },
  artWrap: { borderRadius: 999, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 10, borderColor: colors.card },
  foot: { width: '100%', maxWidth: 460, alignSelf: 'center', paddingHorizontal: gutter, gap: 14 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sand },
  dotOn: { width: 24, backgroundColor: colors.green },
});
