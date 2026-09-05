const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const db = require('../database/db');

const PUBLIC_DIR = path.join(__dirname, '../../public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.lua': 'text/plain; charset=utf-8',
  '.zip': 'application/zip'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

function handleStaticFile(req, res, pathname) {
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security check: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const indexFile = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexFile, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

function createServer() {
  const server = http.createServer((req, res) => {
    // Enable CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      });
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    // API Routes
    if (pathname.startsWith('/api/')) {
      // GET /api/script/:code or /api/script?code=xxx
      if (pathname.startsWith('/api/script')) {
        let code = parsedUrl.searchParams.get('code');
        if (!code) {
          const parts = pathname.split('/').filter(Boolean);
          if (parts.length >= 3) {
            code = parts[2];
          }
        }

        if (!code) {
          sendJson(res, 400, { success: false, message: 'كود السكربت مطلوب' });
          return;
        }

        const script = db.findByCode(code);
        if (!script) {
          sendJson(res, 404, {
            success: false,
            message: 'لم يتم العثور على سكربت بهذا الكود. تأكد من صحة الكود وحاول مجدداً.'
          });
          return;
        }

        sendJson(res, 200, {
          success: true,
          script: {
            code: script.code,
            title: script.title,
            originalFilename: script.originalFilename,
            fileSize: script.fileSize,
            fileExtension: script.fileExtension,
            targetIp: script.targetIp,
            resourceName: script.resourceName,
            encryptionMode: script.encryptionMode,
            uploader: script.uploader,
            downloads: script.downloads,
            createdAt: script.createdAt
          }
        });
        return;
      }

      // GET /api/download/:code
      if (pathname.startsWith('/api/download/')) {
        const code = pathname.replace('/api/download/', '').trim();
        const script = db.findByCode(code);

        if (!script) {
          sendJson(res, 404, { success: false, message: 'السكربت غير موجود أو انتهت صلاحيته' });
          return;
        }

        const filePath = db.getFilePath(script.savedFilename);
        if (!fs.existsSync(filePath)) {
          sendJson(res, 404, { success: false, message: 'ملف السكربت غير موجود على الخادم' });
          return;
        }

        // Increment download count
        db.incrementDownload(code);

        const stat = fs.statSync(filePath);
        const downloadFilename = script.originalFilename || `${script.code}.zip`;
        const encodedFilename = encodeURIComponent(downloadFilename);

        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${downloadFilename}"; filename*=UTF-8''${encodedFilename}`,
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*'
        });

        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
        return;
      }

      // GET /api/stats
      if (pathname === '/api/stats') {
        const stats = db.getStats();
        sendJson(res, 200, {
          success: true,
          ...stats
        });
        return;
      }

      // Fallback for unknown API route
      sendJson(res, 404, { success: false, message: 'API Route Not Found' });
      return;
    }

    // Serve static files
    handleStaticFile(req, res, pathname);
  });

  return server;
}

module.exports = { createServer };
