import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { API } from '@/services/api';
import { loginHref } from '@/services/auth-nav';
import { useAuth } from '@/contexts/AuthContext';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import './ProductVideos.css';

interface CustomerVideo {
  id: string;
  title: string;
  description?: string | null;
  durationSec?: number | null;
  thumbnailUrl?: string | null;
  externalUrl?: string | null;
  progress?: { progressSec: number; completedAt?: string | null } | null;
}

interface Summary {
  count: number;
  totalDurationSec: number;
  items: Array<{ title: string; durationSec?: number | null }>;
}

type State = 'loading' | 'ready' | 'locked' | 'signed-out' | 'error';

function duration(sec?: number | null) {
  if (!sec) return '';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function totalLabel(sec: number) {
  if (!sec) return '';
  const m = Math.round(sec / 60);
  return m < 1 ? 'dưới 1 phút' : `${m} phút`;
}

function youTubeEmbed(url: string) {
  const m =
    url.match(/youtu\.be\/([\w-]{6,})/i) ||
    url.match(/youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)([\w-]{6,})/i);
  return m ? `https://www.youtube.com/embed/${m[1]}?rel=0` : null;
}

/** How far through a video the customer is, 0–1. */
function watched(video: CustomerVideo) {
  if (video.progress?.completedAt) return 1;
  if (!video.durationSec || !video.progress?.progressSec) return 0;
  return Math.min(1, video.progress.progressSec / video.durationSec);
}

/**
 * The instruction videos for a product, as a customer sees them.
 *
 * The admin could upload videos, but nothing on the customer side ever
 * fetched them: the product page's "Video" tab was a placeholder that said
 * "đang được chuẩn bị" whatever existed. This plays them — a player with a
 * playlist beside it, resuming where the child stopped and ticking off the
 * ones finished — and, for somebody who has not bought the kit, lists what
 * they would get with a lock on it rather than showing nothing.
 *
 * `compact` drops the locked teaser and renders nothing when there are no
 * videos, for the plant page, where an empty panel would be noise.
 */
