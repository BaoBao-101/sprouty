import { Link } from 'react-router-dom';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import './Footer.css';

/**
 * Site footer.
 *
 * The old one was three columns of links in 40–60% white on dark green, two of
 * which went to the same page ("Standard Kit", "Smart Kit IoT" → /shop), with
 * "Liên hệ" listed twice and three emoji circles that looked like social links
 * but only led to pages already in the menu. VIP, the blog, the returns policy
 * and the customer's own pages were not in it at all.
 *
 * Now: one invitation to start, the brand with the facts a parent asks for
 * (where, when we answer), and three groups that each go somewhere different.
 */

const GROUPS: Array<{ title: string; links: Array<[string, string]> }> = [
  {
    title: 'Khám phá',
    links: [
      ['Bộ kit trồng cây', '/shop'],
      ['Workshop cho bé', '/workshop'],
      ['VIP Garden', '/vip'],
      ['Blog chăm cây', '/blog'],
      ['Câu chuyện Sprouty', '/about'],
    ],
  },
  {
    title: 'Tài khoản',
    links: [
      ['Cây của tôi', '/my-plants'],
      ['Đơn hàng của tôi', '/account'],
      ['Workshop của tôi', '/my-workshops'],
      ['Thông tin tài khoản', '/profile'],
    ],
  },
  {
    title: 'Hỗ trợ',
    links: [
      ['Trợ lý AI Sprouty', '/ai'],
      ['Câu hỏi thường gặp', '/faq'],
      ['Chính sách đổi trả', '/returns'],
      ['Chính sách bảo mật', '/privacy'],
      ['Liên hệ', '/contact'],
    ],
  },
];

export function Footer() {
  return (
    <footer className="site-footer ft">
      <div className="container">
        {/* ── An invitation, before the directory ─────────────────────── */}
        <div className="ft-cta">
          <div className="ft-cta-text">
            <strong>Gieo hạt đầu tiên cùng bé</strong>
            <span>Chọn một bộ kit để trồng tại nhà, hoặc đưa bé đến workshop cuối tuần.</span>
          </div>
          <div className="ft-cta-actions">
            <Link to="/shop" className="btn btn-white btn-sm">
              Chọn bộ kit
              <SproutyIcon name="arrow-right" size={15} />
            </Link>
            <Link to="/workshop" className="btn btn-white-ol btn-sm">
              Đặt lịch workshop
            </Link>
          </div>
        </div>

        {/* ── Brand and directory ─────────────────────────────────────── */}
        <div className="ft-grid">
          <div className="ft-brand">
            <Link to="/" className="ft-logo" aria-label="Sprouty — trang chủ">
              <img
                src="/assets/images/logo-footer.png"
                alt="Sprouty"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  img.style.display = 'none';
                  const fallback = img.nextElementSibling as HTMLElement | null;
                  if (fallback) fallback.style.display = 'inline';
                }}
              />
              <span className="ft-logo-text" style={{ display: 'none' }}>
                Sprouty
              </span>
            </Link>
            <p className="ft-tagline">Gieo hạt thật, lưu kỷ niệm số. Mỗi mầm cây nhỏ đều có câu chuyện.</p>

            <ul className="ft-contact">
              <li>
                <SproutyIcon name="pot" size={15} />
                <span>TP. Hồ Chí Minh, Việt Nam</span>
              </li>
              <li>
                <SproutyIcon name="clock" size={15} />
                <span>Hỗ trợ Thứ 2 – Thứ 7 · 8:00–18:00</span>
              </li>
              <li>
                <SproutyIcon name="chat" size={15} />
                <Link to="/contact">Gửi câu hỏi cho Sprouty</Link>
              </li>
            </ul>
          </div>

          {GROUPS.map((group) => (
            <nav className="ft-col" key={group.title} aria-label={group.title}>
              <h4>{group.title}</h4>
              <ul>
                {group.links.map(([label, to]) => (
                  <li key={to}>
                    <Link to={to}>{label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* ── Small print ─────────────────────────────────────────────── */}
        <div className="ft-bottom">
          <span>© 2026 Sprouty · Thiết kế bởi nhóm FPT University</span>
          <span className="ft-bottom-links">
            <Link to="/privacy">Bảo mật</Link>
            <Link to="/returns">Đổi trả</Link>
            <Link to="/faq">FAQ</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
