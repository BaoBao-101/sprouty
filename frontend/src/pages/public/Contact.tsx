import { Link } from 'react-router-dom';
import { ContactForm } from '@/components/ContactForm';
import './Contact.css';

export default function Contact() {
  return (
    <>
      {/* Hero */}
        <div className="contact-hero">
          <div className="container">
            <div className="breadcrumb" style={{ color: "rgba(255,255,255,.45)", display: "flex", gap: "6px", marginBottom: "16px" }}>
              <Link to="/" style={{ color: "rgba(255,255,255,.45)" }}>Trang chủ</Link> › <span>Liên hệ</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 440px", gap: "52px", alignItems: "center" }}>
              <div>
                <span
                  style={{ fontFamily: "var(--font-h)", fontSize: ".78rem", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.6)", display: "block", marginBottom: "12px" }}>Hỗ
                  trợ khách hàng</span>
                <h1 style={{ maxWidth: "480px" }}>Chúng tôi rất muốn <em style={{ color: "var(--terra-3)" }}>lắng nghe</em> bạn</h1>
                <p className="lead" style={{ marginTop: "14px", maxWidth: "460px" }}>Dù là câu hỏi về sản phẩm, góp ý cải thiện hay muốn
                  hợp tác — đội ngũ Sprouty luôn sẵn sàng hỗ trợ về kit, workshop và Cây Kỷ Niệm.</p>
                <div style={{ display: "flex", gap: "28px", marginTop: "28px", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: "700", color: "#fff" }}>
                      &lt; 4h</div>
                        <div style={{ fontSize: ".78rem", color: "rgba(255,255,255,.55)", marginTop: "3px" }}>Thời gian phản hồi</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: "700", color: "#fff" }}>T2–T7</div>
                      <div style={{ fontSize: ".78rem", color: "rgba(255,255,255,.55)", marginTop: "3px" }}>Ngày làm việc</div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: "1.8rem", fontWeight: "700", color: "#fff" }}>8–18h</div>
                      <div style={{ fontSize: ".78rem", color: "rgba(255,255,255,.55)", marginTop: "3px" }}>Giờ hỗ trợ</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "none" }} className="d-lg-block">
                  <div
                    style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: "var(--r-2xl)", padding: "32px", textAlign: "center" }}>
                    <div style={{ fontSize: "6rem", marginBottom: "12px" }}>💬</div>
                    <p style={{ color: "rgba(255,255,255,.6)", fontSize: ".88rem", lineHeight: "1.7" }}>Gia đình có thể hỏi Sprouty về kit,
                      workshop, chăm cây hoặc hành trình Cây Kỷ Niệm</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="contact-body">
            <div className="container">
              <div className="contact-grid">
                {/* Left: info */}
                <div>
                  <h2 style={{ marginBottom: "24px" }}>Thông tin liên hệ</h2>
                  <div className="contact-info-list">
                    <div className="ci-item">
                      <div className="ci-icon orange">📧</div>
                      <div>
                        <div className="ci-title">Email chính</div>
                        <div className="ci-val"><a href="#formBody">Gửi tin nhắn qua biểu mẫu</a></div>
                        <div className="ci-note">Cho mọi câu hỏi chung · Phản hồi trong 4 giờ làm việc</div>
                      </div>
                    </div>
                    <div className="ci-item">
                      <div className="ci-icon green">📞</div>
                      <div>
                        <div className="ci-title">Kênh hỗ trợ</div>
                        <div className="ci-val"><a href="#formBody">Gửi yêu cầu hỗ trợ</a></div>
                        <div className="ci-note">T2–T7: 8:00–18:00 | T8–CN: 9:00–15:00</div>
                      </div>
                    </div>
                    <div className="ci-item">
                      <div className="ci-icon blue">📍</div>
                      <div>
                        <div className="ci-title">Địa chỉ văn phòng</div>
                        <div className="ci-val">TP. Hồ Chí Minh, Việt Nam</div>
                        <div className="ci-note">Địa chỉ đổi trả được xác nhận sau khi yêu cầu hỗ trợ được tiếp nhận</div>
                      </div>
                    </div>
                    <div className="ci-item">
                      <div className="ci-icon purple">🕐</div>
                      <div>
                        <div className="ci-title">Giờ làm việc</div>
                        <div className="ci-val">Thứ 2 – Thứ 6: 8:00 – 18:00<br />Thứ 7: 8:00 – 12:00</div>
                        <div className="ci-note">Chủ nhật: Nghỉ (AI chatbot vẫn hoạt động 24/7)</div>
                      </div>
                    </div>
                  </div>

                  {/* Departments */}
                  <h3 style={{ marginBottom: "16px", fontSize: "1.15rem" }}>Liên hệ đúng bộ phận</h3>
                  <div className="dept-grid">
                    <div className="dept-card">
                      <span className="dept-em">🛍</span>
                      <div className="dept-title">Đặt hàng & Thanh toán</div>
                      <a href="mailto:orders@sprouty.id.vn" className="dept-email">orders@sprouty.id.vn</a>
                      <p className="dept-desc">Hỗ trợ đặt hàng, kiểm tra đơn, thanh toán</p>
                    </div>
                    <div className="dept-card">
                      <span className="dept-em">↩</span>
                      <div className="dept-title">Đổi trả & Hoàn tiền</div>
                      <a href="#formBody" className="dept-email">Gửi yêu cầu hỗ trợ</a>
                      <p className="dept-desc">Yêu cầu đổi trả, sản phẩm lỗi, khiếu nại</p>
                    </div>
                    <div className="dept-card">
                      <span className="dept-em">🏫</span>
                      <div className="dept-title">Workshop & Giáo dục</div>
                      <a href="#formBody" className="dept-email">Gửi yêu cầu workshop</a>
                      <p className="dept-desc">Workshop trường học, hợp tác giáo dục</p>
                    </div>
                    <div className="dept-card">
                      <span className="dept-em">🤝</span>
                      <div className="dept-title">Hợp tác & Đối tác</div>
                      <a href="#formBody" className="dept-email">Gửi đề xuất hợp tác</a>
                      <p className="dept-desc">Phân phối, hợp tác nội dung, tài trợ</p>
                    </div>
                  </div>

                  {/* Map */}
                  <div className="map-placeholder">
                    <div style={{ fontSize: "3rem", marginBottom: "12px" }}>📍</div>
                    <div
                      style={{ fontFamily: "var(--font-h)", fontSize: ".96rem", fontWeight: "700", color: "var(--ink)", marginBottom: "6px" }}>
                      TP. Hồ Chí Minh, Việt Nam</div>
                    <p style={{ fontSize: ".84rem", color: "var(--ink-3)", maxWidth: "280px", margin: "0 auto 16px" }}>Địa điểm workshop sẽ
                      được xác nhận khi đăng ký</p>
                    <a href="https://maps.google.com/?q=Ho+Chi+Minh+City" target="_blank" rel="noopener"
                      className="btn btn-outline btn-sm">Mở bản đồ Google Maps →</a>
                  </div>

                  {/* Social */}
                  <div style={{ marginTop: "36px" }}>
                    <h3 style={{ marginBottom: "14px", fontSize: "1.05rem" }}>Kênh Sprouty</h3>
                    <div className="social-row">
                      <Link to="/workshop" className="social-btn">🌱 Workshop</Link>
                      <Link to="/shop" className="social-btn">🪴 Sprouty Kit</Link>
                      <Link to="/ai" className="social-btn">🤖 Plant Buddy AI</Link>
                      <Link to="/my-products" className="social-btn"><img src="/assets/images/sprouty-icons/MyTree.png" alt="" style={{ width: "16px", height: "16px", objectFit: "contain", verticalAlign: "middle", marginRight: "4px" }} />Cây Kỷ Niệm</Link>
                    </div>
                  </div>
                </div>

                {/* Right: form */}
                <ContactForm />
              </div>
            </div>
          </div>
    </>
  );
}
