import { Link } from 'react-router-dom';
import './About.css';

export default function About() {
  return (
    <>
      {/* Mission Banner */}
        <div
          style={{ background: "linear-gradient(135deg,rgba(26,18,9,.82) 0%,rgba(45,27,14,.72) 50%,rgba(244,138,0,.55) 100%),url(/assets/images/banner/about-banner.png) center/cover no-repeat", padding: "64px 0 56px", position: "relative", overflow: "hidden" }}>
          <div
            style={{ position: "absolute", right: "4%", top: "50%", transform: "translateY(-50%)", fontSize: "14rem", opacity: ".04", pointerEvents: "none", lineHeight: "1" }}>
            🌱</div>
          <div className="container">
            <span className="eyebrow"
              style={{ background: "rgba(255,255,255,.1)", color: "rgba(255,255,255,.8)", borderColor: "rgba(255,255,255,.15)" }}>Về
              Sprouty</span>
            <h1 style={{ color: "#fff", marginTop: "14px", maxWidth: "580px" }}>Chăm cây mỗi ngày, <em
                style={{ fontStyle: "italic", color: "var(--terra-3)" }}>lớn lên cùng bé</em></h1>
            <p style={{ color: "rgba(255,255,255,.6)", maxWidth: "500px", lineHeight: "1.78", marginTop: "16px", fontSize: ".97rem" }}>Sprouty
              bắt đầu từ một ý tưởng đơn giản: gia đình cần nhiều khoảnh khắc chậm lại cùng nhau. Mỗi ngày bé ghé thăm cây
              của mình, đọc cảm biến, quyết định hôm nay cây cần gì — một thói quen nhỏ kéo dài hàng tuần.</p>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "28px" }}>
              <Link to="/shop" className="btn btn-white btn-lg">Xem sản phẩm →</Link>
              <Link to="/workshop" className="btn btn-white-ol btn-lg">Workshop</Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div style={{ background: "var(--parchment)", borderBottom: "1.5px solid var(--parchment-2)", padding: "36px 0" }}>
          <div className="container">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "24px" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", fontWeight: "700", color: "var(--orange)" }}>168</div>
                <div style={{ fontSize: ".82rem", color: "var(--ink-3)", marginTop: "5px", fontFamily: "var(--font-h)" }}>Phụ huynh khảo sát
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", fontWeight: "700", color: "var(--orange)" }}>60%</div>
                <div style={{ fontSize: ".82rem", color: "var(--ink-3)", marginTop: "5px", fontFamily: "var(--font-h)" }}>Trẻ hoàn thành kit
                  đầu tiên</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", fontWeight: "700", color: "var(--orange)" }}>90%</div>
                <div style={{ fontSize: ".82rem", color: "var(--ink-3)", marginTop: "5px", fontFamily: "var(--font-h)" }}>Phụ huynh muốn mua
                  thêm</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", fontWeight: "700", color: "var(--orange)" }}>90</div>
                <div style={{ fontSize: ".82rem", color: "var(--ink-3)", marginTop: "5px", fontFamily: "var(--font-h)" }}>Ngày thí điểm</div>
              </div>
            </div>
          </div>
        </div>

        {/* Why Sprouty */}
        <section className="section" id="nghien-cuu">
          <div className="container">
            <div className="sh center">
              <span className="label">Vấn đề chúng tôi giải quyết</span>
              <h2>Nghiên cứu từ 168 phụ huynh tại TP.HCM</h2>
              <p className="lead">Trước khi xây dựng Sprouty, chúng tôi lắng nghe phụ huynh về nhu cầu cân bằng giữa học qua chơi,
                thiên nhiên và công nghệ an toàn cho trẻ.</p>
            </div>
            <div className="grid-3" style={{ gap: "20px" }}>
              <div className="card" style={{ padding: "28px" }}>
                <div
                  style={{ width: "52px", height: "52px", background: "var(--orange-pale)", borderRadius: "var(--r-lg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", marginBottom: "18px" }}>
                  📱</div>
                <h3 style={{ marginBottom: "10px", fontSize: "1.05rem" }}>Quá nhiều thời gian màn hình</h3>
                <p style={{ fontSize: ".87rem", color: "var(--ink-3)", lineHeight: "1.75" }}>72% phụ huynh lo ngại bé dành hơn 3 giờ/ngày
                  xem điện thoại. Họ muốn có lựa chọn thay thế đủ hấp dẫn để bé tự chọn bỏ điện thoại xuống.</p>
              </div>
              <div className="card" style={{ padding: "28px" }}>
                <div
                  style={{ width: "52px", height: "52px", background: "var(--sage-bg)", borderRadius: "var(--r-lg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", marginBottom: "18px" }}>
                  🧩</div>
                <h3 style={{ marginBottom: "10px", fontSize: "1.05rem" }}>Thiếu hướng dẫn rõ ràng</h3>
                <p style={{ fontSize: ".87rem", color: "var(--ink-3)", lineHeight: "1.75" }}>Nhiều bộ đồ chơi không đi kèm hướng dẫn cụ
                  thể. Bé bắt đầu hứng thú nhưng nhanh nản vì không biết bước tiếp theo — và ba mẹ cũng không biết giúp thế
                  nào.</p>
              </div>
              <div className="card" style={{ padding: "28px" }}>
                <div
                  style={{ width: "52px", height: "52px", background: "var(--amber-bg)", borderRadius: "var(--r-lg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", marginBottom: "18px" }}>
                  🎖</div>
                <h3 style={{ marginBottom: "10px", fontSize: "1.05rem" }}>Cần cảm giác "con chăm được"</h3>
                <p style={{ fontSize: ".87rem", color: "var(--ink-3)", lineHeight: "1.75" }}>Trẻ em cần thấy nỗ lực của mình tạo ra kết quả
                  thật. Khi một hạt giống nảy mầm nhờ bé chăm sóc, sự tự tin đó trở thành một kỷ niệm gia đình.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Story / Timeline + Beliefs */}
        <section className="section bg-cream" id="hanh-trinh">
          <div className="container">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "64px", alignItems: "start" }}>
              <div>
                <div className="sh">
                  <span className="label">Hành trình</span>
                  <h2>Từ ý tưởng đến sản phẩm thực</h2>
                </div>
                <div className="timeline">
                  <div className="timeline-item">
                    <div className="timeline-date">Tháng 9 / 2025</div>
                    <div className="timeline-title">Nảy sinh ý tưởng</div>
                    <div className="timeline-desc">Nhóm sinh viên FPT University nhận ra khoảng trống: gia đình cần một hoạt động
                      vừa có thiên nhiên thật, vừa có công nghệ lưu giữ kỷ niệm. Bắt đầu khảo sát và phỏng vấn phụ huynh.
                    </div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-date">Tháng 11 / 2025</div>
                    <div className="timeline-title">Nghiên cứu thực địa</div>
                    <div className="timeline-desc">Khảo sát 168 phụ huynh tại TP.HCM. Phỏng vấn sâu 12 gia đình để hiểu thực sự bé
                      cần gì — không chỉ ba mẹ muốn gì.</div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-date">Tháng 1 / 2026</div>
                    <div className="timeline-title">Thí điểm 90 ngày</div>
                    <div className="timeline-desc">Thử nghiệm những bộ kit trồng cây đầu tiên với các gia đình tình nguyện.
                      Chính giai đoạn này cho chúng tôi thấy điều bé thích nhất không phải chiếc chậu, mà là việc
                      mỗi ngày được quay lại xem cây đã lớn tới đâu.</div>
                  </div>
                  <div className="timeline-item">
                    <div className="timeline-date">Tháng 3 / 2026</div>
                    <div className="timeline-title">Sprouty chính thức ra mắt</div>
                    <div className="timeline-desc">Bộ kit trồng cây, Cây Kỷ Niệm số, Plant Buddy AI và workshop gia đình cùng xuất
                      hiện trong một trải nghiệm thống nhất.</div>
                  </div>
                </div>
              </div>
              <div>
                <div className="sh">
                  <span className="label">Sứ mệnh</span>
                  <h2>Những điều chúng tôi tin</h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div className="card" style={{ padding: "22px" }}>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <div style={{ fontSize: "1.8rem", flexShrink: "0", marginTop: "2px" }}>🌱</div>
                      <div>
                        <h3 style={{ fontSize: "1rem", marginBottom: "7px" }}>Thiên nhiên là lớp học đầu tiên</h3>
                        <p style={{ fontSize: ".85rem", color: "var(--ink-3)", lineHeight: "1.7" }}>Gieo hạt, tưới nước và quan sát cây lớn
                          giúp bé luyện kiên nhẫn, trách nhiệm và khả năng kể chuyện từ trải nghiệm thật.</p>
                      </div>
                    </div>
                  </div>
                  <div className="card" style={{ padding: "22px" }}>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <div style={{ fontSize: "1.8rem", flexShrink: "0", marginTop: "2px" }}>🌏</div>
                      <div>
                        <h3 style={{ fontSize: "1rem", marginBottom: "7px" }}>Gia đình trong từng chiếc lá</h3>
                        <p style={{ fontSize: ".85rem", color: "var(--ink-3)", lineHeight: "1.7" }}>Mỗi bộ kit mở ra một hoạt động chung:
                          ba mẹ cùng bé đặt tên cho cây, đọc chỉ số cảm biến và lưu lại từng chặng trên Cây Kỷ Niệm.</p>
                      </div>
                    </div>
                  </div>
                  <div className="card" style={{ padding: "22px" }}>
                    <div style={{ display: "flex", gap: "16px" }}>
                      <div style={{ fontSize: "1.8rem", flexShrink: "0", marginTop: "2px" }}>📱</div>
                      <div>
                        <h3 style={{ fontSize: "1rem", marginBottom: "7px" }}>Ít màn hình, nhiều kỷ niệm</h3>
                        <p style={{ fontSize: ".85rem", color: "var(--ink-3)", lineHeight: "1.7" }}>Sprouty dùng AI, IoT và Cây Kỷ Niệm số
                          để hỗ trợ gia đình quan sát, ghi lại và kể tiếp hành trình của cây ngoài đời.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Team */}
        <section className="section" id="doi-ngu">
          <div className="container">
            <div className="sh center">
              <span className="label">Đội ngũ</span>
              <h2>Đội ngũ xây dựng Sprouty</h2>
              <p className="lead">Nhóm sinh viên Đại học FPT TP.HCM.</p>
            </div>
            <div className="team-grid" id="teamGrid"></div>
          </div>
        </section>

        {/* Contact CTA */}
        <section className="section bg-cream" id="lien-he-ve">
          <div className="container" style={{ maxWidth: "640px", textAlign: "center" }}>
            <span className="label" style={{ justifyContent: "center" }}>Liên hệ</span>
            <h2 style={{ marginTop: "12px" }}>Bạn muốn hợp tác hoặc góp ý?</h2>
            <p style={{ color: "var(--ink-3)", margin: "14px auto 28px", fontSize: ".96rem", lineHeight: "1.75", maxWidth: "480px" }}>Chúng tôi
              luôn mở cửa với phụ huynh muốn góp ý, giáo viên muốn đưa hoạt động gieo hạt vào lớp, hay đối tác muốn tổ chức
              workshop Sprouty cùng.</p>
            <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
              <Link to="/contact" className="btn btn-primary btn-lg">Gửi lời nhắn cho Sprouty</Link>
              <Link to="/contact" className="btn btn-outline btn-lg">Liên hệ Sprouty</Link>
            </div>
          </div>
        </section>
    </>
  );
}
