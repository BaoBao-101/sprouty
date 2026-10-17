import { requireEmployee, requireCsrf } from '../../middleware/rbac.js';
import { auditLog } from '../../services/audit.js';
import { AppError } from '../../utils/errors.js';
import { publicReview, workshopRatingSummary } from '../../services/reviews.js';

/**
 * The employee's workshops: the sessions an admin put them on, and the door.
 *
 * Paying and turning up are different facts, and until now only the first was
 * recorded. A session's register was a list of people who had paid at some
 * point in the past; nobody on the door could mark who had actually arrived,
 * and the parent had nothing to be checked against.
 *
 * An employee sees a session only once an admin has put them on it — not the
 * shop's whole schedule, and not anyone's register but their own sessions'.
 * Every route below checks that, the ticket lookup included, so a code read
 * out for somebody else's session tells them nothing about it.
 */

const staff = [requireEmployee, requireCsrf];

/**
 * A short code the parent can read out.
 *
 * Derived from the id rather than stored: it needs to be stable, unique and
 * printable, and the id already is all three. A column would be one more thing
 * to generate, migrate and keep in step for no gain. Six characters of a cuid
 * is plenty to disambiguate within one session's register.
 */
export function ticketCode(registrationId) {
  return registrationId.slice(-6).toUpperCase();
}

