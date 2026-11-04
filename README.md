# 🎓 UniReg Pro — Web Tool Xếp Thời Khóa Biểu & Auto Đăng Ký Học Phần Đa Trường

Hệ thống Web App + Universal Extension / Bookmarklet hỗ trợ sinh viên **tất cả các trường Đại học / Cao đẳng tại Việt Nam** lập Thời Khóa Biểu chống trùng lịch, cấu hình bộ chọn phần tử cho từng cổng trường, và tự động chọn/ghi nhận học phần nhanh chóng.

---

## ✨ Tính năng cốt lõi

1. **📅 Xếp Thời Khóa Biểu & Cảnh Báo Trùng Lịch Trực Quan**
   - Thêm từng học phần hoặc nhập nhanh hàng loạt mã lớp học phần.
   - Tự động kiểm tra giao nhau về Thứ / Tiết học và hiển thị cảnh báo đỏ ngay trên lưới Thời Khóa Biểu (Thứ 2 → Chủ nhật × Tiết 1 → Tiết 12).
2. **🏫 Hỗ Trợ Đa Trường (Preset + Visual Element Picker 🎯)**
   - Tích hợp sẵn cấu hình nhận diện cho các hệ thống cổng ĐKMH phổ biến nhất:
     - **Tự động nhận diện thông minh (Smart Auto-Detect — Mọi trường)**
     - **ĐHQG Hà Nội (VNU Portal — `dangkyhoc.vnu.edu.vn`)**
     - **Hệ thống Edusoft.Net / AQTech** (HUTECH, PTIT, SGU, TDTU, ĐH Nông Lâm, TNMT...)
     - **Hệ thống PSC UIS / MyUIS** (UEH, HCMUTE, HUIT, ĐH Luật, ĐH Ngân Hàng, ĐH Mở...)
     - **ĐH Bách Khoa (HUST CTT / SIS)**
   - **Chế độ Click chọn phần tử (Visual Picker 🎯)**: Cho phép click trực tiếp vào ô chọn hoặc nút Lưu trên bất kỳ cổng trường nào để công cụ tự động học CSS Selector.
3. **🗂️ Quản Lý & Chia Sẻ Profile Theo Trường / Học Kỳ**
   - Lưu nhiều cấu hình (Profile) và xuất/nhập gói JSON (gồm cả Profile trường + Danh sách môn học) để chia sẻ cho bạn bè cùng lớp.
4. **🚀 Tạo Bookmarklet 1-Click, Userscript (`.user.js`) & Universal Chrome Extension**
   - Kéo thả Bookmarklet lên thanh dấu trang để sử dụng trên mọi trình duyệt mà không cần cài đặt phức tạp.
   - Hoặc cài đặt thư mục `extension/` dưới dạng Chrome Extension (Manifest V3).

---

## 📂 Cấu trúc thư mục

- `index.html`, `app.css`, `app.js` (và `webapp/`): Giao diện và logic của Web App Trung Tâm **UniReg Pro**.
- `extension/`: Bộ mã nguồn **Universal Chrome Extension (Manifest V3)** + Userscript (`autodkmh.user.js`) + trang giả lập `mock-portal.html`.
- `vercel.json`: Cấu hình triển khai trên Vercel.
