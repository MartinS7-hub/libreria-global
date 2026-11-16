import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const BACKEND = (process.env.BACKEND_URL || 'https://app-grupo2-libreria-backend.ldb9fn.easypanel.host').replace(/\/$/, '');
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.normalize(path.join(PUBLIC_DIR, pathname));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function proxyApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  // /api/libros/ -> /libros/ (strip /api prefix, keep rest including trailing slash and query)
  const targetPath = url.pathname.replace(/^\/api/, '') || '/';
  const targetUrl = new URL(targetPath + url.search, BACKEND);

  const headers = { ...req.headers, host: targetUrl.host };
  delete headers['content-length'];

  const options = {
    method: req.method,
    hostname: targetUrl.hostname,
    port: targetUrl.port || 443,
    path: targetUrl.pathname + targetUrl.search,
    headers,
  };

  const proxyReq = https.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ detail: `Proxy error: ${e.message}` }));
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if ((req.url || '').startsWith('/api/')) {
    return proxyApi(req, res);
  }
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Frontend dev server: http://localhost:${PORT}`);
  console.log(`Proxy /api -> ${BACKEND}`);
  console.log(`Serving static from: ${PUBLIC_DIR}`);
});
