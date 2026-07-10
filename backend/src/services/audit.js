export async function auditLog(prisma, actorUserId, action, targetType, targetId, metadata = {}) {
  if (!actorUserId) return null;
  return prisma.auditLog.create({
    data: {
      actorUserId,
      action,
      targetType,
      targetId: String(targetId),
      metadata,
    },
  }).catch(() => null);
}
