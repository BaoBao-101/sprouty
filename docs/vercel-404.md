# sprouty.id.vn báo 404 khi đăng ký / mở trang con

Written for: whoever owns the Vercel project, now or the next time this breaks.

## Triệu chứng

- Mở `https://sprouty.id.vn` thì trang chủ hiện bình thường.
- Bấm **Đăng ký** → hiện `HTTP 404`.
- Mở thẳng `https://sprouty.id.vn/shop` → trang 404 của Vercel.

## Nguyên nhân

Không phải backend hỏng. Backend vẫn chạy tốt:

```
https://api.sprouty.id.vn/api/v1/health   →  HTTP 200
https://www.sprouty.id.vn/api/v1/health   →  HTTP 404  (X-Vercel-Error: NOT_FOUND)
https://www.sprouty.id.vn/shop            →  HTTP 404
```

Trang chủ chạy được vì `index.html` là file tĩnh có thật. Mọi đường dẫn khác 404 vì
Vercel **không đọc được file cấu hình** — nên nó không biết hai việc:

1. Chuyển tiếp `/api/*` sang `api.sprouty.id.vn`.
2. Trả `index.html` cho mọi đường dẫn khác (React Router cần cái này — `/shop`
   không phải là một file trên đĩa).

Vercel chỉ đọc `vercel.json` nằm **ngay trong thư mục gốc của project** mà bạn đã
chọn khi tạo project. Repo này có `vercel.json` ở gốc repo. Nếu khi tạo project
bạn đặt **Root Directory = `frontend`**, Vercel sẽ tìm `frontend/vercel.json` và
không bao giờ thấy file ở gốc.

## Cách sửa nhanh nhất (không cần đụng vào code)

File `vercel.json` ở gốc repo **đã có sẵn trên GitHub từ trước**. Chỉ cần bảo
Vercel nhìn vào đó:

1. Vào **vercel.com** → project Sprouty → **Settings** → **General**
2. Tìm mục **Root Directory**
3. Nếu đang là `frontend` → **xoá trống nó đi** rồi bấm **Save**
4. Qua tab **Deployments** → deployment mới nhất → menu `…` → **Redeploy**
5. **Bỏ tick** ô "Use existing Build Cache" → bấm **Redeploy**

Chờ 1–2 phút rồi kiểm tra theo phần **Kiểm tra lại** bên dưới.

---

## Cách sửa lâu dài (sau khi push code mới)


Repo giờ có **cả hai** file, nội dung tương đương, nên đặt Root Directory kiểu nào
cũng chạy:

- `vercel.json` — dùng khi Root Directory để trống (gốc repo)
- `frontend/vercel.json` — dùng khi Root Directory là `frontend`

Việc cần làm: **deploy lại**.

1. Vào **vercel.com** → project Sprouty → **Deployments**
2. Deployment mới nhất → menu `…` → **Redeploy**
3. **Bỏ tick** "Use existing Build Cache" → **Redeploy**

Chờ khoảng 1–2 phút.

## Kiểm tra lại

Mở hai đường dẫn này trên trình duyệt:

- `https://sprouty.id.vn/api/v1/health` → phải thấy chữ, **không** phải trang 404
- `https://sprouty.id.vn/shop` → phải thấy trang Sản phẩm

Được cả hai thì đăng ký sẽ chạy.

## Nếu vẫn 404

Nghĩa là deployment đang chạy vẫn không thấy file cấu hình. Vào
**Settings → General → Root Directory** của project và xem nó đang là gì:

| Root Directory | File Vercel đọc | Đúng chưa |
| --- | --- | --- |
| (để trống) | `vercel.json` | ✅ |
| `frontend` | `frontend/vercel.json` | ✅ |
| cái khác | không file nào | ❌ sửa thành `frontend` |

Sửa xong nhớ **Redeploy** lần nữa — đổi setting không tự deploy lại.

## Vì sao phải proxy qua Vercel chứ không gọi thẳng api.sprouty.id.vn

Cookie phiên đăng nhập được đặt `SameSite=Strict` và **không** có `Domain`. Trình
duyệt chỉ gửi kèm cookie đó khi request cùng origin với trang. Rewrite của Vercel
là proxy chạy phía server, nên trình duyệt vẫn coi `/api/...` là cùng origin với
`sprouty.id.vn` và cookie đi kèm bình thường.

Nếu đổi frontend sang gọi thẳng `https://api.sprouty.id.vn`, đăng nhập sẽ "thành
công" rồi lần request sau lại báo chưa đăng nhập, vì cookie không được gửi đi.
