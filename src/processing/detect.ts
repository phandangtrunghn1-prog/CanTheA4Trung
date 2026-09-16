import type * as CV from '@techstark/opencv-js';
import type { Point, Quad } from '../types';
import { area, CARD_RATIO, distance, orderQuad, validQuad } from '../lib/geometry';
type Cv = typeof CV;
type Line = { p: Point; v: Point };

// Fit central straight segments, excluding curved ends; extrapolate to geometric corners.
export function refineCorners(quad: Quad, contour: Point[]): Quad {
  const lines: Line[] = quad.map((a, i) => {
    const b = quad[(i + 1) % 4],
      dx = b.x - a.x,
      dy = b.y - a.y,
      len = Math.hypot(dx, dy);
    const pts = contour.filter((p) => {
      const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len);
      return (
        t > 0.18 &&
        t < 0.82 &&
        Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len < Math.max(3, len * 0.025)
      );
    });
    if (pts.length < 6) return { p: a, v: { x: dx / len, y: dy / len } };
    const mean = pts.reduce((s, p) => ({ x: s.x + p.x / pts.length, y: s.y + p.y / pts.length }), {
      x: 0,
      y: 0,
    });
    let xx = 0,
      xy = 0,
      yy = 0;
    for (const p of pts) {
      xx += (p.x - mean.x) ** 2;
      xy += (p.x - mean.x) * (p.y - mean.y);
      yy += (p.y - mean.y) ** 2;
    }
    const theta = 0.5 * Math.atan2(2 * xy, xx - yy);
    return { p: mean, v: { x: Math.cos(theta), y: Math.sin(theta) } };
  });
  return lines.map((b, i) => {
    const a = lines[(i + 3) % 4],
      cross = a.v.x * b.v.y - a.v.y * b.v.x;
    if (Math.abs(cross) < 0.15) return quad[i];
    const t = ((b.p.x - a.p.x) * b.v.y - (b.p.y - a.p.y) * b.v.x) / cross;
    const p = { x: a.p.x + t * a.v.x, y: a.p.y + t * a.v.y };
    return distance(p, quad[i]) <
      Math.min(distance(quad[i], quad[(i + 1) % 4]), distance(quad[i], quad[(i + 3) % 4])) * 0.13
      ? p
      : quad[i];
  }) as Quad;
}
export function detectCard(cv: Cv, pixels: ImageData): Quad | null {
  const owned: { delete: () => void }[] = [];
  const own = <T extends { delete: () => void }>(v: T): T => {
    owned.push(v);
    return v;
  };
  try {
    const src = own(cv.matFromImageData(pixels)),
      small = own(new cv.Mat()),
      gray = own(new cv.Mat()),
      smooth = own(new cv.Mat()),
      edges = own(new cv.Mat());
    const factor = Math.min(1, 1000 / Math.max(pixels.width, pixels.height)),
      w = Math.round(pixels.width * factor),
      h = Math.round(pixels.height * factor);
    cv.resize(src, small, new cv.Size(w, h), 0, 0, cv.INTER_AREA);
    cv.cvtColor(small, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, smooth, new cv.Size(5, 5), 0);
    const candidates: { quad: Quad; score: number }[] = [];
    for (const [low, high] of [
      [35, 100],
      [70, 180],
      [15, 50],
    ]) {
      cv.Canny(smooth, edges, low, high);
      const contours = new cv.MatVector(),
        hierarchy = new cv.Mat();
      try {
        cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_NONE);
        for (let i = 0; i < contours.size(); i++) {
          const contour = contours.get(i),
            approx = new cv.Mat(),
            hull = new cv.Mat();
          try {
            const ca = Math.abs(cv.contourArea(contour)) / (w * h);
            if (ca < 0.075 || ca > 0.93) continue;
            cv.convexHull(contour, hull);
            cv.approxPolyDP(hull, approx, cv.arcLength(hull, true) * 0.018, true);
            if (approx.rows !== 4 || !cv.isContourConvex(approx)) continue;
            let q = orderQuad(
              Array.from({ length: 4 }, (_, j) => ({
                x: approx.data32S[j * 2],
                y: approx.data32S[j * 2 + 1],
              })),
            );
            const pts = Array.from({ length: contour.rows }, (_, j) => ({
              x: contour.data32S[j * 2],
              y: contour.data32S[j * 2 + 1],
            }));
            q = refineCorners(q, pts);
            const normalized = q.map((p) => ({ x: p.x / (w - 1), y: p.y / (h - 1) })) as Quad;
            if (
              !validQuad(normalized) ||
              normalized.some((p) => p.x < 0.009 || p.x > 0.991 || p.y < 0.009 || p.y > 0.991)
            )
              continue;
            const lengths = q.map((a, j) => distance(a, q[(j + 1) % 4])),
              ratio = (lengths[0] + lengths[2]) / (lengths[1] + lengths[3]);
            const ratioError = Math.min(
              Math.abs(Math.log(ratio / CARD_RATIO)),
              Math.abs(Math.log(ratio * CARD_RATIO)),
            );
            if (ratioError > 0.4) continue;
            const angles = q.map((p, j) => {
              const a = q[(j + 3) % 4],
                b = q[(j + 1) % 4];
              return Math.abs(
                ((a.x - p.x) * (b.x - p.x) + (a.y - p.y) * (b.y - p.y)) /
                  (distance(a, p) * distance(b, p)),
              );
            });
            if (Math.max(...angles) > 0.7) continue;
            // Require edge support on ALL four edges, not just a strong shadow on one edge.
            const supports = q.map((a, j) => {
              const b = q[(j + 1) % 4];
              let hits = 0;
              for (let k = 0; k < 60; k++) {
                const t = 0.12 + (0.76 * k) / 59,
                  x = Math.round(a.x + (b.x - a.x) * t),
                  y = Math.round(a.y + (b.y - a.y) * t);
                let found = false;
                for (let dy = -2; dy <= 2 && !found; dy++)
                  for (let dx = -2; dx <= 2; dx++)
                    if (
                      x + dx >= 0 &&
                      x + dx < w &&
                      y + dy >= 0 &&
                      y + dy < h &&
                      edges.ucharAt(y + dy, x + dx) > 0
                    )
                      found = true;
                if (found) hits++;
              }
              return hits / 60;
            });
            if (Math.min(...supports) < 0.52) continue;
            // Reject nearly blank regions. Background/plastic margins reduce distributed detail.
            let total = 0,
              total2 = 0,
              n = 0;
            for (let yy = 1; yy < 12; yy++)
              for (let xx = 1; xx < 18; xx++) {
                const u = xx / 18,
                  v = yy / 12;
                const x = Math.round(
                  (1 - v) * ((1 - u) * q[0].x + u * q[1].x) + v * ((1 - u) * q[3].x + u * q[2].x),
                );
                const y = Math.round(
                  (1 - v) * ((1 - u) * q[0].y + u * q[1].y) + v * ((1 - u) * q[3].y + u * q[2].y),
                );
                const value = gray.ucharAt(y, x);
                total += value;
                total2 += value * value;
                n++;
              }
            const deviation = Math.sqrt(Math.max(0, total2 / n - (total / n) ** 2));
            if (deviation < 9) continue;
            const solidity = Math.min(
              1,
              Math.abs(cv.contourArea(contour)) / Math.max(1, Math.abs(cv.contourArea(hull))),
            );
            const score =
              0.34 * (supports.reduce((a, b) => a + b) / 4) +
              0.24 * Math.exp(-ratioError * 4) +
              0.17 * (1 - angles.reduce((a, b) => a + b) / 4) +
              0.1 * solidity +
              0.08 * Math.min(1, deviation / 45) +
              0.07 * (1 - Math.abs(area(normalized) - 0.4));
            // Cluster the two sides of a narrow rim/printed border into one edge band.
            // Keep its best-scoring geometry; larger competing sleeves remain separate.
            const same = candidates.find((c) =>
              c.quad.every((p, j) => distance(p, normalized[j]) < 0.025),
            );
            if (!same) candidates.push({ quad: normalized, score });
            else if (score > same.score) {
              same.quad = normalized;
              same.score = score;
            }
          } finally {
            hull.delete();
            approx.delete();
            contour.delete();
          }
        }
      } finally {
        contours.delete();
        hierarchy.delete();
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    if (!candidates[0] || candidates[0].score < 0.76) return null;
    // Competing nested boundaries (sleeve, shadow, table): do not guess.
    if (candidates[1] && candidates[0].score - candidates[1].score < 0.065) return null;
    return candidates[0].quad;
  } finally {
    owned.reverse().forEach((m) => m.delete());
  }
}
