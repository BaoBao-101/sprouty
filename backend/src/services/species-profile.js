/**
 * Who each species is: its botanical name and family, where it comes from,
 * how it reached us, and a few things a child can look for while caring for
 * it. Shown to a parent on the kit's page and to the child on the plant's
 * page; a kit takes its profile from the species the admin picked
 * (speciesKey), so there is nothing to write when a product is created.
 *
 * Kept to what is well established (origin, domestication, family); the
 * simulation's own care notes are in species-care.js.
 */
export const SPECIES_PROFILE = {
  bean: {
    scientificName: 'Phaseolus vulgaris',
    family: 'Họ Đậu (Fabaceae)',
    otherNames: ['đậu cô ve', 'đậu que'],
    origin: 'Châu Mỹ: vùng Mexico, Trung Mỹ và dãy núi Andes ở Nam Mỹ.',
    story: 'Người bản địa châu Mỹ đã thuần hoá cây đậu từ khoảng 8.000 năm trước, trồng chung với ngô và bí. Thế kỷ 16, các thuỷ thủ mang hạt đậu sang châu Âu, rồi từ đó đậu theo các thương thuyền tới châu Á. Ở Việt Nam, đậu được trồng nhiều ở Đà Lạt và các vụ đông miền Bắc.',
    traits: [
      'Thân leo, tự quấn quanh cọc hoặc giàn để vươn lên cao.',
      'Mỗi lá có ba lá chét nhỏ mọc chung một cuống.',
      'Hoa tự thụ phấn rồi kết thành quả dài chứa hạt bên trong.',
    ],
    funFacts: [
      'Rễ đậu có những nốt sần nhỏ — nơi vi khuẩn có ích sống và giúp đất thêm chất đạm.',
      'Tên "cô ve" bắt nguồn từ tiếng Pháp "haricot vert", nghĩa là đậu quả xanh.',
      'Người châu Mỹ xưa trồng ngô, đậu và bí cạnh nhau, gọi là "ba chị em": ngô làm cọc cho đậu leo, bí che mát gốc.',
    ],
  },
  carrot: {
    scientificName: 'Daucus carota subsp. sativus',
    family: 'Họ Hoa tán (Apiaceae)',
    otherNames: ['cà-rốt'],
    origin: 'Trung Á: vùng Afghanistan và Iran ngày nay.',
    story: 'Cà rốt được thuần hoá từ cà rốt dại hơn 1.000 năm trước. Những củ đầu tiên có màu tím và vàng; cà rốt màu cam như ngày nay được các nhà vườn Hà Lan chọn lọc vào khoảng thế kỷ 17. Ở Việt Nam, cà rốt trồng nhiều ở Đà Lạt (Lâm Đồng) và Hải Dương.',
    traits: [
      'Phần ăn được là rễ cái phình to, lớn dần dưới mặt đất.',
      'Lá xẻ nhỏ mềm như lông chim, mọc thành chùm trên mặt đất.',
      'Cây sống hai năm: năm đầu tích chất ngọt vào củ, năm sau mới ra hoa trắng hình chiếc ô.',
    ],
    funFacts: [
      'Màu cam đến từ beta-caroten — chất cơ thể biến thành vitamin A, rất tốt cho đôi mắt.',
      'Cà rốt là họ hàng của rau mùi và thì là — vò lá đều có mùi thơm.',
      'Củ cà rốt mọc thẳng xuống đất, nên đất càng tơi xốp thì củ càng dài và thẳng.',
    ],
  },
  corn: {
    scientificName: 'Zea mays',
    family: 'Họ Lúa (Poaceae)',
    otherNames: ['ngô', 'bắp'],
    origin: 'Miền nam Mexico, Trung Mỹ.',
    story: 'Khoảng 9.000 năm trước, người bản địa Mexico đã chọn lọc một loài cỏ dại tên là teosinte, hạt nhỏ và cứng, thành cây ngô bắp to hạt mẩy. Cuối thế kỷ 15, Columbus mang ngô về châu Âu; ngô theo đường Trung Quốc tới Việt Nam vào khoảng thế kỷ 16–17. Miền Bắc gọi là ngô, miền Nam gọi là bắp.',
    traits: [
      'Thân thẳng có nhiều đốt, lá dài ôm quanh thân, cây có thể cao hơn người lớn.',
      'Hoa đực là "cờ" trên ngọn, hoa cái là "râu" ở nách lá.',
      'Ngô thụ phấn nhờ gió: phấn từ cờ rơi xuống những sợi râu.',
    ],
    funFacts: [
      'Mỗi sợi râu ngô dẫn tới đúng một hạt — râu nào nhận được phấn thì hạt đó mới mẩy.',
      'Một bắp ngô hầu như luôn có số hàng hạt chẵn, thường là 14 hoặc 16 hàng.',
      'Ngô là một trong ba cây lương thực quan trọng nhất thế giới, cùng lúa gạo và lúa mì.',
    ],
  },
  pepper: {
    scientificName: 'Capsicum annuum',
    family: 'Họ Cà (Solanaceae)',
    otherNames: ['ớt chỉ thiên', 'ớt sừng'],
    origin: 'Châu Mỹ: vùng Mexico và Trung Mỹ.',
    story: 'Người bản địa Mexico đã trồng ớt từ khoảng 6.000 năm trước. Năm 1493, đoàn tàu của Columbus mang ớt về Tây Ban Nha; sau đó các thương nhân Bồ Đào Nha đưa ớt đi khắp châu Phi và châu Á chỉ trong vài chục năm. Ngày nay ớt có mặt trong bữa ăn của hầu hết gia đình Việt.',
    traits: [
      'Cây bụi thấp, phân nhiều nhánh, lá xanh bóng.',
      'Hoa nhỏ màu trắng mọc ở nách lá, có thể tự thụ phấn.',
      'Quả non màu xanh, chín chuyển sang đỏ, cam hoặc vàng tuỳ giống.',
    ],
    funFacts: [
      'Vị cay không nằm ở hạt mà ở phần gân trắng giữ hạt bên trong quả.',
      'Chim không thấy cay — nên chim ăn ớt và mang hạt đi gieo ở khắp nơi.',
      'Ớt là họ hàng của cà chua và khoai tây; quả ớt chín có rất nhiều vitamin C.',
    ],
  },
  sunflower: {
    scientificName: 'Helianthus annuus',
    family: 'Họ Cúc (Asteraceae)',
    otherNames: ['hoa mặt trời', 'quỳ'],
    origin: 'Bắc Mỹ.',
    story: 'Người bản địa Bắc Mỹ đã trồng hướng dương để lấy hạt từ hơn 4.000 năm trước. Thế kỷ 16, hướng dương sang châu Âu làm cây cảnh, rồi người Nga biến nó thành cây lấy dầu quan trọng. Ở Việt Nam, những cánh đồng hướng dương ở Nghĩa Đàn (Nghệ An) và Đà Lạt nổi tiếng mỗi mùa hoa.',
    traits: [
      'Thân đứng, lá to có răng cưa, cây ưa nắng.',
      'Một "bông" thật ra là hàng trăm hoa nhỏ: cánh vàng ở viền và hoa ống ở giữa.',
      'Mỗi hoa ống ở giữa đĩa sẽ thành một hạt hướng dương.',
    ],
    funFacts: [
      'Khi còn là nụ, hướng dương quay theo mặt trời từ đông sang tây; nở hẳn rồi thì đứng yên nhìn về hướng đông.',
      'Hạt trên đĩa hoa xếp thành những đường xoắn ốc rất đều — một trò chơi đếm số thú vị cho bé.',
      'Tên khoa học Helianthus nghĩa là "hoa mặt trời" trong tiếng Hy Lạp.',
    ],
  },
  tomato: {
    scientificName: 'Solanum lycopersicum',
    family: 'Họ Cà (Solanaceae)',
    otherNames: ['cà chua'],
    origin: 'Nam Mỹ: vùng núi Andes (Peru, Ecuador), nơi còn cà chua dại quả nhỏ.',
    story: 'Cà chua dại từ Nam Mỹ được người Mexico thuần hoá thành quả to. Thế kỷ 16, cà chua tới châu Âu; người Ý gọi nó là "pomodoro" — quả táo vàng — vì những quả đầu tiên có màu vàng. Ngày nay cà chua được trồng nhiều ở Đà Lạt (Lâm Đồng) và các tỉnh đồng bằng sông Hồng.',
    traits: [
      'Thân mềm, có lông tơ và mùi đặc trưng, cần cọc đỡ khi cây lớn.',
      'Hoa vàng nhỏ mọc thành chùm, tự thụ phấn khi được rung nhẹ.',
      'Quả xanh lớn dần rồi chuyển đỏ khi chín.',
    ],
    funFacts: [
      'Theo thực vật học, cà chua là một loại quả mọng — dù ta thường nấu nó như rau.',
      'Màu đỏ đến từ lycopen, một chất chống ô xy hoá có lợi cho cơ thể.',
      'Người châu Âu từng chỉ trồng cà chua làm cảnh, vì tưởng nó độc như vài họ hàng của nó.',
    ],
  },
  herb: {
    scientificName: 'Ocimum basilicum',
    family: 'Họ Hoa môi (Lamiaceae)',
    otherNames: ['húng quế', 'rau quế'],
    origin: 'Vùng nhiệt đới châu Á, quanh Ấn Độ.',
    story: 'Húng quế đã được trồng ở Ấn Độ từ hàng nghìn năm trước, rồi theo các con đường buôn bán gia vị sang Trung Đông và châu Âu. Ở Việt Nam, húng quế là rau thơm không thể thiếu khi ăn phở, bún bò và nhiều món cuốn.',
    traits: [
      'Thân vuông, lá mọc đối nhau từng cặp.',
      'Lá xanh bóng, vò nhẹ là dậy mùi thơm.',
      'Hoa nhỏ màu trắng hoặc tím mọc thành bông ở ngọn.',
    ],
    funFacts: [
      'Sờ thân húng quế sẽ thấy hình vuông — đặc điểm của cả họ Hoa môi, họ hàng với bạc hà, tía tô, kinh giới.',
      'Mùi thơm đến từ tinh dầu trong những tuyến li ti trên lá.',
      'Ngắt bớt ngọn và hoa thì cây đâm thêm nhánh, cho nhiều lá hơn.',
    ],
  },
};

/** The profile for a species key, or null for the generic fallback. */
export function speciesProfile(key) {
  return SPECIES_PROFILE[key] || null;
}
