/**
 * Growth forms.
 *
 * A tomato and a pepper used to be the same drawing in two colours, which is
 * not what "mô phỏng giống đời thật" means to a child who knows what a carrot
 * looks like. Each species declares a `form` on the server (see SPECIES in
 * backend/src/services/plant-sim.js) and these draw it: a bean climbs a cane
 * and hangs pods, a carrot swells a root under the soil, corn is one tall stalk
 * with a cob, a sunflower carries a single heavy head.
 *
 * They all take the same inputs — stage position, vigour, stem height — so
 * growing and wilting read the same way whichever form is on screen, and the
 * caller does not need to know which one it is getting.
 */

export type PlantForm = 'bush' | 'vine' | 'root' | 'stalk' | 'head' | 'leafy';
export type FruitShape = 'round' | 'pod' | 'cone' | 'cob' | 'head' | 'root' | 'none';

export interface BodyProps {
  form: PlantForm;
  fruitShape: FruitShape;
  /** Continuous 0–7.99 position along the eight stages. */
  pos: number;
  /** 0–1 health factor; below ~0.5 the plant droops and pales. */
  vigour: number;
  soilY: number;
  stemHeight: number;
  stemTop: number;
  leafCount: number;
  leafScale: number;
  leafDark: string;
  stemColor: string;
  fruitColor: string;
  flowerColor: string;
  isMature: boolean;
  showBuds: boolean;
  showFlowers: boolean;
  showFruit: boolean;
  /** Blends two hex colours; passed in so both files agree on the maths. */
  mix: (a: string, b: string, amount: number) => string;
  /** Deterministic leaf spread, so the plant never reshuffles on render. */
  leafAngle: (index: number) => number;
}

/** One leaf blade, pointing right from the origin. */
function Leaf({ len, dark, width = 0.42 }: { len: number; dark: string; width?: number }) {
  return (
    <>
      <path
        d={`M0 0 C ${len * 0.5} ${-len * width}, ${len * 0.9} ${-len * width * 0.42}, ${len} 0 C ${len * 0.9} ${len * width * 0.42}, ${len * 0.5} ${len * width}, 0 0 Z`}
        fill="url(#pa-leaf)"
        stroke={dark}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d={`M3 0 H ${len - 5}`} stroke={dark} strokeWidth="2" opacity="0.55" strokeLinecap="round" />
    </>
  );
}

/** Fruit, shaped by species: a round tomato, a pointed chilli, a bean pod. */
function Fruit({
  shape, r, color, mix,
}: { shape: FruitShape; r: number; color: string; mix: BodyProps['mix'] }) {
  const dark = mix(color, '#5A1B10', 0.4);

  if (shape === 'cone') {
    // A chilli: broad at the stalk, tapering to a point, hanging downwards.
    return (
      <>
        <path
          d={`M0 ${-r} c ${r * 0.8} ${r * 0.1} ${r * 0.85} ${r * 0.9} ${r * 0.26} ${r * 1.9}
              c ${-r * 0.3} ${r * 0.5} ${-r * 0.55} ${r * 0.5} ${-r * 0.78} 0
              C ${-r * 1.2} ${r * 0.6} ${-r * 0.8} ${-r * 0.85} 0 ${-r} Z`}
          fill={color}
          stroke={dark}
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d={`M0 ${-r} v ${-r * 0.55}`} stroke="#2E8447" strokeWidth="3.4" strokeLinecap="round" />
      </>
    );
  }

  if (shape === 'pod') {
    // A bean pod: long and gently curved, with the beans showing through.
    return (
      <>
        <path
          d={`M0 ${-r} c ${r * 0.9} ${r * 0.6} ${r * 0.9} ${r * 1.6} 0 ${r * 2.5}
              c ${-r * 0.55} ${-r * 0.9} ${-r * 0.55} ${-r * 1.6} 0 ${-r * 2.5} Z`}
          fill={color}
          stroke={dark}
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        {[0.28, 0.6, 0.92].map((t) => (
          <circle key={t} cx={r * 0.16} cy={-r + r * 2.5 * t} r={r * 0.2} fill={dark} opacity="0.38" />
        ))}
      </>
    );
  }

  // Round: a tomato.
  return (
    <>
      <circle r={r} fill={color} stroke={dark} strokeWidth="3" />
      <path d={`M0 ${-r} q 5 ${-r * 0.5} 10 ${-r * 0.3}`} stroke="#2E8447" strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx={-r * 0.3} cy={-r * 0.35} rx={r * 0.26} ry={r * 0.18} fill="#fff" opacity="0.45" />
    </>
  );
}

