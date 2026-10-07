/**
 * "Cây cần gì?" — the first-run guide.
 *
 * A six-year-old opening the dashboard sees five dials, a line chart and eight
 * devices. Nothing on that screen says what they are supposed to *do*, and a
 * child who does not know what to do leaves. This is the thirty seconds that
 * turns the dashboard into a game they understand.
 *
 * Four cards, one idea each, pictures first and as few words as will carry the
 * meaning. It opens by itself the first time and never again — reopening is a
 * deliberate act via the "?" button, because a popup that returns every visit
 * is the fastest way to teach someone to dismiss things unread.
 */

import { useEffect, useState } from 'react';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import './PlantGuide.css';

const SEEN_KEY = 'sprouty.plant-guide.seen';

interface Step {
  icon: IconName;
  accent: string;
  title: string;
  body: string;
  /** The one thing to remember, in a child's words. */
  takeaway: string;
}

const STEPS: Step[] = [
  {
    icon: 'moisture',
    accent: 'var(--cobalt)',
    title: 'Nhìn các vòng tròn',
    body: 'Mỗi vòng tròn cho bé biết cây đang thế nào. Màu xanh là cây đang vui, màu vàng là cây hơi mệt, màu đỏ là cây cần bé giúp ngay.',
    takeaway: 'Xanh là ổn · Vàng là chú ý · Đỏ là cứu cây!',
  },
  {
    icon: 'water',
    accent: 'var(--accent-orange)',
    title: 'Làm việc Sprouty gợi ý',
    body: 'Ô màu cam ở trên cùng luôn chỉ cho bé việc cần làm tiếp theo. Bấm nút là xong — không cần đoán.',
    takeaway: 'Không biết làm gì? Cứ bấm ô màu cam.',
  },
  {
    icon: 'clock',
    accent: 'var(--accent-lavender)',
    title: 'Cây cần thời gian nghỉ',
    body: 'Sau khi tưới, cây cần vài tiếng mới uống tiếp được. Tưới dồn một lúc không làm cây lớn nhanh hơn — còn làm cây bị úng.',
    takeaway: 'Mỗi ngày ghé thăm vài lần là cây lớn nhanh nhất.',
  },
  {
    icon: 'trophy',
    accent: 'var(--primary-500)',
    title: 'Nuôi tới ngày thu hoạch',
    body: 'Cây đi qua 8 chặng, từ hạt giống tới ngày hái quả. Càng lớn, bé càng mở thêm thiết bị mới để chăm cây.',
    takeaway: 'Chăm đều mỗi ngày — khoảng 2 tuần là hái được!',
  },
];

export function PlantGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [index, setIndex] = useState(0);

  // Escape closes, and the page behind must not scroll under the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(STEPS.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  // Start from the beginning each time it is opened.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  if (!open) return null;

  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  return (
    <div
      className="guide-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Hướng dẫn chăm cây"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="guide-card">
        <button className="guide-close" onClick={onClose} aria-label="Đóng hướng dẫn">
          ✕
        </button>

        <div className="guide-art" style={{ ['--guide-accent' as string]: step.accent }}>
          <span className="guide-art-ring" />
          <SproutyIcon name={step.icon} size={56} />
        </div>

        <span className="guide-count">
          Bước {index + 1}/{STEPS.length}
        </span>
        <h2>{step.title}</h2>
        <p>{step.body}</p>

        <div className="guide-takeaway" style={{ ['--guide-accent' as string]: step.accent }}>
          <SproutyIcon name="sparkle" size={18} />
          <strong>{step.takeaway}</strong>
        </div>

        <div className="guide-dots" role="tablist" aria-label="Các bước">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              className={`guide-dot${i === index ? ' active' : ''}${i < index ? ' done' : ''}`}
              aria-label={`Bước ${i + 1}: ${s.title}`}
              aria-selected={i === index}
              role="tab"
              onClick={() => setIndex(i)}
            />
          ))}
        </div>

        <div className="guide-actions">
          {index > 0 && (
            <button className="guide-back" onClick={() => setIndex((i) => i - 1)}>
              Quay lại
            </button>
          )}
          <button
            className="guide-next"
            onClick={() => (last ? onClose() : setIndex((i) => i + 1))}
          >
            {last ? 'Bắt đầu chăm cây!' : 'Tiếp theo'}
            <SproutyIcon name={last ? 'sprout' : 'arrow-right'} size={19} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Whether this browser has seen the guide, and how to record that it has.
 *
 * Kept in localStorage rather than on the account: it is a per-device
 * convenience, and a child opening the page on the family tablet for the first
 * time should get the guide even if a parent dismissed it on their phone.
 * Wrapped because private browsing makes these accessors throw.
 */
export function useGuideFirstRun(): [boolean, () => void, () => void] {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let seen = true;
    try {
      seen = localStorage.getItem(SEEN_KEY) === '1';
    } catch {
      // Storage blocked: treat it as seen rather than showing the guide on
      // every single visit.
    }
    if (!seen) setOpen(true);
  }, []);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* nothing to do — the guide simply may reappear next time */
    }
  };

  return [open, close, () => setOpen(true)];
}
