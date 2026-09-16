# Căn thẻ A4

Ứng dụng React + TypeScript + Vite để căn ảnh hai mặt thẻ bằng bốn góc, chỉnh phối cảnh, làm sáng nhẹ và xuất một trang PDF A4 đúng kích thước. Ngoài luồng căn thẻ, chế độ **Mỗi ảnh một tờ A4** cho phép tải nhiều ảnh, chỉnh sáng tối riêng từng ảnh và tạo PDF nhiều trang (mỗi ảnh một trang). Toàn bộ ảnh được xử lý trong trình duyệt. Máy chủ LAN chỉ phục vụ tệp tĩnh, không có endpoint nhận ảnh, tài khoản, cơ sở dữ liệu, analytics, OCR hay API AI.

## Cài đặt

1. Cài **Node.js 24 LTS** từ [nodejs.org](https://nodejs.org/). Có thể dùng Node.js từ 22.12 trở lên; bộ kiểm thử Vitest 5 yêu cầu nhánh Node 22, 24 hoặc từ 26. Khuyến nghị giữ Node 24 cho môi trường này.
2. Mở PowerShell hoặc Terminal trong thư mục dự án:

```powershell
cd "D:\Codex PC\can-the-a4"
node --version
npm --version
npm ci
```

Môi trường đã dùng để xây dựng: Node.js **24.19.0**, npm **11.17.0**. Phiên bản dependency được ghim trong `package.json` và `package-lock.json`. `npm ci` tự sao chép OpenCV.js vào `public/vendor/`. OpenCV 4.12 có WASM nhúng trong JS, không tải từ CDN. Cài dependency ban đầu cần Internet; vận hành bản build trong LAN không cần Internet.

## Build và vận hành production trong LAN

```powershell
npm run build
npm run start:lan
```

Máy chủ Node phục vụ **dist**, lắng nghe **0.0.0.0:4173**. Không dùng Vite dev server để vận hành lâu dài.

- Máy chủ: [http://localhost:4173](http://localhost:4173).
- Thiết bị khác trong cùng LAN: `http://DIA_CHI_IP_MAY_CHU:4173`.
- Lúc kiểm tra workspace: [http://192.168.1.45:4173](http://192.168.1.45:4173). IP có thể đổi khi DHCP cấp lại; luôn kiểm tra địa chỉ hiện tại.

Tìm IPv4 trên Windows:

```powershell
ipconfig
```

Tìm mục **IPv4 Address** của adapter Wi-Fi hoặc Ethernet đang dùng, không chọn adapter VPN, localhost hay adapter ảo. Có thể xem nhanh bằng:

```powershell
Get-NetIPAddress -AddressFamily IPv4
```

Điện thoại và máy chủ phải cùng mạng Wi-Fi/LAN. Mạng khách (guest Wi-Fi) có thể chặn các thiết bị truy cập nhau. Không cần mở cổng router, NAT hay port forwarding ra Internet.

### Dừng, khởi động lại và thay đổi cổng

- Nhấn **Ctrl+C** tại cửa sổ đang chạy server để dừng.
- Chạy lại `npm run start:lan` để khởi động.
- Sau khi thay đổi mã nguồn: dừng server, `npm run build`, khởi động lại và tải lại trang trên thiết bị khách. Tải lại trang xóa ảnh trong bộ nhớ của phiên hiện tại.
- Nếu cổng đang được dùng, dừng đúng tiến trình của app hoặc chọn một cổng khác:

```powershell
$env:PORT = "4180"
npm run start:lan
```

Mở terminal mới để quay về cổng mặc định, hoặc `Remove-Item Env:PORT`.

### Tường lửa Windows

Trước tiên thử URL localhost. Nếu localhost hoạt động nhưng thiết bị cùng LAN không vào được, kiểm tra profile của mạng gia đình/cơ quan tin cậy có phải **Private** không. Chỉ khi cần, mở **Windows Defender Firewall with Advanced Security → Inbound Rules → New Rule**:

1. Port → TCP → specific local port **4173**.
2. Allow the connection → chỉ **Private**, không Public.
3. Đặt tên `Can the A4 LAN 4173`.
4. Mở Properties → Scope → Remote IP → **Local subnet**.

Hoặc người quản trị có thể dùng PowerShell **Run as administrator**:

```powershell
New-NetFirewallRule -DisplayName "Can the A4 LAN 4173" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4173 -Profile Private -RemoteAddress LocalSubnet
```

Xóa đúng quy tắc đó khi không còn dùng:

```powershell
Remove-NetFirewallRule -DisplayName "Can the A4 LAN 4173"
```

Ứng dụng không tự sửa tường lửa. Không tắt toàn bộ firewall. Nếu dùng cổng khác, đổi cổng tương ứng trong quy tắc. Nếu thiết bị thuộc tổ chức, nhờ quản trị viên áp dụng chính sách mạng phù hợp.

### Giữ máy chủ hoạt động

Trong Windows **Settings → System → Power & battery → Screen, sleep & hibernate timeouts**, khi cắm điện đặt thời gian **Sleep** thành **Never** trong thời gian cần phục vụ. Có thể cho màn hình tắt; máy phải còn thức và terminal server phải còn mở. Cắm nguồn ổn định, giữ kết nối mạng; đóng nắp laptop có thể làm máy ngủ. Khôi phục thiết lập tiết kiệm điện khi không cần dùng liên tục. App không tự thay đổi cài đặt nguồn điện.

## Cách sử dụng

1. Chọn/kéo thả ảnh **mặt trước** và **mặt sau**. Nút **Chụp ảnh** dùng file input `capture="environment"`; Android có thể mở máy ảnh gốc. Trên desktop hoặc trình duyệt không hỗ trợ capture, nó mở hộp chọn file. Không cần `getUserMedia` trên HTTP LAN.
2. Ảnh JPEG/PNG/WebP được giải mã bằng `createImageBitmap({ imageOrientation: 'from-image' })`, áp dụng EXIF một lần rồi vẽ lên canvas. Nếu cần, xoay theo chiều kim đồng hồ từng 90° để thẻ nằm ngang.
3. Nhấn **Tìm mép thẻ** để lấy đề xuất hoặc tự kéo bốn góc. Điểm 1 = trên trái, 2 = trên phải, 3 = dưới phải, 4 = dưới trái. Không chọn bao nhựa, bóng đổ hay nền. Với thẻ bo góc, chọn giao điểm của hai cạnh thẳng kéo dài.
4. Kéo nền để pan; dùng **+/−**, Ctrl + cuộn chuột, hoặc chụm/tách hai ngón để zoom. **Vừa màn hình** đưa toàn bộ ảnh vào khung. Khi kéo điểm có kính lúp. Có thể Tab tới điểm rồi dùng phím mũi tên để dịch 1 pixel; Shift + mũi tên dịch 10 pixel.
5. **Đặt lại góc** về vùng khởi đầu. Nhấn **Áp dụng** sau khi cả bốn góc đúng. Tứ giác tự cắt, lõm, suy biến hoặc ra ngoài ảnh bị chặn.
6. Mặc định **Sáng để in**. Preset này mở vùng tối có kiểm soát, giảm tương phản nhẹ để hạn chế bản in bị bệt đen, giữ điểm đen của chữ và bảo vệ vùng trắng. Có thể chọn **Giữ màu gốc** hoặc **Tùy chỉnh** độ sáng, tương phản, nâng vùng tối, độ nét. Sau lần áp dụng đầu tiên, đổi ánh sáng tự cập nhật kết quả. Nếu sửa góc, phải áp dụng lại.
7. Kiểm tra ảnh kết quả, chữ/ảnh/dấu mốc và nên xác nhận nguồn đầy đủ ở cả hai mặt. Checkbox này chỉ là gợi ý rà soát; nút xuất chỉ cần hai kết quả đã căn xong. Nếu thiếu cạnh, chữ hoặc bị che, chụp lại; app không phục dựng phần mất. Khi kéo thanh ánh sáng/chi tiết, kết quả hiện tại và preview A4 được giữ nguyên cho tới khi kết quả mới sẵn sàng, tránh màn hình nhấp nháy hoặc biến mất.
8. Nhấn **Xuất PDF A4**. Tệp mặc định **The_can_cuoc_A4.pdf**. Khi in chọn A4, **Actual size / Kích thước thực / 100%**, tắt Fit/Vừa trang.

### In mỗi ảnh trên một trang A4

1. Chọn tab **Mỗi ảnh một tờ A4** ở đầu trang, sau đó chọn nhiều tệp hoặc kéo thả vào vùng tải ảnh. Chọn thêm tệp sẽ nối vào danh sách hiện tại theo thứ tự chọn; mỗi lượt tối đa 20 ảnh và 60 megapixel tổng nguồn đã chuẩn hóa.
2. Mỗi ảnh có chế độ **Giữ màu gốc**, **Sáng để in** (mặc định) và **Tùy chỉnh** riêng. Kết quả hiện tại vẫn giữ nguyên trong lúc thanh trượt đang cập nhật.
3. Kiểm tra ảnh ở phần **Xem trước các trang A4**. Ảnh được giữ nguyên tỷ lệ, căn giữa và chừa lề an toàn 8 mm để hạn chế bản in bị cắt mép. Preview và PDF dùng chung phép tính vị trí theo mm, kể cả khi đổi cỡ màn hình.
4. Nhấn **Xuất PDF nhiều trang** để tải `Anh_A4.pdf`. Mỗi ảnh là một trang A4; khi in vẫn chọn **Kích thước thực / 100%**.

Ảnh lỗi được giữ tại đúng vị trí kèm thông báo; hãy xóa ảnh không đọc được hoặc nhấn chế độ màu để thử lại nếu bộ xử lý lỗi. PDF chỉ được xuất khi mọi ảnh đã xử lý xong. “Bắt đầu lại” hủy cả ảnh còn đang đọc. Tác vụ sáng tối chạy lần lượt trong Worker, hủy lượt cũ khi kéo tiếp và luôn tính từ ảnh nguồn. Không cần chờ OpenCV ở chế độ này.

Nên in thử một trang bằng preset **Sáng để in**, sau đó tăng **Nâng vùng tối** hoặc **Độ sáng** cho từng ảnh nếu cần. Ứng dụng không thể bảo đảm mọi máy in cho cùng độ đậm; giấy, mực và cài đặt máy in vẫn ảnh hưởng kết quả.

## Độ chính xác và kiến trúc

- **Một homography toàn cục**: OpenCV `getPerspectiveTransform` + `warpPerspective`, nội suy tuyến tính. Không dùng bounding box, không ghép tam giác hoặc các mảnh ảnh.
- **Đề xuất cạnh**: nhiều ngưỡng Canny; contour + convex hull; kiểm tra tứ giác, diện tích, tỷ lệ, độ rõ của từng cạnh, hình học góc, độ biến thiên bên trong. Fit đoạn giữa của cạnh rồi lấy giao điểm để không đặt góc sâu vào cung bo. Không mặc định contour lớn nhất. Nhiều biên cạnh tranh/ảnh trống → **Cần chỉnh góc bằng tay**, không đưa phần trăm tin cậy và không tự áp dụng/xuất.
- **OpenCV lỗi hoặc tải chậm**: chỉnh tay vẫn hoạt động. Có nút chuyển sang thủ công ngay. Phương án dự phòng giải hệ homography 8 ẩn rồi nội suy song tuyến tính trong Worker, vẫn là một phép biến đổi duy nhất. Kết quả ghi rõ `Dự phòng`.
- **Tọa độ**: lưu chuẩn hóa 0–1 theo ảnh nguồn đã định hướng. Canvas dùng hệ tọa độ CSS và backing resolution theo DPR; zoom/pan không sửa dữ liệu góc. Resize tính lại phép hiển thị. Thông báo tải OpenCV nằm dưới editor để không dịch editor khi đang kéo.
- **Làm sáng**: đường cong nhẹ theo luminance, neo đen/trắng và hạn chế vùng sáng. Độ nét giới hạn ±5 mức và chặn theo cực trị lân cận để tránh quầng viền. Không thay chữ, không OCR, không dựng lại ảnh. Mỗi lượt luôn lấy nguồn chuẩn hóa ban đầu, warp rồi áp dụng tone một lần; không xử lý nối tiếp từ kết quả trước.
- **Preview/PDF**: dùng cùng PNG kết quả, cùng `src/lib/layout.ts`. PDF tạo bằng pdf-lib, không chụp DOM, không nhúng ảnh preview đã thu nhỏ. Không có Info dictionary chứa tên file, tên người, tiêu đề hoặc dữ liệu cá nhân.
- **Tài nguyên**: Mat/MatVector được delete trong finally; ImageBitmap close; Object URL cũ revoke khi thay/xóa kết quả, nguồn hoặc unmount. Worker terminate sau khi hàng đợi hoàn thành, khi thay ảnh, unmount, lỗi, timeout hoặc 30 giây không dùng sau khởi tạo. Mã phiên ngăn kết quả cũ ghi đè ảnh mới.
- **Quyền riêng tư**: không localStorage/IndexedDB, không tự lưu ảnh; tải lại trang bắt đầu phiên trống. Không tải thư viện/font/ảnh từ bên ngoài khi chạy. CSP giới hạn kết nối cùng nguồn, blob/data nội bộ. OpenCV cần dynamic code generation của Emscripten; `unsafe-eval` chỉ cho tài nguyên Worker, không cho tài liệu HTML chính.

| Thông số                        | Giá trị                           |
| ------------------------------- | --------------------------------- |
| Trang A4                        | 210 × 297 mm, dọc, đúng một trang |
| Mỗi thẻ                         | 85,60 × 53,98 mm                  |
| Mép trái cả hai thẻ             | 62,20 mm                          |
| Mép trên mặt trước              | 55 mm                             |
| Mép trên mặt sau                | 123 mm                            |
| Đổi đơn vị                      | point = mm × 72 / 25.4            |
| Tọa độ PDF theo trục y dưới lên | pageHeight − top − cardHeight     |

Trang A4 chỉ có hai ảnh, nền trắng; không có tiêu đề, nhãn, khung, ghi chú hoặc đường cắt. Các chỉ dẫn của giao diện ở ngoài trang.

## Scripts và kiểm thử

```powershell
npm run dev        # Vite chỉ dành cho phát triển
npm run typecheck
npm run test       # Unit + E2E trên production, Chrome và Edge
npm run build
npm run start:lan
```

`npm run test` gồm Vitest và Playwright. Playwright tự build và khởi động server production ở **4174**, dừng server test sau khi hoàn tất, không chiếm cổng 4173 của app. Mặc định dùng Chrome và Microsoft Edge đã cài trên máy.

Nếu máy chỉ có Chrome:

```powershell
$env:PLAYWRIGHT_CHANNEL = "chrome"
npm run test
```

Hoặc dùng trình duyệt Chromium riêng của Playwright:

```powershell
npx playwright install chromium
$env:PLAYWRIGHT_CHANNEL = "chromium"
npm run test
```

Có thể chạy riêng `npm run test:unit` và `npm run test:e2e`. Nếu không tải được Chromium do proxy/mạng, dùng Chrome/Edge cài sẵn như trên. Không cần tải Playwright browser để dùng app.

Ảnh kiểm thử được tạo bằng SVG, lưới, chữ và dấu mốc **hư cấu** trong `tests/e2e/fixtures.ts`, không chứa căn cước thật. Bộ test kiểm tra cả tọa độ kéo điểm, kính lúp, touch/pinch, DPR, EXIF, ảnh dọc/ngang, nguồn sáng/tối, bao nhựa/bóng, từ chối ảnh trống, dự phòng OpenCV, thay ảnh khi xử lý, reset/reload, PDF và server. Kết quả chạy thực tế được ghi ở [TEST_REPORT.md](TEST_REPORT.md).

Các tệp `artifacts/` là mẫu đầu ra kiểm thử, không được đưa vào dist hoặc phục vụ cho người dùng ứng dụng. PDF được mở bằng bộ đọc PDF, kiểm tra bằng Poppler `pdfinfo`, render ra PNG để đối chiếu vị trí và nội dung.

## Cấu trúc thư mục

```text
can-the-a4/
├── src/
│   ├── App.tsx, main.tsx, styles.css, types.ts
│   ├── useSide.ts                 # trạng thái, hủy tác vụ và vòng đời ảnh
│   ├── usePrintImages.ts          # hàng đợi nhiều ảnh, hủy tác vụ, giữ preview
│   ├── components/
│   │   ├── UploadCard.tsx
│   │   ├── CornerEditor.tsx
│   │   └── BatchPrintPanel.tsx
│   ├── lib/
│   │   ├── geometry.ts, image.ts, tone.ts
│   │   └── layout.ts, pdf.ts
│   └── processing/
│       ├── client.ts, worker.ts
│       ├── tone.worker.ts         # chỉnh sáng ảnh riêng, không cần OpenCV
│       └── detect.ts, warp.ts
├── public/                       # favicon và OpenCV tự sao chép
├── scripts/                      # copy-opencv.mjs, serve.mjs
├── tests/                        # unit và E2E + ảnh giả lập
├── artifacts/                    # PDF/PNG và ảnh chụp QA
├── dist/                         # production sau build
├── package.json, package-lock.json
├── tsconfig.json, vite.config.ts, playwright.config.ts
├── README.md
└── TEST_REPORT.md
```

## Giới hạn thực tế

- Không có thuật toán hình học thuần túy nào bảo đảm phân biệt thẻ với mọi bao nhựa/bóng đổ. Đề xuất luôn cần người dùng kiểm tra; không xác định nội dung hoặc phát hiện chắc chắn chữ bị mất. Thông báo yêu cầu chụp lại và xác nhận ảnh đầy đủ được hiển thị ở mỗi mặt.
- Ảnh quá mờ, lóa, thiếu mép, thẻ cong hoặc phối cảnh cực đoan không thể sửa thành bản rõ/đầy đủ. Một phép homography giữ thẳng mặt phẳng, không làm phẳng thẻ cong. Không tăng chi tiết không có trong ảnh.
- Tối đa 40 MB/tệp; ảnh trên 80 megapixel bị từ chối. Nguồn lớn hơn 3200 pixel ở cạnh dài được giảm **một lần** sau chuẩn hóa EXIF để hạn chế bộ nhớ trên điện thoại. PNG kết quả giới hạn cạnh rộng 2022 px (khoảng 600 dpi ở cỡ thẻ), ít nhất 400 px; ảnh gốc nhỏ vẫn có giới hạn chất lượng thực, tăng kích thước không tạo chi tiết.
- Góc bo của thẻ vẫn lấy giao điểm hình học: vài pixel bên ngoài cung bo có thể mang màu nền gốc. App không tự xóa/vẽ lại vùng ảnh để che khuyết điểm.
- Đã kiểm thử cảm ứng và DPR bằng mô phỏng trình duyệt; chưa có xác minh trên điện thoại Android vật lý, camera thật hoặc máy in vật lý. Độ chính xác bản in cuối cùng phụ thuộc cài đặt 100% và máy in.
- HTTP LAN chỉ nên dùng trong mạng tin cậy. Ảnh không rời thiết bị nhưng mã ứng dụng được tải từ máy chủ; app không tự thiết lập HTTPS, thay tường lửa, router hoặc chống ngủ.
