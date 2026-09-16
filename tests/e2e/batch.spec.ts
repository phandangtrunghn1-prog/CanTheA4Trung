import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PDFDocument, PDFDict, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import sharp from 'sharp';
import { fixture } from './fixtures';
import { applyTone } from '../../src/lib/tone';
import { PRINT_TONE } from '../../src/types';
import { imagePlacement, mmToPt } from '../../src/lib/layout';

test('batch PDF embeds final pixels, matches responsive preview and recovers from export errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('tab', { name: 'Mỗi ảnh một tờ A4' }).click();
  const a = await fixture('portrait'),
    b = await fixture('exif');
  const input = page.getByTestId('batch-files');
  await input.setInputFiles(a);
  const exportButton = page.getByRole('button', { name: 'Xuất PDF nhiều trang' });
  await expect(exportButton).toBeEnabled();
  const firstUrl = await page.getByTestId('batch-processed-image').getAttribute('src');
  await input.setInputFiles(b);
  await expect(exportButton).toBeEnabled();
  await expect(page.getByTestId('batch-processed-image')).toHaveCount(2);
  await expect(page.getByTestId('batch-processed-image').first()).toHaveAttribute('src', firstUrl!);
  const unchangedUrl = await page.getByTestId('batch-processed-image').last().getAttribute('src');
  await page.getByRole('button', { name: 'Tùy chỉnh', exact: true }).first().click();
  const slider = page.getByRole('slider', { name: `Độ sáng ${a.name}`, exact: true });
  await slider.evaluate((el) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    for (const value of ['25', '-20', '14']) {
      set.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await expect(slider).toHaveValue('14');
  await expect(page.getByTestId('batch-processed-image').first()).toBeVisible();
  await expect(page.getByTestId('batch-a4-page')).toHaveCount(2);
  await expect(exportButton).toBeEnabled();
  await expect(slider).toHaveValue('14');
  await expect(page.getByTestId('batch-processed-image').last()).toHaveAttribute(
    'src',
    unchangedUrl!,
  );
  const blobs = await page
    .getByTestId('batch-processed-image')
    .evaluateAll(async (images) =>
      Promise.all(
        images.map(async (image) =>
          Array.from(
            new Uint8Array(await (await fetch((image as HTMLImageElement).src)).arrayBuffer()),
          ),
        ),
      ),
    );
  const original = await sharp(a.buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const expected = applyTone(
    new Uint8ClampedArray(original.data),
    original.info.width,
    original.info.height,
    { ...PRINT_TONE, brightness: 14 },
  );
  const actual = await sharp(Buffer.from(blobs[0])).ensureAlpha().raw().toBuffer();
  expect(actual.equals(Buffer.from(expected))).toBe(true);
  for (const viewport of [
    { width: 1440, height: 1100 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const [i, size] of [
      { width: 850, height: 1200 },
      { width: 1200, height: 850 },
    ].entries()) {
      const sheet = page.getByTestId('batch-a4-page').nth(i);
      const pageBox = (await sheet.boundingBox())!,
        img = (await sheet.locator('img').boundingBox())!;
      const p = imagePlacement(size.width, size.height);
      expect(pageBox.width / pageBox.height).toBeCloseTo(210 / 297, 3);
      expect(((img.x - pageBox.x) / pageBox.width) * 210).toBeCloseTo(p.left, 1);
      expect(((img.y - pageBox.y) / pageBox.height) * 297).toBeCloseTo(p.top, 1);
      expect((img.width / pageBox.width) * 210).toBeCloseTo(p.width, 1);
      expect((img.height / pageBox.height) * 297).toBeCloseTo(p.height, 1);
    }
  }
  await page.screenshot({ path: 'artifacts/batch-mobile.png', fullPage: true });
  // Exercise a real exception path then retry, without leaving export locked.
  await page.evaluate(() => {
    const native = Blob.prototype.arrayBuffer;
    Blob.prototype.arrayBuffer = function () {
      Blob.prototype.arrayBuffer = native;
      return Promise.reject(new Error('Lỗi đọc ảnh giả lập'));
    };
  });
  await exportButton.click();
  await expect(page.getByRole('alert')).toContainText('Lỗi đọc ảnh giả lập');
  await expect(exportButton).toBeEnabled();
  const downloaded = page.waitForEvent('download');
  await exportButton.click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('Anh_A4.pdf');
  await mkdir('artifacts', { recursive: true });
  await download.saveAs('artifacts/Anh_A4.pdf');
  const pdf = await PDFDocument.load(await readFile('artifacts/Anh_A4.pdf'), {
    updateMetadata: false,
  });
  expect(pdf.getPageCount()).toBe(2);
  expect(pdf.context.trailerInfo.Info).toBeUndefined();
  for (const [i, p] of pdf.getPages().entries()) {
    expect(p.getWidth()).toBeCloseTo(mmToPt(210), 8);
    expect(p.getHeight()).toBeCloseTo(mmToPt(297), 8);
    const images = p.node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
    expect(images.keys()).toHaveLength(1);
    const image = images.lookup(images.keys()[0]) as PDFRawStream;
    const raw = decodePDFRawStream(image).decode();
    const expectedRgb = await sharp(Buffer.from(blobs[i])).removeAlpha().raw().toBuffer();
    expect(Buffer.from(raw).equals(expectedRgb)).toBe(true);
    const stream = pdf.context.lookup(
      (p.node.Contents() as { get: (i: number) => unknown }).get(0) as never,
    ) as PDFRawStream;
    const content = new TextDecoder().decode(decodePDFRawStream(stream).decode());
    const dimensions = await sharp(Buffer.from(blobs[i])).metadata();
    const pos = imagePlacement(dimensions.width!, dimensions.height!);
    expect(content).toContain(`${mmToPt(pos.left)} ${mmToPt(297 - pos.top - pos.height)} cm`);
    expect(content).toContain(`${mmToPt(pos.width)} 0 0 ${mmToPt(pos.height)} 0 0 cm`);
    await writeFile(`artifacts/batch-processed-${i}.png`, Buffer.from(blobs[i]));
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({ path: 'artifacts/batch-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Gốc', exact: true }).first().click();
  await expect(page.getByText('Đã tạo PDF · Anh_A4.pdf')).toHaveCount(0);
  await expect(exportButton).toBeEnabled();
  const restored = await page
    .getByTestId('batch-processed-image')
    .first()
    .evaluate(async (img) =>
      Array.from(new Uint8Array(await (await fetch((img as HTMLImageElement).src)).arrayBuffer())),
    );
  expect(
    (await sharp(Buffer.from(restored)).ensureAlpha().raw().toBuffer()).equals(original.data),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('batch cancels reset/delete work, releases resources and reports corrupt files', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const nativeDecode = window.createImageBitmap.bind(window);
    const nativeCreate = URL.createObjectURL.bind(URL),
      nativeRevoke = URL.revokeObjectURL.bind(URL);
    const live = new Set<string>();
    Object.assign(window, { qaBatch: { decoded: 0, live } });
    URL.createObjectURL = (blob) => {
      const url = nativeCreate(blob);
      live.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      live.delete(url);
      nativeRevoke(url);
    };
    window.createImageBitmap = (async (...args: Parameters<typeof createImageBitmap>) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      const result = await (nativeDecode as (...args: unknown[]) => Promise<ImageBitmap>)(...args);
      (window as unknown as { qaBatch: { decoded: number } }).qaBatch.decoded++;
      return result;
    }) as typeof createImageBitmap;
  });
  await page.goto('/');
  await page.getByRole('tab', { name: 'Mỗi ảnh một tờ A4' }).click();
  const file = await fixture('dark'),
    input = page.getByTestId('batch-files');
  await input.setInputFiles(file);
  await expect(page.getByText('Đang đọc ảnh…')).toBeVisible();
  await page.getByRole('button', { name: 'Bắt đầu lại', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { qaBatch: { decoded: number } }).qaBatch.decoded),
    )
    .toBe(1);
  await expect(page.locator('.batch-item')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { qaBatch: { live: Set<string> } }).qaBatch.live.size,
      ),
    )
    .toBe(0);
  await input.setInputFiles([
    file,
    { name: 'hong.png', mimeType: 'image/png', buffer: Buffer.from('broken') },
  ]);
  await expect(page.getByRole('alert')).toContainText('Không đọc được ảnh');
  await expect(page.getByRole('button', { name: 'Xuất PDF nhiều trang' })).toBeDisabled();
  await page.getByRole('button', { name: 'Xóa hong.png', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Xuất PDF nhiều trang' })).toBeEnabled();
  await page.getByRole('button', { name: 'Tùy chỉnh', exact: true }).click();
  await page.getByRole('slider', { name: `Độ sáng ${file.name}`, exact: true }).fill('25');
  await page.getByRole('button', { name: `Xóa ${file.name}`, exact: true }).click();
  await expect(page.getByTestId('batch-a4-page')).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as unknown as { qaBatch: { live: Set<string> } }).qaBatch.live.size,
      ),
    )
    .toBe(0);
  // A removed task must not repopulate results when a subsequent task finishes.
  await input.setInputFiles(file);
  await expect(page.getByRole('button', { name: 'Xuất PDF nhiều trang' })).toBeEnabled();
  await expect(page.getByTestId('batch-processed-image')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Căn thẻ hai mặt' }).click();
  await page.getByRole('tab', { name: 'Mỗi ảnh một tờ A4' }).click();
  await expect(page.getByTestId('batch-processed-image')).toHaveCount(1);
  await page.reload();
  await page.getByRole('tab', { name: 'Mỗi ảnh một tờ A4' }).click();
  await expect(page.locator('.batch-item')).toHaveCount(0);
});

test('batch worker failure can be retried without losing existing preview', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Mỗi ảnh một tờ A4' }).click();
  await page.getByTestId('batch-files').setInputFiles(await fixture('webp'));
  const button = page.getByRole('button', { name: 'Xuất PDF nhiều trang' });
  await expect(button).toBeEnabled();
  await page.route('**/tone.worker-*.js', (route) => route.abort());
  await page.getByRole('button', { name: 'Gốc', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Không chạy được bộ xử lý ảnh');
  await expect(page.getByTestId('batch-processed-image')).toBeVisible();
  await expect(button).toBeDisabled();
  await page.unroute('**/tone.worker-*.js');
  await page.getByRole('button', { name: 'Sáng để in', exact: true }).click();
  await expect(button).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
