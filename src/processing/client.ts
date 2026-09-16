import type { Quad, Tone } from '../types';
export type CvStatus = 'loading' | 'ready' | 'fallback';
type Result = {
  corners?: Quad | null;
  data?: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
  engine: string;
};
export class Processor {
  closed = false;
  private worker: Worker;
  private idle: ReturnType<typeof setTimeout> | undefined;
  private sequence = 0;
  private pending = new Map<
    number,
    {
      resolve: (r: Result) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  constructor(onStatus: (status: CvStatus) => void, fallback = false) {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url));
    this.worker.onmessage = (e) => {
      if (e.data.kind === 'status') {
        onStatus(e.data.status);
        if (!this.pending.size) this.idle = setTimeout(() => this.dispose(), 30000);
        return;
      }
      const job = this.pending.get(e.data.id);
      if (!job) return;
      clearTimeout(job.timer);
      this.pending.delete(e.data.id);
      if (e.data.error) job.reject(new Error(e.data.error));
      else job.resolve(e.data);
      if (!this.pending.size) this.dispose();
    };
    this.worker.onerror = () => {
      onStatus('fallback');
      this.dispose('Worker không chạy được. Hãy thử lại hoặc tải lại trang.');
    };
    this.worker.postMessage({
      kind: 'init',
      url: new URL('vendor/opencv.js', document.baseURI).href,
      fallback,
    });
  }
  run(kind: 'detect' | 'process', pixels: ImageData, corners: Quad, tone: Tone): Promise<Result> {
    clearTimeout(this.idle);
    if (this.closed) return Promise.reject(new Error('Worker đã kết thúc. Hãy thử lại.'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.dispose('Xử lý quá lâu. Hãy thử lại với ảnh nhỏ hơn.');
      }, 45000);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, kind, pixels, corners, tone }, [pixels.data.buffer]);
    });
  }
  dispose(message = 'Đã hủy tác vụ cũ.') {
    this.closed = true;
    clearTimeout(this.idle);
    this.worker.terminate();
    for (const job of this.pending.values()) {
      clearTimeout(job.timer);
      job.reject(new Error(message));
    }
    this.pending.clear();
  }
}
