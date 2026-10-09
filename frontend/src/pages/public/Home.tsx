import { Link, useNavigate } from 'react-router-dom';
import { HeroCarousel } from '@/components/HeroCarousel';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import type { Product } from '@/types/product';
import './Home.css';

/** Featured row: up to two hot kits, then a new one, then any other kit. */
function pickFeatured(products: Product[]): Product[] {
  return [
    ...products.filter((p) => p.badge === 'hot').slice(0, 2),
    ...products.filter((p) => p.badge === 'new').slice(0, 1),
    ...products.filter((p) => !p.badge && p.cat === 'kit').slice(0, 1),
  ].slice(0, 3);
}

const EMPTY_CELL: React.CSSProperties = {
  gridColumn: '1/-1',
  textAlign: 'center',
  color: 'var(--ink-4)',
  padding: 32,
};

export default function Home() {
  const navigate = useNavigate();
  const { products, loading, error } = useProducts();
  const featured = pickFeatured(products);

  return (
    <>
      {/* ── HERO ── */}
      <section className="hero">
        <div className="container">
          <div className="hero-grid">
            <div className="hero-left fade-up">
              <div className="hero-eyebrow">🌿 Kit trồng cây & lưu giữ ký ức cho bé</div>
              <h1 className="hero-title">Gieo kỷ niệm,<br /><em>lớn lên cùng nhau</em></h1>
              <p className="hero-subtitle">Sprouty kết hợp trồng cây, khám phá khoa học và lưu giữ ký ức để mỗi khoảnh khắc của bé đều trở thành một chặng đường đáng nhớ.</p>
              <div className="hero-actions">
                <Link to="/shop" className="btn btn-primary btn-lg">Khám phá bộ KIT →</Link>
                <Link to="/workshop" className="btn btn-outline btn-lg">Xem Workshop trồng cây</Link>
              </div>
              <div className="hero-chips">
                <span className="hero-chip">⭐ Phù hợp 3-11 tuổi</span>
                <span className="hero-chip">🛡️ An toàn & thân thiện</span>
                <span className="hero-chip">🎓 Giáo dục STEM</span>
                <span className="hero-chip">🤖 Plant Buddy AI</span>
              </div>
            </div>
            <div className="hero-right fade-up delay-2">
              {/* ── Auto-sliding image carousel ── */}
              <HeroCarousel products={products} />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <div className="stats-strip">
        <div className="container">
          <div className="stats-row">
            <div className="stat-item"><span className="stat-n">12k+</span><span className="stat-l">Gia đình gieo mầm</span></div>
            <div className="stat-item"><span className="stat-n">48k</span><span className="stat-l">Kỷ niệm đã lưu</span></div>
            <div className="stat-item"><span className="stat-n">4.9</span><span className="stat-l">Đánh giá gia đình</span></div>
            <div className="stat-item"><span className="stat-n">2</span><span className="stat-l">Dòng kit Sprouty</span></div>
          </div>
        </div>
      </div>

      {/* ── USER FLOW ── */}
      <section className="section" id="user-flow" style={{ background: "var(--cream-2)", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", left: "-120px", top: "-80px", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle,rgba(232,93,4,.07) 0%,transparent 70%)", pointerEvents: "none" }}></div>
        <div style={{ position: "absolute", right: "-80px", bottom: "-60px", width: "320px", height: "320px", borderRadius: "50%", background: "radial-gradient(circle,rgba(88,129,87,.07) 0%,transparent 70%)", pointerEvents: "none" }}></div>
        <div className="container" style={{ position: "relative", zIndex: "1" }}>
          <div className="section-title">
            <div className="overline">Hành trình cùng Sprouty</div>
            <h2>Hành trình của bé với Sprouty</h2>
            <p className="lead" style={{ maxWidth: "520px", margin: "12px auto 0" }}>Từ một bộ kit ngoài đời đến khu vườn kỷ niệm số — chỉ 4 bước gia đình có thể làm cùng nhau.</p>
          </div>
          {/* The circles used to be painted into progress-banner.png, so nothing
              could be placed inside them: the icons floated above the image and
              the captions sat in a separate row underneath, far from the step
              they described. Each step is real markup now — number and icon in
              the same circle, wording attached to it. */}
          <div className="user-flow-track">
            {[
              { n: '01', icon: '🎁', title: 'Chọn bộ kit', desc: 'Mua trên web và nhận ngay mã kích hoạt — không chờ giao hàng, không mất phí vận chuyển.' },
              { n: '02', icon: '🌱', title: 'Nhập mã, gieo hạt', desc: 'Vào "Cây của tôi", nhập mã và đặt tên. Hạt nảy mầm ngay cùng bộ cảm biến IoT đầu tiên.' },
              { n: '03', icon: '💧', title: 'Chăm cây mỗi ngày', desc: 'Đọc cảm biến độ ẩm, nhiệt độ, ánh sáng rồi tưới, bón, tỉa đúng lúc. Mỗi việc có thời gian hồi riêng.' },
              { n: '04', icon: '🏆', title: 'Nuôi tới ngày thu hoạch', desc: 'Qua 8 giai đoạn từ hạt tới quả chín, Plant Buddy AI đi cùng bé từng bước và mở dần 8 thiết bị IoT.' },
            ].map((step, i) => (
              <div className={`uflow-step c${i + 1}`} key={step.n}>
                <div className="uflow-badge">
                  <span className="uflow-badge-icon">{step.icon}</span>
                  <span className="uflow-badge-num">{step.n}</span>
                </div>
                <h4 className="uflow-title">{step.title}</h4>
                <p className="uflow-desc">{step.desc}</p>
              </div>
            ))}
          </div>
          {/* Mobile linear flow */}
          <div className="user-flow-mobile">
            <div className="uflow-m-item"><div className="uflow-m-dot c1"><span>01</span></div><div className="uflow-m-line"></div><div><h4 className="uflow-title">Nhận Sprouty Kit</h4><p className="uflow-desc">Chậu, màu, hạt giống, đất trồng và hướng dẫn trong một hộp.</p></div></div>
            <div className="uflow-m-item"><div className="uflow-m-dot c2"><span>02</span></div><div className="uflow-m-line"></div><div><h4 className="uflow-title">Kích hoạt Plant Buddy</h4><p className="uflow-desc">Quét QR hoặc nhập mã PIN để mở khu vườn số.</p></div></div>
            <div className="uflow-m-item"><div className="uflow-m-dot c3"><span>03</span></div><div className="uflow-m-line"></div><div><h4 className="uflow-title">Vẽ chậu & gieo hạt</h4><p className="uflow-desc">Bé tự trang trí, gieo hạt và chăm cây mỗi ngày.</p></div></div>
            <div className="uflow-m-item"><div className="uflow-m-dot c4"><span>04</span></div><div style={{ width: "2px" }}></div><div><h4 className="uflow-title">Lưu kỷ niệm</h4><p className="uflow-desc">Ảnh, video, nhật ký trở thành lá trên Cây Kỷ Niệm.</p></div></div>
          </div>
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ── */}
      <section className="section" style={{ background: "var(--cream-2) url(/assets/images/banner/slide-banner.png) center/cover no-repeat" }}>
        <div className="container">
          <div className="section-title">
            <div className="overline">Các bộ kit nổi bật</div>
            <h2>Được bé yêu thích nhất</h2>
            <p className="lead" style={{ maxWidth: "480px", margin: "12px auto 0" }}>Những bộ kit trồng cây sáng tạo, an toàn và phù hợp cho cả người mới bắt đầu.</p>
          </div>
          <div className="grid-3">
            {loading && <div style={EMPTY_CELL}>Đang tải sản phẩm…</div>}
            {error && <div style={EMPTY_CELL}>{error}</div>}
            {!loading && !error && featured.length === 0 && (
              <div style={EMPTY_CELL}>Chưa có sản phẩm nổi bật.</div>
            )}
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: "36px" }}>
            <Link to="/shop" className="btn btn-outline btn-lg">Xem tất cả sản phẩm →</Link>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="section">
        <div className="container">
          <div className="section-title">
            <div className="overline">Vì sao chọn Sprouty</div>
            <h2>Nhiều hơn một chậu cây nhỏ</h2>
          </div>
          <div className="feat-list">
            <div className="feat-list-item">
              <div className="feat-icon coral">🌳</div>
              <div><div className="feat-title">Lưu giữ ký ức trọn vẹn</div>
              <p className="feat-desc">Mỗi chiếc lá lưu một ảnh, video hoặc nhật ký. Cây số lớn dần theo từng khoảnh khắc bé chăm cây ngoài đời.</p></div>
            </div>
            <div className="feat-list-item">
              <div className="feat-icon lavender">🤖</div>
              <div><div className="feat-title">AI Plant Buddy</div>
              <p className="feat-desc">AI tạo caption dễ thương, lời nhắn từ Bạn Cây và bản tóm tắt câu chuyện hàng tháng cho gia đình.</p></div>
            </div>
            <div className="feat-list-item">
              <div className="feat-icon green">🎨</div>
              <div><div className="feat-title">Học mà chơi</div>
              <p className="feat-desc">Bé đọc cảm biến, suy luận cây đang thiếu gì rồi tự quyết định chăm thế nào — kiến thức khoa học và kỹ năng sống qua từng buổi chăm cây.</p></div>
            </div>
            <div className="feat-list-item">
              <div className="feat-icon green">🛡️</div>
              <div><div className="feat-title">An toàn cho bé</div>
              <p className="feat-desc">Nguyên liệu tự nhiên, không độc hại, dụng cụ vừa tay và an toàn tuyệt đối cho trẻ nhỏ.</p></div>
            </div>
            <div className="feat-list-item">
              <div className="feat-icon sky">🎓</div>
              <div><div className="feat-title">Workshop & STEM</div>
              <p className="feat-desc">Workshop nhóm nhỏ giúp bé vẽ chậu, gieo hạt, setup tài khoản Sprouty hoặc lắp cảm biến IoT cùng phụ huynh.</p></div>
            </div>
            <div className="feat-list-item">
              <div className="feat-icon coral">💝</div>
              <div><div className="feat-title">Kết nối gia đình</div>
              <p className="feat-desc">Chia sẻ cột mốc với ông bà, lưu lại hành trình cây lớn lên và biến ký ức gia đình thành một khu vườn sống động.</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* ── AGE GUIDE ── */}
      <section className="section" style={{ background: "var(--cream-2)" }}>
        <div className="container">
          <div className="section-title">
            <div className="overline">Sprouty phù hợp với ai</div>
            <h2>Sprouty phù hợp với ai?</h2>
            <p className="lead" style={{ maxWidth: "480px", margin: "12px auto 0" }}>Từ bé nhỏ thích vẽ chậu đến học sinh mê STEM, Sprouty có một hành trình trồng cây phù hợp.</p>
          </div>
          <div className="age-grid">
            <div className="age-card" onClick={() => navigate('/shop?age=4-6')}>
              <div className="age-icon-wrap green"><span className="age-em" style={{ margin: "0" }}>🌱</span></div>
              <span className="age-range">4–10 tuổi</span>
              <p className="age-sub">Vẽ chậu, gieo hạt, tưới nước và lưu ảnh mỗi tuần. Ba mẹ đồng hành nhưng bé là người chăm cây chính.</p>
            </div>
            <div className="age-card" onClick={() => navigate('/shop?age=6-8')}>
              <div className="age-icon-wrap green"><span className="age-em" style={{ margin: "0" }}>🌿</span></div>
              <span className="age-range">10–18 tuổi</span>
              <p className="age-sub">Bản Smart mở sẵn cả 8 thiết bị IoT mô phỏng — cảm biến độ ẩm, EC, ánh sáng, bơm tưới và đèn — để học sinh học STEM qua số liệu thật.</p>
            </div>
            <div className="age-card" onClick={() => navigate('/shop?age=8-10')}>
              <div className="age-icon-wrap orange"><span className="age-em" style={{ margin: "0" }}>🌳</span></div>
              <span className="age-range">Phụ huynh</span>
              <p className="age-sub">Lưu ảnh, video, nhật ký và những câu nói nhỏ của con thành một Cây Kỷ Niệm riêng tư cho gia đình.</p>
            </div>
            <div className="age-card" onClick={() => navigate('/vip')}>
              <div className="age-icon-wrap coral"><span className="age-em" style={{ margin: "0" }}>✨</span></div>
              <span className="age-range">VIP Garden</span>
              <p className="age-sub">Mở khóa hiệu ứng ban đêm, cây vàng, Plant Buddies hiếm và nhật ký AI hàng tháng.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section className="section">
        <div className="container">
          <div className="section-title">
            <div className="overline">Phụ huynh nói gì</div>
            <h2>Kỷ niệm thật, từ những gia đình thật</h2>
          </div>
          <div className="review-grid">
            <div className="review-card">
              <div className="review-stars">★★★★★</div>
              <p className="review-text">"Bé nhà mình tự tay vẽ chậu, gieo hạt rồi mỗi sáng đều chạy ra xem cây. Lần đầu tiên con chủ động chăm một thứ lâu như vậy."</p>
              <div className="reviewer">
                <div className="reviewer-av" style={{ background: "linear-gradient(135deg,#E85D04,#C4622D)" }}>M</div>
                <div><div className="reviewer-name">Nguyễn Thị Mai</div><div className="reviewer-sub">Phụ huynh, Quận 7 · Standard Kit</div></div>
              </div>
            </div>
            <div className="review-card">
              <div className="review-stars">★★★★★</div>
              <p className="review-text">"Cây Kỷ Niệm làm cả nhà thích. Mỗi tuần thêm một chiếc lá, ông bà ở xa cũng xem được khoảnh khắc cây và con cùng lớn."</p>
              <div className="reviewer">
                <div className="reviewer-av" style={{ background: "linear-gradient(135deg,#3B82F6,#1D4ED8)" }}>T</div>
                <div><div className="reviewer-name">Trần Minh Tuấn</div><div className="reviewer-sub">Phụ huynh, Bình Thạnh · Memory Tree</div></div>
              </div>
            </div>
            <div className="review-card">
              <div className="review-stars">★★★★★</div>
              <p className="review-text">"Smart Kit làm con tôi mê cảm biến và lập trình hơn hẳn. Cây thật khiến bài học IoT không còn khô khan."</p>
              <div className="reviewer">
                <div className="reviewer-av" style={{ background: "linear-gradient(135deg,#588157,#3A5A40)" }}>H</div>
                <div><div className="reviewer-name">Lê Thị Hoa</div><div className="reviewer-sub">Phụ huynh, Gò Vấp · Smart Kit</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── AI PROMO ── */}
      <section className="section" style={{ background: "var(--cream-2)" }}>
        <div className="container">
          <div className="ai-promo">
            <div style={{ position: "relative", zIndex: "1", maxWidth: "600px" }}>
              <div className="overline" style={{ color: "rgba(255,255,255,.85)" }}>Tính năng đặc biệt</div>
              <h2 style={{ color: "#fff", margin: "10px 0 14px" }}>AI Plant Buddy biết kể chuyện cùng bé</h2>
              <p style={{ color: "rgba(255,255,255,.75)", fontSize: ".97rem", lineHeight: "1.75", marginBottom: "28px" }}>Tạo lời nhắn từ Bạn Cây, caption cho ảnh mới, hoặc gợi ý cách ghi lại một ngày chăm cây thành kỷ niệm đáng nhớ.</p>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <Link to="/ai" className="btn btn-white btn-lg">Thử ngay miễn phí →</Link>
                <Link to="/my-plants" className="btn btn-white-ol btn-lg">Vườn của tôi</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="section">
        <div className="container" style={{ maxWidth: "800px" }}>
          <div className="cta-banner">
            <div style={{ position: "relative", zIndex: "1" }}>
              <h2>Sẵn sàng gieo kỷ niệm đầu tiên?</h2>
              <p>Chọn Sprouty Kit cho bé hôm nay và bắt đầu một khu vườn gia đình đầy câu chuyện.</p>
              <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
                <Link to="/shop" className="btn btn-white btn-lg">🌱 Mua kit từ 150.000đ</Link>
                <Link to="/workshop" className="btn btn-white-ol btn-lg">🏫 Tham gia Workshop</Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
