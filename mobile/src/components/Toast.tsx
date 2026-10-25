import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '@/theme';

type Tone = 'info' | 'success' | 'error';
const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

/**
 * A short line at the bottom of the screen — "Đã thêm vào giỏ", "Đã sao
 * chép". Above the tab bar, gone after three seconds, never in the way.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((message: string, tone: Tone = 'info') => {
    clearTimeout(timer.current);
    setToast({ message, tone });
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setToast(null));
    }, 3000);
  }, [opacity]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 84 }]}>
          <Animated.View style={[styles.toast, toast.tone === 'success' && styles.success, toast.tone === 'error' && styles.error, { opacity }]}>
            <Text style={styles.text}>{toast.message}</Text>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: { maxWidth: 520, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.ink },
  success: { backgroundColor: colors.greenDark },
  error: { backgroundColor: colors.bad },
  text: { color: colors.white, fontFamily: fonts.semi, fontSize: 14.5, textAlign: 'center', lineHeight: 20 },
});
