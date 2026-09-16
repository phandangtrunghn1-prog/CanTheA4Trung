/// <reference lib="webworker" />
import type * as CV from '@techstark/opencv-js';
import type { WorkerRequest } from '../types';
import { detectCard } from './detect';
import { warp } from './warp';
import { applyTone } from '../lib/tone';
declare const self: DedicatedWorkerGlobalScope & { cv: typeof CV | Promise<typeof CV> };
let cv: typeof CV | null = null;
let ready: Promise<void> = Promise.resolve();
self.onmessage = async (
  event: MessageEvent<WorkerRequest | { kind: 'init'; url: string; fallback?: boolean }>,
) => {
  const msg = event.data;
  if (msg.kind === 'init') {
    ready = (async () => {
      try {
        if (msg.fallback) throw new Error('fallback');
        // Production workers are classic; Vite's development workers use modules.
        if (import.meta.env.DEV) await import(/* @vite-ignore */ msg.url);
        else self.importScripts(msg.url);
        // This pinned build exposes an Emscripten thenable, not a native Promise.
        // Poll the initialized Mat constructor; awaiting the thenable can recurse forever.
        await new Promise<void>((resolve, reject) => {
          const start = Date.now();
          const check = () => {
            if ((self.cv as typeof CV)?.Mat) resolve();
            else if (Date.now() - start > 15000) reject(new Error('timeout'));
            else setTimeout(check, 40);
          };
          check();
        });
        cv = self.cv as typeof CV;
        if (!cv?.Mat) throw new Error('OpenCV không khởi tạo được');
        self.postMessage({ kind: 'status', status: 'ready' });
      } catch (error) {
        console.warn('Không tải được OpenCV:', error);
        cv = null;
        self.postMessage({ kind: 'status', status: 'fallback' });
      }
    })();
    return;
  }
  await ready;
  try {
    if (msg.kind === 'detect') {
      const corners = cv ? detectCard(cv, msg.pixels) : null;
      self.postMessage({ id: msg.id, corners });
    } else {
      const warped = warp(cv, msg.pixels, msg.corners);
      const data = applyTone(warped.data, warped.width, warped.height, msg.tone);
      self.postMessage(
        {
          id: msg.id,
          data,
          width: warped.width,
          height: warped.height,
          engine: cv ? 'OpenCV' : 'Dự phòng',
        },
        [data.buffer],
      );
    }
  } catch (error) {
    self.postMessage({
      id: msg.id,
      error:
        error instanceof Error
          ? error.message
          : 'Xử lý ảnh thất bại. Hãy giảm kích thước ảnh hoặc thử lại.',
    });
  }
};
