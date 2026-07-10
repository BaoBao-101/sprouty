import { requireAdmin } from '../../middleware/rbac.js';

export default async function adminWorkshopRoutes(fastify) {
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
}
