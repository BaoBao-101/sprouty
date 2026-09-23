import { useEffect } from 'react';
import type { LightboxImage } from '@/data/workshop';

/**
 * Full-screen image viewer. Locks page scroll while open and closes on Escape.
 */
export function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: LightboxImage[];
  index: number | null;
  onClose: () => void;
  onNavigate: (next: number) => void;
}) {
  const open = index !== null;

  useEffect(() => {
    if (!open) return;

    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNavigate(-1);
      if (e.key === 'ArrowRight') onNavigate(1);
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, onNavigate]);

  if (!open) return null;
  const entry = images[index];

  return (
    <div className="ws-lightbox open" onClick={onClose}>
      <button className="ws-lb-close" onClick={onClose} aria-label="Đóng">
        ✕
      </button>
      <button
        className="ws-lb-prev"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(-1);
        }}
        aria-label="Ảnh trước"
      >
        ‹
      </button>
      <button
        className="ws-lb-next"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(1);
        }}
        aria-label="Ảnh sau"
      >
        ›
      </button>
      <div className="ws-lb-inner" onClick={(e) => e.stopPropagation()}>
        {/* key forces a remount so the fade-in animation replays on each change */}
        <img key={entry.src} src={entry.src} alt={entry.caption} />
        <div className="ws-lb-caption">{entry.caption}</div>
      </div>
    </div>
  );
}
