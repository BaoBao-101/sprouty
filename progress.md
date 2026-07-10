# Tóm tắt tiến độ deploy Sprouty qua Docker

## Bối cảnh dự án
- Dự án: **Sprouty** — web app có frontend + backend + database.
- Trước đây: chạy Nginx cài trực tiếp trên VPS (bare-metal), build `dist` thủ công rồi copy vào `/var/www/sprouty`. Đã cài sẵn Node, npm, npx trên host.
- Mục tiêu: chuyển toàn bộ sang **Docker/Docker Compose**, xóa Nginx/Node cài trực tiếp trên host (không còn cần thiết).

## Stack kỹ thuật
- **Backend**: Fastify (Node.js), có dùng migration (kiểu Prisma hoặc tương tự) + seed script.
- **Frontend**: có sẵn source code (`src`), build ra static files, serve qua Nginx (container `nginx:alpine`).
- **Database**: PostgreSQL 16 (alpine), có volume riêng `postgres_data`.
- **VPS**: DigitalOcean (hoặc tương tự), IP: `167.172.72.122`.
- **Domain**: `sprouty.id.vn` — đăng ký tại **iNET**, cả apex và `www` đều cần.
- **SSL**: Let's Encrypt qua Certbot, mount `/etc/letsencrypt` và `/var/www/certbot` vào container frontend.

## Kiến trúc docker-compose.yml hiện tại
3 services:
1. `postgres` — image `postgres:16-alpine`, có healthcheck `pg_isready`.
2. `backend` — build từ `./backend/Dockerfile` (multi-stage, Fastify), kết nối Postgres qua `DATABASE_URL`, có `POSTGRES_PASSWORD_URLENC` (password đã URL-encode) để tránh lỗi ký tự đặc biệt trong connection string, expose port 3000 nội bộ, volume `backend_uploads`, healthcheck qua `/api/v1/health`.
3. `frontend` — build từ `./frontend/Dockerfile` (multi-stage: build source rồi copy dist vào nginx:alpine), map port 80/443, mount cert Let's Encrypt, depends_on backend healthy.

Network riêng tên `sprouty_net` (đã đổi từ `sprouty_default` để tránh conflict với network mặc định do Compose tự tạo — từng bị lỗi `incorrect label` do trùng tên).

## Đã hoàn thành
1. ✅ Cài Docker Engine trên VPS.
2. ✅ Viết `backend/Dockerfile` (multi-stage Fastify build).
3. ✅ Viết `frontend/Dockerfile` (multi-stage: build từ src → nginx:alpine).
4. ✅ Viết `frontend/docker/nginx.conf` — có redirect HTTP→HTTPS, redirect `www` → apex domain, reverse proxy `/api/` sang `backend:3000`, security headers (CSP, HSTS...).
5. ✅ Sửa lỗi network trùng tên (`sprouty_default` vs `sprouty_net`).
6. ✅ Build + chạy thành công cả 3 container (`docker compose up -d --build`).
7. ✅ Backend chạy migration + seed thành công (log: "All migrations have been successfully applied", seed 6 products, 3 workshops).
8. ✅ SSL cert Let's Encrypt đã được lấy và áp dụng thành công (curl trực tiếp vào IP VPS trả về 200 OK với headers bảo mật đầy đủ).
9. ✅ Đã test truy cập domain thật `https://sprouty.id.vn` — **thành công, load được web** (ban đầu nghi ngờ do dải IP proxy `103.x.x.x` của iNET DNS Proxy service khác với IP VPS thật, nhưng cuối cùng xác nhận domain truy cập bình thường, không cần chỉnh bản ghi DNS).

## Việc còn dang dở / cần làm tiếp
1. ✅ **Xóa Nginx/Node cài trực tiếp trên host VPS** — user đã tự thực hiện thủ công.
2. ⏳ **Xác nhận lại DNS**: cần chạy `dig sprouty.id.vn +short` để confirm domain đang trỏ qua đâu (IP VPS thật `167.172.72.122` hay qua iNET DNS Proxy `103.x.x.x`) — nếu qua Proxy vẫn hoạt động tốt thì không cần đổi, nhưng nên hiểu rõ cơ chế để tránh nhầm lẫn khi debug sau này.
3. ⏳ **Test kỹ chức năng qua domain thật** (không chỉ health check): đăng ký/đăng nhập, upload file (test volume `backend_uploads`), gọi các API chính.
4. ⏳ **Blog posts đang bị skip khi seed** vì chưa có admin/employee author — cần tạo user admin trước nếu muốn tính năng blog hoạt động.
5. ⏳ **Setup backup Postgres tự động** (cron job `pg_dump` định kỳ) — chưa làm.
6. ⏳ **Setup log rotation cho Docker** (`max-size`, `max-file` trong mỗi service) — chưa thêm vào compose file.
7. ⏳ **Setup auto-renew SSL cert** qua cron (certbot renew + restart frontend) — đã hướng dẫn nhưng chưa xác nhận đã cấu hình.
8. ⏳ Kiểm tra `www.sprouty.id.vn` có redirect đúng về apex domain không.

## Câu hỏi mở cần làm rõ khi tiếp tục
- File entry point thật của backend Fastify là gì (`server.js`, `app.js`...) — Dockerfile hiện dùng `CMD ["node", "dist/server.js"]`, cần xác nhận đúng.
- Có dùng ORM nào (Prisma?) để biết cách xử lý migration/generate trong Dockerfile production.
- Domain hiện tại đi qua iNET DNS Proxy — cần quyết định giữ nguyên (nếu ổn định) hay chuyển sang DNS thuần trỏ thẳng VPS.