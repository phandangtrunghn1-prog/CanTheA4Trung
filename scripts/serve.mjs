import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 4173);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
};
let canonicalRoot;
try {
  canonicalRoot = await realpath(root);
  await stat(path.join(root, 'index.html'));
} catch {
  console.error('Chưa có bản production. Hãy chạy npm run build trước.');
  process.exit(1);
}
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT không hợp lệ');
const inside = (p) => p === canonicalRoot || p.startsWith(canonicalRoot + path.sep);
const server = http.createServer(async (req, res) => {
  const fail = (code, message) => {
    res.writeHead(code, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(message);
  };
  if (!['GET', 'HEAD'].includes(req.method)) return fail(405, 'Chỉ hỗ trợ GET và HEAD');
  let decoded;
  try {
    decoded = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    return fail(400, 'Đường dẫn không hợp lệ');
  }
  // Check the raw decoded path BEFORE URL normalization; reject Windows ADS and backslashes too.
  if (
    decoded.includes('\0') ||
    decoded.includes('\\') ||
    decoded.includes(':') ||
    decoded.split('/').some((s) => s === '..')
  )
    return fail(403, 'Đường dẫn bị từ chối');
  let target = path.resolve(root, '.' + decoded);
  if (!inside(target)) return fail(403, 'Đường dẫn bị từ chối');
  try {
    let info;
    try {
      info = await stat(target);
    } catch {
      /* SPA fallback only for extensionless routes. */
    }
    if (!info?.isFile()) {
      if (path.extname(decoded)) return fail(404, 'Không tìm thấy tài nguyên');
      target = path.join(root, 'index.html');
    }
    target = await realpath(target);
    if (!inside(target)) return fail(403, 'Đường dẫn bị từ chối');
    const fileInfo = await stat(target),
      size = fileInfo.size;
    const etag = `"${size.toString(16)}-${Math.trunc(fileInfo.mtimeMs).toString(16)}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
      return res.end();
    }
    // This OpenCV build uses Emscripten's generated functions. Allow them only in
    // the isolated processing worker; the document itself cannot evaluate strings.
    const workerScript =
      path.dirname(target) === path.join(canonicalRoot, 'assets') &&
      /^worker-[\w-]+\.js$/.test(path.basename(target));
    res.writeHead(200, {
      'Content-Type': mime[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Content-Length': size,
      'Cache-Control': 'no-cache',
      ETag: etag,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'self'; script-src 'self' ${workerScript ? "'unsafe-eval'" : "'wasm-unsafe-eval'"}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; worker-src 'self' blob:; connect-src 'self' blob: data:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'`,
    });
    if (req.method === 'HEAD') return res.end();
    const stream = createReadStream(target);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch {
    if (!res.headersSent) fail(500, 'Không đọc được tệp');
    else res.destroy();
  }
});
server.on('error', (error) => {
  console.error(`Không khởi động được máy chủ: ${error.message}`);
  process.exit(1);
});
server.listen(port, '0.0.0.0', () => {
  console.log(`Căn thẻ A4 · http://localhost:${port}`);
  for (const list of Object.values(networkInterfaces()))
    for (const item of list || [])
      if (item.family === 'IPv4' && !item.internal)
        console.log(`LAN: http://${item.address}:${port}`);
  console.log('Nhấn Ctrl+C để dừng. Máy chủ chỉ phục vụ dist; không nhận ảnh tải lên.');
});