/** The calendar day in Vietnam, whatever the server's clock is set to. */
function vnDay(date) {
  return new Date(new Date(date).getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

/** Midnight in Vietnam at the start of today. The container runs on UTC. */
function vnToday() {
  return new Date(`${vnDay(new Date())}T00:00:00+07:00`);
}

/** How far back "Đã qua" goes: enough to reconcile a month, not a history. */
const PAST_DAYS = 90;

const NOT_YOURS = 'Bạn không phụ trách buổi workshop này.';

const sessionStaff = {
  select: { user: { select: { id: true, name: true, role: true, status: true } } },
  orderBy: { assignedAt: 'asc' },
};

const sessionRegistrations = {
  where: { status: { not: 'cancelled' } },
  select: { childCount: true, attendedCount: true, checkedInAt: true, paidAt: true, amount: true },
};

/** A session as the employee's list shows it: when, where, and the counts. */
function sessionDto(w, viewerId) {
  const booked = w.registrations.reduce((n, r) => n + r.childCount, 0);
  const arrived = w.registrations.reduce(
    (n, r) => n + (r.checkedInAt ? (r.attendedCount ?? r.childCount) : 0),
    0,
  );
  return {
    id: w.id,
    title: w.title,
    day: vnDay(w.dateTime),
    dateTime: w.dateTime,
    endTime: w.endTime,
    location: w.location,
    capacity: w.capacity,
    status: w.status,
    bookings: w.registrations.length,
    checkedIn: w.registrations.filter((r) => r.checkedInAt).length,
    bookedSeats: booked,
    arrivedSeats: arrived,
    // A free ticket has nothing to collect, so it is not "chưa thu".
    unpaid: w.registrations.filter((r) => !r.paidAt && r.amount > 0).length,
    // The colleagues on it with them — people who can still open this screen.
    coworkers: (w.staff || [])
      .filter((s) => s.user.id !== viewerId && s.user.role === 'employee' && s.user.status === 'active')
      .map((s) => ({ id: s.user.id, name: s.user.name })),
  };
}

/** The register row, with everything the door needs and nothing else. */
function attendeeDto(r) {
  return {
    id: r.id,
    ticket: ticketCode(r.id),
    name: r.user?.name || r.guestName || 'Khách',
    email: r.user?.email || r.guestEmail || null,
    phone: r.guestPhone || null,
    childAge: r.childAge,
    childCount: r.childCount,
    note: r.note,
    status: r.status,
    amount: r.amount,
    paidAt: r.paidAt,
    paymentMethod: r.paymentMethod,
    checkedInAt: r.checkedInAt,
    attendedCount: r.attendedCount,
    checkedInBy: r.checkedInBy?.name || null,
  };
}

const attendeeInclude = {
  user: { select: { id: true, name: true, email: true } },
  checkedInBy: { select: { name: true } },
};

/** Whether an admin put this employee on this session. */
async function isAssigned(prisma, workshopId, userId) {
  const row = await prisma.workshopStaff.findUnique({
    where: { workshopId_userId: { workshopId, userId } },
    select: { userId: true },
  });
  return Boolean(row);
}

export default async function attendanceRoutes(fastify) {
  /**
   * GET /api/v1/admin/attendance/mine?when=upcoming|past — my sessions.
   *
   * "upcoming" is everything from the start of today, so a session that
   * finished this morning is still there to be reconciled this afternoon.
   * "past" is the ninety days before that, newest first. Drafts and cancelled
   * sessions stay, marked: an employee put on one should know either way.
   */
  fastify.get('/attendance/mine', { preHandler: [requireEmployee] }, async (req) => {
    const past = req.query.when === 'past';
    const today = vnToday();
    const workshops = await fastify.prisma.workshop.findMany({
      where: {
        staff: { some: { userId: req.user.id } },
        dateTime: past
          ? { lt: today, gte: new Date(today.getTime() - PAST_DAYS * 86_400_000) }
          : { gte: today },
      },
      orderBy: { dateTime: past ? 'desc' : 'asc' },
      take: 200,
      include: { registrations: sessionRegistrations, staff: sessionStaff },
    });
    return { sessions: workshops.map((w) => sessionDto(w, req.user.id)) };
  });

  /**
   * GET /api/v1/admin/attendance/lookup?code=ABC123 — who is this?
   *
   * The parent shows a QR, or reads six characters out. Either way staff
   * end up with the same string here, and get back everything they need to
   * decide: which session, how many children, and whether it is paid for —
   * for a ticket to one of their own sessions.
   *
   * Declared before /attendance/:workshopId so "lookup" is not swallowed as
   * a workshop id.
   */
  fastify.get('/attendance/lookup', { preHandler: [requireEmployee] }, async (req, reply) => {
    const code = String(req.query.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,24}$/.test(code)) {
      return reply.code(400).send({ message: 'Mã vé không hợp lệ.' });
    }

    // The code is the tail of the id rather than a column, so this has to be
    // a suffix match. LIKE rather than RIGHT(id, n): Prisma sends a JS number
    // as bigint, and Postgres has no right(text, bigint).
    // Only among this employee's sessions, so two tickets that share a tail
    // elsewhere in the shop do not make theirs ambiguous.
    const found = await fastify.prisma.$queryRaw`
      SELECT r.id FROM "WorkshopRegistration" r
      JOIN "WorkshopStaff" s ON s."workshopId" = r."workshopId" AND s."userId" = ${req.user.id}
      WHERE UPPER(r.id) LIKE ${`%${code}`}
      LIMIT 2
    `;

    if (found.length === 0) {
      const elsewhere = await fastify.prisma.$queryRaw`
        SELECT id FROM "WorkshopRegistration" WHERE UPPER(id) LIKE ${`%${code}`} LIMIT 1
      `;
      return reply.code(404).send({
        message: elsewhere.length
          ? `Vé ${code} thuộc buổi bạn không phụ trách.`
          : `Không tìm thấy vé ${code}.`,
      });
    }
    if (found.length > 1) {
      return reply
        .code(409)
        .send({ message: 'Mã này trùng với nhiều vé. Nhập thêm ký tự hoặc tra theo tên.' });
    }

    const registration = await fastify.prisma.workshopRegistration.findUnique({
      where: { id: found[0].id },
      include: {
        ...attendeeInclude,
        workshop: { select: { id: true, title: true, dateTime: true, endTime: true, location: true, status: true } },
      },
    });

    return { attendee: attendeeDto(registration), workshop: registration.workshop };
  });

  /**
   * GET /api/v1/admin/attendance/:workshopId — one of my sessions: what it is,
   * who else is on it, the register, and what the families who came thought
   * of it. The feedback is what the public page shows: published reviews,
   * names masked the same way.
   */
  fastify.get('/attendance/:workshopId', { preHandler: [requireEmployee] }, async (req, reply) => {
    if (!await isAssigned(fastify.prisma, req.params.workshopId, req.user.id)) {
      return reply.code(403).send({ message: NOT_YOURS });
    }
    const workshop = await fastify.prisma.workshop.findUnique({
      where: { id: req.params.workshopId },
      include: { registrations: sessionRegistrations, staff: sessionStaff },
    });
    if (!workshop) return reply.code(404).send({ message: 'Không tìm thấy workshop.' });

    const rows = await fastify.prisma.workshopRegistration.findMany({
      where: { workshopId: workshop.id, status: { not: 'cancelled' } },
      include: attendeeInclude,
      orderBy: { createdAt: 'asc' },
    });
    // Not yet arrived first: the queue at the door is the whole point of the
    // screen. Sorted here, not by `checkedInAt asc`: PostgreSQL puts NULLs
    // last in an ascending sort, which put everyone still to come at the
    // bottom.
    rows.sort((a, b) => Number(Boolean(a.checkedInAt)) - Number(Boolean(b.checkedInAt)));

    const [summary, reviews] = await Promise.all([
      workshopRatingSummary(fastify.prisma, workshop.id),
      fastify.prisma.workshopReview.findMany({
        where: { workshopId: workshop.id, status: 'published' },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        // All of them: one per family that was there, so a session can only
        // have as many as it had bookings. The page shows them five at a time.
      }),
    ]);

    return {
      workshop: {
        ...sessionDto(workshop, req.user.id),
        description: workshop.description,
        imageUrl: workshop.imageUrl,
        ageRange: workshop.ageRange,
        price: workshop.price,
      },
      attendees: rows.map(attendeeDto),
      feedback: { summary, reviews: reviews.map(publicReview) },
    };
  });

  /**
   * POST /api/v1/admin/attendance/:workshopId/:registrationId — they arrived.
   *
   * Idempotent on purpose: a second tap on a crowded morning should confirm
   * what is already true rather than fail, so the person on the door never has
   * to work out whether their first tap registered.
   */
  fastify.post('/attendance/:workshopId/:registrationId', { preHandler: staff }, async (req, reply) => {
    if (!await isAssigned(fastify.prisma, req.params.workshopId, req.user.id)) {
      return reply.code(403).send({ message: NOT_YOURS });
    }
    const registration = await fastify.prisma.workshopRegistration.findFirst({
      where: { id: req.params.registrationId, workshopId: req.params.workshopId },
      include: { workshop: { select: { status: true } } },
    });
    if (!registration) return reply.code(404).send({ message: 'Không tìm thấy đăng ký.' });
    if (registration.status === 'cancelled') {
      return reply.code(400).send({ message: 'Đăng ký này đã huỷ, không điểm danh được.' });
    }
    if (registration.workshop.status === 'cancelled') {
      return reply.code(409).send({ message: 'Buổi workshop này đã huỷ, không điểm danh được.' });
    }

    const asked = Number.parseInt(req.body?.attendedCount, 10);
    const attendedCount =
      Number.isFinite(asked) && asked > 0 ? Math.min(asked, registration.childCount) : registration.childCount;

    const updated = await fastify.prisma.workshopRegistration.update({
      where: { id: registration.id },
      data: {
        checkedInAt: registration.checkedInAt ?? new Date(),
        checkedInByUserId: req.user.id,
        attendedCount,
      },
      include: attendeeInclude,
    });

    await auditLog(fastify.prisma, req.user.id, 'workshop.checkin', 'WorkshopRegistration', updated.id, {
      workshopId: updated.workshopId,
      attendedCount,
    });

    return { attendee: attendeeDto(updated) };
  });

  /**
   * POST /api/v1/admin/attendance/:workshopId/:registrationId/cash — paid at
   * the door.
   *
   * The person on the door takes the money, so they record it, at the moment
   * it changes hands. Kept narrow so it cannot become a way to write off a
   * debt: their own session, on its own day, the amount on the ticket, once,
   * and every one written to the audit log under the employee's name.
   * Correcting or refunding a payment stays with admins.
   */
  fastify.post('/attendance/:workshopId/:registrationId/cash', { preHandler: staff }, async (req, reply) => {
    if (!await isAssigned(fastify.prisma, req.params.workshopId, req.user.id)) {
      return reply.code(403).send({ message: NOT_YOURS });
    }
    const registration = await fastify.prisma.workshopRegistration.findFirst({
      where: { id: req.params.registrationId, workshopId: req.params.workshopId },
      include: { workshop: { select: { dateTime: true, status: true } } },
    });
    if (!registration) return reply.code(404).send({ message: 'Không tìm thấy đăng ký.' });
    if (registration.status === 'cancelled') {
      return reply.code(400).send({ message: 'Đăng ký này đã huỷ.' });
    }
    if (registration.workshop.status === 'cancelled') {
      return reply.code(409).send({ message: 'Buổi workshop này đã huỷ, không thu tiền.' });
    }
    if (registration.paidAt) return reply.code(409).send({ message: 'Vé này đã thanh toán rồi.' });
    if (!registration.amount) return reply.code(409).send({ message: 'Vé này không cần thu tiền.' });
    if (vnDay(registration.workshop.dateTime) !== vnDay(new Date())) {
      return reply.code(403).send({
        message: 'Chỉ ghi nhận thu tiền trong ngày diễn ra buổi học. Ngày khác, nhờ quản trị viên ghi nhận.',
      });
    }

    const { count } = await fastify.prisma.workshopRegistration.updateMany({
      where: { id: registration.id, paidAt: null },
      data: { paidAt: new Date(), paymentMethod: 'onsite' },
    });
    if (!count) return reply.code(409).send({ message: 'Vé này vừa được ghi nhận thanh toán.' });

    await auditLog(fastify.prisma, req.user.id, 'workshop.registration.cash_collected', 'WorkshopRegistration', registration.id, {
      workshopId: registration.workshopId,
      amount: registration.amount,
    });

    const updated = await fastify.prisma.workshopRegistration.findUnique({
      where: { id: registration.id },
      include: attendeeInclude,
    });
    return { attendee: attendeeDto(updated) };
  });

  /** DELETE — ticked off by mistake. */
  fastify.delete('/attendance/:workshopId/:registrationId', { preHandler: staff }, async (req, reply) => {
    if (!await isAssigned(fastify.prisma, req.params.workshopId, req.user.id)) {
      return reply.code(403).send({ message: NOT_YOURS });
    }
    const registration = await fastify.prisma.workshopRegistration.findFirst({
      where: { id: req.params.registrationId, workshopId: req.params.workshopId },
    });
    if (!registration) return reply.code(404).send({ message: 'Không tìm thấy đăng ký.' });

    const updated = await fastify.prisma.workshopRegistration.update({
      where: { id: registration.id },
      data: { checkedInAt: null, checkedInByUserId: null, attendedCount: null },
      include: attendeeInclude,
    });

    await auditLog(
      fastify.prisma,
      req.user.id,
      'workshop.checkin.undo',
      'WorkshopRegistration',
      updated.id,
      { workshopId: updated.workshopId },
    );

    return { attendee: attendeeDto(updated) };
  });
}
