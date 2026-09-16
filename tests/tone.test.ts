import { it, expect } from 'vitest';
import { applyTone } from '../src/lib/tone';
import { PRINT_TONE, ORIGINAL_TONE } from '../src/types';
it('original mode is pixel-identical and processing does not mutate its source', () => {
  const data = new Uint8ClampedArray(256 * 4);
  for (let n = 0; n < 256; n++) data.set([n, n, n, 255], n * 4);
  const original = data.slice();
  expect(applyTone(data, 256, 1, ORIGINAL_TONE)).toEqual(data);
  applyTone(data, 256, 1, PRINT_TONE);
  expect(data).toEqual(original);
});
it('lifts shadows gently, anchors black and white, and preserves tonal ordering', () => {
  const data = new Uint8ClampedArray(256 * 4);
  for (let n = 0; n < 256; n++) {
    data.set([n, n, n, 255], n * 4);
  }
  const out = applyTone(data, 256, 1, PRINT_TONE);
  expect(out[0]).toBe(0);
  expect(out[255 * 4]).toBe(255);
  expect(out[60 * 4]).toBeGreaterThan(60);
  expect(out[60 * 4]).toBeLessThan(100);
  expect(out[240 * 4]).toBeLessThan(255);
  expect(out[20 * 4]).toBeGreaterThan(20);
  for (let i = 1; i < 256; i++) expect(out[i * 4]).toBeGreaterThanOrEqual(out[(i - 1) * 4]);
  expect(applyTone(data, 256, 1, PRINT_TONE)).toEqual(out);
});
it('bounded sharpening cannot introduce halos outside local extrema', () => {
  const data = new Uint8ClampedArray(12 * 12 * 4);
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 12; x++) {
      const v = x < 6 ? 50 : 180;
      data.set([v, v, v, 255], (y * 12 + x) * 4);
    }
  const out = applyTone(data, 12, 12, { ...ORIGINAL_TONE, sharpness: 50 });
  for (let i = 0; i < out.length; i += 4) {
    expect(out[i]).toBeGreaterThanOrEqual(50);
    expect(out[i]).toBeLessThanOrEqual(180);
  }
});
