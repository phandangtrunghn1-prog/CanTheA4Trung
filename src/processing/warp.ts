import type * as CV from '@techstark/opencv-js';
import type { Quad } from '../types';
import { CARD_RATIO, distance, homography, project, validQuad } from '../lib/geometry';
export function outputSize(pixels: ImageData, corners: Quad) {
  const q = corners.map((p) => ({
    x: p.x * (pixels.width - 1),
    y: p.y * (pixels.height - 1),
  })) as Quad;
  const native = Math.max(
    distance(q[0], q[1]),
    distance(q[3], q[2]),
    distance(q[0], q[3]) * CARD_RATIO,
    distance(q[1], q[2]) * CARD_RATIO,
  );
  const width = Math.max(400, Math.min(2022, Math.round(native)));
  return { q, width, height: Math.round(width / CARD_RATIO) };
}
export function warp(cv: typeof CV | null, pixels: ImageData, corners: Quad): ImageData {
  if (!validQuad(corners))
    throw new Error('Bốn góc không hợp lệ. Hãy chọn một tứ giác lồi, không tự cắt.');
  const { q, width, height } = outputSize(pixels, corners);
  const dest: Quad = [
    { x: 0, y: 0 },
    { x: width - 1, y: 0 },
    { x: width - 1, y: height - 1 },
    { x: 0, y: height - 1 },
  ];
  if (cv) {
    const owned: { delete: () => void }[] = [];
    const own = <T extends { delete: () => void }>(m: T) => {
      owned.push(m);
      return m;
    };
    try {
      const src = own(cv.matFromImageData(pixels)),
        dst = own(new cv.Mat());
      const a = own(
          cv.matFromArray(
            4,
            1,
            cv.CV_32FC2,
            q.flatMap((p) => [p.x, p.y]),
          ),
        ),
        b = own(
          cv.matFromArray(
            4,
            1,
            cv.CV_32FC2,
            dest.flatMap((p) => [p.x, p.y]),
          ),
        );
      const transform = own(cv.getPerspectiveTransform(a, b));
      cv.warpPerspective(
        src,
        dst,
        transform,
        new cv.Size(width, height),
        cv.INTER_LINEAR,
        cv.BORDER_CONSTANT,
        new cv.Scalar(255, 255, 255, 255),
      );
      return new ImageData(new Uint8ClampedArray(dst.data), width, height);
    } finally {
      owned.reverse().forEach((m) => m.delete());
    }
  }
  // OpenCV failed: equivalent single homography with inverse bilinear sampling, never triangles.
  const m = homography(dest, q),
    out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = project(m, { x, y }),
        sx = Math.max(0, Math.min(pixels.width - 1, p.x)),
        sy = Math.max(0, Math.min(pixels.height - 1, p.y));
      const x0 = Math.floor(sx),
        y0 = Math.floor(sy),
        x1 = Math.min(x0 + 1, pixels.width - 1),
        y1 = Math.min(y0 + 1, pixels.height - 1),
        fx = sx - x0,
        fy = sy - y0,
        i = (y * width + x) * 4;
      for (let c = 0; c < 3; c++)
        out[i + c] =
          (1 - fy) *
            ((1 - fx) * pixels.data[(y0 * pixels.width + x0) * 4 + c] +
              fx * pixels.data[(y0 * pixels.width + x1) * 4 + c]) +
          fy *
            ((1 - fx) * pixels.data[(y1 * pixels.width + x0) * 4 + c] +
              fx * pixels.data[(y1 * pixels.width + x1) * 4 + c]);
      out[i + 3] = 255;
    }
  return new ImageData(out, width, height);
}