/** Tomato, pepper and anything unclassified: a bush with fruit at the sides. */
function BushForm(p: BodyProps) {
  const { soilY, stemHeight, stemTop, leafCount, leafScale, leafDark, stemColor, vigour, mix, leafAngle } = p;
  return (
    <>
      <path
        d={`M150 ${soilY} C 146 ${soilY - stemHeight * 0.4}, 154 ${soilY - stemHeight * 0.7}, 150 ${stemTop}`}
        stroke={stemColor}
        strokeWidth={Math.max(5, 5 + p.pos * 0.9)}
        strokeLinecap="round"
        fill="none"
      />

      {Array.from({ length: leafCount }).map((_, i) => {
        const t = (i + 1) / (leafCount + 0.6);
        const y = soilY - stemHeight * t;
        const angle = leafAngle(i);
        const len = (30 + i * 3.4) * leafScale;
        const droop = (1 - vigour) * 26 * (angle > 0 ? 1 : -1);
        return (
          <g key={i} transform={`translate(150 ${y}) rotate(${angle + droop})`}>
            <Leaf len={len} dark={leafDark} />
          </g>
        );
      })}

      {p.showBuds && [-1, 1].map((side) => (
        <g key={side} transform={`translate(${150 + side * 22} ${stemTop + 16})`}>
          <ellipse rx="8" ry="11" fill={mix(p.flowerColor, '#7BC96F', 0.55)} stroke={leafDark} strokeWidth="3" />
        </g>
      ))}

      {p.showFlowers && (
        <g transform={`translate(150 ${stemTop - 2})`}>
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <ellipse
                key={deg}
                cx={Math.cos(rad) * 13}
                cy={Math.sin(rad) * 13}
                rx="10"
                ry="8"
                fill={p.flowerColor}
                stroke={mix(p.flowerColor, '#8A5A00', 0.45)}
                strokeWidth="2.8"
                transform={`rotate(${deg} ${Math.cos(rad) * 13} ${Math.sin(rad) * 13})`}
              />
            );
          })}
          <circle r="7.5" fill="#F5D98A" stroke="#C79A3C" strokeWidth="2.6" />
        </g>
      )}

      {p.showFruit && [-1, 1].map((side, i) => {
        const r = 9 + Math.min(7, (p.pos - 6) * 5.5) + (p.isMature ? 2 : 0);
        return (
          <g key={side} transform={`translate(${150 + side * 30} ${stemTop + 42 + i * 14})`}>
            <Fruit shape={p.fruitShape} r={r} color={p.fruitColor} mix={mix} />
          </g>
        );
      })}
    </>
  );
}

