# Phân quyền theo nghiệp vụ

Mỗi tài khoản chỉ có một vai trò. Admin không kế thừa quyền nhân viên hoặc khách hàng.

| Nghiệp vụ | Admin | Nhân viên | Khách hàng |
| --- | --- | --- | --- |
| Quản lý tài khoản, vai trò, trạng thái | Có | Không | Không |
| Quản lý sản phẩm, video, blog, workshop, ảnh người dùng | Có | Không | Không |
| Tra cứu danh mục sản phẩm và đơn hàng | Có | Có | Chỉ đơn của mình |
| Đối soát thanh toán đơn hàng | Có | Không | Không |
| Cập nhật giao hàng, điểm danh | Không | Có | Không |
| Báo cáo, nhật ký, mã kích hoạt | Có | Không | Không |
| Mua hàng, đăng ký workshop, kích hoạt/chăm cây, AI, ảnh cá nhân | Không | Không | Có |

Giao diện chuyển tài khoản nhân sự về khu vực đúng vai trò khi mở trang khách hàng hoặc khu vực nhân sự khác. API kiểm tra vai trò độc lập với giao diện. Các URL API dùng chung vẫn giữ tiền tố `/admin` để tương thích; tiền tố không quyết định quyền truy cập.

Đổi vai trò hoặc vô hiệu hóa tài khoản thu hồi phiên đăng nhập. Không được tự hạ quyền, tự vô hiệu hóa, hoặc xóa quyền admin hoạt động cuối cùng. Thay đổi vai trò được kiểm tra trong giao dịch Serializable. Khách còn VIP cần tài khoản nhân sự riêng để tránh mất quyền lợi.

VIP tặng chỉ dành cho khách đang hoạt động, tạo đơn giá 0. Thu hồi chỉ hủy quyền được cấp tặng (`admin.grant_vip`), giữ gói đã mua. Không sửa lại các khoản doanh thu lịch sử tự động.

Nhân viên chỉ chuyển đơn đã thanh toán theo thứ tự xử lý → giao hàng → hoàn tất; có thể hủy đơn chờ chưa thanh toán. Không mở lại đơn đã hủy/hoàn tất hoặc hủy đơn đã thu tiền qua chức năng giao hàng.

Tạo sản phẩm dùng nút “Tạo sản phẩm”; sửa dùng “Lưu thay đổi sản phẩm”. Video được quản lý riêng sau khi sản phẩm đã được tạo.

Kiểm tra: `node --test --test-isolation=none src/middleware/rbac.test.js src/routes/admin/users.test.js` từ thư mục backend; `npm run typecheck`, `npm run build`, `npm run smoke` từ frontend.
