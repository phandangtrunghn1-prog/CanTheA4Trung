import { it, expect } from 'vitest';
import { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { createCardPdf, createImagesPdf } from '../src/lib/pdf';
import { mmToPt, placement } from '../src/lib/layout';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
  'base64',
);
it('uses exactly one A4 page and exact mm placements without personal metadata', async () => {
  const bytes = await createCardPdf(new Blob([png]), new Blob([png]));
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  expect(doc.getPageCount()).toBe(1);
  expect(doc.getPage(0).getWidth()).toBeCloseTo(mmToPt(210), 8);
  expect(doc.getPage(0).getHeight()).toBeCloseTo(mmToPt(297), 8);
  expect(doc.context.trailerInfo.Info).toBeUndefined();
  expect(doc.getAuthor()).toBeUndefined();
  expect(doc.getTitle()).toBeUndefined();
  expect(doc.getSubject()).toBeUndefined();
  const streams = doc.getPage(0).node.Contents();
  expect(streams).toBeDefined();
  const stream = doc.context.lookup(
    (streams as { get: (i: number) => unknown }).get(0) as never,
  ) as PDFRawStream;
  const content = new TextDecoder().decode(decodePDFRawStream(stream).decode());
  for (const i of [0, 1] as const) {
    const p = placement(i);
    expect(content).toContain(`${p.x} ${p.y} cm`);
    expect(content).toContain(`${p.width} 0 0 ${p.height} 0 0 cm`);
  }
  expect(doc.getPage(0).node.Resources()?.lookup(PDFName.of('XObject'))).toBeDefined();
});
it('refuses incomplete output', async () => {
  await expect(createCardPdf(new Blob([png]), null)).rejects.toThrow('đủ mặt trước');
});
it('creates one exact A4 page for every standalone image', async () => {
  const bytes = await createImagesPdf([new Blob([png]), new Blob([png])]);
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  expect(doc.getPageCount()).toBe(2);
  for (const page of doc.getPages()) {
    expect(page.getWidth()).toBeCloseTo(mmToPt(210), 8);
    expect(page.getHeight()).toBeCloseTo(mmToPt(297), 8);
  }
  expect(doc.context.trailerInfo.Info).toBeUndefined();
});
