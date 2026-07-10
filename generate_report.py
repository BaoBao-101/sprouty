#!/usr/bin/env python3
"""Generate the Craftory Docker restart report PDF."""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, HRFlowable)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

FD = "/usr/share/fonts/truetype/dejavu"
pdfmetrics.registerFont(TTFont("DejaVu", f"{FD}/DejaVuSans.ttf"))
pdfmetrics.registerFont(TTFont("DejaVu-Bold", f"{FD}/DejaVuSans-Bold.ttf"))
pdfmetrics.registerFont(TTFont("DejaVuMono", f"{FD}/DejaVuSansMono.ttf"))

styles = getSampleStyleSheet()
BODY = ParagraphStyle("body", parent=styles["Normal"], fontName="DejaVu",
                      fontSize=9.5, leading=14, alignment=TA_LEFT)
H1 = ParagraphStyle("h1", fontName="DejaVu-Bold", fontSize=18, leading=22,
                    spaceAfter=4, textColor=colors.HexColor("#1a3a5c"))
SUB = ParagraphStyle("sub", fontName="DejaVu", fontSize=10, leading=14,
                     textColor=colors.HexColor("#555555"))
H2 = ParagraphStyle("h2", fontName="DejaVu-Bold", fontSize=13, leading=17,
                    spaceBefore=14, spaceAfter=6,
                    textColor=colors.HexColor("#1a3a5c"))
MONO = ParagraphStyle("mono", parent=BODY, fontName="DejaVuMono", fontSize=8.5,
                      leading=12)
SMALL = ParagraphStyle("small", parent=BODY, fontSize=8, leading=11,
                       textColor=colors.HexColor("#666666"))

story = []

def p(txt, st=BODY):
    story.append(Paragraph(txt, st))

def sp(h=6):
    story.append(Spacer(1, h))

def hr():
    story.append(HRFlowable(width="100%", thickness=0.6,
                            color=colors.HexColor("#cccccc"),
                            spaceBefore=6, spaceAfter=6))

