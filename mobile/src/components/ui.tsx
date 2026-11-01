import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { colors, fonts, gutter, maxWidth, radius, shadow, surface } from '@/theme';
import { Icon, type IconName } from './Icon';

/*
 * The app's building blocks. Written for a parent with one hand free: every
 * tap target is at least 44pt, text starts at 15–16pt, actions sit at the
 * bottom within thumb reach. White cards rest on a linen canvas with a soft
 * shadow; whatever can be tapped gives a little under the finger.
 */

export const tap = () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); };
export const cheer = () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); };

const APressable = Animated.createAnimatedComponent(Pressable);

/**
 * Anything tappable that is bigger than an icon: it sinks a little while
 * pressed and springs back, so a card feels like a thing, not a picture.
 */
export function Press({ style, children, onPress, scaleTo = 0.97, haptic = true, ...rest }: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>; children: ReactNode; scaleTo?: number; haptic?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (value: number) => Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: 7 }).start();
  return (
    <APressable
      accessibilityRole="button"
      {...rest}
      onPressIn={(e) => { to(scaleTo); rest.onPressIn?.(e); }}
      onPressOut={(e) => { to(1); rest.onPressOut?.(e); }}
      onPress={onPress ? (e) => { if (haptic) tap(); onPress(e); } : undefined}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </APressable>
  );
}

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
export function H({ children, size = 22, style, numberOfLines }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return <Text numberOfLines={numberOfLines} style={[styles.heading, { fontSize: size, lineHeight: Math.round(size * 1.28) }, style]}>{children}</Text>;
}

