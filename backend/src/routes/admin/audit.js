import { requireAdmin } from '../../middleware/rbac.js';

/*
 * Reading the audit trail.
 *
 * Sensitive actions all over the app call `auditLog(...)` — role changes,
 * password resets, code revocations, moderation decisions — but nothing ever
 * read those rows back, so the whole trail was write-only and answered no
 * question anyone could ask. These endpoints make it usable.
 *
 * Admin-only: the log records who did what to whom, which is more than an
 * employee needs and includes other people's email addresses.
 */
export default async function adminAuditRoutes(fastify) {
  // GET /api/v1/admin/audit-logs
  fastify.get('/audit-logs', { preHandler: [requireAdmin] }, async (req) => {
    const { action, actorUserId, targetType, page = '1', limit = '25' } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const where = {};
    // `action` is a dotted namespace ("user.password.reset"), so a prefix match
    // lets one filter cover a whole family of events.
    if (action) where.action = { startsWith: String(action) };
    if (actorUserId) where.actorUserId = String(actorUserId);
    if (targetType) where.targetType = String(targetType);

    const [logs, total] = await Promise.all([
      fastify.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
      }),
      fastify.prisma.auditLog.count({ where }),
    ]);

    // AuditLog has no relation to User (the actor may since have been deleted),
    // so resolve the names in one extra query rather than per row.
    const actorIds = [...new Set(logs.map(l => l.actorUserId).filter(Boolean))];
    const actors = actorIds.length
      ? await fastify.prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, name: true, email: true, role: true },
      })
      : [];
    const actorById = new Map(actors.map(a => [a.id, a]));

    return {
      logs: logs.map(log => ({ ...log, actor: actorById.get(log.actorUserId) || null })),
      total,
      page: pageNum,
      limit: pageSize,
      pages: Math.ceil(total / pageSize),
    };
  });

  // GET /api/v1/admin/audit-logs/actions — the action names actually present,
  // so the filter offers real values instead of a hardcoded guess that drifts
  // as new `auditLog(...)` calls are added.
  fastify.get('/audit-logs/actions', { preHandler: [requireAdmin] }, async () => {
    const rows = await fastify.prisma.auditLog.groupBy({
      by: ['action'],
      _count: { _all: true },
      orderBy: { _count: { action: 'desc' } },
    });
    return { actions: rows.map(r => ({ action: r.action, count: r._count._all })) };
  });
}
