// Client Logic for RAVX Script Vault

document.addEventListener('DOMContentLoaded', () => {
  const codeInput = document.getElementById('codeInput');
  const pasteBtn = document.getElementById('pasteBtn');

  // Automatically uppercase code input
  codeInput.addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });

  // Paste button handler
  if (pasteBtn) {
    pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          codeInput.value = text.trim().toUpperCase();
          verifyCode();
        }
      } catch (err) {
        showToast('تعذر الوصول للحافظة، يمكنك لصق الكود يدوياً');
      }
    });
  }

  // Check URL query parameters for ?code=XXXX or ?c=XXXX
  const urlParams = new URLSearchParams(window.location.search);
  const initialCode = urlParams.get('code') || urlParams.get('c');
  if (initialCode) {
    codeInput.value = initialCode.trim().toUpperCase();
    verifyCode();
  }
});

// Load demo code helper
function loadDemoCode(code) {
  const codeInput = document.getElementById('codeInput');
  codeInput.value = code;
  verifyCode();
}

// Mode Labels
const ENCRYPTION_MODES = {
  target: '🛡️ تشفير الملفات المستهدفة (client / server)',
  full: '📦 تشفير شامل لجميع ملفات Lua',
  none: '🔓 بدون تشفير (قفل بالـ IP فقط)'
};

// Verify Code via API
async function verifyCode() {
  const codeInput = document.getElementById('codeInput');
  const submitBtn = document.getElementById('submitBtn');
  const statusMessage = document.getElementById('statusMessage');
  const scriptDetails = document.getElementById('scriptDetails');

  const code = codeInput.value.trim().toUpperCase();
  if (!code) {
    showStatus('يرجى إدخال كود السكربت أولاً', 'error');
    return;
  }

  // UI loading state
  submitBtn.disabled = true;
  submitBtn.querySelector('.btn-text').textContent = 'جاري الفحص...';
  showStatus('جاري التحقق من الكود وقاعدة بيانات التراخيص...', 'loading');
  scriptDetails.classList.add('hidden');

  try {
    const res = await fetch(`/api/script/${encodeURIComponent(code)}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      showStatus(data.message || 'الكود غير صحيح أو لم يتم العثور على سكربت مطابق.', 'error');
      submitBtn.disabled = false;
      submitBtn.querySelector('.btn-text').textContent = 'فحص الكود';
      return;
    }

    // Success! Populate details
    statusMessage.classList.add('hidden');
    const s = data.script;

    document.getElementById('resName').textContent = s.resourceName || s.title || s.originalFilename;
    document.getElementById('resIp').textContent = s.targetIp || 'غير محدد';
    document.getElementById('resMode').textContent = ENCRYPTION_MODES[s.encryptionMode] || s.encryptionMode || 'تشفير آمن';
    
    // Format size
    const sizeInMB = (s.fileSize / (1024 * 1024)).toFixed(2);
    const sizeInKB = (s.fileSize / 1024).toFixed(1);
    document.getElementById('resSize').textContent = s.fileSize > 1024 * 1024 ? `${sizeInMB} MB` : `${sizeInKB} KB`;
    
    document.getElementById('resDownloads').textContent = `${s.downloads || 0} مرة`;
    document.getElementById('dlFileName').textContent = s.originalFilename || 'Secured_Script.zip';

    // Set download link
    const downloadBtn = document.getElementById('downloadBtn');
    downloadBtn.href = `/api/download/${encodeURIComponent(s.code)}`;

    // Increment downloads locally on click
    downloadBtn.onclick = () => {
      showToast('🚀 بدأ تنزيل الملف المضغوط!');
      const downloadsElem = document.getElementById('resDownloads');
      const current = parseInt(downloadsElem.textContent) || 0;
      downloadsElem.textContent = `${current + 1} مرة`;
    };

    // Show result card
    scriptDetails.classList.remove('hidden');

    // Smooth scroll to result
    scriptDetails.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Update URL without page reload
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('code', s.code);
    window.history.replaceState({}, '', newUrl);

  } catch (err) {
    showStatus('تعذر الاتصال بالخادم، يرجى التأكد من تشغيل الخادم والمحاولة مجدداً.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector('.btn-text').textContent = 'فحص الكود';
  }
}

// Display status message
function showStatus(text, type = 'error') {
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.className = `status-box ${type}`;
  statusMessage.textContent = text;
  statusMessage.classList.remove('hidden');
}

// Copy Direct Link to Clipboard
function copyDirectLink() {
  const url = window.location.href;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('✅ تم نسخ رابط التحميل المباشر إلى الحافظة!');
    }).catch(() => {
      fallbackCopy(url);
    });
  } else {
    fallbackCopy(url);
  }
}

function fallbackCopy(text) {
  const tempInput = document.createElement('input');
  tempInput.value = text;
  document.body.appendChild(tempInput);
  tempInput.select();
  document.execCommand('copy');
  document.body.removeChild(tempInput);
  showToast('✅ تم نسخ الرابط بنجاح!');
}

// Toast Popup
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');

  // Trigger animation reset
  toast.style.animation = 'none';
  toast.offsetHeight; // trigger reflow
  toast.style.animation = null;

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3200);
}
