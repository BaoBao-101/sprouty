import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, fonts, gutter, maxWidth, radius } from '@/theme';
import { Icon, type IconName } from './Icon';

/*
 * The app's building blocks. Written for a parent with one hand free: every
 * tap target is at least 44pt, text starts at 15–16pt, actions sit at the
 * bottom within thumb reach. Flat cream cards with a hairline border.
 */

export const tap = () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
export const cheer = () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };

/** Body text. */
export function T({ children, style, muted, bold, numberOfLines, selectable }: {
  children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; bold?: boolean; numberOfLines?: number; selectable?: boolean;
}) {
  return (
    <Text selectable={selectable} numberOfLines={numberOfLines} style={[styles.text, muted && styles.muted, bold && styles.bold, style]}>
      {children}
    </Text>
  );
}

/** A heading, in the brand's rounded display face. */
export function H({ children, size = 22, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.heading, { fontSize: size, lineHeight: size * 1.28 }, style]}>{children}</Text>;
}

/** Back one screen, or to `fallback` when there is no history (opened from a notification). */
export function goBack(fallback = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

export function IconButton({ icon, onPress, label, badge, color = colors.ink2, boxed, flip }: {
  icon: IconName; onPress: () => void; label: string; badge?: number; color?: string; boxed?: boolean;
  /** Mirror the icon: the set has one arrow, pointing right; back points left. */
  flip?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => [styles.iconBtn, boxed && styles.iconBtnBoxed, pressed && { backgroundColor: colors.greenSoft }]}>
      <View style={flip ? { transform: [{ scaleX: -1 }] } : undefined}><Icon name={icon} size={22} color={color} /></View>
      {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
    </Pressable>
  );
}

/** The bar across the top: back, title, actions. `large` for a tab's own screen. */
export function Header({ title, back, actions, large }: { title?: string; back?: boolean | string; actions?: ReactNode; large?: boolean }) {
  return (
    <View style={styles.header}>
      {back ? <IconButton icon="arrow-right" flip label="Quay lại" onPress={() => goBack(typeof back === 'string' ? back : '/')} /> : null}
      <Text numberOfLines={1} style={[styles.headerTitle, large && styles.headerLarge, !back && { marginLeft: 4 }]}>{title}</Text>
      <View style={styles.headerActions}>{actions}</View>
    </View>
  );
}

/**
 * One screen: the header and a scrolling body, pull-to-refresh when given
 * `onRefresh`. `bar` leaves room at the bottom for an ActionBar.
 */
export function Screen({ title, back, actions, large, children, onRefresh, bar, scroll = true, scrollEnabled = true, padded = true, header }: {
  title?: string; back?: boolean | string; actions?: ReactNode; large?: boolean; children: ReactNode;
  onRefresh?: () => Promise<unknown> | void; bar?: boolean; scroll?: boolean; padded?: boolean; header?: ReactNode;
  /** False while something on the page is being dragged. */
  scrollEnabled?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = onRefresh ? async () => {
    if (!scrollEnabled) return;
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  } : undefined;

  const body = (
    <View style={[styles.content, padded && styles.padded, { paddingBottom: (bar ? 96 : 24) + (bar ? insets.bottom : 0) }]}>
      {children}
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header ?? <Header title={title} back={back} actions={actions} large={large} />}
      {scroll ? (
        <ScrollView
          scrollEnabled={scrollEnabled}
          bounces={scrollEnabled}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.scroll}
          refreshControl={refresh ? <RefreshControl enabled={scrollEnabled} refreshing={refreshing} onRefresh={refresh} tintColor={colors.green} colors={[colors.green]} /> : undefined}
        >
          {body}
        </ScrollView>
      ) : body}
    </View>
  );
}

/** Pinned to the bottom of a screen, above the home indicator. */
export function ActionBar({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.actionBar, { paddingBottom: 10 + insets.bottom }]}>
      <View style={styles.actionBarIn}>{children}</View>
    </View>
  );
}

type ButtonVariant = 'primary' | 'soft' | 'ghost' | 'danger';

