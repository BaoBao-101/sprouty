import { z } from 'zod';
import { requireAdmin, requireCsrf } from '../../middleware/rbac.js';
import { AppError } from '../../utils/errors.js';
import { multipartFields, noHtml, parseOrThrow } from '../../utils/validation.js';
import { auditLog } from '../../services/audit.js';
import { createAsset } from '../../services/storage/index.js';
import { readPaging, paged, searchOr } from './paging.js';

/** Seats, money and whether it has happened yet — the shape the table reads. */
function enrichWorkshop(w, now) {
  const taken = w.registrations.reduce((sum, r) => sum + r.childCount, 0);
  return {
    id: w.id,
    title: w.title,
    description: w.description,
    imageUrl: w.imageUrl,
    dateTime: w.dateTime,
    endTime: w.endTime,
    capacity: w.capacity,
    location: w.location,
    ageRange: w.ageRange,
    price: w.price,
    status: w.status,
    registrations: taken,
    bookingCount: w.registrations.length,
    // Seats actually paid for, and money in the bank for this session — an
    // onsite booking is only a promise until someone turns up.
    paidSeats: w.registrations.reduce((sum, r) => sum + (r.paidAt ? r.childCount : 0), 0),
    paidAmount: w.registrations.reduce((sum, r) => sum + (r.paidAt ? r.amount : 0), 0),
    pctFull: w.capacity > 0 ? Math.round((taken / w.capacity) * 100) : 0,
    // Measured against the end time where one is known, matching the public
    // route — otherwise a session in progress reads as "đã diễn ra" here
    // while it is still listed for customers.
    upcoming: (w.endTime ?? w.dateTime) > now,
    // Between the two, the session is running: closed to bookings, not over.
    started: w.dateTime <= now,
    // Who runs it. Someone whose account was disabled or who stopped being
    // an employee stays listed, marked, until an admin takes them off.
    staff: (w.staff || []).map((s) => ({
      id: s.user.id,
      name: s.user.name,
      email: s.user.email,
      active: isOnStaff(s.user),
    })),
    // A published session still to come with nobody able to run it.
    needsStaff: w.status === 'published'
      && (w.endTime ?? w.dateTime) > now
      && !(w.staff || []).some((s) => isOnStaff(s.user)),
  };
}

/** Somebody who can actually be on the door: an active employee account. */
function isOnStaff(user) {
  return user.role === 'employee' && user.status === 'active';
}

const STAFF_INCLUDE = {
  include: { user: { select: { id: true, name: true, email: true, role: true, status: true } } },
  orderBy: { assignedAt: 'asc' },
};

/** The sessions that need somebody put on them. */
function unstaffedFilter(now) {
  return {
    AND: [
      whenFilter('upcoming', now),
      { status: 'published' },
      { staff: { none: { user: { role: 'employee', status: 'active' } } } },
    ],
  };
}

/**
 * Prisma cannot express `COALESCE(endTime, dateTime) >= now`, so the two
 * cases are spelled out. Using dateTime alone would file a session that is
 * running right now under "đã diễn ra", which is not what the row says.
 */
function whenFilter(when, now) {
  if (when === 'upcoming') {
    return { OR: [{ endTime: { gte: now } }, { endTime: null, dateTime: { gte: now } }] };
  }
  if (when === 'past') {
    return { OR: [{ endTime: { lt: now } }, { endTime: null, dateTime: { lt: now } }] };
  }
  if (when === 'unstaffed') return unstaffedFilter(now);
  return null;
}

