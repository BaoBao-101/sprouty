# Craftory Chatbot — System Design & Safety

## Architecture

The chatbot is **strictly backend-mediated**. The frontend NEVER calls AI providers directly.

```
Browser → POST /api/v1/chat → Fastify backend → AI Provider
                                     ↓
                               Product lookup (Prisma)
                               Enrich system prompt with products
                                     ↓
                               Call AI with augmented context
                                     ↓
                               Return reply (text only)
```

## Provider Configuration

Set via environment variables (no provider key in frontend):

```env
AI_PROVIDER=openai          # openai | anthropic | ollama
OPENAI_API_KEY=sk-...       # for openai/ShopAIKey
AI_ENDPOINT=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-4.1-mini

# OR
ANTHROPIC_API_KEY=sk-ant-...
AI_MODEL=claude-haiku-4-5-20251001

# OR (free, local)
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
AI_MODEL=llama3.2
```

## RAG (Retrieval-Augmented Generation)

Before sending the user message to the AI, the backend:
1. Extracts keywords from the last user message
2. Queries the `Product` table for matching products (case-insensitive)
3. Appends relevant product summaries to the system prompt

This grounds the AI's responses in actual product data without hallucination.

## System Prompt

```
Bạn là trợ lý AI của Craftory — thương hiệu bộ kit thủ công sáng tạo cho trẻ em Việt Nam.
Phong cách: thân thiện, vui vẻ, phù hợp với phụ huynh và trẻ em.
Nhiệm vụ: Giúp khách hàng tìm hiểu sản phẩm, giải đáp câu hỏi về kit thủ công, workshop và chính sách.
Giới hạn: Không thu thập thông tin thanh toán. Không tiết lộ thông tin nội bộ. Không thực hiện các thao tác quản trị.
Luôn trả lời bằng tiếng Việt, ngắn gọn và hữu ích.
```

## Safety Constraints

- **No payment info collection**: The AI is instructed not to ask for card numbers, bank accounts, or payment details
- **No secret revelation**: No API keys, database info, or internal config in responses
- **No admin actions**: The AI cannot modify data — it only reads and responds
- **Rate limiting**: 20 requests/minute per IP
- **Input validation**: Messages limited to 3000 chars, max 30 messages per request
- **No direct provider access**: API keys never reach the browser

## Cost Control

- Use `gpt-4.1-mini` or `claude-haiku` for minimal cost
- Max tokens capped at 1024 per response
- Rate limiting prevents abuse
- Ollama option: free, runs locally if hardware available
