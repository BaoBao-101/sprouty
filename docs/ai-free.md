# Dùng AI miễn phí cho Plant Buddy

Written for: whoever sets the assistant up, now or the next time it stops working.

**Hiện đang dùng Groq** (xem Cách 1). Phần dưới giữ lại để biết vì sao đổi, và
để làm gì khi Groq cũng hỏng.

Gemini trước đó chết vì tài khoản **hết hạn mức trả trước**:

```
"Your prepayment credits are depleted. Please go to AI Studio..."
```

Khoá vẫn hợp lệ — chỉ là không còn tiền. Dưới đây là các cách chạy lại mà không
tốn phí.

---

## Không chạy AI ngay trên VPS được

VPS chỉ có **964 MB RAM, còn trống ~366 MB** và 2 vCPU dùng chung. Ollama kể cả
với model nhỏ nhất cũng cần hơn 1,5 GB và sẽ khiến Linux giết tiến trình
backend. Đây không phải lựa chọn — phải dùng API bên ngoài.

---

## Cách 1 — Groq (khuyến nghị)

Miễn phí, **không cần thẻ tín dụng**, hạn mức rộng, tốc độ rất nhanh. API tương
thích OpenAI nên dùng được ngay, không phải sửa code.

1. Vào **console.groq.com** → đăng nhập bằng Google
2. **API Keys** → **Create API Key** → copy (dạng `gsk_...`)
3. Sửa `.env` trên VPS:

```bash
AI_PROVIDER=openai
AI_ENDPOINT=https://api.groq.com/openai/v1/chat/completions
AI_API_KEY=gsk_...
AI_MODEL=qwen/qwen3.8-27b
AI_SUPPORTS_IMAGES=false
```

**Đây là cấu hình đang chạy thật** (đo được 674 ms cho một lượt hỏi Plant Buddy).

Về chọn model: Groq còn có `openai/gpt-oss-20b` và `openai/gpt-oss-120b`, nhưng
cả hai đều trả về nội dung **rỗng** với tham số hiện tại — chúng là model
reasoning, đặt câu trả lời ở một trường khác. `qwen/qwen3.8-27b` trả lời tiếng
Việt tự nhiên và dùng đúng số liệu cảm biến được đưa vào.

Danh sách model đổi theo thời gian; kiểm tra bằng:

```bash
curl -s https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $AI_API_KEY" | grep -o '"id":"[^"]*"'
```

`AI_SUPPORTS_IMAGES=false` là bắt buộc với model chỉ xử lý text. Không đặt, nút
**"AI gợi ý caption"** trong album sẽ gửi ảnh đi rồi nhận lỗi mà khách không
hiểu vì sao; đặt rồi thì nút bị từ chối sạch sẽ kèm lời giải thích.

Xoá `GEMINI_API_KEY` hoặc để nguyên cũng được — nó bị bỏ qua khi
`AI_PROVIDER` không phải `gemini`.

---

## Cách 2 — Gemini free tier

Nếu muốn giữ Gemini. Khoá free khác khoá trả trước đang hết tiền.

1. Vào **aistudio.google.com/app/apikey** (chú ý có `/app/`)
2. **Create API key in new project**
3. Khoá đúng phải bắt đầu bằng **`AIza...`**

**Nếu khoá nhận được bắt đầu bằng `AQ.` thì không dùng được.** Đó là token
OAuth gắn với phiên đăng nhập, không phải API key; Google từ chối nó ở cả ba
cách gửi (`?key=`, header `x-goog-api-key`, `Authorization: Bearer`) với thông
báo *"Expected OAuth 2 access token"*. Gặp trường hợp này thì dùng Groq.

```bash
AI_PROVIDER=gemini
GEMINI_API_KEY=AIza...
# Để trống AI_MODEL.
```

**Đừng ghim `AI_MODEL`.** Đó chính là thứ đã làm hỏng lần này: `.env` ghim
`gemini-2.5-flash`, rồi Google ngừng cấp model đó cho người dùng mới và trợ lý
chết. Bỏ trống thì code dùng `gemini-flash-latest` — alias xoay vòng, Google tự
trỏ sang bản mới.

Hạn mức free tính theo ngày; hết thì chờ sang ngày hôm sau.

---

## Cách 3 — OpenRouter

Có nhiều model gắn hậu tố `:free`. Cũng tương thích OpenAI.

```bash
AI_PROVIDER=openai
AI_ENDPOINT=https://openrouter.ai/api/v1/chat/completions
AI_API_KEY=sk-or-...
AI_MODEL=meta-llama/llama-3.3-70b-instruct:free
AI_SUPPORTS_IMAGES=false
```

---

## Áp dụng và kiểm tra

```bash
ssh sprouty
sudo nano /var/www/sprouty/.env          # sửa các dòng ở trên
cd /var/www/sprouty
sudo docker compose up -d backend        # nạp lại biến môi trường
sudo docker compose restart nginx        # nginx giữ IP container cũ
```

Rồi mở một cây bất kỳ và bấm **"Hỏi Plant Buddy"**.

Hỏng thì log nói rõ nguyên nhân chứ không chỉ "AI provider error":

```bash
sudo docker compose logs backend --tail 40 | grep -i aiCause
```

| `aiCause` | Nghĩa là |
| --- | --- |
| `billing` | Hết hạn mức hoặc hết tiền — nạp thêm, hoặc đổi sang cách khác ở trên |
| `model` | `AI_MODEL` không còn tồn tại — xoá dòng đó đi để dùng alias mặc định |
| `auth` | Khoá sai hoặc đã bị thu hồi |

---

## Về máy local

`.env` ở máy local đang `AI_PROVIDER=openai` với `AI_API_KEY` để trống, nên AI
không chạy được dù sửa gì trên VPS. Điền cùng một khoá vào `.env` local rồi khởi
động lại backend là xong.

---

## Vì sao không cần viết code cho từng nhà cung cấp

`AI_ENDPOINT` trỏ đi đâu thì đường OpenAI gọi tới đó. Groq, OpenRouter, Together,
hay một gateway tự dựng — tất cả đều nói cùng một giao thức, nên đổi nhà cung cấp
chỉ là đổi ba dòng trong `.env`.

Chỉ Gemini và Anthropic có định dạng request riêng nên mới có nhánh code riêng.
