import { Link } from 'react-router-dom';
import './Returns.css';

/**
 * Refund policy for a digital product.
 *
 * The previous version was written for a shipped box: seven days from delivery,
 * return the goods in their packaging, damage in transit, COD refunds. None of
 * that exists now — nothing is posted, and what the customer buys is an
 * activation code.
 *
 * So the line that decides everything here is whether the code has been
 * redeemed. An unused code is a product that was never delivered in any
 * meaningful sense and is refunded without argument; a redeemed one has been
 * consumed, the same way an opened seed packet used to be. Refunds for our own
 * faults are not time-limited, because a fault that stops the customer using
 * what they paid for is our problem whenever they find it.
 */
export default function Returns() {
  return (
    <>
      {/* Hero */}
      <div className="policy-hero">
        <div className="container">
          <div className="breadcrumb" style={{ color: "rgba(255,255,255,.45)", justifyContent: "center", display: "flex", gap: "6px", marginBottom: "16px" }}>
            <Link to="/" style={{ color: "rgba(255,255,255,.45)" }}>Trang chủ</Link> › <span>Chính sách hoàn tiền</span>
          </div>
          <span style={{ fontFamily: "var(--font-h)", fontSize: ".78rem", fontWeight: "700", letterSpacing: ".12em", textTransform: "uppercase", color: "rgba(255,255,255,.6)", display: "block", marginBottom: "12px" }}>Minh bạch & Rõ ràng</span>
          <h1>Chính sách hoàn tiền</h1>
          <p className="lead" style={{ maxWidth: "560px", margin: "12px auto 0" }}>
            Sprouty bán sản phẩm số — không giao hàng, không đổi trả hàng hoá. Điều quyết định là
            bạn đã dùng mã kích hoạt hay chưa.
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="policy-body">
        <div className="container">
          <div className="policy-layout">
            {/* TOC */}
            <aside className="policy-toc">
              <h4>Nội dung</h4>
              <a href="#tong-quan" className="toc-link active">1. Bạn đang mua gì</a>
              <a href="#dieu-kien" className="toc-link">2. Khi nào được hoàn tiền</a>
              <a href="#khong-chap-nhan" className="toc-link">3. Khi nào không hoàn tiền</a>
              <a href="#quy-trinh" className="toc-link">4. Quy trình yêu cầu</a>
              <a href="#hoan-tien" className="toc-link">5. Thời gian hoàn tiền</a>
              <a href="#loi-he-thong" className="toc-link">6. Lỗi từ phía Sprouty</a>
              <a href="#workshop" className="toc-link">7. Workshop & gói VIP</a>
              <a href="#lien-he" className="toc-link">8. Liên hệ hỗ trợ</a>
            </aside>

            {/* Content */}
            <div className="policy-content">
              <div className="last-updated">📅 Cập nhật lần cuối: 07/10/2026</div>

              <div className="policy-card green" style={{ marginBottom: "32px" }}>
                <h4>✅ Cam kết của Sprouty</h4>
                <p>
                  <strong>Mã chưa kích hoạt — hoàn tiền 100%, không hỏi lý do</strong>, trong vòng 7
                  ngày kể từ khi thanh toán. Nếu lỗi thuộc về hệ thống của chúng tôi, bạn được hoàn
                  tiền bất kể đã dùng hay chưa và không giới hạn thời gian.
                </p>
              </div>

              <h2 id="tong-quan">1. Bạn đang mua gì</h2>
              <p>
                Sprouty <strong>không giao sản phẩm vật lý</strong>. Khi bạn thanh toán, hệ thống
                phát ra một <strong>mã kích hoạt</strong>. Nhập mã đó ở mục{' '}
                <Link to="/my-plants">Cây của tôi</Link> là bạn bắt đầu nuôi một cây mô phỏng cùng
                bộ thiết bị IoT ảo trên web.
              </p>
              <p>
                Vì vậy ở đây không có khái niệm "gửi hàng về", "hư hỏng khi vận chuyển" hay "còn
                nguyên hộp". Thay vào đó, ranh giới duy nhất là: <strong>mã đã được kích hoạt hay
                chưa</strong>.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", margin: "20px 0" }}>
                <div className="policy-card green">
                  <h4>✅ Mã chưa kích hoạt</h4>
                  <p>Xem như chưa nhận sản phẩm. Hoàn tiền 100% trong 7 ngày, không cần nêu lý do.</p>
                </div>
                <div className="policy-card orange">
                  <h4>⚠️ Mã đã kích hoạt</h4>
                  <p>Sản phẩm đã được sử dụng. Chỉ hoàn tiền nếu lỗi thuộc về Sprouty (xem mục 6).</p>
                </div>
              </div>
              <p style={{ fontSize: ".9rem", color: "var(--ink-4)" }}>
                <em>
                  Bạn luôn kiểm tra được mã của mình đã dùng hay chưa trong{' '}
                  <Link to="/account">Đơn hàng của tôi</Link>.
                </em>
              </p>

              <h2 id="dieu-kien">2. Khi nào được hoàn tiền</h2>
              <h3>Hoàn tiền tự do (không cần lý do):</h3>
              <ul>
                <li>Trong vòng <strong>7 ngày</strong> kể từ khi thanh toán thành công</li>
                <li>Mã kích hoạt <strong>chưa được sử dụng</strong></li>
                <li>Đơn hàng mua trực tiếp trên sprouty.id.vn</li>
              </ul>

              <h3>Hoàn tiền không giới hạn thời gian (lỗi từ chúng tôi):</h3>
              <ul>
                <li><strong>Thanh toán trùng</strong> — bị trừ tiền hai lần cho cùng một đơn</li>
                <li><strong>Đã trừ tiền nhưng không nhận được mã</strong> kích hoạt</li>
                <li><strong>Mã không kích hoạt được</strong> dù đã nhập đúng</li>
                <li><strong>Sai sản phẩm</strong> — mã mở ra giống cây khác với mô tả bạn đã mua</li>
                <li><strong>Lỗi hệ thống kéo dài</strong> khiến bạn không chăm cây được (xem mục 6)</li>
              </ul>

              <h2 id="khong-chap-nhan">3. Khi nào không hoàn tiền</h2>
              <div className="policy-card red">
                <h4>❌ Các trường hợp không được hoàn tiền</h4>
                <p>Nêu rõ từ đầu để không ai mất thời gian tranh luận về sau:</p>
              </div>
              <ul>
                <li>
                  <strong>Mã đã được kích hoạt</strong> và hệ thống hoạt động bình thường — đổi ý
                  sau khi đã trồng cây không thuộc diện hoàn tiền
                </li>
                <li>Quá <strong>7 ngày</strong> kể từ khi thanh toán, với mã chưa dùng và không có lỗi hệ thống</li>
                <li>Cây phát triển chậm hoặc héo <strong>do không chăm sóc</strong> — đây là cơ chế của trò chơi, không phải lỗi sản phẩm</li>
                <li>Không hài lòng vì <strong>chưa đọc kỹ mô tả</strong> giống cây hoặc bản Standard/Smart trước khi mua</li>
                <li>Tài khoản bị <strong>khoá do vi phạm</strong> điều khoản sử dụng</li>
                <li>Mã nhận được từ <strong>bên thứ ba</strong> hoặc tặng lại, không mua trực tiếp từ sprouty.id.vn</li>
                <li>Mã đã dùng để nhận <strong>ưu đãi workshop miễn phí</strong> và suất đó đã diễn ra</li>
              </ul>
              <div className="policy-card blue">
                <h4>💡 Chưa chắc có hợp không?</h4>
                <p>
                  Cứ <Link to="/contact" style={{ fontWeight: 700 }}>liên hệ</Link> và kể rõ chuyện
                  gì đã xảy ra. Chúng tôi xử lý theo tinh thần thiện chí — nếu bạn mất tiền mà không
                  nhận được thứ mình mua, chúng tôi sẽ tìm cách giải quyết.
                </p>
              </div>

              <h2 id="quy-trinh">4. Quy trình yêu cầu hoàn tiền</h2>
              <p>Không có bước gửi hàng về — toàn bộ xử lý trực tuyến.</p>
              <div className="timeline-steps">
                <div className="tstep">
                  <div className="tstep-num">1</div>
                  <div className="tstep-body">
                    <div className="tstep-title">Gửi yêu cầu</div>
                    <div className="tstep-desc">Qua trang Liên hệ, tiêu đề "Yêu cầu hoàn tiền — [Mã đơn hàng]"</div>
                  </div>
                </div>
                <div className="tstep">
                  <div className="tstep-num">2</div>
                  <div className="tstep-body">
                    <div className="tstep-title">Cung cấp thông tin</div>
                    <div className="tstep-desc">Mã đơn hàng, lý do, và ảnh chụp màn hình nếu gặp lỗi. Chúng tôi phản hồi trong 4 giờ làm việc</div>
                  </div>
                </div>
                <div className="tstep">
                  <div className="tstep-num">3</div>
                  <div className="tstep-body">
                    <div className="tstep-title">Kiểm tra trạng thái mã</div>
                    <div className="tstep-desc">Hệ thống ghi lại chính xác thời điểm mã được kích hoạt, nên bước này chỉ mất vài phút — không cần bạn chứng minh gì thêm</div>
                  </div>
                </div>
                <div className="tstep">
                  <div className="tstep-num">4</div>
                  <div className="tstep-body">
                    <div className="tstep-title">Vô hiệu hoá mã</div>
                    <div className="tstep-desc">Mã chưa dùng sẽ bị thu hồi để tránh dùng lại sau khi đã hoàn tiền</div>
                  </div>
                </div>
                <div className="tstep">
                  <div className="tstep-num">5</div>
                  <div className="tstep-body">
                    <div className="tstep-title">Chuyển tiền lại</div>
                    <div className="tstep-desc">Hoàn về đúng tài khoản bạn đã chuyển khoản, trong 1–3 ngày làm việc</div>
                  </div>
                </div>
              </div>

              <h2 id="hoan-tien">5. Thời gian hoàn tiền</h2>
              <div style={{ overflowX: "auto", margin: "16px 0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".9rem" }}>
                  <thead>
                    <tr style={{ background: "var(--parchment)" }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "var(--font-h)", fontSize: ".78rem", fontWeight: "700", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "2px solid var(--parchment-2)" }}>Trường hợp</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "var(--font-h)", fontSize: ".78rem", fontWeight: "700", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "2px solid var(--parchment-2)" }}>Thời gian</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontFamily: "var(--font-h)", fontSize: ".78rem", fontWeight: "700", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".05em", borderBottom: "2px solid var(--parchment-2)" }}>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: "1px solid var(--parchment-2)" }}>
                      <td style={{ padding: "12px 16px", color: "var(--ink-2)", fontWeight: "600" }}>Mã chưa kích hoạt</td>
                      <td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>1–3 ngày làm việc</td>
                      <td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>Hoàn 100% về tài khoản đã chuyển</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--parchment-2)" }}>
                      <td style={{ padding: "12px 16px", color: "var(--ink-2)", fontWeight: "600" }}>Thanh toán trùng</td>
                      <td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>1–2 ngày làm việc</td>
                      <td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>Ưu tiên xử lý, hoàn phần dư</td>
                    </tr>
                    <tr style={{ borderBottom: "1px solid var(--parchment-2)" }}>
                      <td style={{ padding: "12px 16px", color: "var(--ink-2)", fontWeight: "600" }}>Lỗi hệ thống</td>
                      <td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>1–3 ngày làm việc</td>
                      <td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>Hoàn 100%, không trừ khoản nào</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "12px 16px", color: "var(--ink-2)", fontWeight: "600" }}>Huỷ workshop trước 24h</td>
                      <td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>2–5 ngày làm việc</td>
                      <td style={{ padding: "12px 16px", color: "var(--ink-3)" }}>Suất miễn phí được trả lại ngay vào tài khoản</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p><em>Thời gian tính từ lúc Sprouty xác nhận hoàn tiền, không phải lúc bạn gửi yêu cầu.</em></p>

              <h2 id="loi-he-thong">6. Lỗi từ phía Sprouty</h2>
              <p>
                Nếu hệ thống của chúng tôi khiến bạn không dùng được thứ đã mua — mã không kích hoạt
                được, cây không lưu tiến độ, mất dữ liệu chăm cây — thì đó là lỗi của chúng tôi, và
                xử lý theo hướng có lợi cho bạn:
              </p>
              <ul>
                <li>Không giới hạn thời gian khiếu nại — lúc nào phát hiện cũng được</li>
                <li>Ưu tiên xử lý trong <strong>24 giờ làm việc</strong></li>
                <li>Chúng tôi sửa lỗi và khôi phục tiến độ cây trước; nếu không khôi phục được, <strong>hoàn tiền 100%</strong></li>
                <li>Bạn được chọn: nhận mã kích hoạt mới, hoặc hoàn tiền</li>
              </ul>
              <div className="policy-card blue">
                <h4>📸 Giúp chúng tôi xử lý nhanh hơn</h4>
                <p>
                  Chụp màn hình thông báo lỗi kèm mã đơn hàng. Hệ thống có lưu nhật ký, nhưng ảnh
                  của bạn giúp chúng tôi tìm đúng chỗ ngay thay vì dò tìm.
                </p>
              </div>

              <h2 id="workshop">7. Workshop & gói VIP</h2>
              <h3>Workshop</h3>
              <ul>
                <li>Huỷ <strong>trước 24 giờ</strong> so với giờ bắt đầu: hoàn tiền 100%</li>
                <li>Huỷ <strong>trong vòng 24 giờ</strong> hoặc vắng mặt: không hoàn tiền, nhưng có thể chuyển suất cho buổi khác nếu báo trước</li>
                <li>Sprouty huỷ buổi học: hoàn tiền 100% hoặc chuyển sang buổi bạn chọn</li>
                <li>
                  Suất miễn phí từ ưu đãi <strong>mua 3 tặng 1</strong>: huỷ trước 24 giờ thì suất
                  được trả lại tài khoản để dùng cho buổi khác
                </li>
              </ul>
              <h3>Gói VIP Garden</h3>
              <ul>
                <li>Chưa kích hoạt quyền lợi VIP nào: hoàn tiền 100% trong 7 ngày</li>
                <li>Đã sử dụng quyền lợi VIP: không hoàn tiền cho kỳ đang dùng</li>
                <li>Bạn có thể ngừng gia hạn bất cứ lúc nào; quyền lợi giữ đến hết kỳ đã trả</li>
              </ul>

              <h2 id="lien-he">8. Liên hệ hỗ trợ</h2>
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
