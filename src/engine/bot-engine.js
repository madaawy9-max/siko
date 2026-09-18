const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const {ZipArchive} = require('archiver');
let db;
try {
  db = require('../database/db');
} catch (_) {
  db = require(path.join(process.cwd(), 'src/database/db'));
}
const execFileAsync = promisify(execFile);

function obfuscateLua(source, label) {
  const k1 = crypto.randomInt(30, 230), k2 = crypto.randomInt(30, 230), mul = [3,5,7,9,11,13][crypto.randomInt(0,6)];
  const bytes = Buffer.from(source, 'utf8');
  const out = [];
  for (let i = 0; i < bytes.length; i++) out.push(((bytes[i] ^ k1) + (i * mul % 23)) % 256 ^ ((k2 + i % 17) % 256));
  const vars = Array.from({length: 5}, () => '_0x' + crypto.randomBytes(4).toString('hex'));
  return `-- RAVX protected Lua (${label})\nlocal ${vars[0]}={${out.join(',')}}\nlocal ${vars[1]}={}\nfor ${vars[2]}=1,#${vars[0]} do local i=${vars[2]}-1 local b=${vars[0]}[${vars[2]}] local r3=b ~ ((${k2} + i % 17) % 256) local r2=(r3 - (i * ${mul} % 23)) % 256 ${vars[1]}[${vars[2]}]=string.char(r2 ~ ${k1}) end\nlocal ${vars[3]}=getfenv and getfenv() or _ENV\nlocal ${vars[4]},err=(loadstring or load)(table.concat(${vars[1]}),"@${label}","t",${vars[3]})\nif not ${vars[4]} then error("RAVX integrity error: "..tostring(err)) end\n${vars[4]}()\n`;
}

async function walkAndProtect(root, targetIp, resourceName, mode) {
  const entries = fs.readdirSync(root, {withFileTypes: true});
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) await walkAndProtect(full, targetIp, resourceName, mode);
    else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.lua') {
      const base = path.basename(entry.name, '.lua').toLowerCase();
      const selected = mode === 'full' || (mode === 'target' && (base.includes('client') || base.includes('server') || base.includes('script') || base.includes('main')));
      const source = fs.readFileSync(full, 'utf8');
      fs.writeFileSync(full, selected ? obfuscateLua(source, entry.name) : source, 'utf8');
    }
  }
}

function createZipFromDirectory(sourceDir, outputPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = new ZipArchive({zlib: {level: 0}});
    let done = false;
    const fail = error => { if (!done) { done = true; reject(error); } };
    output.on('close', () => { if (!done) { done = true; resolve(); } });
    output.on('error', fail);
    archive.on('error', fail);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize().catch(fail);
  });
}

async function notifyDiscord({channelId, botToken, script, uploader}) {
  if (!channelId || !botToken) return;
  try {
    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json'},
      body: JSON.stringify({content: `✅ تم تشفير المورد بنجاح\n📦 المورد: \`${script.resourceName}\`\n🌐 IP: \`${script.targetIp}\`\n🔐 النمط: \`${script.encryptionMode}\`\n🔑 كود التحميل: \`${script.code}\``})
    });
  } catch (error) { console.error('[WEB] Discord notification failed:', error.message); }
}

async function encryptResource({inputZipPath, targetIp, resourceName, encryptionMode = 'target', uploader = {}, panelChannelId = process.env.PANEL_CHANNEL_ID, botToken = process.env.DISCORD_BOT_TOKEN}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ravx-engine-'));
  const extracted = path.join(work, 'resource');
  const outputName = `RAVX_Secured_${resourceName}_${String(targetIp).replace(/[^a-zA-Z0-9_-]/g, '_')}.zip`;
  const outputPath = db.getFilePath(outputName);
  try {
    fs.mkdirSync(extracted, {recursive: true});
    await execFileAsync('unzip', ['-q', '-o', inputZipPath, '-d', extracted], {maxBuffer: 1024 * 1024});
    let processRoot = extracted;
    const children = fs.readdirSync(extracted, {withFileTypes: true});
    if (children.length === 1 && children[0].isDirectory()) processRoot = path.join(extracted, children[0].name);
    await walkAndProtect(processRoot, targetIp, resourceName, encryptionMode);
    fs.mkdirSync(path.dirname(outputPath), {recursive: true});
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    await createZipFromDirectory(extracted, outputPath);
    const stat = fs.statSync(outputPath);
    const script = db.saveScript({title: resourceName, originalFilename: outputName, savedFilename: outputName, fileSize: stat.size, targetIp, resourceName, encryptionMode, uploaderName: uploader.name || 'Web User', uploaderId: uploader.id || null});
    await notifyDiscord({channelId: panelChannelId, botToken, script, uploader});
    return {script};
  } finally {
    fs.rmSync(work, {recursive: true, force: true});
  }
}

module.exports = {encryptResource};
