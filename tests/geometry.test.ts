import { describe, it, expect } from 'vitest';
import {
  area,
  fitView,
  homography,
  initialCorners,
  project,
  toScreen,
  toSource,
  validQuad,
  zoomAt,
} from '../src/lib/geometry';
import { refineCorners } from '../src/processing/detect';
import type { Quad } from '../src/types';
describe('source-coordinate geometry', () => {
  it('rejects crossed, concave, collapsed, outside and non-finite quadrilaterals', () => {
    expect(validQuad(initialCorners())).toBe(true);
    for (const q of [
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0.2, y: 0.2 },
        { x: 0, y: 1 },
      ],
      [
        { x: 0.5, y: 0.5 },
        { x: 0.51, y: 0.5 },
        { x: 0.51, y: 0.51 },
        { x: 0.5, y: 0.51 },
      ],
      [
        { x: -0.01, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      [
        { x: NaN, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
    ])
      expect(validQuad(q as Quad)).toBe(false);
  });
  it('keeps exact coordinates under resize, zoom, pan and DPR-independent CSS pixels', () => {
    for (const [vw, vh] of [
      [320, 320],
      [800, 400],
      [600, 800],
    ])
      for (const dpr of [1, 1.25, 2, 3]) {
        let v = fitView(2400, 1600, vw, vh);
        v = zoomAt(v, { x: 101, y: 74 }, 3.2);
        v.x += 49;
        v.y -= 73;
        const p = { x: 0.384, y: 0.619 },
          s = toScreen(p, 2400, 1600, v),
          roundtrip = toSource({ x: (s.x * dpr) / dpr, y: (s.y * dpr) / dpr }, 2400, 1600, v);
        expect(roundtrip.x).toBeCloseTo(p.x, 12);
        expect(roundtrip.y).toBeCloseTo(p.y, 12);
      }
  });
  it('maps all corners and preserves straight grid lines in a single homography', () => {
    const a: Quad = [
        { x: 0, y: 0 },
        { x: 856, y: 0 },
        { x: 856, y: 540 },
        { x: 0, y: 540 },
      ],
      b: Quad = [
        { x: 120, y: 30 },
        { x: 1100, y: 150 },
        { x: 940, y: 870 },
        { x: 30, y: 620 },
      ];
    const m = homography(a, b);
    a.forEach((p, i) => {
      const out = project(m, p);
      expect(out.x).toBeCloseTo(b[i].x, 7);
      expect(out.y).toBeCloseTo(b[i].y, 7);
    });
    const pts = [0, 270, 540].map((y) => project(m, { x: 428, y }));
    expect(
      (pts[1].x - pts[0].x) * (pts[2].y - pts[0].y) - (pts[1].y - pts[0].y) * (pts[2].x - pts[0].x),
    ).toBeCloseTo(0, 6);
  });
  it('extrapolates rounded corners to straight-edge intersections', () => {
    const approx: Quad = [
      { x: 104, y: 104 },
      { x: 796, y: 104 },
      { x: 796, y: 536 },
      { x: 104, y: 536 },
    ];
    const pts = [];
    for (let x = 130; x < 770; x++) pts.push({ x, y: 100 }, { x, y: 540 });
    for (let y = 130; y < 510; y++) pts.push({ x: 100, y }, { x: 800, y });
    const q = refineCorners(approx, pts);
    expect(q[0].x).toBeCloseTo(100);
    expect(q[0].y).toBeCloseTo(100);
    expect(q[2].x).toBeCloseTo(800);
    expect(q[2].y).toBeCloseTo(540);
    expect(area(q)).toBeCloseTo(700 * 440);
  });
});
