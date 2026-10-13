import type { CSSProperties } from 'react';
import type { CareActionId } from '@/types/plant';
import './CareActors.css';

/**
 * The tool itself doing the job, over the plant, while the care is sent.
 *
 * A watering can comes in, tips and pours; a spray bottle squeezes three
 * times; a sack of fertiliser tips and granules fall; the sun in the sky
 * blazes and shines on the leaves; a magnifier hunts round the plant until a bug
 * scurries off; scissors snip three times and leaves drop; a trowel digs
 * twice and throws up soil; a bee loops round the flowers leaving pollen;
 * fruit drops into a basket. It used to be a shower of dots for every tool.
 *
 * Every motion is CSS, timed to the 2.2s the game waits (CareGame's
 * EFFECT_MS); the layer is placed by the soil line, so it sits right on the
 * 3D plant and on the drawn garden alike.
 */
export function CareActor({ action, fruitColor }: { action: CareActionId; fruitColor?: string }) {
  const v = (vars: Record<string, string | number>) => vars as CSSProperties;
  switch (action) {
    case 'water':
      return (
        <div className="ca ca-water" aria-hidden="true">
          <div className="ca-tool">
            <svg viewBox="0 0 100 100">
              <g stroke="#3F5D66" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
                <path d="M58 34C58 16 86 16 86 34" fill="none" strokeWidth="5" />
                <path d="M46 62L14 36" strokeWidth="10" />
                <path d="M46 62L14 36" stroke="#8DB8C5" strokeWidth="5" />
                <ellipse cx="12" cy="34" rx="8" ry="5" transform="rotate(-40 12 34)" fill="#6E9EAC" />
                <rect x="42" y="34" width="50" height="46" rx="9" fill="#8DB8C5" />
                <path d="M42 48H92" fill="none" opacity=".45" />
              </g>
            </svg>
          </div>
          <div className="ca-stream">
            {Array.from({ length: 7 }, (_, i) => (
              <i key={i} style={v({ '--i': i, '--x': `${(i * 5) % 9}px` })} />
            ))}
          </div>
          <span className="ca-splash" />
          <span className="ca-splash is-late" />
        </div>
      );

    case 'mist':
      return (
        <div className="ca ca-mist" aria-hidden="true">
          <div className="ca-tool">
            <svg viewBox="0 0 100 100">
              <path d="M52 70H82V84A6 6 0 0 1 76 90H58A6 6 0 0 1 52 84Z" fill="#A9D3DE" />
              <g stroke="#3D5A45" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
                <rect x="50" y="44" width="34" height="48" rx="9" fill="none" />
                <rect x="58" y="34" width="18" height="10" rx="2" fill="#7FA77A" />
                <path d="M42 20H80V34H54Z" fill="#7FA77A" />
                <rect x="32" y="22" width="11" height="7" rx="2" fill="#5F8A5B" />
                <path className="ca-trigger" d="M58 34L50 50L56 52L64 36" fill="#5F8A5B" />
              </g>
            </svg>
          </div>
          <div className="ca-puffs">
            {Array.from({ length: 15 }, (_, i) => (
              <i
                key={i}
                style={v({
                  '--delay': `${0.55 + Math.floor(i / 5) * 0.4 + (i % 5) * 0.03}s`,
                  '--dx': `${-70 - (i % 5) * 9}px`,
                  '--dy': `${((i * 17) % 50) - 22}px`,
                })}
              />
            ))}
          </div>
        </div>
      );

    case 'fertilize':
      return (
        <div className="ca ca-fert" aria-hidden="true">
          <div className="ca-tool">
            <svg viewBox="0 0 100 100">
              <g stroke="#6B4A2B" strokeWidth="2.5" strokeLinejoin="round">
                <path d="M34 30L80 22L88 86Q60 94 40 88Z" fill="#CDA56D" />
                <path d="M34 30Q30 22 38 18L80 14L80 22" fill="#B98F57" />
                <path d="M52 56c6-8 16-8 20 0c-6 8-14 8-20 0z" fill="#7FA35B" />
                <ellipse cx="36" cy="26" rx="6" ry="4" fill="#5A3E24" />
              </g>
            </svg>
          </div>
          <div className="ca-grains">
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} style={v({ '--i': i, '--dx': `${((i * 23) % 40) - 20}px` })} />
            ))}
          </div>
        </div>
      );

    case 'sunlight':
      // The sun already in the sky blazes up and shines down on the plant.
      // Where it is comes from the page (--sun-x/--sun-y/--sun-deg), since
      // every garden scene has its own sky.
      return (
        <div className="ca ca-sun" aria-hidden="true">
          <span className="ca-wash" />
          <span className="ca-glow" />
          {[-12, 0, 12].map((d) => (
            <span key={d} className="ca-beam" style={v({ '--tilt': `${d}deg` })} />
          ))}
          <span className="ca-burst" />
          <span className="ca-flare" />
        </div>
      );

    case 'pest_check':
      return (
        <div className="ca ca-pest" aria-hidden="true">
          <svg className="ca-bug" viewBox="0 0 24 24">
            <g stroke="#3B3B3B" strokeWidth="1.4" strokeLinecap="round">
              <path d="M6 8L3 6M6 12H2M6 16L3 18M18 8L21 6M18 12H22M18 16L21 18" />
              <ellipse cx="12" cy="13" rx="6.5" ry="7.5" fill="#C8553D" />
              <path d="M12 5.5V20.5" />
              <circle cx="12" cy="5" r="3" fill="#3B3B3B" />
              <circle cx="9.5" cy="11" r="1.2" fill="#3B3B3B" stroke="none" />
              <circle cx="14.5" cy="15" r="1.2" fill="#3B3B3B" stroke="none" />
            </g>
          </svg>
          <div className="ca-tool">
            <svg viewBox="0 0 100 100">
              <path d="M60 60L86 86" stroke="#8A5A3A" strokeWidth="10" strokeLinecap="round" />
              <circle cx="42" cy="42" r="24" fill="rgba(220, 240, 245, .4)" stroke="#5B6B66" strokeWidth="6" />
              <path d="M30 35a14 14 0 0 1 10-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".85" />
            </svg>
          </div>
        </div>
      );

    case 'prune':
      return (
        <div className="ca ca-prune" aria-hidden="true">
          <div className="ca-tool">
            <svg viewBox="0 0 100 100">
              <g stroke="#4A555B" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
                <g className="ca-blade-a">
                  <path d="M30 62L50 50" strokeWidth="5" />
                  <circle cx="22" cy="68" r="9" fill="none" stroke="#C9733D" strokeWidth="6" />
                  <path d="M50 50L92 41L90 47Z" fill="#B8C2C8" />
                </g>
                <g className="ca-blade-b">
                  <path d="M30 38L50 50" strokeWidth="5" />
                  <circle cx="22" cy="32" r="9" fill="none" stroke="#C9733D" strokeWidth="6" />
                  <path d="M50 50L92 59L90 53Z" fill="#B8C2C8" />
                </g>
                <circle cx="50" cy="50" r="3.5" fill="#4A555B" />
              </g>
            </svg>
          </div>
          <div className="ca-leaves">
            {[0.62, 1.01, 1.41].map((delay, i) => (
              <i key={i} style={v({ '--delay': `${delay}s`, '--dx': `${[18, -10, 26][i]}px` })} />
            ))}
          </div>
        </div>
      );

    case 'loosen_soil':
      return (
        <div className="ca ca-dig" aria-hidden="true">
          <div className="ca-tool">
            <svg viewBox="0 0 100 100">
              <path d="M62 38L84 16" stroke="#9C6B3F" strokeWidth="10" strokeLinecap="round" />
              <path d="M56 44L64 36" stroke="#4A555B" strokeWidth="7" strokeLinecap="round" />
              <path d="M60 46Q66 70 34 84Q22 72 30 60Q44 44 60 46Z" fill="#AEB8BF" stroke="#4A555B" strokeWidth="2.5" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="ca-dirt">
            {Array.from({ length: 12 }, (_, i) => (
              <i
                key={i}
                style={v({
                  '--delay': `${i < 6 ? 0.82 : 1.6}s`,
                  '--dx': `${((i * 29) % 70) - 35}px`,
                  '--up': `${-18 - ((i * 13) % 20)}px`,
                })}
              />
            ))}
          </div>
        </div>
      );

    case 'pollinate':
      return (
        <div className="ca ca-pollinate" aria-hidden="true">
          <div className="ca-pollen">
            {[
              [40, -8], [14, -24], [-12, -30], [-40, -10], [-46, 4], [-20, -14], [8, -18], [30, 4],
            ].map(([x, y], i) => (
              <i key={i} style={v({ '--x': `${x}px`, '--y': `${y}px`, '--delay': `${0.4 + i * 0.17}s` })} />
            ))}
          </div>
          <svg className="ca-bee" viewBox="0 0 60 40">
            <ellipse className="ca-wing" cx="26" cy="10" rx="9" ry="7" fill="rgba(255, 255, 255, .85)" stroke="#6B7C85" strokeWidth="1.5" />
            <ellipse className="ca-wing" cx="36" cy="10" rx="8" ry="6" fill="rgba(255, 255, 255, .85)" stroke="#6B7C85" strokeWidth="1.5" />
            <ellipse cx="30" cy="24" rx="16" ry="11" fill="#F2C14E" stroke="#3B3B3B" strokeWidth="2" />
            <rect x="23" y="15" width="4" height="18" fill="#3B3B3B" />
            <rect x="32" y="15" width="4" height="18" fill="#3B3B3B" />
            <circle cx="47" cy="22" r="6" fill="#3B3B3B" />
            <path d="M14 24H8" stroke="#3B3B3B" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      );

    case 'harvest':
      return (
        <div className="ca ca-harvest" aria-hidden="true" style={v({ '--fruit': fruitColor || '#E4572E' })}>
          {[0.55, 0.9, 1.25].map((delay, i) => (
            <span key={i} className="ca-fruit" style={v({ '--delay': `${delay}s`, '--from': `${[-14, 10, -2][i]}px` })}>
              <i />
            </span>
          ))}
          <div className="ca-tool">
            <svg viewBox="0 0 100 100">
              <g stroke="#6B4A2B" strokeLinejoin="round" strokeLinecap="round">
                <path d="M28 46C28 16 72 16 72 46" fill="none" strokeWidth="5" />
                <path d="M14 46H86L78 88H22Z" fill="#C99A5B" strokeWidth="2.5" />
                <path d="M18 60H82M20 74H80" strokeWidth="2" opacity=".5" />
              </g>
            </svg>
          </div>
        </div>
      );

    default:
      return null;
  }
}
