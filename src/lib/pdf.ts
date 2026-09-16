import { PDFDocument } from 'pdf-lib';
import { LAYOUT, mmToPt, placement, imagePlacement } from './layout';
export async function createCardPdf(front: Blob | null, back: Blob | null): Promise<Uint8Array> {
  if (!front || !back)
    throw new Error('Cần tải và áp dụng đủ mặt trước, mặt sau trước khi xuất PDF.');
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage([mmToPt(LAYOUT.pageWidth), mmToPt(LAYOUT.pageHeight)]);
  for (const [i, blob] of [front, back].entries()) {
    const image = await doc.embedPng(await blob.arrayBuffer());
    page.drawImage(image, placement(i as 0 | 1));
  }
  return doc.save();
}

export async function createImagesPdf(images: Blob[]): Promise<Uint8Array> {
  if (!images.length) throw new Error('Cần tải ít nhất một ảnh trước khi xuất PDF.');
  const doc = await PDFDocument.create({ updateMetadata: false });
  const pageWidth = mmToPt(LAYOUT.pageWidth);
  const pageHeight = mmToPt(LAYOUT.pageHeight);
  for (const blob of images) {
    const page = doc.addPage([pageWidth, pageHeight]);
    const image = await doc.embedPng(await blob.arrayBuffer());
    const p = imagePlacement(image.width, image.height);
    page.drawImage(image, {
      x: mmToPt(p.left),
      y: mmToPt(LAYOUT.pageHeight - p.top - p.height),
      width: mmToPt(p.width),
      height: mmToPt(p.height),
    });
  }
  return doc.save();
}
