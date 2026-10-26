import { useEffect, useState } from 'react';
import { Keyboard, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { imageSource } from '@/lib/api';
import { colors } from '@/theme';
import { tap } from './ui';

const mark = imageSource('/assets/images/sprouty-mark.png') as number;

/**
 * Plant Buddy, a round button floating in the bottom-right corner — the AI is
 * one tap from anywhere. Steps aside while the keyboard is up, so it never
 * sits on a search box.
 */
export function BuddyBubble({ bottom, onPress, label = 'Hỏi Plant Buddy' }: { bottom: number; onPress: () => void; label?: string }) {
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  if (keyboard) return null;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => [s.bubble, { bottom }, pressed && { transform: [{ scale: 0.94 }] }]}>
      <Image source={mark} style={{ width: 30, height: 30 }} contentFit="contain" />
    </Pressable>
  );
}

const s = StyleSheet.create({
  bubble: {
    position: 'absolute', right: 16, width: 58, height: 58, borderRadius: 29,
    backgroundColor: colors.card, borderWidth: 2, borderColor: colors.green,
    alignItems: 'center', justifyContent: 'center',
    // Lifted just enough to read as floating over the page.
    elevation: 4, shadowColor: '#203424', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
});
