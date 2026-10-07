import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-logo-wrap">
              <img
                className="footer-logo"
                src="/assets/images/logo-footer.png"
                alt="Sprouty"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  img.style.display = 'none';
                  const fallback = img.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <span className="footer-logo-fallback" style={{ display: 'none' }}>
                <span className="footer-logo-fallback-mark">🌱</span>
                <span className="footer-logo-fallback-name">Sprouty</span>
              </span>
            </div>

            <p className="footer-desc">
              Gieo hạt thật, lưu kỷ niệm số.
              <br />
              Mỗi mầm cây nhỏ đều có câu chuyện.
            </p>

            <div className="footer-socials">
              <Link className="footer-social" title="Liên hệ Sprouty" aria-label="Liên hệ Sprouty" to="/contact">
                🌱
              </Link>
              <Link className="footer-social" title="Workshop Sprouty" aria-label="Workshop Sprouty" to="/workshop">
                🎨
              </Link>
              <Link className="footer-social" title="Trợ lý AI Sprouty" aria-label="Trợ lý AI Sprouty" to="/ai">
                🤖
              </Link>
              <Link className="footer-social" title="Cây Kỷ Niệm" aria-label="Cây Kỷ Niệm" to="/my-plants">
                <img src="/assets/images/sprouty-icons/MyTree.png" alt="Cây Kỷ Niệm" className="footer-social-icon" />
              </Link>
            </div>
          </div>

          <div className="footer-col">
            <h4>Sản phẩm</h4>
            <Link to="/shop">Standard Kit</Link>
            <Link to="/shop">Smart Kit IoT</Link>
            <Link to="/workshop">Workshop trồng cây</Link>
          </div>

          <div className="footer-col">
            <h4>Hỗ trợ</h4>
            <Link to="/ai">Trợ lý AI</Link>
            <Link to="/faq">Câu hỏi thường gặp</Link>
            <Link to="/contact">Liên hệ</Link>
            <Link to="/privacy">Chính sách bảo mật</Link>
          </div>

          <div className="footer-col">
            <h4>Về chúng tôi</h4>
            <Link to="/about">Câu chuyện Sprouty</Link>
            <Link to="/about#doi-ngu">Đội ngũ</Link>
            <Link to="/contact">Liên hệ</Link>
          </div>
        </div>

        <hr className="footer-divider" />

        <div className="footer-bottom">
          <span>© 2026 Sprouty · TP. Hồ Chí Minh, Việt Nam 🇻🇳</span>
          <span>Thiết kế với ❤️ bởi nhóm FPT University</span>
        </div>
      </div>
    </footer>
  );
}
