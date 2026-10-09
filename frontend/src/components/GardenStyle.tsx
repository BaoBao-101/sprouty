import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '@/services/api';
import { POTS, SCENES, potLook, sceneLook, type PotKey, type PotLook, type SceneKey, type SceneLook } from './garden-looks';
import './GardenStyle.css';

export interface GardenBenefits {
  vip: boolean;
  scene: SceneKey;
  decoration: PotKey;
  aiLimit: number | null;
  aiUsed: number;
}

/* ── Previews ──────────────────────────────────────────────────────────── */

/** A thumbnail of the scene: its sky, its ground, and its signature detail. */
function ScenePreview({ look }: { look: SceneLook }) {
  const [top, bottom, ground] = look.swatch;
  return (
    <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`sky-${look.key}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="120" height="80" fill={`url(#sky-${look.key})`} />
      {look.key === 'natural' && (
        <>
          <circle cx="94" cy="20" r="9" fill="#FFF0B0" />
          <ellipse cx="30" cy="22" rx="14" ry="6" fill="#FFFFFF" opacity=".85" />
        </>
      )}
      {look.key === 'night' && (
        <>
          <path d="M-5 40 L125 8" stroke="#B9B6FF" strokeWidth="14" opacity=".18" />
          {[[12, 10], [30, 26], [52, 8], [70, 22], [88, 12], [104, 30], [20, 40], [62, 36], [110, 8]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={x % 3 ? 0.9 : 1.5} fill="#F1F3FF" />
          ))}
          <circle cx="24" cy="18" r="13" fill="#FFF4D6" opacity=".25" />
          <circle cx="24" cy="18" r="8" fill="#FBF4DC" />
          {[[40, 58], [78, 54], [96, 62], [58, 66]].map(([x, y]) => (
            <circle key={`f${x}`} cx={x} cy={y} r="1.8" fill="#FFE38A" />
          ))}
        </>
      )}
      {look.key === 'autumn' && (
        <>
          <circle cx="86" cy="44" r="16" fill="#FFE2A8" opacity=".55" />
          <circle cx="86" cy="44" r="9" fill="#FFF4D2" />
          {[[14, 50, '#D9452B'], [30, 46, '#F07A2C'], [100, 48, '#B8321F'], [112, 52, '#F2A531']].map(([x, y, c]) => (
            <circle key={`t${x}`} cx={x as number} cy={y as number} r="9" fill={c as string} />
          ))}
          {[[48, 20, '#E2542C'], [66, 32, '#F2A531'], [40, 40, '#C8402A']].map(([x, y, c]) => (
            <path key={`l${x}`} d={`M${x} ${y} l3 -4 l3 4 l-3 4 z`} fill={c as string} />
          ))}
        </>
      )}
      {look.key === 'sakura' && (
        <>
          <path d="M-2 6 C 20 14, 30 18, 46 28" stroke="#5A3A32" strokeWidth="2.5" fill="none" />
          {[[16, 10], [26, 16], [36, 20], [44, 27], [20, 20], [32, 26]].map(([x, y]) => (
            <circle key={`b${x}-${y}`} cx={x} cy={y} r="3.4" fill="#F39BBB" />
          ))}
          <path d="M54 54 L70 30 L86 54 z" fill="#D6C9E4" />
          {[[100, 22], [80, 14], [62, 40], [108, 44]].map(([x, y]) => (
            <ellipse key={`p${x}`} cx={x} cy={y} rx="2.2" ry="1.4" fill="#F7B8CF" />
          ))}
        </>
      )}
      <path d="M0 62 C 30 54, 90 56, 120 62 L120 80 L0 80 Z" fill={ground} />
    </svg>
  );
}

