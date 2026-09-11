# GDT Invoice Original Downloader

Chrome/Edge extension chạy hoàn toàn local để tải gói ZIP/XML gốc của hóa đơn điện tử từ `hoadondientu.gdt.gov.vn` bằng chính phiên đăng nhập hiện tại.

## Mục tiêu

Không dựng lại template hóa đơn. Tool giữ nguyên gói nguồn TCT trả về, sau đó chỉ tách các file bản thể hiện đã có sẵn trong gói như PDF/HTML/XML.

Nếu XML/HTML gốc chứa link tới hệ thống nhà cung cấp, extension nhận diện và hiển thị link đó để người dùng tự mở. Tool không đoán URL, không gọi API riêng của nhà cung cấp và không bypass đăng nhập/CAPTCHA.

## Tính năng v0.2

- Tải ZIP gốc từ `/api/query/invoices/export-xml`.
- Hỗ trợ hóa đơn máy tính tiền qua `/api/sco-query/invoices/export-xml`.
- Tự fallback giữa hai route nếu route đầu không phù hợp.
- Tải trang hiện tại hoặc tự chạy từ trang 1 đến trang cuối của bảng Ant Design.
- Dedupe hóa đơn giữa các trang và có nút retry các hóa đơn lỗi.
- Tùy chọn tách PDF/HTML/XML có sẵn trong ZIP, nhưng vẫn luôn giữ ZIP gốc.
- Nhận diện link nguồn Viettel S-Invoice, VNPT Invoice, MISA meInvoice, FPT.eInvoice và các host khác nếu link thực sự có trong dữ liệu gốc.
- Không gửi MST, token hay dữ liệu hóa đơn tới server bên thứ ba.

## Cài đặt

1. Tải ZIP từ GitHub Releases và giải nén.
2. Mở `chrome://extensions` hoặc `edge://extensions`.
3. Bật **Developer mode**.
4. Chọn **Load unpacked** và trỏ tới thư mục vừa giải nén.
5. Đăng nhập cổng HĐĐT TCT theo cách bình thường.
6. Mở trang tra cứu có bảng hóa đơn.

Extension hiển thị panel **GDT Original** ở góc dưới phải.

### Tải trang hiện tại

Bấm **Tải trang hiện tại** để tải các hóa đơn đang hiển thị.

### Tải tất cả trang

Bấm **Tải tất cả trang**. Extension sẽ cố quay về trang 1, tải từng trang, chờ bảng đổi dữ liệu rồi đi tiếp đến khi nút Next bị disable.

Nếu trình duyệt hỏi quyền tải nhiều file, cần chọn **Allow multiple downloads** để tách PDF/HTML/XML hoạt động đầy đủ.

## Dữ liệu được dùng

Mỗi dòng cần đọc được bốn khóa:

- MST người bán (`nbmst`)
- Ký hiệu mẫu số (`khmshdon`)
- Ký hiệu hóa đơn (`khhdon`)
- Số hóa đơn (`shdon`)

Tool validate số hóa đơn và MST trước khi gọi API để giảm rủi ro lệch cột khi giao diện TCT thay đổi.

## Bản thể hiện và provider links

ZIP TCT có thể chỉ có XML, hoặc có thêm PDF/HTML tùy nguồn hóa đơn. Extension không tự tạo PDF từ XML vì việc đó có thể làm sai mẫu/logo/font/bố cục của nhà cung cấp.

Khi trong XML/HTML có URL nguồn, extension chỉ hiển thị URL đó. Người dùng quyết định có mở hay không. `host_permissions` của extension vẫn chỉ giới hạn ở `hoadondientu.gdt.gov.vn`.

## UTF-8 và font tiếng Việt

- Toàn bộ source/config/docs dùng UTF-8 và có `.editorconfig` khóa `charset = utf-8`.
- CI dùng `TextDecoder(..., { fatal: true })` để fail nếu file có byte UTF-8 không hợp lệ.
- CI kiểm tra không có ký tự replacement `U+FFFD`.
- UI dùng font hệ thống `Segoe UI`, `Arial`, `sans-serif`; extension không nhúng hay thay font của hóa đơn gốc.
- PDF/HTML/XML tách từ ZIP được lưu nguyên byte, không re-encode nội dung.

## Bảo mật và giới hạn

- Không lưu mật khẩu.
- Không bypass CAPTCHA.
- Không tự động đăng nhập.
- Không gửi token/dữ liệu hóa đơn ra server trung gian.
- Endpoint/giao diện TCT có thể thay đổi trong tương lai.
- Link provider chỉ được phát hiện từ dữ liệu gốc; tool không cam kết provider cho phép truy cập link mà không có thông tin xác thực riêng.

## Phát triển và kiểm thử

Không cần build step để chạy extension. Chạy test local:

```powershell
node --check .\src\core.js
node --check .\src\archive.js
node --check .\src\content.js
node .\tests\regression.mjs
node .\tests\archive.mjs
node .\tests\encoding.mjs
```

GitHub Actions chạy cùng bộ test cho mọi push vào `main` và pull request.

## Dependency

Extension bundle `fflate 0.8.3` (MIT) trong `vendor/` để giải nén ZIP hoàn toàn local. Không tải JavaScript thực thi từ CDN.

## License

MIT. Xem thêm license của dependency trong `vendor/fflate-LICENSE.txt`.
