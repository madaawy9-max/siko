const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, '../../storage/scripts.json');
const UPLOADS_DIR = path.join(__dirname, '../../storage/uploads');

// التأكد من وجود المجلدات وقاعدة البيانات
function ensureDirectories() {
  const storageDir = path.join(__dirname, '../../storage');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

// توليد كود مميز وسهل القراءة (مثل RAVX-8K3M9)
function generateCode(prefix = 'RAVX', length = 5) {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}-${code}`;
}

// قراءة كل السجلات
function readDatabase() {
  ensureDirectories();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading database:', err);
    return [];
  }
}

// حفظ السجلات
function writeDatabase(data) {
  ensureDirectories();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing database:', err);
    return false;
  }
}

// حفظ سكربت جديد في قاعدة البيانات
function saveScript({
  title,
  originalFilename,
  savedFilename,
  fileSize,
  targetIp = null,
  resourceName = null,
  encryptionMode = 'target',
  uploaderName = 'RAVX User',
  uploaderId = null,
  customCode = null
}) {
  const db = readDatabase();
  let code = customCode;

  if (!code) {
    do {
      code = generateCode('RAVX');
    } while (db.some(item => item.code.toUpperCase() === code.toUpperCase()));
  }

  const ext = path.extname(originalFilename || savedFilename).toLowerCase().replace('.', '');

  const newEntry = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    code: code.toUpperCase(),
    title: title || resourceName || originalFilename,
    originalFilename: originalFilename || savedFilename,
    savedFilename: savedFilename,
    fileSize: fileSize || 0,
    fileExtension: ext || 'zip',
    targetIp: targetIp,
    resourceName: resourceName,
    encryptionMode: encryptionMode,
    uploader: {
      name: uploaderName,
      id: uploaderId
    },
    downloads: 0,
    createdAt: new Date().toISOString()
  };

  db.unshift(newEntry);
  writeDatabase(db);
  return newEntry;
}

// البحث عن سكربت بواسطة الكود
function findByCode(code) {
  if (!code) return null;
  const db = readDatabase();
  const searchCode = code.trim().toUpperCase();
  return db.find(s => s.code === searchCode) || null;
}

// زيادة عداد التحميل
function incrementDownload(code) {
  const db = readDatabase();
  const searchCode = code.trim().toUpperCase();
  const script = db.find(s => s.code === searchCode);
  if (script) {
    script.downloads = (script.downloads || 0) + 1;
    writeDatabase(db);
    return script.downloads;
  }
  return 0;
}

// مسار الملف على القرص
function getFilePath(savedFilename) {
  return path.join(UPLOADS_DIR, savedFilename);
}

// إحصائيات عامة
function getStats() {
  const all = readDatabase();
  const totalDownloads = all.reduce((sum, item) => sum + (item.downloads || 0), 0);
  return {
    totalScripts: all.length,
    totalDownloads: totalDownloads
  };
}

// إضافة بيانات تجريبية في البداية لتجربة الموقع فوراً
function initDemoData() {
  ensureDirectories();
  const db = readDatabase();
  if (db.length === 0) {
    const demoZipName = 'demo_ravx_script.zip';
    const demoPath = path.join(UPLOADS_DIR, demoZipName);
    
    // إنشاء ملف تجريبي صغير
    if (!fs.existsSync(demoPath)) {
      fs.writeFileSync(demoPath, 'RAVX-TEAM Demo Protected Script Payload');
    }

    saveScript({
      title: 'qb-vehicleshop (تجريبي)',
      originalFilename: 'RAVX_Secured_qb-vehicleshop_127_0_0_1.zip',
      savedFilename: demoZipName,
      fileSize: 1048576, // 1 MB
      targetIp: '127.0.0.1',
      resourceName: 'qb-vehicleshop',
      encryptionMode: 'target',
      uploaderName: 'RAVX Admin',
      customCode: 'RAVX-DEMO1'
    });
    console.log('✅ تم إنشاء كود تجريبي لاختبار الموقع: RAVX-DEMO1');
  }
}

initDemoData();

module.exports = {
  saveScript,
  findByCode,
  incrementDownload,
  getFilePath,
  getStats,
  generateCode,
  UPLOADS_DIR
};
