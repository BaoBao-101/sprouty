import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Icon, type IconName } from '@/components/Icon';
import { PayPanel } from '@/components/PayPanel';
import { ReviewSheet, type ReviewTarget } from '@/components/ReviewSheet';
import { Stars, TicketQr } from '@/components/shop';
import { useToast } from '@/components/Toast';
import { Button, Card, Chip, cheer, Empty, ErrorNote, Field, H, Loading, Pill, Screen, Sheet, Stepper, T, tap } from '@/components/ui';
import { API, imageSource } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime, formatPrice, formatWorkshopWhen, workshopDateParts } from '@/lib/format';
import { syncWorkshopReminders } from '@/lib/reminders';
import type { MyWorkshopRegistration, OwnReview, PublicWorkshop, RewardSummary, ReviewOptions, Transfer } from '@/lib/types';
import { useLoad } from '@/lib/use-load';
import { colors, fonts, radius } from '@/theme';

const AGES = ['3–4 tuổi', '4–5 tuổi', '6–7 tuổi', '8–9 tuổi', '10–12 tuổi'];

/** What happens in a session, in order, left to right. */
const STEPS: Array<{ icon: IconName; title: string }> = [
  { icon: 'sparkle', title: 'Vẽ chậu' },
  { icon: 'seed', title: 'Gieo hạt thật' },
  { icon: 'sprout', title: 'Kích hoạt Plant Buddy' },
  { icon: 'pot', title: 'Mang cây về nhà' },
];

const sessionCancelled = (r: MyWorkshopRegistration) => r.workshop.status === 'cancelled';

