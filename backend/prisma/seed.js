import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';

const prisma = new PrismaClient();

// Every kit product is named after the seed it grows — the virtual plant page
// maps this exact name to a species profile (harvest type, stage labels, fruit
// colour) in backend/src/services/plant-sim.js.
//
// Nothing here is shipped. A kit is a simulated plant: buying one issues an
// activation code, and entering it on "Cây của tôi" sows a seed the child then
// raises with simulated IoT sensors. So `includes` lists what the customer
// actually receives — the plant, the devices, the AI coach — and not a clay pot.
//
// The Standard / Smart choice at checkout (smartPriceDelta) is what unlocks the
// whole sensor set from day one instead of stage by stage; see
// createPlantForProduct in backend/src/services/plants.js.
const PRODUCTS = [
  { id: 1, name: "Bean", emoji: "🫘", collection: "Sprouty Starter", category: "kit", ageRange: "4–10 tuổi", price: 150000, oldPrice: 230000, smartPriceDelta: 230000, badge: "hot", bgColor: "#F0FDF4",
    description: "Gieo hạt đậu mô phỏng rồi nuôi cây từ mầm tới ngày ra quả, đọc cảm biến độ ẩm và nhiệt độ ngay trên web.",
    includes: ["Cây đậu mô phỏng (8 giai đoạn)","Cảm biến độ ẩm đất & nhiệt độ","Mở dần 8 thiết bị IoT ảo","Plant Buddy AI hướng dẫn từng bước","Album Cây Kỷ Niệm","Chứng nhận khi thu hoạch"],
    images: ["/assets/images/products/bean/bean-standard.png", "/assets/images/products/bean/bean-smart.png"], status: "published" },
  { id: 2, name: "Carrot", emoji: "🥕", collection: "Sprouty Starter", category: "kit", ageRange: "4–10 tuổi", price: 150000, oldPrice: 220000, smartPriceDelta: 230000, badge: null, bgColor: "#FFF7ED",
    description: "Nuôi cây cà rốt mô phỏng, theo dõi củ phình lớn qua từng chặng và học cách đọc chỉ số đất mỗi ngày.",
    includes: ["Cây cà rốt mô phỏng (8 giai đoạn)","Cảm biến độ ẩm đất & nhiệt độ","Mở dần 8 thiết bị IoT ảo","Plant Buddy AI hướng dẫn từng bước","Album Cây Kỷ Niệm","Chứng nhận khi thu hoạch"],
    images: ["/assets/images/products/carrot/carrot-standard.png", "/assets/images/products/carrot/carrot-smart.png"], status: "published" },
  { id: 7, name: "Corn", emoji: "🌽", collection: "Sprouty Starter", category: "kit", ageRange: "4–10 tuổi", price: 160000, oldPrice: null, smartPriceDelta: 230000, badge: null, bgColor: "#FEFCE8",
    description: "Trồng bắp mô phỏng, quan sát cây vươn cao mỗi ngày và học đọc cảm biến cùng Plant Buddy AI.",
    includes: ["Cây bắp mô phỏng (8 giai đoạn)","Cảm biến độ ẩm đất & nhiệt độ","Mở dần 8 thiết bị IoT ảo","Plant Buddy AI hướng dẫn từng bước","Album Cây Kỷ Niệm","Chứng nhận khi thu hoạch"],
    images: ["/assets/images/products/corn/corn-standard.png", "/assets/images/products/corn/corn-smart.png"], status: "published" },
  { id: 8, name: "FirePepper", emoji: "🌶️", collection: "Sprouty Starter", category: "kit", ageRange: "4–10 tuổi", price: 160000, oldPrice: null, smartPriceDelta: 230000, badge: null, bgColor: "#FEF2F2",
    description: "Nuôi cây ớt mô phỏng từ hạt tới trái chín, tự tay thụ phấn và canh sâu bệnh qua cảm biến.",
    includes: ["Cây ớt mô phỏng (8 giai đoạn)","Cảm biến độ ẩm đất & nhiệt độ","Mở dần 8 thiết bị IoT ảo","Plant Buddy AI hướng dẫn từng bước","Album Cây Kỷ Niệm","Chứng nhận khi thu hoạch"],
    images: ["/assets/images/products/firepepper/firepepper-standard.png", "/assets/images/products/firepepper/firepepper-smart.png"], status: "published" },
  { id: 9, name: "SunFlower", emoji: "🌻", collection: "Sprouty Starter", category: "kit", ageRange: "4–10 tuổi", price: 170000, oldPrice: 210000, smartPriceDelta: 230000, badge: "new", bgColor: "#FFFBEB",
    description: "Gieo hạt hướng dương mô phỏng, dõi theo cây đón nắng và nở hoa rực rỡ trên trang của bé.",
    includes: ["Cây hướng dương mô phỏng (8 giai đoạn)","Cảm biến độ ẩm đất & nhiệt độ","Mở dần 8 thiết bị IoT ảo","Plant Buddy AI hướng dẫn từng bước","Album Cây Kỷ Niệm","Chứng nhận khi thu hoạch"],
    images: ["/assets/images/products/sunflower/sunflower-standard.png", "/assets/images/products/sunflower/sunflower-smart.png"], status: "published" },
  { id: 10, name: "Tomato", emoji: "🍅", collection: "Sprouty Starter", category: "kit", ageRange: "4–10 tuổi", price: 170000, oldPrice: null, smartPriceDelta: 230000, badge: null, bgColor: "#FEF2F2",
    description: "Chăm cây cà chua mô phỏng từ hạt đến quả chín đỏ, với đầy đủ cảm biến và nhật ký từng chặng.",
    includes: ["Cây cà chua mô phỏng (8 giai đoạn)","Cảm biến độ ẩm đất & nhiệt độ","Mở dần 8 thiết bị IoT ảo","Plant Buddy AI hướng dẫn từng bước","Album Cây Kỷ Niệm","Chứng nhận khi thu hoạch"],
    images: ["/assets/images/products/tomato/tomato-standard.png", "/assets/images/products/tomato/tomato-smart.png"], status: "published" },
  { id: 5, name: "VIP Garden Monthly", emoji: "🌙", collection: "Golden Garden", category: "membership", ageRange: "Gia đình", price: 20000, oldPrice: null, smartPriceDelta: null, badge: null, bgColor: "#FEFCE8",
    description: "Mở khóa chế độ ban đêm, hiệu ứng theo mùa, Plant Buddies hiếm và AI recap hàng tháng cho Cây Kỷ Niệm.",
    includes: ["Night Mode", "Seasonal effects", "Rare Plant Buddies", "Monthly AI recap", "Ưu tiên hỗ trợ"],
    images: ["/assets/images/sprouty-icons/VIPGardenMonthly.png"], status: "published" },
  { id: 6, name: "VIP Garden Annual", emoji: "✨", collection: "Golden Garden", category: "membership", ageRange: "Gia đình", price: 180000, oldPrice: 240000, smartPriceDelta: null, badge: "sale", bgColor: "#FEF3C7",
    description: "Gói VIP hằng năm cho gia đình muốn lưu giữ trọn vẹn hành trình cây lớn lên cùng bé.",
    includes: ["Tất cả quyền lợi VIP Monthly", "Tiết kiệm 25%", "Golden Memory Tree", "Ưu tiên tính năng mới"],
    images: ["/assets/images/sprouty-icons/VIPGardenAnnual.png"], status: "published" },
];

