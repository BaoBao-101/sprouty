/**
 * Data for recording the MVP demo video: every scene of the script starts
 * from the state this leaves.
 *
 * Puts every scene of the video in its starting position:
 *   - a new customer with nothing yet, to buy a kit on camera;
 *   - a VIP customer whose garden has a plant at every stage;
 *   - three customers whose kit orders wait for staff (two to prepare, one
 *     already on its way);
 *   - a workshop running right now, given to two employees, with a register
 *     of four families — one still to pay at the door, one already in;
 *   - the real upcoming workshops given to the employees, so nothing on the
 *     admin screen reads "Chưa có người trực".
 *
 *   node scripts/seed-video-demo.js
 *
 * Run it again right before recording, and after a take that went wrong: it
 * resets every scene rather than adding to it, moves the demo workshop to the
 * current time, and empties the new customer's account.
 *
 * It also hides the test products that crept into the shop (switches them to
 * draft, which is undone from Admin → Sản phẩm); set DEMO_TIDY_SHOP=0 to skip.
 *
 * Refuses to run in production, because it fabricates paid orders that then
 * count in the sales report — unless DEMO_SEED_FORCE=1 says that is wanted,
 * as on a server whose job is the demo:
 *
 *   DEMO_SEED_FORCE=1 DEMO_PASSWORD='…' node scripts/seed-video-demo.js
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { recomputeVipUntil } from '../src/services/membership.js';

if (process.env.NODE_ENV === 'production' && process.env.DEMO_SEED_FORCE !== '1') {
  console.error('Script này tạo đơn hàng giả — không chạy trên production (DEMO_SEED_FORCE=1 để chạy có chủ đích).');
  process.exit(1);
}

const prisma = new PrismaClient();
const PASSWORD = process.env.DEMO_PASSWORD || '123456';
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = new Date();
const ago = (ms) => new Date(now.getTime() - ms);

const CUSTOMERS = {
  maianh: { email: 'maianh@sprouty.local', name: 'Nguyễn Mai Anh', phone: '0912345601', address: '12 Nguyễn Huệ, Phường Sài Gòn, TP Hồ Chí Minh', scene: 'Khách mới — mua kit ngay trên video' },
  quocbao: { email: 'quocbao@sprouty.local', name: 'Trần Quốc Bảo', phone: '0912345602', address: '45 Lê Lợi, Phường Bến Thành, TP Hồ Chí Minh', scene: 'Khách VIP — vườn có cây ở đủ 8 giai đoạn' },
  thutrang: { email: 'thutrang@sprouty.local', name: 'Lê Thu Trang', phone: '0912345603', address: '88 Võ Văn Tần, Phường Xuân Hoà, TP Hồ Chí Minh', scene: 'Đơn Hướng Dương chờ nhân viên gửi' },
  ducminh: { email: 'ducminh@sprouty.local', name: 'Phạm Đức Minh', phone: '0912345604', address: '21 Phan Xích Long, Phường Cầu Kiệu, TP Hồ Chí Minh', scene: 'Đơn Cà Rốt chờ gửi · vé workshop chưa trả tiền' },
  lanphuong: { email: 'lanphuong@sprouty.local', name: 'Võ Lan Phương', phone: '0912345605', address: '9 Hoàng Diệu, Phường Khánh Hội, TP Hồ Chí Minh', scene: 'Đơn Đậu Leo Xanh đang giao — bấm "Đã nhận được hàng"' },
};

const EMPLOYEES = [
  { email: 'ha.nguyen@sprouty.local', name: 'Nguyễn Thu Hà' },
  { email: 'khoa.tran@sprouty.local', name: 'Trần Minh Khoa' },
  { email: 'ngoc.le@sprouty.local', name: 'Lê Bảo Ngọc' },
  { email: 'huy.pham@sprouty.local', name: 'Phạm Gia Huy' },
];

/** Test products that should not be on camera. */
const JUNK_PRODUCTS = ['chào tôi', 'bánh mì', 'cơm', 'gà rán', 'hoa hướng dương', 'bánhkem'];

