import { Link } from 'react-router-dom';
import './Returns.css';

export default function Returns() {
  return (
    <>
      {/* Hero */}
      <div className="policy-hero">
        <div className="container">
          <div className="breadcrumb" style={{ color: "rgba(255,255,255,.45)", justifyContent: "center", display: "flex", gap: "6px", marginBottom: "16px" }}>
            <Link to="/" style={{ color: "rgba(255,255,255,.45)" }}>Trang chủ</Link> › <span>Chính sách đổi trả</span>
          </div>
          <span style={{ fontFamily: "var(--font-h)", fontSize: ".78rem", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.6)", display: "block", marginBottom: "12px" }}>Minh bạch & Rõ ràng</span>
          <h1>Chính sách đổi trả & Hoàn tiền</h1>
          <p className="lead" style={{ maxWidth: "520px", margin: "12px auto 0" }}>Sprouty cam kết bảo vệ quyền lợi khách hàng. Nếu không hài lòng, chúng tôi sẽ giải quyết thỏa đáng.</p>
        </div>
      </div>

      {/* Body */}
      <div className="policy-body">
        <div className="container">
          <div className="policy-layout">
            {/* TOC */}
            <aside className="policy-toc">
              <h4>Nội dung</h4>
              <a href="#tong-quan" className="toc-link active">1. Tổng quan</a>
              <a href="#dieu-kien" className="toc-link">2. Điều kiện đổi trả</a>
              <a href="#quy-trinh" className="toc-link">3. Quy trình đổi trả</a>
              <a href="#hoan-tien" className="toc-link">4. Hoàn tiền</a>
              <a href="#khong-chap-nhan" className="toc-link">5. Trường hợp không chấp nhận</a>
              <a href="#san-pham-loi" className="toc-link">6. Sản phẩm lỗi / Sai hàng</a>
              <a href="#lien-he" className="toc-link">7. Liên hệ hỗ trợ</a>
            </aside>

            {/* Content */}
            <div className="policy-content">
              <div className="last-updated">📅 Cập nhật lần cuối: 01/03/2026</div>

              <div className="policy-card green" style={{ marginBottom: "32px" }}>
                <h4>✅ Cam kết của Sprouty</h4>
                <p>Nếu sản phẩm không đúng mô tả, bị hư hỏng khi giao hoặc bạn không hài lòng vì lý do chính đáng, Sprouty cam kết xử lý đổi trả hoặc hoàn tiền đầy đủ — không rắc rối, không phán xét.</p>
              </div>

              <h2 id="tong-quan">1. Tổng quan về chính sách</h2>
              <p>Sprouty áp dụng chính sách đổi trả trong vòng <strong>7 ngày</strong> kể từ ngày nhận hàng. Chính sách này áp dụng cho tất cả sản phẩm được mua trực tiếp trên website sprouty.id.vn.</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", margin: "20px 0" }}>
                <div className="policy-card green"><h4>✅ Trong 7 ngày</h4><p>Đổi trả tự do với điều kiện hàng nguyên vẹn, chưa sử dụng</p></div>
                <div className="policy-card orange"><h4>⚠️ Sau 7 ngày</h4><p>Chỉ chấp nhận đổi trả với sản phẩm lỗi kỹ thuật từ nhà sản xuất</p></div>
              </div>

              <h2 id="dieu-kien">2. Điều kiện đổi trả</h2>
              <h3>Sản phẩm đủ điều kiện đổi trả khi:</h3>
              <ul>
                <li>Còn trong thời hạn <strong>7 ngày</strong> kể từ ngày nhận hàng (theo dấu bưu điện)</li>
                <li>Sản phẩm <strong>chưa mở hộp</strong> hoặc mới mở nhưng chưa sử dụng nguyên liệu</li>
                <li>Còn đầy đủ <strong>hộp, bao bì, thẻ hướng dẫn và tất cả phụ kiện</strong></li>
                <li>Có <strong>hóa đơn mua hàng</strong> hoặc email xác nhận đơn hàng</li>
                <li>Không có dấu hiệu bị hư hỏng do người dùng</li>
              </ul>

              <h3>Trường hợp được đổi trả ngay:</h3>
              <ul>
                <li>Giao <strong>sai sản phẩm</strong> (sai kit, sai màu sắc, sai số lượng)</li>
                <li>Sản phẩm <strong>bị hư hỏng</strong> trong quá trình vận chuyển</li>
                <li>Thiếu nguyên liệu so với danh sách trong hộp</li>
                <li>Lỗi kỹ thuật từ nhà sản xuất (kéo gãy ngay khi mở, màu vẽ bị khô cứng, v.v.)</li>
              </ul>

              <h2 id="quy-trinh">3. Quy trình đổi trả</h2>
              <div className="timeline-steps">
                <div className="tstep"><div className="tstep-num">1</div><div className="tstep-body"><div className="tstep-title">Liên hệ Sprouty</div><div className="tstep-desc">Gửi yêu cầu qua trang Liên hệ với tiêu đề "Yêu cầu đổi trả — [Mã đơn hàng]"</div></div></div>
                <div className="tstep"><div className="tstep-num">2</div><div className="tstep-body"><div className="tstep-title">Cung cấp thông tin</div><div className="tstep-desc">Gửi kèm: mã đơn hàng, lý do đổi trả và ảnh sản phẩm (nếu hàng lỗi/hư hỏng). Chúng tôi xác nhận trong vòng 4 giờ (trong giờ làm việc)</div></div></div>
                <div className="tstep"><div className="tstep-num">3</div><div className="tstep-body"><div className="tstep-title">Gửi hàng về</div><div className="tstep-desc">Sau khi được xác nhận, đóng gói sản phẩm cẩn thận và gửi về địa chỉ được đội ngũ Sprouty xác nhận. Sprouty hỗ trợ chi phí gửi hàng nếu lỗi từ phía chúng tôi</div></div></div>
                <div className="tstep"><div className="tstep-num">4</div><div className="tstep-body"><div className="tstep-title">Kiểm tra & Xử lý</div><div className="tstep-desc">Sau khi nhận hàng, chúng tôi kiểm tra trong 1–2 ngày làm việc. Nếu đủ điều kiện, tiến hành gửi hàng đổi hoặc hoàn tiền ngay</div></div></div>
                <div className="tstep"><div className="tstep-num">5</div><div className="tstep-body"><div className="tstep-title">Nhận hàng mới / Hoàn tiền</div><div className="tstep-desc">Hàng đổi sẽ được giao trong 2–3 ngày làm việc. Hoàn tiền xử lý trong 3–5 ngày làm việc</div></div></div>
              </div>

              <h2 id="hoan-tien">4. Chính sách hoàn tiền</h2>
              <div style={{ overflowX: "auto", margin: "16px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
                  <thead>
                    <tr style={{ background: "var(--parchment)" }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "var(--font-h)", fontSize: ".78rem", fontWeight: "700", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "2px solid var(--parchment-2)" }}>Phương thức thanh toán</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "var(--font-h)", fontSize: ".78rem", fontWeight: "700", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "2px solid var(--parchment-2)" }}>Thời gian hoàn tiền</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "var(--font-h)", fontSize: ".78rem", fontWeight: "700", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "2px solid var(--parchment-2)" }}>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid var(--parchment-2)" }}><td style={{ padding: "12px 16px", color: "var(--ink-2)", fontWeight: "600" }}>Chuyển khoản ngân hàng</td><td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>1–3 ngày làm việc</td><td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>Hoàn vào số TK đã dùng</td></tr>
                    <tr style={{ borderBottom: "1px solid var(--parchment-2)" }}><td style={{ padding: "12px 16px", color: "var(--ink-2)", fontWeight: "600" }}>Ví MoMo / ZaloPay</td><td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>1–2 ngày làm việc</td><td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>Hoàn về ví điện tử</td></tr>
                    <tr style={{ borderBottom: "1px solid var(--parchment-2)" }}><td style={{ padding: "12px 16px", color: "var(--ink-2)", fontWeight: "600" }}>VNPay</td><td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>3–5 ngày làm việc</td><td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>Hoàn qua cổng VNPay</td></tr>
                    <tr><td style={{ padding: "12px 16px", color: "var(--ink-2)", fontWeight: "600" }}>COD (tiền mặt)</td><td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>2–5 ngày làm việc</td><td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>Chuyển khoản theo thông tin khách cung cấp</td></tr>
                  </tbody>
                </table>
              </div>
              <p><em>Lưu ý: Thời gian trên tính từ ngày Sprouty xác nhận hoàn tiền, không phải ngày yêu cầu.</em></p>

              <h2 id="khong-chap-nhan">5. Trường hợp không được đổi trả</h2>
              <div className="policy-card red">
                <h4>❌ Không chấp nhận đổi trả trong các trường hợp sau:</h4>
                <p>Các trường hợp này đã được nêu rõ để tránh tranh cãi không đáng có:</p>
              </div>
              <ul>
                <li>Sản phẩm đã <strong>được sử dụng</strong> (hạt giống, đất trồng hoặc phụ kiện đã mở và dùng)</li>
                <li>Vượt quá thời hạn <strong>7 ngày</strong> kể từ khi nhận hàng</li>
                <li>Hộp/bao bì bị hư hỏng do người dùng không phải do vận chuyển</li>
                <li>Thiếu bộ phận do người dùng làm mất (không phải từ nhà sản xuất)</li>
                <li>Thay đổi ý kiến sau khi đã sử dụng thử</li>
                <li>Sản phẩm là <strong>gói thành viên kỹ thuật số</strong> hoặc quyền truy cập video đã được kích hoạt</li>
                <li>Sản phẩm mua từ đại lý hoặc bên thứ ba (chỉ áp dụng cho đơn mua trực tiếp từ sprouty.id.vn)</li>
              </ul>

              <h2 id="san-pham-loi">6. Sản phẩm lỗi / Giao sai hàng</h2>
              <p>Trong trường hợp nhận được <strong>sản phẩm lỗi từ nhà sản xuất</strong> hoặc <strong>giao sai hàng</strong>, chính sách ưu tiên áp dụng:</p>
              <ul>
                <li>Thời hạn khiếu nại: <strong>48 giờ</strong> kể từ khi nhận hàng</li>
                <li>Sprouty chịu toàn bộ chi phí gửi lại hàng</li>
                <li>Ưu tiên xử lý trong <strong>24 giờ làm việc</strong></li>
                <li>Khách hàng được chọn: nhận hàng đổi, hoặc hoàn tiền 100% bao gồm cả phí ship</li>
              </ul>
              <div className="policy-card blue">
                <h4>📸 Ghi nhớ quan trọng</h4>
                <p>Luôn chụp ảnh/quay video sản phẩm ngay khi mở hộp. Đây là bằng chứng quan trọng nhất để chúng tôi xử lý nhanh nhất cho bạn trong trường hợp có vấn đề.</p>
              </div>

              <h2 id="lien-he">7. Liên hệ hỗ trợ đổi trả</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", margin: "20px 0" }}>
                <div className="policy-card orange">
                  <h4>📧 Email hỗ trợ</h4>
                  <p><Link to="/contact" style={{ color: "var(--orange)", fontWeight: "700" }}>Gửi yêu cầu hỗ trợ</Link><br /><span style={{ fontSize: ".8rem", color: "var(--ink-4)" }}>Phản hồi trong 4 giờ (T2–T7, 8h–18h)</span></p>
                </div>
                <div className="policy-card green">
                  <h4>📞 Hotline</h4>
                  <p><Link to="/contact" style={{ color: "var(--green)", fontWeight: "700" }}>Trang liên hệ</Link><br /><span style={{ fontSize: ".8rem", color: "var(--ink-4)" }}>T2–T7: 8:00–18:00 | T8-CN: 9:00–15:00</span></p>
                </div>
              </div>
              <div style={{ textAlign: "center", marginTop: "40px", padding: "36px", background: "var(--cream-2)", borderRadius: "var(--r-2xl)", border: "1.5px solid var(--parchment-2)" }}>
                <div style={{ fontSize: "2.8rem", marginBottom: "12px" }}>🤝</div>
                <h3 style={{ marginBottom: "8px" }}>Chúng tôi ở đây để giúp bạn</h3>
                <p style={{ color: "var(--ink-3)", maxWidth: "420px", margin: "0 auto 24px" }}>Đội ngũ Sprouty luôn sẵn sàng hỗ trợ. Đừng ngại liên hệ — câu hỏi nào cũng có câu trả lời.</p>
                <div style={{ display: "flex", justifyContent: "center", gap: "14px", flexWrap: "wrap" }}>
                  <Link to="/contact" className="btn btn-primary btn-lg">Liên hệ ngay</Link>
                  <Link to="/faq" className="btn btn-outline btn-lg">Xem FAQ</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
