# Product Images — Craftory

Thư mục này chứa ảnh thật cho từng sản phẩm (9 sản phẩm, KIT01–KIT09).

## Cấu trúc thư mục

```
product-images/
├── KIT01/          → Điều Ước Đầu Tiên (ID 1)
│   ├── KIT01-1.png   ← ảnh chính, hiển thị đầu tiên
│   ├── KIT01-2.png   ← góc chụp 2
│   ├── KIT01-3.png   ← góc chụp 3
│   └── KIT01-4.png   ← góc chụp 4
├── KIT02/          → Vườn Bướm Xinh (ID 2)
│   ├── KIT02-1.png ... KIT02-4.png
├── KIT03/          → Rồng Giấy Bay (ID 3)
├── KIT04/          → Ngôi Nhà Nhỏ Của Tôi (ID 4)
├── KIT05/          → Biển Xanh Kỳ Diệu (ID 5)
├── KIT06/          → Phố Đèn Lồng (ID 6)
├── KIT07/          → Vũ Trụ Bé Nhỏ (ID 7)
├── KIT08/          → Khu Rừng Phép Thuật (ID 8)
└── KIT09/          → Sách Thủ Công Mùa Xuân (ID 9)
```

## Quy ước đặt tên

| Pattern      | Ví dụ       | Mô tả                   |
|-------------|-------------|-------------------------|
| `KITxx-1.png` | `KIT01-1.png` | Ảnh chính (hiển thị mặc định) |
| `KITxx-2.png` | `KIT01-2.png` | Ảnh góc 2               |
| `KITxx-3.png` | `KIT01-3.png` | Ảnh góc 3               |
| `KITxx-4.png` | `KIT01-4.png` | Ảnh góc 4               |

## Thông số kỹ thuật

- **Kích thước gốc**: 2736 × 1536 px (tỉ lệ 16:9)
- **Định dạng**: PNG
- **Vùng chính**: Đặt chủ thể ở trung tâm để auto-crop đẹp nhất
- Website tự scale/crop — không cần resize thủ công

## Cách hoạt động (fallback 3 tầng)

```
KITxx/KITxx-N.png  ← Ảnh thật của bạn (ưu tiên)
       ↓ không tìm thấy
products/kit-N.svg ← SVG illustration
       ↓ không tải được
   emoji            ← fallback cuối
```

**Chỉ cần đặt file PNG đúng tên và thư mục — không cần sửa code.**
