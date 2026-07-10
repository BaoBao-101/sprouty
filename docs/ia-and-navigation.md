# Craftory — Information Architecture & Navigation

## Site Map

```
/ (index.html)
├── /pages/shop.html           — Product catalog
│   └── /pages/product-detail.html?id=N  — Product page
├── /pages/cart.html           — Shopping cart + checkout
├── /pages/payment.html        — [Auth: customer+] SePay QR + payment status (?orderId=…)
├── /pages/workshop.html       — Workshop listing + registration
├── /pages/ai.html             — AI assistant chatbot
├── /pages/about.html          — Company story & team
├── /pages/faq.html            — FAQ
├── /pages/contact.html        — Contact form
├── /pages/returns.html        — Return policy
│
├── /pages/account.html        — [Auth: customer+] Order history, profile
│
├── /pages/employee/           — [Auth: employee+]
│   ├── orders.html            — Order management (update status)
│   └── products.html          — Product CRUD
│
└── /pages/admin/              — [Auth: admin]
    └── index.html             — Dashboard, user management, stats
```

## Navigation Structure

### Main Navigation (all users)
- Trang chủ
- Sản phẩm
- Workshop
- Trợ lý AI
- Giới thiệu
- Của tôi (→ account or login prompt)

### Auth State: Not Logged In
- Shows "Đăng nhập" button → opens login modal
- Cart badge visible

### Auth State: Logged In (customer)
- Avatar/name button → user menu dropdown
  - Đơn hàng của tôi → /pages/account.html
  - Giỏ hàng
  - Đăng xuất

### Auth State: Logged In (employee)
- Same as customer + "👷 Cổng nhân viên" → /pages/employee/orders.html

### Auth State: Logged In (admin)
- Same as employee + "⚙️ Quản trị" → /pages/admin/index.html

## Footer Links

```
Products          Support         About
├── Bộ kit thủ công  ├── Trợ lý AI    ├── Câu chuyện
├── Giấy hướng dẫn   ├── FAQ          ├── Đội ngũ
└── Workshop         └── Liên hệ      └── Liên hệ
```

## Mobile Navigation
- Hamburger menu (≤768px) reveals drawer from left
- Drawer contains all nav links + login/logout

## Role-Protected Routes

| URL Pattern | Required Role | Redirect if denied |
|-------------|--------------|-------------------|
| /pages/account.html | any (logged in) | shows login prompt |
| /pages/employee/* | employee or admin | shows access denied |
| /pages/admin/* | admin only | shows access denied |

## URL Parameters

- `/pages/product-detail.html?id=1` — product ID
- `/pages/admin/index.html#users` — hash routing (planned)
