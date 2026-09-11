# GDT Invoice Original Downloader

Chrome/Edge extension chạy hoàn toàn local để tải gói XML/ZIP gốc của hóa đơn điện tử từ `hoadondientu.gdt.gov.vn` bằng chính phiên đăng nhập hiện tại.

## Vì sao cách này đúng hơn việc dựng template?

Mỗi nhà cung cấp HĐĐT có thể có bản thể hiện/PDF riêng. Cổng TCT không cung cấp một template PDF chung để tái tạo chính xác mọi nhà cung cấp. Dữ liệu chuẩn để đối chiếu là XML gốc đã phát hành/ký số.

Tool này gọi trực tiếp endpoint xuất XML của TCT:

- `/api/query/invoices/export-xml`
- `/api/sco-query/invoices/export-xml` cho hóa đơn từ máy tính tiền

Vì vậy tool không tự vẽ hóa đơn và không giả lập template.

## Cài đặt

1. Mở Chrome/Edge > Extensions.
2. Bật **Developer mode**.
3. Chọn **Load unpacked** và trỏ đến thư mục repo này.
4. Đăng nhập `https://hoadondientu.gdt.gov.vn` theo cách bình thường.
5. Mở trang tra cứu có bảng hóa đơn.
6. Bấm **Tải XML gốc trang này** ở góc dưới phải.

## Cách hoạt động

Extension đọc các dòng đang hiển thị và lấy:

- MST người bán (`nbmst`)
- Ký hiệu mẫu số (`khmshdon`)
- Ký hiệu hóa đơn (`khhdon`)
- Số hóa đơn (`shdon`)

Sau đó gọi endpoint TCT bằng cookie/token của phiên trình duyệt hiện tại và tải file trả về về máy.

## Bảo mật và giới hạn

- Không gửi MST, token hay dữ liệu hóa đơn đến server bên thứ ba.
- Không bypass CAPTCHA, không tự động đăng nhập và không lưu mật khẩu.
- Chỉ hoạt động khi bạn đã đăng nhập hợp lệ vào cổng TCT.
- Endpoint của TCT có thể thay đổi; nếu giao diện/field thay đổi cần cập nhật selector.
- XML/ZIP gốc là dữ liệu chuẩn. PDF/bản thể hiện đúng 100% giao diện của từng nhà cung cấp chỉ có thể lấy khi nhà cung cấp đó có portal/API/link bản thể hiện riêng.

## Phát triển

Không cần npm hay build step. Kiểm tra syntax:

```powershell
node --check .\src\content.js
```

## License

MIT.
