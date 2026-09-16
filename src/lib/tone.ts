import type { Tone } from '../types';
export function applyTone(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  tone: Tone,
): Uint8ClampedArray {
  if (tone.brightness === 0 && tone.contrast === 0 && tone.shadows === 0 && tone.sharpness === 0)
    return new Uint8ClampedArray(data);
  const smoothstep = (edge0: number, edge1: number, value: number) => {
    const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  };
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    // A gentle exposure lift plus a stronger shadow lift. The black guard keeps
    // printed glyphs/QR modules black; the highlight guard prevents a white
    // background from clipping. Both curves are global and content-preserving.
    const blackGuard = smoothstep(0.025, 0.16, l);
    const highlightGuard = 1 - smoothstep(0.74, 0.99, l);
    const lift =
      (tone.brightness / 100) * 0.14 * Math.sin(Math.PI * l) * highlightGuard +
      (tone.shadows / 100) * 0.34 * blackGuard * (1 - l) ** 1.35 * highlightGuard;
    for (let c = 0; c < 3; c++) {
      const v = data[i + c] / 255;
      if (v <= 0.004 && l <= 0.025) {
        out[i + c] = 0;
        continue;
      }
      if (v >= 0.996 && l >= 0.996) {
        out[i + c] = 255;
        continue;
      }
      const lifted = v + lift;
      const contrastScale = 1 + (tone.contrast / 100) * 0.65;
      const contrasted = 0.5 + (lifted - 0.5) * contrastScale;
      out[i + c] = 255 * Math.max(0, Math.min(1, contrasted));
    }
    out[i + 3] = 255;
  }
  if (tone.sharpness <= 0) return out;
  const result = new Uint8ClampedArray(out),
    amount = (tone.sharpness / 100) * 0.45;
  for (let y = 1; y < height - 1; y++)
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const neighbors = [
          out[i - 4 + c],
          out[i + 4 + c],
          out[i - width * 4 + c],
          out[i + width * 4 + c],
        ];
        const mean = neighbors.reduce((a, b) => a + b, 0) / 4,
          delta = out[i + c] - mean;
        // Cap correction to 5 levels and clamp to local extrema: suppress sharpening halos.
        result[i + c] = Math.max(
          Math.min(out[i + c], ...neighbors),
          Math.min(
            Math.max(out[i + c], ...neighbors),
            out[i + c] + Math.max(-5, Math.min(5, delta * amount)),
          ),
        );
      }
    }
  return result;
}
