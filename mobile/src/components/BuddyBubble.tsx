import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { imageSource } from '@/lib/api';
import { colors, shadow } from '@/theme';
import { Press } from './ui';

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
    <Press onPress={onPress} accessibilityLabel={label} scaleTo={0.9} style={[s.bubble, { bottom }]}>
      <Image source={mark} style={{ width: 28, height: 28 }} contentFit="contain" />
    </Press>
  );
}

const s = StyleSheet.create({
  bubble: {
    position: 'absolute', right: 16, width: 54, height: 54, borderRadius: 27,
    backgroundColor: colors.card, borderWidth: 3, borderColor: colors.mint,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.md,
  },
});
