import { z } from 'zod';
import { requireAdmin, requireCsrf } from '../../middleware/rbac.js';
import { AppError } from '../../utils/errors.js';
import { noHtml, parseOrThrow } from '../../utils/validation.js';
import { auditLog } from '../../services/audit.js';

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
});

const updateWorkshopSchema = workshopSchema.partial();

export default async function adminWorkshopRoutes(fastify) {
  // Workshops are a commitment to customers — a wrong date or a capacity below
  // the people already signed up is a real-world problem — so writes are
  // admin-only, matching the product catalogue.
  const writeAuth = [requireAdmin, requireCsrf];

  // GET /api/v1/admin/workshops/stats — per-workshop registration totals plus
  // a per-location aggregate. "Location" is the venue field on Workshop today.
  fastify.get('/workshops/stats', { preHandler: [requireAdmin] }, async () => {
    const [workshops, byLocation, totals] = await Promise.all([
      fastify.prisma.workshop.findMany({
        orderBy: { dateTime: 'asc' },
        include: { _count: { select: { registrations: true } } },
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
    const enrichedWorkshops = workshops.map(w => ({
      id: w.id,
      title: w.title,
      dateTime: w.dateTime,
      capacity: w.capacity,
      location: w.location,
      registrations: w._count.registrations,
      pctFull: w.capacity > 0 ? Math.round((w._count.registrations / w.capacity) * 100) : 0,
      upcoming: w.dateTime > now,
    }));

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

  // POST /api/v1/admin/workshops
  fastify.post('/workshops', { preHandler: writeAuth }, async (req, reply) => {
    const data = parseOrThrow(workshopSchema, req.body);
    const workshop = await fastify.prisma.workshop.create({ data });
    await auditLog(fastify.prisma, req.user.id, 'workshop.create', 'Workshop', workshop.id, {
      title: workshop.title,
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

    const data = parseOrThrow(updateWorkshopSchema, req.body);

    // Capacity is what the public registration endpoint checks against, so
    // lowering it below the people already booked would oversell the room.
    if (data.capacity !== undefined && data.capacity < existing._count.registrations) {
      throw new AppError(
        `Đã có ${existing._count.registrations} người đăng ký — sức chứa không thể nhỏ hơn con số này.`,
        400,
      );
    }

    const workshop = await fastify.prisma.workshop.update({ where: { id: existing.id }, data });
    await auditLog(fastify.prisma, req.user.id, 'workshop.update', 'Workshop', workshop.id, {
      changed: Object.keys(data),
    });
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
