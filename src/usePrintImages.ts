import { useCallback, useEffect, useRef, useState } from 'react';
import { canvasBlob, loadSource } from './lib/image';
import {
  ORIGINAL_TONE,
  PRINT_TONE,
  type Mode,
  type Processed,
  type Source,
  type Tone,
} from './types';

export type PrintImageItem = {
  id: string;
  source: Source;
  mode: Mode;
  tone: Tone;
  result: Processed | null;
  busy: boolean;
  error: string;
};
function release(item: PrintImageItem) {
  URL.revokeObjectURL(item.source.url);
  if (item.result) URL.revokeObjectURL(item.result.url);
  item.source.canvas.width = item.source.canvas.height = 0;
}
export function usePrintImages() {
  const [items, setItems] = useState<PrintImageItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const itemsRef = useRef<PrintImageItem[]>([]);
  const epoch = useRef(0),
    sequence = useRef(0),
    loads = useRef(Promise.resolve());
  // Keep event handlers current; React updater callbacks remain free of side effects.
  const update = useCallback(
    (next: PrintImageItem[] | ((current: PrintImageItem[]) => PrintImageItem[])) => {
      const value = typeof next === 'function' ? next(itemsRef.current) : next;
      itemsRef.current = value;
      setItems(value);
    },
    [],
  );
  // Bound memory to one worker; cancel obsolete work and keep the previous PNG visible.
  useEffect(() => {
    const item = items.find((it) => it.busy && it.source.width > 0);
    if (!item) return;
    let cancelled = false,
      worker: Worker | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined, pendingUrl: string | undefined;
    const fail = (message: string) => {
      if (cancelled) return;
      clearTimeout(timeout);
      worker?.terminate();
      update((current) =>
        current.map((it) => (it.id === item.id ? { ...it, busy: false, error: message } : it)),
      );
    };
    const debounce = setTimeout(() => {
      try {
        worker = new Worker(new URL('./processing/tone.worker.ts', import.meta.url), {
          type: 'module',
        });
        worker.onerror = () => fail('Không chạy được bộ xử lý ảnh. Nhấn Sáng để in để thử lại.');
        worker.onmessageerror = () => fail('Không đọc được kết quả xử lý. Hãy thử lại.');
        timeout = setTimeout(() => fail('Xử lý quá lâu. Hãy thử lại với ảnh nhỏ hơn.'), 45000);
        worker.onmessage = async (
          event: MessageEvent<{ data?: Uint8ClampedArray<ArrayBuffer>; error?: string }>,
        ) => {
          worker?.terminate();
          try {
            if (event.data.error || !event.data.data)
              throw new Error(event.data.error || 'Kết quả ảnh trống.');
            if (cancelled) return;
            const canvas = document.createElement('canvas');
            canvas.width = item.source.width;
            canvas.height = item.source.height;
            canvas
              .getContext('2d')!
              .putImageData(new ImageData(event.data.data, canvas.width, canvas.height), 0, 0);
            const blob = await canvasBlob(canvas);
            canvas.width = canvas.height = 0;
            if (cancelled) return;
            pendingUrl = URL.createObjectURL(blob);
            const image = new Image();
            image.src = pendingUrl;
            await image.decode();
            if (cancelled) return;
            clearTimeout(timeout);
            const result = {
              url: pendingUrl,
              blob,
              width: item.source.width,
              height: item.source.height,
              engine: 'Worker',
            };
            pendingUrl = undefined;
            update((current) =>
              current.map((it) =>
                it.id === item.id ? { ...it, result, busy: false, error: '' } : it,
              ),
            );
            if (item.result) URL.revokeObjectURL(item.result.url);
          } catch (error) {
            if (pendingUrl) URL.revokeObjectURL(pendingUrl);
            pendingUrl = undefined;
            fail(error instanceof Error ? error.message : 'Không xử lý được ảnh.');
          }
        };
        const pixels = item.source.canvas
          .getContext('2d', { willReadFrequently: true })!
          .getImageData(0, 0, item.source.width, item.source.height);
        worker.postMessage({ pixels, tone: item.tone }, [pixels.data.buffer]);
      } catch (error) {
        fail(error instanceof Error ? error.message : 'Không khởi tạo được bộ xử lý.');
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
      clearTimeout(timeout);
      worker?.terminate();
      if (pendingUrl) URL.revokeObjectURL(pendingUrl);
    };
  }, [items, update]);
  const addFiles = useCallback(
    (files: File[]) => {
      if (!files.length) return;
      const remaining = Math.max(0, 20 - itemsRef.current.length);
      setLoadError(
        files.length > remaining
          ? 'Mỗi lượt in tối đa 20 ảnh. Hãy xuất hoặc xóa bớt ảnh trước khi thêm.'
          : '',
      );
      const accepted = files.slice(0, remaining),
        token = epoch.current;
      const pending = accepted.map((file) => ({
        id: String(++sequence.current),
        source: {
          canvas: document.createElement('canvas'),
          name: file.name,
          width: 0,
          height: 0,
          url: '',
          reduced: false,
        },
        mode: 'print' as const,
        tone: { ...PRINT_TONE },
        result: null,
        busy: true,
        error: '',
      }));
      update((current) => [...current, ...pending]);
      loads.current = loads.current.then(async () => {
        for (const [index, item] of pending.entries()) {
          if (epoch.current !== token) return;
          if (!itemsRef.current.some((it) => it.id === item.id)) continue;
          try {
            const source = await loadSource(accepted[index]);
            if (epoch.current !== token || !itemsRef.current.some((it) => it.id === item.id)) {
              URL.revokeObjectURL(source.url);
              source.canvas.width = source.canvas.height = 0;
              continue;
            }
            const pixels = itemsRef.current.reduce(
              (sum, it) => sum + it.source.width * it.source.height,
              0,
            );
            if (pixels + source.width * source.height > 60_000_000) {
              URL.revokeObjectURL(source.url);
              source.canvas.width = source.canvas.height = 0;
              throw new Error(
                'Tổng ảnh vượt 60 megapixel. Hãy xóa bớt ảnh hoặc chia thành nhiều lượt in.',
              );
            }
            update((current) => current.map((it) => (it.id === item.id ? { ...it, source } : it)));
          } catch (error) {
            if (epoch.current !== token) return;
            update((current) =>
              current.map((it) =>
                it.id === item.id
                  ? {
                      ...it,
                      busy: false,
                      error: error instanceof Error ? error.message : 'Không đọc được ảnh.',
                    }
                  : it,
              ),
            );
          }
        }
      });
    },
    [update],
  );
  const changeTone = useCallback(
    (id: string, mode: Mode, tone?: Tone) => {
      update((current) =>
        current.map((item) => {
          if (item.id !== id || !item.source.width) return item;
          const nextTone =
            mode === 'original'
              ? ORIGINAL_TONE
              : mode === 'print'
                ? PRINT_TONE
                : (tone ?? item.tone);
          return { ...item, mode, tone: { ...nextTone }, busy: true, error: '' };
        }),
      );
    },
    [update],
  );
  const remove = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((it) => it.id === id);
      update((current) => current.filter((it) => it.id !== id));
      if (item) release(item);
      setLoadError('');
    },
    [update],
  );
  const reset = useCallback(() => {
    epoch.current++;
    itemsRef.current.forEach(release);
    update([]);
    setLoadError('');
  }, [update]);
  useEffect(
    () => () => {
      epoch.current++;
      itemsRef.current.forEach(release);
      itemsRef.current = [];
    },
    [],
  );
  const ready = items.length > 0 && items.every((item) => item.result && !item.busy && !item.error);
  return { items, addFiles, changeTone, remove, reset, ready, loadError };
}
