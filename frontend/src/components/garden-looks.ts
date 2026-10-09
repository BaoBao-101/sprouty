/**
 * The scenes and pots a garden can wear, in one place.
 *
 * The picker, the 3D viewer, the card thumbnails and the 2D fallback all read
 * this list, so a look added here appears everywhere at once — and a look
 * that exists in one of them but not the others cannot happen.
 *
 * The VIP looks are meant to be unmistakable. The first version of this
 * tinted the sky a shade warmer and drew a band a millimetre wide around the
 * pot; a parent who had paid for it could not tell it was on. Each VIP scene
 * now changes the sky, the light and the air (something is always drifting
 * through it), and each VIP pot has its own shape and glaze, not only a
 * different colour.
 */

export type SceneKey = 'natural' | 'night' | 'autumn' | 'sakura';
export type PotKey = 'plain' | 'terracotta' | 'ceramic' | 'porcelain';

export interface SceneLook {
  key: SceneKey;
  label: string;
  vip: boolean;
  /** What changes, in the words a parent would use. */
  blurb: string;
  /** Swatch for the picker: sky top, sky bottom, ground. */
  swatch: [string, string, string];
}

export interface PotLook {
  key: PotKey;
  label: string;
  vip: boolean;
  blurb: string;
  /** Body and rim colour for the picker's pot drawing. */
  swatch: [string, string];
}

export const SCENES: SceneLook[] = [
  {
    key: 'natural',
    label: 'Theo ngày và đêm',
    vip: false,
    blurb: 'Trời sáng tối theo giờ thật',
    swatch: ['#B9DCE0', '#F3F2DC', '#BFD0A1'],
  },
  {
    key: 'night',
    label: 'Đêm đầy sao',
    vip: true,
    blurb: 'Dải ngân hà, trăng tròn và đom đóm bay quanh cây',
    swatch: ['#0E1838', '#3B3F7A', '#1F3B3A'],
  },
  {
    key: 'autumn',
    label: 'Nắng mùa thu',
    vip: true,
    blurb: 'Hoàng hôn vàng cam, rừng phong đỏ và lá rơi',
    swatch: ['#F7A35C', '#FDE3B0', '#C9873F'],
  },
  {
    key: 'sakura',
    label: 'Xuân hoa anh đào',
    vip: true,
    blurb: 'Cành anh đào nở rộ, cánh hoa hồng bay trong gió',
    swatch: ['#F9D4E3', '#FFF4F6', '#C9DDB0'],
  },
];

export const POTS: PotLook[] = [
  {
    key: 'plain',
    label: 'Chậu đất cơ bản',
    vip: false,
    blurb: 'Chậu đất nung trơn',
    swatch: ['#B87551', '#C98A64'],
  },
  {
    key: 'terracotta',
    label: 'Đất nung khắc vân',
    vip: true,
    blurb: 'Vành cuộn dày, hoa văn nổi và đĩa lót',
    swatch: ['#9E4A2A', '#E0B07A'],
  },
  {
    key: 'ceramic',
    label: 'Gốm men ngọc',
    vip: true,
    blurb: 'Dáng tròn, men bóng và viền vàng',
    swatch: ['#6FA79A', '#D9B45A'],
  },
  {
    key: 'porcelain',
    label: 'Sứ men lam',
    vip: true,
    blurb: 'Sứ trắng vẽ hoa sen xanh lam kiểu Bát Tràng',
    swatch: ['#F4F6FA', '#2D4F9E'],
  },
];

export const sceneLook = (key?: string) => SCENES.find((s) => s.key === key) ?? SCENES[0];
export const potLook = (key?: string) => POTS.find((p) => p.key === key) ?? POTS[0];
