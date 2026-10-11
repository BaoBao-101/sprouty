import { Link } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { Lightbox } from '@/components/Lightbox';
import { WorkshopRegisterModal } from '@/components/WorkshopRegisterModal';
import { FAQS, LB_IMAGES } from '@/data/workshop';
import { API } from '@/services/api';
import { formatPrice } from '@/types/product';
import { SproutyIcon, type IconName as SproutyIconName } from '@/components/icons/SproutyIcon';
import { formatWorkshopWhen, type PublicWorkshop } from '@/types/workshop';
import { useAuth } from '@/contexts/AuthContext';
import { LoginRequiredDialog, type LoginGate } from '@/components/LoginRequiredDialog';
import './Workshop.css';

/** What happens in a session, in the order it happens. */
const STEPS: Array<{ icon: SproutyIconName; title: string; text: string }> = [
  { icon: 'sparkle', title: 'Vẽ chậu', text: 'Bé tự trang trí chậu cây của riêng mình với màu vẽ an toàn.' },
  { icon: 'seed', title: 'Gieo hạt thật', text: 'Cô hướng dẫn trộn đất, gieo hạt và tưới nước lần đầu.' },
  { icon: 'sprout', title: 'Kích hoạt Plant Buddy', text: 'Cây được “sinh ra” trên Sprouty để bé chăm tiếp ở nhà.' },
  { icon: 'pot', title: 'Mang cây về nhà', text: 'Bé mang chậu đã gieo hạt về, kèm chứng nhận và ảnh kỷ niệm.' },
];

/** Paid for once, nothing to bring. */
const INCLUDED = [
  'Bộ kit, hạt giống, đất trồng và màu vẽ',
  'Hướng dẫn viên kèm nhóm nhỏ 8–12 bé',
  'Chứng nhận hoàn thành và ảnh kỷ niệm',
  'Chậu cây đã gieo hạt mang về nhà',
  'Ba mẹ được ngồi cùng bé suốt buổi',
];

/** How booking actually works now: online, paid by QR, checked in by ticket. */
const HOW: Array<{ icon: SproutyIconName; title: string; text: string }> = [
  { icon: 'ticket', title: 'Chọn buổi và số bé', text: 'Đăng ký cho một hoặc nhiều bé trong cùng một lần.' },
  { icon: 'check', title: 'Thanh toán bằng QR', text: 'Chuyển khoản là xác nhận ngay — hoặc dùng vé miễn phí nếu bạn có.' },
  { icon: 'camera', title: 'Đưa bé đến với vé QR', text: 'Vé nằm trong “Workshop của tôi”; nhân viên quét vé khi bé tới.' },
];

/** The photos shown on the page; the lightbox still has all of them. */
const MOSAIC = [0, 1, 3, 7, 9];

