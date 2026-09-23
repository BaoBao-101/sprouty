import { Link } from 'react-router-dom';
import './Privacy.css';

export default function Privacy() {
  return (
    <>
      <section className="privacy-hero">
        <div className="container">
          <div className="breadcrumb" style={{ color: "rgba(255,255,255,.52)", marginBottom: "16px" }}>
            <Link to="/" style={{ color: "rgba(255,255,255,.52)" }}>Trang chủ</Link> › <span>Chính sách bảo mật</span>
          </div>
          <span className="eyebrow" style={{ background: "rgba(255,255,255,.12)", color: "rgba(255,255,255,.82)", borderColor: "rgba(255,255,255,.18)" }}>Cập nhật lần cuối: 02/07/2026</span>
          <h1>Chính sách quyền riêng tư & sử dụng hình ảnh</h1>
          <p>Sprouty được xây dựng cho gia đình và trẻ em. Kỷ niệm, ảnh, video và nhật ký cây của bạn thuộc về gia đình bạn; chúng tôi chỉ lưu trữ để bạn xem lại trong Cây Kỷ Niệm.</p>
        </div>
      </section>

      <section className="section bg-cream">
        <div className="container privacy-layout">
          <aside className="privacy-toc" aria-label="Mục lục chính sách">
            <a href="#tom-tat">Tóm tắt nhanh</a>
            <a href="#so-huu">1. Quyền sở hữu</a>
            <a href="#tre-em">2. Bảo vệ trẻ em</a>
            <a href="#bao-mat">3. Bảo mật dữ liệu</a>
            <a href="#xoa">4. Quyền xóa dữ liệu</a>
            <a href="#chia-se">5. Không bán dữ liệu</a>
            <a href="#lien-he">Liên hệ</a>
          </aside>

          <main>
            <div className="privacy-callout" id="tom-tat">
              <h2>Tóm tắt nhanh cho phụ huynh</h2>
              <ul>
                <li><strong>Bạn sở hữu 100% dữ liệu:</strong> ảnh, video và nhật ký gia đình thuộc về bạn.</li>
                <li><strong>Phụ huynh quyết định:</strong> chỉ phụ huynh/người giám hộ hợp pháp nên tạo tài khoản và tải ảnh của trẻ lên.</li>
                <li><strong>Bảo mật nghiêm ngặt:</strong> dữ liệu được bảo vệ bằng hạ tầng đám mây và quy tắc truy cập chặt chẽ.</li>
                <li><strong>Quyền được xóa:</strong> khi bạn xóa, nội dung được gỡ khỏi hệ thống theo quy trình xóa dữ liệu.</li>
                <li><strong>Không bán dữ liệu:</strong> Sprouty không bán thông tin gia đình cho bên thứ ba hoặc công ty quảng cáo.</li>
              </ul>
            </div>

            <article className="privacy-card" id="so-huu">
              <h2>1. Quyền sở hữu & giấy phép giới hạn</h2>
              <p>Sprouty tin rằng kỷ niệm của gia đình thuộc về chính gia đình bạn.</p>
              <ul>
                <li>Phụ huynh/người giám hộ giữ quyền sở hữu đối với ảnh, video, nhật ký và nội dung tải lên.</li>
                <li>Bạn chỉ cấp cho Sprouty quyền lưu trữ và hiển thị nội dung để bạn và người thân có thể xem lại trong Cây Kỷ Niệm.</li>
                <li>Sprouty không dùng hình ảnh, video hoặc dữ liệu gia đình để quảng cáo hoặc huấn luyện AI nếu không có sự đồng ý rõ ràng.</li>
              </ul>
            </article>

            <article className="privacy-card" id="tre-em">
              <h2>2. Sự đồng ý của người giám hộ</h2>
              <ul>
                <li>Trẻ em dưới 16 tuổi hoặc dưới tuổi trưởng thành theo luật định không được tự tạo tài khoản.</li>
                <li>Ảnh hoặc video có thông tin/khuôn mặt trẻ em phải do người giám hộ hợp pháp tải lên hoặc cho phép chia sẻ.</li>
                <li>Phụ huynh có quyền kiểm soát nội dung nào được lưu, chia sẻ hoặc xóa khỏi tài khoản gia đình.</li>
              </ul>
            </article>

            <article className="privacy-card" id="bao-mat">
              <h2>3. An toàn dữ liệu & hạ tầng</h2>
              <ul>
                <li>Dữ liệu được lưu trên hạ tầng đám mây và được bảo vệ bằng kiểm soát truy cập.</li>
                <li>Ảnh và video được bảo vệ trong quá trình truyền tải và lưu trữ theo cấu hình bảo mật của hệ thống.</li>
                <li>Đội ngũ kỹ thuật không truy cập thư viện riêng tư của gia đình, trừ khi bạn yêu cầu hỗ trợ kỹ thuật trực tiếp.</li>
              </ul>
            </article>

            <article className="privacy-card" id="xoa">
              <h2>4. Quyền được lãng quên</h2>
              <ul>
                <li>Bạn có thể xóa ảnh, video, nhật ký hoặc yêu cầu xóa tài khoản gia đình.</li>
                <li>Sau khi xóa, nội dung được gỡ khỏi hệ thống theo quy trình xóa dữ liệu và không được dùng cho mục đích khác.</li>
                <li>Nếu cần hỗ trợ xóa tài khoản hoặc dữ liệu, hãy liên hệ đội ngũ Sprouty qua trang Liên hệ.</li>
              </ul>
            </article>

            <article className="privacy-card" id="chia-se">
              <h2>5. Không chia sẻ dữ liệu cho bên thứ ba</h2>
              <ul>
                <li>Sprouty không phân tích ảnh của trẻ để hiển thị quảng cáo.</li>
                <li>Sprouty không bán dữ liệu gia đình cho bên môi giới dữ liệu hoặc công ty quảng cáo.</li>
                <li>Thông tin chỉ được chia sẻ với đối tác hạ tầng cần thiết hoặc cơ quan có thẩm quyền khi pháp luật yêu cầu.</li>
              </ul>
            </article>

            <article className="privacy-card" id="lien-he">
              <h2>Liên hệ về quyền riêng tư</h2>
              <p>Nếu có câu hỏi về cách Sprouty bảo vệ kỷ niệm của gia đình bạn, vui lòng liên hệ đội ngũ Hỗ trợ & Bảo vệ Dữ liệu của Sprouty.</p>
              <p style={{ marginTop: "14px" }}><Link className="btn btn-primary" to="/contact">Liên hệ Sprouty</Link></p>
            </article>
          </main>
        </div>
      </section>
    </>
  );
}