export function Button({ title, onPress, variant = 'primary', icon, disabled, busy, small, grow, block, style }: {
  title: string; onPress?: () => void; variant?: ButtonVariant; icon?: IconName; disabled?: boolean; busy?: boolean;
  small?: boolean; grow?: boolean; block?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const fg = variant === 'primary' || variant === 'danger' ? colors.white : variant === 'soft' ? colors.greenDark : colors.ink2;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={() => { tap(); onPress?.(); }}
      style={({ pressed }) => [
        styles.button, styles[variant], small && styles.buttonSmall, grow && { flex: 1 }, block && { alignSelf: 'stretch' },
        (disabled || busy) && { opacity: 0.55 }, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }, style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon && icon !== 'arrow-right' ? <Icon name={icon} size={small ? 17 : 19} color={fg} /> : null}
      <Text numberOfLines={1} style={[styles.buttonText, small && { fontSize: 14 }, { color: fg }]}>{title}</Text>
      {/* "Go on" reads left to right: the arrow follows the words. */}
      {!busy && icon === 'arrow-right' ? <Icon name={icon} size={small ? 17 : 19} color={fg} /> : null}
    </Pressable>
  );
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'warn' | 'danger' | 'soft' }) {
  return <View style={[styles.card, tone === 'warn' && styles.cardWarn, tone === 'danger' && styles.cardDanger, tone === 'soft' && styles.cardSoft, style]}>{children}</View>;
}

export function CardTitle({ icon, children, right }: { icon?: IconName; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      {icon && <Icon name={icon} size={19} color={colors.green} />}
      <Text style={styles.cardTitle}>{children}</Text>
      {right ? <View style={{ marginLeft: 'auto' }}>{right}</View> : null}
    </View>
  );
}

/** A status pill: "Chờ thanh toán", "Đã huỷ"… */
export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'good' | 'warn' | 'bad' | 'info' | 'neutral' }) {
  const palette = {
    good: [colors.greenSoft, colors.greenDark], warn: [colors.warnSoft, colors.warn], bad: [colors.badSoft, colors.bad],
    info: [colors.infoSoft, colors.info], neutral: ['#EEF0EA', colors.ink3],
  }[tone];
  return <View style={[styles.pill, { backgroundColor: palette[0] }]}><Text style={[styles.pillText, { color: palette[1] }]}>{children}</Text></View>;
}