/** A drawing of the pot: the shape and the glaze, as they will look in 3D. */
function PotPreview({ look }: { look: PotLook }) {
  const [body, accent] = look.swatch;
  return (
    <svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="120" height="80" fill="#F6F3EA" />
      {look.key === 'plain' && (
        <>
          <path d="M38 26 h44 l-6 40 h-32 z" fill={body} />
          <rect x="35" y="22" width="50" height="8" rx="3" fill={accent} />
        </>
      )}
      {look.key === 'terracotta' && (
        <>
          <ellipse cx="60" cy="70" rx="30" ry="4" fill={body} />
          <path d="M39 28 h42 l-6 38 h-30 z" fill={body} />
          <rect x="33" y="21" width="54" height="10" rx="5" fill="#B4603A" />
          <path d="M42 40 h36 M44 56 h32" stroke={accent} strokeWidth="2" />
          {[46, 53, 60, 67, 74].map((x) => (
            <path key={x} d={`M${x} 44 l3 4 l-3 4 l-3 -4 z`} fill={accent} />
          ))}
        </>
      )}
      {look.key === 'ceramic' && (
        <>
          <path d="M46 24 h28 l2 4 C 96 34, 96 62, 72 68 h-24 C 24 62, 24 34, 44 28 z" fill={body} />
          <ellipse cx="54" cy="40" rx="6" ry="12" fill="#FFFFFF" opacity=".35" />
          <rect x="44" y="21" width="32" height="5" rx="2.5" fill={accent} />
          <path d="M33 46 C 50 50, 70 50, 87 46" stroke={accent} strokeWidth="1.4" fill="none" />
        </>
      )}
      {look.key === 'porcelain' && (
        <>
          <path d="M38 26 h44 l-2 34 l-6 8 h-28 l-6 -8 z" fill={body} stroke="#D5DCEB" />
          <rect x="36" y="22" width="48" height="6" rx="3" fill={body} stroke={accent} strokeWidth="1.5" />
          <path d="M40 32 q4 -3 8 0 q4 3 8 0 q4 -3 8 0 q4 3 8 0 q4 -3 8 0" stroke={accent} strokeWidth="1.4" fill="none" />
          <path d="M60 38 c5 4 5 11 0 14 c-5 -3 -5 -10 0 -14 z" fill="#5E7FC8" stroke={accent} />
          <path d="M51 44 c4 2 6 7 4 10 c-4 -1 -6 -6 -4 -10 z M69 44 c-4 2 -6 7 -4 10 c4 -1 6 -6 4 -10 z" fill="#5E7FC8" stroke={accent} />
          <path d="M42 62 h36" stroke={accent} strokeWidth="1.4" />
        </>
      )}
    </svg>
  );
}

/* ── Tile ──────────────────────────────────────────────────────────────── */

function Tile({
  label,
  blurb,
  vip,
  locked,
  selected,
  previewing,
  disabled,
  onPick,
  children,
}: {
  label: string;
  blurb: string;
  vip: boolean;
  locked: boolean;
  selected: boolean;
  previewing: boolean;
  disabled: boolean;
  onPick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`gs-tile${selected ? ' is-selected' : ''}${previewing ? ' is-preview' : ''}${vip ? ' is-vip' : ''}`}
      aria-pressed={selected || previewing}
      disabled={disabled}
      onClick={onPick}
      title={locked ? `${label}: ${blurb}. Bấm để xem thử, nâng cấp VIP để giữ lại.` : `${label}: ${blurb}`}
    >
      <span className="gs-tile-art">
        {children}
        {vip && (
          <span className={`gs-tile-tag${locked ? ' is-locked' : ''}`}>
            {locked ? (
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <rect x="3" y="7" width="10" height="7" rx="1.5" fill="currentColor" />
                <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.6" fill="none" />
              </svg>
            ) : (
              <img src="/assets/images/sprouty-icons/VIP.png" alt="" />
            )}
            VIP
          </span>
        )}
        {(selected || previewing) && <span className="gs-tile-check">{previewing ? 'Thử' : '✓'}</span>}
      </span>
      <span className="gs-tile-label">{label}</span>
    </button>
  );
}

/* ── Panel ─────────────────────────────────────────────────────────────── */

/**
 * The garden's scene and pot.
 *
 * Two dropdowns used to sit here, and a regular account saw them greyed out
 * with no idea what was behind them. Now every look is a picture, a VIP picks
 * one and it is saved straight away, and anybody else can press a VIP look
 * to try it on the model in front of them — the clearest way to show what
 * the membership changes is to let them see it on their own plant.
 */
