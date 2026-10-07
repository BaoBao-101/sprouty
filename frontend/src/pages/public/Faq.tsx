import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FAQ_DATA, type FaqGroupKey } from '@/data/faq';
import './Faq.css';

const GROUPS: Array<{ key: FaqGroupKey; icon: string; title: string }> = [
  { key: 'orders', icon: '📦', title: 'Đặt hàng & Thanh toán' },
  { key: 'activation', icon: '🌱', title: 'Kích hoạt & chăm cây' },
  { key: 'product', icon: '🎨', title: 'Sản phẩm & Kit' },
  { key: 'account', icon: '👤', title: 'Tài khoản & Video' },
  { key: 'ai', icon: '🤖', title: 'Trợ lý AI' },
  { key: 'workshop', icon: '🏫', title: 'Workshop' },
  { key: 'returns', icon: '↩', title: 'Đổi trả & Hoàn tiền' },
];

export default function Faq() {
  const [query, setQuery] = useState('');
  /** Only one question is open at a time, identified by "group:index". */
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState<FaqGroupKey>('orders');
  const groupRefs = useRef<Partial<Record<FaqGroupKey, HTMLDivElement | null>>>({});

  const needle = query.trim().toLowerCase();

  const visible = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        entries: FAQ_DATA[group.key].filter(
          (entry) =>
            !needle ||
            entry.q.toLowerCase().includes(needle) ||
            entry.a.toLowerCase().includes(needle),
        ),
      })).filter((group) => group.entries.length > 0),
    [needle],
  );

  const nothingFound = needle !== '' && visible.length === 0;

  function scrollToGroup(key: FaqGroupKey) {
    setActiveNav(key);
    groupRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <>
      <div className="faq-hero">
        <div className="container" style={{ textAlign: 'center' }}>
          <div className="breadcrumb faq-hero-crumb">
            <Link to="/">Trang chủ</Link> › <span>Câu hỏi thường gặp</span>
          </div>
          <span className="faq-hero-eyebrow">Hỗ trợ khách hàng</span>
          <h1>Câu hỏi thường gặp</h1>
          <p className="lead" style={{ maxWidth: 500, margin: '12px auto 0' }}>
            Tìm câu trả lời nhanh cho mọi thắc mắc về sản phẩm, đặt hàng và Cây Kỷ Niệm.
          </p>
          <div className="faq-search-wrap">
            <span className="faq-search-icon">🔍</span>
            <input
              className="faq-search"
              type="text"
              placeholder="Tìm kiếm câu hỏi... (VD: giao hàng, đổi trả, thanh toán)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="faq-body">
        <div className="container">
          <div className="faq-layout">
            <aside className="faq-nav">
              <h4>Danh mục</h4>
              {GROUPS.map((group) => (
                <button
                  key={group.key}
                  className={`faq-nav-item${activeNav === group.key ? ' active' : ''}`}
                  onClick={() => scrollToGroup(group.key)}
                >
                  {group.icon} {group.title}
                </button>
              ))}
            </aside>

            <div>
              {visible.map((group) => (
                <div
                  className="faq-group"
                  key={group.key}
                  ref={(el) => {
                    groupRefs.current[group.key] = el;
                  }}
                >
                  <div className="faq-group-title">
                    <div className="faq-group-icon">{group.icon}</div>
                    {group.title}
                  </div>

                  {group.entries.map((entry, i) => {
                    const key = `${group.key}:${i}`;
                    return (
                      <div className={`faq-item${openKey === key ? ' open' : ''}`} key={entry.q}>
                        <div
                          className="faq-q"
                          onClick={() => setOpenKey(openKey === key ? null : key)}
                        >
                          <span>{entry.q}</span>
                          <span className="faq-chevron">›</span>
                        </div>
                        {/* Answers are authored in src/data/faq.ts and contain a
                            little inline HTML; they are never user input. */}
                        <div className="faq-a" dangerouslySetInnerHTML={{ __html: entry.a }} />
                      </div>
                    );
                  })}
                </div>
              ))}

              {nothingFound && (
                <div className="faq-empty">
                  <div className="faq-empty-icon">🔍</div>
                  <p>
                    Không tìm thấy kết quả cho &ldquo;{query.trim()}&rdquo;.
                    <br />
                    Hãy thử từ khóa khác hoặc <Link to="/contact">liên hệ với chúng tôi</Link>.
                  </p>
                </div>
              )}

              {!nothingFound && (
                <div className="contact-cta">
                  <div style={{ fontSize: '3rem', marginBottom: 14 }}>💬</div>
                  <h3>Chưa tìm thấy câu trả lời?</h3>
                  <p>
                    Đội ngũ hỗ trợ Sprouty luôn sẵn sàng giải đáp mọi thắc mắc của bạn trong vòng 24 giờ.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <Link to="/contact" className="btn btn-white btn-lg">
                      📧 Liên hệ ngay
                    </Link>
                    <Link to="/ai" className="btn btn-white-ol btn-lg">
                      🤖 Hỏi AI Sprouty
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
