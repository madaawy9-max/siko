
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('../database/db');

const PUBLIC_DIR = path.join(__dirname, '../../public');
const UPLOAD_DIR = path.join(__dirname, '../../storage/uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024 * 1024;

const MIME_TYPES = {
    '.html':'text/html; charset=utf-8',
    '.css':'text/css; charset=utf-8',
    '.js':'application/javascript; charset=utf-8',
    '.json':'application/json; charset=utf-8',
    '.png':'image/png',
    '.jpg':'image/jpeg',
    '.jpeg':'image/jpeg',
    '.svg':'image/svg+xml',
    '.zip':'application/zip',
    '.lua':'text/plain; charset=utf-8'
};

function sendJson(res, code, data){
    res.writeHead(code,{
        'Content-Type':'application/json; charset=utf-8',
        'Access-Control-Allow-Origin':'*',
        'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers':'Content-Type'
    });
    res.end(JSON.stringify(data));
}

function saveUpload(req,res){
    let size = 0;
    const filename = `upload_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.zip`;
    const filePath = path.join(UPLOAD_DIR, filename);
    const stream = fs.createWriteStream(filePath);

    req.on('data', chunk=>{
        size += chunk.length;

        if(size > MAX_UPLOAD_SIZE){
            req.destroy();
            stream.destroy();
            if(fs.existsSync(filePath)) fs.unlinkSync(filePath);
            sendJson(res,413,{success:false,message:'حجم الملف أكبر من 2GB'});
            return;
        }

        stream.write(chunk);
    });

    req.on('end',()=>{
        stream.end();

        const item = db.saveScript({
            title: filename,
            originalFilename: filename,
            savedFilename: filename,
            fileSize: size,
            uploadType:'full',
            encryptionMode:'full',
            uploaderName:'Website Upload'
        });

        sendJson(res,200,{
            success:true,
            code:item.code,
            filename,
            size,
            download:`/api/download/${item.code}`
        });
    });
}

function handleStaticFile(req,res,pathname){
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    if(!filePath.startsWith(PUBLIC_DIR)){
        sendJson(res,403,{error:'Forbidden'});
        return;
    }

    fs.stat(filePath,(err,stats)=>{
        if(err || !stats.isFile()){
            filePath = path.join(PUBLIC_DIR,'index.html');
        }

        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200,{
            'Content-Type':MIME_TYPES[ext] || 'application/octet-stream'
        });
        fs.createReadStream(filePath).pipe(res);
    });
}

function createServer(){

    return http.createServer((req,res)=>{

        if(req.method === 'OPTIONS'){
            res.writeHead(204);
            res.end();
            return;
        }

        const parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = parsed.pathname;

        if(pathname === '/api/upload' && req.method === 'POST'){
            saveUpload(req,res);
            return;
        }

        if(pathname.startsWith('/api/download/')){
            const code = pathname.replace('/api/download/','');
            const script = db.findByCode(code);

            if(!script){
                sendJson(res,404,{success:false,message:'غير موجود'});
                return;
            }

            const filePath = db.getFilePath(script.savedFilename);

            if(!fs.existsSync(filePath)){
                sendJson(res,404,{success:false,message:'الملف غير موجود'});
                return;
            }

            db.incrementDownload(code);

            const stat = fs.statSync(filePath);

            res.writeHead(200,{
                'Content-Type':'application/zip',
                'Content-Length':stat.size,
                'Content-Disposition':`attachment; filename="${script.originalFilename}"`
            });

            fs.createReadStream(filePath).pipe(res);
            return;
        }

        if(pathname.startsWith('/api/script')){
            const code = parsed.searchParams.get('code');

            const script = db.findByCode(code);

            if(!script){
                sendJson(res,404,{success:false});
                return;
            }

            sendJson(res,200,{success:true,script});
            return;
        }

        if(pathname === '/api/stats'){
            sendJson(res,200,{success:true,...db.getStats()});
            return;
        }

        handleStaticFile(req,res,pathname);
    });
}

module.exports = { createServer };
