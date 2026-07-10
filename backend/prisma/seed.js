import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { readFile } from 'node:fs/promises';

const prisma = new PrismaClient();

const PRODUCTS = [
  { id: 1, name: "Standard Kit", emoji: "🪴", collection: "Sprouty Starter", category: "kit", ageRange: "4–10 tuổi", price: 150000, oldPrice: 230000, badge: "hot", bgColor: "#F0FDF4",
    description: "Bộ khởi đầu hoàn hảo để bé vẽ chậu, gieo hạt thật và mở Cây Kỷ Niệm số đầu tiên trên Sprouty.",
    includes: ["Chậu đất nung", "6 màu acrylic", "3 loại hạt giống", "Đất trồng", "Sách hướng dẫn", "Quyền truy cập app Sprouty"],
    images: ["/assets/images/sprouty-icons/Tree.png"], status: "published" },
  { id: 2, name: "Smart Kit", emoji: "🤖", collection: "Local IoT · Arduino", category: "kit", ageRange: "10–18 tuổi", price: 380000, oldPrice: 520000, badge: "hot", bgColor: "#ECFDF5",
    description: "Smart Kit thêm cảm biến IoT cục bộ để học sinh lắp mạch, đọc độ ẩm đất và tạo biểu cảm cho Bạn Cây.",
    includes: ["Standard Kit đầy đủ", "Arduino Nano V3", "Màn hình OLED 0.96 inch", "Cảm biến độ ẩm đất", "Module RTC DS3231", "LED RGB WS2812B"],
    images: ["/assets/images/sprouty-icons/Tomato.png"], status: "published" },
  { id: 3, name: "Basic Workshop", emoji: "🎨", collection: "Workshop gia đình", category: "workshop", ageRange: "4–10 tuổi", price: 220000, oldPrice: null, badge: "new", bgColor: "#FFF7ED",
    description: "Một buổi vẽ chậu, gieo hạt, setup tài khoản Sprouty và tạo chiếc lá kỷ niệm đầu tiên cùng gia đình.",
    includes: ["Standard Kit", "1 buổi hướng dẫn nhóm nhỏ", "Setup tài khoản Sprouty", "Ảnh kỷ niệm sau buổi học"],
    images: ["/assets/images/sprouty-icons/SunFlower.png"], status: "published" },
  { id: 4, name: "Smart Kit Workshop", emoji: "🔌", collection: "STEM & IoT", category: "workshop", ageRange: "10+ tuổi", price: 450000, oldPrice: null, badge: "new", bgColor: "#E0F2FE",
    description: "Workshop lắp cảm biến, màn hình OLED và LED cho cây. Phù hợp học sinh yêu STEM và phụ huynh muốn học cùng con.",
    includes: ["Smart Kit", "1 buổi hướng dẫn lắp mạch", "Kết nối cảm biến cây", "Tài liệu thực hành IoT"],
    images: ["/assets/images/sprouty-icons/Bean.png"], status: "published" },
  { id: 5, name: "VIP Garden Monthly", emoji: "🌙", collection: "Golden Garden", category: "membership", ageRange: "Gia đình", price: 20000, oldPrice: null, badge: null, bgColor: "#FEFCE8",
    description: "Mở khóa chế độ ban đêm, hiệu ứng theo mùa, Plant Buddies hiếm và AI recap hàng tháng cho Cây Kỷ Niệm.",
    includes: ["Night Mode", "Seasonal effects", "Rare Plant Buddies", "Monthly AI recap", "Ưu tiên hỗ trợ"],
    images: ["/assets/images/sprouty-icons/FirePepper.png"], status: "published" },
  { id: 6, name: "VIP Garden Annual", emoji: "✨", collection: "Golden Garden", category: "membership", ageRange: "Gia đình", price: 180000, oldPrice: 240000, badge: "sale", bgColor: "#FEF3C7",
    description: "Gói VIP hằng năm cho gia đình muốn lưu giữ trọn vẹn hành trình cây lớn lên cùng bé.",
    includes: ["Tất cả quyền lợi VIP Monthly", "Tiết kiệm 25%", "Golden Memory Tree", "Ưu tiên tính năng mới"],
    images: ["/assets/images/sprouty-icons/Corn.png"], status: "published" },
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
