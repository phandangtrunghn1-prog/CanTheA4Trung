import { useRef, useState } from 'react';
import { Camera, Upload, RotateCw, Trash2, RefreshCw, Check, ImagePlus } from 'lucide-react';
import type { SideModel } from '../useSide';
type Props = {
  side: SideModel;
  label: string;
  active: boolean;
  onSelect: () => void;
  index: number;
};
export function UploadCard({ side, label, active, onSelect, index }: Props) {
  const file = useRef<HTMLInputElement>(null),
    camera = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const receive = (files: FileList | null) => {
    const selected = files?.[0];
    if (selected) {
      onSelect();
      void side.load(selected);
    }
  };
  return (
    <section
      className={`upload-card ${active ? 'selected' : ''} ${over ? 'drag-over' : ''}`}
      aria-label={label}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        receive(e.dataTransfer.files);
      }}
    >
      <div className="upload-card-heading">
        <button className="side-select" onClick={onSelect}>
          <span className="side-number">0{index + 1}</span>
          {label}
        </button>
        {side.result ? (
          <span className="small-status done">
            <Check size={12} /> Đã căn
          </span>
        ) : (
          <span className="small-status">{side.source ? 'Đã tải ảnh' : 'Chưa có ảnh'}</span>
        )}
      </div>
      <input
        ref={file}
        data-testid={`file-${index}`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          receive(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={camera}
        type="file"
        aria-label={`Chụp ${label.toLowerCase()}`}
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        hidden
        onChange={(e) => {
          receive(e.target.files);
          e.target.value = '';
        }}
      />
      {side.source ? (
        <>
          <button
            className="uploaded-preview"
            onClick={onSelect}
            aria-label={`Căn chỉnh ${label.toLowerCase()}`}
          >
            <img src={side.source.url} alt={`Ảnh nguồn ${label.toLowerCase()}`} />
            <span>Nhấn để căn chỉnh</span>
          </button>
          <div className="file-info">
            <strong title={side.source.name}>{side.source.name}</strong>
            <span>
              {side.source.width} × {side.source.height} px
              {side.source.reduced ? ' · Đã giảm để tiết kiệm bộ nhớ' : ''}
            </span>
          </div>
          <div className="file-actions">
            <button
              title="Xoay ảnh 90 độ theo chiều kim đồng hồ"
              aria-label={`Xoay ${label.toLowerCase()} 90 độ`}
              disabled={side.loading}
              onClick={() => void side.rotate()}
            >
              <RotateCw size={15} />
              <span>90°</span>
            </button>
            <button onClick={() => file.current?.click()}>
              <RefreshCw size={14} /> Thay ảnh
            </button>
            <button aria-label={`Xóa ${label.toLowerCase()}`} onClick={side.reset}>
              <Trash2 size={15} />
            </button>
            <button
              title="Chụp ảnh"
              aria-label={`Chụp ảnh ${label.toLowerCase()}`}
              onClick={() => camera.current?.click()}
            >
              <Camera size={15} />
            </button>
          </div>
        </>
      ) : (
        <>
          <button className="drop-target" onClick={() => file.current?.click()}>
            <span className="upload-icon">
              <ImagePlus size={26} strokeWidth={1.4} />
            </span>
            <strong>Kéo ảnh vào đây</strong>
            <span>hoặc chọn từ thiết bị của bạn</span>
          </button>
          <div className="upload-buttons">
            <button onClick={() => file.current?.click()}>
              <Upload size={14} /> Chọn ảnh
            </button>
            <button onClick={() => camera.current?.click()}>
              <Camera size={15} /> Chụp ảnh
            </button>
          </div>
        </>
      )}
      {side.loading && (
        <p className="upload-progress" role="status">
          Đang đọc ảnh…
        </p>
      )}
    </section>
  );
}
