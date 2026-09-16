import { useRef, useState } from 'react';
import {
  ArrowDownToLine,
  Check,
  FileImage,
  Images,
  SlidersHorizontal,
  Sun,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { Mode, Tone } from '../types';
import type { PrintImageItem } from '../usePrintImages';
import { imagePlacement, LAYOUT } from '../lib/layout';

type Props = {
  items: PrintImageItem[];
  ready: boolean;
  exporting: boolean;
  exported: boolean;
  error: string;
  loadError: string;
  onFiles: (files: File[]) => void;
  onTone: (id: string, mode: Mode, tone?: Tone) => void;
  onRemove: (id: string) => void;
  onExport: () => void;
};

const toneFields = [
  { key: 'brightness', label: 'Độ sáng', min: -25, max: 25 },
  { key: 'contrast', label: 'Tương phản', min: -25, max: 25 },
  { key: 'shadows', label: 'Nâng vùng tối', min: 0, max: 50 },
  { key: 'sharpness', label: 'Độ nét', min: 0, max: 50 },
] as const;

export function BatchPrintPanel({
  items,
  ready,
  exporting,
  exported,
  error,
  loadError,
  onFiles,
  onTone,
  onRemove,
  onExport,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const choose = () => {
    if (!exporting) input.current?.click();
  };
  const acceptFiles = (files: FileList | File[]) => {
    if (!exporting) onFiles(Array.from(files));
  };
  return (
    <section className="batch-workspace" aria-label="In nhiều ảnh lên A4">
      <fieldset className="batch-controls" disabled={exporting}>
        <div className="batch-intro">
          <div>
            <div className="eyebrow">MỖI ẢNH MỘT TRANG A4</div>
            <h2>In ảnh riêng lẻ lên A4</h2>
            <p>
              Tải nhiều ảnh, cân sáng từng ảnh và xuất thành PDF nhiều trang. Ảnh được giữ nguyên tỷ
              lệ, căn giữa trang.
            </p>
          </div>
          <div className="batch-actions">
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              data-testid="batch-files"
              onChange={(e) => {
                if (e.target.files) acceptFiles(e.target.files);
                e.currentTarget.value = '';
              }}
            />
            <button className="primary" onClick={choose}>
              <Upload size={17} /> Chọn tệp ảnh
            </button>
          </div>
        </div>
        <div
          className={`batch-dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            acceptFiles(e.dataTransfer.files);
          }}
          onClick={choose}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              choose();
            }
          }}
        >
          <Images size={26} />
          <strong>Kéo thả ảnh vào đây</strong>
          <span>JPEG, PNG hoặc WebP · thêm tối đa 20 ảnh · 40 MB/ảnh</span>
        </div>
        {loadError && (
          <p className="notice error" role="alert">
            {loadError}
          </p>
        )}
        <p className="tone-description" id="huong-dan">
          Sáng để in nâng vùng tối và giảm tương phản nhẹ. Hãy in thử một trang rồi tinh chỉnh theo
          máy in; độ đậm còn phụ thuộc giấy, mực và cài đặt máy in.
        </p>
        {items.length > 0 && (
          <div className="batch-summary">
            <FileImage size={16} /> {items.filter((item) => item.source.width > 0).length} ảnh ·{' '}
            {items.filter((item) => item.result).length}/
            {items.filter((item) => item.source.width > 0).length} đã xử lý
          </div>
        )}
        <div className="batch-grid">
          {items.map((item, index) => (
            <article className={`batch-item ${item.busy ? 'processing' : ''}`} key={item.id}>
              <div className="batch-item-head">
                <div>
                  <strong>Ảnh {String(index + 1).padStart(2, '0')}</strong>
                  <span title={item.source.name}>{item.source.name}</span>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Xóa ${item.source.name}`}
                  onClick={() => onRemove(item.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="batch-image-wrap">
                {item.result ? (
                  <img
                    data-testid="batch-processed-image"
                    src={item.result.url}
                    alt={`Ảnh ${index + 1} đã xử lý`}
                  />
                ) : item.source.url ? (
                  <img src={item.source.url} alt={item.source.name} />
                ) : (
                  <div className="batch-error" role={item.error ? 'alert' : 'status'}>
                    {item.error ? <X size={20} /> : null} {item.error || 'Đang đọc ảnh…'}
                  </div>
                )}
                {item.busy && item.source.width > 0 && (
                  <span className="batch-busy" role="status">
                    Đang cập nhật…
                  </span>
                )}
              </div>
              {item.source.width > 0 && (
                <div className="batch-meta">
                  {item.source.width} × {item.source.height} px
                  {item.source.reduced ? ' · đã giảm kích thước để xử lý ổn định' : ''}
                </div>
              )}
              {item.source.width > 0 && (
                <>
                  <div className="tone-modes compact">
                    <button
                      className={item.mode === 'original' ? 'chosen' : ''}
                      aria-pressed={item.mode === 'original'}
                      onClick={() => onTone(item.id, 'original')}
                    >
                      <Check size={14} /> Gốc
                    </button>
                    <button
                      className={item.mode === 'print' ? 'chosen' : ''}
                      aria-pressed={item.mode === 'print'}
                      onClick={() => onTone(item.id, 'print')}
                    >
                      <Sun size={14} /> Sáng để in
                    </button>
                    <button
                      className={item.mode === 'custom' ? 'chosen' : ''}
                      aria-pressed={item.mode === 'custom'}
                      onClick={() => onTone(item.id, 'custom')}
                    >
                      <SlidersHorizontal size={14} /> Tùy chỉnh
                    </button>
                  </div>
                  {item.mode === 'custom' && (
                    <div className="sliders compact-sliders">
                      {toneFields.map(({ key, label, min, max }) => (
                        <label key={key}>
                          {label}
                          <output>{item.tone[key]}</output>
                          <input
                            aria-label={`${label} ${item.source.name}`}
                            type="range"
                            min={min}
                            max={max}
                            value={item.tone[key]}
                            onChange={(e) =>
                              onTone(item.id, 'custom', {
                                ...item.tone,
                                [key]: Number(e.target.value),
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </>
              )}
              {item.error && item.source.width > 0 && (
                <p className="notice error" role="alert">
                  {item.error}
                </p>
              )}
            </article>
          ))}
        </div>
        <div className="batch-preview-heading">
          <h3>
            <Images size={17} /> Xem trước các trang A4
          </h3>
          <span>{items.filter((item) => item.result).length} trang</span>
        </div>
        <div className="batch-pages">
          {items
            .filter((item) => item.result)
            .map((item, index) => {
              const p = imagePlacement(item.result!.width, item.result!.height);
              return (
                <div className="batch-page-wrap" key={item.id}>
                  <div className="batch-page" data-testid="batch-a4-page">
                    <img
                      src={item.result!.url}
                      alt={`Trang A4 ${index + 1}`}
                      style={{
                        left: `${(p.left / LAYOUT.pageWidth) * 100}%`,
                        top: `${(p.top / LAYOUT.pageHeight) * 100}%`,
                        width: `${(p.width / LAYOUT.pageWidth) * 100}%`,
                        height: `${(p.height / LAYOUT.pageHeight) * 100}%`,
                      }}
                    />
                  </div>
                  <span>Trang {index + 1}</span>
                </div>
              );
            })}
        </div>
        <div className="batch-export">
          <div>
            <span className={`status-dot ${ready ? 'ready' : ''}`} />
            {items.length === 0
              ? 'Chưa có ảnh'
              : ready
                ? `${items.length} trang A4 sẵn sàng`
                : items.some((item) => item.error)
                  ? 'Có ảnh bị lỗi. Hãy xóa ảnh lỗi hoặc thử xử lý lại.'
                  : 'Đang xử lý ảnh…'}
          </div>
          <button
            className="primary export-button"
            disabled={!ready || exporting}
            onClick={onExport}
          >
            <ArrowDownToLine size={18} />
            {exporting ? 'Đang tạo PDF…' : 'Xuất PDF nhiều trang'}
            <span>.pdf</span>
          </button>
          {exported && (
            <p className="success" role="status">
              Đã tạo PDF · Anh_A4.pdf
            </p>
          )}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          <p className="export-hint">
            Mỗi ảnh được đặt trên một trang A4 trắng, có lề an toàn 8 mm để giảm nguy cơ máy in cắt
            mép.
          </p>
        </div>
      </fieldset>
    </section>
  );
}
