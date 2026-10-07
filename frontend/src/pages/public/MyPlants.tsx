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

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { API } from '@/services/api';
import { showToast } from '@/services/toast';
import { SproutyIcon } from '@/components/icons/SproutyIcon';
import { PlantArt } from '@/components/PlantArt';
import { PromoBanner, refreshRewards } from '@/components/PromoBanner';
import type { PlantCard, PlantEvent } from '@/types/plant';
import './MyPlants.css';

interface Alert extends PlantEvent {
  plantId: string;
  nickname: string;
}

function ActivateCard({ onActivated }: { onActivated: (plantId: string) => void }) {
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
      if (data.created) {
        showToast('Hạt đã được gieo! Cùng chăm cây nhé.', 'success');
      } else {
        showToast('Cây này đã được kích hoạt trước đó.');
      }
      setCode('');
      setNickname('');
      onActivated(data.plant.id);
    } catch (err: any) {
      setError(err?.message || 'Không kích hoạt được mã này.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="activate-card" onSubmit={submit}>
      <div className="activate-head">
        <span className="activate-icon">
          <SproutyIcon name="seed" size={28} />
        </span>
        <div>
          <h2>Kích hoạt cây mới</h2>
          <p>
            Nhập mã kích hoạt trong đơn hàng của bạn. Hạt sẽ được gieo ngay và bạn bắt đầu chăm cây
            cùng Plant Buddy.
          </p>
        </div>
      </div>

      <div className="activate-fields">
        <label className="activate-field">
          <span>Mã kích hoạt</span>
          <input
            className="form-input activate-code"
            placeholder="SPR-XXXX-XXXX-XXXX-XXXX"
            autoComplete="one-time-code"
            maxLength={128}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </label>
        <label className="activate-field activate-field-name">
          <span>Đặt tên cho cây <em>(tuỳ chọn)</em></span>
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
        Chưa có mã? <Link to="/shop">Chọn một bộ kit</Link> — mã kích hoạt hiện ngay sau khi thanh
        toán, trong trang <Link to="/account">Đơn hàng của tôi</Link>.
      </p>
    </form>
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

function PlantGridCard({ plant, urgent }: { plant: PlantCard; urgent?: Alert[] }) {
  const done = Boolean(plant.harvestedAt);

  return (
    <Link to={`/plant/${plant.id}`} className={`plant-card${done ? ' harvested' : ''}`}>
      <div className="pc-stage-art" style={{ background: plant.bgColor || 'var(--sage-bg)' }}>
        <PlantArt
          stage={plant.stage}
          progress={plant.stageProgress}
          health={plant.health}
          form={plant.form}
          fruitShape={plant.fruitShape}
          fruitColor={plant.fruitColor}
          flowerColor={plant.flowerColor}
          size={168}
        />
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

        <StageTrack plant={plant} />

        <div className="pc-bar">
          <div className="pc-bar-fill" style={{ width: `${Math.round(plant.stageProgress)}%` }} />
        </div>
        <div className="pc-bar-label">{Math.round(plant.stageProgress)}% của chặng này</div>

        <div className="pc-metrics">
          <span className={`pc-metric ${plant.moisture < 35 ? 'bad' : plant.moisture > 85 ? 'warn' : 'good'}`}>
            <SproutyIcon name="moisture" size={16} />
            {Math.round(plant.moisture)}%
          </span>
          <span className={`pc-metric ${plant.nutrient < 30 ? 'bad' : plant.nutrient < 45 ? 'warn' : 'good'}`}>
            <SproutyIcon name="nutrient" size={16} />
            {Math.round(plant.nutrient)}%
          </span>
          <span className={`pc-metric ${plant.pestRisk > 55 ? 'bad' : plant.pestRisk > 40 ? 'warn' : 'good'}`}>
            <SproutyIcon name="pest" size={16} />
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

export default function MyPlants() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [plants, setPlants] = useState<PlantCard[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

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
  const alertsByPlant = alerts.reduce<Record<string, Alert[]>>((acc, a) => {
    (acc[a.plantId] ||= []).push(a);
    return acc;
  }, {});

  return (
    <>
      <div className="plants-hero">
        <div className="container">
          <div className="breadcrumb plants-hero-crumb">
            <Link to="/">Trang chủ</Link> › Cây của tôi
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

          <ActivateCard
            onActivated={(plantId) => {
              refreshRewards();
              navigate(`/plant/${plantId}`);
            }}
          />

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
                {growing.map((plant) => (
                  <PlantGridCard key={plant.id} plant={plant} urgent={alertsByPlant[plant.id]} />
                ))}
              </div>
            </>
          )}

          {harvested.length > 0 && (
            <>
              <h2 className="plants-group-title">
                <SproutyIcon name="trophy" size={22} /> Đã thu hoạch
              </h2>
              <div className="plants-grid">
                {harvested.map((plant) => (
                  <PlantGridCard key={plant.id} plant={plant} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
