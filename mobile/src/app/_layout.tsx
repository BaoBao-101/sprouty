import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Baloo2_600SemiBold, Baloo2_700Bold } from '@expo-google-fonts/baloo-2';
import {
  BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold,
} from '@expo-google-fonts/be-vietnam-pro';
import { AuthProvider, useAuth } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { ToastProvider } from '@/components/Toast';
import { WarmUp3D } from '@/components/Plant3D';
import { ThumbStudio } from '@/components/PlantThumb';
import { ONBOARDED_KEY } from '@/lib/config';
import { onReminderTap } from '@/lib/reminders';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync().catch(() => {});

/** Holds the splash until fonts and the stored session are ready, then shows the welcome once. */
function Gate() {
  const { ready } = useAuth();
  const [fontsLoaded] = useFonts({
    Baloo2_600SemiBold, Baloo2_700Bold,
    BeVietnamPro_400Regular, BeVietnamPro_500Medium, BeVietnamPro_600SemiBold, BeVietnamPro_700Bold,
  });
  const [checkedWelcome, setCheckedWelcome] = useState(false);

  useEffect(() => {
    if (!fontsLoaded || !ready) return;
    void SplashScreen.hideAsync().catch(() => {});
    AsyncStorage.getItem(ONBOARDED_KEY).then((seen) => {
      setCheckedWelcome(true);
      if (!seen) router.replace('/welcome');
    });
  }, [fontsLoaded, ready]);

  // Tapping a reminder opens the screen it is about.
  useEffect(() => onReminderTap((url) => router.push(url as never)), []);

  if (!fontsLoaded) return null;
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.cream }, animation: checkedWelcome ? 'slide_from_right' : 'none' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
        <Stack.Screen name="login" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="register" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
      <WarmUp3D />
      <ThumbStudio />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <CartProvider>
        <ToastProvider>
          <Gate />
        </ToastProvider>
      </CartProvider>
    </AuthProvider>
  );
}