/** A small capital label over a group: "ĐANG CHỜ BẠN". */
export function Label({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

/** Back one screen, or to `fallback` when there is no history (opened from a notification). */
export function goBack(fallback = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

/**
 * A round icon button. Plain in a header; `boxed` gives it a white disc of its
 * own, for when it sits on a photo or beside a search box.
 */
export function IconButton({ icon, onPress, label, badge, color = colors.ink2, boxed, flip, size = 22 }: {
  icon: IconName; onPress: () => void; label: string; badge?: number; color?: string; boxed?: boolean;
  /** Mirror the icon: the set has one arrow, pointing right; back points left. */
  flip?: boolean; size?: number;
}) {
  return (
    <Press onPress={onPress} accessibilityLabel={label} hitSlop={6} scaleTo={0.9}
      style={[styles.iconBtn, boxed && styles.iconBtnBoxed]}>
      <View style={flip ? { transform: [{ scaleX: -1 }] } : undefined}><Icon name={icon} size={size} color={color} /></View>
      {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
    </Press>
  );
}

/** The bar across the top: back, title, actions. `large` for a tab's own screen. */
export function Header({ title, back, actions, large }: { title?: string; back?: boolean | string; actions?: ReactNode; large?: boolean }) {
  return (
    <View style={[styles.header, large && styles.headerTall]}>
      {back ? <IconButton icon="arrow-right" flip boxed size={20} label="Quay lại" onPress={() => goBack(typeof back === 'string' ? back : '/')} /> : null}
      <Text numberOfLines={1} style={[styles.headerTitle, large && styles.headerLarge, !back && { marginLeft: 8 }]}>{title}</Text>
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
    <View style={[styles.content, padded && styles.padded, { paddingBottom: (bar ? 104 : 32) + (bar ? insets.bottom : 0) }]}>
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
    <View style={[styles.actionBar, { paddingBottom: 12 + insets.bottom }]}>
      <View style={styles.actionBarIn}>{children}</View>
    </View>
  );
}

type ButtonVariant = 'primary' | 'soft' | 'ghost' | 'danger' | 'light';

export function Button({ title, onPress, variant = 'primary', icon, disabled, busy, small, grow, block, style }: {
  title: string; onPress?: () => void; variant?: ButtonVariant; icon?: IconName; disabled?: boolean; busy?: boolean;
  small?: boolean; grow?: boolean; block?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const fg = variant === 'primary' || variant === 'danger' ? colors.white
    : variant === 'soft' ? colors.greenDark
    : variant === 'light' ? colors.forest
    : colors.ink2;
  const off = disabled || busy;
  return (
    <Press
      disabled={off}
      onPress={onPress}
      scaleTo={0.96}
      style={[
        styles.button, styles[variant], small && styles.buttonSmall, grow && { flex: 1 }, block && { alignSelf: 'stretch' },
        off && styles.buttonOff, style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : icon && icon !== 'arrow-right' ? <Icon name={icon} size={small ? 17 : 19} color={fg} /> : null}
      <Text numberOfLines={1} style={[styles.buttonText, small && styles.buttonTextSmall, { color: fg }]}>{title}</Text>
      {/* "Go on" reads left to right: the arrow follows the words. */}
      {!busy && icon === 'arrow-right' ? <Icon name={icon} size={small ? 16 : 18} color={fg} /> : null}
    </Press>
  );
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'warn' | 'danger' | 'soft' }) {
  return <View style={[styles.card, tone === 'warn' && styles.cardWarn, tone === 'danger' && styles.cardDanger, tone === 'soft' && styles.cardSoft, style]}>{children}</View>;
}

/** An icon on a tinted rounded square: the face of a row, a shortcut or a card. */
export function IconTile({ icon, size = 44, tint = colors.mint, color = colors.greenDark, round }: {
  icon: IconName; size?: number; tint?: string; color?: string; round?: boolean;
}) {
  return (
    <View style={{ width: size, height: size, borderRadius: round ? size / 2 : Math.round(size * 0.34), backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={Math.round(size * 0.5)} color={color} />
    </View>
  );
}

export function CardTitle({ icon, children, right }: { icon?: IconName; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      {icon && <IconTile icon={icon} size={34} />}
      <Text style={styles.cardTitle}>{children}</Text>
      {right ? <View style={{ marginLeft: 'auto' }}>{right}</View> : null}
    </View>
  );
}

const PILL_TONES = {
  good: [colors.mint, colors.greenDark], warn: [colors.warnSoft, colors.warn], bad: [colors.badSoft, colors.bad],
  info: [colors.infoSoft, colors.info], neutral: [colors.sand, colors.ink3], gold: [colors.goldSoft, colors.gold],
} as const;
export type Tone = keyof typeof PILL_TONES;

/** A status pill: "Chờ thanh toán", "Đã huỷ"… */
export function Pill({ children, tone = 'neutral', icon }: { children: ReactNode; tone?: Tone; icon?: IconName }) {
  const [bg, fg] = PILL_TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon && <Icon name={icon} size={12} color={fg} />}
      <Text numberOfLines={1} style={[styles.pillText, { color: fg }]}>{children}</Text>
    </View>
  );
}

/** A choice chip in a row of filters. */
export function Chip({ label, on, onPress, icon, count }: { label: string; on?: boolean; onPress: () => void; icon?: IconName; count?: number }) {
  return (
    <Press onPress={onPress} scaleTo={0.94} accessibilityState={{ selected: on }} style={[styles.chip, on && styles.chipOn]}>
      {icon && <Icon name={icon} size={16} color={on ? colors.white : colors.green} />}
      <Text style={[styles.chipText, on && { color: colors.white }]}>{label}</Text>
      {count != null && (
        <View style={[styles.chipCount, on && { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
          <Text style={[styles.chipCountText, on && { color: colors.white }]}>{count}</Text>
        </View>
      )}
    </Press>
  );
}

/** A row of chips that scrolls sideways, bleeding to the screen's edges. */
export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsOuter} contentContainerStyle={styles.chips}>
      {children}
    </ScrollView>
  );
}

/** Two or three views of one screen, as a sliding switch. */
export function Segmented<K extends string>({ items, value, onChange }: {
  items: Array<{ key: K; label: string; icon?: IconName; dot?: boolean }>; value: K; onChange: (key: K) => void;
}) {
  return (
    <View style={styles.segment} accessibilityRole="tablist">
      {items.map((item) => {
        const on = item.key === value;
        return (
          <Pressable key={item.key} onPress={() => { if (!on) { tap(); onChange(item.key); } }} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[styles.segBtn, on && styles.segOn]}>
            {item.icon && <Icon name={item.icon} size={16} color={on ? colors.greenDark : colors.ink4} />}
            <Text numberOfLines={1} style={[styles.segText, on && styles.segTextOn]}>{item.label}</Text>
            {item.dot && !on ? <View style={styles.segDot} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionHead({ title, more, onMore, style }: { title: string; more?: string; onMore?: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.row, { justifyContent: 'space-between', minHeight: 40 }, style]}>
      <H size={20} style={{ flexShrink: 1 }}>{title}</H>
      {onMore && (
        <Press onPress={onMore} hitSlop={8} scaleTo={0.94} style={styles.more}>
          <Text style={styles.moreText}>{more || 'Xem tất cả'}</Text>
          <Icon name="arrow-right" size={14} color={colors.greenDark} />
        </Press>
      )}
    </View>
  );
}

/** A white panel whose rows carry their own dividers. */
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.group, style]}>
      <View style={styles.groupIn}>{children}</View>
    </View>
  );
}

/** One row in a Group: something on the left, the words, then what is on the right (a chevron by default). */
export function ListRow({ lead, icon, tint, iconColor, title, sub, extra, right, onPress, last, tone, titleStyle }: {
  lead?: ReactNode; icon?: IconName; tint?: string; iconColor?: string; title: string; sub?: string; extra?: ReactNode;
  right?: ReactNode; onPress?: () => void; last?: boolean; tone?: 'warn' | 'bad'; titleStyle?: StyleProp<TextStyle>;
}) {
  const content = (
    <>
      {lead ?? (icon ? <IconTile icon={icon} size={40} tint={tint} color={iconColor} /> : null)}
      <View style={[styles.listBody, !last && styles.divider]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={[styles.listTitle, titleStyle]}>{title}</Text>
          {sub ? <Text numberOfLines={2} style={styles.listSub}>{sub}</Text> : null}
          {extra}
        </View>
        {right ?? (onPress ? <Icon name="arrow-right" size={16} color={colors.ink5} /> : null)}
      </View>
    </>
  );
  const rowStyle = [styles.listRow, tone === 'warn' && { backgroundColor: colors.warnSoft }, tone === 'bad' && { backgroundColor: colors.badSoft }];
  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button"
      style={({ pressed }) => [...rowStyle, pressed && { backgroundColor: colors.canvas }]}>
      {content}
    </Pressable>
  );
}

/** Where a parent is in a short flow: numbered dots on a line, the ones done ticked. */
export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <View style={styles.steps} accessibilityLabel={`Bước ${current + 1} trên ${steps.length}: ${steps[current]}`}>
      {steps.map((label, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <View key={label} style={styles.step}>
            {i > 0 && <View style={[styles.stepLine, (done || now) && { backgroundColor: colors.green }]} />}
            <View style={[styles.stepDot, done && styles.stepDone, now && styles.stepNow]}>
              {done ? <Icon name="check" size={14} color={colors.white} /> : <Text style={[styles.stepNum, now && { color: colors.white }]}>{i + 1}</Text>}
            </View>
            <Text numberOfLines={1} style={[styles.stepLabel, (done || now) && { color: colors.ink }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** A slim bar filled to `value` percent. */
export function Meter({ value, color = colors.green, track = colors.sand, height = 6, style }: {
  value: number; color?: string; track?: string; height?: number; style?: StyleProp<ViewStyle>;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View style={[{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }, style]}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** A ring filled to `value` percent, with whatever is given in its middle. */
export function Ring({ value, size = 56, stroke = 5, color = colors.green, track = colors.sand, children }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value)) / 100;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
}

/** A number with its icon and a word under it: "7 · đang lớn". */
export function Stat({ icon, value, label, color = colors.greenDark, tint = colors.mint, style }: {
  icon: IconName; value: ReactNode; label: string; color?: string; tint?: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.stat, style]}>
      <IconTile icon={icon} size={34} tint={tint} color={color} round />
      <View style={{ flexShrink: 1 }}>
        <Text numberOfLines={1} style={[styles.statValue, { color }]}>{value}</Text>
        <Text numberOfLines={1} style={styles.statLabel}>{label}</Text>
      </View>
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
      {typeof art === 'number' ? <View style={styles.emptyArt}><Image source={art} style={{ width: 92, height: 92 }} contentFit="contain" /></View>
        : art ? art
        : <View style={styles.emptyIcon}><Icon name={icon || 'sprout'} size={36} color={colors.greenDark} /></View>}
      <H size={20} style={{ textAlign: 'center' }}>{title}</H>
      {text && <T muted style={{ textAlign: 'center', maxWidth: 320 }}>{text}</T>}
      {children && <View style={{ gap: 10, marginTop: 8, alignSelf: 'stretch', alignItems: 'center' }}>{children}</View>}
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

/** A labelled text box, with its error under it. The box lights up green while typing in it. */
export function Field({ label, error, hint, style, ...input }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.ink5} {...input}
        onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
        style={[styles.input, input.multiline && { minHeight: 92, textAlignVertical: 'top', paddingTop: 13 }, focused && styles.inputFocus, error ? { borderColor: colors.bad } : null, style]} />
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
        <View style={[styles.sheet, { maxHeight: '90%', paddingBottom: footer ? 0 : insets.bottom }]}>
          <View style={styles.handle} />
          <View style={[styles.row, { paddingLeft: 20, paddingRight: 12, paddingBottom: 8 }]}>
            <H size={21} style={{ flex: 1 }}>{title}</H>
            <IconButton icon="close" label="Đóng" boxed size={18} onPress={onClose} />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24, gap: 14 }}>
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
  screen: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1 },
  content: { width: '100%', maxWidth, alignSelf: 'center', gap: 18 },
  padded: { paddingHorizontal: gutter, paddingTop: 6 },
  text: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: colors.ink2 },
  muted: { color: colors.ink3, fontSize: 14 },
  bold: { fontFamily: fonts.bold, color: colors.ink },
  heading: { fontFamily: fonts.display, color: colors.ink },
  label: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.9, textTransform: 'uppercase', color: colors.ink4, marginLeft: 4 },
  header: { height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 6, backgroundColor: colors.canvas, width: '100%', maxWidth: maxWidth + 32, alignSelf: 'center' },
  headerTall: { height: 64 },
  headerTitle: { flex: 1, fontFamily: fonts.display, fontSize: 20, lineHeight: 26, color: colors.ink, marginHorizontal: 4 },
  headerLarge: { fontSize: 29, lineHeight: 37 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  iconBtnBoxed: { backgroundColor: colors.card, ...shadow.sm },
  badge: { position: 'absolute', top: 2, right: 0, minWidth: 19, height: 19, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  badgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 10.5 },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: 12, paddingHorizontal: gutter, backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, ...shadow.md },
  actionBarIn: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', maxWidth, alignSelf: 'center' },
  button: { minHeight: 52, paddingHorizontal: 22, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buttonSmall: { minHeight: 42, paddingHorizontal: 16 },
  buttonOff: { opacity: 0.5 },
  buttonText: { fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21 },
  buttonTextSmall: { fontSize: 14, lineHeight: 19 },
  primary: { backgroundColor: colors.green, shadowColor: colors.greenDark, shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  soft: { backgroundColor: colors.mint },
  ghost: { backgroundColor: colors.card, ...shadow.sm },
  light: { backgroundColor: colors.white },
  danger: { backgroundColor: colors.bad },
  card: { ...surface, padding: 16, gap: 12 },
  cardWarn: { backgroundColor: colors.warnSoft, shadowOpacity: 0, elevation: 0 },
  cardDanger: { backgroundColor: colors.badSoft, shadowOpacity: 0, elevation: 0 },
  cardSoft: { backgroundColor: colors.mint, shadowOpacity: 0, elevation: 0 },
  cardTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.ink, flexShrink: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start', maxWidth: '100%' },
  pillText: { fontFamily: fonts.bold, fontSize: 12, flexShrink: 1 },
  chip: { minHeight: 40, paddingHorizontal: 15, borderRadius: radius.pill, backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(32,52,36,0.06)', flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipOn: { backgroundColor: colors.green, borderColor: colors.green },
  chipText: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink2 },
  chipCount: { minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  chipCountText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.ink3 },
  chipsOuter: { marginHorizontal: -gutter, flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: gutter, paddingVertical: 2 },
  segment: { flexDirection: 'row', padding: 4, gap: 4, borderRadius: radius.pill, backgroundColor: colors.sand },
  segBtn: { flex: 1, minHeight: 42, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6 },
  segOn: { backgroundColor: colors.card, ...shadow.sm },
  segText: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink3 },
  segTextOn: { color: colors.greenDark },
  segDot: { position: 'absolute', top: 9, right: 12, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.orange },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 34, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.mint },
  moreText: { fontFamily: fonts.bold, fontSize: 13, color: colors.greenDark },
  group: { ...surface },
  groupIn: { borderRadius: radius.lg, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 14 },
  listBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 14, paddingVertical: 13, minHeight: 60 },
  listTitle: { fontFamily: fonts.semi, fontSize: 15, lineHeight: 20, color: colors.ink },
  listSub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink3 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  steps: { flexDirection: 'row', paddingVertical: 4 },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepLine: { position: 'absolute', top: 14, right: '50%', width: '100%', height: 2, borderRadius: 1, backgroundColor: colors.sand },
  stepDot: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.sand, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.canvas },
  stepDone: { backgroundColor: colors.green },
  stepNow: { backgroundColor: colors.forest },
  stepNum: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink4 },
  stepLabel: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.ink4 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statValue: { fontFamily: fonts.display, fontSize: 19, lineHeight: 23 },
  statLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink3 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 12 },
  emptyArt: { width: 132, height: 132, borderRadius: 66, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  loading: { alignItems: 'center', gap: 10, paddingVertical: 40 },
  fieldLabel: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink2, marginLeft: 2 },
  input: { minHeight: 52, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.card, paddingHorizontal: 16, fontFamily: fonts.body, fontSize: 16, color: colors.ink },
  inputFocus: { borderColor: colors.green, backgroundColor: colors.white },
  error: { fontFamily: fonts.semi, fontSize: 13.5, color: colors.bad, marginLeft: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, backgroundColor: colors.sand, alignSelf: 'flex-start', padding: 2 },
  stepBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  stepValue: { minWidth: 36, textAlign: 'center', fontFamily: fonts.bold, fontSize: 16, color: colors.ink },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(24,40,28,0.45)' },
  sheet: { backgroundColor: colors.canvas, borderTopLeftRadius: 28, borderTopRightRadius: 28, width: '100%', maxWidth: 640, alignSelf: 'center' },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: '#D6D0C2', alignSelf: 'center', marginTop: 10, marginBottom: 6 },
  sheetFoot: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.card, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
