import { z } from 'zod';
import { requireAuth, requireCsrf } from '../middleware/rbac.js';
import { hasEntitlement } from '../services/access.js';
import { callAi, SPROUTY_SYSTEM, missingProviderKey, supportsImages } from '../services/ai.js';
import { advance, plantDetailDto, plantPromptContext } from '../services/plants.js';

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(3000),
  })).min(1).max(30),
  // No systemPrompt field on purpose (finding F-07). The client used to supply
  // the entire system prompt, so anyone could POST here with instructions of
  // their own — overriding the guardrails and turning our API key into a free
  // general-purpose model. The server builds the prompt itself, from the
  // signed-in user and real database lookups rather than the caller's claim.
  //
  // Data URL (data:image/...;base64,...) of a single image attached to the
  // LAST user message — used by the pre-submit "AI gợi ý caption" flow.
  // Client resizes the image before sending, so 2MB comfortably covers it.
  imageDataUrl: z.string().max(2_800_000).regex(/^data:image\/(png|jpe?g|webp);base64,/).optional(),
  // Which of the caller's own plants the conversation is about, so the general
  // assistant can answer "cây của mình sao rồi?" with real numbers. An id
  // belonging to someone else simply finds nothing — ownership is part of the
  // lookup, not a separate check that could be forgotten.
  plantId: z.string().max(64).optional(),
});

export default async function chatRoute(fastify) {
  fastify.post('/chat', {
    preHandler: [requireAuth, requireCsrf],
    config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    if (process.env.AI_REQUIRES_ENTITLEMENT === 'true') {
      const allowed = await hasEntitlement(fastify.prisma, req.user.id, 'ai_assistant');
      if (!allowed && !['employee', 'admin'].includes(req.user.role)) {
        return reply.code(403).send({ message: 'Nhập mã kích hoạt để sử dụng trợ lý AI.' });
      }
    }

    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ message: parsed.error.errors[0]?.message || 'Dữ liệu không hợp lệ.' });
    }

    const { messages, imageDataUrl, plantId } = parsed.data;

    if (imageDataUrl && !supportsImages()) {
      return reply.code(422).send({ message: 'Nhà cung cấp AI hiện tại không hỗ trợ nhận diện ảnh.' });
    }

    const missing = missingProviderKey();
    if (missing) {
      // A missing provider key is our problem, not the caller's (finding F-10).
      // Naming the variable told an anonymous visitor which AI vendor we use
      // and that the deployment is half-configured; the operator needs that
      // detail, so it goes to the log instead of the response.
      req.log.error({ missingVar: missing }, 'AI provider is not configured');
      return reply.code(503).send({
        message: 'Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại sau.',
      });
    }

    // Retrieve relevant products for grounding.
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    let contextText = '';
    if (lastUserMsg.length > 3) {
      const keywords = lastUserMsg.split(/\s+/).filter(w => w.length > 2).slice(0, 5);
      const products = await fastify.prisma.product.findMany({
        where: {
          status: 'published',
          OR: keywords.map(k => ({ name: { contains: k, mode: 'insensitive' } })),
        },
        take: 3,
        select: { name: true, price: true, ageRange: true, description: true },
      });

      if (products.length > 0) {
        contextText = '\n\nSản phẩm liên quan:\n' + products.map(p =>
          `- ${p.name} (${p.ageRange}) — ${p.price.toLocaleString('vi-VN')}đ: ${p.description.slice(0, 100)}...`
        ).join('\n');
      }
    }

    // Identify the user from the session, not from anything the client sent.
    const whoLine = `\n\nNgười dùng hiện tại: ${req.user.name} (vai trò: ${req.user.role}).`;

    // What the customer is growing right now. Scoped to this user, so a
    // guessed id reveals nothing.
    let plantText = '';
    if (plantId) {
      const row = await fastify.prisma.virtualPlant.findFirst({
        where: { id: plantId, userId: req.user.id },
        include: {
          devices: true,
          product: { select: { id: true, name: true, emoji: true, bgColor: true, images: true, speciesKey: true } },
        },
      });
      if (row) {
        const now = new Date();
        const { plant } = await advance(fastify.prisma, row, now);
        const detail = await plantDetailDto(fastify.prisma, plant, { now });
        plantText = `\n\nCÂY MÔ PHỎNG CỦA NGƯỜI DÙNG:\n${plantPromptContext(detail)}`;
      }
    }

    const enrichedSystem = SPROUTY_SYSTEM + whoLine + contextText + plantText;

    try {
      const reply_text = await callAi({ messages, system: enrichedSystem, imageDataUrl });
      return { reply: reply_text };
    } catch (err) {
      fastify.log.error({ err }, 'Chat error');
      return reply.code(502).send({ message: 'Dịch vụ AI tạm thời không khả dụng. Thử lại sau.' });
    }
  });
}
