import fetch from 'node-fetch';
import { z } from 'zod';
import { requireAuth, requireCsrf } from '../middleware/rbac.js';
import { hasEntitlement } from '../services/access.js';

const chatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(3000),
  })).min(1).max(30),
  systemPrompt: z.string().max(2000).optional(),
});

const PROVIDER = process.env.AI_PROVIDER || 'openai';
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const AI_MODEL = process.env.AI_MODEL || 'gpt-4.1-mini';
const AI_ENDPOINT = process.env.AI_ENDPOINT || 'https://api.openai.com/v1/chat/completions';

const DEFAULT_SYSTEM = `Bạn là trợ lý AI của Sprouty — thương hiệu bộ kit trồng cây, Cây Kỷ Niệm số và workshop gia đình cho trẻ em Việt Nam.
Phong cách: thân thiện, vui vẻ, phù hợp với phụ huynh và trẻ em.
Nhiệm vụ: Giúp khách hàng tìm hiểu sản phẩm, giải đáp câu hỏi về Sprouty Kit, chăm cây, Plant Buddy, workshop, IoT/STEM và chính sách.
Giới hạn: Không thu thập thông tin thanh toán. Không tiết lộ thông tin nội bộ. Không thực hiện các thao tác quản trị.
Luôn trả lời bằng tiếng Việt, ngắn gọn và hữu ích.`;

async function callOpenAI(messages, systemPrompt) {
  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt || DEFAULT_SYSTEM },
        ...messages,
      ],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'AI provider error');
  return data.choices?.[0]?.message?.content?.trim() || 'Xin lỗi, không nhận được phản hồi.';
}

async function callAnthropic(messages, systemPrompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt || DEFAULT_SYSTEM,
      messages,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Anthropic error');
  return data.content?.[0]?.text?.trim() || 'Xin lỗi, không nhận được phản hồi.';
}

async function callOllama(messages, systemPrompt) {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL || 'llama3.2',
      messages: [
        { role: 'system', content: systemPrompt || DEFAULT_SYSTEM },
        ...messages,
      ],
      stream: false,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error('Ollama error');
  return data.message?.content?.trim() || 'Xin lỗi, không nhận được phản hồi.';
}

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

    const { messages, systemPrompt } = parsed.data;

    // Retrieve relevant products for grounding
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

    const enrichedSystem = (systemPrompt || DEFAULT_SYSTEM) + contextText;

    try {
      let reply_text;
      if (PROVIDER === 'anthropic' && ANTHROPIC_KEY) {
        reply_text = await callAnthropic(messages, enrichedSystem);
      } else if (PROVIDER === 'ollama') {
        reply_text = await callOllama(messages, enrichedSystem);
      } else if (OPENAI_KEY) {
        reply_text = await callOpenAI(messages, enrichedSystem);
      } else {
        return reply.code(503).send({ message: 'Dịch vụ AI chưa được cấu hình.' });
      }

      return { reply: reply_text };
    } catch (err) {
      fastify.log.error('Chat error:', err.message);
      return reply.code(502).send({ message: 'Dịch vụ AI tạm thời không khả dụng. Thử lại sau.' });
    }
  });
}
