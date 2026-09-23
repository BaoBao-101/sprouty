import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Lightbox } from '@/components/Lightbox';
import { WorkshopRegisterForm } from '@/components/WorkshopRegisterForm';
import { FAQS, LB_IMAGES, WORKSHOPS } from '@/data/workshop';
import './Workshop.css';

export default function Workshop() {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const navigate = (step: number) =>
    setLightbox((i) => (i === null ? i : (i + step + LB_IMAGES.length) % LB_IMAGES.length));

  return (
    <>
      {/* Hero */}
      <div className="ws-hero" style={{ padding: "72px 0 56px" }}>
        <div className="container">
          <div className="breadcrumb" style={{ color: "rgba(255,255,255,.45)", marginBottom: "20px" }}>
            <Link to="/" style={{ color: "rgba(255,255,255,.45)" }}>Trang chủ</Link> › Workshop
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,.14)", border: "1px solid rgba(255,255,255,.22)", borderRadius: "var(--r-full)", padding: "6px 16px", marginBottom: "22px" }}>
            <span style={{ fontSize: ".88rem" }}>🏫</span>
            <span style={{ fontFamily: "var(--font-h)", fontSize: ".74rem", fontWeight: "700", letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.85)" }}>Học trực tiếp</span>
          </div>
          <h1 style={{ color: "#fff", maxWidth: "580px", lineHeight: "1.25" }}>Workshop trồng cây<br /><span style={{ fontStyle: "italic", color: "#A7F3D0", fontFamily: "var(--font-display)", display: "block", marginTop: "6px" }}>tại TP. Hồ Chí Minh</span></h1>
          <p className="lead" style={{ marginTop: "18px", maxWidth: "520px", color: "rgba(255,255,255,.72)" }}>Buổi workshop nhóm nhỏ nơi bé vẽ chậu, gieo hạt thật, kích hoạt Plant Buddy và lưu chiếc lá kỷ niệm đầu tiên cùng gia đình.</p>
          <div className="hero-actions" style={{ marginTop: "32px" }}>
            <a href="#lich" className="btn btn-white btn-lg">Xem lịch sắp tới →</a>
            <a href="#dang-ky" className="btn btn-white-ol btn-lg">Đăng ký ngay</a>
          </div>
          <div className="ws-stat-row">
            <div className="ws-stat"><span className="ws-stat-n">8–12</span><span className="ws-stat-l">Bé mỗi buổi</span></div>
            <div className="ws-stat"><span className="ws-stat-n">2–3h</span><span className="ws-stat-l">Mỗi buổi học</span></div>
            <div className="ws-stat"><span className="ws-stat-n">4–12</span><span className="ws-stat-l">Tuổi tham gia</span></div>
            <div className="ws-stat"><span className="ws-stat-n">100%</span><span className="ws-stat-l">Thực hành tay</span></div>
          </div>
        </div>
      </div>

      {/* What is Workshop */}
      <section className="section" id="about-ws">
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "center" }}>
            <div>
              <span className="label">Trải nghiệm khác biệt</span>
              <h2 style={{ margin: "10px 0 16px" }}>Hơn cả một buổi trồng cây</h2>
              <p style={{ color: "var(--ink-3)", lineHeight: "1.8", fontSize: ".96rem", marginBottom: "28px" }}>Workshop Sprouty là không gian để bé chạm vào đất, màu vẽ và hạt giống thật, rồi kết nối hoạt động ngoài đời với Cây Kỷ Niệm số trên app.</p>
              <div className="benefits-grid">
                <div className="benefit-item"><div className="benefit-icon">👥</div><div><div className="benefit-title">Nhóm nhỏ 8–12 bé</div><div className="benefit-desc">Đảm bảo mỗi bé được chú ý cá nhân và hướng dẫn tận tình</div></div></div>
                <div className="benefit-item"><div className="benefit-icon">🌱</div><div><div className="benefit-title">Nguyên liệu chuẩn bị đầy đủ</div><div className="benefit-desc">Phụ huynh không cần mang theo gì — tất cả đã có sẵn</div></div></div>
                <div className="benefit-item"><div className="benefit-icon">🎖</div><div><div className="benefit-title">Chứng nhận hoàn thành</div><div className="benefit-desc">Bé nhận chứng nhận và ảnh kỷ niệm sau mỗi buổi workshop</div></div></div>
                <div className="benefit-item"><div className="benefit-icon">👨‍👩‍👧</div><div><div className="benefit-title">Phụ huynh tham gia cùng</div><div className="benefit-desc">Chúng tôi khuyến khích ba mẹ ngồi cùng để có kỷ niệm gia đình</div></div></div>
              </div>
            </div>
            <div>
              <div style={{ background: "linear-gradient(135deg,#E8F5E9,#F0FDF4)", borderRadius: "var(--r-2xl)", padding: "44px", textAlign: "center", border: "1.5px solid rgba(88,129,87,.2)" }}>
                <div style={{ fontSize: "7rem", marginBottom: "20px" }}>🎨</div>
                <p style={{ fontFamily: "var(--font-hand)", fontSize: "1.6rem", color: "var(--green)", marginBottom: "20px" }}>"Bé tự làm, bé tự tự hào"</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", textAlign: "center" }}>
                  <div style={{ background: "rgba(255,255,255,.7)", borderRadius: "var(--r-lg)", padding: "16px" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: "700", color: "var(--green)" }}>150K</div>
                    <div style={{ fontSize: ".73rem", color: "var(--ink-3)" }}>từ / buổi</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,.7)", borderRadius: "var(--r-lg)", padding: "16px" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: "700", color: "var(--green)" }}>Cuối tuần</div>
                    <div style={{ fontSize: ".73rem", color: "var(--ink-3)" }}>lịch định kỳ</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,.7)", borderRadius: "var(--r-lg)", padding: "16px" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: "700", color: "var(--green)" }}>TP.HCM</div>
                    <div style={{ fontSize: ".73rem", color: "var(--ink-3)" }}>địa điểm</div>
                  </div>
                  <div style={{ background: "rgba(255,255,255,.7)", borderRadius: "var(--r-lg)", padding: "16px" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", fontWeight: "700", color: "var(--green)" }}>Chậu cây</div>
                    <div style={{ fontSize: ".73rem", color: "var(--ink-3)" }}>mang về nhà</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gallery preview */}
      <section className="section" style={{ background: "#0F0A08", overflow: "hidden" }} id="gallery">
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <span className="label" style={{ justifyContent: "center", color: "rgba(255,255,255,.5)" }}>Không khí Sprouty</span>
            <h2 style={{ color: "#fff", marginTop: "8px" }}>Workshop diễn ra thế này</h2>
            <p style={{ color: "rgba(255,255,255,.55)", maxWidth: "480px", margin: "12px auto 0", fontSize: ".96rem", lineHeight: "1.7" }}>
              Không gian gia đình thật sự — các bé vẽ chậu, gieo hạt, đặt tên cho cây và lưu lại kỷ niệm đầu tiên.
            </p>
          </div>

          {/* ── Main gallery: editorial / magazine layout ── */}
          <div className="ws-photo-grid">

            {/* Row 1: Hero wide + tall portrait */}
            <div className="ws-photo-row ws-row-1">
              <div className="ws-photo ws-photo-hero ws-photo-hover" onClick={() => setLightbox(0)}>
                <img src="/assets/images/workshop/1.jpg" alt="Bộ kit Sprouty đầy đủ — hạt giống, màu vẽ, cảm biến và chậu cây thông minh" loading="lazy" />
                <div className="ws-photo-overlay">
                  <span className="ws-photo-caption">🎁 Bộ kit Sprouty đầy đủ — từ hạt giống đến chậu cây thông minh</span>
                </div>
              </div>
              <div className="ws-photo-col">
                <div className="ws-photo ws-photo-half ws-photo-hover" onClick={() => setLightbox(1)}>
                  <img src="/assets/images/workshop/2.jpg" alt="Các bé cùng vẽ chậu cây trong lớp học" loading="lazy" />
                  <div className="ws-photo-overlay">
                    <span className="ws-photo-caption">🎨 Lớp học đông vui — mỗi bé một chậu cây, mỗi chậu một câu chuyện</span>
                  </div>
                </div>
                <div className="ws-photo ws-photo-half ws-photo-hover" onClick={() => setLightbox(2)}>
                  <img src="/assets/images/workshop/3.jpg" alt="Hướng dẫn viên cùng bé trang trí chậu cây thông minh" loading="lazy" />
                  <div className="ws-photo-overlay">
                    <span className="ws-photo-caption">✏️ Cùng cô trang trí chậu cây — từng nét vẽ đầu tiên</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Three equal columns */}
            <div className="ws-photo-row ws-row-2">
              <div className="ws-photo ws-photo-third ws-photo-hover" onClick={() => setLightbox(3)}>
                <img src="/assets/images/workshop/4.jpg" alt="Hai bé tự hào khoe chậu cây Rainbow" loading="lazy" />
                <div className="ws-photo-overlay">
                  <span className="ws-photo-caption">🌈 Thành quả tự hào — bé khoe chậu cây Rainbow của mình</span>
                </div>
              </div>
              <div className="ws-photo ws-photo-third ws-photo-hover" onClick={() => setLightbox(4)}>
                <img src="/assets/images/workshop/5.jpg" alt="Chậu cây Rainbow với cây ớt đang ra hoa" loading="lazy" />
                <div className="ws-photo-overlay">
                  <span className="ws-photo-caption">🌶 Cận cảnh chậu Rainbow — cây ớt đã ra hoa</span>
                </div>
              </div>
              <div className="ws-photo ws-photo-third ws-photo-hover" onClick={() => setLightbox(5)}>
                <img src="/assets/images/workshop/6.jpg" alt="Hướng dẫn viên vẽ mẫu lên chậu cây cho bé quan sát" loading="lazy" />
                <div className="ws-photo-overlay">
                  <span className="ws-photo-caption">🖌 Hướng dẫn viên vẽ mẫu — bé quan sát và học theo</span>
                </div>
              </div>
            </div>

            {/* Row 3: Two wide */}
            <div className="ws-photo-row ws-row-3">
              <div className="ws-photo ws-photo-wide ws-photo-hover" onClick={() => setLightbox(6)}>
                <img src="/assets/images/workshop/7.jpg" alt="Chậu cây thành phẩm được gói làm quà tặng" loading="lazy" />
                <div className="ws-photo-overlay">
                  <span className="ws-photo-caption">🎀 Món quà tự tay làm — gói ghém yêu thương</span>
                </div>
              </div>
              <div className="ws-photo ws-photo-wide ws-photo-hover" onClick={() => setLightbox(7)}>
                <img src="/assets/images/workshop/8.jpg" alt="Cận cảnh bé tô màu chậu cây" loading="lazy" />
                <div className="ws-photo-overlay">
                  <span className="ws-photo-caption">🖍 Tỉ mỉ từng nét cọ — sắc màu của riêng bé</span>
                </div>
              </div>
            </div>

            {/* Row 4: Two wide */}
            <div className="ws-photo-row ws-row-3">
              <div className="ws-photo ws-photo-wide ws-photo-hover" onClick={() => setLightbox(8)}>
                <img src="/assets/images/workshop/9.jpg" alt="Bé tập trung tô màu chậu cây nhỏ" loading="lazy" />
                <div className="ws-photo-overlay">
                  <span className="ws-photo-caption">🧐 Tập trung tuyệt đối — khoảnh khắc sáng tạo của bé</span>
                </div>
              </div>
              <div className="ws-photo ws-photo-wide ws-photo-hover" onClick={() => setLightbox(9)}>
                <img src="/assets/images/workshop/10.jpg" alt="Chậu cây thành phẩm Captain Boy do bé tự vẽ" loading="lazy" />
                <div className="ws-photo-overlay">
                  <span className="ws-photo-caption">🏆 Sản phẩm hoàn thiện — chậu cây mang dấu ấn riêng của bé</span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA below gallery */}
          <div style={{ textAlign: "center", marginTop: "44px" }}>
            <p style={{ color: "rgba(255,255,255,.5)", fontSize: ".9rem", marginBottom: "20px" }}>Mỗi buổi workshop là một kỷ niệm đáng nhớ cho bé và gia đình</p>
            <a href="#dang-ky" className="btn btn-primary btn-lg">Đăng ký tham gia →</a>
          </div>
        </div>

        <Lightbox images={LB_IMAGES} index={lightbox} onClose={() => setLightbox(null)} onNavigate={navigate} />
      </section>


      {/* Upcoming schedule */}
      <section className="section" id="lich">
        <div className="container">
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <span className="label" style={{ justifyContent: "center" }}>Lịch sắp tới</span>
            <h2>Workshop đang mở đăng ký</h2>
            <p className="lead" style={{ maxWidth: "480px", margin: "10px auto 0" }}>Số chỗ có hạn — đặt trước để đảm bảo suất cho bé.</p>
          </div>
          <div className="ws-schedule">
            {WORKSHOPS.slice(0, 6).map((w) => {
              const taken = w.maxSlots - w.slots;
              const pct = Math.round((taken / w.maxSlots) * 100);
              const isFull = w.slots === 0;
              return (
                <div className="schedule-card" key={w.id}>
                  <div className="schedule-photo">
                    <img src={w.img} alt={w.title} loading="lazy" />
                    <span className="schedule-emoji-badge">{w.emoji}</span>
                  </div>
                  <div className="schedule-header">
                    <div className="schedule-date">📅 {w.date} · {w.time}</div>
                    <div className="schedule-title">{w.title}</div>
                  </div>
                  <div className="schedule-body">
                    <p className="schedule-detail">{w.desc}</p>
                    <div className="schedule-tags">
                      <span className="tag">{w.age}</span>
                      <span className="tag green">{w.price.toLocaleString('vi-VN')}đ</span>
                      <span className={`tag${isFull ? ' rose' : ''}`}>
                        {isFull ? 'Hết chỗ' : `${w.slots} chỗ còn`}
                      </span>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <div className="schedule-bar">
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: pct > 80 ? 'var(--rose)' : 'var(--green)',
                            borderRadius: 2,
                            transition: 'width .4s',
                          }}
                        />
                      </div>
                      <div className="schedule-taken">{taken}/{w.maxSlots} đã đăng ký</div>
                    </div>
                    <div className="schedule-footer">
                      <span className="workshop-price">{w.price.toLocaleString('vi-VN')}đ</span>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={isFull}
                        style={isFull ? { opacity: 0.5 } : undefined}
                        onClick={() => document.getElementById('dang-ky')?.scrollIntoView({ behavior: 'smooth' })}
                      >
                        {isFull ? 'Hết chỗ' : 'Đăng ký →'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Registration Form */}
      <section className="section" style={{ background: "var(--cream-2)" }} id="dang-ky">
        <div className="container" style={{ maxWidth: "1100px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "52px", alignItems: "start" }}>
            <div>
              <span className="label">Đăng ký tham gia</span>
              <h2 style={{ margin: "10px 0 16px" }}>Giữ suất cho bé ngay hôm nay</h2>
              <p style={{ color: "var(--ink-3)", fontSize: ".96rem", lineHeight: "1.8", marginBottom: "28px" }}>Điền thông tin bên cạnh và chúng tôi sẽ liên hệ xác nhận trong vòng 24h. Học phí thanh toán khi xác nhận — hoàn toàn miễn phí đặt chỗ.</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <div style={{ width: "44px", height: "44px", background: "var(--orange-pale)", borderRadius: "var(--r-lg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: "0", border: "1.5px solid rgba(232,93,4,.15)" }}>📞</div>
                  <div><div style={{ fontFamily: "var(--font-h)", fontSize: ".92rem", fontWeight: "700", color: "var(--ink)", marginBottom: "3px" }}>Hotline tư vấn</div><div style={{ fontSize: ".9rem", color: "var(--ink-3)" }}><Link to="/contact" style={{ color: "var(--orange)", fontWeight: "600" }}>Gửi yêu cầu tư vấn</Link></div><div style={{ fontSize: ".78rem", color: "var(--ink-5)", marginTop: "2px" }}>T2–T7: 8:00–18:00</div></div>
                </div>
                <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <div style={{ width: "44px", height: "44px", background: "#F0FDF4", borderRadius: "var(--r-lg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: "0", border: "1.5px solid #BBF7D0" }}>📧</div>
                  <div><div style={{ fontFamily: "var(--font-h)", fontSize: ".92rem", fontWeight: "700", color: "var(--ink)", marginBottom: "3px" }}>Email đăng ký</div><div style={{ fontSize: ".9rem", color: "var(--ink-3)" }}><Link to="/contact" style={{ color: "var(--green)", fontWeight: "600" }}>Gửi yêu cầu đăng ký</Link></div><div style={{ fontSize: ".78rem", color: "var(--ink-5)", marginTop: "2px" }}>Phản hồi trong 4 giờ</div></div>
                </div>
                <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                  <div style={{ width: "44px", height: "44px", background: "#EFF6FF", borderRadius: "var(--r-lg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: "0", border: "1.5px solid #BFDBFE" }}>📍</div>
                  <div><div style={{ fontFamily: "var(--font-h)", fontSize: ".92rem", fontWeight: "700", color: "var(--ink)", marginBottom: "3px" }}>Địa điểm workshop</div><div style={{ fontSize: ".9rem", color: "var(--ink-3)" }}>TP.HCM · địa điểm xác nhận khi đăng ký</div><div style={{ fontSize: ".78rem", color: "var(--ink-5)", marginTop: "2px" }}>TP. Hồ Chí Minh</div></div>
                </div>
              </div>
              <div style={{ marginTop: "28px", padding: "18px", background: "var(--orange-pale)", borderRadius: "var(--r-xl)", border: "1.5px solid rgba(232,93,4,.15)" }}>
                <div style={{ fontFamily: "var(--font-h)", fontSize: ".84rem", fontWeight: "700", color: "var(--orange)", marginBottom: "6px" }}>🎁 Quyền lợi khi đăng ký</div>
                <ul style={{ listStyle: "none", padding: "0", margin: "0", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <li style={{ fontSize: ".86rem", color: "var(--ink-3)", display: "flex", gap: "8px", alignItems: "center" }}><span style={{ color: "var(--green)", fontWeight: "700", flexShrink: "0" }}>✓</span>Chứng nhận hoàn thành có ảnh kỷ niệm</li>
                  <li style={{ fontSize: ".86rem", color: "var(--ink-3)", display: "flex", gap: "8px", alignItems: "center" }}><span style={{ color: "var(--green)", fontWeight: "700", flexShrink: "0" }}>✓</span>Toàn bộ nguyên liệu được cung cấp sẵn</li>
                  <li style={{ fontSize: ".86rem", color: "var(--ink-3)", display: "flex", gap: "8px", alignItems: "center" }}><span style={{ color: "var(--green)", fontWeight: "700", flexShrink: "0" }}>✓</span>Mang về chậu cây đã gieo hạt</li>
                  <li style={{ fontSize: ".86rem", color: "var(--ink-3)", display: "flex", gap: "8px", alignItems: "center" }}><span style={{ color: "var(--green)", fontWeight: "700", flexShrink: "0" }}>✓</span>Đổi lịch miễn phí trước 24 giờ</li>
                </ul>
              </div>
            </div>
            <WorkshopRegisterForm />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="container" style={{ maxWidth: "720px" }}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <span className="label" style={{ justifyContent: "center" }}>Câu hỏi thường gặp</span>
            <h2>Bạn muốn biết thêm?</h2>
          </div>
          <div className="ws-faq">
            {FAQS.map(([question, answer], i) => (
              <div className={`faq-item${openFaq === i ? ' open' : ''}`} key={question}>
                <div className="faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  {question}
                  <span className={`faq-arrow${openFaq === i ? ' open' : ''}`}>›</span>
                </div>
                <div className="faq-a">{answer}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
