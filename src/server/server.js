const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const MAX_CODE_LENGTH = 80;
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
  '.lua': 'text/plain; charset=utf-8', '.zip': 'application/zip'
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function safeCode(value) {
  const code = String(value || '').trim();
  return code && code.length <= MAX_CODE_LENGTH && /^[A-Za-z0-9_-]+$/.test(code) ? code : null;
}

function publicScript(script) {
  return {
    code: script.code, title: script.title, originalFilename: script.originalFilename,
    fileSize: script.fileSize, fileExtension: script.fileExtension, targetIp: script.targetIp,
    resourceName: script.resourceName, encryptionMode: script.encryptionMode,
    uploader: script.uploader || script.uploaderName, downloads: script.downloads || 0,
    createdAt: script.createdAt
  };
}

function serveStatic(req, res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    sendJson(res, 403, { success: false, message: 'Forbidden' }); return;
  }
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallback = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(fallback, (readErr, content) => {
        if (readErr) { sendJson(res, 404, { success: false, message: 'Page not found' }); return; }
        res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] }); res.end(content);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' }); res.end(); return; }
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsed.pathname;

    if (pathname === '/api/health') { sendJson(res, 200, { success: true, online: true }); return; }

    if (pathname === '/api/script' || pathname.startsWith('/api/script/')) {
      const raw = parsed.searchParams.get('code') || pathname.split('/')[3];
      const code = safeCode(raw);
      if (!code) { sendJson(res, 400, { success: false, message: 'كود السكربت مطلوب أو غير صالح' }); return; }
      const script = db.findByCode(code);
      if (!script) { sendJson(res, 404, { success: false, message: 'لم يتم العثور على سكربت بهذا الكود' }); return; }
      sendJson(res, 200, { success: true, script: publicScript(script) }); return;
    }

    if (pathname.startsWith('/api/download/')) {
      const code = safeCode(pathname.slice('/api/download/'.length));
      if (!code) { sendJson(res, 400, { success: false, message: 'كود التحميل غير صالح' }); return; }
      const script = db.findByCode(code);
      if (!script) { sendJson(res, 404, { success: false, message: 'السكربت غير موجود' }); return; }
      const filePath = db.getFilePath(script.savedFilename);
      if (!filePath || !fs.existsSync(filePath)) { sendJson(res, 404, { success: false, message: 'ملف السكربت غير موجود على الخادم' }); return; }
      db.incrementDownload(code);
      const filename = String(script.originalFilename || `${code}.zip`).replace(/[\r\n"\\]/g, '_');
      const stat = fs.statSync(filePath);
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Length': stat.size, 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      fs.createReadStream(filePath).pipe(res); return;
    }

    if (pathname === '/api/stats') { sendJson(res, 200, { success: true, ...db.getStats() }); return; }

    // The actual bot encryption route must be implemented by the bot's encryption pipeline.
    // This server deliberately does not fabricate a license or a protected ZIP.
    if (pathname === '/api/encrypt') { sendJson(res, 501, { success: false, message: 'التشفير غير مفعّل في خادم البوت الحالي. اربط هذا المسار بمحرك processAndProtectFiles و db.saveScript.' }); return; }

    if (pathname.startsWith('/api/')) { sendJson(res, 404, { success: false, message: 'API Route Not Found' }); return; }
    serveStatic(req, res, pathname);
  });
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, () => console.log(`RAVX web server listening on ${port}`));
}