function bookingState(r: MyWorkshopRegistration): { label: string; tone: 'good' | 'warn' | 'bad' | 'info' | 'neutral' } {
  if (r.status === 'cancelled') return { label: 'Đã huỷ', tone: 'neutral' };
  if (sessionCancelled(r)) return { label: 'Sprouty huỷ buổi', tone: 'bad' };
  if (r.checkedInAt) return { label: 'Đã tham gia', tone: 'info' };
  if (!r.upcoming) return { label: 'Đã diễn ra', tone: 'neutral' };
  if (r.amount === 0) return { label: 'Đã giữ chỗ', tone: 'good' };
  if (r.paidAt) return { label: 'Đã thanh toán', tone: 'good' };
  return { label: 'Chưa thanh toán', tone: 'warn' };
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
        <T>
          {done.payment
            ? `Đã giữ chỗ tạm cho ${seats} bé ở “${workshop.title}”. Chuyển khoản xong là suất được xác nhận tự động.`
            : done.rewardUsed && total === 0
              ? `Đã dùng suất workshop miễn phí cho “${workshop.title}”. Chỗ của bé đã được giữ — hẹn gặp bé ở buổi học!`
              : payMethod === 'online' && total > 0
                ? 'Đã ghi nhận đăng ký, nhưng thanh toán online đang tạm không khả dụng. Sprouty sẽ gọi điện trong 24 giờ để xác nhận.'
                : `Cảm ơn bạn đã đăng ký “${workshop.title}” cho ${seats} bé. Sprouty sẽ gọi điện xác nhận trong 24 giờ.`}
        </T>
        {done.payment && <PayPanel transfer={done.payment} returnPath="/workshop?tab=tickets" />}
        <Card tone="soft">
          <T><T muted>Buổi học: </T>{formatWorkshopWhen(workshop)}</T>
          <T><T muted>Địa điểm: </T>{workshop.location}</T>
          <T muted style={{ fontSize: 13 }}>Vé QR của bé nằm trong mục “Vé của tôi”.</T>
        </Card>
      </Sheet>
    );
  }

  const maxSeats = Math.max(1, Math.min(10, workshop.seatsLeft));
  return (
    <Sheet open title="Đăng ký workshop" onClose={() => !busy && onClose()}
      footer={(
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <T muted>Tạm tính</T>
            <Text style={s.price}>{total > 0 ? formatPrice(total) : 'Miễn phí'}</Text>
          </View>
          <Button grow title={busy ? 'Đang gửi…' : total > 0 && payMethod === 'online' ? 'Đăng ký & thanh toán' : 'Đăng ký'} busy={busy} onPress={submit} />
        </View>
      )}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {imageSource(workshop.imageUrl) && <Image source={imageSource(workshop.imageUrl)} style={s.thumb} contentFit="cover" />}
        <View style={{ flex: 1 }}>
          <T bold>{workshop.title}</T>
          <T muted>{formatWorkshopWhen(workshop)}</T>
        </View>
      </View>
      <Field label="Họ tên phụ huynh *" value={name} onChangeText={setName} autoComplete="name" />
      <Field label="Số điện thoại *" value={phone} onChangeText={(t) => setPhone(t.replace(/[^\d]/g, '').slice(0, 11))} keyboardType="phone-pad" autoComplete="tel" placeholder="0909000000" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <View style={{ gap: 8 }}>
        <T bold>Tuổi của bé</T>
        <View style={s.wrap}>{AGES.map((a) => <Chip key={a} label={a} on={childAge === a} onPress={() => setChildAge(childAge === a ? '' : a)} />)}</View>
      </View>
      <View style={s.rowBetween}>
        <View style={{ flex: 1 }}><T bold>Số bé tham gia</T><T muted style={{ fontSize: 13 }}>Còn {workshop.seatsLeft} chỗ · {workshop.price > 0 ? `${formatPrice(workshop.price)}/bé` : 'miễn phí'}</T></View>
        <Stepper value={seats} min={1} max={maxSeats} label="Số bé" onChange={setSeats} />
      </View>
      {maxRewards > 0 && (
        <Card tone="soft">
          <View style={s.rowBetween}>
            <Icon name="gift" size={22} color={colors.greenDark} />
            <View style={{ flex: 1 }}>
              <T bold>Dùng suất miễn phí</T>
              <T muted style={{ fontSize: 13 }}>Bạn có {freeSeats} suất (mua {rewards?.threshold ?? 3} tặng 1). Mỗi suất cho 1 bé.</T>
            </View>
            <Stepper value={usedRewards} min={0} max={maxRewards} label="Số suất miễn phí" onChange={setUseRewards} />
          </View>
        </Card>
      )}
      {total > 0 && (
        <View style={{ gap: 8 }}>
          <T bold>Hình thức thanh toán</T>
          {([
            ['online', 'card', 'Thanh toán online ngay', 'Chuyển khoản QR — chỗ được giữ chắc chắn cho bé.'],
            ['onsite', 'ticket', 'Thanh toán tại buổi học', 'Chưa chắc còn chỗ: khi kín, suất ưu tiên người đã trả online.'],
          ] as const).map(([value, icon, title, hint]) => (
            <Pressable key={value} onPress={() => { tap(); setPayMethod(value); }} style={[s.choice, payMethod === value && s.choiceOn]} accessibilityRole="radio" accessibilityState={{ checked: payMethod === value }}>
              <View style={[s.radio, payMethod === value && s.radioOn]}>{payMethod === value && <View style={s.radioDot} />}</View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Icon name={icon} size={16} color={colors.greenDark} /><T bold>{title}</T></View>
                <T muted style={{ fontSize: 13, color: value === 'onsite' ? colors.warn : colors.ink3 }}>{hint}</T>
              </View>
            </Pressable>
          ))}
        </View>
      )}
      <Field label="Ghi chú (tuỳ chọn)" value={note} onChangeText={setNote} multiline placeholder="Yêu cầu đặc biệt, dị ứng nguyên liệu…" maxLength={500} />
      {error ? <T style={{ color: colors.bad }}>{error}</T> : null}
    </Sheet>
  );
}

/** Seats left, in words and in the colour that says how urgent. */
function seatState(w: PublicWorkshop) {
  if (w.isFull) return { text: 'Kín chỗ', color: colors.bad, bg: colors.badSoft };
  if (w.seatsLeft <= 3) return { text: `Còn ${w.seatsLeft} chỗ`, color: colors.warn, bg: colors.warnSoft };
  return { text: `Còn ${w.seatsLeft} chỗ`, color: colors.greenDark, bg: colors.greenSoft };
}

/**
 * One session in the schedule, a single line high: the day like a calendar
 * page, then the title, the time and ages, the price and the seats. The photo
 * and the full description wait in the detail sheet, so fifty sessions are a
 * list to skim, not a wall to scroll.
 */
