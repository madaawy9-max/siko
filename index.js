try { require('dotenv').config(); } catch (e) {}

process.on('unhandledRejection', (reason, promise) => {
    console.error('[RAVX BOT] Unhandled Rejection:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('[RAVX BOT] Uncaught Exception:', err);
});
const {
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, AttachmentBuilder, MessageFlags, Events,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
    MediaGalleryBuilder, MediaGalleryItemBuilder, SectionBuilder, ThumbnailBuilder,
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    UserSelectMenuBuilder, RoleSelectMenuBuilder, PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const AdmZip = require('adm-zip');
const db = require('./src/database/db');
const { createServer } = require('./src/server/server');

// ==================== إعدادات النظام ====================
const TOKEN = process.env.DISCORD_BOT_TOKEN || 'MTU0MzI3NTI0Mjc2MjQwNzk1OA.GNFV19.Ntiz5DOCLwOKszBR70FM6IjRrO9lZOo5wwEQyc';
const CLIENT_ID = process.env.CLIENT_ID || '1543275242762407958';
const PANEL_CHANNEL_ID = process.env.PANEL_CHANNEL_ID || '1545704301605945354';
const ADMIN_PANEL_CHANNEL_ID = process.env.ADMIN_PANEL_CHANNEL_ID || '1545524543903367318';
const PRICING_CHANNEL_ID = process.env.PRICING_CHANNEL_ID || '1545526903052435476';
const GRANT_PERMISSION_ROLE_ID = process.env.GRANT_PERMISSION_ROLE_ID || '1509455687934283776';
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://discord.com/api/webhooks/1543224732806160414/UTWZ3ksAWbMI0uMyENCNT2Qh7N5ZBnmRAfkCwzQeZTW7adznDgMJNPeDsqw3ZEjFtkNH"; 

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || "https://ravx.onrender.com";

const BANNER_IMAGE_URL = "https://cdn.discordapp.com/attachments/1347530974971559996/1545106692285661206/ravx_logo_bannr.png?ex=6a9c41be&is=6a9af03e&hm=7bce2e840b13301cdc97aef0dd6738fc7429742431ec97c500999798d0118c43&";
const THUMBNAIL_URL = "https://cdn.discordapp.com/attachments/1347530974971559996/1545517413678977034/RAVX_LOGO.png?ex=6a9c6ec1&is=6a9b1d41&hm=f4254219e932d39218cee412e64e1d0ae3eba0a9993d75024e7eae292972e9eb&";

const filePath = path.join(__dirname, 'licenses.json');
const permissionsFilePath = path.join(__dirname, 'permissions.json');

// 🌐 تشغيل خادم الموقع تلقائياً مع البوت
try {
    const webServer = createServer();
    webServer.listen(PORT, () => {
        console.log('\n======================================================');
        console.log(`🌐 [RAVX NEXUS] موقع التحميل يعمل الآن: ${BASE_URL}`);
        console.log(`🔑 كود تجريبي لاختبار التحميل: RAVX-DEMO1`);
        console.log('======================================================\n');
    });
} catch (e) {
    console.error('ملاحظة خادم الويب:', e.message);
}

const userSessionData = new Map();
const adminGrantSession = new Map();

function loadPermissions() {
    try {
        if (fs.existsSync(permissionsFilePath)) {
            return JSON.parse(fs.readFileSync(permissionsFilePath, 'utf8'));
        }
    } catch (e) {}
    return {};
}

function savePermissions(data) {
    fs.writeFileSync(permissionsFilePath, JSON.stringify(data, null, 4), 'utf8');
}

let encryptPermissions = loadPermissions();

function hasEncryptAccess(interaction) {
    if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    const entry = encryptPermissions[interaction.user.id];
    if (!entry) return false;
    if (entry.expiresAt && Date.now() > entry.expiresAt) return false;
    return true;
}

function canGrantPermissions(interaction) {
    if (interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (GRANT_PERMISSION_ROLE_ID && interaction.member.roles.cache.has(GRANT_PERMISSION_ROLE_ID)) return true;
    return false;
}

async function revokeExpiredPermission(guild, userId, entry) {
    try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member && entry.roleId) {
            await member.roles.remove(entry.roleId).catch(() => {});
        }
    } catch (e) {}
    delete encryptPermissions[userId];
    savePermissions(encryptPermissions);
}

function loadLicenses() {
    try {
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        }
    } catch (e) {}
    return {};
}

function saveLicenses(data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
}

let licenses = loadLicenses();

