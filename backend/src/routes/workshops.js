import { z } from 'zod';
import { AppError } from '../utils/errors.js';

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
});

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
    emoji: workshop.emoji,
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
    upcoming: workshop.dateTime > new Date(),
  };
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

    const { workshopId, guestName, guestPhone, guestEmail, childAge, childCount, note } = parsed.data;

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

    const data = { workshopId, childCount, childAge: childAge || null, note: note || null };
    if (req.user) {
      data.userId = req.user.id;
      // Still record the contact details typed on the form: the parent booking
      // may not be the account holder, and staff ring the number given here.
      data.guestName = guestName || req.user.name;
      data.guestPhone = guestPhone || null;
      data.guestEmail = guestEmail || req.user.email;
    } else {
      if (!guestName || !guestPhone) {
        return reply.code(400).send({ message: 'Vui lòng nhập tên và số điện thoại.' });
      }
      data.guestName = guestName;
      data.guestPhone = guestPhone;
      data.guestEmail = guestEmail || null;
    }

    // Dedup: same user or same guest phone cannot register twice for the same
    // workshop. A cancelled registration does not block a fresh one.
    const dupWhere = { workshopId, status: { not: 'cancelled' } };
    if (data.userId) dupWhere.userId = data.userId;
    else dupWhere.guestPhone = data.guestPhone;
    const existingReg = await fastify.prisma.workshopRegistration.findFirst({ where: dupWhere });
    if (existingReg) {
      return reply.code(409).send({ message: 'Bạn đã đăng ký buổi workshop này rồi.' });
    }

    const registration = await fastify.prisma.workshopRegistration.create({ data });
    reply.code(201);
    return { message: 'Đăng ký thành công!', registration };
  });
}
