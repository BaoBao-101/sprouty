import { requireEmployee, requireCsrf } from '../../middleware/rbac.js';
import { auditLog } from '../../services/audit.js';
import { AppError } from '../../utils/errors.js';

/**
 * Attendance on the day.
 *
 * Paying and turning up are different facts, and until now only the first was
 * recorded. A session's register was a list of people who had paid at some
 * point in the past; nobody on the door could mark who had actually arrived,
 * and the parent had nothing to be checked against.
 *
 * Employees own this, not just admins — the person on the door is the one
 * holding the tablet, and making them an admin to tick a box would be the
 * wrong way round.
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

export default async function attendanceRoutes(fastify) {
  /**
   * GET /api/v1/admin/attendance — sessions worth standing at a door for.
   *
   * Defaults to today, because that is the only question anyone asks this
   * screen. `date` overrides it for a session being reconciled afterwards.
   */
  fastify.get('/attendance', { preHandler: [requireEmployee] }, async (req) => {
    const day = req.query.date ? new Date(`${req.query.date}T00:00:00`) : new Date();
    if (Number.isNaN(day.getTime())) throw new AppError('Ngày không hợp lệ.', 400);

    const from = new Date(day);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);

    const workshops = await fastify.prisma.workshop.findMany({
      where: { dateTime: { gte: from, lt: to } },
      orderBy: { dateTime: 'asc' },
      include: {
        registrations: {
          where: { status: { not: 'cancelled' } },
          select: { childCount: true, attendedCount: true, checkedInAt: true, paidAt: true },
        },
      },
    });

    return {
      date: from.toISOString().slice(0, 10),
      workshops: workshops.map((w) => {
        const booked = w.registrations.reduce((n, r) => n + r.childCount, 0);
        const arrived = w.registrations.reduce(
          (n, r) => n + (r.checkedInAt ? (r.attendedCount ?? r.childCount) : 0),
          0,
        );
        return {
          id: w.id,
          title: w.title,
          dateTime: w.dateTime,
          endTime: w.endTime,
          location: w.location,
          capacity: w.capacity,
          bookings: w.registrations.length,
          checkedIn: w.registrations.filter((r) => r.checkedInAt).length,
          bookedSeats: booked,
          arrivedSeats: arrived,
          unpaid: w.registrations.filter((r) => !r.paidAt).length,
        };
      }),
    };
  });

  /**
   * GET /api/v1/admin/attendance/lookup?code=ABC123 — who is this?
   *
   * The parent shows a QR, or reads six characters out. Either way staff
   * end up with the same string here, and get back everything they need to
   * decide: which session, how many children, and whether it is paid for.
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
    // a suffix match. The table is small and this runs once per person at a
    // door; a stored column would be one more thing to generate and keep in
    // step for no gain anyone would notice.
    // LIKE rather than RIGHT(id, n): Prisma sends a JS number as bigint, and
    // Postgres has no right(text, bigint) — the call failed outright. A
    // trailing-wildcard match is the same suffix test without the cast.
    const found = await fastify.prisma.$queryRaw`
      SELECT id FROM "WorkshopRegistration"
      WHERE UPPER(id) LIKE ${`%${code}`}
      LIMIT 2
    `;

    if (found.length === 0) {
      return reply.code(404).send({ message: `Không tìm thấy vé ${code}.` });
    }
    if (found.length > 1) {
      return reply
        .code(409)
        .send({ message: 'Mã này trùng với nhiều vé. Nhập thêm ký tự hoặc tra theo tên.' });
    }

    const registration = await fastify.prisma.workshopRegistration.findUnique({
      where: { id: found[0].id },
      include: {
        workshop: true,
        user: { select: { id: true, name: true, email: true } },
        checkedInBy: { select: { name: true } },
      },
    });

    return { attendee: attendeeDto(registration), workshop: registration.workshop };
  });

  /** GET /api/v1/admin/attendance/:workshopId — the register itself. */
  fastify.get('/attendance/:workshopId', { preHandler: [requireEmployee] }, async (req, reply) => {
    const workshop = await fastify.prisma.workshop.findUnique({
      where: { id: req.params.workshopId },
    });
    if (!workshop) return reply.code(404).send({ message: 'Không tìm thấy workshop.' });

    const rows = await fastify.prisma.workshopRegistration.findMany({
      where: { workshopId: workshop.id, status: { not: 'cancelled' } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        checkedInBy: { select: { name: true } },
      },
      // Not yet arrived first: the queue at the door is the whole point of the
      // screen, and someone already ticked off is no longer anyone's problem.
      orderBy: [{ checkedInAt: 'asc' }, { createdAt: 'asc' }],
    });

    return { workshop, attendees: rows.map(attendeeDto) };
  });

  /**
   * POST /api/v1/admin/attendance/:workshopId/:registrationId — they arrived.
   *
   * Idempotent on purpose: a second tap on a crowded morning should confirm
   * what is already true rather than fail, so the person on the door never has
   * to work out whether their first tap registered.
   */
  fastify.post('/attendance/:workshopId/:registrationId', { preHandler: staff }, async (req, reply) => {
    const registration = await fastify.prisma.workshopRegistration.findFirst({
      where: { id: req.params.registrationId, workshopId: req.params.workshopId },
    });
    if (!registration) return reply.code(404).send({ message: 'Không tìm thấy đăng ký.' });
    if (registration.status === 'cancelled') {
      return reply.code(400).send({ message: 'Đăng ký này đã huỷ, không điểm danh được.' });
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
      include: {
        user: { select: { id: true, name: true, email: true } },
        checkedInBy: { select: { name: true } },
      },
    });

    await auditLog(fastify.prisma, req.user.id, 'workshop.checkin', 'WorkshopRegistration', updated.id, {
      workshopId: updated.workshopId,
      attendedCount,
    });

    return { attendee: attendeeDto(updated) };
  });

  /** DELETE — ticked off by mistake. */
  fastify.delete('/attendance/:workshopId/:registrationId', { preHandler: staff }, async (req, reply) => {
    const registration = await fastify.prisma.workshopRegistration.findFirst({
      where: { id: req.params.registrationId, workshopId: req.params.workshopId },
    });
    if (!registration) return reply.code(404).send({ message: 'Không tìm thấy đăng ký.' });

    const updated = await fastify.prisma.workshopRegistration.update({
      where: { id: registration.id },
      data: { checkedInAt: null, checkedInByUserId: null, attendedCount: null },
      include: {
        user: { select: { id: true, name: true, email: true } },
        checkedInBy: { select: { name: true } },
      },
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