/** Bean: a vine climbing a cane, with pods hanging off it. */
function VineForm(p: BodyProps) {
  const { soilY, stemHeight, stemTop, leafCount, leafScale, leafDark, stemColor, vigour, mix } = p;
  const poleTop = soilY - Math.max(stemHeight + 20, 48);

  return (
    <>
      {/* The cane it climbs — a bean needs support, and showing it teaches that. */}
      <line x1="150" y1={soilY} x2="150" y2={poleTop} stroke="#C7A978" strokeWidth="7" strokeLinecap="round" />
      {[0.32, 0.62, 0.9].map((t) => (
        <line
          key={t}
          x1="145" y1={soilY - (soilY - poleTop) * t}
          x2="155" y2={soilY - (soilY - poleTop) * t}
          stroke="#A98A5C" strokeWidth="2.6" strokeLinecap="round"
        />
      ))}

      {/* Stem spiralling around the cane. */}
      <path
        d={Array.from({ length: 10 }).map((_, i) => {
          const t = i / 9;
          const y = soilY - stemHeight * t;
          const x = 150 + Math.sin(t * Math.PI * 3.2) * 13;
          return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        }).join(' ')}
        stroke={stemColor}
        strokeWidth="5.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {Array.from({ length: leafCount }).map((_, i) => {
        const t = (i + 1) / (leafCount + 0.6);
        const y = soilY - stemHeight * t;
        const x = 150 + Math.sin(t * Math.PI * 3.2) * 13;
        const side = i % 2 === 0 ? -1 : 1;
        const len = (24 + i * 2.4) * leafScale;
        const droop = (1 - vigour) * 22 * side;
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${side * 34 + droop}) scale(${side} 1)`}>
            <Leaf len={len} dark={leafDark} width={0.54} />
          </g>
        );
      })}

      {p.showFlowers && [-1, 1].map((side) => (
        <g key={side} transform={`translate(${150 + side * 17} ${stemTop + 26})`}>
          <ellipse rx="7" ry="5.5" fill={p.flowerColor} stroke={mix(p.flowerColor, '#8A7A30', 0.4)} strokeWidth="2.4" />
        </g>
      ))}

      {p.showFruit && [-1, 1, -1].map((side, i) => {
        const r = 7 + Math.min(4, (p.pos - 6) * 3);
        return (
          <g key={i} transform={`translate(${150 + side * (20 + i * 3)} ${stemTop + 34 + i * 20})`}>
            <Fruit shape="pod" r={r} color={p.fruitColor} mix={mix} />
          </g>
        );
      })}
    </>
  );
}

/** Carrot: feathery fronds above ground, the root swelling in the soil below. */
function RootForm(p: BodyProps) {
  const { soilY, stemHeight, leafCount, leafScale, leafDark, stemColor, vigour, mix } = p;
  // The root grows down and thickens from the seedling stage on.
  const rootLen = Math.max(0, Math.min(34, (p.pos - 1.5) * 8.5));
  const rootWidth = Math.max(0, Math.min(16, (p.pos - 1.5) * 4.4));
  const fronds = Math.max(3, Math.min(9, leafCount + 2));

  return (
    <>
      {rootLen > 2 && (
        <g>
          {/* A cutaway window into the soil.
              The plant is drawn on top of the pot, so a root reaching below the
              soil line would otherwise appear in front of the pot — as if the
              carrot were lying against it. Showing an explicit cross-section is
              the classic illustration fix, and it is clearer for a child than a
              root half-hidden behind a rim: you can see the thing you are
              growing, underground, getting bigger. */}
          <rect
            x={150 - 36} y={soilY - 7}
            width="72" height={rootLen + 16}
            rx="14"
            fill="#5A3E26"
            stroke="#432E1B"
            strokeWidth="3"
          />
          {[0.18, 0.5, 0.82].map((t, i) => (
            <circle
              key={t}
              cx={150 - 26 + i * 26}
              cy={soilY + 4 + rootLen * t}
              r="2"
              fill="#7A5A3C"
              opacity="0.65"
            />
          ))}
          <path
            d={`M${150 - rootWidth} ${soilY - 5}
                C ${150 - rootWidth} ${soilY + rootLen * 0.5}, ${150 - rootWidth * 0.3} ${soilY + rootLen * 0.82}, 150 ${soilY + rootLen}
                C ${150 + rootWidth * 0.3} ${soilY + rootLen * 0.82}, ${150 + rootWidth} ${soilY + rootLen * 0.5}, ${150 + rootWidth} ${soilY - 5} Z`}
            fill={p.fruitColor}
            stroke={mix(p.fruitColor, '#7A3A10', 0.4)}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {[0.3, 0.55, 0.78].map((t) => (
            <line
              key={t}
              x1={150 - rootWidth * (1 - t) * 0.85} y1={soilY + rootLen * t}
              x2={150 + rootWidth * (1 - t) * 0.85} y2={soilY + rootLen * t}
              stroke={mix(p.fruitColor, '#7A3A10', 0.35)} strokeWidth="2" opacity="0.45"
            />
          ))}
        </g>
      )}

      {/* Fronds fan from the crown — a carrot has no single stem. */}
      {Array.from({ length: fronds }).map((_, i) => {
        const spread = fronds === 1 ? 0 : (i / (fronds - 1)) * 2 - 1;
        const angle = spread * 46;
        const len = stemHeight * (0.7 + (1 - Math.abs(spread)) * 0.32);
        const droop = (1 - vigour) * 20 * (spread >= 0 ? 1 : -1);
        return (
          <g key={i} transform={`translate(150 ${soilY - 5}) rotate(${angle + droop})`}>
            <path d={`M0 0 Q 3 ${-len * 0.6} 0 ${-len}`} stroke={stemColor} strokeWidth="3.4" fill="none" strokeLinecap="round" />
            {[0.44, 0.64, 0.82, 0.96].map((t, j) => (
              <g key={t} transform={`translate(0 ${-len * t})`}>
                <g transform="rotate(-52)">
                  <Leaf len={(8 + j * 1.6) * leafScale} dark={leafDark} width={0.5} />
                </g>
                <g transform="rotate(52) scale(-1 1)">
                  <Leaf len={(8 + j * 1.6) * leafScale} dark={leafDark} width={0.5} />
                </g>
              </g>
            ))}
          </g>
        );
      })}
    </>
  );
}

/** Corn: one thick stalk, long arching blades, a cob and a tassel. */
function StalkForm(p: BodyProps) {
  const { soilY, stemHeight, stemTop, leafCount, leafScale, leafDark, stemColor, vigour, mix } = p;

  return (
    <>
      <line
        x1="150" y1={soilY} x2="150" y2={stemTop}
        stroke={stemColor}
        strokeWidth={Math.max(7, 7 + p.pos * 1.1)}
        strokeLinecap="round"
      />

      {/* Long blades arching away from the stalk, alternating sides. */}
      {Array.from({ length: leafCount }).map((_, i) => {
        const t = (i + 1) / (leafCount + 0.5);
        const y = soilY - stemHeight * t;
        const side = i % 2 === 0 ? -1 : 1;
        const len = (40 + i * 3) * leafScale;
        const droop = 14 + (1 - vigour) * 26;
        return (
          <g key={i} transform={`translate(150 ${y}) scale(${side} 1)`}>
            <path
              d={`M0 0 C ${len * 0.45} ${-len * 0.2}, ${len * 0.8} ${droop * 0.3}, ${len} ${droop}
                  C ${len * 0.75} ${droop * 0.1}, ${len * 0.4} ${len * 0.12}, 0 ${7 + i * 0.4} Z`}
              fill="url(#pa-leaf)"
              stroke={leafDark}
              strokeWidth="2.8"
              strokeLinejoin="round"
            />
          </g>
        );
      })}

      {/* The tassel, which is how corn flowers. */}
      {p.showFlowers && (
        <g transform={`translate(150 ${stemTop})`}>
          {[-18, -6, 6, 18].map((deg) => (
            <path
              key={deg}
              d={`M0 0 Q ${deg * 0.6} -14 ${deg} -26`}
              stroke={p.flowerColor}
              strokeWidth="3.2"
              fill="none"
              strokeLinecap="round"
            />
          ))}
        </g>
      )}

      {/* The cob, tucked against the stalk with its silk showing. */}
      {p.showFruit && (
        <g transform={`translate(163 ${stemTop + 50}) rotate(16)`}>
          <ellipse
            rx={9 + Math.min(4, (p.pos - 6) * 3)}
            ry={20 + Math.min(8, (p.pos - 6) * 5)}
            fill={p.fruitColor}
            stroke={mix(p.fruitColor, '#7A5A10', 0.42)}
            strokeWidth="3"
          />
          {[-10, 0, 10].map((dy) => (
            <line key={dy} x1="-6" y1={dy} x2="6" y2={dy} stroke={mix(p.fruitColor, '#7A5A10', 0.3)} strokeWidth="2" opacity="0.55" />
          ))}
          <path d="M0 -21 q 6 -10 14 -13" stroke="#C98A4A" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M0 -21 q 2 -12 8 -17" stroke="#D9A368" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        </g>
      )}
    </>
  );
}

/** Sunflower: a thick stem carrying one big head that nods as it ripens. */
function HeadForm(p: BodyProps) {
  const { soilY, stemHeight, stemTop, leafCount, leafScale, leafDark, stemColor, vigour, mix } = p;
  const headR = p.showFlowers ? 16 + Math.min(12, (p.pos - 5) * 7) : 0;
  // A heavy head tips forward, which is what a real sunflower does once the
  // seeds fill in.
  const nod = p.showFruit ? 10 : 0;

  return (
    <>
      <path
        d={`M150 ${soilY} C 147 ${soilY - stemHeight * 0.5}, 153 ${soilY - stemHeight * 0.8}, 150 ${stemTop}`}
        stroke={stemColor}
        strokeWidth={Math.max(6, 6 + p.pos * 1.1)}
        strokeLinecap="round"
        fill="none"
      />

      {Array.from({ length: leafCount }).map((_, i) => {
        const t = (i + 1) / (leafCount + 0.8);
        const y = soilY - stemHeight * t;
        const side = i % 2 === 0 ? -1 : 1;
        const len = (30 + i * 3.6) * leafScale;
        const droop = (1 - vigour) * 26 * side;
        return (
          <g key={i} transform={`translate(150 ${y}) rotate(${side * 26 + droop}) scale(${side} 1)`}>
            <Leaf len={len} dark={leafDark} width={0.56} />
          </g>
        );
      })}

      {p.showBuds && !p.showFlowers && (
        <g transform={`translate(150 ${stemTop - 4})`}>
          <circle r="11" fill={mix(p.flowerColor, '#7BC96F', 0.55)} stroke={leafDark} strokeWidth="3" />
        </g>
      )}

      {p.showFlowers && (
        <g transform={`translate(150 ${stemTop - headR * 0.45}) rotate(${nod})`}>
          {Array.from({ length: 14 }).map((_, i) => {
            const deg = (i / 14) * 360;
            const rad = (deg * Math.PI) / 180;
            return (
              <ellipse
                key={i}
                cx={Math.cos(rad) * headR * 0.92}
                cy={Math.sin(rad) * headR * 0.92}
                rx={headR * 0.46}
                ry={headR * 0.22}
                fill={p.flowerColor}
                stroke={mix(p.flowerColor, '#8A5A00', 0.4)}
                strokeWidth="2.4"
                transform={`rotate(${deg} ${Math.cos(rad) * headR * 0.92} ${Math.sin(rad) * headR * 0.92})`}
              />
            );
          })}
          <circle r={headR * 0.62} fill="#7A5327" stroke="#53370F" strokeWidth="3" />
          {/* Seeds fill in as it ripens — that is the harvest for a sunflower. */}
          {p.showFruit && [0, 60, 120, 180, 240, 300].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <circle key={deg} cx={Math.cos(rad) * headR * 0.3} cy={Math.sin(rad) * headR * 0.3} r="2.6" fill="#3E270B" />
            );
          })}
        </g>
      )}
    </>
  );
}

/** Herbs: a low clump of many small leaves, harvested as leaves. */
function LeafyForm(p: BodyProps) {
  const { soilY, stemHeight, leafCount, leafScale, leafDark, stemColor, vigour } = p;
  const stems = Math.max(3, Math.min(7, leafCount + 1));

  return (
    <>
      {Array.from({ length: stems }).map((_, i) => {
        const spread = stems === 1 ? 0 : (i / (stems - 1)) * 2 - 1;
        const angle = spread * 38;
        const len = stemHeight * (0.58 + (1 - Math.abs(spread)) * 0.42);
        const droop = (1 - vigour) * 18 * (spread >= 0 ? 1 : -1);
        return (
          <g key={i} transform={`translate(150 ${soilY}) rotate(${angle + droop})`}>
            <line x1="0" y1="0" x2="0" y2={-len} stroke={stemColor} strokeWidth="3.6" strokeLinecap="round" />
            {[0.45, 0.68, 0.88, 1].map((t, j) => (
              <g key={t} transform={`translate(0 ${-len * t})`}>
                <g transform="rotate(-46)">
                  <Leaf len={(10 + j * 2) * leafScale} dark={leafDark} width={0.6} />
                </g>
                <g transform="rotate(46) scale(-1 1)">
                  <Leaf len={(10 + j * 2) * leafScale} dark={leafDark} width={0.6} />
                </g>
              </g>
            ))}
          </g>
        );
      })}

      {/* Herbs bolt rather than fruit: small pale flower spikes at the end. */}
      {p.showFlowers && [-1, 0, 1].map((side) => (
        <g key={side} transform={`translate(${150 + side * 16} ${soilY - stemHeight - 6})`}>
          <ellipse rx="4.5" ry="9" fill={p.flowerColor} stroke={leafDark} strokeWidth="2.2" />
        </g>
      ))}
    </>
  );
}

export function PlantBody(props: BodyProps) {
  switch (props.form) {
    case 'vine': return <VineForm {...props} />;
    case 'root': return <RootForm {...props} />;
    case 'stalk': return <StalkForm {...props} />;
    case 'head': return <HeadForm {...props} />;
    case 'leafy': return <LeafyForm {...props} />;
    default: return <BushForm {...props} />;
  }
}
