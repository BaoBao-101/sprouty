import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import { TicketQr } from '@/components/TicketQr';
import './GetApp.css';

/**
 * "Tải app Sprouty" — where the Android package is downloaded from until the
 * app is in the stores.
 *
 * The package and a small description of it (downloads/latest.json) are put
 * in public/downloads by `npm run android:apk` in mobile/, so this page never
 * needs editing for a new version: it reads what is there.
 */

interface Release {
  version: string;
  sizeMb: number;
  date: string;
  file: string;
  minAndroid?: string;
}

const PAGE_URL = 'https://sprouty.id.vn/tai-app';

const FEATURES: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'sprout', title: 'Chăm cây 3D mọi lúc', text: 'Tưới nước, bón phân và xem cây lớn ngay trên điện thoại của ba mẹ.' },
  { icon: 'bell', title: 'Nhắc bé chăm cây', text: 'Chọn giờ nhắc mỗi tối, và lời nhắc trước buổi workshop bé đã đăng ký.' },
  { icon: 'card', title: 'Thanh toán một chạm', text: 'Mở thẳng app ngân hàng với số tiền và nội dung đã điền sẵn.' },
  { icon: 'ticket', title: 'Vé QR trong túi', text: 'Vé workshop luôn sẵn trong app, phóng to để nhân viên quét.' },
  { icon: 'camera', title: 'Chụp ảnh kỷ niệm', text: 'Chụp và lưu ảnh cây cùng bé thẳng vào album Cây kỷ niệm.' },
  { icon: 'chat', title: 'Hỏi Plant Buddy', text: 'Trợ lý AI trả lời mọi câu hỏi chăm cây của bé.' },
];

const STEPS = [
  'Bấm “Tải APK cho Android” trên điện thoại.',
  'Mở tệp vừa tải. Nếu máy hỏi, chọn “Cài đặt” và cho phép cài ứng dụng từ trình duyệt này.',
  'Mở Sprouty, đăng nhập bằng tài khoản bạn đang dùng trên web.',
];

export default function GetApp() {
  const [release, setRelease] = useState<Release | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    document.title = 'Tải app Sprouty — Sprouty';
    fetch('/downloads/latest.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setRelease)
      .catch(() => setMissing(true));
  }, []);

  return (
    <div className="getapp">
      <section className="getapp-hero">
        <div className="container getapp-hero-in">
          <div className="getapp-copy">
            <span className="getapp-kicker"><SproutyIcon name="leaf" size={16} /> Ứng dụng cho ba mẹ</span>
            <h1>Sprouty trên điện thoại</h1>
            <p>Khu vườn của bé, đơn hàng, vé workshop và Plant Buddy — gọn trong một ứng dụng, mở ra là chăm cây được ngay.</p>

            <div className="getapp-actions">
              {release ? (
                <a className="btn btn-primary btn-lg getapp-download" href={release.file} download>
                  <SproutyIcon name="arrow-down" size={20} /> Tải APK cho Android
                </a>
              ) : (
                <span className="btn btn-lg getapp-download is-off" aria-disabled="true">
                  {missing ? 'Bản Android sắp có' : 'Đang kiểm tra phiên bản…'}
                </span>
              )}
              <span className="getapp-store" aria-disabled="true"><SproutyIcon name="clock" size={17} /> Sắp có trên App Store &amp; Google Play</span>
            </div>
            {release && (
              <p className="getapp-meta">
                Phiên bản {release.version} · {release.sizeMb.toLocaleString('vi-VN', { maximumFractionDigits: 1 })} MB · Android {release.minAndroid || '7.0'} trở lên · cập nhật {new Date(release.date).toLocaleDateString('vi-VN')}
              </p>
            )}
          </div>

          <figure className="getapp-qr">
            <TicketQr value={PAGE_URL} size={176} />
            <figcaption>Đang xem trên máy tính? Quét mã này bằng điện thoại để tải app.</figcaption>
          </figure>
        </div>
      </section>

      <section className="container getapp-body">
        <h2>Có gì trong app?</h2>
        <ul className="getapp-features">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className="getapp-icon"><SproutyIcon name={f.icon} size={22} /></span>
              <span><strong>{f.title}</strong><em>{f.text}</em></span>
            </li>
          ))}
        </ul>

        <div className="getapp-install">
          <h2>Cài đặt trên Android</h2>
          <ol>
            {STEPS.map((step) => <li key={step}>{step}</li>)}
          </ol>
          <p className="getapp-note">
            <SproutyIcon name="shield" size={16} /> Tệp APK do Sprouty ký và phát hành tại trang này. Chỉ tải Sprouty từ sprouty.id.vn.
            Cần hỗ trợ? <Link to="/contact">Liên hệ Sprouty</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
