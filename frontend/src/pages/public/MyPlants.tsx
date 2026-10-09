/**
 * "Cây của tôi" — where the new model begins.
 *
 * Buying a kit no longer ships anything; it issues an activation code. This
 * page is where that code becomes a plant, so the activation form is the first
 * thing on it rather than a separate /redeem page the customer has to find.
 *
 * Each card shows the live simulation: stage, how far through it the plant is,
 * and whether anything needs attention right now. A child should be able to see
 * which of their plants is thirsty without opening any of them.
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { PlantArt } from '@/components/PlantArt';
import { PromoBanner, refreshRewards } from '@/components/PromoBanner';
import { Pager } from '@/components/Pager';
import type { PlantCard, PlantEvent } from '@/types/plant';
import type { PotKey, SceneKey } from '@/components/garden-looks';
import './MyPlants.css';
const PlantThumbnail3D = lazy(() => import('@/components/PlantThumbnail3D'));

interface Alert extends PlantEvent {
  plantId: string;
  nickname: string;
}

/**
 * Activating a kit, in a dialog.
 *
 * It used to be a panel above the garden, open on every visit, for a field
 * most visits never touch — a once-per-kit errand pushing the thing people
 * came for most of a screen down. It is a button in the hero now, and this
 * opens when somebody has a code in hand.
 */
