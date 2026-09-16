import { useEffect, useRef, useState } from 'react';
import { canvasBlob, loadSource, rotateSource } from './lib/image';
import { initialCorners, validQuad } from './lib/geometry';
import { Processor, type CvStatus } from './processing/client';
import {
  ORIGINAL_TONE,
  PRINT_TONE,
  type Mode,
  type Processed,
  type Quad,
  type Source,
  type Tone,
} from './types';
export function useSide() {
  const [source, setSource] = useState<Source | null>(null),
    [corners, setCorners] = useState<Quad>(initialCorners),
    [result, setResult] = useState<Processed | null>(null);
  const [mode, setMode] = useState<Mode>('print'),
    [tone, setTone] = useState<Tone>({ ...PRINT_TONE }),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<CvStatus>('loading'),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  const generation = useRef(0),
    processor = useRef<Processor | null>(null),
    sourceRef = useRef(source),
    resultRef = useRef(result),
    applied = useRef<Quad | null>(null),
    debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const makeProcessor = (fallback = false) => {
    setStatus(fallback ? 'fallback' : 'loading');
    processor.current?.dispose();
    processor.current = new Processor(setStatus, fallback);
    return processor.current;
  };
  const clearResult = () => {
    if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    resultRef.current = null;
    setResult(null);
  };
  const invalidate = () => {
    generation.current++;
    clearTimeout(debounce.current);
    processor.current?.dispose();
    processor.current = null;
    setBusy(false);
    clearResult();
  };
  useEffect(
    () => () => {
      generation.current++;
      clearTimeout(debounce.current);
      processor.current?.dispose();
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
      if (resultRef.current) URL.revokeObjectURL(resultRef.current.url);
    },
    [],
  );
  function reset() {
    invalidate();
    if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
    sourceRef.current = null;
    setSource(null);
    setCorners(initialCorners());
    applied.current = null;
    setError('');
    setMessage('');
    setConfirmed(false);
    setLoading(false);
    setMode('print');
    setTone({ ...PRINT_TONE });
  }
  async function load(file: File) {
    invalidate();
    const token = generation.current;
    setLoading(true);
    setError('');
    setMessage('');
    setConfirmed(false);
    applied.current = null;
    try {
      const next = await loadSource(file);
      if (token !== generation.current) {
        URL.revokeObjectURL(next.url);
        return;
      }
      if (sourceRef.current) URL.revokeObjectURL(sourceRef.current.url);
      sourceRef.current = next;
      setSource(next);
      setCorners(initialCorners());
      makeProcessor();
    } catch (e) {
      if (token === generation.current)
        setError(e instanceof Error ? e.message : 'Không tải được ảnh.');
    } finally {
      if (token === generation.current) setLoading(false);
    }
  }
  async function rotate() {
    if (!sourceRef.current) return;
    invalidate();
    const token = generation.current;
    setLoading(true);
    setConfirmed(false);
    setError('');
    setMessage('');
    applied.current = null;
    try {
      const next = await rotateSource(sourceRef.current);
      if (token !== generation.current) {
        URL.revokeObjectURL(next.url);
        return;
      }
      URL.revokeObjectURL(sourceRef.current.url);
      sourceRef.current = next;
      setSource(next);
      setCorners(initialCorners());
      makeProcessor();
    } catch (e) {
      if (token === generation.current)
        setError(e instanceof Error ? e.message : 'Không xoay được ảnh.');
    } finally {
      if (token === generation.current) setLoading(false);
    }
  }
  function changeCorners(q: Quad) {
    generation.current++;
    clearTimeout(debounce.current);
    clearResult();
    setCorners(q);
    applied.current = null;
    setMessage('');
    setBusy(false);
  }
  async function process(q: Quad = corners, nextTone: Tone = tone, nextMode: Mode = mode) {
    if (!sourceRef.current || !validQuad(q)) return;
    const token = ++generation.current;
    applied.current = q;
    setBusy(true);
    setError('');
    try {
      const p =
        processor.current && !processor.current.closed
          ? processor.current
          : makeProcessor(status === 'fallback');
      const s = sourceRef.current;
      const response = await p.run(
        'process',
        s.canvas.getContext('2d')!.getImageData(0, 0, s.width, s.height),
        q,
        nextMode === 'original' ? ORIGINAL_TONE : nextMode === 'print' ? PRINT_TONE : nextTone,
      );
      if (token !== generation.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = response.width;
      canvas.height = response.height;
      canvas
        .getContext('2d')!
        .putImageData(new ImageData(response.data!, response.width, response.height), 0, 0);
      const blob = await canvasBlob(canvas);
      if (token !== generation.current) return;
      const next = {
        blob,
        url: URL.createObjectURL(blob),
        width: response.width,
        height: response.height,
        engine: response.engine,
      };
      const decoded = new Image();
      decoded.src = next.url;
      try {
        await decoded.decode();
      } catch (e) {
        URL.revokeObjectURL(next.url);
        throw e;
      }
      if (token !== generation.current) {
        URL.revokeObjectURL(next.url);
        return;
      }
      // Keep the previous image visible until the replacement is ready. This is
      // especially useful while dragging tone sliders: preview and A4 layout do
      // not blink or disappear during the short worker/decode round-trip.
      const previous = resultRef.current;
      resultRef.current = next;
      if (previous) URL.revokeObjectURL(previous.url);
      setResult(next);
      applied.current = q;
      setMessage('Đã căn chỉnh. Kiểm tra mép thẻ và nội dung trước khi xuất.');
    } catch (e) {
      if (token === generation.current) {
        setError(e instanceof Error ? e.message : 'Xử lý ảnh thất bại.');
        processor.current?.dispose();
        processor.current = null;
      }
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  async function detect() {
    if (!sourceRef.current || status !== 'ready') return;
    const token = ++generation.current;
    setBusy(true);
    setError('');
    setMessage('Đang tìm các cạnh thẳng…');
    try {
      const s = sourceRef.current;
      const response = await (
        processor.current && !processor.current.closed ? processor.current : makeProcessor()
      ).run(
        'detect',
        s.canvas.getContext('2d')!.getImageData(0, 0, s.width, s.height),
        corners,
        tone,
      );
      if (token !== generation.current) return;
      if (response.corners) {
        setCorners(response.corners);
        clearResult();
        applied.current = null;
        setMessage('Đã đề xuất bốn góc. Kiểm tra mép thật, chỉnh tay nếu cần rồi nhấn Áp dụng.');
      } else setMessage('Cần chỉnh góc bằng tay');
    } catch (e) {
      if (token === generation.current)
        setError(e instanceof Error ? e.message : 'Cần chỉnh góc bằng tay');
    } finally {
      if (token === generation.current) setBusy(false);
    }
  }
  function changeTone(nextMode: Mode, nextTone: Tone = tone) {
    nextTone =
      nextMode === 'print'
        ? { ...PRINT_TONE }
        : nextMode === 'original'
          ? { ...ORIGINAL_TONE }
          : nextTone;
    setMode(nextMode);
    setTone(nextTone);
    const q = applied.current;
    generation.current++;
    clearTimeout(debounce.current);
    processor.current?.dispose();
    processor.current = null;
    setError('');
    setBusy(false);
    if (q) {
      setBusy(true);
      debounce.current = setTimeout(() => void process(q, nextTone, nextMode), 250);
    }
  }
  return {
    source,
    corners,
    result,
    mode,
    tone,
    busy,
    loading,
    status,
    message,
    error,
    confirmed,
    setConfirmed,
    load,
    rotate,
    reset,
    changeCorners,
    process,
    detect,
    changeTone,
    fallback: () => {
      generation.current++;
      setBusy(false);
      setMessage('Chế độ dự phòng: căn phối cảnh bằng bốn góc thủ công.');
      makeProcessor(true);
    },
  };
}
export type SideModel = ReturnType<typeof useSide>;
