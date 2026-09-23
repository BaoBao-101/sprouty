# Deploy Sprouty lên DigitalOcean (sprouty.id.vn)

Checklist triển khai production. Stack: Fastify backend + Postgres + Prisma, nginx làm reverse proxy/static server, Let's Encrypt SSL, tất cả chạy qua `docker-compose.yml` ở root repo.

## Cấu trúc repo

```
sprouty/
├── frontend/   TypeScript + Vite — build ra HTML/CSS/JS tĩnh cho nginx
├── backend/    Fastify + Prisma + Postgres
├── docker/     nginx.conf (production), nginx.local.conf (máy local), script backup
└── docs/
```

**Frontend cần bước build.** Trước đây nginx đọc thẳng file HTML/JS từ repo; giờ
`frontend/Dockerfile` chạy `npm ci && npm run build` rồi copy thư mục `dist/` vào
image nginx. Nghĩa là **mọi thay đổi ở frontend đều phải chạy lại
`docker compose up -d --build`** mới có hiệu lực — không còn chuyện sửa file rồi
refresh trình duyệt là thấy ngay.

Chi tiết cách làm việc với frontend (lệnh dev, quy ước đường dẫn ảnh, cầu nối
`window`, lộ trình siết dần TypeScript): xem [`docs/frontend.md`](frontend.md).

## 0. Chuẩn bị trước
- [ ] Droplet DigitalOcean đã tạo (khuyến nghị >= 2GB RAM)
- [ ] Domain `sprouty.id.vn` trỏ về IP droplet:
  - `A` record `sprouty.id.vn` → `<droplet-ip>`
  - `A` record `www.sprouty.id.vn` → `<droplet-ip>` (nếu dùng)
  - Kiểm tra: `dig sprouty.id.vn` phải trả về đúng IP

## 1. Cài đặt trên droplet
```bash
ssh root@<droplet-ip>

curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin certbot ufw

ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw enable
```

## 2. Lấy SSL certificate (trước khi start container, vì nginx cần cert để listen 443)
```bash
certbot certonly --standalone -d sprouty.id.vn -d www.sprouty.id.vn
```
Cert sẽ nằm ở `/etc/letsencrypt/live/sprouty.id.vn/` — đúng path mà `docker-compose.yml` mount vào container `frontend`.

## 3. Lấy code lên droplet
```bash
git clone <your-repo-url> /opt/sprouty
cd /opt/sprouty
cp .env.example .env
```

## 4. Điền `.env`
Các biến bắt buộc:
```
POSTGRES_PASSWORD=<random, vd: openssl rand -base64 32>
POSTGRES_PASSWORD_URLENC=<bản URL-encode của POSTGRES_PASSWORD — dùng trong DATABASE_URL vì password base64 có thể chứa / + =>
NODE_ENV=production
COOKIE_SECRET=<openssl rand -hex 32>
REDEEM_CODE_SECRET=<openssl rand -hex 32, khác với COOKIE_SECRET>
ALLOWED_ORIGIN=https://sprouty.id.vn
TRUST_PROXY=false
```
Điền thêm nếu dùng tính năng tương ứng:
- Chatbot AI: `AI_PROVIDER` (`openai`|`anthropic`|`gemini`|`ollama`) + key tương ứng (`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`/`GEMINI_API_KEY`), `AI_MODEL` (tuỳ chọn), `AI_ENDPOINT` (chỉ openai)
- Thanh toán SePay: `SEPAY_API_KEY`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME`
  - **`SEPAY_BANK_CODE` phải là mã mà `qr.sepay.vn` chấp nhận — không phải lúc nào cũng trùng mã SWIFT quen thuộc.** Ví dụ hay nhầm nhất: **VietinBank là `ICB`, không phải `VTB`** — dùng nhầm `VTB` sẽ khiến API trả về lỗi `"Ngân hàng này không được hỗ trợ"` (HTML, không phải ảnh) và QR không hiện được, dù mọi biến khác đều đúng.
  - Đã verify trực tiếp các mã sau đều hợp lệ: `VCB` (Vietcombank), `MB` (MBBank), `TCB` (Techcombank), `ACB`, `BIDV`, `ICB` (VietinBank), `AGRIBANK`.
  - Cách tự kiểm tra 1 mã bất kỳ trước khi điền vào `.env` — nếu lệnh dưới trả về `image/png` là đúng, trả về `text/html` (kèm thông báo lỗi) là sai:
    ```bash
    curl -s -o /dev/null -w "%{content_type}\n" \
      "https://qr.sepay.vn/img?acc=<số_tài_khoản>&bank=<mã_ngân_hàng>&amount=10000&des=TEST"
    ```
- Lưu file: mặc định `ASSET_STORAGE_PROVIDER=local` (lưu trong volume `backend_uploads`); nếu dùng S3 thì điền các biến `S3_*`

## 5. Deploy
```bash
docker compose up -d --build
docker compose logs -f backend   # xác nhận "prisma migrate deploy" + seed chạy thành công, server listening
docker compose ps                # cả 3 service (postgres, backend, frontend) phải healthy
```

## 6. Kiểm tra
```bash
curl -I https://sprouty.id.vn
curl https://sprouty.id.vn/api/v1/health
```
Mở trình duyệt vào `https://sprouty.id.vn`, kiểm tra ổ khóa SSL hợp lệ.

