# Tự động deploy khi push lên `main`

Written for: whoever sets this up once, and whoever debugs it later.

Hai nửa deploy bằng hai cơ chế khác nhau, vì chúng chạy trên hai host khác nhau:

| | Deploy bằng | Cần cấu hình gì |
| --- | --- | --- |
| **Frontend** | Vercel Git integration | Nối project với repo (1 lần, trên dashboard) |
| **Backend** | GitHub Actions → SSH → VPS | 4 secret trong repo (1 lần) |

Sau khi cài xong, mỗi lần `git push origin main` là cả hai tự chạy. Không cần
nhờ ai bấm nút nữa.

---

## 1. Backend — GitHub Actions

Workflow: `.github/workflows/deploy-backend.yml`

Chỉ chạy khi có thay đổi trong `backend/**`, nên sửa CSS không làm rebuild container.

### Cần thêm 4 secret

GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

| Name | Giá trị |
| --- | --- |
| `VPS_HOST` | IP của VPS |
| `VPS_USER` | user SSH trên VPS |
| `VPS_KNOWN_HOSTS` | host key của VPS, lấy bằng `ssh-keyscan -t ed25519 <IP>` |
| `VPS_SSH_KEY` | **private key** của cặp key dành riêng cho CI |

### Vì sao key riêng cho CI

Đừng dùng lại key cá nhân. Key của CI nằm trong GitHub, ai có quyền admin repo
đều đọc được log và có thể thêm workflow — nên nó phải là một key:

- thu hồi được độc lập (xoá 1 dòng trong `~/.ssh/authorized_keys` là xong, người
  vẫn đăng nhập được bình thường)
- biết rõ nó dùng cho việc gì, nhờ comment `github-actions@sprouty-deploy`

Tạo và cài:

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions@sprouty-deploy" -f ~/.ssh/sprouty_deploy

# Cài public key lên VPS
ssh-copy-id -i ~/.ssh/sprouty_deploy.pub <user>@<ip>
# hoặc thủ công: thêm nội dung sprouty_deploy.pub vào ~/.ssh/authorized_keys

# Nội dung dán vào secret VPS_SSH_KEY (toàn bộ, cả dòng BEGIN/END)
cat ~/.ssh/sprouty_deploy
```

### `VPS_KNOWN_HOSTS` để làm gì

Để CI biết trước host key của VPS. Nhiều workflow dùng `ssh-keyscan` ngay trong
lúc chạy — như vậy là tin bất cứ máy nào trả lời hôm đó, đúng cái mà host key
sinh ra để ngăn. Ghim sẵn thì một máy giả mạo không lừa được CI.

Đổi IP VPS thì phải cập nhật lại cả `VPS_HOST` và `VPS_KNOWN_HOSTS`.

### Workflow làm gì

1. SSH thử trước khi đụng vào gì cả — hỏng kết nối thì dừng sớm, chưa sửa gì
2. Copy **chỉ thư mục `backend/`** lên VPS
3. `docker compose up -d --build backend` (container tự chạy `prisma migrate deploy`)
4. Chờ container báo `healthy`, tối đa 10 phút
5. `docker compose restart nginx`
6. Gọi `https://api.sprouty.id.vn/api/v1/health`, phải ra 200 thì mới tính là thành công

Bước 5 không thừa: nginx chỉ phân giải tên `backend` một lần lúc khởi động, nên
container mới có IP mới là nginx vẫn proxy tới địa chỉ cũ — biểu hiện là 502
trong khi backend hoàn toàn bình thường.

### Vì sao chỉ copy `backend/`

VPS giữ bản `docker-compose.yml`, `docker/nginx.conf` và `.env` **riêng**, khác
với repo (chi tiết: `docs/deploy-split.md`). Copy cả repo lên từng làm nginx
không khởi động được vì trỏ vào certificate mà host không có, kéo sập luôn API.

Đồng bộ đúng một thư mục khiến lỗi đó **không thể xảy ra do nhầm lẫn** nữa —
tốt hơn là viết một danh sách loại trừ rồi hy vọng người sau đọc nó.

Nếu cần sửa nginx hay compose trên VPS thì làm tay, và cập nhật
`docker/nginx.vps.conf` trong repo để lần sau không mất.

---

## 2. Frontend — Vercel

Vercel tự deploy mỗi khi có push, **nếu** project đã nối với repo.

**Settings → Git** → đảm bảo đang nối đúng repo và nhánh `main`.

**Settings → Build and Deployment:**

```
Build Command     cd frontend && npm install && npm run build
Output Directory  frontend/dist
```

Hai giá trị này đã có sẵn trong `vercel.json` ở gốc repo, nên bình thường Vercel
tự đọc. Chỉ cần sửa trên dashboard nếu ai đó đã ghi đè thủ công trước đó.

`vercel.json` cũng là nơi rewrite `/api/*` và `/uploads/*` về
`api.sprouty.id.vn`. Nhờ đó trình duyệt chỉ nói chuyện với một origin duy nhất:
cookie phiên (`sameSite: Strict`) vẫn gửi được và không dính CORS.

**Lưu ý:** sửa `vercel.json` thì phải deploy lại Vercel mới có tác dụng. Trước
khi bản deploy đó lên, web vẫn load bình thường nhưng mọi lệnh gọi API trả 404 —
rất dễ tưởng nhầm là backend hỏng.

---

## Khi deploy hỏng

**Actions báo đỏ ở bước "Wait for the container to report healthy"**
Workflow đã in sẵn 60 dòng log cuối của container. Thường là lỗi migration hoặc
biến môi trường thiếu. Container cũ vẫn đang phục vụ, nên site chưa chết.

**API trả 502**
nginx đang trỏ vào container cũ:
```bash
ssh <user>@<ip> 'cd /var/www/sprouty && sudo docker compose restart nginx'
```

**Quay về bản trước**
```bash
git revert <sha> && git push origin main
```
Workflow chạy lại và build bản đã revert. Không có cơ chế rollback image, vì
`docker compose up --build` luôn dựng lại từ source.

---

## Thu hồi quyền của CI

Xoá dòng chứa `github-actions@sprouty-deploy` trong `~/.ssh/authorized_keys`
trên VPS:

```bash
ssh <user>@<ip> "sed -i '/github-actions@sprouty-deploy/d' ~/.ssh/authorized_keys"
```

Key cá nhân không bị ảnh hưởng.
