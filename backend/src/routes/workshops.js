import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import { requireAuth, requireCsrf } from '../middleware/rbac.js';
import { ticketCode } from './admin/attendance.js';
import { reconcile, pollingConfigured } from '../services/sepay.js';
import {
  assertRewardAvailable,
  claimRewardsTx,
  releaseRewardForRegistration,
  rewardThreshold,
} from '../services/rewards.js';

const regSchema = z.object({
  workshopId: z.string().min(1, 'Chưa chọn buổi workshop.').max(64),
  guestName: z.string()
    .min(2, 'Họ tên phải có ít nhất 2 ký tự.')
    .max(100, 'Họ tên tối đa 100 ký tự.')
    .refine(s => !/[<>]/.test(s), { message: 'Tên không được chứa ký tự < hoặc >.' })
    .optional(),
  guestPhone: z.string().regex(/^[0-9]{8,11}$/, 'Số điện thoại không hợp lệ.').optional(),
  guestEmail: z.string().email('Email không hợp lệ.').max(200).optional().or(z.literal('')),
  // These three were asked for on the public form and then dropped on the floor
  // — the payload never carried them and the table had nowhere to put them.
  childAge: z.string().max(50, 'Độ tuổi tối đa 50 ký tự.')
    .refine(s => !/[<>]/.test(s), { message: 'Độ tuổi không được chứa ký tự < hoặc >.' })
    .optional().or(z.literal('')),
  childCount: z.coerce.number({ invalid_type_error: 'Số bé phải là một số.' })
    .int('Số bé phải là số nguyên.')
    .min(1, 'Phải có ít nhất 1 bé.')
    .max(10, 'Tối đa 10 bé cho một lượt đăng ký.')
    .optional().default(1),
  note: z.string().max(1000, 'Ghi chú tối đa 1000 ký tự.')
    .refine(s => !/[<>]/.test(s), { message: 'Ghi chú không được chứa ký tự < hoặc >.' })
    .optional().or(z.literal('')),
  paymentMethod: z.enum(['online', 'onsite'], {
    errorMap: () => ({ message: 'Hình thức thanh toán không hợp lệ.' }),
  }).optional().default('onsite'),
  // Spend a "mua 3 tặng 1" reward on this booking. Signed-in customers only:
  // a reward belongs to an account, and a guest has none to spend.
  // A count, not a flag. The promotion gives a seat per reward, and a
  // parent booking three children with two rewards should pay for one —
  // which a boolean cannot express.
  rewardCount: z.coerce.number({ invalid_type_error: 'Số suất miễn phí không hợp lệ.' })
    .int('Số suất miễn phí phải là số nguyên.')
    .min(0, 'Số suất miễn phí không hợp lệ.')
    .max(20, 'Tối đa 20 suất miễn phí cho một lần đăng ký.')
    .optional()
    .default(0),
  // Kept so a client that has not been reloaded still works; one tick is
  // one reward.
  useReward: z.boolean().optional().default(false),
});

/**
 * Bank-transfer instructions for one registration, mirroring the order flow.
 * Returns null when SePay is unconfigured, so booking still works in dev.
 *
 * The memo carries a "WS" marker before the id suffix: the webhook matches
 * orders by the same pattern, and without it a workshop payment could be
 * credited against an order whose id happened to end the same way.
 */
function buildWorkshopPayment(registration) {
  const acc = process.env.SEPAY_ACCOUNT_NUMBER;
  const bank = process.env.SEPAY_BANK_CODE;
  const name = process.env.SEPAY_ACCOUNT_NAME;
  if (!acc || !bank) return null;
  const memo = 'SPROUTYWS' + registration.id.slice(-8).toUpperCase();
  return {
    qrUrl: `https://qr.sepay.vn/img?acc=${encodeURIComponent(acc)}&bank=${encodeURIComponent(bank)}&amount=${registration.amount}&des=${encodeURIComponent(memo)}`,
    bankCode: bank,
    accountNumber: acc,
    accountName: name || '',
    memo,
    amount: registration.amount,
  };
}

/**
 * Seats are counted in children, not rows: one parent can book three places.
 * Counting rows would have let a full session keep accepting registrations.
 */
async function seatsTaken(prisma, workshopId) {
  const result = await prisma.workshopRegistration.aggregate({
    where: { workshopId, status: { not: 'cancelled' } },
    _sum: { childCount: true },
  });
  return result._sum.childCount || 0;
}

