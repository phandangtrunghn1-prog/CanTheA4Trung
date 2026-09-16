export const LAYOUT = {
  pageWidth: 210,
  pageHeight: 297,
  cardWidth: 85.6,
  cardHeight: 53.98,
  left: 62.2,
  tops: [55, 123],
} as const;
export const mmToPt = (mm: number) => (mm * 72) / 25.4;
export const IMAGE_MARGIN_MM = 8;
// Shared millimetre geometry for standalone-image preview and PDF.
export function imagePlacement(width: number, height: number) {
  if (width <= 0 || height <= 0 || !Number.isFinite(width + height))
    throw new Error('Kích thước ảnh không hợp lệ.');
  const scale = Math.min(
    (LAYOUT.pageWidth - IMAGE_MARGIN_MM * 2) / width,
    (LAYOUT.pageHeight - IMAGE_MARGIN_MM * 2) / height,
  );
  return {
    left: (LAYOUT.pageWidth - width * scale) / 2,
    top: (LAYOUT.pageHeight - height * scale) / 2,
    width: width * scale,
    height: height * scale,
  };
}
export const placement = (index: 0 | 1) => ({
  x: mmToPt(LAYOUT.left),
  y: mmToPt(LAYOUT.pageHeight - LAYOUT.tops[index] - LAYOUT.cardHeight),
  width: mmToPt(LAYOUT.cardWidth),
  height: mmToPt(LAYOUT.cardHeight),
});