## 7. Auto-renew SSL
```bash
crontab -e
```
Thêm dòng:
```
0 3 * * * certbot renew --quiet --deploy-hook "cd /opt/sprouty && docker compose restart frontend"
```

## 7b. Backup định kỳ cho ảnh/video người dùng upload

Ảnh/video user upload (chụp cây, kỷ niệm...) lưu ở Docker volume `backend_uploads` — **không nằm trong git, không có backup nào khác**. Nếu volume bị xoá nhầm (`docker compose down -v`, `docker volume rm`...) thì mất vĩnh viễn. Setup backup hàng ngày:

```bash
mkdir -p /root/backups/sprouty-uploads
chmod +x /opt/sprouty/docker/backup-uploads.sh

crontab -e
```
Thêm dòng (backup mỗi ngày lúc 2h sáng, giữ lại 14 ngày gần nhất):
```
0 2 * * * /opt/sprouty/docker/backup-uploads.sh >> /var/log/sprouty-backup.log 2>&1
```

Chạy thử ngay để xác nhận hoạt động:
```bash
/opt/sprouty/docker/backup-uploads.sh
ls -lh /root/backups/sprouty-uploads/
```

Khuyến nghị thêm: định kỳ đồng bộ thư mục `/root/backups/sprouty-uploads/` ra ngoài VPS (S3, Google Drive, `rsync` sang máy khác...) — backup nằm cùng ổ đĩa với dữ liệu gốc không chống được trường hợp mất cả VPS. Việc backup Postgres (`postgres_data` volume) vẫn còn thiếu tương tự — cân nhắc làm chung cơ chế `pg_dump` định kỳ.

## 8. Cập nhật code sau này

**Cách A — dùng git (khuyến nghị nếu repo đã push lên remote):**
```bash
cd /opt/sprouty
git pull
docker compose up -d --build   # rebuild + tự chạy lại migrate deploy khi backend container start
docker compose logs -f backend # xác nhận start OK, không lỗi
```

**Cách B — copy file thủ công qua scp** (khi chưa push lên git remote, ví dụ đang sửa trực tiếp trên máy local):
```bash
# Chạy từ máy đang chứa code đã sửa, thay <file> bằng từng file đã đổi
scp <file> root@167.172.72.122:/opt/sprouty/<file>

ssh root@167.172.72.122 "cd /opt/sprouty && docker compose up -d --build"
```

Sau khi rebuild, luôn kiểm tra lại đúng chức năng vừa sửa qua domain thật (`https://sprouty.id.vn`) — build/logs sạch không có nghĩa là logic đúng.

### Lịch sử các bản sửa đã deploy

| Ngày | Thay đổi | File | Ghi chú |
|---|---|---|---|
| 2026-07-10 | Fix lỗ hổng gian lận redeem code: audit log lượt kích hoạt trùng, thêm endpoint + UI admin để thu hồi lượt kích hoạt sai và cấp lại cho đúng chủ đơn hàng | `backend/src/routes/redeem.js`, `backend/src/routes/admin/redeem-codes.js`, `pages/admin/index.html`, `assets/js/api.js` | Không có migration DB. Đã test end-to-end (đăng ký → mua → active kit → fraud → admin thu hồi → active lại) trên môi trường local trước khi deploy. |
| 2026-07-10 | Fix lỗi admin/employee bấm "Đăng xuất" không thực sự kết thúc phiên: client giả vờ thành công khi gặp lỗi CSRF (403) dù session vẫn còn sống trên server. Giờ tự làm mới CSRF token trước khi logout + retry 1 lần, chỉ coi 401 là "đã đăng xuất rồi" | `assets/js/api.js`, `assets/js/app.js` | Chỉ frontend, không cần rebuild backend, không cần migration. |

## Ghi chú
- File `docker/nginx.conf` đã hard-code `server_name sprouty.id.vn` — nếu đổi domain phải sửa file này.
- `docker-compose.yml` publish port 80/443 ra ngoài; backend/postgres không expose port ra internet, chỉ giao tiếp nội bộ qua network `sprouty`.
- Đường dẫn `/pages/admin/` và `/pages/employee/` bị chặn ở tầng nginx nếu không có cookie `session_id`.
- Không commit file `.env` thật lên git.
