import { SproutyIcon } from '@/components/icons/SproutyIcon';
import type { SpeciesProfile as Profile } from '@/types/product';
import './SpeciesProfile.css';

/**
 * Who a plant is: its botanical name and family, where it comes from, how it
 * reached us, what to look for and a few things a child may not know. The
 * same card on the kit's page, for the parent choosing it, and on the plant's
 * page, for the child caring for it. The text comes with the species
 * (backend/src/services/species-profile.js), so no kit has its own copy.
 *
 * `bare` drops the card and the title, for a fold that already names it.
 */
export function SpeciesProfile({ label, profile, bare = false, className = '' }: {
  label: string;
  profile: Profile;
  bare?: boolean;
  className?: string;
}) {
  return (
    <section className={`sp${bare ? ' is-bare' : ''} ${className}`} aria-label={`Hồ sơ giống ${label}`}>
      <header className="sp-head">
        {!bare && (
          <span className="sp-icon" aria-hidden="true">
            <SproutyIcon name="leaf" size={20} />
          </span>
        )}
        <div>
          {!bare && <h3>Hồ sơ giống · {label}</h3>}
          <p>
            <em>{profile.scientificName}</em> · {profile.family}
            {profile.otherNames.length > 0 && <> · còn gọi là {profile.otherNames.join(', ')}</>}
          </p>
        </div>
      </header>
      <div className="sp-grid">
        <div className="sp-block">
          <h4><SproutyIcon name="pin" size={16} /> Xuất xứ</h4>
          <p>{profile.origin}</p>
        </div>
        <div className="sp-block">
          <h4><SproutyIcon name="book" size={16} /> Câu chuyện</h4>
          <p>{profile.story}</p>
        </div>
        <div className="sp-block">
          <h4><SproutyIcon name="search" size={16} /> Đặc điểm</h4>
          <ul>{profile.traits.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div className="sp-block sp-fun">
          <h4><SproutyIcon name="star" size={16} /> Bé có biết?</h4>
          <ul>{profile.funFacts.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
      </div>
    </section>
  );
}
