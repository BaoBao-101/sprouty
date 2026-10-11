import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
import type { Product } from '@/types/product';
import './Home.css';

const STEPS = [
  { icon: 'gift', title: 'Chọn một bạn cây', text: 'Tìm bộ kit bé yêu thích, mở hộp và bắt đầu một điều mới.' },
  { icon: 'pencil', title: 'Gieo hạt sáng tạo', text: 'Tô màu chiếc chậu, gieo hạt nhỏ và đặt cho cây một cái tên.' },
  { icon: 'water', title: 'Chăm chút mỗi ngày', text: 'Cùng bé quan sát, tưới nước và khám phá những thay đổi nhỏ.' },
  { icon: 'camera', title: 'Gom đầy kỷ niệm', text: 'Lưu ảnh, viết nhật ký để nhớ cả hành trình cây và bé cùng lớn.' },
] as const;
const FILTERS = ['Tất cả bộ kit', 'Được yêu thích', 'Có phiên bản Smart'] as const;
function featuredProducts(products: Product[], filter: string) {
  const kits = products.filter((product) => product.cat === 'kit');
  if (filter === FILTERS[1]) return kits.filter((product) => product.badge === 'hot').slice(0, 3);
  if (filter === FILTERS[2]) return kits.filter((product) => product.smartDelta !== null).slice(0, 3);
  return [...kits].sort((a, b) => Number(b.badge === 'hot') - Number(a.badge === 'hot')).slice(0, 3);
}

