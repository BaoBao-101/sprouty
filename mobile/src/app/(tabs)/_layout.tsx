import { View } from 'react-native';
import { router, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BuddyBubble } from '@/components/BuddyBubble';
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

/** The tab's icon; the open tab sits on a soft green pill, so where you are is seen, not read. */
function TabIcon({ icon, color, focused }: { icon: IconName; color: string; focused: boolean }) {
  return (
    <View style={{ width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? colors.mint : 'transparent' }}>
      <Icon name={icon} size={22} color={color} />
    </View>
  );
}

/**
 * Five places, always in reach of a thumb. Labels stay under the icons: a
 * parent glancing at the phone with a child on their lap should not have to
 * guess what a picture means. Plant Buddy floats above them in the corner.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const barHeight = 66 + insets.bottom;
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenListeners={{ tabPress: () => tap() }}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.greenDark,
          tabBarInactiveTintColor: colors.ink4,
          tabBarLabelStyle: { fontFamily: fonts.semi, fontSize: 11.5, marginTop: 2 },
          tabBarStyle: {
            height: barHeight, paddingTop: 8, paddingBottom: 6 + insets.bottom, borderTopWidth: 0, backgroundColor: colors.card,
            elevation: 12, shadowColor: '#2B3A2E', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: -2 },
          },
          sceneStyle: { backgroundColor: colors.canvas },
        }}
      >
        {TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{ title: tab.title, tabBarIcon: ({ color, focused }) => <TabIcon icon={tab.icon} color={color as string} focused={focused} /> }}
          />
        ))}
      </Tabs>
      <BuddyBubble bottom={barHeight + 14} onPress={() => router.push('/ai')} />
    </View>
  );
}
