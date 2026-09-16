import { useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Contrast,
  CreditCard,
  FileCheck2,
  Info,
  LockKeyhole,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  TriangleAlert,
} from 'lucide-react';
import { useSide } from './useSide';
import { UploadCard } from './components/UploadCard';
import { CornerEditor } from './components/CornerEditor';
import { BatchPrintPanel } from './components/BatchPrintPanel';
import { usePrintImages } from './usePrintImages';
import { initialCorners } from './lib/geometry';
import { LAYOUT } from './lib/layout';
import { createCardPdf, createImagesPdf } from './lib/pdf';
import type { Mode, Tone } from './types';
export default function App() {
  const front = useSide(),
    back = useSide(),
    sides = [front, back];
  const batch = usePrintImages();
  const [active, setActive] = useState(0),
    [appMode, setAppMode] = useState<'card' | 'images'>('card'),
    [exporting, setExporting] = useState(false),
    [batchExporting, setBatchExporting] = useState(false),
    [pdfError, setPdfError] = useState(''),
    [batchPdfError, setBatchPdfError] = useState(''),
    [exported, setExported] = useState(false);
  const [batchExported, setBatchExported] = useState(false);
  const exportLock = useRef(false);
  const batchExportLock = useRef(false);
  const side = sides[active],
    both = sides.every((s) => s.result && !s.busy && !s.loading && !s.error),
    count = sides.filter((s) => s.result).length;
  async function download() {
    if (exportLock.current || !both) return;
    exportLock.current = true;
    setExporting(true);
    setPdfError('');
    setExported(false);
    try {
      const bytes = await createCardPdf(front.result!.blob, back.result!.blob),
        blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }),
        url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'The_can_cuoc_A4.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setExported(true);
    } catch (e) {
      setPdfError(
        `Xuất PDF thất bại: ${e instanceof Error ? e.message : 'Bộ nhớ không đủ. Hãy thử ảnh nhỏ hơn.'}`,
      );
    } finally {
      exportLock.current = false;
      setExporting(false);
    }
  }
  async function downloadBatch() {
    if (batchExportLock.current || !batch.ready) return;
    batchExportLock.current = true;
    setBatchExporting(true);
    setBatchPdfError('');
    setBatchExported(false);
    try {
      const bytes = await createImagesPdf(batch.items.map((item) => item.result!.blob));
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Anh_A4.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      setBatchExported(true);
    } catch (e) {
      setBatchPdfError(
        `Xuất PDF thất bại: ${e instanceof Error ? e.message : 'Bộ nhớ không đủ. Hãy thử ảnh nhỏ hơn.'}`,
      );
    } finally {
      batchExportLock.current = false;
      setBatchExporting(false);
    }
  }
  return (
    <div className="app-shell">
      <header className="site-header">
        <a href="/" className="brand" aria-label="Căn thẻ A4 - trang chủ">
          <span className="brand-mark">
            <CreditCard size={23} />
          </span>
          <span>
            Căn thẻ <b>A4</b>
          </span>
        </a>
        <div className="header-right">
          <span className="privacy-pill">
            <LockKeyhole size={13} /> Ảnh chỉ ở trên thiết bị của bạn
          </span>
          <a href="#huong-dan">
            Hướng dẫn <Info size={15} />
          </a>
        </div>
      </header>
      <main>
        <div className="intro">
          <div>
            <div className="eyebrow">GỌN GÀNG TRÊN MỘT TRANG GIẤY</div>
            <h1>{appMode === 'card' ? 'Hai mặt thẻ. Một trang A4.' : 'Mỗi ảnh. Một tờ A4.'}</h1>
            <p>
              {appMode === 'card'
                ? 'Căn thẳng, làm sáng và đặt thẻ đúng kích thước — sẵn sàng để in.'
                : 'Chỉnh sáng từng ảnh, xem trước từng trang và xuất PDF để in.'}
            </p>
          </div>
          <button
            className="start-over"
            onClick={() => {
              front.reset();
              back.reset();
              batch.reset();
              setActive(0);
              setExported(false);
              setPdfError('');
              setBatchExported(false);
              setBatchPdfError('');
            }}
            disabled={exporting || batchExporting}
          >
            <RotateCcw size={15} /> Bắt đầu lại
          </button>
        </div>
        <div className="mode-switch" role="tablist" aria-label="Chọn kiểu in">
          <button
            role="tab"
            aria-selected={appMode === 'card'}
            className={appMode === 'card' ? 'chosen' : ''}
            onClick={() => setAppMode('card')}
          >
            <CreditCard size={16} /> Căn thẻ hai mặt
          </button>
          <button
            role="tab"
            aria-selected={appMode === 'images'}
            className={appMode === 'images' ? 'chosen' : ''}
            onClick={() => setAppMode('images')}
          >
            <FileCheck2 size={16} /> Mỗi ảnh một tờ A4
          </button>
        </div>
        {appMode === 'images' ? (
          <BatchPrintPanel
            items={batch.items}
            ready={batch.ready}
            exporting={batchExporting}
            exported={batchExported}
            error={batchPdfError}
            loadError={batch.loadError}
            onFiles={(files) => {
              setBatchExported(false);
              setBatchPdfError('');
              batch.addFiles(files);
            }}
            onTone={(id, mode, tone) => {
              setBatchExported(false);
              setBatchPdfError('');
              batch.changeTone(id, mode, tone);
            }}
            onRemove={(id) => {
              setBatchExported(false);
              setBatchPdfError('');
              batch.remove(id);
            }}
            onExport={() => void downloadBatch()}
          />
        ) : (
          <>
            <nav className="steps" aria-label="Các bước xử lý">
              <a href="#tai-anh" className="step active">
                <span className="step-index">
                  {sides.every((s) => s.source) ? <Check size={16} /> : 1}
                </span>
                <span>
                  Tải ảnh<small>Thêm đủ hai mặt thẻ</small>
                </span>
              </a>
              <ChevronRight size={17} />
              <a href="#can-chinh" className={`step ${side.source ? 'active' : ''}`}>
                <span className="step-index">{count === 2 ? <Check size={16} /> : 2}</span>
                <span>
                  Căn chỉnh & làm sáng<small>Đặt góc theo mép thật</small>
                </span>
              </a>
              <ChevronRight size={17} />
              <a href="#xem-truoc" className={`step ${both ? 'active' : ''}`}>
                <span className="step-index">3</span>
                <span>
                  Xem trước & xuất PDF<small>A4 · đúng tỷ lệ 1:1 khi in</small>
                </span>
              </a>
            </nav>
            <div className="workspace">
              <div className="workspace-main">
                <section id="tai-anh">
                  <div className="section-heading">
                    <h2>
                      <span>01</span> Ảnh của bạn
                    </h2>
                    <span>JPEG, PNG, WebP · tối đa 40 MB/ảnh</span>
                  </div>
                  <div className="upload-grid">
                    {sides.map((s, i) => (
                      <UploadCard
                        key={i}
                        side={s}
                        index={i}
                        label={i === 0 ? 'Mặt trước' : 'Mặt sau'}
                        active={active === i}
                        onSelect={() => setActive(i)}
                      />
                    ))}
                  </div>
                  {sides.map((s, i) =>
                    s.error ? (
                      <p key={i} className="notice error" role="alert">
                        {i === 0 ? 'Mặt trước' : 'Mặt sau'}: {s.error}
                      </p>
                    ) : null,
                  )}
                </section>
                <section id="can-chinh" className="edit-panel">
                  <div className="section-heading">
                    <h2>
                      <span>02</span> Căn chỉnh & làm sáng
                    </h2>
                    <span className="local-chip">
                      <ShieldCheck size={13} /> Xử lý tại máy
                    </span>
                  </div>
                  <div className="editor-tabs" role="tablist" aria-label="Chọn mặt cần căn">
                    <button role="tab" aria-selected={active === 0} onClick={() => setActive(0)}>
                      Mặt trước {front.result && <Check size={14} />}
                    </button>
                    <button role="tab" aria-selected={active === 1} onClick={() => setActive(1)}>
                      Mặt sau {back.result && <Check size={14} />}
                    </button>
                    <span>
                      {side.source
                        ? side.status === 'ready'
                          ? 'OpenCV sẵn sàng'
                          : side.status === 'loading'
                            ? 'Đang tải OpenCV…'
                            : 'Căn thủ công · dự phòng'
                        : 'Chọn ảnh để bắt đầu'}
                    </span>
                  </div>
                  <p className="editor-instruction">
                    <Info size={16} />
                    <span>
                      Đặt bốn góc theo mép thật của chiếc thẻ, không chọn bao nhựa, nền hoặc bóng
                      đổ.
                    </span>
                  </p>
                  {side.source ? (
                    <>
                      <CornerEditor
                        key={active}
                        source={side.source}
                        corners={side.corners}
                        onChange={side.changeCorners}
                        onReset={() => side.changeCorners(initialCorners())}
                        onApply={() => void side.process()}
                        onDetect={() => void side.detect()}
                        busy={side.busy || side.loading}
                        cvReady={side.status === 'ready'}
                      />
                      {side.status !== 'ready' && (
                        <div className="notice">
                          {side.status === 'loading'
                            ? 'Bạn có thể kéo góc ngay trong khi OpenCV đang tải.'
                            : 'OpenCV tải lỗi. Kéo góc và Áp dụng vẫn hoạt động bằng phép biến đổi phối cảnh dự phòng.'}
                          {side.status === 'loading' && (
                            <button className="text-button" onClick={side.fallback}>
                              Dùng chế độ thủ công ngay
                            </button>
                          )}
                        </div>
                      )}
                      {side.message && (
                        <p className="notice" role="status">
                          {side.message}
                        </p>
                      )}
                      <div className="capture-check">
                        <TriangleAlert size={16} />
                        <div>
                          <strong>Ảnh phải có đầy đủ mép thẻ và nội dung.</strong>
                          <p>
                            Nếu bị cắt mất cạnh, chữ hoặc có vùng bị che, hãy chụp lại. Ứng dụng
                            không vẽ thêm hay phục dựng phần bị mất.
                          </p>
                          <label>
                            <input
                              type="checkbox"
                              checked={side.confirmed}
                              onChange={(e) => side.setConfirmed(e.target.checked)}
                            />{' '}
                            Tôi đã kiểm tra ảnh đầy đủ, không mất mép hoặc nội dung.
                          </label>
                          <span className="advisory">
                            Xác nhận này chỉ là gợi ý kiểm tra, không khóa nút xuất PDF.
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="empty-editor">
                      <div className="empty-card-art">
                        <span />
                        <ScanLine size={40} strokeWidth={1} />
                        <i />
                      </div>
                      <h3>Một chút căn chỉnh, một bản in gọn đẹp.</h3>
                      <p>
                        Tải ảnh {active === 0 ? 'mặt trước' : 'mặt sau'} để bắt đầu.
                        <br />
                        Bạn luôn có thể tự kéo bốn góc của thẻ.
                      </p>
                      <a href="#tai-anh">
                        Thêm ảnh của bạn <ArrowRight size={15} />
                      </a>
                    </div>
                  )}
                  <div className={`tone-panel ${!side.source ? 'inactive' : ''}`}>
                    <div className="tone-title">
                      <h3>
                        <Sun size={18} /> Ánh sáng & chi tiết
                      </h3>
                      <span>Nhẹ nhàng, giữ nguyên nội dung</span>
                    </div>
                    <div className="tone-modes">
                      {(
                        [
                          { value: 'original', label: 'Giữ màu gốc', icon: Contrast },
                          { value: 'print', label: 'Sáng để in', icon: Sun },
                          { value: 'custom', label: 'Tùy chỉnh', icon: SlidersHorizontal },
                        ] as const
                      ).map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          className={side.mode === value ? 'chosen' : ''}
                          aria-pressed={side.mode === value}
                          disabled={!side.source}
                          onClick={() => side.changeTone(value as Mode)}
                        >
                          <Icon size={15} />
                          {label}
                          {value === 'print' && <small>Đề xuất</small>}
                        </button>
                      ))}
                    </div>
                    {side.mode === 'custom' ? (
                      <div className="sliders">
                        {(
                          [
                            { key: 'brightness', label: 'Độ sáng', min: -25, max: 25 },
                            { key: 'contrast', label: 'Tương phản', min: -25, max: 25 },
                            { key: 'shadows', label: 'Nâng vùng tối', min: 0, max: 50 },
                            { key: 'sharpness', label: 'Độ nét', min: 0, max: 50 },
                          ] as const
                        ).map(({ key, label, min, max }) => (
                          <label key={key}>
                            {label}
                            <output>{side.tone[key]}</output>
                            <input
                              aria-label={label}
                              type="range"
                              min={min}
                              max={max}
                              value={side.tone[key]}
                              onChange={(e) =>
                                side.changeTone('custom', {
                                  ...side.tone,
                                  [key]: Number(e.target.value),
                                } as Tone)
                              }
                            />
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="tone-description">
                        {side.mode === 'print'
                          ? 'Mở vùng tối có kiểm soát, giảm nguy cơ bản in bị bệt đen và bảo vệ vùng sáng. Không thay đổi nội dung trên thẻ.'
                          : 'Giữ màu ảnh nguồn sau khi căn phối cảnh.'}
                      </p>
                    )}
                  </div>
                  {side.result && (
                    <div className={`result-panel ${side.busy ? 'processing' : ''}`}>
                      <div>
                        <h3>
                          <CheckCheck size={17} /> Kết quả căn thẻ
                        </h3>
                        <span className="result-meta">
                          {side.result.width} × {side.result.height} px · {side.result.engine}
                          {side.busy && <em role="status">Đang cập nhật…</em>}
                        </span>
                      </div>
                      <img
                        data-testid="processed-image"
                        src={side.result.url}
                        alt={`Kết quả ${active === 0 ? 'mặt trước' : 'mặt sau'} đã căn chỉnh`}
                      />
                      <p>Cùng ảnh này được nhúng trực tiếp vào PDF.</p>
                    </div>
                  )}
                </section>
              </div>
              <aside id="xem-truoc" className="preview-panel">
                <div className="section-heading">
                  <h2>
                    <span>03</span> Bản in của bạn
                  </h2>
                  <span className="page-count">1 trang</span>
                </div>
                <div className="preview-subhead">
                  <span>A4 dọc</span>
                  <span>210 × 297 mm</span>
                </div>
                <div className="paper-surround">
                  <div
                    className="paper"
                    aria-label="Xem trước trang A4"
                    data-testid="a4-page"
                    style={{ aspectRatio: `${LAYOUT.pageWidth}/${LAYOUT.pageHeight}` }}
                  >
                    {sides.map((s, i) =>
                      s.result ? (
                        <img
                          key={i}
                          className="paper-card"
                          data-testid={`a4-card-${i}`}
                          alt={`Mặt ${i === 0 ? 'trước' : 'sau'} trên A4`}
                          src={s.result.url}
                          style={{
                            left: `${(LAYOUT.left / LAYOUT.pageWidth) * 100}%`,
                            top: `${(LAYOUT.tops[i] / LAYOUT.pageHeight) * 100}%`,
                            width: `${(LAYOUT.cardWidth / LAYOUT.pageWidth) * 100}%`,
                            height: `${(LAYOUT.cardHeight / LAYOUT.pageHeight) * 100}%`,
                          }}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
                <div className="preview-details">
                  <div>
                    <CreditCard size={15} />
                    <span>Mỗi mặt thẻ</span>
                    <strong>85,60 × 53,98 mm</strong>
                  </div>
                  <div>
                    <Check size={15} />
                    <span>Hai mặt căn giữa</span>
                    <strong>Tỷ lệ chuẩn</strong>
                  </div>
                </div>
                <div className="export-area">
                  <div className="ready-line">
                    <span className={`status-dot ${both ? 'ready' : ''}`} />
                    {count}/2 mặt đã căn chỉnh
                  </div>
                  <button
                    className="primary export-button"
                    onClick={() => void download()}
                    disabled={!both || exporting}
                  >
                    <ArrowDownToLine size={19} />
                    {exporting ? 'Đang tạo PDF…' : 'Xuất PDF A4'}
                    <span>.pdf</span>
                  </button>
                  {!both ? (
                    <p className="export-hint">
                      {count < 2
                        ? 'Cần tải và áp dụng đủ mặt trước, mặt sau để xuất PDF.'
                        : sides.some((s) => s.error)
                          ? 'Có lỗi xử lý ảnh. Hãy áp dụng lại mặt đang báo lỗi.'
                          : 'Đang hoàn tất xử lý ảnh, hãy đợi một chút rồi thử lại.'}
                    </p>
                  ) : (
                    <p className="export-hint">Sẵn sàng tải xuống · The_can_cuoc_A4.pdf</p>
                  )}
                  {exported && (
                    <p role="status" className="success">
                      Đã tạo PDF. Khi in, chọn “Kích thước thực / 100%”.
                    </p>
                  )}
                  {pdfError && (
                    <p role="alert" className="notice error">
                      {pdfError}
                    </p>
                  )}
                  <div className="print-note">
                    <FileCheck2 size={18} />
                    <p>
                      Khi in, chọn <strong>Kích thước thực (100%)</strong>.<br />
                      Tắt “Vừa trang” để giữ đúng cỡ thẻ.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
            <section className="help-section" id="huong-dan">
              <h2>Để bản in rõ và đúng mép</h2>
              <div>
                <p>
                  <b>01 / Chụp đủ thẻ</b>Đặt thẻ trên nền phẳng, ánh sáng đều. Tháo bao nhựa nếu có;
                  tránh lóa và bóng đổ.
                </p>
                <p>
                  <b>02 / Kiểm tra bốn góc</b>Với góc bo, chọn giao điểm tưởng tượng của hai cạnh
                  thẳng. Xoay để thẻ nằm ngang trước khi căn.
                </p>
                <p>
                  <b>03 / In đúng kích thước</b>Chọn giấy A4, tỷ lệ 100%. PDF chỉ chứa hai mặt thẻ,
                  không có nhãn hay khung in.
                </p>
              </div>
            </section>
          </>
        )}
      </main>
      <footer>
        <span className="footer-brand">
          <CreditCard size={16} /> Căn thẻ A4
        </span>
        <span>Không tải ảnh lên máy chủ. Không lưu ảnh sau khi tải lại trang.</span>
        <span>Làm gọn một việc nhỏ.</span>
      </footer>
    </div>
  );
}
