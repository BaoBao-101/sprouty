# Frontend — cấu trúc và cách làm việc

Frontend là một **SPA React**: `frontend/index.html` chỉ là vỏ rỗng, toàn bộ giao
diện nằm trong `frontend/src/`, build bằng **Vite**.

Stack: React 19 · React Router 7 · TypeScript · Vite 6.
CSS là file tự viết (`src/styles/style.css`), **không dùng Tailwind** — hệ thống
thiết kế của Sprouty đã có sẵn ở đó.

## Cấu trúc thư mục

```
frontend/
├── index.html              Vỏ SPA, chỉ có <div id="app"> và 1 thẻ script
├── public/                 File tĩnh, Vite copy nguyên xi
│   ├── assets/images/      Ảnh sản phẩm, banner, icon
│   ├── assets/fonts/
│   ├── robots.txt
│   └── sitemap.xml
├── src/
│   ├── main.tsx            Điểm vào: dựng Router + các Provider
│   ├── App.tsx             Toàn bộ bảng định tuyến + chuyển hướng URL cũ
│   ├── layouts/            Khung trang
│   │   ├── PublicLayout    Header + Footer cho trang bán hàng
│   │   ├── AdminLayout     Sidebar quản trị
│   │   ├── EmployeeLayout  Sidebar nhân viên
│   │   └── StaffSidebar    Sidebar dùng chung cho 2 cái trên
│   ├── pages/
│   │   ├── public/         19 trang khách hàng
│   │   ├── admin/          9 trang quản trị
│   │   └── employee/       2 trang nhân viên
│   ├── components/         Component dùng lại nhiều nơi
│   ├── contexts/           AuthContext, CartContext
│   ├── services/           api.ts, products.ts, cart.ts, toast.ts
│   ├── hooks/              useProducts
│   ├── data/               Nội dung tĩnh (FAQ, workshop, vị trí lá trên cây)
│   ├── types/              Kiểu dữ liệu dùng chung (product, order)
│   └── styles/style.css    CSS toàn cục
├── Dockerfile              Build tĩnh rồi giao cho nginx
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Lệnh thường dùng

Chạy trong thư mục `frontend/`:

| Lệnh | Việc |
|---|---|
| `npm install` | Cài thư viện (lần đầu) |
| `npm run dev` | Server dev tại `http://localhost:5173`, sửa tới đâu thấy tới đó |
| `npm run build` | Build ra `dist/` |
| `npm run typecheck` | Kiểm tra kiểu. **Phải luôn 0 lỗi** trước khi commit |
| `npm run smoke` | Render thử cả 30 trang bằng Node, báo trang nào lỗi |

`npm run build` **không** kiểm tra kiểu — Vite chỉ bóc bỏ phần khai báo kiểu.
Muốn biết code có lỗi kiểu hay không thì chạy `npm run typecheck`.

`npm run smoke` là lưới an toàn: nó dựng từng trang bằng `react-dom/server` và
báo trang nào ném lỗi. Bắt được loại lỗi mà trên trình duyệt chỉ hiện ra dưới
dạng **trang trắng**, còn terminal thì im lặng.

## Định tuyến

`src/App.tsx` khai báo mọi đường dẫn. Trang được nạp theo kiểu `lazy` nên mỗi
route là một bundle riêng — vào trang nào tải trang đó.

Ba nhánh chính:

- **Công khai** — bọc trong `PublicLayout`
- **Khách đã đăng nhập** — thêm `<ProtectedRoute />` (giỏ hàng, tài khoản, cây)
- **Nhân viên / quản trị** — `<ProtectedRoute role="employee" | "admin" />`

`ProtectedRoute` **chỉ là tiện ích cho người dùng, không phải hàng rào bảo mật**.
Ai cũng đọc được bundle. Mọi endpoint phía sau đều được backend kiểm tra quyền
lại một lần nữa.

### URL cũ vẫn chạy

Trang web trước đây là các file `.html` rời. `LEGACY_REDIRECTS` trong `App.tsx`
chuyển hướng chúng sang route mới, nên link cũ và `sitemap.xml` không bị hỏng:

```
/pages/shop.html  →  /shop
/pages/admin/index.html  →  /admin
```

## Quy ước

**Đường dẫn ảnh, font luôn tuyệt đối**, bắt đầu bằng `/assets/`:

```tsx
<img src="/assets/images/products/bean.png" />
```

```css
background: url(/assets/images/banner/start-banner.png);
```

Không dùng `../../assets/...`. File nằm trong `public/`, Vite phục vụ chúng ở gốc
website, nên đường dẫn tương đối sẽ sai khi route nằm ở cấp con.

**CSS riêng của từng trang** đặt cạnh component và import từ đó:

```
src/pages/public/Shop.tsx
src/pages/public/Shop.css   ← import './Shop.css'
```

Vite gom chúng vào bundle. CSS dùng chung cho nhiều trang thì để
`src/styles/style.css`.

**Alias `@/`** trỏ tới `src/`. Dùng `@/components/ProductCard` thay vì
`../../components/ProductCard`.

## Về mức chặt của TypeScript

`tsconfig.json` hiện để lỏng:

```json
"strict": false,
"noImplicitAny": false,
"strictNullChecks": false
```

Đây là chủ ý. Toàn bộ frontend được viết lại từ JavaScript thuần trong một đợt;
bật chặt ngay sẽ ra hàng trăm lỗi có sẵn và chặn việc build.

**Thứ tự nên bật dần** — mỗi lần một mục, sửa hết lỗi rồi mới sang mục tiếp:

1. `noImplicitAny` — buộc khai báo kiểu cho tham số hàm. Giá trị cao nhất, làm
   trước.
2. `strictNullChecks` — bắt các trường hợp `document.getElementById(...)` trả về
   `null`. Ra nhiều lỗi nhất nhưng cũng là nhóm dễ gây lỗi runtime nhất.
3. `strict` — bật nốt phần còn lại.

Cách làm thực tế: bật cờ, chạy `npm run typecheck`, sửa dần theo danh sách, tạm
để lại file chưa sửa bằng `// @ts-nocheck` ở đầu file.

## Ghi chú khi sửa

- **Chạy `npm run typecheck` và `npm run smoke` trước khi commit.** Cả hai đang
  sạch, giữ nguyên như vậy.
- Thêm trang mới: tạo file trong `src/pages/...` rồi khai báo route trong
  `App.tsx`. Không cần đụng vào cấu hình build.
- **Mọi thay đổi frontend đều cần build lại** mới thấy trên `localhost:8080`
  (`docker compose ... up -d --build frontend`). Dùng `npm run dev` khi đang code
  cho nhanh.
- `ErrorBoundary` trong `App.tsx` bắt lỗi render và hiện thông báo kèm nội dung
  lỗi, thay vì để trang trắng không manh mối.
- `ALLOWED_ORIGIN` trong `.env` local có thêm `localhost:5173` để dev server gọi
  được API. **Trên VPS chỉ được để domain thật** — đừng copy mấy dòng localhost
  sang.