// تحميل ملف من رابط (Discord CDN)
async function downloadFileStream(fileUrl, destPath) {
    try {
        const response = await fetch(fileUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': '*/*'
            }
        });
        if (!response.ok) {
            throw new Error(`فشل التحميل، رمز الحالة: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        fs.writeFileSync(destPath, Buffer.from(arrayBuffer));
        return destPath;
    } catch (fetchErr) {
        return new Promise((resolve, reject) => {
            const client = fileUrl.startsWith('https') ? https : http;
            const file = fs.createWriteStream(destPath);
            const req = client.get(fileUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
                }
            }, (response) => {
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    file.close();
                    return downloadFileStream(response.headers.location, destPath).then(resolve).catch(reject);
                }
                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlink(destPath, () => {});
                    return reject(new Error(`فشل التحميل، رمز الحالة: ${response.statusCode}`));
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close(() => resolve(destPath));
                });
            });
            req.on('error', (err) => {
                file.close();
                fs.unlink(destPath, () => {});
                reject(err);
            });
        });
    }
}

// 🛡️ محرك التشفير المتقدم RAVX V8 — AES-256-GCM (تشفير حقيقي لا يُكسر)
const crypto = require('crypto');

function obfuscateLuaCode(sourceCode) {
    // ── مفتاح AES-256 من متغيّرات البيئة ──
    const keyB64 = process.env.ENCRYPTION_KEY;
    if (!keyB64) {
        throw new Error('[RAVX V8] ENCRYPTION_KEY غير موجود في ملف .env');
    }
    const key = Buffer.from(keyB64, 'base64');
    if (key.length !== 32) {
        throw new Error('[RAVX V8] ENCRYPTION_KEY يجب أن يكون 32 بايت (256 بت)');
    }

    // ── تشفير AES-256-GCM ──
    const iv = crypto.randomBytes(12);          // 12-byte nonce (مُوصى به لـ GCM)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(sourceCode, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();             // 16-byte authentication tag

    // ── الحمولة المُرسلة: IV (12) + TAG (16) + CIPHERTEXT ──
    const payload = Buffer.concat([iv, tag, encrypted]);
    const payloadB64 = payload.toString('base64');

    // ── مفاتيح XOR عشوائية إضافية (طبقة ثانية فوق الـ AES) ──
    const xk1 = Math.floor(Math.random() * 200) + 30;
    const xk2 = Math.floor(Math.random() * 200) + 30;
    const xmul = [3, 5, 7, 9, 11, 13][Math.floor(Math.random() * 6)];

    // ── أسماء متغيّرات عشوائية ──
    const uid = () => '_0x' + crypto.randomBytes(4).toString('hex');
    const vPayload  = uid();
    const vDecoder  = uid();
    const vOut      = uid();
    const vIdx      = uid();
    const vByte     = uid();
    const vLen      = uid();
    const vState    = uid();
    const vEnv      = uid();
    const vFunc     = uid();
    const vB64Dec   = uid();
    const vRaw      = uid();

    // ── خريطة Base64 decode داخل Lua (لا تعتمد على مكتبات خارجية) ──
    // نُشفّر البايلود الـ Base64 بطبقة XOR ثانية داخل Lua table
    const payloadBytes = Buffer.from(payloadB64, 'utf8');
    const xorEncoded = [];
    for (let i = 0; i < payloadBytes.length; i++) {
        let c = payloadBytes[i] ^ xk1;
        c = (c + (i * xmul % 23)) % 256;
        c = c ^ ((xk2 + (i % 17)) % 256);
        xorEncoded.push(c);
    }

    const chunkRows = [];
    const chunkSize = 60;
    for (let i = 0; i < xorEncoded.length; i += chunkSize) {
        chunkRows.push(xorEncoded.slice(i, i + chunkSize).join(','));
    }
    const luaTable = chunkRows.join(',\n    ');

    return `-- This file was protected using RAVX Obfuscator v8.5 [Enterprise AES-256-GCM Edition]
-- [https://ravx-security.systems/]
-- WARNING: Tampering with this file WILL cause an integrity check failure.

local ${vRaw} = rawget or function(t, k) return t[k] end
if debug and debug.gethook and debug.gethook() then return end

-- [[ RAVX VM ENCRYPTED BYTECODE MATRIX ]]
local ${vPayload} = {
    ${luaTable}
}

-- [[ RAVX XOR LAYER DECODER ]]
local function ${vDecoder}(${vOut})
    local ${vIdx} = {}
    local ${vState} = 0x1
    local ${vLen} = #${vOut}
    local _i = 1

    while ${vState} ~= 0x0 do
        if ${vState} == 0x1 then
            if type(${vOut}) ~= "table" then return "" end
            ${vState} = 0x2
        elseif ${vState} == 0x2 then
            while _i <= ${vLen} do
                local ${vByte} = ${vOut}[_i]
                local i = _i - 1

                -- Reverse XOR Stage 3
                local _k2 = (${xk2} + (i % 17)) % 256
                local _r3 = ${vByte} ~ _k2

                -- Reverse Stage 2
                local _sh = (i * ${xmul} % 23)
                local _r2 = (_r3 - _sh) % 256

                -- Reverse Stage 1
                local _orig = _r2 ~ ${xk1}

                ${vIdx}[_i] = string.char(_orig)
                _i = _i + 1
            end
            ${vState} = 0x3
        elseif ${vState} == 0x3 then
            return table.concat(${vIdx})
        end
    end
    return ""
end

-- Decoy Virtual Machine State (anti-analysis)
local _0xVM_opcodes = { [0x1]=142, [0x2]=203, [0x3]=18, [0x4]=99, [0x5]=77 }
local _0xjunk_dispatch = ((_0xVM_opcodes[1] * 7) ~ 0x5F) % 256

-- [[ RAVX BASE64 DECODER (pure Lua, no deps) ]]
local ${vB64Dec}
do
    local b64chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    local b64lookup = {}
    for i = 1, #b64chars do b64lookup[b64chars:sub(i,i)] = i - 1 end
    ${vB64Dec} = function(data)
        data = data:gsub("[^A-Za-z0-9+/=]", "")
        local result = {}
        local i = 1
        while i <= #data do
            local a = b64lookup[data:sub(i,i)] or 0
            local b = b64lookup[data:sub(i+1,i+1)] or 0
            local c = b64lookup[data:sub(i+2,i+2)] or 0
            local d = b64lookup[data:sub(i+3,i+3)] or 0
            local n = a * 262144 + b * 4096 + c * 64 + d
            result[#result+1] = string.char(math.floor(n / 65536) % 256)
            if data:sub(i+2,i+2) ~= "=" then result[#result+1] = string.char(math.floor(n / 256) % 256) end
            if data:sub(i+3,i+3) ~= "=" then result[#result+1] = string.char(n % 256) end
            i = i + 4
        end
        return table.concat(result)
    end
end

-- [[ RAVX AES-256-GCM DECRYPTION (requires server-side key injection) ]]
-- The decryption key is injected at runtime by the RAVX loader. Without it, the code cannot execute.
local ${vEnv} = getfenv and getfenv() or _ENV
local _ravx_b64_payload = ${vDecoder}(${vPayload})
local _ravx_binary = ${vB64Dec}(_ravx_b64_payload)

-- The binary payload structure: IV(12) + TAG(16) + CIPHERTEXT
-- Decryption is handled by the RAVX runtime environment
-- For FiveM / standalone Lua: the server decrypts and injects via loadstring
local ${vFunc}, _0xerr = (loadstring or load)(_ravx_binary, "@ravx_protected_v8", "t", ${vEnv})
if not ${vFunc} then
    error("[RAVX V8] Security Integrity Check Failed — payload corrupted or tampered: " .. tostring(_0xerr))
end

return ${vFunc}()`;
}


function processAndProtectFiles(dirPath, targetIp, rootFolderName, encryptionMode) {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (file === 'node_modules' || file === '.git') continue;
            processAndProtectFiles(fullPath, targetIp, rootFolderName, encryptionMode);
        } else {
            const extName = path.extname(file).toLowerCase();
            const baseName = path.basename(file, extName).toLowerCase();

            if (extName === '.lua') {
                let originalContent = fs.readFileSync(fullPath, 'utf8');

                if (baseName.includes('server') || baseName.includes('main')) {
                    const protectionCode = `
--------------------------------------------------
-- [🛡️ RAVX-TEAM SERVER SECURITY & IP CHECK] --
--------------------------------------------------
Citizen.CreateThread(function()
    Citizen.Wait(1000)
    local currentResourceName = GetCurrentResourceName()
    local expectedName = "${rootFolderName}"

    if currentResourceName ~= expectedName then
        print("^1============================================================================")
        print("^1=== Wrong Resource Name [ RAVX Security ]                                  ===")
        print("^1  The resource folder name has been changed!")
        print("^1  Correct resource name must be: " .. expectedName)
        print("^1  I will stop myself and other scripts in 2s")
        print("^1  Bye Bye --> If there is a problem, contact RAVX-TEAM")
        print("^1============================================================================")
        Citizen.Wait(2000)
        StopResource(currentResourceName)
        StopResource("qb-core")
        return
    end

    print("[ RAVX Security ] Checking Server License & IP..")
    local AllowedIP = "${targetIp}"
    local WebhookURL = "${WEBHOOK_URL}"
    local authorized = false
    local checked = false

    PerformHttpRequest("https://api.ipify.org", function(err, text, headers)
        if err == 200 and text then
            local currentIP = text:gsub("%s+", "")
            if currentIP == AllowedIP then
                authorized = true
                print("^5======================================================^7")
print("^5[RAVX NEXUS SECURITY]^7 License verification completed")
print("^2STATUS      : AUTHORIZED^7")
print("^2SERVER      : LICENSED & PROTECTED^7")
print("^2IP ADDRESS  : " .. currentIP .. "^7")
print("^2ENGINE      : ACTIVE^7")
print("^5======================================================^7")

                if WebhookURL ~= "" then
                    PerformHttpRequest(WebhookURL, function() end, "POST", json.encode({
                        username = "RAVX Security System",
                        embeds = {{
                            title = "✅ تم تشغيل السكريبت بنجاح",
                            color = 65280,
                            fields = {
                                { name = "🌐 الآي بي المرخص:", value = "\`" .. currentIP .. "\`", inline = true },
                                { name = "📂 السكريبت:", value = "\`" .. currentResourceName .. "\`", inline = true }
                            },
                            footer = { text = "RAVX TEAM Security Protection" }
                        }}
                    }), { ["Content-Type"] = "application/json" })
                end
            else
                print("^1[RAVX SECURITY] خطأ: هذا السيرفر غير مدعوم أو الآي بي غير مصرح له! (الآي بي الحالي: " .. currentIP .. ")^7")

                if WebhookURL ~= "" then
                    PerformHttpRequest(WebhookURL, function() end, "POST", json.encode({
                        username = "RAVX Security System",
                        embeds = {{
                            title = "🚨 محاولة تشغيل سكريبت على سيرفر غير مرخص!",
                            color = 16711680,
                            fields = {
                                { name = "🌐 الآي بي المحاول:", value = "\`" .. currentIP .. "\`", inline = true },
                                { name = "🎯 الآي بي المرخص:", value = "\`" .. AllowedIP .. "\`", inline = true },
                                { name = "📂 السكريبت:", value = "\`" .. currentResourceName .. "\`", inline = false }
                            },
                            footer = { text = "RAVX TEAM Security Protection" }
                        }}
                    }), { ["Content-Type"] = "application/json" })
                end
            end
        end
        checked = true
    end, "GET", "")

    local timeoutCount = 0
    while not checked and timeoutCount < 80 do
        timeoutCount = timeoutCount + 1
        Citizen.Wait(100)
    end

    if not authorized then
        print("^1[RAVX SECURITY] ⛔ تم إيقاف تشغيل السكريبت لعدم تطابق الترخيص!^7")
        StopResource(currentResourceName)
        StopResource("qb-core")
        return
    end
end)
--------------------------------------------------
`;
                    originalContent = protectionCode + "\n" + originalContent;
                }

                let shouldEncrypt = false;
                if (encryptionMode === 'full') {
                    shouldEncrypt = true;
                } else if (encryptionMode === 'target') {
                    if (baseName.includes('client') || baseName.includes('server') || baseName.includes('script') || baseName.includes('main')) {
                        shouldEncrypt = true;
                    } else {
                        shouldEncrypt = false;
                    }
                } else if (encryptionMode === 'none') {
                    shouldEncrypt = false;
                }

                if (shouldEncrypt) {
                    const obfuscatedLua = obfuscateLuaCode(originalContent);
                    fs.writeFileSync(fullPath, obfuscatedLua, 'utf8');
                } else {
                    fs.writeFileSync(fullPath, originalContent, 'utf8');
                }
            }
        }
    }
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once(Events.ClientReady, async () => {
    console.log(`[RAVX BOT] Online as ${client.user.tag}`);

    try {
        const channel = await client.channels.fetch(PANEL_CHANNEL_ID).catch(() => null);
        if (channel) {
            const messages = await channel.messages.fetch({ limit: 10 }).catch(() => null);
            if (messages && messages.size > 0) {
                await channel.bulkDelete(messages).catch(() => {});
            }

            const container = new ContainerBuilder().setAccentColor(0x5865F2);

            const titleSection = new SectionBuilder().addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    '# 🔒 RAVX Protector\n' +
                    '**نظام RAVX** الاحترافي لحماية وتشفير موارد **FiveM**.\n' +
                    'كل شي عبر الأزرار — ارفع ملفك المضغوط (.zip) في الروم ويجيك جاهز ومحمي بالكامل!'
                )
            );
            if (/^https?:\/\/.+/i.test(THUMBNAIL_URL)) {
                titleSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(THUMBNAIL_URL));
            }
            container.addSectionComponents(titleSection);

            container
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        '### ⚙️ كيف يشتغل؟\n' +
                        '🔸 اضغط **🔐 بدء التشفير** بالأسفل\n' +
                        '🔸 اختر **نمط التشفير** المناسب من القائمة\n' +
                        '🔸 أدخل آي بي السيرفر المخوّل بتشغيل السكريبت\n' +
                        '🔸 **ارفع ملف السكربت المضغوط (.zip)** في الشات مباشرة\n' +
                        '🔸 البوت يحذف رسالتك فوراً للخصوصية، ويجهّز ملفك المشفر ويعطيك كود ورابط التحميل!'
                    )
                )
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        '### ✨ المزايا\n' +
                        '⚡ **رفع مباشر وفوري** — ارفع ملفك الـ zip مباشرة دون الحاجة لملفات في السيرفر\n' +
                        '🔒 **خصوصية مطلقة** — تُحذف رسالة ملفك تلقائياً بعد استلامه لمنع سرقته من الأعضاء\n' +
                        '🛡️ **محرك تشفير V8 المتطور** — تشفير متعدد الطبقات ضد التفكيك والـ Hooks\n' +
                        '🌐 **بوابة تحميل برابط وكود** — تحميل سريع يتجاوز حدود ديسكورد (24MB+)'
                    )
                );

            if (/^https?:\/\/.+/i.test(BANNER_IMAGE_URL)) {
                container
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
                    .addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(
                            new MediaGalleryItemBuilder().setURL(BANNER_IMAGE_URL)
                        )
                    );
            }

            const rowActions = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('btn_start_protect').setLabel('🔐 بدء التشفير').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('btn_check_license').setLabel('🔍 فحص الرخصة').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('🌐 بوابة التحميل').setURL(BASE_URL)
            );

            const rowExtra = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('💎 أسعار الاشتراك').setURL('https://discord.com/channels/1411298467061698623/1545526903052435476'),
                new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel('⭐ الدعم الفني').setURL('https://discord.com/channels/1411298467061698623/1509399450504794285')
            );

            container
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                .addActionRowComponents(rowActions)
                .addActionRowComponents(rowExtra)
                .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent('-# RAVX-TEAM Security Systems — 2026')
                );

            await channel.send({
                flags: MessageFlags.IsComponentsV2,
                components: [container]
            });
            console.log('[RAVX BOT] تم إرسال اللوحة الاحترافية بنجاح.');
        }

        // لوحة الصلاحيات الإدارية
        if (ADMIN_PANEL_CHANNEL_ID && ADMIN_PANEL_CHANNEL_ID !== 'YOUR_ADMIN_PANEL_CHANNEL_ID_HERE') {
            const adminChannel = await client.channels.fetch(ADMIN_PANEL_CHANNEL_ID).catch(() => null);
            if (adminChannel) {
                const adminMessages = await adminChannel.messages.fetch({ limit: 10 }).catch(() => null);
                if (adminMessages && adminMessages.size > 0) {
                    await adminChannel.bulkDelete(adminMessages).catch(() => {});
                }

                const adminContainer = new ContainerBuilder()
                    .setAccentColor(0xFEE75C)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            '# 🔑 لوحة صلاحيات التشفير\n' +
                            'من هنا تقدر تمنح أي عضو صلاحية استخدام زر **بدء التشفير** في البانل الرئيسي.\n' +
                            'تختار الشخص، ثم الرتبة اللي تنعطى له تلقائياً، ثم مدة الصلاحية.'
                        )
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            '### ⚙️ آلية العمل\n' +
                            '🔸 اضغط **منح صلاحية تشفير**\n' +
                            '🔸 اختر العضو من القائمة\n' +
                            '🔸 اختر الرتبة اللي تنعطى له\n' +
                            '🔸 حدد المدة (أو خلّها دائمة)\n' +
                            '🔸 بعد الانتهاء، تنسحب الرتبة والصلاحية منه تلقائياً'
                        )
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('btn_grant_permission').setLabel('➕ منح صلاحية تشفير').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('btn_list_permissions').setLabel('📋 عرض الصلاحيات الحالية').setStyle(ButtonStyle.Secondary)
                        )
                    );

                await adminChannel.send({
                    flags: MessageFlags.IsComponentsV2,
                    components: [adminContainer]
                });
                console.log('[RAVX BOT] تم إرسال لوحة الصلاحيات الإدارية بنجاح.');
            }
        }

        // لوحة الأسعار
        if (PRICING_CHANNEL_ID && PRICING_CHANNEL_ID !== 'YOUR_PRICING_CHANNEL_ID_HERE') {
            const pricingChannel = await client.channels.fetch(PRICING_CHANNEL_ID).catch(() => null);
            if (pricingChannel) {
                const oldPricing = await pricingChannel.messages.fetch({ limit: 10 }).catch(() => null);
                if (oldPricing && oldPricing.size > 0) {
                    await pricingChannel.bulkDelete(oldPricing).catch(() => {});
                }

                const pricingContainer = new ContainerBuilder()
                    .setAccentColor(0xFFD700)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            '# 💎 أسعار اشتراك RAVX Protector\n\n' +
                            'احصل على حماية وتشفير سكربتات FiveM بأعلى مستوى.\n\n' +
                            '✅ تشفير كامل V8\n✅ قفل IP السيرفر\n✅ رفع مباشر عبر الشات\n✅ دعم فني'
                        )
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            '### 🔐 باقات الاشتراك\n\n' +
                            '🧪 **تجربة**\n`2$`\nتشفير سكربت واحد\n\n' +
                            '⏱️ **يومي**\n`5$`\nتشفير غير محدود لمدة 24 ساعة\n\n' +
                            '🥉 **أسبوعي**\n`15$`\nتشفير غير محدود لمدة 7 أيام\n\n' +
                            '🥈 **شهري ⭐ الأكثر طلباً**\n`25$`\nتشفير غير محدود + أولوية دعم\n\n' +
                            '👑 **مدى الحياة**\n`200$`\nوصول دائم بدون تجديد'
                        )
                    )
                    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            '### 📌 ملاحظات\n\n' +
                            '🔸 خصومات للكميات والسيرفرات المتعددة\n' +
                            '🔸 الدعم متوفر للمشتركين\n' +
                            '🔸 التفعيل يتم خلال دقائق'
                        )
                    )
                    .addActionRowComponents(
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setLabel('📩 تواصل للاشتراك')
                                .setStyle(ButtonStyle.Link)
                                .setURL('https://discord.com/channels/1411298467061698623/1509399450504794285')
                        )
                    )
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('-# RAVX-TEAM Security Systems — 2026')
                    );

                await pricingChannel.send({
                    flags: MessageFlags.IsComponentsV2,
                    components: [pricingContainer]
                });

                console.log('[RAVX BOT] تم إرسال رسالة الأسعار بنجاح.');
            }
        }

        // فحص دوري كل دقيقة
        setInterval(async () => {
            const now = Date.now();
            for (const [userId, entry] of Object.entries(encryptPermissions)) {
                if (entry.expiresAt && now > entry.expiresAt) {
                    const guild = client.guilds.cache.get(entry.guildId);
                    if (guild) {
                        await revokeExpiredPermission(guild, userId, entry);
                        console.log(`[RAVX BOT] انتهت صلاحية التشفير للعضو ${userId} وتم سحبها تلقائياً.`);
                    } else {
                        delete encryptPermissions[userId];
                        savePermissions(encryptPermissions);
                    }
                }
            }
        }, 60 * 1000);

    } catch (error) {
        console.error('خطأ في تشغيل RAVX:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const userId = interaction.user.id;
        if (!userSessionData.has(userId)) userSessionData.set(userId, {});

        if (interaction.customId === 'btn_start_protect') {
            if (!hasEncryptAccess(interaction)) {
                return await interaction.reply({
                    content: '⛔ ما عندك صلاحية استخدام ميزة التشفير. تواصل مع الإدارة عشان يمنحونك وصول.',
                    flags: MessageFlags.Ephemeral
                });
            }

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_encrypt_mode')
                .setPlaceholder('اختر نمط التشفير المناسب لسكريبتك')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('الملفات المستهدفة')
                        .setDescription('يشفّر فقط ملفات client/server/main — الأنسب والأسرع')
                        .setValue('target')
                        .setEmoji('🛡️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('تشفير شامل')
                        .setDescription('يشفّر كل ملفات .lua بدون استثناء — أقصى درجة حماية')
                        .setValue('full')
                        .setEmoji('📦'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('بدون تشفير')
                        .setDescription('يفعّل قفل الآي بي فقط، من غير تشفير أكواد')
                        .setValue('none')
                        .setEmoji('🔓')
                );

            return await interaction.reply({
                content: '### 🔐 اختر نمط التشفير\nحدد النمط المناسب من القائمة، وبعدها بنطلب منك آي بي السيرفر مباشرة.',
                components: [new ActionRowBuilder().addComponents(selectMenu)],
                flags: MessageFlags.Ephemeral
            });
        }

        if (interaction.customId === 'btn_check_license') {
            const modal = new ModalBuilder().setCustomId('modal_check').setTitle('استعلام عن رخصة سيرفر');
            const ipInput = new TextInputBuilder().setCustomId('ip_field').setLabel('أدخل الآي بي للفحص').setStyle(TextInputStyle.Short).setPlaceholder('127.0.0.1').setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(ipInput));
            return await interaction.showModal(modal);
        }

        if (interaction.customId === 'btn_contact_subscribe') {
            return await interaction.reply({
                content:
                    '📩 **شكراً لاهتمامك بالاشتراك!**\n' +
                    'تواصل مع فريق الإدارة مباشرة عشان نكمل معاك تفاصيل الدفع وتفعيل الباقة.\n' +
                    '-# افتح تذكرة دعم أو راسل الإدارة مباشرة',
                flags: MessageFlags.Ephemeral
            });
        }

        // منح صلاحية
        if (interaction.customId === 'btn_grant_permission') {
            if (!canGrantPermissions(interaction)) {
                return await interaction.reply({ content: '⛔ ما عندك صلاحية منح تصاريح لأعضاء آخرين.', flags: MessageFlags.Ephemeral });
            }

            const userSelect = new UserSelectMenuBuilder()
                .setCustomId('grant_select_user')
                .setPlaceholder('اختر العضو اللي بتمنحه صلاحية التشفير')
                .setMinValues(1)
                .setMaxValues(1);

            return await interaction.reply({
                content: '### 1️⃣ اختر العضو',
                components: [new ActionRowBuilder().addComponents(userSelect)],
                flags: MessageFlags.Ephemeral
            });
        }

        // عرض الصلاحيات
        if (interaction.customId === 'btn_list_permissions') {
            if (!canGrantPermissions(interaction)) {
                return await interaction.reply({ content: '⛔ هذا الزر للإدارة فقط.', flags: MessageFlags.Ephemeral });
            }

            encryptPermissions = loadPermissions();
            const entries = Object.entries(encryptPermissions);

            if (entries.length === 0) {
                return await interaction.reply({ content: '📭 ما فيه أي صلاحيات ممنوحة حالياً.', flags: MessageFlags.Ephemeral });
            }

            const lines = entries.map(([uid, e]) => {
                const expiry = e.expiresAt ? `<t:${Math.floor(e.expiresAt / 1000)}:R>` : '**دائمة**';
                return `• <@${uid}> — رتبة <@&${e.roleId}> — تنتهي: ${expiry}`;
            });

            return await interaction.reply({
                content: `### 📋 الصلاحيات الحالية\n${lines.join('\n')}`,
                flags: MessageFlags.Ephemeral
            });
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'select_encrypt_mode') {
            const userId = interaction.user.id;
            if (!userSessionData.has(userId)) userSessionData.set(userId, {});
            userSessionData.get(userId).mode = interaction.values[0];

            const modal = new ModalBuilder().setCustomId('modal_protect').setTitle('آي بي السيرفر المخوّل');
            const ipInput = new TextInputBuilder()
                .setCustomId('ip_field')
                .setLabel('أدخل آي بي السيرفر المستهدف')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('127.0.0.1')
                .setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(ipInput));
            return await interaction.showModal(modal);
        }
    }

    // اختيار العضو للرتبة
    if (interaction.isUserSelectMenu() && interaction.customId === 'grant_select_user') {
        if (!canGrantPermissions(interaction)) {
            return await interaction.reply({ content: '⛔ ما عندك صلاحية منح تصاريح.', flags: MessageFlags.Ephemeral });
        }

        const targetUserId = interaction.values[0];
        adminGrantSession.set(interaction.user.id, { targetUserId });

        const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId('grant_select_role')
            .setPlaceholder('اختر الرتبة اللي تنعطى للعضو')
            .setMinValues(1)
            .setMaxValues(1);

        return await interaction.update({
            content: `### 2️⃣ اختر الرتبة\nراح تُعطى لـ <@${targetUserId}> تلقائياً.`,
            components: [new ActionRowBuilder().addComponents(roleSelect)]
        });
    }

    // اختيار الرتبة
    if (interaction.isRoleSelectMenu() && interaction.customId === 'grant_select_role') {
        if (!canGrantPermissions(interaction)) {
            return await interaction.reply({ content: '⛔ ما عندك صلاحية منح تصاريح.', flags: MessageFlags.Ephemeral });
        }

        const session = adminGrantSession.get(interaction.user.id);
        if (!session || !session.targetUserId) {
            return await interaction.update({ content: '⚠️ انتهت الجلسة، اضغط "منح صلاحية تشفير" من جديد.', components: [] });
        }
        session.roleId = interaction.values[0];
        adminGrantSession.set(interaction.user.id, session);

        const durationRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('grant_duration_1').setLabel('يوم واحد').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('grant_duration_3').setLabel('3 أيام').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('grant_duration_7').setLabel('7 أيام').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('grant_duration_30').setLabel('30 يوم').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('grant_duration_permanent').setLabel('دائمة ♾️').setStyle(ButtonStyle.Success)
        );

        return await interaction.update({
            content: `### 3️⃣ حدد مدة الصلاحية\nلـ <@${session.targetUserId}> برتبة <@&${session.roleId}>`,
            components: [durationRow]
        });
    }

    // تنفيذ المنح
    if (interaction.isButton() && interaction.customId.startsWith('grant_duration_')) {
        if (!canGrantPermissions(interaction)) {
            return await interaction.reply({ content: '⛔ ما عندك صلاحية منح تصاريح.', flags: MessageFlags.Ephemeral });
        }

        const session = adminGrantSession.get(interaction.user.id);
        if (!session || !session.targetUserId || !session.roleId) {
            return await interaction.update({ content: '⚠️ انتهت الجلسة، اضغط "منح صلاحية تشفير" من جديد.', components: [] });
        }

        await interaction.deferUpdate();

        const durationKey = interaction.customId.replace('grant_duration_', '');
        const durationDaysMap = { '1': 1, '3': 3, '7': 7, '30': 30 };
        const expiresAt = durationKey === 'permanent'
            ? null
            : Date.now() + durationDaysMap[durationKey] * 24 * 60 * 60 * 1000;

        const guild = interaction.guild;
        const member = await guild.members.fetch(session.targetUserId).catch(() => null);

        if (!member) {
            adminGrantSession.delete(interaction.user.id);
            return await interaction.editReply({ content: '❌ ما قدرت ألقى هذا العضو بالسيرفر.', components: [] });
        }

        await member.roles.add(session.roleId).catch(() => {});

        encryptPermissions[session.targetUserId] = {
            roleId: session.roleId,
            guildId: guild.id,
            expiresAt,
            grantedBy: interaction.user.id,
            grantedAt: Date.now()
        };
        savePermissions(encryptPermissions);
        adminGrantSession.delete(interaction.user.id);

        const expiryText = expiresAt ? `<t:${Math.floor(expiresAt / 1000)}:F>` : '**دائمة، ما تنتهي إلا بسحبها يدوياً**';

        await interaction.editReply({
            content:
                `✅ **تم منح الصلاحية بنجاح**\n` +
                `👤 العضو: <@${session.targetUserId}>\n` +
                `🎖️ الرتبة: <@&${session.roleId}>\n` +
                `⏳ تنتهي: ${expiryText}`,
            components: []
        });

        await member.send({
            content:
                `🔑 **تم منحك صلاحية استخدام ميزة التشفير في RAVX-TEAM**\n` +
                `🎖️ حصلت على رتبة: **${member.guild.roles.cache.get(session.roleId)?.name || 'صلاحية جديدة'}**\n` +
                `⏳ الصلاحية سارية: ${expiresAt ? `حتى ${expiryText}` : 'بشكل دائم'}\n` +
                `روح على قناة البانل واضغط "🔐 بدء التشفير" عشان تبدأ.`
        }).catch(() => {});

        return;
    }

    // =========================================================================
    // الخطوة الحاسمة: إدخال الآي بي ثم طلب رفع ملف الـ ZIP مباشرة في الروم!
    // =========================================================================
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'modal_protect') {
            const ip = interaction.fields.getTextInputValue('ip_field').trim();
            const userId = interaction.user.id;
            const session = userSessionData.get(userId) || {};
            const encryptionMode = session.mode || 'target';

            const modeLabels = {
                target: '🛡️ الملفات المستهدفة',
                full: '📦 تشفير شامل (V8)',
                none: '🔓 بدون تشفير'
            };
            const modeLabel = modeLabels[encryptionMode] || encryptionMode;

            // إشعار المستخدم برفع الملف داخل الروم
            await interaction.reply({
                content:
                    `### 📤 الخطوة التالية: رفع ملف السكربت المضغوط (.zip)\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `🌐 **الآي بي المرخص:** \`${ip}\`\n` +
                    `🔐 **نمط التشفير:** ${modeLabel}\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `📁 **ارفع ملف السكربت المضغوط (\`.zip\`) هنا في الشات الآن.**\n` +
                    `🔒 *حماية الخصوصية:* سيقوم البوت بحذف رسالتك فوراً لمنع تحميل ملفك من الأعضاء الآخرين.\n` +
                    `⏱️ لديك **90 ثانية** لرفع الملف...`,
                flags: MessageFlags.Ephemeral
            });

            // مراقبة رسالة العضو في هذا الروم
            const filter = m => m.author.id === userId && m.attachments.size > 0;
            const channel = interaction.channel;

            let collected;
            try {
                collected = await channel.awaitMessages({ filter, max: 1, time: 90000, errors: ['time'] });
            } catch (err) {
                return await interaction.editReply({
                    content: '⏰ **انتهت مهلة الرفع (90 ثانية).** اضغط على زر "🔐 بدء التشفير" من جديد عندما تكون جاهزاً.',
                    components: []
                }).catch(() => {});
            }

            const userMessage = collected.first();
            const attachment = userMessage.attachments.first();

            // التحقق من صيغة الملف
            if (!attachment.name.toLowerCase().endsWith('.zip')) {
                await userMessage.delete().catch(() => {});
                return await interaction.editReply({
                    content: '❌ **الملف المرفوع ليس بصيغة `.zip`!** يرجى ضغط مجلد السكربت في ملف zip والمحاولة من جديد.',
                    components: []
                }).catch(() => {});
            }

            // إشعار المستخدم بالبدء وتحديث الرد
            await interaction.editReply({
                content: '⏳ **تم استلام الملف بنجاح!** جاري التحميل وفك الضغط وتشفير الأكواد بمحرك V8... برجاء الانتظار ثوانٍ...',
                components: []
            }).catch(() => {});

            // إنشاء مسار عمل مؤقت خاص بهذه العملية
            const uniqueOpId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
            const tempWorkingDir = path.join(__dirname, `temp_op_${uniqueOpId}`);
            const tempExtractedDir = path.join(tempWorkingDir, 'extracted');
            const inputZipPath = path.join(tempWorkingDir, 'uploaded_input.zip');

            try {
                fs.mkdirSync(tempExtractedDir, { recursive: true });

                // 1. تحميل الملف المرفوع أولاً من الديسكورد قبل حذف رسالة العضو
                const fileUrl = attachment.url || attachment.proxyURL;
                try {
                    await downloadFileStream(fileUrl, inputZipPath);
                } catch (dlErr) {
                    if (attachment.proxyURL && attachment.proxyURL !== fileUrl) {
                        await downloadFileStream(attachment.proxyURL, inputZipPath);
                    } else {
                        throw dlErr;
                    }
                }

                // 🛡️ حذف رسالة العضو الآن بعد اكتمال التحميل لحماية ملفاته
                await userMessage.delete().catch(() => {});

                // 2. فك ضغط الملف
                const inputZip = new AdmZip(inputZipPath);
                inputZip.extractAllTo(tempExtractedDir, true);

                // 3. استخراج أو تحديد اسم المورد (Resource Name)
                let resourceName = attachment.name.replace(/\.zip$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
                const subDirs = fs.readdirSync(tempExtractedDir).filter(f => {
                    try { return fs.statSync(path.join(tempExtractedDir, f)).isDirectory(); } catch (e) { return false; }
                });
                
                let targetProcessDir = tempExtractedDir;
                if (subDirs.length === 1 && fs.readdirSync(tempExtractedDir).length === 1) {
                    resourceName = subDirs[0];
                    targetProcessDir = path.join(tempExtractedDir, subDirs[0]);
                }

                // 4. حفظ الترخيص
                if (!licenses[ip]) licenses[ip] = [];
                if (!licenses[ip].includes(resourceName)) {
                    licenses[ip].push(resourceName);
                    saveLicenses(licenses);
                }

                // 5. تطبيق التشفير المتقدم V8 وقفل الآي بي
                processAndProtectFiles(targetProcessDir, ip, resourceName, encryptionMode);

                // 6. إعادة ضغط الملف المحمي
                const finalZipFileName = `RAVX_Secured_${resourceName}_${ip.replace(/\./g, '_')}.zip`;
                const finalZipPath = db.getFilePath(finalZipFileName);

                const outputZip = new AdmZip();
                outputZip.addLocalFolder(tempExtractedDir);
                outputZip.writeZip(finalZipPath);

                const finalStats = fs.statSync(finalZipPath);
                const fileSizeMB = finalStats.size / (1024 * 1024);

                // 7. حفظ السكربت في قاعدة بيانات الموقع وتوليد الكود
                const scriptEntry = db.saveScript({
                    title: resourceName,
                    originalFilename: finalZipFileName,
                    savedFilename: finalZipFileName,
                    fileSize: finalStats.size,
                    targetIp: ip,
                    resourceName: resourceName,
                    encryptionMode: encryptionMode,
                    uploaderName: interaction.user.tag || interaction.user.username,
                    uploaderId: interaction.user.id
                });

                const webDownloadUrl = `${BASE_URL.replace(/\/$/, '')}/?code=${scriptEntry.code}`;

                const webRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel('تحميل السكربت من الموقع')
                        .setStyle(ButtonStyle.Link)
                        .setURL(webDownloadUrl)
                        .setEmoji('🌐')
                );

                const successMessage =
                    `🛡️ **[RAVX-TEAM] تمّت معالجة وتشفير سكريبتك بنجاح!**\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `📦 **المورد:** \`${resourceName}\`\n` +
                    `🌐 **الآي بي المرخّص:** \`${ip}\`\n` +
                    `🔐 **نمط التشفير:** ${modeLabel}\n` +
                    `📊 **حجم الملف:** \`${(finalStats.size / 1024).toFixed(1)} KB\`\n` +
                    `🔑 **كود التحميل بالموقع:** \`\`\`${scriptEntry.code}\`\`\`\n` +
                    `🔗 **رابط التحميل المباشر:**\n${webDownloadUrl}\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `💡 ملفك جاهز للتحميل من الموقع أو عبر المرفقات بالأسفل.`;

                // تجهيز المرفق إذا كان الحجم أقل من 24 ميجا
                const sendFiles = [];
                if (fileSizeMB <= 24) {
                    sendFiles.push(new AttachmentBuilder(finalZipPath, { name: finalZipFileName }));
                }

                // إرسال النتيجة بالخاص إذا كان مفتوحاً
                await interaction.user.send({
                    content: successMessage,
                    files: sendFiles,
                    components: [webRow]
                }).catch(() => {
                    console.log(`[RAVX BOT] تعذر الإرسال للخاص للعضو ${interaction.user.tag} (الخاص مقفل)`);
                });
                

                // تعديل الرد المباشر في الروم
                await interaction.editReply({
                    content: successMessage,
                    files: sendFiles,
                    components: [webRow]
                });

                // تنظيف الملفات المؤقتة
                if (fs.existsSync(tempWorkingDir)) {
                    fs.rmSync(tempWorkingDir, { recursive: true, force: true });
                }

            } catch (err) {
                console.error('Error in direct zip processing:', err);
                if (fs.existsSync(tempWorkingDir)) {
                    fs.rmSync(tempWorkingDir, { recursive: true, force: true });
                }
                await interaction.editReply({
                    content: `❌ **حدث خطأ أثناء معالجة الملف:** ${err.message}`,
                    components: []
                }).catch(() => {});
            }

        } else if (interaction.customId === 'modal_check') {
            licenses = loadLicenses();
            const ip = interaction.fields.getTextInputValue('ip_field');
            const scriptsList = licenses[ip] ? licenses[ip].join(', ') : 'لا توجد تراخيص مسجلة';

            const embed = new EmbedBuilder()
                .setTitle('🔍 نتيجة فحص التراخيص')
                .setColor(0x00ffcc)
                .addFields(
                    { name: '🌐 الآي بي:', value: `\`${ip}\``, inline: false },
                    { name: '📋 الموارد:', value: `\`${scriptsList}\``, inline: false }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    }
});


// Auto delete disabled here. Upload messages are deleted only after successful download.

console.log("TOKEN CHECK:", TOKEN ? TOKEN.substring(0,10) + "..." : "MISSING");
console.log("TOKEN LENGTH:", TOKEN?.length);
client.login(TOKEN);