export default function Workshop() {
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // The schedule used to be a hardcoded array in data/workshop.ts, so nothing
  // an admin created ever reached this page and the seat counts were fiction.
  const [workshops, setWorkshops] = useState<PublicWorkshop[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [booking, setBooking] = useState<PublicWorkshop | null>(null);
  const { isLoggedIn } = useAuth();

  /**
   * Booking needs an account, so a signed-out visitor goes to sign in first
   * rather than filling in a form the server will refuse. `next` brings them
   * back to this page afterwards.
   *
   * The seat they picked is not carried across: by the time they return it may
   * have been taken, and reopening the dialog on a full session would be worse
   * than letting them choose again from a current list.
   */
  const [gate, setGate] = useState<LoginGate | null>(null);

  function startBooking(workshop: PublicWorkshop) {
    if (!isLoggedIn) {
      setGate({
        action: 'đăng ký workshop',
        icon: 'ticket',
        reassurance: 'Chỗ chỉ được giữ sau khi bạn đăng ký xong.',
        next: '/workshop',
      });
      return;
    }
    setBooking(workshop);
  }

  const load = useCallback(() => {
    setState('loading');
    API.workshops
      .list()
      .then((data: any) => {
        setWorkshops(data.workshops || []);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  useEffect(load, [load]);

  // Only sessions that have not happened yet can be booked.
  const upcoming = workshops.filter((w) => w.upcoming);
  const next = upcoming.find((w) => !w.isFull) || upcoming[0] || null;
  const prices = upcoming.map((w) => w.price).filter((p) => p > 0);
  const fromPrice = prices.length ? Math.min(...prices) : null;

  // A dozen sessions turned this section into a wall of cards several screens
  // tall, pushing the rest of the page out of reach. Show a first batch and let
  // people ask for the rest — everything is already loaded, so no extra request.
  const PAGE = 6;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  const shown = upcoming.slice(0, visibleCount);
  const remaining = upcoming.length - shown.length;

  const navigate = (step: number) =>
    setLightbox((i) => (i === null ? i : (i + step + LB_IMAGES.length) % LB_IMAGES.length));

  // The four numbers a parent checks first. They sat as translucent boxes on
  // top of the banner photo and were hard to read against it; they are a
  // solid strip under the banner now, with the price taken from the real
  // schedule instead of a hard-coded "150K".
  const FACTS: Array<{ icon: SproutyIconName; value: string; label: string }> = [
    { icon: 'heart', value: '8–12 bé', label: 'nhóm nhỏ mỗi buổi' },
    { icon: 'clock', value: '2–3 giờ', label: 'mỗi buổi học' },
    { icon: 'sprout', value: '4–12 tuổi', label: 'độ tuổi phù hợp' },
    fromPrice
      ? { icon: 'ticket', value: `Từ ${formatPrice(fromPrice)}`, label: 'mỗi bé, đủ nguyên liệu' }
      : { icon: 'pot', value: '100%', label: 'bé tự tay thực hành' },
  ];

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="ws-hero ws-hero-v2">
        <div className="container ws-hero-grid">
          <div className="ws-hero-copy">
            <div className="breadcrumb ws-crumb">
              <Link to="/">Trang chủ</Link> › Workshop
            </div>
            <span className="ws-kicker">
              <SproutyIcon name="pot" size={15} /> Học trực tiếp · TP. Hồ Chí Minh
            </span>
            <h1>
              Workshop trồng cây
              <span>cho bé và gia đình</span>
            </h1>
            <p>
              Một buổi chiều cuối tuần: bé vẽ chậu, gieo hạt thật, kích hoạt Plant Buddy và mang cây về
              nhà chăm tiếp.
            </p>
            <div className="ws-hero-actions">
              <a href="#lich" className="btn btn-white btn-lg">
                Xem lịch & đăng ký
                <SproutyIcon name="arrow-right" size={18} />
              </a>
              <a href="#buoi-hoc" className="btn btn-white-ol btn-lg">
                Một buổi gồm gì?
              </a>
            </div>
          </div>

          {/* The soonest session with seats, so the page answers "khi nào?"
              before anyone scrolls. */}
          {next && (
            <aside className="ws-next" aria-label="Buổi gần nhất">
              <span className="ws-next-tag">Buổi gần nhất</span>
              <strong className="ws-next-title">{next.title}</strong>
              <ul>
                <li>
                  <SproutyIcon name="clock" size={16} /> {formatWorkshopWhen(next)}
                </li>
                <li>
                  <SproutyIcon name="pot" size={16} /> {next.location}
                </li>
                <li className={next.isFull ? 'is-full' : next.seatsLeft <= 3 ? 'is-low' : ''}>
                  <SproutyIcon name="heart" size={16} />{' '}
                  {next.isFull ? 'Đã kín chỗ' : `Còn ${next.seatsLeft}/${next.capacity} chỗ`}
                </li>
              </ul>
              <div className="ws-next-foot">
                <span className="ws-next-price">
                  {next.price > 0 ? formatPrice(next.price) : 'Miễn phí'}
                  <em>/ bé</em>
                </span>
                <button className="btn btn-primary" disabled={next.isFull} onClick={() => startBooking(next)}>
                  {next.isFull ? 'Hết chỗ' : 'Đăng ký'}
                </button>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ── Facts strip ──────────────────────────────────────────────── */}
      <div className="container">
        <ul className="ws-facts">
          {FACTS.map((f) => (
            <li key={f.label}>
              <span className="ws-fact-icon">
                <SproutyIcon name={f.icon} size={22} />
              </span>
              <span>
                <strong>{f.value}</strong>
                <em>{f.label}</em>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Schedule ─────────────────────────────────────────────────── */}
      <section className="section ws-section" id="lich">
        <div className="container">
          <div className="ws-head">
            <div>
              <span className="label">Lịch sắp tới</span>
              <h2>Chọn buổi cho bé</h2>
            </div>
            {state === 'ready' && upcoming.length > 0 && (
              <span className="ws-head-note">
                {upcoming.length} buổi đang mở · số chỗ có hạn
              </span>
            )}
          </div>

          {state === 'loading' && <div className="ws-schedule-msg">Đang tải lịch workshop…</div>}
          {state === 'error' && (
            <div className="ws-schedule-msg error">
              Không tải được lịch workshop.{' '}
              <button className="link-btn" onClick={load}>
                Thử lại
              </button>
            </div>
          )}
          {state === 'ready' && upcoming.length === 0 && (
            <div className="ws-schedule-msg">
              Hiện chưa có buổi nào mở đăng ký. Theo dõi trang này để biết lịch mới nhé!
            </div>
          )}

          <div className="ws-schedule">
            {shown.map((w) => {
              const pct = w.capacity > 0 ? Math.round((w.seatsTaken / w.capacity) * 100) : 0;
              return (
                <div className="schedule-card" key={w.id}>
                  <div className="schedule-photo">
                    {w.imageUrl ? (
                      <img src={w.imageUrl} alt={w.title} loading="lazy" />
                    ) : (
                      <div className="schedule-photo-empty">
                        <SproutyIcon name="ticket" size={30} />
                      </div>
                    )}
                    {!w.isFull && w.seatsLeft <= 3 && <span className="schedule-flag">Sắp hết chỗ</span>}
                  </div>

                  <div className="schedule-header">
                    <div className="schedule-title">{w.title}</div>
                  </div>

                  <div className="schedule-body">
                    {/* The four things a parent decides on, each on its own
                        line with its own label. */}
                    <dl className="schedule-facts">
                      <div>
                        <dt>
                          <SproutyIcon name="clock" size={16} /> Thời gian
                        </dt>
                        <dd>{formatWorkshopWhen(w)}</dd>
                      </div>
                      <div>
                        <dt>
                          <SproutyIcon name="pot" size={16} /> Địa điểm
                        </dt>
                        <dd>{w.location}</dd>
                      </div>
                      {w.ageRange && (
                        <div>
                          <dt>
                            <SproutyIcon name="heart" size={16} /> Phù hợp
                          </dt>
                          <dd>{w.ageRange}</dd>
                        </div>
                      )}
                    </dl>

                    {w.description && <p className="schedule-detail">{w.description}</p>}

                    <div className="schedule-seats">
                      <div className="schedule-bar">
                        <div
                          className="schedule-bar-fill"
                          style={{
                            width: `${pct}%`,
                            background: pct > 80 ? 'var(--rose)' : 'var(--green)',
                          }}
                        />
                      </div>
                      <div className="schedule-taken">
                        {w.isFull ? (
                          <strong className="is-full">Đã kín chỗ</strong>
                        ) : (
                          <>
                            <strong>Còn {w.seatsLeft} chỗ</strong> trên tổng {w.capacity}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="schedule-footer">
                      <span className="workshop-price">
                        {w.price > 0 ? formatPrice(w.price) : 'Miễn phí'}
                        <em>mỗi bé</em>
                      </span>
                      <button className="btn btn-primary" disabled={w.isFull} onClick={() => startBooking(w)}>
                        {w.isFull ? 'Hết chỗ' : 'Đăng ký cho bé'}
                        {!w.isFull && <SproutyIcon name="arrow-right" size={17} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {state === 'ready' && upcoming.length > PAGE && (
            <div className="ws-more">
              <span className="ws-more-count">
                Đang xem {shown.length}/{upcoming.length} buổi
              </span>
              {remaining > 0 ? (
                <button className="btn btn-outline" onClick={() => setVisibleCount((n) => n + PAGE)}>
                  Xem thêm {Math.min(PAGE, remaining)} buổi ↓
                </button>
              ) : (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setVisibleCount(PAGE);
                    document.getElementById('lich')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Thu gọn ↑
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── What a session is ─────────────────────────────────────────
          One section instead of three: the old "about", the emoji card that
          repeated the hero numbers, and the "quyền lợi" box under the form. */}
      <section className="section ws-section ws-session" id="buoi-hoc">
        <div className="container">
          <div className="ws-head">
            <div>
              <span className="label">Một buổi workshop</span>
              <h2>Bé tự làm, bé tự hào</h2>
            </div>
          </div>

          <div className="ws-session-grid">
            <ol className="ws-steps">
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="ws-step-icon">
                    <SproutyIcon name={s.icon} size={22} />
                    <em>{i + 1}</em>
                  </span>
                  <div>
                    <strong>{s.title}</strong>
                    <p>{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="ws-included">
              <h3>
                <SproutyIcon name="gift" size={20} /> Đã gồm trong học phí
              </h3>
              <ul>
                {INCLUDED.map((item) => (
                  <li key={item}>
                    <span className="ws-check">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
              <p className="ws-included-note">Không cần mang theo gì — mọi thứ đã chuẩn bị sẵn.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Photos: five on the page, all ten in the lightbox ───────── */}
      <section className="section ws-section" id="anh">
        <div className="container">
          <div className="ws-head">
            <div>
              <span className="label">Không khí Sprouty</span>
              <h2>Workshop diễn ra thế này</h2>
            </div>
            <button type="button" className="btn btn-outline" onClick={() => setLightbox(0)}>
              <SproutyIcon name="camera" size={17} /> Xem tất cả {LB_IMAGES.length} ảnh
            </button>
          </div>

          <div className="ws-mosaic">
            {MOSAIC.map((index, i) => (
              <button
                type="button"
                key={index}
                className={`ws-mosaic-item${i === 0 ? ' is-big' : ''}`}
                onClick={() => setLightbox(index)}
                aria-label={LB_IMAGES[index].caption}
              >
                <img src={LB_IMAGES[index].src} alt="" loading="lazy" />
                <span className="ws-mosaic-caption">{LB_IMAGES[index].caption}</span>
              </button>
            ))}
          </div>
        </div>
        <Lightbox images={LB_IMAGES} index={lightbox} onClose={() => setLightbox(null)} onNavigate={navigate} />
      </section>

      {/* ── How booking works ────────────────────────────────────────── */}
      <section className="section ws-section ws-how-wrap">
        <div className="container">
          <div className="ws-head">
            <div>
              <span className="label">Đăng ký thế nào</span>
              <h2>Ba bước, làm ngay trên web</h2>
            </div>
          </div>
          <ol className="ws-how">
            {HOW.map((h, i) => (
              <li key={h.title}>
                <span className="ws-how-n">{i + 1}</span>
                <span className="ws-how-icon">
                  <SproutyIcon name={h.icon} size={22} />
                </span>
                <strong>{h.title}</strong>
                <p>{h.text}</p>
              </li>
            ))}
          </ol>
          <div className="ws-how-foot">
            <a href="#lich" className="btn btn-primary btn-lg">
              Chọn buổi ngay
              <SproutyIcon name="arrow-right" size={18} />
            </a>
            <span>
              Cần tư vấn hoặc muốn tổ chức workshop riêng cho trường lớp?{' '}
              <Link to="/contact">Gửi yêu cầu cho Sprouty</Link>
            </span>
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section className="section ws-section">
        <div className="container ws-faq-wrap">
          <div className="ws-head ws-head-center">
            <div>
              <span className="label">Câu hỏi thường gặp</span>
              <h2>Ba mẹ thường hỏi</h2>
            </div>
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

      <LoginRequiredDialog gate={gate} onClose={() => setGate(null)} />

      {booking && (
        <WorkshopRegisterModal
          workshop={booking}
          onClose={() => setBooking(null)}
          // Reload so the seat counts on the cards reflect the booking just made.
          onRegistered={load}
        />
      )}
    </>
  );
}