export function GardenStyle({ onChange }: { onChange: (value: GardenBenefits) => void }) {
  const [value, setValue] = useState<GardenBenefits | null>(null);
  const [preview, setPreview] = useState<{ scene?: SceneKey; decoration?: PotKey }>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    API.garden
      .benefits()
      .then((data: GardenBenefits) => {
        if (active) setValue(data);
      })
      .catch(() => {
        if (active) setError('Chưa tải được quyền lợi. Vui lòng tải lại trang.');
      });
    return () => {
      active = false;
    };
  }, []);

  // What the viewer should show: the saved look, or the one being tried on.
  useEffect(() => {
    if (!value) return;
    onChange({
      ...value,
      scene: preview.scene ?? value.scene,
      decoration: preview.decoration ?? value.decoration,
    });
  }, [value, preview, onChange]);

  const vip = Boolean(value?.vip);
  const trying = !vip && Boolean(preview.scene || preview.decoration);

  async function pick(patch: { scene?: SceneKey; decoration?: PotKey }, isVipLook: boolean) {
    if (!value) return;
    setError('');

    // A regular account trying a VIP look: show it, save nothing.
    if (!vip) {
      if (!isVipLook) {
        // Back to a regular look for that slot.
        setPreview((p) => ({ ...p, ...(patch.scene ? { scene: undefined } : {}), ...(patch.decoration ? { decoration: undefined } : {}) }));
      } else {
        setPreview((p) => ({ ...p, ...patch }));
      }
      return;
    }

    // VIP: applied at once, saved behind it, put back if the save fails.
    const before = value;
    const next = { ...value, ...patch };
    setValue(next);
    setBusy(true);
    try {
      const stored = await API.garden.save({ scene: next.scene, decoration: next.decoration });
      setValue(stored);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (e: any) {
      setValue(before);
      setError(e?.message || 'Chưa lưu được lựa chọn.');
    } finally {
      setBusy(false);
    }
  }

  const shownScene = preview.scene ?? value?.scene ?? 'natural';
  const shownPot = preview.decoration ?? value?.decoration ?? 'plain';

  return (
    <section className={`garden-style${vip ? ' is-vip' : ''}`} aria-label="Trang trí khu vườn">
      <header className="gs-head">
        <div className="gs-title">
          <strong>Góc vườn của bạn</strong>
          <span className={`gs-badge${vip ? ' is-vip' : ''}`}>
            {vip ? (
              <>
                <img src="/assets/images/sprouty-icons/VIP.png" alt="" />
                VIP Garden
              </>
            ) : (
              'Tài khoản Thường'
            )}
          </span>
          {saved && <span className="gs-saved">Đã lưu</span>}
        </div>
        <p>
          {vip
            ? 'Đổi ngay trên mô hình, lưu cho mọi cây của bạn.'
            : 'Bấm một lựa chọn VIP để xem thử trên cây của bạn.'}
        </p>
      </header>

      {trying && (
        <div className="gs-trying" role="status">
          <span>
            <b>Đang xem thử</b> {sceneLook(shownScene).label} · {potLook(shownPot).label}. Chỉ hiện trên màn
            hình này — nâng cấp VIP để giữ lại cho khu vườn.
          </span>
          <div className="gs-trying-actions">
            <Link className="gs-cta" to="/vip">
              Nâng cấp VIP
            </Link>
            <button type="button" className="gs-ghost" onClick={() => setPreview({})}>
              Thôi xem thử
            </button>
          </div>
        </div>
      )}

      <div className="gs-body">
      <div className="gs-group">
        <span className="gs-group-label">
          Khung cảnh <em>{sceneLook(shownScene).label} — {sceneLook(shownScene).blurb}</em>
        </span>
        <div className="gs-grid">
          {SCENES.map((look) => (
            <Tile
              key={look.key}
              label={look.label}
              blurb={look.blurb}
              vip={look.vip}
              locked={look.vip && !vip}
              selected={!preview.scene && value?.scene === look.key}
              previewing={preview.scene === look.key}
              disabled={!value || busy}
              onPick={() => pick({ scene: look.key }, look.vip)}
            >
              <ScenePreview look={look} />
            </Tile>
          ))}
        </div>
      </div>

      <div className="gs-group">
        <span className="gs-group-label">
          Chậu trang trí <em>{potLook(shownPot).label} — {potLook(shownPot).blurb}</em>
        </span>
        <div className="gs-grid">
          {POTS.map((look) => (
            <Tile
              key={look.key}
              label={look.label}
              blurb={look.blurb}
              vip={look.vip}
              locked={look.vip && !vip}
              selected={!preview.decoration && value?.decoration === look.key}
              previewing={preview.decoration === look.key}
              disabled={!value || busy}
              onPick={() => pick({ decoration: look.key }, look.vip)}
            >
              <PotPreview look={look} />
            </Tile>
          ))}
        </div>
      </div>
      </div>

      {value && (
        <p className="garden-style-usage">
          <strong>
            Plant Buddy ·{' '}
            {value.aiLimit === null
              ? 'Không giới hạn lượt hỏi AI'
              : `${Math.max(0, value.aiLimit - value.aiUsed)}/${value.aiLimit} lượt AI hôm nay`}
          </strong>
          <span>
            {value.aiLimit === null
              ? 'Áp dụng trong thời gian VIP còn hiệu lực'
              : 'Làm mới lúc 00:00 giờ Việt Nam · VIP được hỏi không giới hạn'}
          </span>
        </p>
      )}
      {!vip && value && !trying && (
        <Link className="gs-more" to="/vip">
          Mở khoá 3 khung cảnh và 3 mẫu chậu với VIP Garden →
        </Link>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
