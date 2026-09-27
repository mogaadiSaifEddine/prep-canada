// Local / self-hosted server: serves the app from ./public and the API from lib/app.js.
// Usage: DATABASE_URL=... GEMINI_API_KEY=... node server.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from './lib/app.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return handler(req, res);
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(root, path.normalize(p));
  if (!file.startsWith(root)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (e, data) => {
    if (e) {
      fs.readFile(path.join(root, 'index.html'), (e2, idx) => { res.setHeader('content-type', types['.html']); res.end(idx); });
      return;
    }
    res.setHeader('content-type', types[path.extname(file)] || 'application/octet-stream');
    if (p === '/sw.js') res.setHeader('cache-control', 'no-cache');
    res.end(data);
  });
}).listen(process.env.PORT || 3000, () => console.log('Prep Canada on http://localhost:' + (process.env.PORT || 3000)));
