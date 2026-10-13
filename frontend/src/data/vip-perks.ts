import type { IconName } from '@/components/icons/SproutyIcon';

/**
 * What a VIP plan gives, in a line each, for the plan cards. Every plan gives
 * all of it: a month and a year differ only in length and price. The full
 * comparison with a regular account is the table in VipBenefits.
 */
export const VIP_PERKS: Array<{ icon: IconName; label: string }> = [
  { icon: 'shield', label: 'Bộ chăm tự động giữ cây không héo khô' },
  { icon: 'chat', label: 'Hỏi Plant Buddy AI không giới hạn' },
  { icon: 'album', label: 'Ảnh, video kỷ niệm không giới hạn' },
  { icon: 'leaf', label: 'Cây đung đưa theo gió, bật quạt càng rung rinh' },
  { icon: 'moon', label: 'Khung cảnh 3D và chậu trang trí đặc biệt' },
  { icon: 'star', label: 'Huy hiệu VIP trên tài khoản' },
];
