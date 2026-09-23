import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { fetchProducts } from '@/services/products';
import type { Product } from '@/types/product';
import './MyProducts.css';

/** Real cap (10 standard / 25 VIP) comes from the API; this is only the
 *  starting guess used before the first response arrives. */
const DEFAULT_MAX_LEAVES = 10;

const JOURNEY_STEPS = [
  { label: 'Nhận kit', emoji: '📦' },
  { label: 'Xem video', emoji: '🎬' },
  { label: 'Gieo hạt', emoji: '✂️' },
  { label: 'Chụp ảnh', img: '/assets/images/sprouty-icons/AddPhoto.png' },
  { label: 'Nhận AI phản hồi', emoji: '🤖' },
];

function KitCard({
  kit,
  leafCount,
  maxLeaves,
}: {
  kit: Product;
  leafCount: number;
  maxLeaves: number;
}) {
  const [open, setOpen] = useState(false);
  const [iconFailed, setIconFailed] = useState(false);

  const pct = Math.round(Math.min(100, (leafCount / maxLeaves) * 100));
  const done = leafCount >= maxLeaves;

  return (
    <div className={`kit-card${open ? ' open' : ''}`}>
      <div className="kit-header" onClick={() => setOpen((v) => !v)}>
        <div className="kit-em" style={{ background: kit.bg }}>
          {iconFailed ? (
            <span className="kit-em-fallback">{kit.em}</span>
          ) : (
            <img
              src={`/assets/images/sprouty-icons/${kit.name}.png`}
              alt={kit.name}
              onError={() => setIconFailed(true)}
            />
          )}
        </div>

        <div className="kit-info">
          <div className="kit-name">{kit.name}</div>
          <div className="kit-sub">
            {kit.col} · {kit.age}
          </div>
          <div className="kit-progress-row">
            <div className="prog-track">
              <div className={`prog-fill${done ? ' done' : ''}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="kit-pct">{pct}%</span>
          </div>
        </div>

        <span className={`status-pill ${done ? 'status-done' : 'status-progress'}`}>
          {done ? '✓ Hoàn thành' : '▶ Đang học'}
        </span>
        <span className={`kit-chevron${open ? ' open' : ''}`}>▾</span>
      </div>

      <div className={`kit-body${open ? ' open' : ''}`}>
        <div className="kit-video-note">
          <span style={{ fontSize: '1.4rem' }}>📽</span>
          <span>Video hướng dẫn đang được cập nhật, vui lòng quay lại sau.</span>
        </div>

        <div className="kit-leaf-head">
          <h4>
            <img src="/assets/images/sprouty-icons/MyTree.png" alt="" /> Cây kỷ niệm
          </h4>
          <span className="kit-leaf-count">
            🍃 {leafCount}/{maxLeaves} lá
          </span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary btn-sm" to={`/tree?id=${kit.id}`}>
            <img src="/assets/images/sprouty-icons/MyTree.png" alt="" className="btn-inline-icon" />
            Mở Cây Kỷ Niệm
          </Link>
          <Link className="btn btn-outline btn-sm" to={`/shop/${kit.id}?tab=videos`}>
            Xem video hướng dẫn
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function MyProducts() {
  const { user } = useAuth();
  const [kits, setKits] = useState<Product[]>([]);
  const [leafCounts, setLeafCounts] = useState<Record<number, number>>({});
  const [maxLeaves, setMaxLeaves] = useState(DEFAULT_MAX_LEAVES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // A kit unlocks two ways: bought directly (orders) or gifted and
      // redeemed here (entitlements). Both must show, otherwise a gifted user
      // cannot reach the upload UI the API already allows them.
      const [catalog, ordersResult, entitlementsResult] = await Promise.all([
        fetchProducts().catch(() => [] as Product[]),
        API.orders.list().catch(() => ({ orders: [] })),
        API.redeem.entitlements().catch(() => ({ entitlements: [] })),
      ]);
      if (cancelled) return;

      const unlocked = new Set<number>();
      for (const order of ordersResult.orders || []) {
        if (order.paidAt && order.status !== 'cancelled') {
          for (const item of order.items) unlocked.add(item.productId);
        }
      }
      for (const entitlement of entitlementsResult.entitlements || []) {
        if (entitlement.productId) unlocked.add(entitlement.productId);
      }

      const mine = catalog.filter((p) => unlocked.has(p.id) && p.cat === 'kit');

      const leaves = await Promise.all(
        mine.map(async (kit) => {
          try {
            const { images, maxLeaves: cap } = await API.myImages.list(kit.id);
            return { id: kit.id, count: images.length, cap };
          } catch {
            return { id: kit.id, count: 0, cap: null };
          }
        }),
      );
      if (cancelled) return;

      setKits(mine);
      setLeafCounts(Object.fromEntries(leaves.map((l) => [l.id, l.count])));
      const cap = leaves.find((l) => l.cap)?.cap;
      if (cap) setMaxLeaves(cap);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { doneCount, journeyStep } = useMemo(() => {
    const done = kits.filter((k) => (leafCounts[k.id] || 0) >= maxLeaves).length;
    const anyProgress = kits.some((k) => (leafCounts[k.id] || 0) > 0);
    return {
      doneCount: done,
      journeyStep: kits.length === 0 ? 0 : anyProgress ? Math.min(4, 2 + done) : 1,
    };
  }, [kits, leafCounts, maxLeaves]);

  const firstName = user?.name.split(' ').pop() ?? '';

  return (
    <>
      <div className="my-hero">
        <div className="container">
          <div className="breadcrumb my-hero-crumb">
            <Link to="/">Trang chủ</Link> › Sản phẩm của tôi
          </div>
          <div className="my-hero-row">
            <div>
              <h1>Xin chào, {firstName}! 👋</h1>
              <p>Theo dõi cây, lưu kỷ niệm và nhận gợi ý chăm sóc từ Plant Buddy.</p>
            </div>
            <div className="my-hero-actions">
              <Link to="/redeem" className="btn btn-white-ol btn-sm">
                <img src="/assets/images/sprouty-icons/RedeemCode.png" alt="" className="btn-inline-icon" />
                Nhập mã kích hoạt
              </Link>
              <Link to="/shop" className="btn btn-white-ol btn-sm">
                + Mua thêm kit
              </Link>
            </div>
          </div>
        </div>
      </div>

      <section style={{ padding: '36px 0 72px' }}>
        <div className="container">
          <div className="journey-card">
            <div className="journey-header">
              <div className="journey-title">🗺 Hành trình cây của bé</div>
              <span className="journey-meta">
                {kits.length} kit · {doneCount} hoàn thành
              </span>
            </div>
            <div className="step-tracker">
              {JOURNEY_STEPS.map((step, i) => (
                <div style={{ display: 'contents' }} key={step.label}>
                  {i > 0 && <div className={`st-line ${i <= journeyStep ? 'done' : ''}`} />}
                  <div className="st-dot-wrap">
                    <div
                      className={`st-dot ${i < journeyStep ? 'done' : i === journeyStep ? 'active' : 'locked'}`}
                    >
                      {i < journeyStep ? (
                        '✓'
                      ) : step.img ? (
                        <img src={step.img} alt="" className="st-dot-img" />
                      ) : (
                        step.emoji
                      )}
                    </div>
                    <div className="st-lbl">{step.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {loading && <p style={{ color: 'var(--ink-4)' }}>Đang tải kit của bạn…</p>}

          {!loading && kits.length === 0 && (
            <div className="no-kits">
              <div style={{ fontSize: '4rem', marginBottom: 16 }}>📦</div>
              <h3>Bạn chưa có kit nào</h3>
              <p>Kích hoạt Sprouty Kit để mở Cây Kỷ Niệm, theo dõi cây và lưu kỷ niệm của bé.</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link to="/redeem" className="btn btn-primary btn-lg">
                  <img src="/assets/images/sprouty-icons/RedeemCode.png" alt="" className="btn-inline-icon" />
                  Nhập mã kích hoạt
                </Link>
                <Link to="/shop" className="btn btn-outline btn-lg">
                  Khám phá sản phẩm →
                </Link>
              </div>
            </div>
          )}

          {kits.map((kit) => (
            <KitCard
              key={kit.id}
              kit={kit}
              leafCount={leafCounts[kit.id] || 0}
              maxLeaves={maxLeaves}
            />
          ))}
        </div>
      </section>
    </>
  );
}
