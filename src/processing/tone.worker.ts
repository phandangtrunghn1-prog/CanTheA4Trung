import { applyTone } from '../lib/tone';
import type { Tone } from '../types';

self.onmessage = (event: MessageEvent<{ pixels: ImageData; tone: Tone }>) => {
  try {
    const { pixels, tone } = event.data;
    const data = applyTone(pixels.data, pixels.width, pixels.height, tone);
    self.postMessage({ data }, { transfer: [data.buffer] });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Không xử lý được ảnh.' });
  }
};
