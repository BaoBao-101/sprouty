import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/Icon';
import { tap } from '@/components/ui';
import { colors, fonts } from '@/theme';

const TABS: Array<{ name: string; title: string; icon: IconName }> = [
  { name: 'index', title: 'Trang chủ', icon: 'home' },
  { name: 'shop', title: 'Cửa hàng', icon: 'gift' },
  { name: 'garden', title: 'Khu vườn', icon: 'sprout' },
  { name: 'workshop', title: 'Workshop', icon: 'ticket' },
  { name: 'me', title: 'Của tôi', icon: 'user' },
];

/**
 * Five places, always in reach of a thumb. Labels stay under the icons: a
 * parent glancing at the phone with a child on their lap should not have to
 * guess what a picture means.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenListeners={{ tabPress: () => tap() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.greenDark,
        tabBarInactiveTintColor: colors.ink4,
        tabBarLabelStyle: { fontFamily: fonts.semi, fontSize: 11.5 },
        tabBarStyle: { height: 62 + insets.bottom, paddingTop: 6, paddingBottom: 6 + insets.bottom, borderTopColor: colors.line, backgroundColor: colors.card },
        sceneStyle: { backgroundColor: colors.cream },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: tab.title, tabBarIcon: ({ color }) => <Icon name={tab.icon} size={24} color={color as string} /> }}
        />
      ))}
    </Tabs>
  );
}
