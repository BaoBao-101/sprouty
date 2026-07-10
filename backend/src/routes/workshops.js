import { z } from 'zod';
import { AppError } from '../utils/errors.js';

const regSchema = z.object({
  workshopId: z.string().min(1).max(64),
  guestName: z.string().min(2).max(100)
    .refine(s => !/[<>]/.test(s), { message: 'Tên không được chứa ký tự < hoặc >.' })
    .optional(),
  guestPhone: z.string().regex(/^[0-9]{8,11}$/, 'Số điện thoại không hợp lệ.').optional(),
});

export default async function workshopRoutes(fastify) {
  // GET /api/v1/workshops
  fastify.get('/workshops', async () => {
    const workshops = await fastify.prisma.workshop.findMany({
      orderBy: { dateTime: 'asc' },
      include: { _count: { select: { registrations: true } } },
    });
    return { workshops };
  });

  // GET /api/v1/workshops/:id
  fastify.get('/workshops/:id', async (req, reply) => {
    const workshop = await fastify.prisma.workshop.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { registrations: true } } },
    });
    if (!workshop) return reply.code(404).send({ message: 'Không tìm thấy workshop.' });
    return { workshop };
  });

  // POST /api/v1/workshops/register
  fastify.post('/workshops/register', {
    config: { rateLimit: { max: 5, timeWindow: '10 minutes' } },
    preHandler: [async (req) => {
      // Authenticated registrations bind to req.user.id, so they need CSRF
      // protection. Guest registrations have no session credential to abuse.
      if (req.user) {
        const token = req.headers['x-csrf-token'];
        const expected = req.session?.data?.csrfToken;
        if (!token || token !== expected) {
          throw new AppError('CSRF token không hợp lệ.', 403);
        }
      }
    }],
  }, async (req, reply) => {
    const parsed = regSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.' });
    }

    const { workshopId, guestName, guestPhone } = parsed.data;
    const workshop = await fastify.prisma.workshop.findUnique({ where: { id: workshopId } });
    if (!workshop) return reply.code(404).send({ message: 'Không tìm thấy workshop.' });

    const regCount = await fastify.prisma.workshopRegistration.count({ where: { workshopId } });
    if (regCount >= workshop.capacity) {
      return reply.code(409).send({ message: 'Workshop đã đầy chỗ.' });
    }

    const data = { workshopId };
    if (req.user) {
      data.userId = req.user.id;
    } else {
      if (!guestName || !guestPhone) {
        return reply.code(400).send({ message: 'Vui lòng nhập tên và số điện thoại.' });
      }
      data.guestName = guestName;
      data.guestPhone = guestPhone;
    }

    // Dedup: same user or same guest phone cannot register twice for the same workshop
    const dupWhere = { workshopId };
    if (data.userId) dupWhere.userId = data.userId;
    else dupWhere.guestPhone = data.guestPhone;
    const existingReg = await fastify.prisma.workshopRegistration.findFirst({ where: dupWhere });
    if (existingReg) {
      return reply.code(409).send({ message: 'Bạn đã đăng ký workshop này rồi.' });
    }

    const registration = await fastify.prisma.workshopRegistration.create({ data });
    reply.code(201);
    return { message: 'Đăng ký thành công!', registration };
  });
}