const DEMO_WORKSHOP = 'Gieo Hạt Cùng Bé — Buổi trải nghiệm';

async function account(email, name, role) {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  return prisma.user.upsert({
    where: { email },
    update: { name, role, status: 'active', passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    create: { email, name, role, status: 'active', passwordHash },
  });
}

async function product(where) {
  const found = await prisma.product.findFirst({ where, orderBy: { id: 'asc' } });
  if (!found) throw new Error(`Không tìm thấy sản phẩm ${JSON.stringify(where)}`);
  return found;
}

/**
 * The one kit order a customer's scene is about, created once and then put
 * back in the state the scene starts from. Its activation code is generated
 * the first time the customer or staff open the order, as for a real one.
 */
async function sceneOrder(user, info, kit, state) {
  let order = await prisma.order.findFirst({
    where: { userId: user.id, items: { some: { productId: kit.id } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!order) {
    order = await prisma.order.create({
      data: {
        userId: user.id,
        total: kit.price,
        status: 'processing',
        paidAt: ago(state.paidAgo),
        shippingName: info.name,
        shippingPhone: info.phone,
        shippingAddress: info.address,
        createdAt: ago(state.paidAgo + 4 * MIN),
        items: { create: [{ productId: kit.id, qty: 1, unitPrice: kit.price, variant: 'standard' }] },
      },
    });
  }
  const shipped = state.status === 'shipped';
  return prisma.order.update({
    where: { id: order.id },
    data: {
      status: state.status,
      paidAt: ago(state.paidAgo),
      shippedAt: shipped ? ago(state.shippedAgo) : null,
      carrier: shipped ? 'Giao Hàng Nhanh' : null,
      trackingCode: shipped ? 'GHN8D2K4X7P' : null,
      deliveredAt: null,
      deliveredBy: null,
    },
  });
}

/** The new customer buys on camera, so her account starts empty every time. */
async function emptyAccount(user) {
  const orders = await prisma.order.findMany({ where: { userId: user.id }, select: { id: true } });
  await prisma.workshopRegistration.deleteMany({ where: { userId: user.id } });
  await prisma.virtualPlant.deleteMany({ where: { userId: user.id } });
  await prisma.redeemCode.deleteMany({ where: { createdByUserId: user.id } });
  await prisma.userEntitlement.deleteMany({ where: { userId: user.id } });
  await prisma.order.deleteMany({ where: { id: { in: orders.map((o) => o.id) } } });
  await prisma.user.update({ where: { id: user.id }, data: { vipUntil: null } });
  return orders.length;
}

async function main() {
  const out = [];

  // ── People ────────────────────────────────────────────────────────────
  const users = {};
  for (const [key, info] of Object.entries(CUSTOMERS)) users[key] = await account(info.email, info.name, 'customer');
  const staff = [];
  for (const e of EMPLOYEES) staff.push(await account(e.email, e.name, 'employee'));

  // ── A clean shop ──────────────────────────────────────────────────────
  if (process.env.DEMO_TIDY_SHOP !== '0') {
    const junk = await prisma.product.findMany({
      where: { status: 'published', name: { in: JUNK_PRODUCTS } },
      select: { id: true, name: true },
    });
    const twins = await prisma.product.findMany({
      where: { status: 'published', category: 'kit' },
      select: { id: true, name: true },
      orderBy: { id: 'asc' },
    });
    const seen = new Set();
    const duplicates = twins.filter((p) => (seen.has(p.name) ? true : (seen.add(p.name), false)));
    const hide = [...junk, ...duplicates];
    if (hide.length) {
      await prisma.product.updateMany({ where: { id: { in: hide.map((p) => p.id) } }, data: { status: 'draft' } });
      out.push(`Ẩn khỏi shop (chuyển về nháp): ${hide.map((p) => `#${p.id} ${p.name}`).join(', ')}`);
    }
  }

  // ── The new customer: nothing yet ─────────────────────────────────────
  const wiped = await emptyAccount(users.maianh);
  if (wiped) out.push(`Đã làm trống tài khoản Mai Anh (${wiped} đơn cũ).`);

  // ── The VIP customer and her garden ───────────────────────────────────
  // The paid VIP order first: the garden script below only invents an order
  // for an account that has none, and that one has no address.
  const vipPlan = await product({ category: 'membership', name: 'Gói VIP 1 tháng' });
  const vipOrder = await prisma.order.findFirst({ where: { userId: users.quocbao.id, items: { some: { productId: vipPlan.id } } } });
  if (!vipOrder) {
    await prisma.order.create({
      data: {
        userId: users.quocbao.id,
        total: vipPlan.price,
        status: 'delivered',
        paidAt: ago(6 * DAY),
        deliveredAt: ago(6 * DAY),
        shippingName: CUSTOMERS.quocbao.name,
        shippingPhone: CUSTOMERS.quocbao.phone,
        shippingAddress: 'Không áp dụng — gói VIP, kích hoạt ngay trên web.',
        createdAt: ago(6 * DAY + 5 * MIN),
        items: { create: [{ productId: vipPlan.id, qty: 1, unitPrice: vipPlan.price }] },
      },
    });
  } else {
    // Renewed from today on every run, so the plan never lapses mid-shoot.
    await prisma.order.update({ where: { id: vipOrder.id }, data: { paidAt: ago(6 * DAY), deliveredAt: ago(6 * DAY) } });
  }
  await recomputeVipUntil(prisma, users.quocbao.id);
  execFileSync(process.execPath, [fileURLToPath(new URL('./seed-demo-plants.js', import.meta.url)), CUSTOMERS.quocbao.email, PASSWORD], { stdio: 'ignore' });
  // That script resets the password and name; put the name back.
  await prisma.user.update({ where: { id: users.quocbao.id }, data: { name: CUSTOMERS.quocbao.name } });

  // ── Orders waiting for staff ──────────────────────────────────────────
  // Names the catalogue migration guarantees (a renamed tomato, say, would not be).
  const sunflower = await product({ category: 'kit', status: 'published', name: 'Hướng Dương' });
  const carrot = await product({ category: 'kit', status: 'published', name: 'Cà Rốt Cam' });
  const bean = await product({ category: 'kit', status: 'published', name: 'Đậu Leo Xanh' });
  await sceneOrder(users.thutrang, CUSTOMERS.thutrang, sunflower, { status: 'processing', paidAgo: 50 * MIN });
  await sceneOrder(users.ducminh, CUSTOMERS.ducminh, carrot, { status: 'processing', paidAgo: 3 * HOUR });
  await sceneOrder(users.lanphuong, CUSTOMERS.lanphuong, bean, { status: 'shipped', paidAgo: 2 * DAY, shippedAgo: 1 * DAY });

  // ── A workshop running now ────────────────────────────────────────────
  const model = await prisma.workshop.findFirst({ where: { imageUrl: { not: null }, NOT: { title: DEMO_WORKSHOP } }, orderBy: { dateTime: 'asc' } });
  const start = new Date(Math.floor((now.getTime() - 20 * MIN) / (5 * MIN)) * 5 * MIN);
  const fields = {
    title: DEMO_WORKSHOP,
    description: 'Bé tự tay vẽ chiếc chậu của riêng mình, gieo hạt đậu thật, rồi kích hoạt bạn cây 3D để chăm tiếp ở nhà. Mỗi bé mang về một chậu cây và một mã kích hoạt.',
    imageUrl: model?.imageUrl || null,
    dateTime: start,
    endTime: new Date(start.getTime() + 2 * HOUR),
    capacity: 12,
    location: 'Sprouty Studio – TP.HCM',
    ageRange: '4–8 tuổi',
    price: 150000,
    status: 'published',
  };
  const existing = await prisma.workshop.findFirst({ where: { title: DEMO_WORKSHOP } });
  const workshop = existing
    ? await prisma.workshop.update({ where: { id: existing.id }, data: fields })
    : await prisma.workshop.create({ data: fields });
  await prisma.workshopStaff.deleteMany({ where: { workshopId: workshop.id } });
  await prisma.workshopStaff.createMany({ data: staff.slice(0, 2).map((s) => ({ workshopId: workshop.id, userId: s.id })) });

  await prisma.workshopRegistration.deleteMany({ where: { workshopId: workshop.id } });
  const book = (key, seats, age, extra) => prisma.workshopRegistration.create({
    data: {
      workshopId: workshop.id,
      userId: users[key].id,
      guestName: CUSTOMERS[key].name,
      guestPhone: CUSTOMERS[key].phone,
      guestEmail: CUSTOMERS[key].email,
      childCount: seats,
      childAge: age,
      amount: seats * fields.price,
      createdAt: ago(3 * DAY),
      ...extra,
    },
  });
  const tickets = {
    thutrang: await book('thutrang', 2, '6 tuổi', { paymentMethod: 'online', paidAt: ago(2 * DAY), status: 'confirmed' }),
    ducminh: await book('ducminh', 1, '5 tuổi', { paymentMethod: 'onsite', status: 'pending' }),
    lanphuong: await book('lanphuong', 1, '7 tuổi', { paymentMethod: 'online', paidAt: ago(2 * DAY), status: 'confirmed', checkedInAt: ago(8 * MIN), checkedInByUserId: staff[0].id, attendedCount: 1 }),
    quocbao: await book('quocbao', 2, '4 và 6 tuổi', { paymentMethod: 'online', paidAt: ago(1 * DAY), status: 'confirmed', note: 'Bé nhỏ dị ứng phấn hoa, nhờ cô để ý giúp.' }),
  };

  // ── Everyone else's sessions get someone on them ──────────────────────
  const upcoming = await prisma.workshop.findMany({
    where: { status: 'published', dateTime: { gt: now }, staff: { none: {} } },
    orderBy: { dateTime: 'asc' },
  });
  for (const [i, w] of upcoming.entries()) {
    await prisma.workshopStaff.create({ data: { workshopId: w.id, userId: staff[i % staff.length].id } });
  }
  if (upcoming.length) out.push(`Đã giao ${upcoming.length} buổi workshop sắp tới cho nhân viên.`);

  // ── What to say on camera ─────────────────────────────────────────────
  const code = (r) => r.id.slice(-6).toUpperCase();
  console.log('\nDữ liệu quay video đã sẵn sàng.');
  for (const line of out) console.log(`  · ${line}`);
  console.log(`\nMật khẩu mọi tài khoản demo: ${PASSWORD}`);
  console.log('\nKhách hàng');
  for (const [key, info] of Object.entries(CUSTOMERS)) console.log(`  ${info.email.padEnd(26)} ${info.name.padEnd(16)} ${info.scene}`);
  console.log('\nNhân viên');
  for (const [i, e] of EMPLOYEES.entries()) console.log(`  ${e.email.padEnd(26)} ${e.name.padEnd(16)} ${i < 2 ? 'trực buổi workshop đang diễn ra' : ''}`);
  console.log(`\nWorkshop đang diễn ra: "${DEMO_WORKSHOP}" ${fields.dateTime.toISOString()} → ${fields.endTime.toISOString()}`);
  console.log('Mã vé để tra ở quầy:');
  console.log(`  ${code(tickets.ducminh)}  Phạm Đức Minh — 1 bé, CHƯA trả 150.000đ (cảnh thu tiền mặt)`);
  console.log(`  ${code(tickets.thutrang)}  Lê Thu Trang — 2 bé, đã thanh toán`);
  console.log(`  ${code(tickets.quocbao)}  Trần Quốc Bảo — 2 bé, đã thanh toán, có ghi chú`);
  console.log(`  ${code(tickets.lanphuong)}  Võ Lan Phương — đã điểm danh sẵn`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
