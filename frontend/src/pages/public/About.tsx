import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import './About.css';

/** From the 168-parent survey and the 90-day pilot. */
const STATS = [
  { value: '168', label: 'phụ huynh tham gia khảo sát' },
  { value: '90', label: 'ngày thí điểm cùng gia đình' },
  { value: '60%', label: 'bé hoàn thành bộ kit đầu tiên' },
  { value: '90%', label: 'phụ huynh muốn trồng tiếp' },
];

/** What parents told us, and what Sprouty does about each. */
const PROBLEMS: Array<{ icon: IconName; problem: string; detail: string; answer: string }> = [
  {
    icon: 'bolt',
    problem: 'Quá nhiều thời gian màn hình',
    detail: '72% phụ huynh lo bé dành hơn 3 giờ mỗi ngày cho điện thoại.',
    answer: 'Một việc đủ hấp dẫn để bé tự đặt điện thoại xuống: ghé thăm và chăm cây của mình.',
  },
  {
    icon: 'info',
    problem: 'Thiếu hướng dẫn rõ ràng',
    detail: 'Bé hứng thú lúc đầu rồi nản vì không biết bước tiếp theo — ba mẹ cũng vậy.',
    answer: 'Plant Buddy AI và video nói rõ hôm nay cây cần gì, từng bước một.',
  },
  {
    icon: 'trophy',
    problem: 'Cần cảm giác “con chăm được”',
    detail: 'Trẻ cần thấy nỗ lực của mình tạo ra kết quả thật.',
    answer: 'Cây lớn qua 8 chặng nhờ chính bé chăm, và mỗi chặng được lưu thành kỷ niệm.',
  },
];

/** The four pieces, in the order a family meets them. */
const PILLARS: Array<{ icon: IconName; title: string; text: string; to: string; cta: string }> = [
  {
    icon: 'seed',
    title: 'Bộ kit & cây mô phỏng',
    text: 'Kích hoạt mã là có một cây 3D lớn dần qua 8 chặng, với cảm biến và thiết bị IoT ảo.',
    to: '/shop',
    cta: 'Xem bộ kit',
  },
  {
    icon: 'chat',
    title: 'Plant Buddy AI',
    text: 'Người bạn trả lời câu hỏi của bé và nhắc việc chăm cây đúng lúc.',
    to: '/ai',
    cta: 'Hỏi thử',
  },
  {
    icon: 'album',
    title: 'Cây Kỷ Niệm',
    text: 'Ảnh, video và những câu nói nhỏ của con được lưu thành từng chiếc lá.',
    to: '/my-plants',
    cta: 'Mở vườn',
  },
  {
    icon: 'pot',
    title: 'Workshop gia đình',
    text: 'Buổi cuối tuần bé vẽ chậu, gieo hạt thật và mang cây về nhà.',
    to: '/workshop',
    cta: 'Xem lịch',
  },
];

const MILESTONES = [
  {
    when: 'Tháng 9 / 2025',
    title: 'Nảy sinh ý tưởng',
    text: 'Nhóm sinh viên FPT University thấy gia đình cần một hoạt động vừa có thiên nhiên thật, vừa có công nghệ lưu giữ kỷ niệm.',
  },
  {
    when: 'Tháng 11 / 2025',
    title: 'Nghiên cứu thực địa',
    text: 'Khảo sát 168 phụ huynh tại TP.HCM, phỏng vấn sâu 12 gia đình để hiểu bé thực sự cần gì.',
  },
  {
    when: 'Tháng 1 / 2026',
    title: 'Thí điểm 90 ngày',
    text: 'Điều bé thích nhất không phải chiếc chậu, mà là mỗi ngày được quay lại xem cây đã lớn tới đâu.',
  },
  {
    when: 'Tháng 3 / 2026',
    title: 'Sprouty ra mắt',
    text: 'Bộ kit, Cây Kỷ Niệm, Plant Buddy AI và workshop gia đình trong một trải nghiệm.',
  },
];

