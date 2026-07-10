import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';

const prisma = new PrismaClient();

// Every kit product is now named after the seed it grows — pages/tree.html
// maps this exact name to assets/images/sprouty-icons/<name>.png for the
// Cây Kỷ Niệm background. Each kit offers a Standard / Smart (IoT) variant
// at checkout via smartPriceDelta (see backend/src/routes/orders.js).
const PRODUCTS = [
  { id: 1, name: "Bean", emoji: "🫘", collection: "Sprouty Starter", category: "kit", ageRange: "4–10 tuổi", price: 150000, oldPrice: 230000, smartPriceDelta: 230000, badge: "hot", bgColor: "#F0FDF4",
    description: "Bộ khởi đầu hoàn hảo để bé vẽ chậu, gieo hạt đậu thật và mở Cây Kỷ Niệm số đầu tiên trên Sprouty.",
    includes: ["Chậu đất nung", "6 màu acrylic", "Hạt giống đậu", "Đất trồng", "Sách hướng dẫn", "Quyền truy cập app Sprouty"],
    images: ["/assets/images/sprouty-icons/Bean.png"], status: "published" },
  { id: 2, name: "Carrot", emoji: "🥕", collection: "Sprouty Starter", category: "kit", ageRange: "4–10 tuổi", price: 150000, oldPrice: 220000, smartPriceDelta: 230000, badge: null, bgColor: "#FFF7ED",
    description: "Gieo hạt cà rốt thật, theo dõi củ lớn dần và lưu lại từng khoảnh khắc trên Cây Kỷ Niệm số.",
    includes: ["Chậu đất nung", "6 màu acrylic", "Hạt giống cà rốt", "Đất trồng", "Sách hướng dẫn", "Quyền truy cập app Sprouty"],
    images: ["/assets/images/sprouty-icons/Carrot.png"], status: "published" },
  { id: 7, name: "Corn", emoji: "🌽", collection: "Sprouty Starter", category: "kit", ageRange: "4–10 tuổi", price: 160000, oldPrice: null, smartPriceDelta: 230000, badge: null, bgColor: "#FEFCE8",
    description: "Trồng bắp mini trong chậu, quan sát cây vươn cao mỗi ngày cùng Plant Buddy AI.",
    includes: ["Chậu đất nung", "6 màu acrylic", "Hạt giống bắp", "Đất trồng", "Sách hướng dẫn", "Quyền truy cập app Sprouty"],
    images: ["/assets/images/sprouty-icons/Corn.png"], status: "published" },
  { id: 8, name: "FirePepper", emoji: "🌶️", collection: "Sprouty Starter", category: "kit", ageRange: "4–10 tuổi", price: 160000, oldPrice: null, smartPriceDelta: 230000, badge: null, bgColor: "#FEF2F2",
    description: "Trồng ớt cay tại nhà, theo dõi hoa kết trái và lưu công thức chăm cây riêng của bé.",
    includes: ["Chậu đất nung", "6 màu acrylic", "Hạt giống ớt", "Đất trồng", "Sách hướng dẫn", "Quyền truy cập app Sprouty"],
    images: ["/assets/images/sprouty-icons/FirePepper.png"], status: "published" },
  { id: 9, name: "SunFlower", emoji: "🌻", collection: "Sprouty Starter", category: "kit", ageRange: "4–10 tuổi", price: 170000, oldPrice: 210000, smartPriceDelta: 230000, badge: "new", bgColor: "#FFFBEB",
    description: "Gieo hạt hướng dương, dõi theo cây xoay mặt về phía mặt trời và ra hoa rực rỡ.",
    includes: ["Chậu đất nung", "6 màu acrylic", "Hạt giống hướng dương", "Đất trồng", "Sách hướng dẫn", "Quyền truy cập app Sprouty"],
    images: ["/assets/images/sprouty-icons/SunFlower.png"], status: "published" },
  { id: 10, name: "Tomato", emoji: "🍅", collection: "Sprouty Starter", category: "kit", ageRange: "4–10 tuổi", price: 170000, oldPrice: null, smartPriceDelta: 230000, badge: null, bgColor: "#FEF2F2",
    description: "Trồng cà chua bi, chăm sóc từ hạt đến quả chín đỏ và ghi lại cả hành trình trên Cây Kỷ Niệm.",
    includes: ["Chậu đất nung", "6 màu acrylic", "Hạt giống cà chua", "Đất trồng", "Sách hướng dẫn", "Quyền truy cập app Sprouty"],
    images: ["/assets/images/sprouty-icons/Tomato.png"], status: "published" },
  { id: 3, name: "Basic Workshop", emoji: "🎨", collection: "Workshop gia đình", category: "workshop", ageRange: "4–10 tuổi", price: 220000, oldPrice: null, smartPriceDelta: null, badge: "new", bgColor: "#FFF7ED",
    description: "Một buổi vẽ chậu, gieo hạt, setup tài khoản Sprouty và tạo chiếc lá kỷ niệm đầu tiên cùng gia đình.",
    includes: ["1 kit trồng cây (chọn loại hạt)", "1 buổi hướng dẫn nhóm nhỏ", "Setup tài khoản Sprouty", "Ảnh kỷ niệm sau buổi học"],
    images: [], status: "published" },
  { id: 4, name: "Smart Kit Workshop", emoji: "🔌", collection: "STEM & IoT", category: "workshop", ageRange: "10+ tuổi", price: 450000, oldPrice: null, smartPriceDelta: null, badge: "new", bgColor: "#E0F2FE",
    description: "Workshop lắp cảm biến, màn hình OLED và LED cho cây. Phù hợp học sinh yêu STEM và phụ huynh muốn học cùng con.",
    includes: ["1 kit trồng cây bản Smart", "1 buổi hướng dẫn lắp mạch", "Kết nối cảm biến cây", "Tài liệu thực hành IoT"],
    images: [], status: "published" },
  { id: 5, name: "VIP Garden Monthly", emoji: "🌙", collection: "Golden Garden", category: "membership", ageRange: "Gia đình", price: 20000, oldPrice: null, smartPriceDelta: null, badge: null, bgColor: "#FEFCE8",
    description: "Mở khóa chế độ ban đêm, hiệu ứng theo mùa, Plant Buddies hiếm và AI recap hàng tháng cho Cây Kỷ Niệm.",
    includes: ["Night Mode", "Seasonal effects", "Rare Plant Buddies", "Monthly AI recap", "Ưu tiên hỗ trợ"],
    images: [], status: "published" },
  { id: 6, name: "VIP Garden Annual", emoji: "✨", collection: "Golden Garden", category: "membership", ageRange: "Gia đình", price: 180000, oldPrice: 240000, smartPriceDelta: null, badge: "sale", bgColor: "#FEF3C7",
    description: "Gói VIP hằng năm cho gia đình muốn lưu giữ trọn vẹn hành trình cây lớn lên cùng bé.",
    includes: ["Tất cả quyền lợi VIP Monthly", "Tiết kiệm 25%", "Golden Memory Tree", "Ưu tiên tính năng mới"],
    images: [], status: "published" },
];

const WORKSHOPS = [
  { title: 'Basic Workshop — Vẽ chậu & gieo hạt', dateTime: new Date('2026-07-18T10:00:00+07:00'), capacity: 12, location: 'Sprouty Studio – TP.HCM' },
  { title: 'Smart Kit Workshop — IoT cho cây', dateTime: new Date('2026-07-26T14:00:00+07:00'), capacity: 10, location: 'Sprouty Studio – TP.HCM' },
  { title: 'Family Memory Tree Day', dateTime: new Date('2026-08-02T09:00:00+07:00'), capacity: 16, location: 'Sprouty Studio – TP.HCM' },
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

  // Reset the auto-increment sequence so new products get IDs after the seeded ones
  await prisma.$executeRaw`SELECT setval(pg_get_serial_sequence('"Product"', 'id'), COALESCE((SELECT MAX(id) FROM "Product"), 0))`;

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