// These are the sessions the public workshop page used to hardcode in
// frontend/src/data/workshop.ts. That page reads the API now, so they live here
// — otherwise switching it over would have replaced six illustrated sessions
// with three bare rows.
const VENUE = 'Sprouty Studio – TP.HCM';
const WORKSHOPS = [
  {
    title: 'Vẽ Chậu & Gieo Hạt Đầu Tiên',
    description: 'Bé trang trí chậu, gieo hạt thật và tạo chiếc lá kỷ niệm đầu tiên trên Sprouty.',
    imageUrl: '/assets/images/workshop/register/register-basic.png',
    dateTime: new Date('2026-11-21T09:00:00+07:00'),
    endTime: new Date('2026-11-21T11:30:00+07:00'),
    capacity: 12, location: VENUE, ageRange: '4–8 tuổi', price: 150000,
  },
  {
    title: 'Smart Kit Cảm Biến Cây',
    description: 'Lắp cảm biến độ ẩm đất, OLED và LED để bé hiểu cây đang cần gì qua tín hiệu đơn giản.',
    imageUrl: '/assets/images/workshop/register/register-smartkit.png',
    dateTime: new Date('2026-11-28T09:00:00+07:00'),
    endTime: new Date('2026-11-28T11:30:00+07:00'),
    capacity: 12, location: VENUE, ageRange: '5–10 tuổi', price: 180000,
  },
  {
    title: 'Family Memory Tree Day',
    description: 'Workshop gia đình: cùng chăm cây, chụp ảnh, viết nhật ký và lưu lại hành trình trên Cây Kỷ Niệm.',
    imageUrl: '/assets/images/workshop/register/register-familytree.png',
    dateTime: new Date('2026-12-05T09:00:00+07:00'),
    endTime: new Date('2026-12-05T12:00:00+07:00'),
    capacity: 12, location: VENUE, ageRange: '6–12 tuổi', price: 200000,
  },
  {
    title: 'Hệ Mặt Trời Mini',
    description: 'Tạo mô hình hệ mặt trời mini — vẽ màu 8 hành tinh, lắp ráp giá đỡ và học về thiên văn học qua đôi bàn tay.',
    imageUrl: '/assets/images/workshop/register/register-solarsystem.png',
    dateTime: new Date('2026-12-12T09:00:00+07:00'),
    endTime: new Date('2026-12-12T12:00:00+07:00'),
    capacity: 10, location: VENUE, ageRange: '7–12 tuổi', price: 220000,
  },
  {
    title: 'Plant Buddy Story Lab',
    description: 'Bé đặt tên Plant Buddy, tạo câu chuyện cho cây và học cách ghi lại mốc phát triển mỗi tuần.',
    imageUrl: '/assets/images/workshop/register/register-storylab.png',
    dateTime: new Date('2026-12-19T09:00:00+07:00'),
    endTime: new Date('2026-12-19T11:30:00+07:00'),
    capacity: 12, location: VENUE, ageRange: '4–9 tuổi', price: 160000,
  },
  {
    title: 'Chậu Cây Tự Thiết Kế',
    description: 'Bé tự tay vẽ và trang trí chậu cây theo phong cách riêng, rồi gieo hạt vào chính chậu mình vừa thiết kế. Phát triển óc sáng tạo và sự khéo léo.',
    imageUrl: '/assets/images/workshop/register/register-potdesign.png',
    dateTime: new Date('2026-12-26T09:00:00+07:00'),
    endTime: new Date('2026-12-26T12:00:00+07:00'),
    capacity: 12, location: VENUE, ageRange: '5–9 tuổi', price: 180000,
  },
];

