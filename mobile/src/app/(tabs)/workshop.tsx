import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Icon, type IconName } from '@/components/Icon';
import { PayPanel } from '@/components/PayPanel';
import { openMaps, placeOf, PlaceMap } from '@/components/PlaceMap';
import { ReviewSheet, type ReviewTarget } from '@/components/ReviewSheet';
import { score as scoreText, Stars, TicketQr } from '@/components/shop';
import { useToast } from '@/components/Toast';
import {
  Button, Card, Chip, ChipRow, cheer, Empty, ErrorNote, Field, Group, H, Label, Loading, Pill, Press, Screen, Segmented, Sheet, Stepper, T, tap,
  type Tone,
} from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatPrice, formatWorkshopWhen, workshopDateParts } from '@/lib/format';
import { syncWorkshopReminders } from '@/lib/reminders';
import type { MyWorkshopRegistration, OwnReview, PublicWorkshop, RewardSummary, ReviewOptions, Transfer } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, radius, shadow, surface } from '@/theme';

const AGES = ['3–4 tuổi', '4–5 tuổi', '6–7 tuổi', '8–9 tuổi', '10–12 tuổi'];

/** What happens in a session, in order, left to right. */
const STEPS: Array<{ icon: IconName; title: string }> = [
  { icon: 'sparkle', title: 'Vẽ chậu' },
  { icon: 'seed', title: 'Gieo hạt' },
  { icon: 'sprout', title: 'Kích hoạt cây' },
  { icon: 'pot', title: 'Mang về nhà' },
];

const sessionCancelled = (r: MyWorkshopRegistration) => r.workshop.status === 'cancelled';

function bookingState(r: MyWorkshopRegistration): { label: string; tone: Tone } {
  if (r.status === 'cancelled') return { label: 'Đã huỷ', tone: 'neutral' };
  if (sessionCancelled(r)) return { label: 'Sprouty huỷ buổi', tone: 'bad' };
  if (r.checkedInAt) return { label: 'Đã tham gia', tone: 'info' };
  if (!r.upcoming) return { label: 'Đã diễn ra', tone: 'neutral' };
  if (r.amount === 0) return { label: 'Đã giữ chỗ', tone: 'good' };
  if (r.paidAt) return { label: 'Đã thanh toán', tone: 'good' };
  return { label: 'Chưa thanh toán', tone: 'warn' };
}