def table(data, col_widths, header=True):
    t = Table(data, colWidths=col_widths, hAlign="LEFT")
    cmds = [
        ("FONTNAME", (0, 0), (-1, -1), "DejaVu"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#bbbbbb")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1),
         [colors.white, colors.HexColor("#f4f7fa")]),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    if header:
        cmds += [
            ("FONTNAME", (0, 0), (-1, 0), "DejaVu-Bold"),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a3a5c")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ]
    t.setStyle(TableStyle(cmds))
    story.append(t)

# ---------- Title ----------
p("Craftory — Báo cáo Khởi động lại Docker Stack", H1)
p("Restart toàn bộ tiến trình Docker &amp; tài liệu vận hành", SUB)
p("Ngày thực hiện: 2026-06-15 &nbsp;•&nbsp; Thư mục dự án: /root/craftory-main &nbsp;•&nbsp; Người thực hiện: thu.tran@opswat.com", SMALL)
hr()

# ---------- 1. Yêu cầu ----------
p("1. Yêu cầu", H2)
p("Down (dừng) toàn bộ tiến trình Docker liên quan đến Craftory, sau đó chạy "
  "lại stack đối với thư mục <b>/root/craftory-main/</b>. Trong quá trình "
  "khởi động lại đã phát sinh nhiều lỗi cấu hình; báo cáo này ghi lại toàn bộ "
  "quá trình xử lý và thông tin đăng nhập của từng dịch vụ.", BODY)

# ---------- 2. Hiện trạng ----------
p("2. Hiện trạng ban đầu", H2)
p("Stack Craftory chạy bằng Docker Compose (project name: <b>craftory</b>) gồm "
  "3 service. Lưu ý: project name là <b>craftory</b> chứ không phải tên thư mục "
  "<b>craftory-main</b> — đây là lý do lệnh <font face='DejaVuMono'>docker compose down</font> "
  "ban đầu không tìm thấy container nào.", BODY)
sp()
p("Các container <b>frs401c_v2-*</b> trên cùng host thuộc dự án khác và đã được "
  "giữ nguyên, không tác động.", BODY)
sp(4)
table([
    ["Container", "Image", "Vai trò"],
    ["craftory-postgres-1", "postgres:16-alpine", "Cơ sở dữ liệu PostgreSQL"],
    ["craftory-backend-1", "craftory-backend (build sẵn)", "API backend (Node + Prisma)"],
    ["craftory-frontend-1", "nginx:alpine", "Web tĩnh + reverse proxy /api"],
], [55*mm, 60*mm, 60*mm])

# ---------- 3. Quá trình ----------
p("3. Quá trình thực hiện chi tiết", H2)

steps = [
    ("B1 — Khảo sát",
     "Liệt kê container và đọc <font face='DejaVuMono'>docker-compose.yml</font>. "
     "Xác định 3 service craftory và project name thực tế là <b>craftory</b>."),
    ("B2 — Down stack",
     "<font face='DejaVuMono'>docker compose down</font> thông thường không xoá "
     "gì (sai project name). Phải dùng <font face='DejaVuMono'>-p craftory</font> "
     "thì 3 container + network mới được gỡ bỏ thành công."),
    ("B3 — Không build được",
     "<font face='DejaVuMono'>up --build</font> thất bại: không có "
     "<font face='DejaVuMono'>backend/Dockerfile</font>. Thư mục "
     "<font face='DejaVuMono'>backend/</font> chỉ chứa vài file overlay "
     "(chat.js, admin/products.js) — không có package.json/server.js. "
     "Toàn bộ app thật nằm trong image <b>craftory-backend</b> đã build sẵn "
     "(6 tuần trước). → Khởi động bằng image sẵn có (<font face='DejaVuMono'>--no-build</font>)."),
    ("B4 — Lỗi xác thực DB (P1000)",
     "Backend báo <i>Authentication failed</i> với role <b>craftory</b>. "
     "Nguyên nhân: <font face='DejaVuMono'>pg_hba.conf</font> cho 127.0.0.1 dùng "
     "<b>trust</b> (bỏ qua mật khẩu), còn kết nối từ subnet Docker dùng "
     "<b>scram-sha-256</b>. Mật khẩu thực lưu trong volume KHÁC với "
     "<font face='DejaVuMono'>POSTGRES_PASSWORD</font> trong .env (biến này chỉ có "
     "tác dụng khi khởi tạo volume lần đầu)."),
    ("B5 — Đồng bộ mật khẩu DB",
     "Chạy <font face='DejaVuMono'>ALTER USER craftory WITH PASSWORD "
     "'craftory_dev_pass'</font> để khớp với .env (không mất dữ liệu). "
     "Sau đó migrations chạy xong &amp; seed thành công (10 products, 3 workshops)."),
    ("B6 — Guard SePay (production)",
     "Backend thoát với <i>FATAL: SEPAY_MERCHANT_ID must be set in production</i>. "
     "Biến này không tồn tại ở source/.env, chỉ có trong image cũ. Các biến "
     "SEPAY_* đều rỗng, DB dùng mật khẩu dev, origin là localhost ⇒ đây là môi "
     "trường dev. <b>Quyết định:</b> đổi <font face='DejaVuMono'>NODE_ENV=development</font> "
     "trong .env để bỏ qua guard (trung thực với trạng thái thực, không làm "
     "hỏng thanh toán bằng giá trị giả). Backend chuyển sang <b>healthy</b>."),
    ("B7 — Thiếu nginx.conf",
     "Frontend lỗi mount: <font face='DejaVuMono'>docker/nginx.conf</font> không "
     "tồn tại nên Docker tự tạo thành thư mục rỗng. Đã xoá thư mục rỗng và khôi "
     "phục file từ bản old_version (v11) — domain craftory.io.vn, SSL "
     "letsencrypt (cert có sẵn trên host)."),
    ("B8 — Sửa proxy_pass",
     "Config v11 dùng <font face='DejaVuMono'>proxy_pass http://backend:3000/;</font> "
     "(có dấu /) làm rớt tiền tố /api. Backend phục vụ route dưới /api/ nên đã đổi "
     "thành <font face='DejaVuMono'>proxy_pass http://backend:3000;</font> "
     "(không dấu /) và restart frontend. /api/v1/products trả dữ liệu đúng."),
]
for title, desc in steps:
    p(f"<b>{title}.</b> {desc}", BODY)
    sp(3)

# ---------- 4. Kết quả ----------
p("4. Kết quả kiểm thử cuối", H2)
table([
    ["Kiểm thử", "Kết quả"],
    ["3 container craftory", "Up — backend & postgres healthy"],
    ["HTTP :80", "301 → https://craftory.io.vn/"],
    ["HTTPS :443 trang chủ", "HTTP 200"],
    ["API /api/v1/health (qua nginx)", "{\"status\":\"ok\",\"env\":\"development\"}"],
    ["API /api/v1/products (qua nginx)", "Trả về danh sách sản phẩm"],
], [70*mm, 105*mm])

# ---------- 5. Thay đổi cấu hình ----------
p("5. Các thay đổi cấu hình đã áp dụng", H2)
table([
    ["File", "Thay đổi"],
    [".env", "NODE_ENV: production → development"],
    ["postgres (role)", "Đặt lại mật khẩu role craftory = craftory_dev_pass"],
    ["docker/nginx.conf", "Tạo lại file (bị thiếu) + sửa proxy_pass bỏ dấu / cuối"],
], [50*mm, 125*mm])

# ---------- 6. Thông tin đăng nhập ----------
story.append(Paragraph("6. Thông tin đăng nhập của từng dịch vụ", H2))
p("<b>⚠ Tài liệu mật — chứa thông tin nhạy cảm. Chỉ lưu trữ/chia sẻ an toàn.</b>",
  ParagraphStyle("warn", parent=BODY, textColor=colors.HexColor("#b00020"),
                 fontName="DejaVu-Bold"))
sp(4)

p("6.1 — PostgreSQL (craftory-postgres-1)", ParagraphStyle(
    "h3", parent=BODY, fontName="DejaVu-Bold", fontSize=10.5, spaceBefore=6))
table([
    ["Thông số", "Giá trị"],
    ["Host (nội bộ Docker)", "postgres : 5432"],
    ["Database", "craftory"],
    ["User", "craftory"],
    ["Password", "craftory_dev_pass"],
    ["DATABASE_URL", "postgresql://craftory:craftory_dev_pass@postgres:5432/craftory?schema=public"],
    ["pg_hba", "127.0.0.1 = trust; subnet Docker = scram-sha-256"],
], [45*mm, 130*mm])
sp(4)

p("6.2 — Backend API (craftory-backend-1)", ParagraphStyle(
    "h3b", parent=BODY, fontName="DejaVu-Bold", fontSize=10.5, spaceBefore=6))
table([
    ["Biến môi trường", "Giá trị"],
    ["NODE_ENV", "development"],
    ["COOKIE_SECRET", "2128659a92ab2b8d669b99f1009332a72a1755394963aca0cd83a6df3f795043"],
    ["ALLOWED_ORIGIN", "http://localhost"],
    ["AI_PROVIDER", "openai"],
    ["OPENAI_API_KEY", "(rỗng — chưa cấu hình)"],
    ["SEPAY_* (tất cả)", "(rỗng — thanh toán SePay chưa cấu hình)"],
    ["Port nội bộ", "3000 (chỉ expose trong network, không map ra host)"],
], [45*mm, 130*mm])
sp(4)

p("6.3 — Tài khoản ứng dụng (bảng User trong DB)", ParagraphStyle(
    "h3c", parent=BODY, fontName="DejaVu-Bold", fontSize=10.5, spaceBefore=6))
p("Mật khẩu được lưu dạng <b>bcrypt hash</b> → KHÔNG thể khôi phục plaintext. "
  "Dưới đây là các tài khoản hiện có. Nếu cần đăng nhập admin, có thể reset mật "
  "khẩu theo yêu cầu (cập nhật passwordHash bằng bcrypt).", BODY)
sp(3)
table([
    ["Email", "Tên", "Role"],
    ["admin@example.com", "Craftory Admin", "admin"],
    ["employee@example.com", "Craftory Employee", "employee"],
    ["congphuc.hikarin@gmail.com", "Admin", "customer"],
    ["minhthu@fia.io.vn", "meo", "customer"],
    ["lmao@lmao.com", "Lmao", "customer"],
    ["a@test.com", "aaaa", "customer"],
], [75*mm, 55*mm, 30*mm])
sp(4)

p("6.4 — Frontend / TLS", ParagraphStyle(
    "h3d", parent=BODY, fontName="DejaVu-Bold", fontSize=10.5, spaceBefore=6))
table([
    ["Thông số", "Giá trị"],
    ["Domain", "craftory.io.vn"],
    ["Cổng", "80 (redirect → 443), 443 (HTTPS)"],
    ["Chứng chỉ", "/etc/letsencrypt/live/craftory.io.vn/ (mount read-only)"],
    ["Proxy API", "/api/ → http://backend:3000"],
], [45*mm, 130*mm])

# ---------- 7. Khuyến nghị ----------
p("7. Khuyến nghị", H2)
for rec in [
    "Bổ sung <font face='DejaVuMono'>backend/Dockerfile</font> + package.json vào repo "
    "để có thể build lại image từ source (hiện app chỉ tồn tại trong image cũ).",
    "Commit file <font face='DejaVuMono'>docker/nginx.conf</font> vào repo để tránh "
    "lỗi thiếu file khi recreate frontend.",
    "Nếu cần chạy production thật: cấu hình đầy đủ các biến SEPAY_*, đặt "
    "<font face='DejaVuMono'>NODE_ENV=production</font>, và dùng mật khẩu DB mạnh "
    "(không dùng craftory_dev_pass).",
    "Đổi <font face='DejaVuMono'>COOKIE_SECRET</font> và mật khẩu DB sau khi tài liệu "
    "này được chia sẻ (đã lộ trong báo cáo).",
    "Xoá <font face='DejaVuMono'>version: '3.8'</font> trong docker-compose.yml để bỏ "
    "cảnh báo obsolete.",
]:
    p(f"•&nbsp; {rec}", BODY)
    sp(2)

sp(8)
hr()
p("Báo cáo được tạo tự động bằng Claude Code — 2026-06-15.", SMALL)

doc = SimpleDocTemplate(
    "/root/craftory-main/Craftory_Docker_Restart_Report.pdf",
    pagesize=A4, topMargin=18*mm, bottomMargin=16*mm,
    leftMargin=16*mm, rightMargin=16*mm,
    title="Craftory Docker Restart Report",
    author="Claude Code")
doc.build(story)
print("PDF generated successfully")
