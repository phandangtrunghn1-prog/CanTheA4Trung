import { test, expect, type Page } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PDFDocument, PDFName, PDFDict, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { fixture, photoCorners } from './fixtures';
import { mmToPt, placement } from '../../src/lib/layout';
async function corners(page: Page, points = photoCorners, w = 1200, h = 850) {
  await page.getByRole('button', { name: 'Vừa màn hình', exact: true }).click();
  await page.getByTestId('corner-viewport').scrollIntoViewIfNeeded();
  for (let i = 0; i < 4; i++) {
    const box = (await page.getByTestId('corner-viewport').boundingBox())!;
    const scale = Math.min((box.width - 40) / w, (box.height - 40) / h),
      ox = (box.width - w * scale) / 2,
      oy = (box.height - h * scale) / 2;
    const grip = page.locator(`[data-corner="${i}"]`),
      pos = (await grip.boundingBox())!;
    await page.mouse.move(pos.x + pos.width / 2, pos.y + pos.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + ox + points[i].x * scale, box.y + oy + points[i].y * scale, {
      steps: 8,
    });
    await expect(page.locator('.loupe')).toBeVisible();
    await page.mouse.up();
    expect(Number(await grip.getAttribute('data-x'))).toBeCloseTo(points[i].x / w, 3);
    expect(Number(await grip.getAttribute('data-y'))).toBeCloseTo(points[i].y / h, 3);
  }
}
test('full production flow: upload, rotate, detect, corners, zoom/pan, tone, A4 and actual PDF', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    Object.assign(window, { qaWorkers: { created: 0, closed: 0 } });
    window.Worker = class extends NativeWorker {
      private ended = false;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        (window as unknown as { qaWorkers: { created: number } }).qaWorkers.created++;
      }
      terminate() {
        if (!this.ended) {
          this.ended = true;
          (window as unknown as { qaWorkers: { closed: number } }).qaWorkers.closed++;
        }
        super.terminate();
      }
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') console.log(message.text());
  });
  const external: string[] = [];
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:4174'))
      external.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Xuất PDF A4' })).toBeDisabled();
  const f = await fixture();
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/source-front.png', f.buffer);
  await page.getByTestId('file-0').setInputFiles(f);
  await expect(page.getByText('1200 × 850 px', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xoay mặt trước 90 độ' }).click();
  await expect(page.getByText('850 × 1200 px', { exact: true })).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'Xoay mặt trước 90 độ' }).click();
    await expect(page.getByRole('button', { name: 'Xoay mặt trước 90 độ' })).toBeEnabled();
  }
  await expect(page.getByRole('button', { name: 'Tìm mép thẻ', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Tìm mép thẻ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toBeEnabled();
  await expect(
    page.locator('[role=status]').filter({ hasText: /Đã đề xuất|Cần chỉnh góc/ }),
  ).toBeVisible();
  await corners(page);
  const before = await page.locator('[data-corner="0"]').getAttribute('data-x');
  await page.getByRole('button', { name: 'Phóng to', exact: true }).click();
  let box = (await page.getByTestId('corner-viewport').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 + 17, { steps: 5 });
  await page.mouse.up();
  await expect(page.locator('[data-corner="0"]')).toHaveAttribute('data-x', before!);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect(page.locator('.zoom-value')).not.toHaveText('125%');
  await expect(page.locator('[data-corner="0"]')).toHaveAttribute('data-x', before!);
  await page.getByRole('button', { name: 'Vừa màn hình', exact: true }).click();
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.getByTestId('processed-image')).toBeVisible();
  await expect(page.locator('.result-panel')).toContainText('OpenCV');
  await page.getByLabel('Tôi đã kiểm tra ảnh đầy đủ, không mất mép hoặc nội dung.').check();
  await page.getByRole('button', { name: 'Giữ màu gốc', exact: true }).click();
  await expect(page.getByTestId('processed-image')).toBeVisible();
  const original = await page.getByTestId('processed-image').getAttribute('src');
  await page.getByRole('button', { name: 'Tùy chỉnh', exact: true }).click();
  await page.getByRole('slider', { name: 'Nâng vùng tối', exact: true }).fill('25');
  await page.getByRole('slider', { name: 'Độ nét', exact: true }).fill('12');
  // The previous result remains visible while the worker recalculates the new tone.
  await expect(page.getByTestId('processed-image')).toBeVisible();
  await expect(page.locator('.result-panel.processing')).toBeVisible();
  await expect(page.locator('.paper-card')).toHaveCount(1);
  expect(await page.getByTestId('processed-image').getAttribute('src')).toBe(original);
  await expect(page.getByTestId('processed-image')).toBeVisible();
  await expect
    .poll(() => page.getByTestId('processed-image').getAttribute('src'))
    .not.toBe(original);
  await page.getByRole('button', { name: /Sáng để in/ }).click();
  await expect(page.getByTestId('processed-image')).toBeVisible();
  await page.getByTestId('file-1').setInputFiles(await fixture('light'));
  await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toBeEnabled();
  await corners(page);
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.getByTestId('processed-image')).toBeVisible();
  // The completeness checkbox is guidance only; two completed sides are enough to export.
  await expect(page.getByRole('button', { name: 'Xuất PDF A4' })).toBeEnabled();
  const sheet = (await page.getByTestId('a4-page').boundingBox())!;
  for (const i of [0, 1]) {
    const p = (await page.getByTestId(`a4-card-${i}`).boundingBox())!;
    expect(((p.x - sheet.x) / sheet.width) * 210).toBeCloseTo(62.2, 1);
    expect(((p.y - sheet.y) / sheet.height) * 297).toBeCloseTo(i === 0 ? 55 : 123, 1);
    expect((p.width / sheet.width) * 210).toBeCloseTo(85.6, 1);
    expect((p.height / sheet.height) * 297).toBeCloseTo(53.98, 1);
  }
  const blobs = await page
    .locator('.paper-card')
    .evaluateAll(async (imgs) =>
      Promise.all(
        imgs.map(async (img) =>
          Array.from(
            new Uint8Array(await (await fetch((img as HTMLImageElement).src)).arrayBuffer()),
          ),
        ),
      ),
    );
  await mkdir('artifacts', { recursive: true });
  await writeFile('artifacts/processed-front.png', Buffer.from(blobs[0]));
  await writeFile('artifacts/processed-back.png', Buffer.from(blobs[1]));
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xuất PDF A4' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('The_can_cuoc_A4.pdf');
  await download.saveAs('artifacts/The_can_cuoc_A4.pdf');
  const pdf = await PDFDocument.load(await readFile('artifacts/The_can_cuoc_A4.pdf'), {
    updateMetadata: false,
  });
  expect(pdf.getPageCount()).toBe(1);
  const p = pdf.getPage(0);
  expect(p.getWidth()).toBeCloseTo(mmToPt(210), 8);
  expect(p.getHeight()).toBeCloseTo(mmToPt(297), 8);
  expect(pdf.context.trailerInfo.Info).toBeUndefined();
  const objects = p.node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
  expect(objects.keys()).toHaveLength(2);
  for (const key of objects.keys()) {
    const image = objects.lookup(key) as PDFRawStream;
    expect(Number(image.dict.get(PDFName.of('Width'))?.toString())).toBeGreaterThan(800);
  }
  const streams = p.node.Contents()!;
  const stream = pdf.context.lookup(
    (streams as { get: (i: number) => unknown }).get(0) as never,
  ) as PDFRawStream;
  const content = new TextDecoder().decode(decodePDFRawStream(stream).decode());
  for (const i of [0, 1] as const)
    expect(content).toContain(`${placement(i).x} ${placement(i).y} cm`);
  await page.screenshot({ path: 'artifacts/desktop-complete.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  const workers = await page.evaluate(
    () => (window as unknown as { qaWorkers: { created: number; closed: number } }).qaWorkers,
  );
  expect(workers.created).toBeGreaterThan(2);
  expect(workers.closed).toBe(workers.created);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Xuất PDF A4' })).toBeDisabled();
  await expect(page.locator('.paper-card')).toHaveCount(0);
});
test('EXIF orientation, portrait, WebP, replacement during processing, delete, invalid quadrilateral', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('file-0').setInputFiles(await fixture('exif'));
  await expect(page.getByText('1200 × 850 px', { exact: true })).toBeVisible();
  await page.getByTestId('file-0').setInputFiles(await fixture('portrait'));
  await expect(page.getByText('850 × 1200 px', { exact: true })).toBeVisible();
  await page.getByTestId('file-0').setInputFiles(await fixture('webp'));
  await expect(page.getByText('1200 × 850 px', { exact: true })).toBeVisible();
  await corners(page);
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await page.getByTestId('file-0').setInputFiles(await fixture('light'));
  await expect(page.locator('.file-info')).toContainText('light');
  await expect(page.locator('.paper-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Đặt lại góc', exact: true }).click();
  const a = (await page.locator('[data-corner="0"]').boundingBox())!,
    b = (await page.locator('[data-corner="2"]').boundingBox())!;
  await page.mouse.move(a.x + 22, a.y + 22);
  await page.mouse.down();
  await page.mouse.move(b.x + 22, b.y + 22, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toBeDisabled();
  await expect(page.getByText(/Bốn góc không hợp lệ:/)).toBeVisible();
  await page.getByRole('button', { name: 'Xóa mặt trước', exact: true }).click();
  await expect(page.getByTestId('corner-viewport')).toHaveCount(0);
  await page.getByTestId('file-0').setInputFiles({
    name: 'bad.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not an image'),
  });
  await expect(page.getByRole('alert')).toContainText('Chỉ hỗ trợ');
});
test('OpenCV failure keeps manual editor and complete perspective output usable', async ({
  page,
}) => {
  await page.route('**/vendor/opencv.js', (r) => r.abort());
  await page.goto('/');
  await page.getByTestId('file-0').setInputFiles(await fixture());
  await expect(page.getByText(/OpenCV tải lỗi/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tìm mép thẻ', exact: true })).toBeDisabled();
  await corners(page);
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.getByTestId('processed-image')).toBeVisible();
  await expect(page.locator('.result-panel')).toContainText('Dự phòng');
  await page.screenshot({ path: 'artifacts/opencv-fallback.png', fullPage: true });
});
test('light/dark backgrounds, plastic sleeve and shadow, blank detection is conservative', async ({
  page,
}) => {
  await page.goto('/');
  for (const kind of ['dark', 'light', 'sleeve', 'blank'] as const) {
    await page.getByTestId('file-0').setInputFiles(await fixture(kind));
    await expect(page.getByRole('button', { name: 'Tìm mép thẻ', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: 'Tìm mép thẻ', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Áp dụng', exact: true })).toBeEnabled();
    if (kind === 'blank')
      await expect(page.getByText('Cần chỉnh góc bằng tay', { exact: true })).toBeVisible();
    else
      await expect(
        page.locator('[role=status]').filter({ hasText: /Đã đề xuất|Cần chỉnh góc/ }),
      ).toBeVisible();
    if (kind === 'dark') {
      await expect(page.getByText(/Đã đề xuất bốn góc/)).toBeVisible();
      for (let i = 0; i < 4; i++) {
        const grip = page.locator(`[data-corner="${i}"]`);
        expect(
          Math.abs(Number(await grip.getAttribute('data-x')) - photoCorners[i].x / 1200),
        ).toBeLessThan(0.03);
        expect(
          Math.abs(Number(await grip.getAttribute('data-y')) - photoCorners[i].y / 850),
        ).toBeLessThan(0.03);
      }
    }
    await expect(page.locator('.paper-card')).toHaveCount(0);
  }
});
test('mobile touch, pinch, resize and DPR 3 preserve source coordinates with no horizontal overflow', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4174');
  await page.getByTestId('file-0').setInputFiles(await fixture());
  await page.getByTestId('corner-viewport').scrollIntoViewIfNeeded();
  let box = (await page.getByTestId('corner-viewport').boundingBox())!;
  const grip = (await page.locator('[data-corner="0"]').boundingBox())!;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: grip.x + 22, y: grip.y + 22 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: grip.x + 36, y: grip.y + 35 }],
  });
  await expect(page.locator('.loupe')).toBeVisible();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const before = await page.locator('[data-corner="0"]').getAttribute('data-x');
  expect(Number(before)).not.toBe(0.12);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: box.x + 110, y: box.y + 160 },
      { x: box.x + 210, y: box.y + 160 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: box.x + 90, y: box.y + 165 },
      { x: box.x + 230, y: box.y + 165 },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('[data-corner="0"]')).toHaveAttribute('data-x', before!);
  await expect(page.locator('.zoom-value')).not.toHaveText('100%');
  await page.setViewportSize({ width: 430, height: 932 });
  await expect(page.locator('[data-corner="0"]')).toHaveAttribute('data-x', before!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.getByTestId('processed-image')).toBeVisible();
  await page.screenshot({ path: 'artifacts/mobile-dpr3.png', fullPage: true });
  await context.close();
});
test('LAN server serves MIME types, SPA fallback and rejects traversal', async ({ request }) => {
  const home = await request.get('/');
  expect(home.status()).toBe(200);
  expect(home.headers()['content-security-policy']).toContain("connect-src 'self'");
  expect(
    (await request.get('/', { headers: { 'If-None-Match': home.headers().etag } })).status(),
  ).toBe(304);
  const html = await home.text();
  const js = html.match(/src="([^"]+\.js)"/)![1];
  const asset = await request.get(js);
  expect(asset.headers()['content-type']).toContain('javascript');
  expect((await request.get('/a-local-route')).status()).toBe(200);
  expect((await request.get('/missing.wasm')).status()).toBe(404);
  for (const path of [
    '/%2e%2e%5cpackage.json',
    '/%252e%252e%5cpackage.json',
    '/..%5c..%5cWindows/win.ini',
    '/C:%5cWindows%5cwin.ini',
  ])
    expect((await request.get(path)).status()).toBe(403);
  const script = await request.get('/vendor/opencv.js');
  expect(script.headers()['content-type']).toContain('javascript');
  expect((await request.post('/')).status()).toBe(405);
});
test('file chooser, native camera input, drop, reset and slow OpenCV do not block manual work', async ({
  page,
}) => {
  await page.route('**/vendor/opencv.js', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    await route.abort().catch(() => {});
  });
  await page.goto('/');
  const selected = await fixture('webp');
  const chooserPromise = page.waitForEvent('filechooser');
  await page
    .getByRole('region', { name: 'Mặt trước', exact: true })
    .getByRole('button', { name: 'Chọn ảnh', exact: true })
    .click();
  const chooser = await chooserPromise;
  await chooser.setFiles(selected);
  await expect(page.getByText('Bạn có thể kéo góc ngay trong khi OpenCV đang tải.')).toBeVisible();
  await page.getByRole('button', { name: 'Dùng chế độ thủ công ngay', exact: true }).click();
  await corners(page);
  await page.getByRole('button', { name: 'Áp dụng', exact: true }).click();
  await expect(page.locator('.result-panel')).toContainText('Dự phòng');
  const cameraPromise = page.waitForEvent('filechooser');
  await page
    .getByRole('region', { name: 'Mặt sau', exact: true })
    .getByRole('button', { name: 'Chụp ảnh', exact: true })
    .click();
  const camera = await cameraPromise;
  await expect(page.getByLabel('Chụp mặt sau', { exact: true })).toHaveAttribute(
    'capture',
    'environment',
  );
  await camera.setFiles(await fixture('exif'));
  await expect(page.getByRole('region', { name: 'Mặt sau', exact: true })).toContainText(
    '1200 × 850 px',
  );
  const data = await fixture('light');
  const transfer = await page.evaluateHandle(
    ({ bytes, name, type }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(bytes)], name, { type }));
      return dt;
    },
    { bytes: Array.from(data.buffer), name: data.name, type: data.mimeType },
  );
  await page
    .getByRole('region', { name: 'Mặt trước', exact: true })
    .dispatchEvent('drop', { dataTransfer: transfer });
  await transfer.dispose();
  await expect(page.getByRole('region', { name: 'Mặt trước', exact: true })).toContainText(
    'the-gia-lap-light.png',
  );
  await page.getByRole('button', { name: 'Bắt đầu lại', exact: true }).click();
  await expect(page.locator('.uploaded-preview')).toHaveCount(0);
  await expect(page.locator('.paper-card')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xuất PDF A4' })).toBeDisabled();
});

test('standalone images mode keeps per-image tone preview and exports one A4 page each', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Mỗi ảnh một tờ A4' }).click();
  const first = await fixture('dark');
  const second = await fixture('light');
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Chọn tệp ảnh', exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles([first, second]);
  await expect(page.getByTestId('batch-processed-image')).toHaveCount(2);
  await expect(page.getByTestId('batch-a4-page')).toHaveCount(2);
  await page.getByRole('button', { name: 'Tùy chỉnh' }).first().click();
  const slider = page.locator('input[type="range"]').first();
  await slider.fill('20');
  await expect(page.getByTestId('batch-processed-image').first()).toBeVisible();
  await expect(page.getByTestId('batch-a4-page')).toHaveCount(2);
  expect(await page.getByTestId('batch-processed-image').first().getAttribute('src')).toBeTruthy();
  await expect(page.getByRole('button', { name: 'Xuất PDF nhiều trang' })).toBeEnabled();
  await page.getByRole('button', { name: 'Xuất PDF nhiều trang' }).click();
  await expect(page.getByText('Đã tạo PDF · Anh_A4.pdf')).toBeVisible();
});