/** What the public page needs, and nothing about who else has signed up. */
function publicWorkshop(workshop, taken) {
  return {
    id: workshop.id,
    title: workshop.title,
    description: workshop.description,
    imageUrl: workshop.imageUrl,
    dateTime: workshop.dateTime,
    endTime: workshop.endTime,
    location: workshop.location,
    ageRange: workshop.ageRange,
    price: workshop.price,
    capacity: workshop.capacity,
    seatsTaken: taken,
    seatsLeft: Math.max(0, workshop.capacity - taken),
    isFull: taken >= workshop.capacity,
    upcoming: isUpcoming(workshop),
  };
}

/**
 * Still worth listing. Measured against the end time where one is known, so a
 * session running 9:00–11:30 does not vanish from the page at 9:01 while it is
 * actually going on.
 */
function isUpcoming(workshop) {
  return (workshop.endTime ?? workshop.dateTime) > new Date();
}

export default async function workshopRoutes(fastify) {
  // GET /api/v1/workshops
  fastify.get('/workshops', async () => {
    // Drafts and cancelled sessions are not offered to customers.
    const workshops = await fastify.prisma.workshop.findMany({
      where: { status: 'published' },
      orderBy: { dateTime: 'asc' },
      include: {
        registrations: {
          where: { status: { not: 'cancelled' } },
          select: { childCount: true },
        },
      },
    });

    return {
      workshops: workshops.map(w =>
        publicWorkshop(w, w.registrations.reduce((sum, r) => sum + r.childCount, 0)),
      ),
      // So the page can advertise "mua 3 tặng 1" to a visitor who is not
      // signed in yet, without hardcoding the number in the markup.
      promo: { freeWorkshopThreshold: rewardThreshold() },
    };
  });

  // GET /api/v1/workshops/:id
  fastify.get('/workshops/:id', async (req, reply) => {
    const workshop = await fastify.prisma.workshop.findUnique({ where: { id: req.params.id } });
    if (!workshop || workshop.status !== 'published') {
      return reply.code(404).send({ message: 'Không tìm thấy workshop.' });
    }
    return { workshop: publicWorkshop(workshop, await seatsTaken(fastify.prisma, workshop.id)) };
  });

  // GET /api/v1/me/workshops — what this customer has signed up for.
  //
  // Registering gave no receipt anywhere in the account: once the confirmation
  // dialog closed there was no way to check when the session was, where it was,
  // or whether staff had confirmed the seat.
  fastify.get('/me/workshops', { preHandler: [requireAuth] }, async (req) => {
    // Same reason as the order page: a booking paid by QR is credited by a
    // webhook SePay cannot deliver to a laptop. Asking SePay directly costs
    // one throttled call and makes the two environments behave alike.
    if (pollingConfigured()) {
      const unpaid = await fastify.prisma.workshopRegistration.findFirst({
        where: { userId: req.user.id, paidAt: null, status: { not: 'cancelled' }, amount: { gt: 0 } },
        select: { id: true },
      });
      if (unpaid) await reconcile(fastify);
    }

    const rows = await fastify.prisma.workshopRegistration.findMany({
      where: { userId: req.user.id },
      include: { workshop: true },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    return {
      registrations: rows.map(r => ({
        id: r.id,
        status: r.status,
        childAge: r.childAge,
        childCount: r.childCount,
        note: r.note,
        guestName: r.guestName,
        guestPhone: r.guestPhone,
        paymentMethod: r.paymentMethod,
        amount: r.amount,
        paidAt: r.paidAt,
        // The ticket: what staff ask for at the door, and the record of
        // whether the child actually arrived. Paying and attending are
        // different facts, and the account only ever showed the first.
        ticket: ticketCode(r.id),
        checkedInAt: r.checkedInAt,
        attendedCount: r.attendedCount,
        createdAt: r.createdAt,
        upcoming: (r.workshop.endTime ?? r.workshop.dateTime) > now,
        workshop: {
          id: r.workshop.id,
          title: r.workshop.title,
          description: r.workshop.description,
          imageUrl: r.workshop.imageUrl,
          dateTime: r.workshop.dateTime,
          endTime: r.workshop.endTime,
          location: r.workshop.location,
          ageRange: r.workshop.ageRange,
          price: r.workshop.price,
          status: r.workshop.status,
        },
      })),
    };
  });

  // PATCH /api/v1/me/workshops/:registrationId/cancel — let a customer give the
  // seat back themselves rather than having to phone in.
  fastify.patch('/me/workshops/:registrationId/cancel', {
    preHandler: [requireAuth, requireCsrf],
  }, async (req, reply) => {
    const registration = await fastify.prisma.workshopRegistration.findUnique({
      where: { id: req.params.registrationId },
      include: { workshop: true },
    });
    // Same 404 whether it does not exist or belongs to someone else, so this
    // cannot be used to probe for other people's bookings.
    if (!registration || registration.userId !== req.user.id) {
      return reply.code(404).send({ message: 'Không tìm thấy lượt đăng ký.' });
    }
    if (registration.status === 'cancelled') {
      return reply.code(409).send({ message: 'Lượt đăng ký này đã huỷ rồi.' });
    }
    if ((registration.workshop.endTime ?? registration.workshop.dateTime) < new Date()) {
      return reply.code(409).send({ message: 'Buổi workshop này đã diễn ra, không thể huỷ.' });
    }

    const updated = await fastify.prisma.workshopRegistration.update({
      where: { id: registration.id },
      data: { status: 'cancelled' },
    });

    // Give the free seats back. Without this, cancelling a rewarded booking
    // would quietly burn the rewards — the customer bought three kits and
    // would have nothing to show for it.
    const released = await releaseRewardForRegistration(fastify.prisma, registration.id);

    return {
      message: released
        ? `Đã huỷ đăng ký. ${released} suất workshop miễn phí đã được trả lại cho bạn.`
        : 'Đã huỷ đăng ký. Chỗ được mở lại cho người khác.',
      registration: updated,
      rewardReturned: released > 0,
      rewardsReturned: released,
    };
  });

  // POST /api/v1/workshops/register
  // Booking requires an account.
  //
  // Guests used to be able to book, which left a seat nobody could manage: the
  // customer had no way to see it, cancel it, or fetch the transfer details
  // again, and a paid booking could not be tied to the person who paid. Every
  // seat now belongs to an account, so "Workshop của tôi" is complete and the
  // free-seat reward has an owner to debit.
  fastify.post('/workshops/register', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    preHandler: [requireAuth, requireCsrf],
  }, async (req, reply) => {
    const parsed = regSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.' });
    }

    const {
      workshopId, guestName, guestPhone, guestEmail, childAge, childCount, note, paymentMethod,
      useReward,
    } = parsed.data;

    // Never more rewards than children: a fourth reward on a booking for
    // three would be spent on nothing.
    const wantedRewards = Math.min(
      parsed.data.rewardCount || (useReward ? 1 : 0),
      childCount,
    );

    if (wantedRewards > 0) {
      // Checked here for a clear message before any seat arithmetic; the claim
      // itself is guarded again inside the transaction below, which is what
      // actually stops two bookings spending one reward.
      await assertRewardAvailable(fastify.prisma, req.user.id, wantedRewards);
    }

    const workshop = await fastify.prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) return reply.code(404).send({ message: 'Không tìm thấy workshop.' });
    if (workshop.status !== 'published') {
      return reply.code(409).send({ message: 'Buổi workshop này hiện không mở đăng ký.' });
    }
    if (workshop.dateTime < new Date()) {
      return reply.code(409).send({ message: 'Buổi workshop này đã diễn ra.' });
    }

    const taken = await seatsTaken(fastify.prisma, workshopId);
    const left = workshop.capacity - taken;
    if (left <= 0) return reply.code(409).send({ message: 'Workshop đã đầy chỗ.' });
    if (childCount > left) {
      return reply.code(409).send({
        message: `Chỉ còn ${left} chỗ — không đủ cho ${childCount} bé.`,
      });
    }

    // Priced here, never from the client, and stored on the row so a later edit
    // to the workshop's price cannot change what this customer owes.
    //
    // A reward covers one child's seat, which is what the promotion offers —
    // "tặng 1 buổi workshop". Two rewards cover two seats; a parent booking
    // three children with two rewards still pays for the third, and the
    // response says so rather than letting them find out at the door.
    const fullAmount = workshop.price * childCount;
    const discount = Math.min(fullAmount, workshop.price * wantedRewards);
    const data = {
      workshopId,
      childCount,
      childAge: childAge || null,
      note: note || null,
      paymentMethod,
      amount: fullAmount - discount,
    };
    data.userId = req.user.id;
    // The contact details typed on the form are still recorded separately from
    // the account: the parent booking may not be the account holder, and staff
    // ring the number given here rather than the one on the profile.
    if (!guestPhone) {
      return reply.code(400).send({ message: 'Vui lòng nhập số điện thoại liên hệ.' });
    }
    data.guestName = guestName || req.user.name;
    data.guestPhone = guestPhone;
    data.guestEmail = guestEmail || req.user.email;

    // Booking more than once for the same session is allowed: a parent may come
    // back to add another child, or book for a friend's family. Capacity is
    // what limits the room, and it is checked above against the seat total, so
    // several bookings by one person cannot oversell it.
    //
    // The cost is that a mis-click makes a second booking. That is recoverable
    // — both appear under "Workshop của tôi" and either can be cancelled.
    // Nothing left to pay means the seat is secured the moment it is booked —
    // the same meaning `paidAt` carries everywhere else, so staff and the
    // customer's own list read it the same way.
    if (data.amount === 0) {
      data.paidAt = new Date();
      data.paymentMethod = 'online';
    }

    let registration;
    let rewardsSpent = 0;
    if (wantedRewards > 0) {
      // The claims and the registration go in one transaction: rewards marked
      // claimed against a booking that failed to insert would be gone for
      // nothing, and a discounted booking with no reward claimed would be a
      // free seat the customer never earned.
      registration = await fastify.prisma.$transaction(async (tx) => {
        const created = await tx.workshopRegistration.create({ data });
        const ids = await claimRewardsTx(tx, req.user.id, created.id, wantedRewards);
        if (ids.length !== wantedRewards) {
          // Lost the race, or a reward was spent in another tab. Rolling back
          // is right: charging a customer who asked to use their rewards,
          // without telling them, would be worse than making them try again.
          throw new AppError(
            'Suất workshop miễn phí của bạn vừa được dùng ở một đăng ký khác. Vui lòng tải lại trang.',
            409,
          );
        }
        return created;
      });
      rewardsSpent = wantedRewards;
    } else {
      registration = await fastify.prisma.workshopRegistration.create({ data });
    }

    reply.code(201);
    return {
      message: rewardsSpent
        ? registration.amount === 0
          ? `Đã dùng ${rewardsSpent} suất workshop miễn phí — chỗ của bé đã được giữ!`
          : `Đã áp dụng ${rewardsSpent} suất miễn phí. Phần còn lại vui lòng thanh toán để giữ chỗ.`
        : 'Đăng ký thành công!',
      registration,
      rewardApplied: rewardsSpent > 0,
      rewardsUsed: rewardsSpent,
      rewardDiscount: discount,
      // Only when there is something to pay: a free session needs no QR.
      payment:
        paymentMethod === 'online' && registration.amount > 0
          ? buildWorkshopPayment(registration)
          : null,
    };
  });

  // GET /api/v1/me/workshops/:registrationId/payment — the transfer details
  // again, for someone who closed the dialog or picked onsite and changed their
  // mind. Signed-in customers only; a guest booking has no account to prove
  // ownership from, and these instructions name an amount and a reference.
  fastify.get('/me/workshops/:registrationId/payment', {
    preHandler: [requireAuth],
  }, async (req, reply) => {
    const registration = await fastify.prisma.workshopRegistration.findUnique({
      where: { id: req.params.registrationId },
      include: { workshop: true },
    });
    if (!registration || registration.userId !== req.user.id) {
      return reply.code(404).send({ message: 'Không tìm thấy lượt đăng ký.' });
    }
    if (registration.paidAt) {
      return reply.code(409).send({ message: 'Lượt đăng ký này đã thanh toán rồi.' });
    }
    if (registration.status === 'cancelled') {
      return reply.code(409).send({ message: 'Lượt đăng ký này đã huỷ.' });
    }
    if (registration.amount <= 0) {
      return reply.code(409).send({ message: 'Buổi workshop này miễn phí.' });
    }

    // Switching to online is the point of asking for the QR.
    if (registration.paymentMethod !== 'online') {
      await fastify.prisma.workshopRegistration.update({
        where: { id: registration.id },
        data: { paymentMethod: 'online' },
      });
    }

    const payment = buildWorkshopPayment(registration);
    if (!payment) {
      return reply.code(503).send({ message: 'Thanh toán online tạm thời chưa khả dụng.' });
    }
    return { payment };
  });
}
