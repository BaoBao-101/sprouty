import { useState } from 'react';
import { SproutyIcon } from '@/components/icons/SproutyIcon';

/** The illustrated icons there are, by the species of the plant a kit grows. */
const BY_SPECIES: Record<string, string> = {
  bean: 'Bean',
  carrot: 'Carrot',
  corn: 'Corn',
  pepper: 'FirePepper',
  sunflower: 'SunFlower',
  tomato: 'Tomato',
};

/** The seeded products by name, old and new, for callers without a species. */
const BY_NAME: Record<string, string> = {
  Bean: 'Bean', 'Đậu Leo Xanh': 'Bean',
  Carrot: 'Carrot', 'Cà Rốt Cam': 'Carrot',
  Corn: 'Corn', 'Bắp Ngô Vàng': 'Corn',
  FirePepper: 'FirePepper', 'Ớt Lửa': 'FirePepper',
  SunFlower: 'SunFlower', 'Hướng Dương': 'SunFlower',
  Tomato: 'Tomato', 'Cà Chua Đỏ': 'Tomato',
};

/**
 * A product's icon, chosen by what it is — the plant's species, or a VIP plan
 * — rather than by its name. It used to load "<name>.png", so renaming a
 * product, or the catalogue going Vietnamese, lost every icon. Anything
 * without an illustration gets a plain pot.
 */
export function ProductIcon({
  name,
  species,
  category,
  size = 20,
}: {
  name: string;
  species?: string | null;
  category?: string | null;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const file = category === 'membership'
    ? 'VIP'
    : (species && BY_SPECIES[species]) || BY_NAME[name.trim()] || null;

  return (
    <span className="product-icon" style={{ width: size, height: size }}>
      {failed || !file ? (
        <SproutyIcon name="pot" size={size} />
      ) : (
        <img src={`/assets/images/sprouty-icons/${file}.png`} alt="" onError={() => setFailed(true)} />
      )}
    </span>
  );
}
