export type Point = { x: number; y: number };
export type Quad = [Point, Point, Point, Point];
export type Tone = { brightness: number; contrast: number; shadows: number; sharpness: number };
export type Mode = 'original' | 'print' | 'custom';
// A print-safe lift: open dark photographic areas without lifting ink-black text
// or pushing already bright highlights into clipping.
export const PRINT_TONE: Tone = { brightness: 10, contrast: -8, shadows: 36, sharpness: 4 };
export const ORIGINAL_TONE: Tone = { brightness: 0, contrast: 0, shadows: 0, sharpness: 0 };
export type Source = {
  canvas: HTMLCanvasElement;
  name: string;
  width: number;
  height: number;
  url: string;
  reduced: boolean;
};
export type Processed = { url: string; blob: Blob; width: number; height: number; engine: string };
export type WorkerRequest = {
  id: number;
  kind: 'detect' | 'process';
  pixels: ImageData;
  corners: Quad;
  tone: Tone;
};
