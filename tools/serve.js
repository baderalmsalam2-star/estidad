// خادمٌ ساكنٌ للتطوير المحليّ — بلا اعتماديات. التطبيق نفسه ملفاتٌ ساكنة،
// فيمكن نشره على أي استضافةٍ مجانية بلا خادمٍ البتّة.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 3000;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

createServer(async (req, res) => {
  try {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let path = join(ROOT, normalize(url).replace(/^(\.\.[/\\])+/, ''));
    if ((await stat(path).catch(() => null))?.isDirectory()) path = join(path, 'index.html');

    const body = await readFile(path);
    res.writeHead(200, {
      'content-type': TYPES[extname(path)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('غير موجود');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