const BELIEFS: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: 'sprout',
    title: 'Thiên nhiên là lớp học đầu tiên',
    text: 'Gieo hạt, tưới nước, quan sát cây lớn giúp bé luyện kiên nhẫn và trách nhiệm.',
  },
  {
    icon: 'heart',
    title: 'Gia đình trong từng chiếc lá',
    text: 'Mỗi bộ kit là một hoạt động chung: cùng đặt tên cây, cùng đọc cảm biến, cùng lưu kỷ niệm.',
  },
  {
    icon: 'leaf',
    title: 'Ít màn hình, nhiều kỷ niệm',
    text: 'Công nghệ chỉ để quan sát và ghi lại — phần quan trọng vẫn diễn ra ngoài đời.',
  },
];

/**
 * The team. This section used to be an empty <div id="teamGrid"> waiting for
 * a script from the old static site that no longer runs, so the page showed a
 * heading over nothing. The data comes from that script.
 */
const TEAM = [
  { id: 'SE190176', name: 'Huỳnh Trọng Phước', role: 'Trưởng nhóm ý tưởng & thiết kế', note: '3D generalist, mê sáng tạo và minh hoạ.' },
  { id: 'SE194132', name: 'Phan Chính Hiếu', role: 'Phát triển sản phẩm', note: 'Tạo giải pháp mới bằng công nghệ và sự sáng tạo.' },
  { id: 'SE181830', name: 'Nguyễn Thị Thanh Ngân', role: 'Ý tưởng & thiết kế sản phẩm', note: 'Live with passion.' },
  { id: 'SE190091', name: 'Lê Huỳnh Quốc Đại', role: 'Ý tưởng & thiết kế sản phẩm', note: 'Graphic designer yêu minh hoạ và truyền thông thị giác.' },
  { id: 'SE191117', name: 'Trương Tuấn Minh', role: 'Phát triển sản phẩm', note: '“Do it as your enterprise.”' },
  { id: 'SS190207', name: 'Phạm Xuân Tùng', role: 'Chiến lược kinh doanh', note: 'Biến ý tưởng thành mô hình bền vững.' },
];

function Member({ m }: { m: (typeof TEAM)[number] }) {
  const [failed, setFailed] = useState(false);
  const initial = m.name.trim().split(' ').slice(-1)[0].charAt(0);
  return (
    <article className="ab-member">
      <div className="ab-member-photo">
        {failed ? (
          <span className="ab-member-initial">{initial}</span>
        ) : (
          <img src={`/assets/images/team/${m.id}.png`} alt={m.name} loading="lazy" onError={() => setFailed(true)} />
        )}
      </div>
      <div className="ab-member-body">
        <strong>{m.name}</strong>
        <span className="ab-member-role">{m.role}</span>
        <p>{m.note}</p>
      </div>
    </article>
  );
}

