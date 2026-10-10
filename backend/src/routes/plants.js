/**
 * The virtual plant API.
 *
 * Reads are not idempotent here and that is deliberate: `GET /me/plants/:id`
 * advances the simulation to now and persists it. See services/plants.js.
 */

import { z } from 'zod';
import { reserveAi } from '../services/benefits.js';
import { requireCustomer, requireCsrf } from '../middleware/rbac.js';
import { AppError } from '../utils/errors.js';
import { noHtml, parseOrThrow } from '../utils/validation.js';
import { callAi, classifyAiError, SPROUTY_SYSTEM, missingProviderKey } from '../services/ai.js';
import { CARE_ACTIONS, DEVICES, STAGES } from '../services/plant-sim.js';
import {
  advance,
  clearCoachHistory,
  coachHistory,
  performCare,
  saveCoachExchange,
  plantCardDto,
  plantDetailDto,
  plantPromptContext,
  renamePlant,
  setDeviceAuto,
} from '../services/plants.js';
import { redeemCode } from '../services/redeem.js';
import { syncWorkshopRewards } from '../services/rewards.js';

const activateSchema = z.object({
  code: z.string().min(4).max(128),
  nickname: noHtml('Tên cây').and(z.string().min(1).max(40)).optional(),
});

const careSchema = z.object({
  action: z.enum(CARE_ACTIONS.map((a) => a.id)),
});

const deviceSchema = z.object({
  type: z.enum(DEVICES.map((d) => d.type)),
  autoMode: z.boolean(),
});

const renameSchema = z.object({
  nickname: noHtml('Tên cây').and(
    z.string().min(1, 'Tên cây không được để trống.').max(40, 'Tên cây tối đa 40 ký tự.'),
  ),
});

const coachSchema = z.object({
  // A free-text follow-up, e.g. "lá cây bị vàng thì sao?". Optional: with no
  // question the coach just explains the current step.
  question: z.string().max(600).optional(),
});

