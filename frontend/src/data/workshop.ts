/**
 * Workshop page content: gallery captions, the scheduled sessions and the FAQ.
 * Lifted out of the page script so the component stays about behaviour.
 */
export interface LightboxImage {
  src: string;
  caption: string;
}

export const LB_IMAGES = [
  { src:'/assets/images/workshop/1.jpg', caption:'🎁 Bộ kit Sprouty đầy đủ — từ hạt giống đến chậu cây thông minh' },
  { src:'/assets/images/workshop/2.jpg', caption:'🎨 Lớp học đông vui — mỗi bé một chậu cây, mỗi chậu một câu chuyện' },
  { src:'/assets/images/workshop/3.jpg', caption:'✏️ Cùng cô trang trí chậu cây — từng nét vẽ đầu tiên' },
  { src:'/assets/images/workshop/4.jpg', caption:'🌈 Thành quả tự hào — bé khoe chậu cây Rainbow của mình' },
  { src:'/assets/images/workshop/5.jpg', caption:'🌶 Cận cảnh chậu Rainbow — cây ớt đã ra hoa' },
  { src:'/assets/images/workshop/6.jpg', caption:'🖌 Hướng dẫn viên vẽ mẫu — bé quan sát và học theo' },
  { src:'/assets/images/workshop/7.jpg', caption:'🎀 Món quà tự tay làm — gói ghém yêu thương' },
  { src:'/assets/images/workshop/8.jpg', caption:'🖍 Tỉ mỉ từng nét cọ — sắc màu của riêng bé' },
  { src:'/assets/images/workshop/9.jpg', caption:'🧐 Tập trung tuyệt đối — khoảnh khắc sáng tạo của bé' },
  { src:'/assets/images/workshop/10.jpg', caption:'🏆 Sản phẩm hoàn thiện — chậu cây mang dấu ấn riêng của bé' },
];

export const FAQS = [
  ['Ba mẹ có cần ở lại trong buổi workshop không?','Chúng tôi khuyến khích phụ huynh ở lại cùng, đặc biệt với bé dưới 6 tuổi. Đây cũng là cơ hội để cả gia đình có kỷ niệm chung. Phụ huynh của bé lớn hơn có thể để bé tham gia độc lập.'],
  ['Cần mang theo gì khi tham gia?','Không cần mang gì cả! Tất cả nguyên liệu, dụng cụ và đồ ăn nhẹ đều được chuẩn bị sẵn. Bé chỉ cần mang theo tâm trạng vui vẻ và tinh thần sáng tạo.'],
  ['Nếu bé chưa từng trồng cây thì có được không?','Hoàn toàn được! Workshop Sprouty thiết kế cho bé mới bắt đầu. Hướng dẫn viên sẽ đồng hành từng bước từ vẽ chậu, gieo hạt đến kích hoạt Plant Buddy.'],
  ['Học phí có bao gồm gì?','Học phí bao gồm bộ kit, hạt giống, đất trồng, màu vẽ, hướng dẫn trực tiếp và ảnh kỷ niệm sau buổi học. Bé mang về chậu cây đã gieo hạt.'],
  ['Có thể đặt lịch workshop riêng cho trường/tổ chức không?','Có! Sprouty cung cấp workshop trồng cây và STEM cho trường học, trung tâm và tổ chức với nội dung tùy chỉnh. Gửi yêu cầu qua trang Liên hệ để biết thêm.'],
  ['Chính sách hủy và hoàn tiền thế nào?','Hủy trước 3 ngày — hoàn tiền 100%. Hủy trong vòng 1–3 ngày — hoàn 50% hoặc chuyển sang buổi khác. Hủy trong ngày — không hoàn tiền nhưng có thể đổi buổi.'],
];