export function ProductVideos({ productId, compact = false }: { productId: number; compact?: boolean }) {
  const { ready, isLoggedIn } = useAuth();
  const [state, setState] = useState<State>('loading');
  const [videos, setVideos] = useState<CustomerVideo[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [src, setSrc] = useState<string>('');
  const [srcError, setSrcError] = useState('');
  const lastSent = useRef(0);
  const player = useRef<HTMLVideoElement>(null);

  const load = useCallback(async () => {
    if (!ready) return;
    setState('loading');
    API.videos.summary(productId).then(setSummary).catch(() => setSummary(null));
    if (!isLoggedIn) {
      setState('signed-out');
      return;
    }
    try {
      const data = await API.videos.listForProduct(productId);
      const list: CustomerVideo[] = data.videos || [];
      setVideos(list);
      // Start at the first one not yet finished.
      setCurrentId((id) => id ?? (list.find((v) => !v.progress?.completedAt) || list[0])?.id ?? null);
      setState('ready');
    } catch (err: any) {
      if (err?.status === 403) setState('locked');
      else if (err?.status === 401) setState('signed-out');
      else setState('error');
    }
  }, [productId, ready, isLoggedIn]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = videos.find((v) => v.id === currentId) || null;

  // The playable address comes from its own call: it is the part that is
  // checked against the purchase every time.
  useEffect(() => {
    if (!current) return;
    let live = true;
    setSrc('');
    setSrcError('');
    API.videos
      .get(current.id)
      .then((data: any) => live && setSrc(data.video?.url || ''))
      .catch((err: any) => live && setSrcError(err?.message || 'Không mở được video này.'));
    return () => {
      live = false;
    };
  }, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function report(progressSec: number, completed = false) {
    if (!current) return;
    API.videos.progress(current.id, { progressSec: Math.floor(progressSec), completed }).catch(() => {});
    setVideos((list) =>
      list.map((v) =>
        v.id === current.id
          ? {
              ...v,
              progress: {
                progressSec: Math.floor(progressSec),
                completedAt: completed ? new Date().toISOString() : v.progress?.completedAt ?? null,
              },
            }
          : v,
      ),
    );
  }

  /* ── Not available ───────────────────────────────────────────────────── */

  if (state === 'loading') {
    return compact ? null : <div className="pv-msg">Đang tải video hướng dẫn…</div>;
  }
  if (state === 'error') {
    return compact ? null : <div className="pv-msg">Chưa tải được video. Vui lòng thử lại sau.</div>;
  }
  if (state === 'locked' || state === 'signed-out') {
    if (compact || !summary) return null;
    if (!summary.count) {
      return (
        <div className="pv-empty">
          <SproutyIcon name="info" size={26} />
          <strong>Sản phẩm này chưa có video hướng dẫn</strong>
          <span>Video sẽ xuất hiện ở đây khi Sprouty đăng tải.</span>
        </div>
      );
    }
    return (
      <div className="pv-locked">
        <div className="pv-locked-head">
          <span className="pv-lock">
            <SproutyIcon name="lock" size={22} />
          </span>
          <div>
            <strong>
              {summary.count} video hướng dẫn
              {summary.totalDurationSec ? ` · ${totalLabel(summary.totalDurationSec)}` : ''}
            </strong>
            <span>
              {state === 'signed-out'
                ? 'Đăng nhập bằng tài khoản đã mua bộ kit để xem.'
                : 'Mở khoá khi bạn mua bộ kit hoặc kích hoạt mã đi kèm.'}
            </span>
          </div>
        </div>
        <ol className="pv-locked-list">
          {summary.items.map((item, i) => (
            <li key={i}>
              <span className="pv-num">{i + 1}</span>
              <span className="pv-locked-title">{item.title}</span>
              {item.durationSec ? <em>{duration(item.durationSec)}</em> : null}
            </li>
          ))}
        </ol>
        {state === 'signed-out' ? (
          <Link className="btn btn-primary" to={loginHref()}>
            Đăng nhập để xem
          </Link>
        ) : (
          <Link className="btn btn-outline" to="/my-plants">
            Đã có mã? Kích hoạt tại Cây của tôi
          </Link>
        )}
      </div>
    );
  }

  /* ── Bought, but nothing uploaded yet ────────────────────────────────── */

  if (!videos.length) {
    return compact ? null : (
      <div className="pv-empty">
        <SproutyIcon name="info" size={26} />
        <strong>Chưa có video hướng dẫn cho bộ kit này</strong>
        <span>Khi Sprouty đăng video, bạn sẽ xem được ngay tại đây và trong trang chăm cây.</span>
      </div>
    );
  }

  /* ── Player and playlist ─────────────────────────────────────────────── */

  const done = videos.filter((v) => v.progress?.completedAt).length;
  const embed = src ? youTubeEmbed(src) : null;

  return (
    // A container query, not a media query: the same component sits in a
    // narrow tab column on the shop page and full width on the plant page.
    <div className="pv-host">
    <div className="pv">
      <div className="pv-stage">
        {srcError ? (
          <div className="pv-player pv-player-msg">{srcError}</div>
        ) : !src ? (
          <div className="pv-player pv-player-msg">Đang mở video…</div>
        ) : embed ? (
          <iframe
            className="pv-player"
            src={embed}
            title={current?.title}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => current && !current.progress?.completedAt && report(0, true)}
          />
        ) : (
          <video
            ref={player}
            key={current?.id}
            className="pv-player"
            src={src}
            controls
            playsInline
            preload="metadata"
            poster={current?.thumbnailUrl || undefined}
            onLoadedMetadata={(e) => {
              // Pick up where the child stopped, unless they finished it.
              const at = current?.progress?.progressSec || 0;
              if (at > 5 && !current?.progress?.completedAt && at < e.currentTarget.duration - 5) {
                e.currentTarget.currentTime = at;
              }
            }}
            onTimeUpdate={(e) => {
              const t = e.currentTarget.currentTime;
              if (Math.abs(t - lastSent.current) >= 15) {
                lastSent.current = t;
                report(t);
              }
            }}
            onEnded={(e) => report(e.currentTarget.duration || 0, true)}
          />
        )}
        {current && (
          <div className="pv-now">
            <strong>{current.title}</strong>
            {current.description && <p>{current.description}</p>}
          </div>
        )}
      </div>

      <aside className="pv-list" aria-label="Danh sách video">
        <div className="pv-list-head">
          <strong>{videos.length} video hướng dẫn</strong>
          <span>
            Đã xem {done}/{videos.length}
          </span>
        </div>
        <ol>
          {videos.map((video, i) => {
            const share = watched(video);
            const isCurrent = video.id === currentId;
            return (
              <li key={video.id}>
                <button
                  type="button"
                  className={`pv-item${isCurrent ? ' is-current' : ''}`}
                  onClick={() => {
                    lastSent.current = 0;
                    setCurrentId(video.id);
                  }}
                  aria-current={isCurrent ? 'true' : undefined}
                >
                  <span className="pv-thumb">
                    {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" /> : <span className="pv-num">{i + 1}</span>}
                    {video.durationSec ? <em>{duration(video.durationSec)}</em> : null}
                    {share > 0 && share < 1 && <i style={{ width: `${share * 100}%` }} />}
                  </span>
                  <span className="pv-item-text">
                    <b>
                      {i + 1}. {video.title}
                    </b>
                    <small>
                      {video.progress?.completedAt ? (
                        <>
                          <SproutyIcon name="check" size={13} /> Đã xem
                        </>
                      ) : share > 0 ? (
                        `Đang xem dở ${Math.round(share * 100)}%`
                      ) : isCurrent ? (
                        'Đang mở'
                      ) : (
                        'Chưa xem'
                      )}
                    </small>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>
    </div>
    </div>
  );
}
