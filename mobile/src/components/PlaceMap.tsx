import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, fonts, radius, surface } from '@/theme';
import { Icon } from './Icon';

/** Google Maps searching a place: the app when it is installed, the browser otherwise. */
export function openMaps(place: string) {
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}`).catch(() => {});
}

/** What a workshop's map looks up: its street address, else the venue name. */
export function placeOf(w: { location: string; address?: string | null }) {
  return w.address?.trim() || w.location;
}

/**
 * Google's keyless embed refuses to draw unless it sits in an iframe ("The
 * Google Maps Embed API must be used in an iframe"), so the map is a page of
 * one iframe rather than the embed address itself.
 */
const mapPage = (query: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:${colors.mint}}iframe{border:0;width:100%;height:100%}</style></head>
<body><iframe src="https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=vi&z=16&output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></body></html>`;

/**
 * A place on a small map, and the whole card a button to Google Maps. The
 * frame takes no touches (pointerEvents none), so a tap anywhere opens
 * directions rather than panning a small box inside a scrolling sheet.
 */
export function PlaceMap({ name, address }: { name: string; address?: string | null }) {
  const query = address?.trim() || name;
  return (
    <Pressable
      onPress={() => openMaps(query)}
      accessibilityRole="link"
      accessibilityLabel={`Mở ${name} trên Google Maps`}
      style={({ pressed }) => [s.card, pressed && { opacity: 0.9 }]}
    >
      <View style={s.frame} pointerEvents="none">
        <WebView source={{ html: mapPage(query), baseUrl: 'https://www.google.com' }} style={s.web} scrollEnabled={false} originWhitelist={['*']} />
      </View>
      <View style={s.bar}>
        <View style={s.pin}><Icon name="pin" size={17} color={colors.greenDark} /></View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text numberOfLines={1} style={s.name}>{name}</Text>
          {address?.trim() && address.trim() !== name ? <Text numberOfLines={2} style={s.address}>{address.trim()}</Text> : null}
        </View>
        <View style={s.go}>
          <Text style={s.goText}>Chỉ đường</Text>
          <Icon name="arrow-right" size={13} color={colors.white} />
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { ...surface, overflow: 'hidden' },
  frame: { height: 128, backgroundColor: colors.mint },
  web: { flex: 1, backgroundColor: colors.mint },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  pin: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  name: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  address: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.ink3 },
  go: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.green },
  goText: { fontFamily: fonts.bold, fontSize: 12.5, color: colors.white },
});
