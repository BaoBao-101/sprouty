import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SpeciesProfile as Profile } from '@/lib/types';
import { colors, fonts, radius } from '@/theme';
import { Icon, type IconName } from './Icon';
import { tap } from './ui';

/*
 * Who a plant is, as on the website (frontend/src/components/SpeciesProfile.tsx),
 * but told in tags and cards rather than paragraphs: the name and family as
 * tags, where it comes from in two words, the story's first sentence (the rest
 * a tap away), and the traits and "did you know" as cards swiped one at a
 * time. On the kit's page for the parent choosing it, and on the plant's page
 * for the child caring for it. The text comes with the species from the
 * server, so no kit has its own copy.
 */

/** The first sentence, and whether anything follows it. */
function firstSentence(text: string) {
  const m = text.match(/^.*?[.!?](\s|$)/);
  const head = (m ? m[0] : text).trim();
  return { head, more: head.length < text.trim().length };
}

/** "Nam Mỹ: vùng núi Andes (Peru…)" → "Nam Mỹ"; "Họ Cúc (Asteraceae)" → "Họ Cúc". */
const short = (text: string) => text.split(/[:(;,.]/)[0].trim() || text;

function Tile({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={s.tile}>
      <View style={s.tileIcon}><Icon name={icon} size={16} color={colors.greenDark} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.tileLabel}>{label}</Text>
        <Text numberOfLines={2} style={s.tileValue}>{value}</Text>
      </View>
    </View>
  );
}

/** A row of cards swiped sideways, one idea each. */
function Cards({ title, icon, items, warm }: { title: string; icon: IconName; items: string[]; warm?: boolean }) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 8 }}>
      <View style={s.headRow}>
        <Icon name={icon} size={16} color={warm ? colors.gold : colors.greenDark} />
        <Text style={[s.cardsTitle, warm && { color: colors.gold }]}>{title}</Text>
        <Text style={s.count}>{items.length}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={232 + 10} decelerationRate="fast"
        style={s.cardsOuter} contentContainerStyle={s.cards}>
        {items.map((t, i) => (
          <View key={t} style={[s.card, warm && s.cardWarm]}>
            <View style={[s.num, warm && { backgroundColor: '#F7DFAE' }]}><Text style={[s.numText, warm && { color: colors.gold }]}>{i + 1}</Text></View>
            <Text style={s.cardText}>{t}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** `title` off for a section that already names it. */
export function SpeciesProfile({ label, profile, title = true }: { label: string; profile: Profile; title?: boolean }) {
  const [open, setOpen] = useState(false);
  const story = firstSentence(profile.story);
  return (
    <View style={{ gap: 14 }} accessibilityLabel={`Hồ sơ giống ${label}`}>
      {title && (
        <View style={s.headRow}>
          <View style={s.icon}><Icon name="leaf" size={18} color={colors.greenDark} /></View>
          <Text style={s.title}>Hồ sơ giống · {label}</Text>
        </View>
      )}

      <View style={s.tags}>
        <View style={[s.tag, s.tagLatin]}><Text style={[s.tagText, { fontStyle: 'italic', color: colors.ink }]}>{profile.scientificName}</Text></View>
        <View style={s.tag}><Text style={s.tagText}>{short(profile.family)}</Text></View>
      </View>

      <View style={s.tiles}>
        <Tile icon="pin" label="Quê hương" value={short(profile.origin)} />
        {profile.otherNames.length > 0 && <Tile icon="chat" label="Còn gọi là" value={profile.otherNames.join(', ')} />}
      </View>

      <Pressable onPress={() => { if (story.more) { tap(); setOpen((v) => !v); } }} accessibilityRole="button" accessibilityState={{ expanded: open }}
        style={s.story}>
        <View style={s.headRow}>
          <Icon name="book" size={16} color={colors.earth} />
          <Text style={[s.cardsTitle, { color: colors.earth }]}>Câu chuyện</Text>
        </View>
        <Text style={s.storyText}>{open ? profile.story : story.head}</Text>
        {open && profile.origin.replace(/[.\s]+$/, '') !== short(profile.origin) ?<Text style={s.storyNote}>Quê hương: {profile.origin}</Text> : null}
        {story.more && <Text style={s.more}>{open ? 'Thu gọn' : 'Đọc tiếp'}</Text>}
      </Pressable>

      <Cards title="Đặc điểm" icon="search" items={profile.traits} />
      <Cards title="Bé có biết?" icon="star" items={profile.funFacts} warm />
    </View>
  );
}

const s = StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  title: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.mint },
  tagLatin: { backgroundColor: colors.sand },
  tagText: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.greenDark },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md, backgroundColor: colors.canvas },
  tileIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: fonts.body, fontSize: 11.5, color: colors.ink4 },
  tileValue: { fontFamily: fonts.bold, fontSize: 13.5, lineHeight: 18, color: colors.ink },
  story: { gap: 6, padding: 12, borderRadius: radius.md, backgroundColor: colors.earthSoft },
  storyText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink2 },
  storyNote: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 19, color: colors.ink3 },
  more: { fontFamily: fonts.bold, fontSize: 13, color: colors.earth },
  cardsTitle: { fontFamily: fonts.bold, fontSize: 14, color: colors.greenDark },
  count: { marginLeft: 'auto', fontFamily: fonts.semi, fontSize: 12, color: colors.ink4 },
  cardsOuter: { marginHorizontal: -4 },
  cards: { gap: 10, paddingHorizontal: 4, paddingBottom: 2 },
  card: { width: 232, gap: 8, padding: 12, borderRadius: radius.md, backgroundColor: colors.mint },
  cardWarm: { backgroundColor: colors.goldSoft },
  num: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#C9E6BE', alignItems: 'center', justifyContent: 'center' },
  numText: { fontFamily: fonts.bold, fontSize: 12, color: colors.greenDark },
  cardText: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, color: colors.ink },
});
