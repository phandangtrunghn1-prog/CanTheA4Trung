import sharp from 'sharp';
import { homography, project } from '../../src/lib/geometry';
import type { Quad } from '../../src/types';
export const photoCorners: Quad = [
  { x: 170, y: 120 },
  { x: 1060, y: 180 },
  { x: 980, y: 740 },
  { x: 110, y: 650 },
];
export async function fixture(
  kind: 'dark' | 'light' | 'sleeve' | 'portrait' | 'exif' | 'webp' | 'blank' = 'dark',
) {
  const w = 1200,
    h = 850,
    cw = 856,
    ch = 540;
  const grid = Array.from(
    { length: 18 },
    (_, i) =>
      `<path d="M${i * 50} 0V540 M0 ${i * 50}H856" stroke="#8fa89b" stroke-width="1" opacity=".6"/>`,
  ).join('');
  const svg = `<svg width="856" height="540" xmlns="http://www.w3.org/2000/svg"><rect width="856" height="540" rx="22" fill="#eee8d8"/>${grid}<rect x="12" y="12" width="832" height="516" rx="15" fill="none" stroke="#704f3b" stroke-width="4"/><text x="230" y="86" font-family="Arial" font-size="24" fill="#302b24">THE THU NGHIEM - KHONG CO GIA TRI</text><text x="240" y="140" font-family="Arial" font-size="23" fill="#333">MAU HU CAU / FICTIONAL SAMPLE</text><rect x="40" y="165" width="165" height="245" rx="5" fill="#b3c4be"/><circle cx="123" cy="236" r="42" fill="#6a8379"/><path d="M58 385Q60 278 123 284Q187 278 189 385" fill="#6a8379"/><text x="239" y="220" font-family="Arial" font-size="25">HO TEN: NHAN VAT GIA LAP</text><text x="239" y="274" font-family="Arial" font-size="23">SO MAU: TEST-0000-1234</text><text x="239" y="328" font-family="Arial" font-size="23">GRID 50 PX / A-B-C-D</text><text x="239" y="390" font-family="Arial" font-size="22">CHI DUNG KIEM THU PHAN MEM</text><text x="45" y="485" font-family="Arial" font-size="20">NO REAL PERSONAL DATA</text><rect x="725" y="420" width="70" height="70" fill="#eee" stroke="#333" stroke-width="5"/><path d="M730 425L790 485M790 425L730 485" stroke="#333" stroke-width="5"/><circle cx="30" cy="30" r="8" fill="#b33"/><circle cx="826" cy="30" r="8" fill="#39a"/><circle cx="826" cy="510" r="8" fill="#393"/><circle cx="30" cy="510" r="8" fill="#b63"/></svg>`;
  const card = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  const bg = kind === 'light' ? 225 : kind === 'sleeve' ? 70 : 45;
  const pixels = Buffer.alloc(w * h * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = bg;
    pixels[i + 1] = bg + 3;
    pixels[i + 2] = bg + 2;
    pixels[i + 3] = 255;
  }
  const dest: Quad = [
      { x: 0, y: 0 },
      { x: cw - 1, y: 0 },
      { x: cw - 1, y: ch - 1 },
      { x: 0, y: ch - 1 },
    ],
    m = homography(photoCorners, dest);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (kind === 'sleeve' && x > 65 && x < 1110 && y > 70 && y < 785) {
        pixels[i] = 120;
        pixels[i + 1] = 125;
        pixels[i + 2] = 123;
      }
      if (kind === 'blank') continue;
      const p = project(m, { x, y }),
        sx = Math.round(p.x),
        sy = Math.round(p.y);
      if (sx >= 0 && sx < cw && sy >= 0 && sy < ch) {
        const j = (sy * cw + sx) * 4;
        const shade = 0.73 + (0.23 * x) / w;
        for (let c = 0; c < 3; c++) pixels[i + c] = Math.round(card[j + c] * shade);
      } else if (kind === 'sleeve') {
        const shadow = project(m, { x: x - 22, y: y - 27 });
        if (shadow.x >= 0 && shadow.x < cw && shadow.y >= 0 && shadow.y < ch) {
          pixels[i] = 35;
          pixels[i + 1] = 37;
          pixels[i + 2] = 36;
        }
      }
    }
  let image = sharp(pixels, { raw: { width: w, height: h, channels: 4 } });
  if (kind === 'portrait')
    return {
      name: 'the-doc.png',
      mimeType: 'image/png',
      buffer: await image.rotate(90).png().toBuffer(),
    };
  if (kind === 'exif')
    return {
      name: 'the-exif-6.jpg',
      mimeType: 'image/jpeg',
      buffer: await image
        .rotate(-90)
        .withMetadata({ orientation: 6 })
        .jpeg({ quality: 95 })
        .toBuffer(),
    };
  if (kind === 'webp')
    return {
      name: 'the-webp.webp',
      mimeType: 'image/webp',
      buffer: await image.webp({ quality: 96 }).toBuffer(),
    };
  return {
    name: `the-gia-lap-${kind}.png`,
    mimeType: 'image/png',
    buffer: await image.png().toBuffer(),
  };
}