export default async function plantRoutes(fastify) {
  // POST /api/v1/me/plants/activate — the activation form on "Cây của tôi".
  //
  // Activation is where the new model starts: the order issues a code, and the
  // code is what turns a purchase into a plant.
  fastify.post('/me/plants/activate', {
    preHandler: [requireCustomer, requireCsrf],
    config: { rateLimit: { max: 12, timeWindow: '10 minutes' } },
  }, async (req, reply) => {
    const { code, nickname } = parseOrThrow(activateSchema, req.body);
    const result = await redeemCode(fastify.prisma, req.user.id, code, {
      ip: req.ip,
      nickname: nickname || null,
    });

    if (!result.plant) {
      // A code with no kit behind it — a VIP membership, a promotional AI
      // code. Its entitlements were just granted, so this is a success.
      //
      // It used to answer 422. The redemption had already happened and
      // spent the code's only use, so the customer saw a red error for
      // something that worked, tried again, and got "hết lượt" — which
      // made a successful purchase look broken twice over.
      return {
        kind: 'membership',
        created: false,
        alreadyRedeemed: result.alreadyRedeemed,
        features: result.features,
        message: result.alreadyRedeemed
          ? 'Mã này đã được kích hoạt cho tài khoản của bạn rồi — quyền lợi vẫn đang dùng được.'
          : 'Đã kích hoạt quyền lợi thành viên cho tài khoản của bạn.',
      };
    }

    reply.code(result.plantCreated ? 201 : 200);
    return {
      kind: 'kit',
      message: result.plantCreated
        ? 'Kích hoạt thành công — hạt đã được gieo!'
        : 'Bạn đã kích hoạt mã này rồi — đây là cây của bạn.',
      created: result.plantCreated,
      alreadyRedeemed: result.alreadyRedeemed,
      plant: plantCardDto(result.plant),
    };
  });

  // GET /api/v1/me/plants
  fastify.get('/me/plants', { preHandler: [requireCustomer] }, async (req) => {
    const rows = await fastify.prisma.virtualPlant.findMany({
      where: { userId: req.user.id },
      include: {
        devices: true,
        product: { select: { id: true, name: true, emoji: true, bgColor: true, images: true, speciesKey: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = new Date();
    const plants = [];
    const alerts = [];
    // Sequential rather than Promise.all: each advance() opens a transaction,
    // and a customer with several plants would otherwise fire them all at the
    // connection pool at once.
    for (const row of rows) {
      const { plant, events } = await advance(fastify.prisma, row, now);
      plants.push(plantCardDto(plant));
      for (const event of events.filter((e) => e.level === 'warn')) {
        alerts.push({ plantId: plant.id, nickname: plant.nickname, ...event });
      }
    }

    return { plants, alerts };
  });

  // GET /api/v1/me/plants/:plantId — the dashboard payload.
  fastify.get('/me/plants/:plantId', { preHandler: [requireCustomer] }, async (req) => {
    const row = await fastify.prisma.virtualPlant.findFirst({
      where: { id: req.params.plantId, userId: req.user.id },
      include: {
        devices: true,
        product: { select: { id: true, name: true, emoji: true, bgColor: true, images: true, speciesKey: true } },
      },
    });
    if (!row) throw new AppError('Không tìm thấy cây này.', 404);

    const now = new Date();
    const { plant, events, newlyUnlocked } = await advance(fastify.prisma, row, now);
    const detail = await plantDetailDto(fastify.prisma, plant, { now });
    return { plant: detail, events, newlyUnlocked };
  });

  // POST /api/v1/me/plants/:plantId/care
  fastify.post('/me/plants/:plantId/care', {
    preHandler: [requireCustomer, requireCsrf],
    // Generous, because the cooldown is the real limit; this only stops a
    // script from hammering the endpoint to find out what is off cooldown.
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req) => {
    const { action } = parseOrThrow(careSchema, req.body);
    const now = new Date();
    const outcome = await performCare(fastify.prisma, req.user.id, req.params.plantId, action, { now });
    const detail = await plantDetailDto(fastify.prisma, outcome.plant, { now });

    return {
      plant: detail,
      growth: outcome.growth,
      messages: outcome.messages,
      stagesCrossed: outcome.stagesCrossed,
      newlyUnlocked: outcome.newlyUnlocked,
      harvested: Boolean(outcome.harvested),
      streak: outcome.streak ?? detail.careStreak,
    };
  });

  // PATCH /api/v1/me/plants/:plantId/devices — automation on or off.
  fastify.patch('/me/plants/:plantId/devices', {
    preHandler: [requireCustomer, requireCsrf],
  }, async (req) => {
    const { type, autoMode } = parseOrThrow(deviceSchema, req.body);
    const result = await setDeviceAuto(
      fastify.prisma, req.user.id, req.params.plantId, type, autoMode,
    );
    return {
      message: autoMode ? `Đã bật ${result.label}.` : `Đã tắt ${result.label}.`,
      device: result,
    };
  });

  // PATCH /api/v1/me/plants/:plantId — rename.
  fastify.patch('/me/plants/:plantId', { preHandler: [requireCustomer, requireCsrf] }, async (req) => {
    const { nickname } = parseOrThrow(renameSchema, req.body);
    const plant = await renamePlant(fastify.prisma, req.user.id, req.params.plantId, nickname.trim());
    return { message: 'Đã đổi tên cây.', plant: plantCardDto(plant) };
  });

  // POST /api/v1/me/plants/:plantId/coach — step-by-step help for THIS plant.
  //
  // Separate from /chat because the prompt is different in kind: the coach is
  // handed the plant's real numbers and the step the dashboard has already
  // chosen, and told to explain that step rather than invent its own. An AI
  // that recommended something other than the highlighted button would read as
  // the site arguing with itself.
  fastify.post('/me/plants/:plantId/coach', {
    preHandler: [requireCustomer, requireCsrf],
    config: { rateLimit: { max: 15, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { question } = parseOrThrow(coachSchema, req.body);

    const missing = missingProviderKey();
    if (missing) {
      req.log.error({ missingVar: missing }, 'AI provider is not configured');
      return reply.code(503).send({
        message: 'Trợ lý AI tạm thời không khả dụng. Vui lòng thử lại sau.',
      });
    }

    const row = await fastify.prisma.virtualPlant.findFirst({
      where: { id: req.params.plantId, userId: req.user.id },
      include: {
        devices: true,
        product: { select: { id: true, name: true, emoji: true, bgColor: true, images: true, speciesKey: true } },
      },
    });
    if (!row) throw new AppError('Không tìm thấy cây này.', 404);

    const now = new Date();
    const { plant } = await advance(fastify.prisma, row, now);
    const detail = await plantDetailDto(fastify.prisma, plant, { now });

    const system = `${SPROUTY_SYSTEM}

Bạn đang đóng vai "Plant Buddy" — người bạn đồng hành hướng dẫn một em nhỏ chăm cây mô phỏng trên web Sprouty.

TÌNH TRẠNG CÂY LÚC NÀY:
${plantPromptContext(detail)}

CÁCH TRẢ LỜI:
- Nói với em nhỏ, ấm áp và khích lệ, câu ngắn, không dùng thuật ngữ khó.
- Bắt đầu bằng một câu nhận xét về tình trạng cây dựa trên số liệu thật ở trên.
- Rồi hướng dẫn ĐÚNG việc nên làm tiếp theo mà hệ thống đã tính, giải thích ngắn gọn vì sao.
- Nếu có chỉ số bất thường (quá khô, úng nước, thiếu dinh dưỡng, sâu bệnh cao), nhắc em.
- Nếu mọi việc đang hồi chiêu, nói rõ cây đang tự lớn và khi nào quay lại.
- Tối đa 5 câu. Không bịa thêm chỉ số, không nhắc tới cây thật hay giao hàng.`;

    const userMessage = question?.trim()
      ? question.trim()
      : 'Cây của mình giờ thế nào, mình nên làm gì tiếp theo?';

    // Replaying the thread is what lets a follow-up work. Asked on its own,
    // "tại sao?" reached the model with nothing to refer back to.
    const prior = await coachHistory(fastify.prisma, plant.id);

    const releaseAi = await reserveAi(fastify.prisma, req.user.id);
    try {
      const reply_text = await callAi({
        messages: [
          ...prior.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage },
        ],
        system,
      });

      // Saved after the call succeeded: a question stored against a failed
      // request would be replayed later as something the coach had ignored.
      // Failure to record must not lose the answer already on its way back.
      await saveCoachExchange(fastify.prisma, plant.id, userMessage, reply_text)
        .catch((err) => fastify.log.error({ err }, 'Could not save coach exchange'));

      return {
        reply: reply_text,
        nextStep: detail.nextStep,
        stage: detail.stage,
        stageLabel: detail.stageLabel,
      };
    } catch (err) {
      await releaseAi().catch((error) => req.log.error(error, 'AI quota refund failed'));
      // Say which of the three fixable causes it was, so a dead assistant
      // does not need diagnosing from scratch every time.
      const cause = classifyAiError(err);
      fastify.log.error({ err, aiCause: cause.kind, fix: cause.hint }, 'Plant coach error');
      return reply.code(502).send({ message: 'Dịch vụ AI tạm thời không khả dụng. Thử lại sau.' });
    }
  });

  // DELETE /api/v1/me/plants/:plantId/coach — start the thread over.
  fastify.delete('/me/plants/:plantId/coach', {
    preHandler: [requireCustomer, requireCsrf],
  }, async (req) => {
    await clearCoachHistory(fastify.prisma, req.user.id, req.params.plantId);
    return { message: 'Đã xoá lịch sử trò chuyện.' };
  });

  // GET /api/v1/me/rewards — the "buy 3, get a workshop" progress.
  //
  // Syncing on read is what makes a missed payment webhook self-heal: the
  // reward is minted the next time the customer looks, rather than being lost.
  fastify.get('/me/rewards', { preHandler: [requireCustomer] }, async (req) => {
    return syncWorkshopRewards(fastify.prisma, req.user.id);
  });

  // GET /api/v1/plants/guide — the stage/care/device reference, so the shop and
  // the landing page can explain the journey without duplicating the rules.
  fastify.get('/plants/guide', async () => {
    return {
      stages: STAGES.map((s) => ({
        id: s.id, label: s.label, icon: s.icon, story: s.story,
        idealMoisture: s.idealMoisture, idealTemp: s.idealTemp,
      })),
      care: CARE_ACTIONS.map((a) => ({
        id: a.id, label: a.label, icon: a.icon, hint: a.hint,
        cooldownHours: a.cooldownHours, stages: a.stages,
      })),
      devices: DEVICES.map((d) => ({
        type: d.type, label: d.label, icon: d.icon, kind: d.kind,
        about: d.about, unlockStage: d.unlockStage,
      })),
    };
  });
}
