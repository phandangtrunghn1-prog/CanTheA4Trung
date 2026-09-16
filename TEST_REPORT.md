# Báo cáo kiểm thử Căn thẻ A4

Ngày kiểm thử: 16/09/2026

## Môi trường

- Node.js 24.19.0, npm 11.17.0.
- Build Vite production, OpenCV.js 4.12.0-release.1 nhúng tại `dist/vendor/opencv.js`.
- Microsoft Edge cài trên máy và Google Chrome cài trên máy.
- Playwright chạy production server tạm thời trên `127.0.0.1:4174`.
- PDF kiểm tra bằng Poppler `pdfinfo`/`pdftoppm`.

## Kết quả lệnh

```text
npm run typecheck                 PASS
npm run test:unit                 PASS - 3 files, 10 tests
npm run build                     PASS - Vite 8.3.0
npm run test                      PASS - 22 E2E tests on Chrome + Edge
npm run start:lan                 PASS - 0.0.0.0:4173, SPA fallback
```

## E2E đã chạy

1. Luồng đầy đủ: tải ảnh giả lập, xoay 90° bốn lần, nhận diện cạnh, kéo bốn góc, zoom, pan, Ctrl+wheel, thay đổi tone, A4, tải PDF, reload.
2. Ảnh EXIF orientation, dọc, WebP; thay ảnh trong khi xử lý; xóa ảnh; tứ giác không hợp lệ; tệp không được hỗ trợ.
3. Hủy tải OpenCV: editor thủ công và phép chiếu dự phòng vẫn tạo kết quả.
4. Nền sáng/tối, bao nhựa/bóng đổ và ảnh trống; ảnh trống trả về `Cần chỉnh góc bằng tay`.
5. Cảm ứng mô phỏng, pinch zoom, resize viewport, devicePixelRatio 3, không tràn ngang.
6. MIME type, ETag/304, SPA fallback, phương thức POST bị từ chối, path traversal/backslash/ADS bị từ chối.
7. File chooser, input camera `capture="environment"`, kéo thả, chuyển thủ công khi OpenCV tải chậm, reset toàn bộ.
8. Chế độ **Mỗi ảnh một tờ A4**: tải nhiều ảnh, xử lý tone riêng từng ảnh, giữ preview khi thanh trượt cập nhật và xuất PDF nhiều trang.
9. Thêm ảnh giữ nguyên danh sách và tone cũ; kéo liên tiếp ba giá trị rồi kiểm tra từng pixel kết quả đúng giá trị cuối, ảnh còn lại không đổi. “Gốc” trả về đúng toàn bộ pixel nguồn.
10. Reset trong khi giải mã chậm, xóa trong khi đang chỉnh sáng, tệp PNG hỏng, đổi tab, tải lại trang và thu hồi toàn bộ Object URL khi xóa/reset.
11. Worker bị chặn và lỗi đọc ảnh lúc xuất PDF: báo lỗi cụ thể, giữ preview, khóa bản in chưa hoàn tất và thử lại thành công.

## Xác minh PDF thật

- `artifacts/The_can_cuoc_A4.pdf` có đúng 1 trang.
- Kích thước `595.276 × 841.890 pt`, tương đương A4 `210 × 297 mm`.
- Hai ảnh PNG đã xử lý được nhúng trực tiếp; không nhúng ảnh gốc hoặc ảnh preview.
- Vị trí và kích thước dùng chung với preview: trái 62,20 mm; top 55 mm và 123 mm; mỗi mặt 85,60 × 53,98 mm.
- Không có Info metadata cá nhân; không có JavaScript, form hoặc encryption.
- PDF đã render thành `artifacts/pdf-render.png` và kiểm tra trực quan: nền trắng, hai mặt thẻ đúng thứ tự, cạnh thẳng, tỷ lệ và khoảng cách đúng.
- Khi kéo các thanh trong “Ánh sáng & chi tiết”, kết quả căn thẻ và thẻ trên preview A4 được giữ nguyên trong lúc xử lý; ảnh mới thay thế nguyên tử khi Worker hoàn tất. E2E kiểm tra cả trạng thái `Đang cập nhật…` và việc preview không biến mất.
- Nút `Xuất PDF A4` được bật ngay khi cả hai mặt có kết quả căn chỉnh hoàn tất; checkbox rà soát mép/nội dung là khuyến nghị, không còn khóa bước 3.
- Preset `Sáng để in` đã được hiệu chỉnh thành brightness 10, contrast -8, shadows 36, sharpness 4; tone curve có black guard và highlight guard. Mẫu ảnh nền tối cho thấy vùng tối được mở rõ hơn mà chữ đen và vùng trắng vẫn được neo.
- PDF nhiều ảnh `Anh_A4.pdf` dùng một trang A4 cho mỗi ảnh, căn giữa với lề an toàn 8 mm và không có metadata cá nhân; preview dùng đúng PNG đã xử lý.
- Đã tải PDF nhiều ảnh thật từ nút xuất, xác nhận 2 trang A4 bằng pdf-lib và Poppler; giải nén ảnh nhúng và đối chiếu từng pixel RGB với kết quả preview. Kiểm tra các phép dịch/chia tỷ lệ trong PDF và vị trí preview ở màn hình 1440 px lẫn 375 px.
- Đã render cả hai trang của `Anh_A4.pdf` (`batch-pdf-1.png`, `batch-pdf-2.png`) và trang thẻ (`card-pdf-verified.png`) để kiểm tra nội dung, tỷ lệ và lề.

## Sửa lỗi ổn định trong lần rà soát

- Thay bộ xử lý sáng tối nhiều ảnh trên luồng giao diện bằng một Worker tại một thời điểm, debounce 180 ms, hủy lượt lỗi thời, timeout 45 giây và giải mã PNG mới trước khi đổi preview.
- Dùng trạng thái tham chiếu cập nhật đồng bộ; không thu hồi URL hoặc thay đổi tham chiếu trong callback cập nhật React có thể chạy lại ở StrictMode.
- Thêm ảnh nối danh sách; giải mã tuần tự, giữ thứ tự, tối đa 20 ảnh và 60 megapixel tổng nguồn chuẩn hóa. Reset/xóa ngăn kết quả cũ quay lại.
- Preview nhiều ảnh dùng chung vị trí mm với PDF, sửa sai lệch do lề cố định bằng pixel CSS.
- Khóa xuất chống nhấp lặp, ngăn sửa ảnh trong lúc tạo PDF; xóa thông báo thành công khi thay đổi ảnh và chặn xuất nếu lần xử lý mới lỗi.
- Chế độ giữ màu gốc trả về bản sao pixel nguyên vẹn, kể cả các mức gần đen; các preset cập nhật đúng giá trị thanh trượt khi chuyển chế độ.

## Ảnh kiểm thử

Các ảnh trong `tests/e2e/fixtures.ts` được tạo từ SVG có chữ, lưới và dấu mốc hư cấu. Không dùng căn cước thật, OCR, AI, inpainting hoặc nội dung cá nhân.

## Ghi chú

- Console chỉ có cảnh báo Canvas2D thông tin về tối ưu đọc pixel và log lỗi OpenCV được chủ động mô phỏng trong test fallback; không có lỗi chặn luồng.
- OpenCV dùng dynamic code generation của Emscripten. Máy chủ thêm CSP `unsafe-eval` cho bundle Worker đã băm; HTML chính không cho phép `unsafe-eval`.
- Chưa thể xác nhận camera vật lý, Android vật lý hoặc máy in vật lý trong môi trường này; các tình huống đó đã được mô phỏng bằng Playwright và vẫn cần kiểm tra tại nơi sử dụng thực tế.
