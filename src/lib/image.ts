import type { Source } from '../types';
export async function loadSource(file: File): Promise<Source> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WebP.');
  if (file.size > 40 * 1024 * 1024) throw new Error('Ảnh vượt quá 40 MB. Hãy chọn ảnh nhỏ hơn.');
  // Browser decode applies all EXIF orientations (including mirrored orientations) exactly once.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error('Không đọc được ảnh. Tệp có thể bị hỏng hoặc không đúng định dạng.');
  });
  try {
    if (bitmap.width * bitmap.height > 80_000_000)
      throw new Error('Ảnh quá lớn (trên 80 megapixel). Hãy giảm kích thước ảnh.');
    const factor = Math.min(1, 3200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * factor);
    canvas.height = Math.round(bitmap.height * factor);
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await canvasBlob(canvas);
    return {
      canvas,
      width: canvas.width,
      height: canvas.height,
      name: file.name,
      url: URL.createObjectURL(blob),
      reduced: factor < 1,
    };
  } finally {
    bitmap.close();
  }
}
export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error('Không mã hóa được ảnh PNG. Bộ nhớ có thể không đủ.')),
      'image/png',
    ),
  );
}
export async function rotateSource(source: Source): Promise<Source> {
  const canvas = document.createElement('canvas');
  canvas.width = source.height;
  canvas.height = source.width;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.translate(canvas.width, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(source.canvas, 0, 0);
  return {
    ...source,
    canvas,
    width: canvas.width,
    height: canvas.height,
    url: URL.createObjectURL(await canvasBlob(canvas)),
  };
}