/** A choice chip in a row of filters. */
export function Chip({ label, on, onPress, icon }: { label: string; on?: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      {icon && <Icon name={icon} size={16} color={on ? colors.white : colors.green} />}
      <Text style={[styles.chipText, on && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionHead({ title, more, onMore }: { title: string; more?: string; onMore?: () => void }) {
  return (
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      <H size={20}>{title}</H>
      {onMore && (
        <Pressable onPress={onMore} hitSlop={8} style={styles.row}>
          <Text style={styles.link}>{more || 'Xem tất cả'}</Text>
          <Icon name="arrow-right" size={15} color={colors.green} />
        </Pressable>
      )}
    </View>
  );
}

/** Nothing to show: a picture, a sentence, the one thing to do about it. */
export function Empty({ art, icon, title, text, children }: {
  /** A bundled picture, or a drawing (a PlantArt). */
  art?: number | ReactNode; icon?: IconName; title: string; text?: string; children?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {typeof art === 'number' ? <Image source={art} style={{ width: 112, height: 112 }} contentFit="contain" />
        : art ? art
        : <View style={styles.emptyIcon}><Icon name={icon || 'sprout'} size={34} color={colors.greenDark} /></View>}
      <H size={20} style={{ textAlign: 'center' }}>{title}</H>
      {text && <T muted style={{ textAlign: 'center', maxWidth: 320 }}>{text}</T>}
      {children && <View style={{ gap: 10, marginTop: 6, alignSelf: 'stretch', alignItems: 'center' }}>{children}</View>}
    </View>
  );
}

export function Loading({ label = 'Đang tải…' }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.green} />
      <T muted>{label}</T>
    </View>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card tone="danger" style={styles.row}>
      <Icon name="warning" size={20} color={colors.bad} />
      <T style={{ flex: 1, color: colors.bad }}>{message}</T>
      {onRetry && <Button small variant="ghost" title="Thử lại" onPress={onRetry} />}
    </Card>
  );
}

/** A labelled text box, with its error under it. */
export function Field({ label, error, hint, style, ...input }: TextInputProps & { label: string; error?: string; hint?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.ink5} {...input} style={[styles.input, input.multiline && { minHeight: 84, textAlignVertical: 'top', paddingTop: 12 }, error ? { borderColor: colors.bad } : null, style]} />
      {hint && !error ? <T muted style={{ fontSize: 13 }}>{hint}</T> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99, label, unit = '' }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; label: string; unit?: string;
}) {
  return (
    <View style={styles.stepper} accessibilityLabel={label}>
      <Pressable onPress={() => { tap(); onChange(value - 1); }} disabled={value <= min} style={styles.stepBtn} accessibilityLabel="Bớt một">
        <Icon name="minus" size={18} color={value <= min ? colors.ink5 : colors.greenDark} />
      </Pressable>
      <Text style={styles.stepValue}>{value}{unit}</Text>
      <Pressable onPress={() => { tap(); onChange(value + 1); }} disabled={value >= max} style={styles.stepBtn} accessibilityLabel="Thêm một">
        <Icon name="add" size={18} color={value >= max ? colors.ink5 : colors.greenDark} />
      </Pressable>
    </View>
  );
}

/** A panel that slides up from the bottom — the phone's dialog. Closes with ✕, the back button, or a tap outside. */
export function Sheet({ open, title, onClose, children, footer }: {
  open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Đóng" />
        <View style={[styles.sheet, { maxHeight: '88%', paddingBottom: footer ? 0 : insets.bottom }]}>
          <View style={styles.handle} />
          <View style={[styles.row, { paddingHorizontal: 20, paddingBottom: 6 }]}>
            <H size={20} style={{ flex: 1 }}>{title}</H>
            <IconButton icon="close" label="Đóng" onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 14 }}>
            {children}
          </ScrollView>
          {footer && <View style={[styles.sheetFoot, { paddingBottom: 12 + insets.bottom }]}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Row({ children, style, wrap }: { children: ReactNode; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[styles.row, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.cream },
  scroll: { flexGrow: 1 },
  content: { width: '100%', maxWidth, alignSelf: 'center', gap: 16 },
  padded: { paddingHorizontal: gutter, paddingTop: 8 },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink2 },
  muted: { color: colors.ink3, fontSize: 14 },
  bold: { fontFamily: fonts.bold, color: colors.ink },
  heading: { fontFamily: fonts.display, color: colors.ink },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 2, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.cream, width: '100%', maxWidth: maxWidth + 32, alignSelf: 'center' },
  headerTitle: { flex: 1, fontFamily: fonts.display, fontSize: 19, color: colors.ink, marginHorizontal: 4 },
  headerLarge: { fontSize: 25, marginLeft: 8 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconBtnBoxed: { width: 50, height: 50, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card },
  badge: { position: 'absolute', top: 3, right: 1, minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.cream },
  badgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10.5 },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 10, paddingHorizontal: gutter, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.line },
  actionBarIn: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth, alignSelf: 'center' },
  button: { minHeight: 50, paddingHorizontal: 20, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: 'transparent' },
  buttonSmall: { minHeight: 42, paddingHorizontal: 14 },
  buttonText: { fontFamily: fonts.bold, fontSize: 15.5 },
  primary: { backgroundColor: colors.green },
  soft: { backgroundColor: colors.greenSoft },
  ghost: { backgroundColor: colors.card, borderColor: colors.line },
  danger: { backgroundColor: colors.bad },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 12 },
  cardWarn: { backgroundColor: colors.warnSoft, borderColor: '#F6DDB0' },
  cardDanger: { backgroundColor: colors.badSoft, borderColor: '#F5C9CF' },
  cardSoft: { backgroundColor: colors.greenSoft, borderColor: '#D5EDCF' },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  pillText: { fontFamily: fonts.bold, fontSize: 12 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipOn: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink2 },
  link: { fontFamily: fonts.bold, fontSize: 14, color: colors.green },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 12 },
  emptyIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  label: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink2 },
  input: { minHeight: 50, borderWidth: 1.5, borderColor: '#CFE9C9', borderRadius: radius.sm, backgroundColor: colors.card, paddingHorizontal: 14, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  error: { fontFamily: fonts.semi, fontSize: 13.5, color: colors.bad },
  stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.pill, backgroundColor: colors.card, alignSelf: 'flex-start' },
  stepBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 34, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32,52,36,0.42)' },
  sheet: { backgroundColor: colors.cream, borderTopLeftRadius: 24, borderTopRightRadius: 24, width: '100%', maxWidth: 640, alignSelf: 'center' },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#D5DACF', alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  sheetFoot: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.card },
});