const BLOG_POSTS = [
  {
    slug: 'giao-duc-mam-non-hoc-qua-choi-va-thu-cong',
    title: 'Giáo dục mầm non: Trẻ học tốt nhất khi được chơi, chạm và tự làm',
    excerpt: 'Tìm hiểu vì sao học qua chơi và hoạt động trồng cây sáng tạo giúp trẻ mầm non phát triển vận động, ngôn ngữ, tư duy, cảm xúc và niềm vui khám phá thiên nhiên.',
    contentFile: new URL('./content/giao-duc-mam-non-hoc-qua-choi.md', import.meta.url),
    publishedAt: new Date('2026-06-21T00:00:00+07:00'),
    recommendedProductIds: [1, 2, 5],
  },
];

async function main() {
  console.log('🌱 Seeding database...');

  // Seed admin/employee demo users only when explicitly enabled (never in production by default)
  if (process.env.SEED_DEMO_USERS === 'true') {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@sprouty.id.vn';
    const adminPassword = process.env.ADMIN_INITIAL_PASSWORD;
    if (!adminPassword) {
      console.error('❌ ADMIN_INITIAL_PASSWORD env var is required when SEED_DEMO_USERS=true');
      process.exit(1);
    }
    const adminHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: { email: adminEmail, passwordHash: adminHash, name: 'Sprouty Admin', role: 'admin' },
    });

    const empEmail = process.env.EMPLOYEE_EMAIL || 'employee@sprouty.id.vn';
    const empPassword = process.env.EMPLOYEE_INITIAL_PASSWORD;
    if (!empPassword) {
      console.error('❌ EMPLOYEE_INITIAL_PASSWORD env var is required when SEED_DEMO_USERS=true');
      process.exit(1);
    }
    const empHash = await bcrypt.hash(empPassword, 12);
    await prisma.user.upsert({
      where: { email: empEmail },
      update: {},
      create: { email: empEmail, passwordHash: empHash, name: 'Sprouty Employee', role: 'employee' },
    });
    console.log('✅ Demo users seeded');
  } else {
    console.log('ℹ️  Skipping demo user seeding (set SEED_DEMO_USERS=true to enable)');
  }

  // Seed products
  for (const product of PRODUCTS) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: product,
      create: product,
    });
  }
  console.log(`✅ Seeded ${PRODUCTS.length} products`);

  // One-time cleanup: "Basic Workshop" (#3) and "Smart Kit Workshop" (#4)
  // were removed from the catalog — the real workshop booking flow is the
  // separate Workshop/WorkshopRegistration models (pages/workshop.html),
  // these Product rows were vestigial duplicates it never actually used.
  // Idempotent: no-ops on repeat runs once the rows are gone.
  for (const id of [3, 4]) {
    try {
      await prisma.product.delete({ where: { id } });
      console.log(`✅ Removed retired workshop product #${id}`);
    } catch (e) {
      if (e.code === 'P2025') {
        // already deleted, fine
      } else if (e.code === 'P2003') {
        console.warn(`⚠️  Product #${id} still referenced by existing orders — left in place, archive it manually instead.`);
      } else {
        throw e;
      }
    }
  }

  // Reset the auto-increment sequence so new products get IDs after the seeded ones
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Product"', 'id'), COALESCE((SELECT MAX(id) FROM "Product"), 0))`;

  // One-time cleanup: the three placeholder workshops seeded before Workshop
  // carried a description, photo, age range and price. They render as blank
  // cards on the public page now, and one of them ("Family Memory Tree Day")
  // shares a title with a real session below, which would make the loop skip
  // creating it. Only rows that never got filled in and have nobody booked are
  // removed, so an admin's own bare draft survives.
  const retired = await prisma.workshop.findMany({
    where: {
      description: null,
      imageUrl: null,
      title: {
        in: [
          'Basic Workshop — Vẽ chậu & gieo hạt',
          'Smart Kit Workshop — IoT cho cây',
          'Family Memory Tree Day',
        ],
      },
      registrations: { none: {} },
    },
    select: { id: true, title: true },
  });
  for (const ws of retired) {
    await prisma.workshop.delete({ where: { id: ws.id } });
    console.log(`✅ Removed placeholder workshop "${ws.title}"`);
  }

  // Seed workshops
  for (const ws of WORKSHOPS) {
    const existing = await prisma.workshop.findFirst({ where: { title: ws.title } });
    if (!existing) {
      await prisma.workshop.create({ data: ws });
    }
  }
  console.log(`✅ Seeded ${WORKSHOPS.length} workshops`);

  // Seed published editorial content when an employee or admin account exists.
  const blogAuthor = await prisma.user.findFirst({
    where: {
      role: { in: ['employee', 'admin'] },
      status: 'active',
    },
    orderBy: { createdAt: 'asc' },
  });

  if (blogAuthor) {
    for (const post of BLOG_POSTS) {
      const content = await readFile(post.contentFile, 'utf8');
      await prisma.blogPost.upsert({
        where: { slug: post.slug },
        // Published posts may be edited in Admin (including uploaded images).
        // Never overwrite those editorial changes when seed runs again.
        update: {},
        create: {
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          content,
          recommendedProductIds: post.recommendedProductIds || [],
          status: 'published',
          publishedAt: post.publishedAt,
          authorUserId: blogAuthor.id,
        },
      });
    }
    console.log(`✅ Seeded ${BLOG_POSTS.length} blog post(s)`);
  } else {
    console.log('ℹ️  Skipping blog posts because no active employee/admin author exists');
  }

  console.log('✅ Seeding complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