function ActivateDialog({
  onClose,
  onActivated,
}: {
  onClose: () => void;
  onActivated: (plantId: string) => void;
}) {
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const codeRef = useRef<HTMLInputElement>(null);

  // One field matters, and the dialog was opened to fill it in.
  useEffect(() => {
    codeRef.current?.focus();
  }, []);

  // Escape closes it, and the page behind must not scroll under it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const clean = code.trim();
    if (clean.length < 4) {
      setError('Nhập mã kích hoạt in trên đơn hàng của bạn.');
      return;
    }

    setBusy(true);
    try {
      const data = await API.plants.activate(clean, nickname.trim() || undefined);
      showToast(data.message || 'Đã kích hoạt mã.', 'success');
      setCode('');
      setNickname('');

      // A membership code grants features and plants nothing, so there is
      // no plant page to go to. This used to read data.plant.id regardless
      // and throw on a code that had, in fact, worked.
      if (data.plant?.id) onActivated(data.plant.id);
      else onClose();
    } catch (err: any) {
      setError(err?.message || 'Không kích hoạt được mã này.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="activate-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Kích hoạt cây mới"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form className="activate-card" onSubmit={submit}>
        <div className="activate-head">
          <span className="activate-icon">
            <SproutyIcon name="seed" size={28} />
          </span>
          <div>
            <h2>Kích hoạt cây mới</h2>
            <p>Nhập mã trong đơn hàng của bạn — hạt sẽ được gieo ngay.</p>
          </div>
          <button type="button" className="activate-close" onClick={onClose} aria-label="Đóng">
            <SproutyIcon name="arrow-right" size={18} />
          </button>
        </div>

        <>
          <div className="activate-fields">
            <label className="activate-field">
              <span>Mã kích hoạt</span>
              <input
                ref={codeRef}
                className="form-input activate-code"
                placeholder="SPR-XXXX-XXXX-XXXX-XXXX"
                autoComplete="one-time-code"
                maxLength={128}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <label className="activate-field activate-field-name">
              <span>
                Đặt tên cho cây <em>(tuỳ chọn)</em>
              </span>
              <input
                className="form-input"
                placeholder="Bé Đậu, Cà Chua Nhỏ..."
                maxLength={40}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </label>
            <button className="btn btn-primary activate-submit" disabled={busy}>
              {busy ? 'Đang gieo hạt...' : 'Gieo hạt'}
              {!busy && <SproutyIcon name="arrow-right" size={18} />}
            </button>
          </div>

          {error && (
            <p className="activate-error">
              <SproutyIcon name="warning" size={18} /> {error}
            </p>
          )}

          <p className="activate-hint">
            Chưa có mã? <Link to="/shop">Chọn một bộ kit</Link> — mã kích hoạt hiện ngay sau khi
            thanh toán, trong trang <Link to="/account">Đơn hàng của tôi</Link>.
          </p>
        </>
      </form>
    </div>
  );
}

function StageTrack({ plant }: { plant: PlantCard }) {
  return (
    <div className="pc-track" aria-label={`Giai đoạn ${plant.stageIndex + 1}/${plant.stageCount}`}>
      {Array.from({ length: plant.stageCount }).map((_, i) => (
        <span
          key={i}
          className={`pc-tick${i < plant.stageIndex ? ' done' : i === plant.stageIndex ? ' current' : ''}`}
        />
      ))}
    </div>
  );
}

/** The account's chosen scene and pot, so the cards match the garden. */
type GardenLook = { scene: SceneKey; decoration: PotKey };

function PlantGridCard({ plant, urgent, look }: { plant: PlantCard; urgent?: Alert[]; look?: GardenLook }) {
  const done = Boolean(plant.harvestedAt);

  return (
    <Link to={`/plant/${plant.id}`} className={`plant-card${done ? ' harvested' : ''}`}>
      <div className="pc-stage-art">
        <Suspense fallback={<div className="pc-model-preview" />}><PlantThumbnail3D
          stage={plant.stage}
          progress={plant.stageProgress}
          health={plant.health}
          form={plant.form}
          fruitShape={plant.fruitShape}
          fruitColor={plant.fruitColor}
          flowerColor={plant.flowerColor}
          scene={look?.scene}
          decoration={look?.decoration}
        /></Suspense>
        <span className={`pc-health pc-health-${plant.healthState.id}`}>
          <SproutyIcon name="heart" size={15} />
          {plant.healthState.label}
        </span>
        {done && (
          <span className="pc-done-flag">
            <SproutyIcon name="trophy" size={15} /> Đã thu hoạch
          </span>
        )}
      </div>

      <div className="pc-body">
        <div className="pc-title-row">
          <h3>{plant.nickname}</h3>
          <span className="pc-species">{plant.speciesLabel}</span>
        </div>

        <div className="pc-stage-row">
          <span className="pc-stage-pill">
            <SproutyIcon name="sprout" size={15} />
            {plant.stageLabel}
          </span>
          <span className="pc-stage-count">
            Chặng {plant.stageIndex + 1}/{plant.stageCount}
          </span>
        </div>

        <div className="pc-bar">
          <div className="pc-bar-fill" style={{ width: `${Math.round(plant.stageProgress)}%` }} />
        </div>
        <div className="pc-bar-label">{Math.round(plant.stageProgress)}% của chặng này</div>

        <div className="pc-metrics">
          <span
            className={`pc-metric ${plant.moisture < 35 ? 'bad' : plant.moisture > 85 ? 'warn' : 'good'}`}
          >
            <SproutyIcon name="moisture" size={16} />
            <small>Độ ẩm</small>
            {Math.round(plant.moisture)}%
          </span>
          <span
            className={`pc-metric ${plant.nutrient < 30 ? 'bad' : plant.nutrient < 45 ? 'warn' : 'good'}`}
          >
            <SproutyIcon name="nutrient" size={16} />
            <small>Dinh dưỡng</small>
            {Math.round(plant.nutrient)}%
          </span>
          <span
            className={`pc-metric ${plant.pestRisk > 55 ? 'bad' : plant.pestRisk > 40 ? 'warn' : 'good'}`}
          >
            <SproutyIcon name="pest" size={16} />
            <small>Sâu bệnh</small>
            {Math.round(plant.pestRisk)}%
          </span>
          {plant.careStreak > 0 && (
            <span className="pc-metric streak">
              <SproutyIcon name="bolt" size={16} />
              {plant.careStreak} ngày
            </span>
          )}
        </div>

        {urgent && urgent.length > 0 && (
          <div className="pc-alert">
            <SproutyIcon name="bell" size={16} />
            {urgent[0].text}
          </div>
        )}

        <span className="pc-open">
          Vào chăm cây
          <SproutyIcon name="arrow-right" size={17} />
        </span>
      </div>
    </Link>
  );
}

/** Six to a page: two rows of three on a laptop, six cards on a phone. */
const PER_PAGE = 6;

export default function MyPlants() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plants, setPlants] = useState<PlantCard[]>([]);
  const [growPage, setGrowPage] = useState(1);
  const [cropPage, setCropPage] = useState(1);
  const [activating, setActivating] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [look, setLook] = useState<GardenLook | undefined>();

  // A VIP garden's scene and pot show on every card, not only inside a plant.
  useEffect(() => {
    let active = true;
    API.garden
      .benefits()
      .then((data: GardenLook) => active && setLook({ scene: data.scene, decoration: data.decoration }))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await API.plants.list();
      setPlants(data.plants || []);
      setAlerts(data.alerts || []);
    } catch (err: any) {
      showToast(err?.message || 'Không tải được danh sách cây.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, tick]);

  // The simulation keeps running while the page is open, so refresh when the
  // customer comes back to the tab rather than letting the numbers go stale.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') setTick((v) => v + 1);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const firstName = user?.name.split(' ').pop() ?? '';
  const growing = plants.filter((p) => !p.harvestedAt);
  const harvested = plants.filter((p) => p.harvestedAt);

  // Paged in the browser, not on the server, and deliberately: every plant
  // has to be ticked forward on each load for the alert bar above to be
  // true, so the whole garden is in hand anyway. Fetching a page of it
  // would mean a plant on page 2 going unwatered without anyone being told.
  const visibleGrowing = growing.slice((growPage - 1) * PER_PAGE, growPage * PER_PAGE);
  const visibleHarvested = harvested.slice((cropPage - 1) * PER_PAGE, cropPage * PER_PAGE);
  const alertsByPlant = alerts.reduce<Record<string, Alert[]>>((acc, a) => {
    (acc[a.plantId] ||= []).push(a);
    return acc;
  }, {});

  return (
    <>
      <div className="plants-hero">
        <div className="container">
          <div className="plants-hero-top">
            <div className="breadcrumb plants-hero-crumb">
              <Link to="/">Trang chủ</Link> › Cây của tôi
            </div>

            {/* Top right, out of the way of the garden it sits above. */}
            <button className="plants-activate-btn" onClick={() => setActivating(true)}>
              <SproutyIcon name="seed" size={19} />
              Kích hoạt cây mới
            </button>
          </div>
          <div className="plants-hero-row">
            <div className="plants-hero-copy">
              <h1>Chào {firstName}, vườn của bạn đây!</h1>
              <p>
                Mỗi bộ kit là một cây mô phỏng với đầy đủ thiết bị IoT ảo. Chăm đúng lúc, đọc cảm
                biến, và Plant Buddy sẽ đi cùng bạn từ hạt tới ngày thu hoạch.
              </p>
            </div>
            <div className="plants-hero-stats">
              <div className="phs-item">
                <strong>{growing.length}</strong>
                <span>đang lớn</span>
              </div>
              <div className="phs-item">
                <strong>{harvested.length}</strong>
                <span>đã thu hoạch</span>
              </div>
              <div className="phs-item">
                <strong>{Math.max(0, ...plants.map((p) => p.careStreak), 0)}</strong>
                <span>ngày liên tục</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="plants-section">
        <div className="container">
          <PromoBanner className="plants-promo" />

          {alerts.length > 0 && (
            <div className="plants-alertbar">
              <span className="pa-icon">
                <SproutyIcon name="bell" size={22} />
              </span>
              <div className="pa-list">
                <strong>{alerts.length} cây đang cần bạn</strong>
                <ul>
                  {alerts.slice(0, 3).map((a, i) => (
                    <li key={i}>
                      <Link to={`/plant/${a.plantId}`}>{a.nickname}</Link> — {a.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}


          {loading && <p className="plants-loading">Đang tải vườn của bạn…</p>}

          {!loading && plants.length === 0 && (
            <div className="plants-empty">
              <PlantArt stage="seed" progress={20} health={95} size={200} />
              <h3>Vườn của bạn đang trống</h3>
              <p>
                Mua một bộ kit, nhập mã kích hoạt ở trên, và bạn sẽ có cây mô phỏng đầu tiên cùng
                cảm biến độ ẩm, nhiệt độ và trợ lý AI đi kèm.
              </p>
              <Link to="/shop" className="btn btn-primary btn-lg">
                Khám phá các bộ kit
                <SproutyIcon name="arrow-right" size={19} />
              </Link>
            </div>
          )}

          {growing.length > 0 && (
            <>
              <h2 className="plants-group-title">
                <SproutyIcon name="leaf" size={22} /> Đang lớn
              </h2>
              <div className="plants-grid">
                {visibleGrowing.map((plant) => (
                  <PlantGridCard key={plant.id} plant={plant} urgent={alertsByPlant[plant.id]} look={look} />
                ))}
              </div>

              <Pager
                page={growPage}
                pages={Math.ceil(growing.length / PER_PAGE)}
                total={growing.length}
                unit="cây đang lớn"
                onChange={setGrowPage}
              />
            </>
          )}

          {harvested.length > 0 && (
            <>
              <h2 className="plants-group-title">
                <SproutyIcon name="trophy" size={22} /> Đã thu hoạch
              </h2>
              <div className="plants-grid">
                {visibleHarvested.map((plant) => (
                  <PlantGridCard key={plant.id} plant={plant} look={look} />
                ))}
              </div>

              <Pager
                page={cropPage}
                pages={Math.ceil(harvested.length / PER_PAGE)}
                total={harvested.length}
                unit="cây đã thu hoạch"
                onChange={setCropPage}
              />
            </>
          )}
        </div>
      </section>

      {activating && (
        <ActivateDialog
          onClose={() => setActivating(false)}
          onActivated={(plantId) => {
            refreshRewards();
            navigate(`/plant/${plantId}`);
          }}
        />
      )}
    </>
  );
}
