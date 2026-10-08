/**
 * One place that talks to the AI provider.
 *
 * This used to live inside routes/chat.js, which was fine while chat was the
 * only caller. The plant coach needs the same provider plumbing — the same key
 * handling, the same per-provider model defaults, the same image encoding — and
 * a second copy would have drifted the first time someone switched provider.
 *
 * The system prompt is always built by the server. A caller passes context, not
 * instructions: an endpoint that accepted a system prompt from the client would
 * hand anyone our API key as a general-purpose model (finding F-07).
 */

import fetch from 'node-fetch';

const PROVIDER = process.env.AI_PROVIDER || 'openai';
const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.AI_API_KEY || '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
// Any OpenAI-compatible service is reached by pointing this at it and setting
// AI_API_KEY — Groq, OpenRouter, Together, a self-hosted gateway. That is how
// the free providers are used; there is no separate adapter for each one.
const AI_ENDPOINT = process.env.AI_ENDPOINT || 'https://api.openai.com/v1/chat/completions';

// Each provider has its own model naming scheme — an unset AI_MODEL must
// default per-provider, not to a single OpenAI model name that would be sent
// (and rejected) by whichever provider is actually selected.
// Gemini uses the 'gemini-flash-latest' rolling alias (rather than a dated
// version like 'gemini-2.5-flash') so Google retiring a specific model version
// for new API keys doesn't silently break chat again.
const DEFAULT_MODEL_BY_PROVIDER = {
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  gemini: 'gemini-flash-latest',
  ollama: 'llama3.2',
};
const AI_MODEL = process.env.AI_MODEL || DEFAULT_MODEL_BY_PROVIDER[PROVIDER] || 'gpt-4.1-mini';

export const AI_PROVIDER = PROVIDER;

export const SPROUTY_SYSTEM = `Bạn là trợ lý AI của Sprouty — thương hiệu cây trồng mô phỏng trên web, Cây Kỷ Niệm số và workshop gia đình cho trẻ em Việt Nam.
Sprouty KHÔNG giao cây thật. Khách mua một bộ kit trên web, nhập mã kích hoạt, và nuôi một cây mô phỏng cùng các thiết bị IoT ảo (cảm biến độ ẩm, nhiệt độ, ánh sáng, dinh dưỡng, bơm tưới, đèn trồng cây, quạt) ngay trên trang.
Phong cách: thân thiện, vui vẻ, câu ngắn, phù hợp với phụ huynh và trẻ em.
Nhiệm vụ: Giúp khách hiểu sản phẩm, hướng dẫn chăm cây mô phỏng theo từng bước, giải đáp về workshop, IoT/STEM và chính sách.
Giới hạn: Không thu thập thông tin thanh toán. Không tiết lộ thông tin nội bộ. Không thực hiện thao tác quản trị. Không hứa giao hàng vật lý.
Luôn trả lời bằng tiếng Việt, ngắn gọn và hữu ích.`;

/** The provider key this deployment needs but does not have, or null. */
export function missingProviderKey() {
  if (PROVIDER === 'anthropic') return ANTHROPIC_KEY ? null : 'ANTHROPIC_API_KEY';
  if (PROVIDER === 'gemini') return GEMINI_KEY ? null : 'GEMINI_API_KEY';
  if (PROVIDER === 'ollama') return null; // local, no key
  return OPENAI_KEY ? null : 'OPENAI_API_KEY';
}

/**
 * Whether this deployment can be sent a picture.
 *
 * Provider alone is not the answer any more. The OpenAI path is how every
 * OpenAI-compatible service is reached — Groq, OpenRouter and the rest — and
 * most of their free text models have no vision at all. Guessing "yes" there
 * turns the album's "AI gợi ý caption" button into an error the customer
 * cannot do anything about.
 *
 * AI_SUPPORTS_IMAGES is the override: set it to false on a text-only model and
 * the caption button is refused cleanly with an explanation instead.
 */
export function supportsImages() {
  const override = (process.env.AI_SUPPORTS_IMAGES || '').trim().toLowerCase();
  if (override === 'false' || override === '0') return false;
  if (override === 'true' || override === '1') return true;
  // Ollama's HTTP shape here carries no image field at all.
  return PROVIDER !== 'ollama';
}

/**
 * Splits "data:image/png;base64,AAAA..." into its MIME type and raw base64
 * payload, as Anthropic and Gemini want them in separate fields.
 */
function splitDataUrl(dataUrl) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], base64: match[2] };
}

