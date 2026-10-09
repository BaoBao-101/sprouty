const rows = [
  ['Kích hoạt cây đã mua', 'Có', 'Có'],
  ['Tưới, bón phân, chăm sóc', 'Đầy đủ', 'Đầy đủ'],
  ['Thiết bị mô phỏng', 'Mở theo giai đoạn cây', 'Mở theo giai đoạn cây'],
  ['Ảnh / video kỷ niệm', '10 lá mỗi cây', 'Không giới hạn'],
  ['Plant Buddy AI', '5 lượt / ngày', 'Không giới hạn lượt hỏi'],
  ['Khung cảnh 3D', 'Theo ngày và đêm', 'Thêm Đêm đầy sao, Nắng mùa thu, Xuân hoa anh đào — có ánh sáng riêng và đom đóm, lá rơi, cánh hoa bay'],
  ['Chậu trang trí', 'Chậu đất cơ bản', 'Thêm đất nung khắc vân, gốm men ngọc viền vàng, sứ men lam vẽ sen'],
  ['Huy hiệu thành viên', 'Thường', 'VIP và ngày hết hạn'],
  ['Đăng ký workshop', 'Giá niêm yết', 'Giá niêm yết'],
];
export function VipBenefits() {
  return <section className="vip-rights">
    <h2>Chăm cây đầy đủ. Mở thêm không gian sáng tạo.</h2>
    <p>Mua cây để gieo trồng. VIP là gói thành viên riêng, không bao gồm cây hay thiết bị vật lý.</p>
    <div className="vip-table-scroll"><table className="vip-rights-table">
      <thead><tr><th scope="col">Quyền lợi</th><th scope="col">Tài khoản thường</th><th scope="col">VIP Garden</th></tr></thead>
      <tbody>{rows.map(([name, regular, vip]) => <tr key={name}><th scope="row">{name}</th><td>{regular}</td><td>{vip}</td></tr>)}</tbody>
    </table></div>
    <div className="vip-rules">
      <p><strong>Thanh toán xong, quyền lợi tự mở.</strong> Gói tháng và năm có cùng quyền lợi. Gia hạn cộng tiếp vào thời hạn còn lại.</p>
      <p><strong>Hết VIP, cây và kỷ niệm vẫn còn.</strong> Bạn tiếp tục chăm cây và xem tất cả ảnh/video. Nếu đã đủ 10 lá, cần gia hạn hoặc giảm xuống dưới giới hạn để thêm lá mới.</p>
      <p>Tài khoản thường dùng chung 5 lượt AI mỗi ngày cho trò chuyện và hướng dẫn cây; làm mới lúc 00:00 giờ Việt Nam. VIP được hỏi không giới hạn lượt trong thời gian gói còn hiệu lực. Yêu cầu AI lỗi không trừ lượt. VIP không rút ngắn thời gian chờ chăm sóc hay tăng tốc cây.</p>
    </div>
  </section>;
}