/** A radio card: an icon, a title and a short line under it. */
function Choice({ on, onPress, icon, title, hint, hintTone }: { on: boolean; onPress: () => void; icon: IconName; title: string; hint: string; hintTone?: 'warn' }) {
  return (
    <Pressable onPress={() => { tap(); onPress(); }} style={[s.choice, on && s.choiceOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
      <View style={[s.choiceIcon, on && { backgroundColor: colors.green }]}><Icon name={icon} size={18} color={on ? colors.white : colors.greenDark} /></View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={s.choiceTitle}>{title}</Text>
        <Text style={[s.choiceHint, hintTone === 'warn' && { color: colors.warn }]}>{hint}</Text>
      </View>
      <View style={[s.radio, on && s.radioOn]}>{on && <View style={s.radioDot} />}</View>
    </Pressable>
  );
}

/** Booking one session: who, how many children, how to pay. The transfer follows in the same sheet. */
function BookingSheet({ workshop, rewards, onClose, onBooked }: {
  workshop: PublicWorkshop | null; rewards: RewardSummary | null; onClose: () => void; onBooked: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [childAge, setChildAge] = useState('');
  const [seats, setSeats] = useState(1);
  const [useRewards, setUseRewards] = useState(0);
  const [payMethod, setPayMethod] = useState<'online' | 'onsite'>('online');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ payment: Transfer | null; rewardUsed: boolean } | null>(null);

  useEffect(() => {
    if (!workshop) return;
    setName(user?.name || '');
    setEmail(user?.email || '');
    setChildAge('');
    setSeats(1);
    setPayMethod('online');
    setNote('');
    setError('');
    setBusy(false);
    setDone(null);
    // The phone from the last checkout on this phone, so it is not typed twice.
    AsyncStorage.getItem(`sprouty.checkout.contact.${user?.id ?? 'guest'}`)
      .then((raw) => setPhone(raw ? JSON.parse(raw).phone || '' : ''))
      .catch(() => setPhone(''));
  }, [workshop, user]);

  const freeSeats = rewards?.availableCount ?? 0;
  const maxRewards = workshop && workshop.price > 0 ? Math.min(freeSeats, seats) : 0;
  const usedRewards = Math.min(useRewards, maxRewards);
  useEffect(() => { setUseRewards(Math.min(freeSeats, 1)); }, [workshop, freeSeats]);
  const total = workshop ? workshop.price * (seats - usedRewards) : 0;

  async function submit() {
    if (!workshop) return;
    setError('');
    if (name.trim().length < 2) return setError('Nhập họ tên phụ huynh.');
    const cleanPhone = phone.replace(/\s/g, '');
    if (!/^0\d{8,10}$/.test(cleanPhone)) return setError('Số điện thoại chưa đúng (VD: 0909000000).');
    if (email && !/\S+@\S+\.\S+/.test(email)) return setError('Email chưa đúng định dạng.');
    if (seats > workshop.seatsLeft) return setError(`Chỉ còn ${workshop.seatsLeft} chỗ cho buổi này.`);
    setBusy(true);
    try {
      const res = await API.workshops.register({
        workshopId: workshop.id, guestName: name.trim(), guestPhone: cleanPhone, guestEmail: email.trim(),
        childAge, childCount: seats, note: note.trim(), paymentMethod: total > 0 ? payMethod : 'online', rewardCount: usedRewards,
      });
      cheer();
      setDone({ payment: res.payment ?? null, rewardUsed: Boolean(res.rewardApplied) });
      onBooked();
    } catch (err: any) {
      setError(err?.message || 'Không đăng ký được. Vui lòng thử lại.');
    } finally {
      setBusy(false);
    }
  }

  if (!workshop) return <Sheet open={false} title="" onClose={onClose}><View /></Sheet>;

  if (done) {
    return (
      <Sheet open title={done.payment ? 'Chuyển khoản để giữ chỗ' : 'Đã ghi nhận đăng ký!'} onClose={onClose}
        footer={<Button title={done.payment ? 'Xem vé của tôi' : 'Xong'} onPress={() => { onClose(); router.setParams({ tab: 'tickets' }); }} />}>
        {!done.payment && (
          <View style={s.doneBadge}><Icon name="check" size={36} color={colors.greenDark} /></View>
        )}
        <T style={{ textAlign: done.payment ? 'left' : 'center' }}>
          {done.payment
            ? `Đã giữ chỗ tạm cho ${seats} bé. Chuyển khoản xong là suất được xác nhận tự động.`
            : done.rewardUsed && total === 0
              ? 'Đã dùng suất miễn phí — chỗ của bé đã được giữ. Hẹn gặp bé ở buổi học!'
              : payMethod === 'online' && total > 0
                ? 'Đã ghi nhận đăng ký. Thanh toán online đang tạm dừng — Sprouty sẽ gọi xác nhận trong 24 giờ.'
                : `Cảm ơn bạn đã đăng ký cho ${seats} bé. Sprouty sẽ gọi xác nhận trong 24 giờ.`}
        </T>
        {done.payment && <PayPanel transfer={done.payment} returnPath="/workshop?tab=tickets" />}
        <Group>
          <View style={s.fact}><Icon name="calendar" size={18} color={colors.green} /><T style={{ flex: 1 }}>{formatWorkshopWhen(workshop)}</T></View>
          <View style={[s.fact, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}><Icon name="pin" size={18} color={colors.green} /><T style={{ flex: 1 }}>{workshop.location}</T></View>
        </Group>
      </Sheet>
    );
  }

  const maxSeats = Math.max(1, Math.min(10, workshop.seatsLeft));
  return (
    <Sheet open title="Đăng ký workshop" onClose={() => !busy && onClose()}
      footer={(
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={s.small}>Tạm tính</Text>
            <Text style={s.price}>{total > 0 ? formatPrice(total) : 'Miễn phí'}</Text>
          </View>
          <Button grow title={busy ? 'Đang gửi…' : total > 0 && payMethod === 'online' ? 'Đăng ký & trả' : 'Đăng ký'} busy={busy} onPress={submit} />
        </View>
      )}>
      <View style={s.bookHead}>
        <View style={s.bookThumb}>
          {imageSource(workshop.imageUrl) ? <Image source={imageSource(workshop.imageUrl)} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="ticket" size={22} color={colors.greenDark} />}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={s.bookTitle}>{workshop.title}</Text>
          <Text style={s.small}>{formatWorkshopWhen(workshop)}</Text>
        </View>
      </View>
      <Field label="Họ tên phụ huynh *" value={name} onChangeText={setName} autoComplete="name" />
      <Field label="Số điện thoại *" value={phone} onChangeText={(t) => setPhone(t.replace(/[^\d]/g, '').slice(0, 11))} keyboardType="phone-pad" autoComplete="tel" placeholder="0909000000" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <View style={{ gap: 8 }}>
        <Text style={s.fieldLabel}>Tuổi của bé</Text>
        <View style={s.wrap}>{AGES.map((a) => <Chip key={a} label={a} on={childAge === a} onPress={() => setChildAge(childAge === a ? '' : a)} />)}</View>
      </View>
      <View style={s.counter}>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={s.choiceTitle}>Số bé</Text>
          <Text style={s.small}>Còn {workshop.seatsLeft} chỗ · {workshop.price > 0 ? `${formatPrice(workshop.price)}/bé` : 'miễn phí'}</Text>
        </View>
        <Stepper value={seats} min={1} max={maxSeats} label="Số bé" onChange={setSeats} />
      </View>
      {maxRewards > 0 && (
        <View style={[s.counter, { backgroundColor: colors.mint }]}>
          <Icon name="gift" size={22} color={colors.greenDark} />
          <View style={{ flex: 1, gap: 1 }}>
            <Text style={s.choiceTitle}>Suất miễn phí</Text>
            <Text style={s.small}>Bạn có {freeSeats} suất · mỗi suất 1 bé</Text>
          </View>
          <Stepper value={usedRewards} min={0} max={maxRewards} label="Số suất miễn phí" onChange={setUseRewards} />
        </View>
      )}
      {total > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={s.fieldLabel}>Thanh toán</Text>
          <Choice on={payMethod === 'online'} onPress={() => setPayMethod('online')} icon="card" title="Online ngay" hint="QR chuyển khoản — giữ chỗ chắc chắn" />
          <Choice on={payMethod === 'onsite'} onPress={() => setPayMethod('onsite')} icon="ticket" title="Tại buổi học" hint="Khi kín chỗ, ưu tiên người đã trả online" hintTone="warn" />
        </View>
      )}
      <Field label="Ghi chú (tuỳ chọn)" value={note} onChangeText={setNote} multiline placeholder="Yêu cầu đặc biệt, dị ứng nguyên liệu…" maxLength={500} />
      {error ? <T style={{ color: colors.bad }}>{error}</T> : null}
    </Sheet>
  );
}

/** Seats left, in words and in the colour that says how urgent. */
function seatState(w: PublicWorkshop): { text: string; tone: Tone } {
  if (w.isFull) return { text: 'Kín chỗ', tone: 'bad' };
  if (w.seatsLeft <= 3) return { text: `Còn ${w.seatsLeft} chỗ`, tone: 'warn' };
  return { text: `Còn ${w.seatsLeft} chỗ`, tone: 'good' };
}

/** The session's photo, or a quiet tile with a ticket when it has none. */
function SessionPhoto({ w, style }: { w: PublicWorkshop; style: object }) {
  const source = imageSource(w.imageUrl);
  return (
    <View style={[s.photoBox, style]}>
      {source ? <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        : <Icon name="ticket" size={28} color={colors.greenDark} />}
    </View>
  );
}

/**
 * The next session, large: its photo with the date pinned on it, the title,
 * when and for whom as tags, and the price beside a button that books it.
 */
function FeaturedSession({ w, onOpen, onBook }: { w: PublicWorkshop; onOpen: () => void; onBook: () => void }) {
  const date = workshopDateParts(w);
  const seats = seatState(w);
  return (
    <Press onPress={onOpen} accessibilityLabel={`${w.title}, ${formatWorkshopWhen(w)}`} scaleTo={0.98} style={s.featured}>
      <View>
        <SessionPhoto w={w} style={s.featuredPhoto} />
        {date && (
          <View style={s.dateBadge}>
            <Text style={s.dateMonth}>{date.month}</Text>
            <Text style={s.dateDay}>{date.day}</Text>
          </View>
        )}
        <View style={s.seats}><Pill tone={seats.tone}>{seats.text}</Pill></View>
      </View>
      <View style={s.featuredBody}>
        <Text style={s.featKicker}>BUỔI GẦN NHẤT</Text>
        <Text numberOfLines={2} style={s.featuredTitle}>{w.title}</Text>
        <View style={s.tags}>
          <View style={s.tag}><Icon name="clock" size={13} color={colors.greenDark} /><Text style={s.tagText}>{date ? `${date.weekdayShort} · ${date.time}` : formatWorkshopWhen(w)}</Text></View>
          {w.ageRange ? <View style={s.tag}><Icon name="child" size={13} color={colors.greenDark} /><Text style={s.tagText}>{w.ageRange}</Text></View> : null}
          <View style={s.tag}><Icon name="pin" size={13} color={colors.greenDark} /><Text numberOfLines={1} style={[s.tagText, { flexShrink: 1 }]}>{w.location}</Text></View>
        </View>
        <View style={s.featuredFoot}>
          <View style={{ flex: 1 }}>
            <Text style={s.price}>{w.price > 0 ? formatPrice(w.price) : 'Miễn phí'}</Text>
            {w.price > 0 ? <Text style={s.small}>mỗi bé</Text> : null}
          </View>
          <Button small title={w.isFull ? 'Kín chỗ' : 'Đăng ký'} icon={w.isFull ? undefined : 'arrow-right'} disabled={w.isFull} onPress={onBook} />
        </View>
      </View>
    </Press>
  );
}

/** Any other session: its photo with the day on it, the title, when, and the price with the seats. */
function SessionCard({ w, onPress }: { w: PublicWorkshop; onPress: () => void }) {
  const date = workshopDateParts(w);
  const seats = seatState(w);
  return (
    <Press onPress={onPress} accessibilityLabel={`${w.title}, ${formatWorkshopWhen(w)}`} scaleTo={0.98} style={[s.card, w.isFull && { opacity: 0.6 }]}>
      <View>
        <SessionPhoto w={w} style={s.cardPhoto} />
        {date && (
          <View style={s.cardDate}>
            <Text style={s.cardWd}>{date.weekdayShort}</Text>
            <Text style={s.cardDay}>{date.day}</Text>
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: 4, paddingVertical: 2 }}>
        <Text numberOfLines={2} style={s.cardTitle}>{w.title}</Text>
        <View style={s.metaRow}>
          <Icon name="clock" size={13} color={colors.ink4} /><Text style={s.meta}>{date?.time}</Text>
          {w.ageRange ? <><Icon name="child" size={13} color={colors.ink4} /><Text style={s.meta}>{w.ageRange}</Text></> : null}
        </View>
        <View style={s.cardFoot}>
          <Text style={s.cardPrice}>{w.price > 0 ? formatPrice(w.price) : 'Miễn phí'}</Text>
          <Pill tone={seats.tone}>{seats.text}</Pill>
        </View>
      </View>
    </Press>
  );
}

/** Everything about one session, in the sheet opened from its row. */
function SessionDetail({ w }: { w: PublicWorkshop }) {
  const date = workshopDateParts(w);
  const seats = seatState(w);
  const [more, setMore] = useState(false);
  return (
    <>
      <View style={s.photo}>
        {imageSource(w.imageUrl) ? <Image source={imageSource(w.imageUrl)} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
          : <Icon name="ticket" size={34} color={colors.greenDark} />}
        {date && (
          <View style={s.dateBadge}>
            <Text style={s.dateMonth}>{date.month}</Text>
            <Text style={s.dateDay}>{date.day}</Text>
          </View>
        )}
        <View style={s.seats}><Pill tone={seats.tone}>{`${seats.text}${w.isFull ? '' : ` / ${w.capacity}`}`}</Pill></View>
      </View>
      <H size={21}>{w.title}</H>
      <View style={s.facts}>
        <View style={s.factTile}><Icon name="clock" size={18} color={colors.green} /><Text style={s.factText}>{date ? `${date.weekday}\n${date.time}` : formatWorkshopWhen(w)}</Text></View>
        {w.ageRange ? <View style={s.factTile}><Icon name="child" size={18} color={colors.green} /><Text style={s.factText}>{`Độ tuổi\n${w.ageRange}`}</Text></View> : null}
      </View>
      {w.description ? (
        <Pressable onPress={() => setMore((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: more }}>
          <Text numberOfLines={more ? undefined : 3} style={s.desc}>{w.description}</Text>
          {w.description.length > 130 && <Text style={s.moreLink}>{more ? 'Thu gọn' : 'Đọc thêm'}</Text>}
        </Pressable>
      ) : null}
      <PlaceMap name={w.location} address={w.address} />
    </>
  );
}

/**
 * Workshop: the schedule of in-person sessions, and the family's tickets — a
 * QR code each, shown to staff at the door. Reminders for the evening before
 * and two hours before are rescheduled each time the tickets load.
 */
export default function Workshop() {
  const { user } = useAuth();
  const toast = useToast();
  const params = useLocalSearchParams<{ tab?: string; session?: string }>();
  const tab = params.tab === 'tickets' ? 'tickets' : 'schedule';
  const [booking, setBooking] = useState<PublicWorkshop | null>(null);
  const [askLogin, setAskLogin] = useState(false);
  const [paying, setPaying] = useState<{ reg: MyWorkshopRegistration; info: Transfer } | null>(null);
  const [busyId, setBusyId] = useState('');
  const [bigTicket, setBigTicket] = useState<MyWorkshopRegistration | null>(null);
  const [writing, setWriting] = useState<{ target: ReviewTarget; existing: OwnReview | null } | null>(null);
  const [detail, setDetail] = useState<PublicWorkshop | null>(null);
  const [month, setMonth] = useState<string | null>(null); // null: the nearest month; 'all': every session
  const [openOnly, setOpenOnly] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const schedule = useLoad(async () => {
    const [list, reviews] = await Promise.all([API.workshops.list(), API.workshopReviews.list({ limit: 1 }).catch(() => null)]);
    return { workshops: (list.workshops || []) as PublicWorkshop[], score: reviews?.summary as { average: number; count: number } | undefined };
  });

  const mine = useLoad(async () => {
    if (!user) return null;
    const [regs, rewards, reviews] = await Promise.all([
      API.workshops.mine(),
      API.rewards.mine().catch(() => null),
      API.workshopReviews.mine().catch(() => null),
    ]);
    const registrations = (regs.registrations || []) as MyWorkshopRegistration[];
    void syncWorkshopReminders(registrations).catch(() => {});
    return {
      registrations,
      rewards: rewards as RewardSummary | null,
      reviews: reviews as { reviews: Array<OwnReview & { workshopId: string }>; eligible: Array<{ workshopId: string }>; options: ReviewOptions } | null,
    };
  }, [user?.id]);

  const upcoming = useMemo(() => (schedule.data?.workshops || [])
    .filter((w) => w.upcoming && w.bookable !== false)
    .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()), [schedule.data]);

  // The schedule a month at a time: a chip per month that has sessions.
  const months = useMemo(() => {
    const out: Array<{ key: string; label: string; count: number }> = [];
    for (const w of upcoming) {
      const d = workshopDateParts(w);
      if (!d) continue;
      const m = out.find((x) => x.key === d.monthKey);
      if (m) m.count += 1; else out.push({ key: d.monthKey, label: d.monthLabel, count: 1 });
    }
    return out;
  }, [upcoming]);
  const activeMonth = month ?? months[0]?.key ?? 'all';
  const filtered = upcoming.filter((w) => (activeMonth === 'all' || workshopDateParts(w)?.monthKey === activeMonth) && (!openOnly || !w.isFull));
  const SHOWN = 15;
  const shown = activeMonth === 'all' && !showAll ? filtered.slice(0, SHOWN) : filtered;
  // "Tất cả" keeps the month headings; one month is a single list.
  const groups = useMemo(() => {
    const out: Array<{ key: string; label: string; items: PublicWorkshop[] }> = [];
    for (const w of shown) {
      const d = workshopDateParts(w);
      const key = activeMonth === 'all' ? d?.monthKey ?? '' : activeMonth;
      const g = out.find((x) => x.key === key);
      if (g) g.items.push(w); else out.push({ key, label: d?.monthLabel ?? '', items: [w] });
    }
    return out;
  }, [shown, activeMonth]);

  function start(w: PublicWorkshop) {
    if (!user) return setAskLogin(true);
    setBooking(w);
  }

  // /workshop?session=ID opens that session's details straight away (from Home).
  useEffect(() => {
    if (!params.session || !schedule.data) return;
    const w = schedule.data.workshops.find((x) => x.id === params.session);
    router.setParams({ session: undefined });
    if (w && w.upcoming) setDetail(w);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.session, schedule.data]);

  async function openPayment(reg: MyWorkshopRegistration) {
    setBusyId(reg.id);
    try {
      const { payment } = await API.workshops.payment(reg.id);
      setPaying({ reg, info: payment });
    } catch (err: any) {
      toast(err?.message || 'Không lấy được thông tin thanh toán.', 'error');
    } finally {
      setBusyId('');
    }
  }

  function cancel(reg: MyWorkshopRegistration) {
    Alert.alert('Huỷ đăng ký?', `Huỷ “${reg.workshop.title}”? Chỗ sẽ được mở lại cho người khác, suất miễn phí đã dùng được trả lại.${reg.paidAt ? '\n\nBạn đã thanh toán — vui lòng liên hệ Sprouty để được hoàn tiền.' : ''}`, [
      { text: 'Không', style: 'cancel' },
      { text: 'Huỷ đăng ký', style: 'destructive', onPress: async () => {
        setBusyId(reg.id);
        try {
          const { message } = await API.workshops.cancelMine(reg.id);
          toast(message || 'Đã huỷ đăng ký', 'success');
          await mine.reload();
        } catch (err: any) {
          toast(err?.message || 'Không huỷ được.', 'error');
        } finally {
          setBusyId('');
        }
      } },
    ]);
  }

  const regs = mine.data?.registrations || [];
  const live = (r: MyWorkshopRegistration) => r.upcoming && r.status !== 'cancelled' && !sessionCancelled(r);
  const soon = regs.filter(live);
  const past = regs.filter((r) => !live(r));
  const reviewOf = new Map((mine.data?.reviews?.reviews || []).map((r) => [r.workshopId, r]));
  const canReview = new Set((mine.data?.reviews?.eligible || []).map((e) => e.workshopId));
  const score = schedule.data?.score;

  /** A ticket, drawn as one: the session above a torn edge, the QR code below it. */
  const ticket = (reg: MyWorkshopRegistration) => {
    const w = reg.workshop;
    const state = bookingState(reg);
    const dropped = sessionCancelled(reg) && reg.status !== 'cancelled';
    const needsPayment = !reg.paidAt && reg.amount > 0 && reg.status !== 'cancelled' && reg.upcoming && !dropped;
    const review = reviewOf.get(w.id);
    const showQr = reg.status !== 'cancelled' && !dropped && (reg.upcoming || reg.checkedInAt);
    const reviewTarget: ReviewTarget = { kind: 'workshop', id: w.id, name: w.title, image: w.imageUrl || null, when: formatWorkshopWhen(w) };
    return (
      <View style={[s.ticketCard, (reg.status === 'cancelled' || dropped) && { opacity: 0.7 }]}>
        <View style={s.ticketTop}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={s.ticketThumb}>
              {imageSource(w.imageUrl) ? <Image source={imageSource(w.imageUrl)} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="ticket" size={24} color={colors.greenDark} />}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text numberOfLines={2} style={s.ticketTitle}>{w.title}</Text>
              <Text style={s.small}>{formatWorkshopWhen(w)}</Text>
              <Pill tone={state.tone}>{state.label}</Pill>
            </View>
          </View>
          <View style={s.where}>
            <View style={s.whereText}>
              <Icon name="pin" size={14} color={colors.ink4} />
              <Text numberOfLines={1} style={[s.small, { flexShrink: 1 }]}>{w.location}</Text>
              <Text style={s.small}>· {reg.childCount} bé</Text>
            </View>
            {live(reg) && (
              <Press onPress={() => openMaps(placeOf(w))} accessibilityRole="link" accessibilityLabel={`Chỉ đường tới ${w.location}`} scaleTo={0.94} style={s.directions}>
                <Icon name="pin" size={14} color={colors.greenDark} />
                <Text style={s.directionsText}>Chỉ đường</Text>
              </Press>
            )}
          </View>
          {dropped && <Card tone="danger"><T>Sprouty đã huỷ buổi này. Nếu bạn đã thanh toán, Sprouty sẽ liên hệ hoàn tiền.</T></Card>}
          {needsPayment && reg.paymentMethod === 'onsite' && (
            <View style={s.warnLine}><Icon name="warning" size={14} color={colors.warn} /><Text style={s.warnText}>Trả tại buổi học — chỗ chưa giữ chắc</Text></View>
          )}
        </View>

        {showQr && (
          <>
            <View style={s.tear}>
              <View style={[s.notch, { left: -11 }]} />
              <View style={s.tearLine} />
              <View style={[s.notch, { right: -11 }]} />
            </View>
            <Pressable onPress={() => setBigTicket(reg)} style={[s.ticketBottom, reg.checkedInAt && { opacity: 0.6 }]} accessibilityLabel="Phóng to vé QR">
              <View style={s.qrBox}><TicketQr value={reg.ticket} size={84} /></View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.kicker}>MÃ VÉ</Text>
                <Text selectable style={s.ticketCode}>{reg.ticket}</Text>
                <View style={s.metaRow}>
                  <Icon name={reg.checkedInAt ? 'check' : 'expand'} size={13} color={colors.green} />
                  <Text style={s.tapHint}>
                    {reg.checkedInAt ? `Đã điểm danh ${formatDateTime(reg.checkedInAt)}${reg.attendedCount ? ` · ${reg.attendedCount} bé` : ''}` : 'Chạm để phóng to'}
                  </Text>
                </View>
              </View>
            </Pressable>
          </>
        )}

        {(needsPayment || (reg.upcoming && reg.status !== 'cancelled' && !dropped && !reg.checkedInAt) || (reg.status !== 'cancelled' && !dropped && (review || (canReview.has(w.id) && reg.checkedInAt)))) && (
          <View style={s.ticketActions}>
            {needsPayment && <Button small grow icon="card" title={busyId === reg.id ? 'Đang tải…' : 'Thanh toán'} busy={busyId === reg.id} onPress={() => openPayment(reg)} />}
            {reg.upcoming && reg.status !== 'cancelled' && !dropped && !reg.checkedInAt && <Button small variant="ghost" title="Huỷ vé" disabled={busyId === reg.id} onPress={() => cancel(reg)} />}
            {reg.status !== 'cancelled' && !dropped && (review ? (
              <Pressable style={s.reviewBtn} onPress={() => setWriting({ target: reviewTarget, existing: review })}>
                <Stars value={review.rating} size={13} /><Text style={s.reviewText}>{review.status === 'hidden' ? 'Đang ẩn · Sửa' : 'Sửa đánh giá'}</Text>
              </Pressable>
            ) : canReview.has(w.id) && reg.checkedInAt ? (
              <Button small variant="soft" icon="star" title="Đánh giá buổi học" onPress={() => setWriting({ target: reviewTarget, existing: null })} />
            ) : null)}
          </View>
        )}
      </View>
    );
  };

  return (
    <Screen title="Workshop" large onRefresh={() => Promise.all([schedule.reload(), mine.reload()])}
      actions={score && score.count > 0 ? (
        <View style={s.ratingPill} accessibilityLabel={`Đánh giá ${scoreText(score.average)} trên 5, ${score.count} lượt`}>
          <Icon name="star" size={14} color="#E9A21B" />
          <Text style={s.ratingNum}>{scoreText(score.average)}</Text>
          <Text style={s.ratingCount}>({score.count})</Text>
        </View>
      ) : undefined}>
      <Segmented
        items={[
          { key: 'schedule', label: 'Lịch học', icon: 'calendar' },
          { key: 'tickets', label: soon.length ? `Vé của tôi · ${soon.length}` : 'Vé của tôi', icon: 'ticket' },
        ]}
        value={tab}
        onChange={(key) => router.setParams({ tab: key })}
      />

      {tab === 'schedule' ? (
        <>
          {upcoming.length > 0 && (
            <ChipRow>
              <Chip label="Còn chỗ" icon={openOnly ? 'check' : 'filter'} on={openOnly} onPress={() => setOpenOnly((v) => !v)} />
              <View style={s.chipRule} />
              {months.map((m) => (
                <Chip key={m.key} label={m.label} count={m.count} on={activeMonth === m.key} onPress={() => { setMonth(m.key); setShowAll(false); }} />
              ))}
              {months.length > 1 && <Chip label="Tất cả" count={upcoming.length} on={activeMonth === 'all'} onPress={() => { setMonth('all'); setShowAll(false); }} />}
            </ChipRow>
          )}
          {schedule.error ? <ErrorNote message={schedule.error} onRetry={schedule.reload} /> : null}
          {schedule.loading && !schedule.data && <Loading label="Đang tải lịch workshop…" />}
          {schedule.data && upcoming.length === 0 && (
            <Empty art={imageSource('/assets/images/sprouty-icons/Workshop.png') as number} title="Chưa có buổi nào mở" text="Sprouty sẽ báo lịch mới sớm. Quay lại sau nhé!" />
          )}
          {upcoming.length > 0 && filtered.length === 0 && (
            <Empty icon="calendar" title="Tháng này đã kín chỗ" text="Chọn tháng khác, hoặc bỏ lọc “Còn chỗ”." />
          )}

          {/* The next session, large, with its photo */}
          {shown[0] && <FeaturedSession w={shown[0]} onOpen={() => setDetail(shown[0])} onBook={() => start(shown[0])} />}

          {groups.map((g) => {
            const items = g.items.filter((w) => w.id !== shown[0]?.id);
            if (!items.length) return null;
            return (
              <View key={g.key} style={{ gap: 10 }}>
                {activeMonth === 'all' && <Label>{g.label}</Label>}
                {items.map((w) => <SessionCard key={w.id} w={w} onPress={() => setDetail(w)} />)}
              </View>
            );
          })}
          {shown.length < filtered.length && (
            <Button variant="ghost" title={`Xem thêm ${filtered.length - shown.length} buổi`} onPress={() => setShowAll(true)} />
          )}

          <View style={s.flowCard}>
            <View style={s.flowHead}>
              <H size={18} style={{ flex: 1 }}>Một buổi học có gì?</H>
              <Pill tone="good" icon="child">8–12 bé · ba mẹ cùng</Pill>
            </View>
            <View style={s.flow}>
              <View style={s.flowLine} />
              {STEPS.map((st, i) => (
                <View key={st.title} style={s.flowStep}>
                  <View style={s.flowIcon}>
                    <Icon name={st.icon} size={20} color={colors.greenDark} />
                    <View style={s.flowNum}><Text style={s.flowNumText}>{i + 1}</Text></View>
                  </View>
                  <Text style={s.flowText}>{st.title}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : !user ? (
        <Empty icon="ticket" title="Vé của bé ở đây" text="Đăng nhập để đăng ký và giữ vé QR ngay trên điện thoại.">
          <Button title="Đăng nhập" onPress={() => router.push('/login?next=/workshop')} />
        </Empty>
      ) : (
        <>
          {mine.error ? <ErrorNote message={mine.error} onRetry={mine.reload} /> : null}
          {mine.loading && !mine.data && <Loading />}
          {mine.data && regs.length === 0 && (
            <Empty icon="ticket" title="Bé chưa có vé nào" text="Chọn một buổi trong lịch học để đăng ký cho bé.">
              <Button title="Xem lịch học" icon="calendar" onPress={() => router.setParams({ tab: 'schedule' })} />
            </Empty>
          )}
          {soon.length > 0 && <Label>Sắp tới</Label>}
          {soon.map((r) => <View key={r.id}>{ticket(r)}</View>)}
          {past.length > 0 && <Label>Đã qua</Label>}
          {past.map((r) => <View key={r.id}>{ticket(r)}</View>)}
        </>
      )}

      <Sheet open={Boolean(detail)} title="Chi tiết buổi học" onClose={() => setDetail(null)}
        footer={detail ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.price}>{detail.price > 0 ? formatPrice(detail.price) : 'Miễn phí'}</Text>
              {detail.price > 0 ? <Text style={s.small}>mỗi bé</Text> : null}
            </View>
            <Button grow title={detail.isFull ? 'Đã kín chỗ' : 'Đăng ký cho bé'} icon={detail.isFull ? undefined : 'arrow-right'} disabled={detail.isFull}
              onPress={() => { const w = detail; setDetail(null); start(w); }} />
          </View>
        ) : undefined}>
        {detail && <SessionDetail w={detail} />}
      </Sheet>

      <BookingSheet workshop={booking} rewards={mine.data?.rewards ?? null} onClose={() => setBooking(null)} onBooked={() => { void schedule.reload(); void mine.reload(); }} />

      <Sheet open={Boolean(paying)} title="Thanh toán workshop" onClose={() => { setPaying(null); void mine.reload(); }}
        footer={<Button title="Tôi đã chuyển khoản" onPress={() => { setPaying(null); void mine.reload(); }} />}>
        {paying && (
          <>
            <T muted>{paying.reg.workshop.title} · suất được xác nhận tự động khi tiền về.</T>
            <PayPanel transfer={paying.info} returnPath="/workshop?tab=tickets" />
          </>
        )}
      </Sheet>

      <Sheet open={Boolean(bigTicket)} title="Vé workshop" onClose={() => setBigTicket(null)}>
        {bigTicket && (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <H size={19} style={{ textAlign: 'center' }}>{bigTicket.workshop.title}</H>
            <Text style={[s.small, { textAlign: 'center' }]}>{formatWorkshopWhen(bigTicket.workshop)}</Text>
            <View style={s.bigQr}><TicketQr value={bigTicket.ticket} size={240} /></View>
            <Text selectable style={[s.ticketCode, { fontSize: 22 }]}>{bigTicket.ticket}</Text>
            <Pill tone="good" icon="child">{`${bigTicket.childCount} bé · đưa nhân viên quét khi tới`}</Pill>
          </View>
        )}
      </Sheet>

      <Sheet open={askLogin} title="Đăng nhập để đăng ký" onClose={() => setAskLogin(false)}>
        <T muted>Đăng nhập để giữ chỗ và nhận vé QR cho bé.</T>
        <Button title="Đăng nhập" onPress={() => { setAskLogin(false); router.push('/login?next=/workshop'); }} />
        <Button title="Tạo tài khoản mới" variant="ghost" onPress={() => { setAskLogin(false); router.push('/register?next=/workshop'); }} />
      </Sheet>

      <ReviewSheet target={writing?.target ?? null} existing={writing?.existing} options={mine.data?.reviews?.options}
        onClose={() => setWriting(null)} onSaved={() => { void mine.reload(); }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  chipRule: { width: 1, height: 24, alignSelf: 'center', backgroundColor: colors.line, marginHorizontal: 2 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.card, ...shadow.sm },
  ratingNum: { fontFamily: fonts.bold, fontSize: 14, color: colors.ink },
  ratingCount: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink4 },
  photoBox: { backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  featured: { ...surface },
  featuredPhoto: { width: '100%', aspectRatio: 2, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  featuredBody: { padding: 16, gap: 8 },
  featKicker: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.green },
  featuredTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: colors.ink },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.mint },
  tagText: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.greenDark },
  featuredFoot: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  card: { ...surface, flexDirection: 'row', gap: 12, padding: 10 },
  cardPhoto: { width: 92, height: 92, borderRadius: radius.md },
  cardDate: { position: 'absolute', left: 6, bottom: 6, minWidth: 38, alignItems: 'center', paddingVertical: 2, paddingHorizontal: 6, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.95)' },
  cardWd: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.green },
  cardDay: { fontFamily: fonts.display, fontSize: 17, lineHeight: 20, color: colors.ink },
  cardTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink },
  meta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink3, marginRight: 6 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto', flexWrap: 'wrap' },
  cardPrice: { fontFamily: fonts.bold, fontSize: 15, color: colors.price },
  flowHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.ink3 },
  fieldLabel: { fontFamily: fonts.semi, fontSize: 14, color: colors.ink2, marginLeft: 2 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  score: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },

  srow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 14, paddingTop: 14 },
  cal: { width: 50, borderRadius: 14, backgroundColor: colors.mint, alignItems: 'center', paddingVertical: 6 },
  calWd: { fontFamily: fonts.bold, fontSize: 11, color: colors.green },
  calDay: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, color: colors.ink },
  srowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 14, paddingBottom: 14 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  srowTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, color: colors.ink },
  srowMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.ink3, marginRight: 6 },
  srowFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  srowPrice: { fontFamily: fonts.bold, fontSize: 15, color: colors.price },

  flowCard: { gap: 16, padding: 16, borderRadius: radius.lg, backgroundColor: colors.card },
  flowTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  flow: { flexDirection: 'row' },
  flowLine: { position: 'absolute', top: 23, left: '12.5%', right: '12.5%', height: 2, borderRadius: 1, backgroundColor: colors.mint },
  flowStep: { flex: 1, alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  flowIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.card },
  flowNum: { position: 'absolute', top: -4, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.card },
  flowNumText: { fontFamily: fonts.bold, fontSize: 10, color: colors.white },
  flowText: { fontFamily: fonts.semi, fontSize: 12.5, lineHeight: 17, color: colors.ink2, textAlign: 'center' },

  photo: { width: '100%', aspectRatio: 2.1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  dateBadge: { position: 'absolute', top: 12, left: 12, width: 54, borderRadius: 14, backgroundColor: colors.card, alignItems: 'center', overflow: 'hidden' },
  dateMonth: { alignSelf: 'stretch', textAlign: 'center', paddingVertical: 2, backgroundColor: colors.green, color: colors.white, fontFamily: fonts.bold, fontSize: 11 },
  dateDay: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink, paddingBottom: 2 },
  seats: { position: 'absolute', top: 12, right: 12 },
  facts: { flexDirection: 'row', gap: 10 },
  factTile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, backgroundColor: colors.card },
  factText: { flex: 1, fontFamily: fonts.semi, fontSize: 13.5, lineHeight: 19, color: colors.ink },
  desc: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.ink2 },
  moreLink: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.green, marginTop: 4 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14 },

  price: { fontFamily: fonts.bold, fontSize: 20, color: colors.price },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  bookHead: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: radius.lg, backgroundColor: colors.card },
  bookThumb: { width: 56, height: 56, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  bookTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20, color: colors.ink },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, paddingLeft: 14, borderRadius: radius.lg, backgroundColor: colors.card },
  choice: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: colors.card, alignItems: 'center' },
  choiceOn: { borderColor: colors.green, backgroundColor: '#F3FAF0' },
  choiceIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  choiceTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  choiceHint: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.ink3 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.ink5, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.green },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  doneBadge: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },

  ticketCard: { ...surface },
  ticketTop: { padding: 14, gap: 12 },
  ticketThumb: { width: 64, height: 64, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  ticketTitle: { fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 21, color: colors.ink },
  where: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  whereText: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  directions: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.mint },
  directionsText: { fontFamily: fonts.semi, fontSize: 13, color: colors.greenDark },
  warnLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warnText: { flex: 1, fontFamily: fonts.semi, fontSize: 13, color: colors.warn },
  tear: { height: 22, justifyContent: 'center' },
  tearLine: { marginHorizontal: 16, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: colors.line },
  notch: { position: 'absolute', top: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.canvas },
  ticketBottom: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingBottom: 14, paddingTop: 2 },
  qrBox: { padding: 4, borderRadius: 12, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  kicker: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 1, color: colors.ink4 },
  ticketCode: { fontFamily: fonts.bold, fontSize: 17, letterSpacing: 1.5, color: colors.ink },
  tapHint: { fontFamily: fonts.semi, fontSize: 12.5, color: colors.green },
  ticketActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingBottom: 14 },
  bigQr: { ...surface, padding: 16 },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingHorizontal: 6 },
  reviewText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.green },
});