export default function Home() {
  const { products, loading, error } = useProducts();
  const [filter, setFilter] = useState<string>(FILTERS[0]);
  const featured = featuredProducts(products, filter);

  return (
    <div className="sprout-home">
      <section className="sh-hero">
        <div className="container sh-hero-grid">
          <div className="sh-hero-copy">
            <span className="sh-eyebrow"><SproutyIcon name="leaf" size={19} className="sh-tiny-leaf" /> MỘT HẠT MẦM. NGÀN ĐIỀU KỲ DIỆU.</span>
            <h1>Gieo một hạt nhỏ.<br />Nuôi <span>cả tuổi thơ.</span></h1>
            <p>Một chút đất, một chút nắng và thật nhiều yêu thương. Cùng Sprouty để bé tự tay trồng cây, khám phá và lớn lên mỗi ngày.</p>
            <div className="sh-actions"><Link className="sh-button sh-button-green" to="/shop">Tìm bạn cây cho bé <SproutyIcon name="arrow-right" size={18} /></Link><a className="sh-text-link" href="#hanh-trinh">Sprouty có gì vui? <SproutyIcon name="arrow-down" size={18} /></a></div>
            <div className="sh-hero-foot"><span className="sh-mini-icons" aria-hidden="true"><SproutyIcon name="sprout" size={23} /><SproutyIcon name="pencil" size={23} /><SproutyIcon name="sun" size={23} /></span><span>Chạm vào thiên nhiên.<br /><strong>Gần nhau thêm một chút.</strong></span></div>
          </div>
          <div className="sh-hero-art">
            <div className="sh-sun" aria-hidden="true"><SproutyIcon name="sun" size={76} /></div>
            <figure className="sh-main-photo"><img src="/assets/images/products/bean/bean-standard.png" alt="Bộ kit Sprouty với chậu đậu xanh, hạt giống và màu vẽ" fetchPriority="high" /><figcaption>Một chiếc chậu nhỏ, một khởi đầu thật xinh <span><SproutyIcon name="heart" size={16} /></span></figcaption></figure>
            <div className="sh-art-label"><span><SproutyIcon name="sprout" size={30} /></span><div>Xin chào, bạn nhỏ!<strong>Mình cùng lớn lên nhé.</strong></div></div>
            <div className="sh-round-stamp">TRỒNG CÂY THẬT<span><SproutyIcon name="heart" size={23} /></span>LƯU KỶ NIỆM XINH</div>
          </div>
        </div>
      </section>

      <div className="sh-ribbon"><div className="container"><span><SproutyIcon name="sprout" size={20} /> Tự tay gieo trồng</span><span><SproutyIcon name="pencil" size={20} /> Thỏa sức sáng tạo</span><span><SproutyIcon name="bulb" size={20} /> Khám phá STEM</span><span><SproutyIcon name="heart" size={20} /> Kết nối gia đình</span></div></div>

      <section className="sh-section sh-products" id="bo-kit">
        <div className="container">
          <div className="sh-heading-row"><div><span className="sh-eyebrow">KHU VƯỜN ĐANG ĐỢI BÉ</span><h2>Hôm nay, mình trồng gì?</h2><p>Mỗi bạn cây là một câu chuyện mới để cùng khám phá.</p></div><Link className="sh-text-link" to="/shop">Ghé cửa hàng <SproutyIcon name="arrow-right" size={18} /></Link></div>
          <div className="sh-filters" aria-label="Lọc bộ kit">{FILTERS.map((item) => <button key={item} type="button" aria-pressed={filter === item} className={filter === item ? 'is-active' : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
          <div className="sh-product-grid" aria-live="polite" aria-busy={loading}>
            {loading ? Array.from({ length: 3 }, (_, i) => <div className="sh-skeleton" key={i}><span /><p>Đang tìm những bạn cây…</p></div>) : error ? <div className="sh-empty"><p>{error}</p><Link to="/shop" className="sh-text-link">Đi đến cửa hàng <SproutyIcon name="arrow-right" size={16} /></Link></div> : featured.length ? featured.map((product) => <ProductCard key={product.id} product={product} />) : <div className="sh-empty">Chưa có bộ kit trong nhóm này. Bạn thử khám phá các nhóm còn lại nhé!</div>}
          </div>
          <div className="sh-product-note"><span><SproutyIcon name="heart" size={19} /></span> Một món quà để bé chơi hôm nay, và nhớ mãi ngày sau.</div>
        </div>
      </section>

      <section className="sh-section sh-journey" id="hanh-trinh">
        <div className="container">
          <div className="sh-heading-center"><span className="sh-eyebrow">NHỎ THÔI, MÀ THẬT NHIỀU NIỀM VUI</span><h2>Từ hạt mầm đến kỷ niệm</h2><p>Không cần là chuyên gia trồng cây. Chỉ cần mình cùng bắt đầu.</p></div>
          <div className="sh-step-grid">{STEPS.map((step, index) => <article className="sh-step" key={step.title}><div className="sh-step-top"><span className="sh-step-icon" aria-hidden="true"><SproutyIcon name={step.icon} size={36} /></span><span className="sh-step-number">0{index + 1}</span></div><h3>{step.title}</h3><p>{step.text}</p></article>)}</div>
          <Link className="sh-text-link sh-journey-link" to="/my-plants">Đã có kit? Ghé vườn của bạn <SproutyIcon name="arrow-right" size={18} /></Link>
        </div>
      </section>

      <section className="sh-section sh-discover">
        <div className="container">
          <div className="sh-heading-center"><span className="sh-eyebrow">THẾ GIỚI NHỎ CỦA SPROUTY</span><h2>Nhiều hơn một chậu cây</h2><p>Ở đây, mỗi ngày chăm cây đều có một điều đáng nhớ.</p></div>
          <div className="sh-feature-grid">
            <article className="sh-memory">
              <div><span className="sh-label">01 / ALBUM KỶ NIỆM</span><h3>Cây lớn thêm một lá.<br />Nhà mình thêm một kỷ niệm.</h3><p>Lần đầu gieo hạt, chiếc mầm đầu tiên, nụ cười khi cây ra hoa… Giữ lại tất cả trong album của riêng bạn.</p><Link className="sh-text-link" to="/my-plants">Mở khu vườn kỷ niệm <SproutyIcon name="arrow-right" size={18} /></Link></div>
              <div className="sh-memory-photos" aria-hidden="true"><figure><img src="/assets/images/products/sunflower/sunflower-standard.png" alt="" loading="lazy" /><figcaption>Ngày nắng, cây và mình</figcaption></figure><figure><img src="/assets/images/workshop/1.jpg" alt="" loading="lazy" /><figcaption>Lớn thêm một chút rồi!</figcaption></figure></div>
            </article>
            <article className="sh-buddy"><span className="sh-label">02 / PLANT BUDDY AI</span><div className="sh-buddy-art"><div className="sh-buddy-drawing" aria-hidden="true"><SproutyIcon name="pot" size={100} /></div><span>Hôm nay cây có gì mới?</span></div><h3>Một bạn cây.<br />Muôn vàn câu hỏi.</h3><p>Cùng Plant Buddy khám phá chuyện trồng cây và tìm cảm hứng viết nhật ký mỗi ngày.</p><Link className="sh-text-link" to="/ai">Trò chuyện cùng bạn cây <SproutyIcon name="arrow-right" size={18} /></Link></article>
          </div>
        </div>
      </section>

      <section className="sh-section sh-workshop-section">
        <div className="container sh-workshop">
          <div className="sh-workshop-photo"><img src="/assets/images/workshop/register/register-basic.png" alt="Gia đình cùng bé trồng cây tại workshop Sprouty" loading="lazy" /><span className="sh-photo-note">Cuối tuần này, mình cùng gieo vui!</span></div>
          <div className="sh-workshop-copy"><span className="sh-eyebrow">HẸN NHAU Ở SPROUTY</span><h2>Tay lấm chút đất.<br />Tim đầy niềm vui.</h2><p>Rời màn hình một chút, dành cho nhau một buổi thật vui. Cùng bé vẽ chiếc chậu của riêng mình, gieo hạt và mang một người bạn xanh về nhà.</p><div className="sh-workshop-tags"><span><SproutyIcon name="pencil" size={24} /> Vẽ chậu</span><span><SproutyIcon name="sprout" size={24} /> Gieo hạt</span><span><SproutyIcon name="bulb" size={24} /> Khám phá</span></div><Link className="sh-button sh-button-green" to="/workshop">Khám phá workshop <SproutyIcon name="arrow-right" size={18} /></Link></div>
        </div>
      </section>

      <section className="sh-section sh-together">
        <div className="container">
          <div className="sh-heading-row"><div><span className="sh-eyebrow">AI CŨNG CÓ MỘT GÓC XANH</span><h2>Mỗi độ tuổi, một cách khám phá</h2></div><p>Có bé, có ba mẹ.<br />Có những ngày cùng nhau lớn lên.</p></div>
          <div className="sh-audience-grid"><Link to="/shop" className="sh-audience"><span><SproutyIcon name="pencil" size={24} /></span><small>CHO BÉ THÍCH SÁNG TẠO</small><h3>Nhà làm vườn tí hon</h3><p>Vẽ thật vui, gieo thật khéo. Bắt đầu tình yêu thiên nhiên từ những điều gần gũi.</p><b>Khám phá bộ kit <SproutyIcon name="arrow-right" size={16} /></b></Link><Link to="/shop" className="sh-audience"><span><SproutyIcon name="nutrient" size={24} /></span><small>CHO TRÍ TÒ MÒ KHÔNG GIỚI HẠN</small><h3>Nhà khoa học nhỏ</h3><p>Quan sát cây, khám phá cảm biến và tìm hiểu điều gì giúp một hạt mầm lớn lên.</p><b>Khám phá cùng Sprouty <SproutyIcon name="arrow-right" size={16} /></b></Link><Link to="/my-plants" className="sh-audience"><span><SproutyIcon name="heart" size={24} /></span><small>CHO CẢ NHÀ MÌNH</small><h3>Người giữ kỷ niệm</h3><p>Cùng con chăm một cái cây, chụp một tấm ảnh và lưu lại những ngày thật đáng yêu.</p><b>Ghé vườn của mình <SproutyIcon name="arrow-right" size={16} /></b></Link></div>
        </div>
      </section>

      <section className="sh-faq-section"><div className="container sh-faq-layout"><div><span className="sh-eyebrow">BẠN CÓ THỂ ĐANG TÒ MÒ</span><h2>Trước khi mình<br />bắt đầu gieo hạt…</h2><Link className="sh-text-link" to="/faq">Xem các câu hỏi thường gặp <SproutyIcon name="arrow-right" size={16} /></Link></div><div className="sh-faq-list">{[
        ['Chưa từng trồng cây thì có dùng được không?', 'Có chứ! Bạn có thể bắt đầu bằng một bộ kit, làm theo hướng dẫn đi kèm và cùng bé quan sát cây mỗi ngày. Plant Buddy cũng sẵn sàng cùng bạn khám phá.'],
        ['Làm sao để lưu ảnh cây của bé?', 'Vào “Cây của tôi”, chọn cây rồi mở album để tải ảnh, thêm ghi chú và xem lại những khoảnh khắc đã lưu.'],
        ['Có thể tham gia workshop cùng con không?', 'Bạn có thể xem nội dung, lịch và thông tin đăng ký của từng chương trình tại trang Workshop để chọn trải nghiệm phù hợp cho gia đình.'],
      ].map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></div></section>

      <section className="sh-final"><div className="container"><span className="sh-final-flower" aria-hidden="true"><SproutyIcon name="flower" size={84} /></span><span className="sh-eyebrow">LET’S GROW TOGETHER</span><h2>Điều kỳ diệu bắt đầu<br />từ một hạt mầm.</h2><p>Gieo hôm nay, để mai này có thật nhiều chuyện kể.</p><div className="sh-actions"><Link className="sh-button sh-button-yellow" to="/shop">Chọn bạn cây đầu tiên <SproutyIcon name="arrow-right" size={18} /></Link><Link className="sh-button sh-button-light" to="/workshop">Hẹn một buổi workshop</Link></div><span className="sh-final-sprout" aria-hidden="true"><SproutyIcon name="sprout" size={24} /></span></div></section>
    </div>
  );
}
