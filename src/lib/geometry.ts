import type { Point, Quad } from '../types';
export const CARD_RATIO = 85.6 / 53.98;
export const initialCorners = (): Quad => [
  { x: 0.12, y: 0.18 },
  { x: 0.88, y: 0.18 },
  { x: 0.88, y: 0.82 },
  { x: 0.12, y: 0.82 },
];
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const area = (p: Quad) =>
  Math.abs(
    p.reduce((sum, a, i) => {
      const b = p[(i + 1) % 4];
      return sum + a.x * b.y - b.x * a.y;
    }, 0),
  ) / 2;
export function validQuad(p: Quad): boolean {
  if (
    p.length !== 4 ||
    p.some(
      (a) =>
        !Number.isFinite(a.x) || !Number.isFinite(a.y) || a.x < 0 || a.x > 1 || a.y < 0 || a.y > 1,
    )
  )
    return false;
  if (area(p) < 0.0025) return false;
  return p.every((a, i) => {
    const b = p[(i + 1) % 4],
      c = p[(i + 2) % 4];
    return distance(a, b) > 0.012 && (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > 0.0001;
  });
}
export function orderQuad(points: Point[]): Quad {
  const center = points.reduce((a, p) => ({ x: a.x + p.x / 4, y: a.y + p.y / 4 }), { x: 0, y: 0 });
  const sorted = [...points].sort(
    (a, b) =>
      Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x),
  );
  const start = sorted.reduce(
    (best, p, i) => (p.x + p.y < sorted[best].x + sorted[best].y ? i : best),
    0,
  );
  return [...sorted.slice(start), ...sorted.slice(0, start)] as Quad;
}
export type View = { scale: number; x: number; y: number };
export function fitView(w: number, h: number, vw: number, vh: number): View {
  const scale = Math.min((vw - 40) / w, (vh - 40) / h);
  return { scale, x: (vw - w * scale) / 2, y: (vh - h * scale) / 2 };
}
export function toScreen(p: Point, w: number, h: number, v: View): Point {
  return { x: v.x + p.x * w * v.scale, y: v.y + p.y * h * v.scale };
}
export function toSource(p: Point, w: number, h: number, v: View): Point {
  return {
    x: Math.max(0, Math.min(1, (p.x - v.x) / (w * v.scale))),
    y: Math.max(0, Math.min(1, (p.y - v.y) / (h * v.scale))),
  };
}
export function zoomAt(v: View, p: Point, factor: number): View {
  return { scale: v.scale * factor, x: p.x - (p.x - v.x) * factor, y: p.y - (p.y - v.y) * factor };
}

/** One global projective transform, mapping destination pixel coordinates back to source. */
export function homography(from: Quad, to: Quad): number[] {
  const rows: number[][] = [];
  from.forEach((p, i) => {
    const q = to[i];
    rows.push([p.x, p.y, 1, 0, 0, 0, -q.x * p.x, -q.x * p.y, q.x]);
    rows.push([0, 0, 0, p.x, p.y, 1, -q.y * p.x, -q.y * p.y, q.y]);
  });
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++)
      if (Math.abs(rows[r][col]) > Math.abs(rows[pivot][col])) pivot = r;
    [rows[col], rows[pivot]] = [rows[pivot], rows[col]];
    const d = rows[col][col];
    if (Math.abs(d) < 1e-10) throw new Error('Bốn góc suy biến. Hãy đặt lại góc.');
    for (let c = col; c < 9; c++) rows[col][c] /= d;
    for (let r = 0; r < 8; r++)
      if (r !== col) {
        const f = rows[r][col];
        for (let c = col; c < 9; c++) rows[r][c] -= f * rows[col][c];
      }
  }
  return [...rows.map((r) => r[8]), 1];
}
export function project(m: number[], p: Point): Point {
  const d = m[6] * p.x + m[7] * p.y + m[8];
  return { x: (m[0] * p.x + m[1] * p.y + m[2]) / d, y: (m[3] * p.x + m[4] * p.y + m[5]) / d };
}
