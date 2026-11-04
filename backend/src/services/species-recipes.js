/**
 * One simple dish per species, for after the harvest: what the family can
 * make with what the child grew. Three short steps each, written for a parent
 * and child together — anything with a knife, a stove or a hot chilli is
 * marked as the parent's part. Shown on the harvest certificate and on the
 * plant's page once it has been picked.
 */
export const SPECIES_RECIPE = {
  bean: {
    title: 'Đậu que xào tỏi',
    steps: [
      'Bé rửa đậu, tước xơ hai đầu rồi bẻ thành khúc ngắn.',
      'Ba mẹ phi thơm tỏi, cho đậu vào xào lửa vừa 3–4 phút.',
      'Nêm một chút muối, bé bày ra đĩa.',
    ],
    note: 'Đậu phải chín hẳn mới ăn — đậu sống dễ đau bụng.',
  },
  carrot: {
    title: 'Cà rốt que chấm sữa chua',
    steps: [
      'Bé rửa sạch củ cà rốt dưới vòi nước.',
      'Ba mẹ gọt vỏ và cắt thành que dài vừa tay bé.',
      'Bé chấm que cà rốt với sữa chua hoặc mè rang.',
    ],
    note: 'Lá cà rốt non cũng thái nhỏ trộn trứng chiên được.',
  },
  corn: {
    title: 'Bắp luộc',
    steps: [
      'Bé bóc lớp lá bao và gỡ hết râu bắp.',
      'Ba mẹ luộc bắp khoảng 15 phút cho chín mềm.',
      'Để nguội bớt rồi cả nhà cùng ăn.',
    ],
    note: 'Râu bắp phơi khô nấu nước uống mát.',
  },
  pepper: {
    title: 'Muối ớt chấm trái cây (cho ba mẹ)',
    steps: [
      'Ba mẹ đeo găng, bỏ cuống và băm nhỏ trái ớt.',
      'Trộn ớt với muối và một chút đường.',
      'Chấm cùng xoài, ổi — phần không cay để dành cho bé.',
    ],
    note: 'Ớt rất cay: bé không dụi mắt và rửa tay ngay sau khi chạm vào.',
  },
  sunflower: {
    title: 'Hạt hướng dương rang',
    steps: [
      'Phơi bông thật khô, bé gỡ từng hạt ra khỏi đĩa hoa.',
      'Rửa hạt và ngâm nước muối nhạt qua đêm.',
      'Ba mẹ rang hoặc nướng 15 phút đến khi hạt giòn thơm.',
    ],
    note: 'Giữ lại vài hạt to, khô để gieo vụ sau.',
  },
  tomato: {
    title: 'Salad cà chua',
    steps: [
      'Bé rửa sạch những quả cà chua đã chín đỏ.',
      'Ba mẹ cắt múi, bé trộn với chút dầu ô liu và muối.',
      'Rắc vài lá húng lên trên rồi ăn kèm bánh mì.',
    ],
    note: 'Quả còn xanh để thêm vài ngày ở chỗ thoáng sẽ chín tiếp.',
  },
  herb: {
    title: 'Trứng chiên húng quế',
    steps: [
      'Bé ngắt lá non, rửa sạch và để ráo.',
      'Xé nhỏ lá, đánh cùng trứng và một chút muối.',
      'Ba mẹ chiên vàng hai mặt.',
    ],
    note: 'Ngắt ngọn chừa lại đôi lá dưới, cây sẽ đâm nhánh mới.',
  },
};

/** The dish for a species key, or null for the generic fallback. */
export function speciesRecipe(key) {
  return SPECIES_RECIPE[key] || null;
}
