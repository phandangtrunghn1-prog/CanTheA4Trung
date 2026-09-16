import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Maximize, Minus, Plus, Move, RotateCcw, Check, ScanLine } from 'lucide-react';
import type { Point, Quad, Source } from '../types';
import { fitView, toScreen, toSource, validQuad, zoomAt, type View } from '../lib/geometry';
const names = ['Trên trái', 'Trên phải', 'Dưới phải', 'Dưới trái'];
type Props = {
  source: Source;
  corners: Quad;
  onChange: (q: Quad) => void;
  onReset: () => void;
  onApply: () => void;
  onDetect: () => void;
  busy: boolean;
  cvReady: boolean;
};
export function CornerEditor({
  source,
  corners,
  onChange,
  onReset,
  onApply,
  onDetect,
  busy,
  cvReady,
}: Props) {
  const viewport = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null),
    loupe = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 600, h: 390 }),
    [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 }),
    [drag, setDrag] = useState<number | null>(null);
  const pointers = useRef(new Map<number, Point>()),
    gesture = useRef<number | null>(null);
  const previousMinHeight = useRef<string | null>(null);
  const unlockPage = () => {
    if (previousMinHeight.current !== null) {
      document.body.style.minHeight = previousMinHeight.current;
      previousMinHeight.current = null;
    }
  };
  useEffect(() => () => unlockPage(), []);
  const fit = () => setView(fitView(source.width, source.height, size.w, size.h));
  useEffect(() => {
    const el = viewport.current!;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const at = { x: event.clientX - rect.left, y: event.clientY - rect.top };
      setView((v) => {
        const base = fitView(source.width, source.height, size.w, size.h).scale;
        const scale = Math.max(
          base * 0.7,
          Math.min(base * 10, v.scale * Math.exp(-event.deltaY * 0.005)),
        );
        return zoomAt(v, at, scale / v.scale);
      });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [source, size]);
  useEffect(() => {
    const el = viewport.current!;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width,
        h = entry.contentRect.height;
      setSize({ w, h });
      setView(fitView(source.width, source.height, w, h));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [source]);
  useEffect(() => {
    const el = canvas.current!;
    const dpr = window.devicePixelRatio || 1;
    el.width = Math.round(size.w * dpr);
    el.height = Math.round(size.h * dpr);
    const ctx = el.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.w, size.h);
    ctx.drawImage(
      source.canvas,
      view.x,
      view.y,
      source.width * view.scale,
      source.height * view.scale,
    );
    const points = corners.map((p) => toScreen(p, source.width, source.height, view));
    ctx.beginPath();
    ctx.rect(0, 0, size.w, size.h);
    ctx.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = 'rgba(28,25,23,.48)';
    ctx.fill('evenodd');
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = validQuad(corners) ? '#ffcc8d' : '#ff7575';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (drag !== null && loupe.current) {
      const lens = loupe.current;
      lens.width = 280;
      lens.height = 280;
      const c = lens.getContext('2d')!;
      const p = corners[drag];
      c.fillStyle = '#292622';
      c.fillRect(0, 0, 280, 280);
      c.imageSmoothingEnabled = false;
      const sample = 48 / view.scale;
      c.drawImage(
        source.canvas,
        p.x * source.width - sample / 2,
        p.y * source.height - sample / 2,
        sample,
        sample,
        0,
        0,
        280,
        280,
      );
      c.strokeStyle = '#d2723f';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(140, 0);
      c.lineTo(140, 280);
      c.moveTo(0, 140);
      c.lineTo(280, 140);
      c.stroke();
      c.strokeStyle = '#fff';
      c.strokeRect(134, 134, 12, 12);
    }
  }, [source, corners, view, size, drag]);
  function zoom(factor: number, at: Point = { x: size.w / 2, y: size.h / 2 }) {
    setView((v) => {
      const base = fitView(source.width, source.height, size.w, size.h).scale;
      const next = Math.max(base * 0.7, Math.min(base * 10, v.scale * factor));
      return zoomAt(v, at, next / v.scale);
    });
  }
  const local = (e: { clientX: number; clientY: number }) => {
    const r = viewport.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  function down(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    // Invalidating the old result can shorten the page. Hold its height through
    // the gesture so scroll clamping cannot move the image under the pointer.
    if (previousMinHeight.current === null) {
      previousMinHeight.current = document.body.style.minHeight;
      document.body.style.minHeight = `${document.body.scrollHeight}px`;
    }
    pointers.current.set(e.pointerId, local(e));
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-corner]');
    if (pointers.current.size === 1) {
      gesture.current = target ? Number(target.dataset.corner) : null;
      setDrag(gesture.current);
    } else {
      gesture.current = null;
      setDrag(null);
    }
  }
  function move(e: ReactPointerEvent<HTMLDivElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const next = local(e);
    if (pointers.current.size === 2) {
      const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)![1];
      const before = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 },
        after = { x: (next.x + other.x) / 2, y: (next.y + other.y) / 2 };
      const factor =
        Math.hypot(next.x - other.x, next.y - other.y) /
        Math.max(1, Math.hypot(prev.x - other.x, prev.y - other.y));
      setView((v) => {
        const base = fitView(source.width, source.height, size.w, size.h).scale;
        const f = Math.max(base * 0.7, Math.min(base * 10, v.scale * factor)) / v.scale;
        const z = zoomAt(v, before, f);
        return { ...z, x: z.x + after.x - before.x, y: z.y + after.y - before.y };
      });
    } else if (gesture.current !== null) {
      const q = [...corners] as Quad;
      q[gesture.current] = toSource(next, source.width, source.height, view);
      onChange(q);
    } else setView((v) => ({ ...v, x: v.x + next.x - prev.x, y: v.y + next.y - prev.y }));
    pointers.current.set(e.pointerId, next);
  }
  function up(e: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    gesture.current = null;
    setDrag(null);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (!pointers.current.size) unlockPage();
  }
  const valid = validQuad(corners);
  return (
    <>
      <div className="editor-toolbar">
        <span>
          <Move size={14} /> Kéo nền để di chuyển
        </span>
        <div className="tools">
          <button aria-label="Thu nhỏ" onClick={() => zoom(1 / 1.25)}>
            <Minus size={16} />
          </button>
          <span className="zoom-value">
            {Math.round(
              (view.scale / fitView(source.width, source.height, size.w, size.h).scale) * 100,
            )}
            %
          </span>
          <button aria-label="Phóng to" onClick={() => zoom(1.25)}>
            <Plus size={16} />
          </button>
          <button onClick={fit}>
            <Maximize size={15} /> Vừa màn hình
          </button>
        </div>
      </div>
      <div
        ref={viewport}
        className="corner-viewport"
        data-testid="corner-viewport"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={() => {
          pointers.current.clear();
          setDrag(null);
          gesture.current = null;
          unlockPage();
        }}
      >
        <canvas
          ref={canvas}
          className="source-canvas"
          aria-label="Toàn bộ ảnh nguồn và vùng bốn góc"
        />
        {corners.map((p, i) => {
          const s = toScreen(p, source.width, source.height, view);
          return (
            <button
              key={i}
              className={`corner-handle ${drag === i ? 'dragging' : ''}`}
              data-corner={i}
              data-x={p.x}
              data-y={p.y}
              aria-label={`Góc ${names[i]}`}
              title={`${names[i]} · dùng phím mũi tên để tinh chỉnh`}
              style={{ left: s.x, top: s.y }}
              onKeyDown={(e) => {
                const delta = e.shiftKey ? 10 : 1;
                const offsets: Record<string, Point> = {
                  ArrowLeft: { x: -delta, y: 0 },
                  ArrowRight: { x: delta, y: 0 },
                  ArrowUp: { x: 0, y: -delta },
                  ArrowDown: { x: 0, y: delta },
                };
                const d = offsets[e.key];
                if (d) {
                  e.preventDefault();
                  const q = [...corners] as Quad;
                  q[i] = {
                    x: Math.min(1, Math.max(0, p.x + d.x / source.width)),
                    y: Math.min(1, Math.max(0, p.y + d.y / source.height)),
                  };
                  onChange(q);
                }
              }}
            >
              <span>{i + 1}</span>
            </button>
          );
        })}
        {drag !== null && (
          <div
            className="loupe"
            style={{
              left:
                toScreen(corners[drag], source.width, source.height, view).x > size.w / 2
                  ? 12
                  : undefined,
              right:
                toScreen(corners[drag], source.width, source.height, view).x <= size.w / 2
                  ? 12
                  : undefined,
            }}
          >
            <canvas ref={loupe} />
            <span>{names[drag]}</span>
          </div>
        )}
        <div className="canvas-caption">4 góc theo mép thật của thẻ</div>
      </div>
      <div className="corner-legend">
        {names.map((name, i) => (
          <span key={name}>
            <b>{i + 1}</b>
            {name}
          </span>
        ))}
      </div>
      {!valid && (
        <p role="alert" className="notice error">
          Bốn góc không hợp lệ: không được tự cắt, lõm hoặc quá sát nhau.
        </p>
      )}
      <div className="editor-actions">
        <button onClick={onDetect} disabled={busy || !cvReady}>
          <ScanLine size={17} /> Tìm mép thẻ
        </button>
        <button className="text-button" onClick={onReset}>
          <RotateCcw size={15} /> Đặt lại góc
        </button>
        <button className="primary apply" onClick={onApply} disabled={busy || !valid}>
          <Check size={17} />
          {busy ? 'Đang xử lý…' : 'Áp dụng'}
        </button>
      </div>
    </>
  );
}