const workshopSchema = z.object({
  title: noHtml('Tên workshop').and(
    z.string()
      .min(3, 'Tên workshop phải có ít nhất 3 ký tự.')
      .max(200, 'Tên workshop tối đa 200 ký tự.'),
  ),
  // The client sends a datetime-local value ("2026-07-18T10:00"), which has no
  // zone. z.coerce.date reads it as the server's local time, so the container's
  // TZ decides what the admin actually scheduled — send an ISO string instead.
  dateTime: z.coerce.date({
    invalid_type_error: 'Thời gian không hợp lệ.',
    required_error: 'Chọn thời gian diễn ra.',
  }),
  capacity: z.coerce.number({ invalid_type_error: 'Sức chứa phải là một số.' })
    .int('Sức chứa phải là số nguyên.')
    .min(1, 'Sức chứa phải lớn hơn 0.')
    .max(1000, 'Sức chứa tối đa 1000 người.'),
  location: noHtml('Địa điểm').and(
    z.string()
      .min(3, 'Địa điểm phải có ít nhất 3 ký tự.')
      .max(200, 'Địa điểm tối đa 200 ký tự.'),
  ),
  // Everything below is what the public workshop card shows. It used to come
  // from a hardcoded array in the frontend, so a session created here could
  // never look like the ones customers see.
  description: noHtml('Mô tả').and(
    z.string().max(2000, 'Mô tả tối đa 2000 ký tự.'),
  ).optional().nullable().or(z.literal('')),
  imageUrl: z.string()
    .max(2048, 'Đường dẫn ảnh tối đa 2048 ký tự.')
    .regex(
      /^(?:https?:\/\/|\/)[^\s"'<>]+$/,
      'Đường dẫn ảnh không hợp lệ — phải bắt đầu bằng / hoặc http(s):// và không chứa khoảng trắng.',
    )
    .optional().nullable().or(z.literal('')),
  endTime: z.coerce.date({ invalid_type_error: 'Giờ kết thúc không hợp lệ.' })
    .optional().nullable(),
  ageRange: noHtml('Độ tuổi').and(
    z.string().max(50, 'Độ tuổi tối đa 50 ký tự.'),
  ).optional().nullable().or(z.literal('')),
  price: z.coerce.number({ invalid_type_error: 'Học phí phải là một số.' })
    .int('Học phí phải là số nguyên.')
    .min(0, 'Học phí không được âm.')
    .max(100_000_000, 'Học phí quá lớn.')
    .optional().default(0),
  status: z.enum(['draft', 'published', 'cancelled'], {
    errorMap: () => ({ message: 'Trạng thái phải là "draft", "published" hoặc "cancelled".' }),
  }).optional().default('published'),
  // Who runs it. Absent on an update means "leave as it is"; [] clears it.
  staffIds: z.array(z.string().min(1).max(64))
    .max(10, 'Tối đa 10 người phụ trách một buổi.')
    .optional(),
});

const updateWorkshopSchema = workshopSchema.partial();

/** Turns the optional text fields' "" into null so the column stays empty. */
function normalise(data) {
  const out = { ...data };
  for (const key of ['description', 'imageUrl', 'ageRange']) {
    if (out[key] === '') out[key] = null;
  }
  return out;
}

/**
 * Only active employees can be put on a session: they are the ones who can
 * open the door screen. A customer id, an admin or a disabled account is
 * refused rather than silently dropped, so the form never saves something
 * other than what the admin ticked.
 */
async function assertStaff(prisma, ids) {
  const wanted = [...new Set(ids)];
  if (!wanted.length) return [];
  const people = await prisma.user.findMany({
    where: { id: { in: wanted }, role: 'employee', status: 'active' },
    select: { id: true, name: true },
  });
  if (people.length !== wanted.length) {
    throw new AppError('Chỉ giao được cho tài khoản nhân viên đang hoạt động.', 400);
  }
  return people;
}

/** Makes the session's staff exactly `ids`; returns who came and went. */
async function replaceStaff(tx, workshopId, ids) {
  const current = await tx.workshopStaff.findMany({
    where: { workshopId },
    select: { userId: true, user: { select: { name: true } } },
  });
  const keep = new Set(ids);
  const had = new Set(current.map((s) => s.userId));
  const removed = current.filter((s) => !keep.has(s.userId));
  const added = ids.filter((id) => !had.has(id));
  if (removed.length) {
    await tx.workshopStaff.deleteMany({ where: { workshopId, userId: { in: removed.map((s) => s.userId) } } });
  }
  if (added.length) {
    await tx.workshopStaff.createMany({ data: added.map((userId) => ({ workshopId, userId })), skipDuplicates: true });
  }
  return { added, removed: removed.map((s) => ({ id: s.userId, name: s.user.name })) };
}

/** A session cannot end before it starts. */
function assertTimeOrder({ dateTime, endTime }) {
  if (!endTime || !dateTime) return;
  if (endTime <= dateTime) {
    throw new AppError('Giờ kết thúc phải sau giờ bắt đầu.', 400);
  }
}

/**
 * Seats are counted in children, not rows: one parent can book three places.
 * The public registration endpoint counts the same way, so capacity checks on
 * both sides have to agree.
 */
async function seatsTaken(prisma, workshopId) {
  const result = await prisma.workshopRegistration.aggregate({
    where: { workshopId, status: { not: 'cancelled' } },
    _sum: { childCount: true },
  });
  return result._sum.childCount || 0;
}

export default async function adminWorkshopRoutes(fastify) {
  // Workshops are a commitment to customers — a wrong date or a capacity below
  // the people already signed up is a real-world problem — so writes are
  // admin-only, matching the product catalogue.
  const writeAuth = [requireAdmin, requireCsrf];

  // GET /api/v1/admin/workshops/stats — per-workshop registration totals plus
  // a per-location aggregate. "Location" is the venue field on Workshop today.
  // The table's own source. /workshops/stats stays as it is because the
  // metric tiles and the per-location breakdown are totals over every row;
  // paginating those would make them count whatever happens to be on screen.
  fastify.get('/workshops', { preHandler: [requireAdmin] }, async (req) => {
    const paging = readPaging(req.query);

    const where = {};
    const or = searchOr(req.query.search, ['title', 'location', 'description']);
    if (or) where.OR = or;

    const now = new Date();
    const when = whenFilter(req.query.when, now);
    if (when) Object.assign(where, when.OR ? { AND: [when] } : when);

    const [workshops, total, upcoming, past, unstaffed] = await Promise.all([
      fastify.prisma.workshop.findMany({
        where,
        include: {
          // Seats, not rows: one booking can carry several children.
          registrations: {
            where: { status: { not: 'cancelled' } },
            select: { childCount: true, paidAt: true, amount: true },
          },
          staff: STAFF_INCLUDE,
        },
        // Newest first: a session next week is what staff came here for, and
        // one from two years ago is not.
        orderBy: { dateTime: 'desc' },
        skip: paging.skip,
        take: paging.take,
      }),
      fastify.prisma.workshop.count({ where }),
      fastify.prisma.workshop.count({ where: whenFilter('upcoming', now) }),
      fastify.prisma.workshop.count({ where: whenFilter('past', now) }),
      fastify.prisma.workshop.count({ where: unstaffedFilter(now) }),
    ]);

    // What the families who were there thought, for the sessions on this page.
    const scores = await fastify.prisma.workshopReview.groupBy({
      by: ['workshopId'],
      where: { workshopId: { in: workshops.map((w) => w.id) }, status: 'published' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const scoreOf = new Map(scores.map((g) => [g.workshopId, {
      average: Math.round(g._avg.rating * 10) / 10,
      count: g._count._all,
    }]));

    return {
      ...paged(workshops.map((w) => ({ ...enrichWorkshop(w, now), rating: scoreOf.get(w.id) || null })), total, paging, 'workshops'),
      counts: { upcoming, past, all: upcoming + past, unstaffed },
    };
  });

  /**
   * GET /api/v1/admin/workshops/staff-options — who can be put on a session,
   * with what each of them already has coming, so the editor can say "đã có
   * 3 buổi" or warn that two sessions overlap.
   */
  fastify.get('/workshops/staff-options', { preHandler: [requireAdmin] }, async () => {
    const now = new Date();
    const people = await fastify.prisma.user.findMany({
      where: { role: 'employee', status: 'active' },
      select: {
        id: true,
        name: true,
        email: true,
        workshopShifts: {
          where: { workshop: { status: 'published', ...whenFilter('upcoming', now) } },
          select: { workshop: { select: { id: true, title: true, dateTime: true, endTime: true } } },
          orderBy: { workshop: { dateTime: 'asc' } },
        },
      },
      orderBy: { name: 'asc' },
    });
    return {
      staff: people.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        shifts: p.workshopShifts.map((s) => s.workshop),
      })),
    };
  });

  fastify.get('/workshops/stats', { preHandler: [requireAdmin] }, async () => {
    const [workshops, byLocation, totals] = await Promise.all([
      fastify.prisma.workshop.findMany({
        orderBy: { dateTime: 'asc' },
        include: {
          // Seats, not rows — a parent can book several children on one row.
          registrations: {
            where: { status: { not: 'cancelled' } },
            select: { childCount: true, paidAt: true, amount: true },
          },
          staff: STAFF_INCLUDE,
        },
      }),

      fastify.prisma.$queryRaw`
        SELECT
          w.location AS "location",
          COUNT(DISTINCT w.id)::int AS "workshopCount",
          COALESCE(SUM(w.capacity), 0)::int AS "totalCapacity",
          COUNT(r.id)::int AS "totalRegistrations"
        FROM "Workshop" w
        LEFT JOIN "WorkshopRegistration" r ON r."workshopId" = w.id
        GROUP BY w.location
        ORDER BY "totalRegistrations" DESC, w.location ASC
      `,

      fastify.prisma.$queryRaw`
        SELECT
          COUNT(DISTINCT w.id)::int AS "workshopCount",
          COALESCE(SUM(w.capacity), 0)::int AS "totalCapacity",
          COUNT(r.id)::int AS "totalRegistrations"
        FROM "Workshop" w
        LEFT JOIN "WorkshopRegistration" r ON r."workshopId" = w.id
      `,
    ]);

    const now = new Date();
    const enrichedWorkshops = workshops.map((w) => enrichWorkshop(w, now));

    return {
      workshops: enrichedWorkshops,
      byLocation,
      totals: totals[0] || { workshopCount: 0, totalCapacity: 0, totalRegistrations: 0 },
    };
  });

  // GET /api/v1/admin/workshops/:id/registrations — who is coming, so staff can
  // call round or print a door list.
  fastify.get('/workshops/:id/registrations', { preHandler: [requireAdmin] }, async (req, reply) => {
    const workshop = await fastify.prisma.workshop.findUnique({ where: { id: req.params.id } });
    if (!workshop) return reply.code(404).send({ message: 'Không tìm thấy workshop.' });

    const registrations = await fastify.prisma.workshopRegistration.findMany({
      where: { workshopId: workshop.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return { workshop, registrations };
  });

  // POST /api/v1/admin/workshop-images — upload a cover and get its URL back.
  //
  // Separate from the workshop record on purpose: an admin picks the photo
  // while filling in a session that does not exist yet, so there is no id to
  // attach it to. The URL returned goes into the form and is saved with the
  // rest of the fields. Mirrors /admin/blog-images.
  fastify.post('/workshop-images', { preHandler: writeAuth }, async (req, reply) => {
    const { file } = await multipartFields(req);
    const asset = await createAsset(fastify.prisma, {
      ownerUserId: req.user.id,
      kind: 'workshop_cover',
      file,
      category: 'image',
    });
    await auditLog(fastify.prisma, req.user.id, 'workshop.cover.upload', 'Asset', asset.id, {
      originalName: asset.originalName,
    });
    reply.code(201);
    return { url: asset.url, originalName: asset.originalName, sizeBytes: asset.sizeBytes };
  });

  // POST /api/v1/admin/workshops
  fastify.post('/workshops', { preHandler: writeAuth }, async (req, reply) => {
    const { staffIds = [], ...data } = normalise(parseOrThrow(workshopSchema, req.body));
    assertTimeOrder(data);
    const people = await assertStaff(fastify.prisma, staffIds);
    const workshop = await fastify.prisma.$transaction(async (tx) => {
      const created = await tx.workshop.create({ data });
      if (people.length) await replaceStaff(tx, created.id, people.map((p) => p.id));
      return created;
    });
    await auditLog(fastify.prisma, req.user.id, 'workshop.create', 'Workshop', workshop.id, {
      title: workshop.title,
      staff: people.map((p) => p.name),
    });
    reply.code(201);
    return { workshop };
  });

  // PUT /api/v1/admin/workshops/:id
  fastify.put('/workshops/:id', { preHandler: writeAuth }, async (req, reply) => {
    const existing = await fastify.prisma.workshop.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { registrations: true } } },
    });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy workshop.' });

    const { staffIds, ...data } = normalise(parseOrThrow(updateWorkshopSchema, req.body));
    assertTimeOrder({ ...existing, ...data });
    const people = staffIds === undefined ? null : await assertStaff(fastify.prisma, staffIds);

    // Capacity is what the public registration endpoint checks against, so
    // lowering it below the seats already booked would oversell the room.
    if (data.capacity !== undefined) {
      const taken = await seatsTaken(fastify.prisma, existing.id);
      if (data.capacity < taken) {
        throw new AppError(
          `Đã có ${taken} bé đăng ký — sức chứa không thể nhỏ hơn con số này.`,
          400,
        );
      }
    }

    const { workshop, change } = await fastify.prisma.$transaction(async (tx) => ({
      workshop: await tx.workshop.update({ where: { id: existing.id }, data }),
      change: people ? await replaceStaff(tx, existing.id, people.map((p) => p.id)) : null,
    }));
    if (Object.keys(data).length) {
      await auditLog(fastify.prisma, req.user.id, 'workshop.update', 'Workshop', workshop.id, {
        changed: Object.keys(data),
      });
    }
    // Its own entry, with names: "who was taken off the 21/11 session" is a
    // question asked of the log, and an id list cannot answer it.
    if (change && (change.added.length || change.removed.length)) {
      const named = new Map(people.map((p) => [p.id, p.name]));
      await auditLog(fastify.prisma, req.user.id, 'workshop.staff.updated', 'Workshop', workshop.id, {
        title: workshop.title,
        added: change.added.map((id) => named.get(id)),
        removed: change.removed.map((p) => p.name),
      });
    }
    return { workshop };
  });

  // DELETE /api/v1/admin/workshops/:id
  fastify.delete('/workshops/:id', { preHandler: writeAuth }, async (req, reply) => {
    const existing = await fastify.prisma.workshop.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { registrations: true } } },
    });
    if (!existing) return reply.code(404).send({ message: 'Không tìm thấy workshop.' });

    // Deleting would drop the registrations with it, and those people are
    // expecting to turn up. Cancelling is a conversation, not a button.
    if (existing._count.registrations > 0) {
      throw new AppError(
        `Không xoá được: đã có ${existing._count.registrations} người đăng ký. Hãy liên hệ họ trước rồi huỷ từng lượt đăng ký.`,
        409,
      );
    }

    await fastify.prisma.workshop.delete({ where: { id: existing.id } });
    await auditLog(fastify.prisma, req.user.id, 'workshop.delete', 'Workshop', existing.id, {
      title: existing.title,
    });
    return { message: 'Đã xoá workshop.' };
  });

  // PATCH /api/v1/admin/workshops/:id/registrations/:registrationId — staff ring
  // each parent to confirm, so the booking needs a state they can move it
  // through. Cancelling frees the seat without losing the record of who asked.
  fastify.patch('/workshops/:id/registrations/:registrationId', { preHandler: writeAuth }, async (req, reply) => {
    const { status } = parseOrThrow(
      z.object({
        status: z.enum(['pending', 'confirmed', 'cancelled'], {
          errorMap: () => ({ message: 'Trạng thái phải là "pending", "confirmed" hoặc "cancelled".' }),
        }),
      }),
      req.body,
    );

    const registration = await fastify.prisma.workshopRegistration.findUnique({
      where: { id: req.params.registrationId },
    });
    if (!registration || registration.workshopId !== req.params.id) {
      return reply.code(404).send({ message: 'Không tìm thấy lượt đăng ký.' });
    }

    // Re-opening a cancelled booking has to fit in what is left, or the session
    // would end up oversold by the back door.
    if (registration.status === 'cancelled' && status !== 'cancelled') {
      const workshop = await fastify.prisma.workshop.findUnique({ where: { id: registration.workshopId } });
      const taken = await seatsTaken(fastify.prisma, registration.workshopId);
      const left = workshop.capacity - taken;
      if (registration.childCount > left) {
        throw new AppError(`Chỉ còn ${left} chỗ — không đủ cho ${registration.childCount} bé.`, 409);
      }
    }

    const updated = await fastify.prisma.workshopRegistration.update({
      where: { id: registration.id },
      data: { status },
    });
    await auditLog(fastify.prisma, req.user.id, `workshop.registration.${status}`, 'WorkshopRegistration', registration.id, {
      workshopId: registration.workshopId,
      previousStatus: registration.status,
    });
    return { registration: updated };
  });

  // POST /api/v1/admin/workshops/:id/registrations/:registrationId/mark-paid
  //
  // The counterpart to the order route: someone paid at the door, or
  // transferred without the reference, and the webhook never saw it. Without
  // this the booking reads as unpaid forever.
  fastify.post('/workshops/:id/registrations/:registrationId/mark-paid', { preHandler: writeAuth }, async (req, reply) => {
    const registration = await fastify.prisma.workshopRegistration.findUnique({
      where: { id: req.params.registrationId },
    });
    if (!registration || registration.workshopId !== req.params.id) {
      return reply.code(404).send({ message: 'Không tìm thấy lượt đăng ký.' });
    }
    if (registration.paidAt) {
      return reply.code(409).send({ message: 'Lượt này đã ghi nhận thanh toán rồi.' });
    }
    if (registration.status === 'cancelled') {
      return reply.code(409).send({ message: 'Lượt đăng ký này đã huỷ.' });
    }

    const updated = await fastify.prisma.workshopRegistration.update({
      where: { id: registration.id },
      // sepayTransactionId stays null: no bank transaction backs this, and the
      // audit row records who vouched for it instead.
      data: { paidAt: new Date() },
    });
    await auditLog(fastify.prisma, req.user.id, 'workshop.registration.marked_paid', 'WorkshopRegistration', registration.id, {
      workshopId: registration.workshopId,
      amount: registration.amount,
    });
    return { registration: updated, message: 'Đã ghi nhận thanh toán.' };
  });

  // DELETE /api/v1/admin/workshops/:id/registrations/:registrationId — free a
  // seat when someone cancels by phone or does not show up.
  fastify.delete('/workshops/:id/registrations/:registrationId', { preHandler: writeAuth }, async (req, reply) => {
    const registration = await fastify.prisma.workshopRegistration.findUnique({
      where: { id: req.params.registrationId },
    });
    if (!registration || registration.workshopId !== req.params.id) {
      return reply.code(404).send({ message: 'Không tìm thấy lượt đăng ký.' });
    }

    await fastify.prisma.workshopRegistration.delete({ where: { id: registration.id } });
    await auditLog(fastify.prisma, req.user.id, 'workshop.registration.delete', 'WorkshopRegistration', registration.id, {
      workshopId: registration.workshopId,
    });
    return { message: 'Đã huỷ lượt đăng ký.' };
  });
}