export default function About() {
  useEffect(() => {
    document.title = 'Giới thiệu — Sprouty';
  }, []);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className="ab-hero">
        <div className="container ab-hero-grid">
          <div className="ab-hero-copy">
            <div className="breadcrumb ab-crumb">
              <Link to="/">Trang chủ</Link> › Giới thiệu
            </div>
            <span className="ab-kicker">
              <SproutyIcon name="sprout" size={15} /> Về Sprouty
            </span>
            <h1>
              Chăm cây mỗi ngày,
              <span>lớn lên cùng bé</span>
            </h1>
            <p>
              Sprouty bắt đầu từ một ý tưởng đơn giản: gia đình cần nhiều khoảnh khắc chậm lại cùng nhau. Mỗi
              ngày bé ghé thăm cây của mình, xem cảm biến và quyết định hôm nay cây cần gì.
            </p>
            <div className="ab-hero-actions">
              <Link to="/shop" className="btn btn-primary btn-lg">
                Xem bộ kit
                <SproutyIcon name="arrow-right" size={18} />
              </Link>
              <a href="#doi-ngu" className="btn btn-outline btn-lg">
                Gặp đội ngũ
              </a>
            </div>
          </div>
          <div className="ab-hero-art">
            <img src="/assets/images/banner/about-banner.png" alt="Bé và gia đình cùng chăm cây Sprouty" />
            <span className="ab-hero-note">
              <SproutyIcon name="heart" size={16} /> Từ sinh viên FPT University, TP.HCM
            </span>
          </div>
        </div>
      </div>

      {/* ── Numbers ──────────────────────────────────────────────────── */}
      <div className="container">
        <ul className="ab-stats">
          {STATS.map((s) => (
            <li key={s.label}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Why: each problem with its answer ────────────────────────── */}
      <section className="ab-section" id="nghien-cuu">
        <div className="container">
          <div className="ab-head">
            <span className="label">Vì sao có Sprouty</span>
            <h2>Ba điều phụ huynh nói với chúng tôi</h2>
          </div>
          <div className="ab-problems">
            {PROBLEMS.map((p) => (
              <article className="ab-problem" key={p.problem}>
                <span className="ab-icon">
                  <SproutyIcon name={p.icon} size={22} />
                </span>
                <h3>{p.problem}</h3>
                <p className="ab-problem-detail">{p.detail}</p>
                <p className="ab-problem-answer">
                  <SproutyIcon name="check" size={15} />
                  <span>{p.answer}</span>
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── What Sprouty is ──────────────────────────────────────────── */}
      <section className="ab-section ab-tinted">
        <div className="container">
          <div className="ab-head">
            <span className="label">Sprouty gồm những gì</span>
            <h2>Bốn mảnh ghép, một hành trình</h2>
          </div>
          <div className="ab-pillars">
            {PILLARS.map((p, i) => (
              <Link to={p.to} className="ab-pillar" key={p.title}>
                <span className="ab-pillar-n">0{i + 1}</span>
                <span className="ab-icon">
                  <SproutyIcon name={p.icon} size={22} />
                </span>
                <strong>{p.title}</strong>
                <span className="ab-pillar-text">{p.text}</span>
                <span className="ab-pillar-cta">
                  {p.cta} <SproutyIcon name="arrow-right" size={14} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Journey, across ──────────────────────────────────────────── */}
      <section className="ab-section" id="hanh-trinh">
        <div className="container">
          <div className="ab-head">
            <span className="label">Hành trình</span>
            <h2>Từ ý tưởng đến sản phẩm thật</h2>
          </div>
          <ol className="ab-journey">
            {MILESTONES.map((m, i) => (
              <li key={m.when} className={i === MILESTONES.length - 1 ? 'is-now' : ''}>
                <span className="ab-dot" />
                <span className="ab-when">{m.when}</span>
                <strong>{m.title}</strong>
                <p>{m.text}</p>
              </li>
            ))}
          </ol>

          <div className="ab-beliefs">
            {BELIEFS.map((b) => (
              <div className="ab-belief" key={b.title}>
                <span className="ab-icon is-soft">
                  <SproutyIcon name={b.icon} size={20} />
                </span>
                <div>
                  <strong>{b.title}</strong>
                  <p>{b.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Team ─────────────────────────────────────────────────────── */}
      <section className="ab-section ab-tinted" id="doi-ngu">
        <div className="container">
          <div className="ab-head">
            <span className="label">Đội ngũ</span>
            <h2>Những người xây dựng Sprouty</h2>
            <p>Sáu sinh viên Đại học FPT TP.HCM.</p>
          </div>
          <div className="ab-team">
            {TEAM.map((m) => (
              <Member m={m} key={m.id} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────────────────────── */}
      <section className="ab-section" id="lien-he-ve">
        <div className="container">
          <div className="ab-contact">
            <div>
              <strong>Bạn muốn hợp tác hoặc góp ý?</strong>
              <p>
                Phụ huynh muốn góp ý, giáo viên muốn đưa hoạt động gieo hạt vào lớp, hay đối tác muốn tổ chức workshop
                cùng Sprouty — chúng tôi luôn sẵn lòng lắng nghe.
              </p>
            </div>
            <Link to="/contact" className="btn btn-white btn-lg">
              Gửi lời nhắn
              <SproutyIcon name="arrow-right" size={18} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
