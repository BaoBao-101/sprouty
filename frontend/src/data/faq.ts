/**
 * FAQ content. Answers contain a little inline HTML (<strong>, links), which is
 * why the component renders them with dangerouslySetInnerHTML — the text is
 * authored here, never user input.
 */
export interface FaqEntry {
  q: string;
  a: string;
}

export type FaqGroupKey = keyof typeof FAQ_DATA;

export const FAQ_DATA = {
  orders: [
    { q:'Tôi có thể đặt hàng bằng những cách nào?', a:'Bạn có thể đặt hàng trực tiếp trên website Sprouty. Chọn sản phẩm yêu thích, thêm vào giỏ hàng và tiến hành thanh toán. Hiện tại chúng tôi nhận đặt hàng 24/7 qua website.' },
    { q:'Các phương thức thanh toán nào được chấp nhận?', a:'Sprouty chấp nhận thanh toán qua: chuyển khoản ngân hàng, ví điện tử MoMo, ZaloPay, VNPay, và và các ví điện tử. Vì sản phẩm là cây mô phỏng kích hoạt ngay trên web nên không có hình thức COD.' },
    { q:'Tôi có thể đặt hàng mà không cần tài khoản không?', a:'Có! Bạn có thể mua hàng mà không cần tạo tài khoản. Tuy nhiên, nếu có tài khoản, bạn sẽ được xem <strong>video hướng dẫn</strong>, theo dõi đơn hàng và nhận ưu đãi riêng.' },
    { q:'Đơn hàng của tôi có thể bị huỷ không?', a:'Bạn có thể huỷ đơn hàng trong vòng <strong>2 giờ</strong> sau khi đặt, trước khi chúng tôi xử lý. Sau khi đơn được xử lý, vui lòng liên hệ hotline để được hỗ trợ. Xem thêm <a href="/returns">chính sách đổi trả</a>.' },
    { q:'Tôi có thể đặt nhiều sản phẩm trong một đơn không?', a:'Hoàn toàn được! Bạn có thể thêm bao nhiêu sản phẩm vào giỏ hàng tùy ý và thanh toán một lần. Mỗi bộ kit trong đơn sẽ có một mã kích hoạt riêng.' },
    { q:'Sprouty có xuất hóa đơn VAT không?', a:'Có. Nếu bạn cần hóa đơn VAT, vui lòng ghi rõ thông tin doanh nghiệp (MST, địa chỉ) trong phần ghi chú khi đặt hàng hoặc gửi yêu cầu qua trang <a href="/contact">Liên hệ</a> trong vòng 48 giờ sau khi thanh toán.' },
  ],
  // Sprouty no longer ships anything: a kit is a simulated plant unlocked by
  // an activation code. This group used to promise nationwide delivery, GHTK
  // tracking numbers and damage-in-transit replacements, none of which exist.
  activation: [
    { q:'Mua xong thì tôi nhận được gì?', a:'Ngay sau khi thanh toán thành công, bạn nhận một <strong>mã kích hoạt</strong> hiển thị trong mục <a href="/account">Đơn hàng của tôi</a>. Sprouty không giao hàng vật lý — tất cả diễn ra trên web.' },
    { q:'Kích hoạt cây ở đâu?', a:'Vào mục <a href="/my-plants">Cây của tôi</a>, nhập mã kích hoạt và đặt tên cho cây. Hạt sẽ được gieo ngay và bạn bắt đầu chăm cây cùng Plant Buddy AI.' },
    { q:'Mã kích hoạt dùng được mấy lần?', a:'Mỗi mã chỉ dùng được <strong>một lần</strong> và gắn với một bộ kit. Nếu bạn mua nhiều kit, mỗi kit có mã riêng và trở thành một cây riêng trong vườn của bạn.' },
    { q:'Tôi mất mã kích hoạt thì sao?', a:'Mã không bao giờ mất: nó luôn hiển thị lại trong <a href="/account">Đơn hàng của tôi</a> ứng với đơn đã thanh toán. Nếu vẫn không thấy, hãy <a href="/contact">liên hệ</a> với chúng tôi.' },
    { q:'Cây mất bao lâu để lớn?', a:'Mỗi việc chăm cây có <strong>thời gian hồi</strong> riêng (tưới nước 4 giờ, bón phân 20 giờ...), nên cây lớn dần theo ngày thật. Chăm đều đặn mỗi ngày thì khoảng <strong>2–3 tuần</strong> là tới ngày thu hoạch.' },
    { q:'Tôi bận vài ngày không vào chăm thì cây có chết không?', a:'Cây <strong>không bao giờ chết</strong> — cùng lắm là héo và ngừng lớn, chăm lại vài hôm là hồi phục. Bạn cũng có thể bật <strong>bơm tưới tự động</strong> (mở ở giai đoạn Cây con) để giữ ẩm khi đi vắng.' },
    { q:'Bản Smart khác bản Standard chỗ nào?', a:'Bản Standard mở dần 8 thiết bị IoT theo từng giai đoạn cây lớn. Bản <strong>Smart</strong> mở sẵn <strong>cả 8 thiết bị ngay từ ngày đầu</strong> — có bơm tưới, đèn trồng cây và quạt tự động từ lúc còn là hạt.' },
  ],
  product: [
    { q:'Nguyên liệu trong các bộ kit có an toàn cho trẻ em không?', a:'An toàn là ưu tiên số 1 của Sprouty. Tất cả nguyên liệu đều được kiểm tra và đạt chuẩn an toàn cho trẻ em: kéo đầu tròn không sắc, keo không độc hại, màu vẽ đạt tiêu chuẩn EN71 và ASTM F963. Phụ huynh hoàn toàn yên tâm.' },
    { q:'Bộ kit phù hợp với độ tuổi nào?', a:'Sprouty có sản phẩm cho bé từ <strong>4–12 tuổi</strong>. Mỗi sản phẩm đều ghi rõ độ tuổi khuyến nghị. Với bé dưới 6 tuổi, chúng tôi khuyến khích có phụ huynh ngồi cùng, đặc biệt ở các bước cắt và dùng keo.' },
    { q:'Bộ kit có đủ nguyên liệu cho bao nhiêu lần làm?', a:'Mỗi bộ kit Sprouty có đủ nguyên liệu để hoàn thành <strong>1 kỷ niệm hoàn chỉnh</strong> theo hướng dẫn, với một ít nguyên liệu dư để bé thử nghiệm sáng tạo thêm. Nếu muốn làm lại, bạn có thể mua thêm nguyên liệu riêng.' },
    { q:'Video hướng dẫn có tính phí không?', a:'Video hướng dẫn được cung cấp <strong>miễn phí</strong> cho tất cả khách hàng đã mua kit tương ứng. Bạn cần tạo tài khoản và đăng nhập để xem. Mỗi tài khoản có thể xem lại video không giới hạn số lần.' },
    { q:'Tôi không tìm thấy kit phù hợp với bé, phải làm gì?', a:'Hãy sử dụng tính năng <a href="/ai"><strong>Trợ lý AI</strong></a> — AI Sprouty sẽ hỏi về độ tuổi, sở thích và kỹ năng hiện tại của bé để gợi ý kit phù hợp nhất. Hoặc liên hệ đội ngũ hỗ trợ qua trang <a href="/contact">Liên hệ</a>.' },
    { q:'Sprouty có bán nguyên liệu rời không?', a:'Hiện tại chúng tôi chỉ bán theo bộ kit hoàn chỉnh. Chúng tôi đang nghiên cứu cung cấp nguyên liệu bổ sung trong tương lai. Theo dõi các kênh cập nhật của Sprouty để biết thêm.' },
    { q:'Gói thành viên "VIP Garden" hoạt động như thế nào?', a:'Sau khi đăng ký, bạn sẽ nhận 1 bộ kit mới được giao vào đầu mỗi tháng trong 12 tháng liên tiếp. Gói bao gồm 12 kit + 2 sách hướng dẫn + AI không giới hạn + ưu tiên đăng ký workshop. Tiết kiệm hơn mua lẻ 100.000đ.' },
  ],
  account: [
    { q:'Tạo tài khoản có mất phí không?', a:'Hoàn toàn miễn phí! Bạn có thể tạo tài khoản với email bất kỳ trong vài giây. Tài khoản cho phép xem video hướng dẫn, theo dõi đơn hàng và lưu hành trình sáng tạo của bé.' },
    { q:'Tôi quên mật khẩu, phải làm gì?', a:'Hiện tại tính năng quên mật khẩu đang được phát triển. Vui lòng gửi yêu cầu qua trang <a href="/contact">Liên hệ</a> với tiêu đề "Quên mật khẩu" kèm email đăng ký, chúng tôi sẽ hỗ trợ đặt lại trong vòng 2 giờ.' },
    { q:'Một tài khoản có thể dùng cho nhiều bé không?', a:'Có! Một tài khoản có thể quản lý hành trình sáng tạo của nhiều bé. Bạn sẽ thấy tất cả các kit đã mua và video tương ứng trong phần <strong>"Sản phẩm của tôi"</strong>.' },
    { q:'Video hướng dẫn có thể tải về xem offline không?', a:'Hiện tại video chỉ có thể xem online trong ứng dụng Sprouty. Tính năng tải về đang được phát triển và sẽ ra mắt trong thời gian tới. Chúng tôi sẽ thông báo qua email khi tính năng này sẵn sàng.' },
    { q:'Nếu tôi mất tài khoản, tôi có còn xem được video không?', a:'Video hướng dẫn được liên kết với đơn hàng đã mua. Nếu mất quyền truy cập tài khoản, liên hệ hỗ trợ kèm bằng chứng mua hàng (email xác nhận đơn, ảnh hóa đơn) để chúng tôi phục hồi quyền truy cập.' },
  ],
  ai: [
    { q:'Plant Buddy AI là gì?', a:'AI Sprouty là trợ lý thông minh được đào tạo để hỗ trợ phụ huynh và bé trong hành trình trồng cây. AI có thể gợi ý kit phù hợp, hướng dẫn kỹ thuật, phân tích kỷ niệm của bé và trả lời mọi câu hỏi về sản phẩm.' },
    { q:'AI có hiểu tiếng Việt không?', a:'Có! AI Sprouty được thiết lập để hiểu và trả lời <strong>hoàn toàn bằng tiếng Việt</strong>, theo phong cách thân thiện, gần gũi phù hợp với trẻ em và phụ huynh Việt Nam.' },
    { q:'Tôi có thể upload ảnh kỷ niệm để AI nhận xét không?', a:'Có, nhưng tính năng phân tích ảnh yêu cầu <strong>đăng nhập</strong>. Sau khi đăng nhập, bạn có thể upload ảnh kỷ niệm và AI sẽ đưa ra nhận xét chi tiết, khích lệ bé và gợi ý cải thiện.' },
    { q:'AI Sprouty có giới hạn số tin nhắn không?', a:'Người dùng chưa đăng nhập: giới hạn 5 câu hỏi/ngày. Thành viên đăng nhập: không giới hạn. Thành viên gói "VIP Garden": ưu tiên phản hồi nhanh hơn.' },
    { q:'AI có thể thay thế video hướng dẫn không?', a:'AI bổ sung cho video hướng dẫn, không thay thế. Video cho bé nhìn thấy từng bước cụ thể, còn AI giúp giải thích thêm, trả lời câu hỏi phát sinh và hỗ trợ khi bé gặp khó khăn ở bước cụ thể.' },
  ],
  workshop: [
    { q:'Workshop Sprouty dành cho ai?', a:'Workshop dành cho bé từ <strong>4–12 tuổi</strong>. Một số buổi đặc biệt dành cho bé lớn hơn với kỹ thuật nâng cao. Mỗi buổi workshop đều ghi rõ độ tuổi phù hợp.' },
    { q:'Phụ huynh có cần ở lại suốt buổi không?', a:'Với bé dưới 6 tuổi, chúng tôi yêu cầu phụ huynh ở lại. Bé từ 6 tuổi trở lên có thể tham gia độc lập. Chúng tôi khuyến khích phụ huynh ở lại để cùng tạo kỷ niệm gia đình.' },
    { q:'Workshop tổ chức ở đâu và vào khi nào?', a:'Workshop diễn ra tại TP.HCM, địa điểm cụ thể được xác nhận khi đăng ký, chủ yếu vào cuối tuần (Thứ 7 và Chủ nhật). Xem lịch cụ thể tại <a href="/workshop">trang Workshop</a>.' },
    { q:'Nếu bé bệnh không đến được, có thể hoàn tiền không?', a:'Nếu thông báo trước 24 giờ, chúng tôi sẽ cho phép đổi sang buổi khác (trong vòng 30 ngày). Nếu thông báo quá muộn, chúng tôi không thể hoàn tiền nhưng vẫn có thể đổi lịch 1 lần.' },
    { q:'Sprouty có tổ chức workshop riêng cho trường/lớp không?', a:'Có! Sprouty cung cấp chương trình workshop giáo dục cho trường học, trung tâm và các tổ chức với mức giá ưu đãi và nội dung tùy chỉnh theo chương trình học. Gửi yêu cầu qua trang <a href="/contact">Liên hệ</a> để biết thêm.' },
  ],
  returns: [
    { q:'Chính sách đổi trả của Sprouty là gì?', a:'Sprouty chấp nhận đổi trả trong vòng <strong>7 ngày</strong> kể từ ngày nhận hàng, với điều kiện sản phẩm chưa mở hộp/chưa sử dụng và còn nguyên vẹn. Xem chi tiết tại <a href="/returns">trang chính sách đổi trả</a>.' },
    { q:'Tôi nhận được sản phẩm sai, phải làm gì?', a:'Xin lỗi vì sự nhầm lẫn này! Gửi yêu cầu qua trang <a href="/contact">Liên hệ</a> kèm ảnh sản phẩm và mã đơn hàng. Chúng tôi sẽ gửi đúng sản phẩm và thu lại sản phẩm sai trong vòng 48 giờ, hoàn toàn miễn phí.' },
    { q:'Quy trình hoàn tiền như thế nào?', a:'Sau khi yêu cầu đổi trả được xác nhận và chúng tôi nhận lại hàng, hoàn tiền sẽ được xử lý trong <strong>3–5 ngày làm việc</strong> qua phương thức thanh toán ban đầu. Với chuyển khoản, thời gian có thể là 1–2 ngày làm việc.' },
  ],
};
