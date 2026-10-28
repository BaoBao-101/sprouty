/** Instant editable names based on the album stage, not image recognition. */
export function albumCaptionSuggestions(plant: string, stage: string, label: string): string[] {
  const names: Record<string, string[]> = {
    seed: ['Bắt đầu một hành trình xanh', 'Gửi ước mơ vào hạt nhỏ'],
    sprout: ['Nhật ký mầm xanh', 'Một khởi đầu bé xíu'],
    seedling: ['Cùng cây lớn từng ngày', 'Tuổi thơ của cây'],
    vegetative: ['Thêm một ngày xanh', 'Nhật ký lớn lên'],
    budding: ['Chờ một mùa hoa', 'Một chặng mới của cây'],
    flowering: ['Nhật ký mùa hoa', 'Lưu lại một mùa thương'],
    fruiting: ['Chờ ngày hái quả', 'Nhật ký mùa quả'],
    mature: ['Kỷ niệm mùa thu hoạch', 'Khép lại một hành trình xanh'],
  };
  const contextual = [plant.trim().slice(0, 60), label.trim()].filter(Boolean).join(' · ');
  return [...new Set([...(names[stage] || ['Một chút xanh hôm nay', 'Kỷ niệm cùng cây']), contextual || 'Cây và những ngày đáng nhớ'])].map((name) => name.slice(0, 120));
}
