import { Link } from 'react-router-dom';
import { AiChat } from '@/components/AiChat';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import './AiAssistant.css';

export default function AiAssistant() {
  return (
    <div className="buddy-page">
      <div className="container">
        <nav className="buddy-breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span>/</span><span>Plant Buddy</span></nav>
        <header className="buddy-heading">
          <div><span className="buddy-eyebrow">MỘT NGƯỜI BẠN CHO KHU VƯỜN NHỎ</span><h1>Cùng bạn chăm chút <em>điều xanh.</em></h1><p>Chuyện chăm cây, chọn kit hay lưu kỷ niệm — cứ hỏi Sprouty nhé.</p></div>
          <Link className="buddy-garden-link" to="/my-plants"><SproutyIcon name="sprout" size={21} /> Vườn của tôi <SproutyIcon name="arrow-right" size={17} /></Link>
        </header>
        <AiChat />
        <div className="buddy-page-note"><SproutyIcon name="leaf" size={18} /><span>Mỗi câu hỏi nhỏ là khởi đầu của một điều mới.</span><Link to="/faq">Bạn cần thêm trợ giúp?</Link></div>
      </div>
    </div>
  );
}
