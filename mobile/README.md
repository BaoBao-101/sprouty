# Sprouty — ứng dụng di động cho phụ huynh

Ứng dụng Android + iOS cho tài khoản **khách hàng** (phụ huynh), viết bằng
**React Native + Expo** (SDK 58, Expo Router). Nhân viên và quản trị vẫn dùng
trang web; app từ chối đăng nhập tài khoản nhân sự.

```
mobile/
├── src/
│   ├── app/               Các màn hình — mỗi file là một đường dẫn (Expo Router)
│   │   ├── (tabs)/        Trang chủ · Cửa hàng · Khu vườn · Workshop · Của tôi
│   │   ├── product/[id]   Chi tiết bộ kit          plant/[id]   Chăm một cây
│   │   ├── cart, checkout, payment, orders          Mua hàng và đơn hàng
│   │   ├── album, ai, vip, blog/, settings, profile, delete-account, login, register, welcome
│   ├── components/        Khối giao diện (ui.tsx), icon SVG, cây vẽ, khối thanh toán…
│   ├── lib/               API, đăng nhập, giỏ hàng, nhắc nhở, app ngân hàng, định dạng
│   └── theme.ts           Màu, phông chữ, khoảng cách (giống web)
├── assets/                Icon, màn khởi động; assets/web/ là ảnh web thu nhỏ cho điện thoại
├── plugins/               Plugin cấu hình Expo (ký bản phát hành)
├── scripts/               Thu nhỏ ảnh, vẽ icon, chuyển icon SVG từ web, build APK/AAB
├── store/                 Icon 512/1024 và ảnh giới thiệu cho Google Play / App Store
└── app.json               Tên app, mã gói `vn.id.sprouty.app`, phiên bản, quyền
```

`android/` và `ios/` **không** nằm trong git: Expo tạo lại chúng mỗi lần build
(`npx expo prebuild`) từ `app.json` và `plugins/`. Muốn đổi gì phía native thì
sửa ở đó, không sửa tay trong `android/`.

## Chạy thử bằng Expo Go

Cần Node 20+. Cài app **Expo Go** (bản cho SDK 58) trên điện thoại hoặc máy ảo.

```bash
cd mobile
npm install           # lần đầu
npm start             # hiện mã QR — quét bằng Expo Go (điện thoại cùng Wi-Fi với máy tính)
npm run android       # mở luôn trên máy ảo Android đang chạy
```

Mặc định app nói chuyện với web và server thật (`www.sprouty.id.vn`,
`api.sprouty.id.vn`). Cây 3D thì nằm sẵn trong app (`npm run embed`), không
cần web. Để thử với dữ liệu trên máy tính trước khi đưa lên:

```bash
# ở thư mục gốc: docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
cd frontend && npm run dev          # web ở cổng 5173, chuyển /api sang backend Docker
cd mobile && npm run start:local    # app dùng web + backend trên máy này
```

`start:local` tự lấy địa chỉ máy tính mà Expo đang dùng (vd. `192.168.0.102`),
nên máy ảo Android và điện thoại thật cùng Wi-Fi đều vào được. Lần đầu Windows
có thể hỏi cho Node qua tường lửa — chọn cho phép mạng riêng (Private).

Dùng các tài khoản demo có sẵn (mật khẩu `123456`), không tạo tài khoản thử mới.

| Lệnh | Việc |
|---|---|
| `npm run typecheck` | Kiểm tra kiểu, phải 0 lỗi |
| `npm run apk` | **APK chính thức** (ký bằng khoá phát hành) → `release/sprouty-<version>.apk`, và chép sang `frontend/public/downloads/` cho trang `/tai-app` |
| `npm run aab` | Gói **AAB cho Google Play** (bản "store", xem dưới) → `release/sprouty-<version>.aab` |
| `npm run images` | Thu nhỏ ảnh của web (`frontend/public/assets/images`) vào `assets/web/` |
| `npm run icons` | Vẽ lại icon app, màn khởi động, ảnh store từ logo |
| `npm run port-svg` | Chuyển icon SVG và hình cây từ web (`SproutyIcon.tsx`, `PlantArt.tsx`) sang React Native |
| `npm run embed` | Đóng gói cây 3D của web (`frontend/src/embed-main.tsx`) thành một trang nằm sẵn trong app (`src/components/plant3d-page.ts`) — chạy lại sau khi sửa 3D trên web; `apk`/`aab` tự chạy |

## Build APK / AAB trên máy (không cần tài khoản Expo)

`scripts/build-android.mjs` chạy `expo prebuild` rồi Gradle ngay trên máy:
cần Android Studio (Android SDK, JDK 21 đi kèm) và khoảng 6 GB ổ đĩa trống cho
lần đầu (Gradle tự tải NDK; lần đầu mất 20–30 phút, các lần sau nhanh hơn).

- Chỉ gồm mã cho chip ARM (`arm64-v8a`, `armeabi-v7a`) — mọi điện thoại thật;
  máy ảo x86_64 Android 11+ vẫn chạy được. APK khoảng 30 MB.
- Thư viện native được nén trong APK và giải nén khi cài
  (`useLegacyPackaging` trong `app.json`): tải về nhẹ hơn, và chạy được cả trên
  máy ảo x86 dịch lệnh ARM.
- Trên Windows, script tự cài CMake 3.31.6 (ninja hỗ trợ đường dẫn dài) — với
  CMake 3.22 mặc định, đường dẫn trong `node_modules` vượt 260 ký tự và bước
  biên dịch C++ của `react-native-worklets` lỗi. Cần bật `LongPathsEnabled`
  của Windows (máy này đã bật).
