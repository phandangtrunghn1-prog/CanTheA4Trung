import { mkdir, readFile, writeFile } from 'node:fs/promises';
await mkdir(new URL('../public/vendor/', import.meta.url), { recursive: true });
const source = await readFile(
  new URL('../node_modules/@techstark/opencv-js/dist/opencv.js', import.meta.url),
  'utf8',
);
// UMD's top-level `this` is undefined in a module worker. Only adapt its global binding.
await writeFile(
  new URL('../public/vendor/opencv.js', import.meta.url),
  source.replace('}(this, function () {', '}(globalThis, function () {'),
);
console.log('OpenCV.js (WASM nhúng sẵn) đã được sao chép vào public/vendor. Không dùng CDN.');