/**
 * Shared helper for OpenAI/Anthropic: replaces the last user message with one
 * built by `buildFn(text, imageDataUrl)` when an image is attached.
 */
function attachImageToLastUserMessage(messages, imageDataUrl, buildFn) {
  if (!imageDataUrl) return messages;
  const lastIdx = messages.length - 1;
  if (messages[lastIdx]?.role !== 'user') return messages;
  return messages.map((m, i) => (i === lastIdx ? buildFn(m.content, imageDataUrl) : m));
}

async function callOpenAI(messages, systemPrompt, imageDataUrl) {
  const built = attachImageToLastUserMessage(messages, imageDataUrl, (text, url) => ({
    role: 'user',
    content: [{ type: 'text', text }, { type: 'image_url', image_url: { url } }],
  }));
  const response = await fetch(AI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'system', content: systemPrompt }, ...built],
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'AI provider error');
  return data.choices?.[0]?.message?.content?.trim() || 'Xin lỗi, không nhận được phản hồi.';
}

async function callAnthropic(messages, systemPrompt, imageDataUrl) {
  const split = imageDataUrl ? splitDataUrl(imageDataUrl) : null;
  const built = attachImageToLastUserMessage(messages, split ? imageDataUrl : null, (text) => ({
    role: 'user',
    content: [
      { type: 'text', text },
      { type: 'image', source: { type: 'base64', media_type: split.mimeType, data: split.base64 } },
    ],
  }));
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      messages: built,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Anthropic error');
  return data.content?.[0]?.text?.trim() || 'Xin lỗi, không nhận được phản hồi.';
}

async function callGemini(messages, systemPrompt, imageDataUrl) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  const split = imageDataUrl ? splitDataUrl(imageDataUrl) : null;
  // Gemini has no 'assistant' role — prior AI turns are 'model'.
  const contents = messages.map((m, i) => {
    const role = m.role === 'assistant' ? 'model' : 'user';
    if (split && i === messages.length - 1 && m.role === 'user') {
      return {
        role,
        parts: [{ text: m.content }, { inlineData: { mimeType: split.mimeType, data: split.base64 } }],
      };
    }
    return { role, parts: [{ text: m.content }] };
  });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: systemPrompt }] },
      // Newer Gemini models spend part of this budget on internal "thinking"
      // before the visible answer, so 1024 was truncating replies mid-sentence.
      generationConfig: { maxOutputTokens: 4096 },
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'Gemini error');
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Xin lỗi, không nhận được phản hồi.';
}

async function callOllama(messages, systemPrompt) {
  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: false,
    }),
  });

  const data = await response.json();
  if (!response.ok) throw new Error('Ollama error');
  return data.message?.content?.trim() || 'Xin lỗi, không nhận được phản hồi.';
}

/**
 * Classifies why a provider call failed, for the operator's log.
 *
 * "AI provider error" told whoever was on call nothing, so diagnosing a dead
 * assistant meant finding the key, finding the model name and calling the
 * provider by hand. These are the three answers that need different actions,
 * and the provider says which one it is — it just says it in a sentence rather
 * than a code.
 */
export function classifyAiError(err) {
  const text = String(err?.message || '').toLowerCase();
  if (/credit|quota|billing|exceeded|insufficient|depleted|payment/.test(text)) {
    return { kind: 'billing', hint: 'Tài khoản AI hết hạn mức hoặc hết tiền — nạp thêm hoặc đổi nhà cung cấp.' };
  }
  if (/no longer available|not found|unsupported|does not exist|deprecat/.test(text)) {
    return { kind: 'model', hint: 'AI_MODEL không còn tồn tại — bỏ biến này để dùng alias mặc định.' };
  }
  if (/api key|unauthenticated|unauthorized|permission|invalid.*key|forbidden/.test(text)) {
    return { kind: 'auth', hint: 'Khoá API sai hoặc bị thu hồi.' };
  }
  return { kind: 'unknown', hint: 'Lỗi từ nhà cung cấp AI.' };
}

/**
 * Sends a conversation to whichever provider is configured and returns the
 * reply text. Throws on provider failure; callers map that to a 502.
 */
export async function callAi({ messages, system, imageDataUrl = null }) {
  const systemPrompt = system || SPROUTY_SYSTEM;
  if (PROVIDER === 'anthropic') return callAnthropic(messages, systemPrompt, imageDataUrl);
  if (PROVIDER === 'gemini') return callGemini(messages, systemPrompt, imageDataUrl);
  if (PROVIDER === 'ollama') return callOllama(messages, systemPrompt);
  return callOpenAI(messages, systemPrompt, imageDataUrl);
}