function SessionRow({ w, last, onPress }: { w: PublicWorkshop; last: boolean; onPress: () => void }) {
  const date = workshopDateParts(w);
  const seats = seatState(w);
  return (
    <Pressable onPress={() => { tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={`${w.title}, ${formatWorkshopWhen(w)}`}
      style={({ pressed }) => [s.srow, pressed && { backgroundColor: colors.cream2 }]}>
      <View style={[s.cal, w.isFull && { opacity: 0.55 }]}>
        <Text style={s.calWd}>{date?.weekdayShort}</Text>
        <Text style={s.calDay}>{date?.day}</Text>
      </View>
      <View style={[s.srowBody, !last && s.divider]}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text numberOfLines={2} style={[s.srowTitle, w.isFull && { color: colors.ink3 }]}>{w.title}</Text>
          <Text numberOfLines={1} style={s.srowMeta}>{date?.time}{w.ageRange ? ` · ${w.ageRange}` : ''}</Text>
          <View style={s.srowFoot}>
            <Text style={s.srowPrice}>{w.price > 0 ? formatPrice(w.price) : 'Miễn phí'}</Text>
            <View style={[s.seatPill, { backgroundColor: seats.bg }]}><Text style={[s.seatPillText, { color: seats.color }]}>{seats.text}</Text></View>
          </View>
        </View>
        <Icon name="arrow-right" size={16} color={colors.ink5} />
      </View>
    </Pressable>
  );
}

/** Everything about one session, in the sheet opened from its row. */
function SessionDetail({ w }: { w: PublicWorkshop }) {
  const date = workshopDateParts(w);
  const seats = seatState(w);
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
        <View style={[s.seats, { backgroundColor: seats.bg }]}><Text style={[s.seatsText, { color: seats.color }]}>{seats.text}{w.isFull ? '' : ` / ${w.capacity}`}</Text></View>
      </View>
      <Text style={s.sessionTitle}>{w.title}</Text>
      <View style={{ gap: 8 }}>
        <View style={s.meta}><Icon name="clock" size={16} color={colors.green} /><Text style={[s.metaText, { flex: 1 }]}>{formatWorkshopWhen(w)}</Text></View>
        <View style={s.meta}><Icon name="pin" size={16} color={colors.green} /><Text style={[s.metaText, { flex: 1 }]}>{w.location}</Text></View>
        {w.ageRange ? <View style={s.meta}><Icon name="child" size={16} color={colors.green} /><Text style={[s.metaText, { flex: 1 }]}>Phù hợp {w.ageRange}</Text></View> : null}
      </View>
      {w.description ? <Text style={s.desc}>{w.description}</Text> : null}
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

  const ticket = (reg: MyWorkshopRegistration) => {
    const w = reg.workshop;
    const state = bookingState(reg);
    const dropped = sessionCancelled(reg) && reg.status !== 'cancelled';
    const needsPayment = !reg.paidAt && reg.amount > 0 && reg.status !== 'cancelled' && reg.upcoming && !dropped;
    const review = reviewOf.get(w.id);
    return (
      <Card style={(reg.status === 'cancelled' || dropped) ? { opacity: 0.7 } : undefined}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={s.ticketThumb}>
            {imageSource(w.imageUrl) ? <Image source={imageSource(w.imageUrl)} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Icon name="ticket" size={24} color={colors.greenDark} />}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T bold numberOfLines={2}>{w.title}</T>
            <T muted style={{ fontSize: 13 }}>{formatWorkshopWhen(w)}</T>
            <Pill tone={state.tone}>{state.label}</Pill>
          </View>
        </View>
        <T muted style={{ fontSize: 13 }}>{w.location} · {reg.childCount} bé{reg.amount > 0 ? ` · ${formatPrice(reg.amount)}` : ''}</T>
        {dropped && <Card tone="danger"><T>Sprouty đã huỷ buổi này. Nếu bạn đã thanh toán, Sprouty sẽ liên hệ hoàn tiền.</T></Card>}
        {needsPayment && reg.paymentMethod === 'onsite' && (
          <T style={{ color: colors.warn, fontSize: 13 }}>Bạn chọn trả tại buổi học — chỗ chưa được giữ chắc. Trả online để chắc chắn có chỗ cho bé.</T>
        )}
        {reg.status !== 'cancelled' && !dropped && (reg.upcoming || reg.checkedInAt) && (
          <Pressable onPress={() => setBigTicket(reg)} style={[s.ticket, reg.checkedInAt && { opacity: 0.6 }]} accessibilityLabel="Phóng to vé QR">
            <TicketQr value={reg.ticket} size={96} />
            <View style={{ flex: 1, gap: 2 }}>
              <T muted style={{ fontSize: 12 }}>Mã vé của bạn</T>
              <Text selectable style={s.ticketCode}>{reg.ticket}</Text>
              <T muted style={{ fontSize: 12.5 }}>
                {reg.checkedInAt ? `Đã điểm danh ${formatDateTime(reg.checkedInAt)}${reg.attendedCount ? ` · ${reg.attendedCount} bé` : ''}` : 'Chạm để phóng to, đưa nhân viên quét khi tới.'}
              </T>
            </View>
          </Pressable>
        )}
        <View style={s.wrap}>
          {needsPayment && <Button small icon="card" title={busyId === reg.id ? 'Đang tải…' : 'Thanh toán ngay'} busy={busyId === reg.id} onPress={() => openPayment(reg)} />}
          {reg.upcoming && reg.status !== 'cancelled' && !dropped && !reg.checkedInAt && <Button small variant="ghost" title="Huỷ đăng ký" disabled={busyId === reg.id} onPress={() => cancel(reg)} />}
          {reg.status !== 'cancelled' && !dropped && (review ? (
            <Pressable style={s.reviewBtn} onPress={() => setWriting({ target: { kind: 'workshop', id: w.id, name: w.title, image: w.imageUrl || null, when: formatWorkshopWhen(w) }, existing: review })}>
              <Stars value={review.rating} size={13} /><Text style={s.reviewText}>{review.status === 'hidden' ? 'Đang ẩn · Sửa' : 'Sửa đánh giá'}</Text>
            </Pressable>
          ) : canReview.has(w.id) && reg.checkedInAt ? (
            <Button small variant="soft" icon="star" title="Đánh giá buổi học" onPress={() => setWriting({ target: { kind: 'workshop', id: w.id, name: w.title, image: w.imageUrl || null, when: formatWorkshopWhen(w) }, existing: null })} />
          ) : null)}
        </View>
      </Card>
    );
  };

  return (
    <Screen title="Workshop" large onRefresh={() => Promise.all([schedule.reload(), mine.reload()])}>
      <View style={s.segment}>
        {(['schedule', 'tickets'] as const).map((key) => (
          <Pressable key={key} onPress={() => { tap(); router.setParams({ tab: key }); }} style={[s.segBtn, tab === key && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === key }}>
            <Icon name={key === 'schedule' ? 'calendar' : 'ticket'} size={17} color={tab === key ? colors.white : colors.ink2} />
            <Text style={[s.segText, tab === key && { color: colors.white }]}>{key === 'schedule' ? 'Lịch học' : `Vé của tôi${soon.length ? ` (${soon.length})` : ''}`}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'schedule' ? (
        <>
          {upcoming.length > 0 && (
            <View style={{ gap: 10 }}>
              <View style={s.listHead}>
                <View style={{ gap: 1 }}>
                  <Text style={s.listTitle}>{upcoming.length} buổi sắp tới</Text>
                  {score && score.count > 0 ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Stars value={score.average} size={12} />
                      <Text style={s.score}>{score.average.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} · {score.count} đánh giá</Text>
                    </View>
                  ) : null}
                </View>
                <Pressable onPress={() => { tap(); setOpenOnly((v) => !v); }} accessibilityRole="switch" accessibilityState={{ checked: openOnly }}
                  style={[s.toggle, openOnly && s.toggleOn]}>
                  <View style={[s.box, openOnly && s.boxOn]}>{openOnly && <Icon name="check" size={12} color={colors.white} />}</View>
                  <Text style={[s.toggleText, openOnly && { color: colors.greenDark }]}>Còn chỗ</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipsOuter} contentContainerStyle={s.chips}>
                {months.map((m) => (
                  <Chip key={m.key} label={`${m.label} · ${m.count}`} on={activeMonth === m.key} onPress={() => { setMonth(m.key); setShowAll(false); }} />
                ))}
                {months.length > 1 && <Chip label={`Tất cả · ${upcoming.length}`} on={activeMonth === 'all'} onPress={() => { setMonth('all'); setShowAll(false); }} />}
              </ScrollView>
            </View>
          )}
          {schedule.error ? <ErrorNote message={schedule.error} onRetry={schedule.reload} /> : null}
          {schedule.loading && !schedule.data && <Loading label="Đang tải lịch workshop…" />}
          {schedule.data && upcoming.length === 0 && (
            <Empty art={imageSource('/assets/images/sprouty-icons/Workshop.png') as number} title="Chưa có buổi nào mở đăng ký" text="Sprouty sẽ báo lịch mới sớm. Quay lại sau nhé!" />
          )}
          {upcoming.length > 0 && filtered.length === 0 && (
            <Empty icon="calendar" title="Các buổi tháng này đã kín chỗ" text="Chọn tháng khác, hoặc bỏ lọc “Còn chỗ” để xem cả buổi đã kín." />
          )}
          {groups.map((g) => (
            <View key={g.key} style={{ gap: 8 }}>
              {activeMonth === 'all' && <Text style={s.monthTitle}>{g.label}</Text>}
              <View style={s.list}>
                {g.items.map((w, i) => <SessionRow key={w.id} w={w} last={i === g.items.length - 1} onPress={() => setDetail(w)} />)}
              </View>
            </View>
          ))}
          {shown.length < filtered.length && (
            <Button variant="ghost" title={`Xem thêm ${filtered.length - shown.length} buổi`} onPress={() => setShowAll(true)} />
          )}

          <Card tone="soft">
            <View style={{ gap: 2 }}>
              <H size={18}>Một buổi học gồm gì?</H>
              <T muted>Nhóm nhỏ 8–12 bé, ba mẹ ngồi cùng suốt buổi.</T>
            </View>
            <View style={s.flow}>
              <View style={s.flowLine} />
              {STEPS.map((st) => (
                <View key={st.title} style={s.flowStep}>
                  <View style={s.flowIcon}><Icon name={st.icon} size={19} color={colors.greenDark} /></View>
                  <Text style={s.flowText}>{st.title}</Text>
                </View>
              ))}
            </View>
          </Card>
        </>
      ) : !user ? (
        <Empty icon="ticket" title="Vé của bé ở đây" text="Đăng nhập để đăng ký workshop và giữ vé QR ngay trên điện thoại.">
          <Button title="Đăng nhập" onPress={() => router.push('/login?next=/workshop')} />
        </Empty>
      ) : (
        <>
          {mine.error ? <ErrorNote message={mine.error} onRetry={mine.reload} /> : null}
          {mine.loading && !mine.data && <Loading />}
          {mine.data && regs.length === 0 && (
            <Empty icon="ticket" title="Bé chưa có vé nào" text="Chọn một buổi trong lịch học để đăng ký cho bé.">
              <Button title="Xem lịch học" onPress={() => router.setParams({ tab: 'schedule' })} />
            </Empty>
          )}
          {soon.length > 0 && <H size={19}>Sắp tới</H>}
          {soon.map((r) => <View key={r.id}>{ticket(r)}</View>)}
          {past.length > 0 && <H size={19}>Đã qua</H>}
          {past.map((r) => <View key={r.id}>{ticket(r)}</View>)}
        </>
      )}

      <Sheet open={Boolean(detail)} title="Chi tiết buổi học" onClose={() => setDetail(null)}
        footer={detail ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={s.price}>{detail.price > 0 ? formatPrice(detail.price) : 'Miễn phí'}</Text>
              {detail.price > 0 ? <Text style={s.perChild}>mỗi bé</Text> : null}
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
            <T>Quét mã để thanh toán “{paying.reg.workshop.title}”. Suất được xác nhận tự động khi tiền về.</T>
            <PayPanel transfer={paying.info} returnPath="/workshop?tab=tickets" />
          </>
        )}
      </Sheet>

      <Sheet open={Boolean(bigTicket)} title="Vé workshop" onClose={() => setBigTicket(null)}>
        {bigTicket && (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <T bold style={{ textAlign: 'center' }}>{bigTicket.workshop.title}</T>
            <T muted style={{ textAlign: 'center' }}>{formatWorkshopWhen(bigTicket.workshop)}</T>
            <View style={s.bigQr}><TicketQr value={bigTicket.ticket} size={240} /></View>
            <Text selectable style={[s.ticketCode, { fontSize: 22 }]}>{bigTicket.ticket}</Text>
            <T muted style={{ textAlign: 'center' }}>{bigTicket.childCount} bé · Đưa mã này cho nhân viên khi tới buổi học.</T>
          </View>
        )}
      </Sheet>

      <Sheet open={askLogin} title="Đăng nhập để đăng ký" onClose={() => setAskLogin(false)}>
        <T muted>Chỗ chỉ được giữ sau khi bạn đăng ký xong. Đăng nhập để Sprouty gửi vé QR cho bé.</T>
        <Button title="Đăng nhập" onPress={() => { setAskLogin(false); router.push('/login?next=/workshop'); }} />
        <Button title="Tạo tài khoản mới" variant="ghost" onPress={() => { setAskLogin(false); router.push('/register?next=/workshop'); }} />
      </Sheet>

      <ReviewSheet target={writing?.target ?? null} existing={writing?.existing} options={mine.data?.reviews?.options}
        onClose={() => setWriting(null)} onSaved={() => { void mine.reload(); }} />
    </Screen>
  );
}

const s = StyleSheet.create({
  segment: { flexDirection: 'row', padding: 4, borderRadius: radius.pill, backgroundColor: '#EEF2E8', gap: 4 },
  segBtn: { flex: 1, minHeight: 44, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segOn: { backgroundColor: colors.green },
  segText: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.ink2 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 40, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card },
  toggleOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  box: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: colors.ink5, alignItems: 'center', justifyContent: 'center' },
  boxOn: { borderColor: colors.green, backgroundColor: colors.green },
  toggleText: { fontFamily: fonts.semi, fontSize: 13.5, color: colors.ink2 },
  chipsOuter: { marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16 },
  monthTitle: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.ink4, marginLeft: 4 },
  list: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card, overflow: 'hidden' },
  srow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingLeft: 12, paddingTop: 12 },
  cal: { width: 50, borderRadius: 12, borderWidth: 1, borderColor: '#CFE9C9', backgroundColor: colors.greenSoft, alignItems: 'center', paddingVertical: 6 },
  calWd: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.green },
  calDay: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, color: colors.ink },
  srowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingRight: 12, paddingBottom: 12 },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  srowTitle: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 21, color: colors.ink },
  srowMeta: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink3 },
  srowFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  srowPrice: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.price },
  seatPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  seatPillText: { fontFamily: fonts.bold, fontSize: 11.5 },
  listTitle: { fontFamily: fonts.display, fontSize: 19, color: colors.ink },
  score: { fontFamily: fonts.semi, fontSize: 13, color: colors.ink3 },
  photo: { width: '100%', aspectRatio: 2, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  dateBadge: { position: 'absolute', top: 12, left: 12, width: 54, borderRadius: 12, backgroundColor: colors.card, alignItems: 'center', overflow: 'hidden' },
  dateMonth: { alignSelf: 'stretch', textAlign: 'center', paddingVertical: 2, backgroundColor: colors.green, color: colors.white, fontFamily: fonts.bold, fontSize: 11 },
  dateDay: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.ink, paddingBottom: 2 },
  seats: { position: 'absolute', top: 12, right: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.card },
  seatsText: { fontFamily: fonts.bold, fontSize: 12, color: colors.greenDark },
  sessionTitle: { fontFamily: fonts.display, fontSize: 19, lineHeight: 25, color: colors.ink },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: { fontFamily: fonts.medium, fontSize: 14, color: colors.ink2 },
  desc: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 20, color: colors.ink3 },
  perChild: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  price: { fontFamily: fonts.bold, fontSize: 19, color: colors.price },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  choice: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, alignItems: 'flex-start' },
  choiceOn: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.ink5, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  radioOn: { borderColor: colors.green },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.green },
  flow: { flexDirection: 'row' },
  flowLine: { position: 'absolute', top: 20, left: '12.5%', right: '12.5%', height: 1.5, backgroundColor: '#BFDDB6' },
  flowStep: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 2 },
  flowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1.5, borderColor: '#BFDDB6', alignItems: 'center', justifyContent: 'center' },
  flowText: { fontFamily: fonts.semi, fontSize: 12.5, lineHeight: 17, color: colors.ink2, textAlign: 'center' },
  ticketThumb: { width: 64, height: 64, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  ticket: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#CFE9C9', backgroundColor: colors.cream2 },
  ticketCode: { fontFamily: fonts.bold, fontSize: 16, letterSpacing: 1.5, color: colors.ink },
  bigQr: { padding: 16, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  reviewBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 42, paddingHorizontal: 6 },
  reviewText: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.green },
});