- `android/` sinh ra khi build có thể xoá sau đó (lần build sau tự tạo lại).

| Bản | API | Dùng cho |
|---|---|---|
| `npm run apk` | `https://api.sprouty.id.vn` | Tải trực tiếp từ web — đủ mọi chức năng, kể cả mua VIP |
| `npm run aab` | `https://api.sprouty.id.vn` | Google Play (`EXPO_PUBLIC_STORE=1`) — **không bán VIP trong app** |

Vì sao có bản store: VIP Garden là hàng số. Apple (mục 3.1.1) và Google Play
bắt buộc hàng số bán trong app phải qua thanh toán của họ. Bản store hiện trạng
thái và quyền lợi VIP mà không có nút mua (`src/app/vip.tsx`). Bộ kit (hàng vật
lý gửi tận nhà) và vé workshop (dịch vụ ngoài đời) được phép thanh toán chuyển khoản.

## Đăng nhập trong app

- Web dùng cookie phiên 30 phút; app gửi **token** qua `Authorization: Bearer`
  cùng header `X-Sprouty-Client: app` (phiên app hết hạn sau 60 ngày không dùng,
  tối đa 180 ngày) — xem `backend/src/plugins/session.js`. Token nằm trong kho
  bảo mật của điện thoại (`expo-secure-store`).
- Ảnh/video riêng tư (album, video hướng dẫn) mở bằng "vé xem" ngắn hạn `?mt=`
  (`backend/src/services/media-token.js`).
- **Nếu backend chưa deploy bản mới**, app vẫn chạy bằng cookie như web (phiên
  30 phút), chỉ thiếu: ở lại đăng nhập lâu, xem ảnh/video riêng tư, xoá tài
  khoản trong app.

## Phát hành

### Khoá ký (quan trọng)

`keystore/sprouty-release.jks` + `keystore.properties` **không** nằm trong git.
Sao lưu cả hai vào nơi an toàn. Mất khoá này thì các máy đã cài APK không cập
nhật được nữa (phải gỡ cài lại), và phải nhờ Google đặt lại khoá upload trên
Play Console. **Không tạo khoá mới** — mọi bản APK từ trước tới nay đều ký bằng
khoá này. `plugins/with-release-signing.js` gắn khoá vào `android/app/build.gradle`
mỗi lần prebuild; script build dừng lại nếu khoá không được gắn.

`keystore.properties`:

```
storeFile=keystore/sprouty-release.jks
storePassword=...
keyAlias=sprouty
keyPassword=...
```

### Mỗi lần ra phiên bản mới

1. Trong `app.json`: tăng `version` (vd. `1.1.0` → `1.2.0`), `android.versionCode`
   (+1, số nguyên) và `ios.buildNumber`. `package.json` để cùng `version`.
2. `npm run apk` → trang `/tai-app` của web có bản mới sau khi deploy web.
3. `npm run aab` → tải `release/sprouty-<version>.aab` lên Play Console.

### Google Play

- Tài khoản nhà phát triển Google Play (25 USD, một lần). Tài khoản cá nhân mới
  phải cho ~12 người thử kín 14 ngày trước khi lên bản chính thức.
- Mã ứng dụng: `vn.id.sprouty.app` (không đổi được sau khi phát hành).
- Ảnh cần có: `store/icon-512.png`, `store/feature-graphic-1024x500.png`, và
  ảnh chụp màn hình điện thoại.
- Chính sách quyền riêng tư: `https://sprouty.id.vn/privacy` (đã có mục ứng dụng).
- Data safety: tên, email, số điện thoại, địa chỉ giao hàng, ảnh người dùng tải
  lên; không quảng cáo, không bán dữ liệu; xoá được tài khoản trong app
  (Của tôi → Xoá tài khoản).
- Đối tượng: app cho **phụ huynh** (người lớn tạo tài khoản), nội dung về trẻ em.

### App Store

- Apple Developer Program (99 USD/năm) và một máy Mac có Xcode.
- Trên Mac: `cd mobile && npm install && EXPO_PUBLIC_STORE=1 npx expo prebuild --platform ios`,
  mở `ios/Sprouty.xcworkspace`, chọn Team, Product → Archive → Distribute.
  (Hoặc dùng EAS Build của Expo nếu có tài khoản Expo.)
- Đã có sẵn trong `app.json`: icon 1024 không trong suốt, mô tả quyền máy
  ảnh/thư viện ảnh/micro bằng tiếng Việt, `ITSAppUsesNonExemptEncryption = false`;
  xoá tài khoản trong app; không bán hàng số ngoài IAP ở bản store.
- Tài khoản demo cho người duyệt của Apple: một tài khoản khách hàng có sẵn cây
  và đơn hàng trên server thật, ghi vào mục "App Review Information".

## Giao diện

Theo `AGENTS.md` ở thư mục gốc: icon SVG nét mảnh (bộ `SproutyIcon` của web, đã
chuyển sang `src/components/Icon.tsx`), không dùng emoji làm icon, màu xanh lá
dịu, kem, nâu đất. Nút bấm cao tối thiểu 44pt, chữ từ 15pt. Nội dung không rộng
quá 760pt nên trên iPad đọc như một trang sách; lưới sản phẩm, cây, ảnh tự thêm
cột trên màn rộng.
