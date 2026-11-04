/**
 * What a harvest opens: the moment itself (a basket filling), the picking's
 * certificate to keep, a nudge to photograph the real plant for the album,
 * a dish to make with what was grown, the species collection it counts
 * towards — and what comes next: tend it for the next picking, or, when the
 * plant is done, sow the seeds it kept as a new season.
 *
 * Opened by the harvest itself (with the collection and any free seat it won)
 * and again from the plant's page ("Xem chứng nhận"), where the collection is
 * fetched on the way.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SproutyIcon, type IconName } from '@/components/icons/SproutyIcon';
import { HarvestCertificate, downloadCertificate } from '@/components/HarvestCertificate';
import type { HarvestCollection, HarvestRecord, PlantDetail } from '@/types/plant';
import './HarvestCelebration.css';

export interface Celebration {
  harvest: HarvestRecord;
  collection: HarvestCollection | null;
  /** Free workshop seats this harvest won by completing the collection. */
  seatsWon: number;
  /** Opened by the harvest just now, rather than to look back at one. */
  fresh: boolean;
}

export function HarvestCelebration({ celebration, plant, sowing, onSow, onClose }: {
  celebration: Celebration | null;
  plant: PlantDetail;
  sowing: boolean;
  onSow: () => void;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!celebration) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous; };
  }, [celebration, onClose]);

  if (!celebration) return null;
  const { harvest, collection, seatsWon, fresh } = celebration;
  const finished = Boolean(plant.harvestedAt);
  // The journey's end: its final picking, or the last one of a plant that finished early.
  const last = harvest.number >= harvest.of || (finished && harvest.number >= plant.harvestCount);
  // Looking back at a picking that more followed: told as done, not as still to come.
  const followed = plant.harvestCount > harvest.number;

  async function save() {
    setSaving(true);
    try { await downloadCertificate(harvest); } finally { setSaving(false); }
  }

  return (
    <div className="hv-overlay" role="dialog" aria-modal="true" aria-labelledby="hv-title" onClick={onClose}>
      <div className="hv-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="hv-close" onClick={onClose} aria-label="Đóng"><SproutyIcon name="close" size={18} /></button>

        {/* The moment: the harvest dropping into a basket. */}
        <div className={`hv-hero${fresh ? ' is-fresh' : ''}`} aria-hidden="true">
          {fresh && [0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="hv-drop" style={{ ['--i' as string]: i, ['--c' as string]: plant.fruitColor }} />
          ))}
          <span className="hv-basket"><SproutyIcon name="harvest" size={46} /></span>
        </div>

        <h2 id="hv-title">{last ? 'Hoàn thành hành trình!' : `Thu hoạch đợt ${harvest.number}/${harvest.of}!`}</h2>
        <p className="hv-lead">
          {last
            ? `Bé đã hái ${harvest.harvestLabel} từ ${harvest.plantName}.`
            : followed
              ? `Bé đã hái ${harvest.harvestLabel} đợt ${harvest.number} từ ${harvest.plantName}.`
              : `${harvest.plantName} sẽ ra ${harvest.harvestLabel} tiếp — chăm thêm để hái đợt ${harvest.number + 1}.`}
        </p>

        {seatsWon > 0 && (
          <Link to="/workshop" className="hv-reward" onClick={onClose}>
            <SproutyIcon name="gift" size={22} />
            <span><b>Tặng 1 suất workshop miễn phí!</b> Bé đã thu hoạch đủ {collection?.total} loài cây.</span>
            <SproutyIcon name="arrow-right" size={16} />
          </Link>
        )}

        <HarvestCertificate harvest={harvest} />
        <button type="button" className="btn btn-primary hv-save" onClick={save} disabled={saving}>
          <SproutyIcon name="album" size={18} /> {saving ? 'Đang tạo ảnh…' : 'Tải giấy chứng nhận'}
        </button>

        {/* The real plant on the windowsill: photographed into the album. */}
        <Link to={`/tree?id=${plant.productId}&plant=${plant.id}#thanh-qua`} className={`hv-real${plant.realHarvestPhoto ? ' is-done' : ''}`} onClick={onClose}>
          <span className="hv-real-icon"><SproutyIcon name={plant.realHarvestPhoto ? 'check' : 'camera'} size={22} /></span>
          <span>
            <b>{plant.realHarvestPhoto ? 'Đã lưu ảnh cây thật' : 'Bé đã hái cây thật chưa?'}</b>
            <em>{plant.realHarvestPhoto ? 'Xem lại trong Album kỷ niệm' : 'Chụp thành quả, lưu vào Album kỷ niệm'}</em>
          </span>
          <SproutyIcon name="arrow-right" size={16} />
        </Link>

        {plant.recipe && (
          <section className="hv-recipe" aria-label="Món ngon từ thành quả">
            <h3><SproutyIcon name="heart" size={18} /> {plant.recipe.title}</h3>
            <ol>{plant.recipe.steps.map((step) => <li key={step}>{step}</li>)}</ol>
            <p>{plant.recipe.note}</p>
          </section>
        )}

        {collection && collection.total > 0 && (
          <section className="hv-collection" aria-label="Bộ sưu tập loài cây">
            <div className="hv-collection-head">
              <b>Bộ sưu tập loài</b>
              <span>{collection.collected}/{collection.total} loài</span>
            </div>
            <div className="hv-chips">
              {collection.species.map((s) => (
                <span key={s.key} className={`hv-chip${s.harvests ? ' is-on' : ''}`} title={s.harvests ? `Đã thu hoạch ${s.harvests} lần` : 'Chưa trồng'}>
                  <SproutyIcon name={s.icon as IconName} size={15} /> {s.label}
                </span>
              ))}
            </div>
            {collection.collected < collection.total && (
              <p>Thu hoạch đủ {collection.total} loài để nhận 1 suất workshop miễn phí.</p>
            )}
          </section>
        )}

        <div className="hv-next">
          {!finished ? (
            <button type="button" className="btn btn-primary" onClick={onClose}>Chăm tiếp cho đợt sau</button>
          ) : plant.seedsReady ? (
            plant.seedsNeedVip ? (
              <Link to="/vip" className="btn btn-primary" onClick={onClose}>Gieo vụ tiếp với VIP Garden</Link>
            ) : (
              <button type="button" className="btn btn-primary" onClick={onSow} disabled={sowing}>
                <SproutyIcon name="seed" size={18} /> {sowing ? 'Đang gieo…' : 'Gieo vụ mới từ hạt đã giữ'}
              </button>
            )
          ) : null}
          {finished && <Link to="/shop" className="btn btn-ghost" onClick={onClose}>Chọn bộ kit khác</Link>}
        </div>
      </div>
    </div>
  );
}
