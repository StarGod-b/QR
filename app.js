/**
 * app.js – QR Code Generator Logic (Vanilla JS)
 * Ported & enhanced from QR.js (React component)
 * Uses QRious library (loaded via CDN in index.html)
 *
 * === Image + Text tab ===
 * Uploads the selected image to ImgBB, grabs the direct URL,
 * combines it with the user's message, then renders the QR via QRious.
 * Replace IMGBB_API_KEY with your own key from https://imgbb.com/
 */

const IMGBB_API_KEY = 'YOUR_IMGBB_API_KEY_HERE';

(function () {
    'use strict';

    /* ── State ───────────────────────────────────────────────── */
    let activeTab = 'url';
    let currentQrData = '';
    let copyTimeout = null;
    let generateTimeout = null;
    let qrInstance = null;
    let selectedImageFile = null;   // holds File object for Image+Text tab

    /* ── DOM Refs ────────────────────────────────────────────── */
    const tabBtns        = document.querySelectorAll('.tab-btn');
    const tabPanels      = document.querySelectorAll('.tab-panel');
    const tabIndicator   = document.getElementById('tabIndicator');

    const urlInput       = document.getElementById('urlInput');
    const textInput      = document.getElementById('textInput');
    const charCount      = document.getElementById('charCount');

    const contactFields  = document.querySelectorAll('.contact-field');
    const firstName      = document.getElementById('firstName');
    const lastName       = document.getElementById('lastName');
    const phoneNumber    = document.getElementById('phoneNumber');
    const emailAddr      = document.getElementById('emailAddr');
    const orgName        = document.getElementById('orgName');
    const jobTitle       = document.getElementById('jobTitle');
    const contactUrl1    = document.getElementById('contactUrl1');
    const contactUrl2    = document.getElementById('contactUrl2');
    const contactUrl3    = document.getElementById('contactUrl3');
    const urlGroup2      = document.getElementById('urlGroup2');
    const urlGroup3      = document.getElementById('urlGroup3');

    // ── Image + Text refs ────────────────────────────────────────
    const imgFileInput      = document.getElementById('imgFileInput');
    const fileDropZone      = document.getElementById('fileDropZone');
    const fileDropContent   = document.getElementById('fileDropContent');
    const fileSelectedInfo  = document.getElementById('fileSelectedInfo');
    const fileSelectedName  = document.getElementById('fileSelectedName');
    const fileSelectedSize  = document.getElementById('fileSelectedSize');
    const fileThumb         = document.getElementById('fileThumb');
    const fileRemoveBtn     = document.getElementById('fileRemoveBtn');
    const imgTextMessage    = document.getElementById('imgTextMessage');
    const imgTextCharCount  = document.getElementById('imgTextCharCount');
    const btnGenImgText     = document.getElementById('btnGenImgText');
    const btnGenImgTextLabel= document.getElementById('btnGenImgTextLabel');
    const imgtextStatus     = document.getElementById('imgtextStatus');
    const imgtextStatusInner= document.getElementById('imgtextStatusInner');

    const btnClear       = document.getElementById('btnClear');
    const btnDownload    = document.getElementById('btnDownload');
    const btnCopy        = document.getElementById('btnCopy');
    const copyLabel      = document.getElementById('copyLabel');
    const copyIconEl     = btnCopy.querySelector('.copy-icon');
    const checkIconEl    = btnCopy.querySelector('.check-icon');

    const qrBox          = document.getElementById('qrBox');
    const qrEmpty        = document.getElementById('qrEmpty');
    const qrCanvasWrap   = document.getElementById('qrCanvasWrap');
    const qrContainer    = document.getElementById('qrContainer');

    const actionButtons  = document.getElementById('actionButtons');
    const qrDataPreview  = document.getElementById('qrDataPreview');
    const qrDataContent  = document.getElementById('qrDataContent');
    const qrDataType     = document.getElementById('qrDataType');

    /* ── Tab Indicator Position ──────────────────────────────── */
    function updateTabIndicator() {
        const activeBtn = document.querySelector('.tab-btn.active');
        if (!activeBtn) return;
        tabIndicator.style.left  = activeBtn.offsetLeft + 'px';
        tabIndicator.style.width = activeBtn.offsetWidth + 'px';
    }

    /* ── Tab Switching ───────────────────────────────────────── */
    function switchTab(tabId) {
        activeTab = tabId;

        tabBtns.forEach(btn => {
            const isActive = btn.dataset.tab === tabId;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', String(isActive));
        });

        tabPanels.forEach(panel => {
            panel.classList.toggle('active', panel.id === `panel-${tabId}`);
        });

        updateTabIndicator();
        scheduleGenerate();
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    /* ── URL Formatting ──────────────────────────────────────── */
    function formatUrl(url) {
        const trimmed = url.trim();
        if (!trimmed) return '';
        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
            return 'https://' + trimmed;
        }
        return trimmed;
    }

    /* ── vCard Generator ─────────────────────────────────────── */
    function generateVCard() {
        const fn = firstName.value.trim();
        const ln = lastName.value.trim();
        const ph = phoneNumber.value.trim();
        const em = emailAddr.value.trim();
        const org = orgName.value.trim();
        const job = jobTitle.value.trim();
        const url1 = contactUrl1.value.trim();
        const url2 = contactUrl2.value.trim();
        const url3 = contactUrl3.value.trim();

        if (!fn && !ln && !ph && !em) return '';

        const lines = [
            'BEGIN:VCARD',
            'VERSION:3.0',
            `FN:${fn} ${ln}`.trim(),
            `N:${ln};${fn};;;`,
        ];
        if (org) lines.push(`ORG:${org}`);
        if (job) lines.push(`TITLE:${job}`);
        if (ph)  lines.push(`TEL;TYPE=CELL:${ph}`);
        if (em)  lines.push(`EMAIL:${em}`);
        if (url1) lines.push(`URL:${url1}`);
        if (url2) lines.push(`URL:${url2}`);
        if (url3) lines.push(`URL:${url3}`);
        lines.push('END:VCARD');
        return lines.join('\n');
    }

    /* ── Get QR Data for Current Tab ─────────────────────────── */
    function getQrData() {
        switch (activeTab) {
            case 'url':     return formatUrl(urlInput.value);
            case 'text':    return textInput.value.trim();
            case 'contact': return generateVCard();
            case 'imgtext': return '';   // handled by explicit button click
            default:        return '';
        }
    }

    /* ── Build QR Code ───────────────────────────────────────── */
    function buildQR(text) {
        // Clear container
        qrContainer.innerHTML = '';

        const canvas = document.createElement('canvas');
        qrContainer.appendChild(canvas);

        try {
            qrInstance = new window.QRious({
                element: canvas,
                value: text,
                size: 260,
                background: '#ffffff',
                foreground: '#111827',
                level: 'M',
                padding: 12
            });
        } catch (err) {
            console.error('QRious error:', err);
            useFallback(text);
        }

        canvas.style.display = 'block';
        canvas.style.borderRadius = '4px';
    }

    /* ── Fallback via QR Server API ──────────────────────────── */
    function useFallback(text) {
        qrContainer.innerHTML = '';
        const img = document.createElement('img');
        const encoded = encodeURIComponent(text);
        img.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encoded}&format=png&margin=12`;
        img.alt = 'Generated QR Code';
        img.style.display = 'block';
        img.style.borderRadius = '4px';
        img.onerror = () => {
            img.src = `https://chart.googleapis.com/chart?chs=260x260&cht=qr&chl=${encoded}&choe=UTF-8`;
        };
        qrContainer.appendChild(img);
    }

    /* ── Show / Hide QR UI ───────────────────────────────────── */
    function showQR(text) {
        currentQrData = text;

        qrBox.classList.add('has-qr');
        qrEmpty.style.display = 'none';
        qrCanvasWrap.style.display = 'flex';
        actionButtons.style.display = 'flex';
        qrDataPreview.style.display = 'block';

        // Type badge
        const typeMap = { url: 'URL', text: 'Text', contact: 'vCard', imgtext: 'Image+Text' };
        qrDataType.textContent = typeMap[activeTab] || 'Data';

        // Data preview
        qrDataContent.textContent = text;

        buildQR(text);
    }

    function hideQR() {
        currentQrData = '';
        qrInstance = null;

        qrBox.classList.remove('has-qr');
        qrEmpty.style.display = 'flex';
        qrCanvasWrap.style.display = 'none';
        actionButtons.style.display = 'none';
        qrDataPreview.style.display = 'none';
        qrContainer.innerHTML = '';
    }

    /* ── Debounced Generate ──────────────────────────────────── */
    function scheduleGenerate() {
        clearTimeout(generateTimeout);
        generateTimeout = setTimeout(generate, 220);
    }

    function generate() {
        const data = getQrData();
        if (data) {
            showQR(data);
        } else {
            hideQR();
        }
    }

    /* ── Input Listeners ─────────────────────────────────────── */
    urlInput.addEventListener('input', scheduleGenerate);

    textInput.addEventListener('input', () => {
        charCount.textContent = textInput.value.length;
        scheduleGenerate();
    });

    contactFields.forEach(f => f.addEventListener('input', scheduleGenerate));

    contactUrl1.addEventListener('input', () => {
        if (contactUrl1.value.trim()) urlGroup2.style.display = 'block';
    });
    contactUrl2.addEventListener('input', () => {
        if (contactUrl2.value.trim()) urlGroup3.style.display = 'block';
    });

    /* ── Download PNG ────────────────────────────────────────── */
    btnDownload.addEventListener('click', () => {
        if (!currentQrData) return;

        const canvas = qrContainer.querySelector('canvas');
        if (canvas) {
            // Add a white padded border for print-friendliness
            const margin = 20;
            const out = document.createElement('canvas');
            out.width  = canvas.width  + margin * 2;
            out.height = canvas.height + margin * 2;
            const ctx = out.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, out.width, out.height);
            ctx.drawImage(canvas, margin, margin);

            const name = activeTab === 'contact'
                ? `qr-contact-${(firstName.value || 'card').toLowerCase().replace(/\s+/g, '-')}`
                : `qr-${activeTab}`;

            const link = document.createElement('a');
            link.download = `${name}.png`;
            link.href = out.toDataURL('image/png');
            link.click();
        } else {
            // Fallback: img element
            const img = qrContainer.querySelector('img');
            if (img) {
                const link = document.createElement('a');
                link.download = `qr-${activeTab}.png`;
                link.href = img.src;
                link.target = '_blank';
                link.click();
            }
        }

        // Micro-animation
        btnDownload.style.transform = 'scale(.96)';
        setTimeout(() => { btnDownload.style.transform = ''; }, 180);
    });

    /* ── Copy Data ───────────────────────────────────────────── */
    btnCopy.addEventListener('click', async () => {
        if (!currentQrData) return;
        try {
            await navigator.clipboard.writeText(currentQrData);
        } catch (_) {
            // Fallback for older browsers
            const ta = document.createElement('textarea');
            ta.value = currentQrData;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        setCopied(true);
    });

    function setCopied(state) {
        clearTimeout(copyTimeout);
        if (state) {
            btnCopy.classList.add('copied');
            copyIconEl.style.display = 'none';
            checkIconEl.style.display = 'block';
            copyLabel.textContent = 'Copied!';
            copyTimeout = setTimeout(() => setCopied(false), 2200);
        } else {
            btnCopy.classList.remove('copied');
            copyIconEl.style.display = 'block';
            checkIconEl.style.display = 'none';
            copyLabel.textContent = 'Copy Data';
        }
    }

    /* ── Clear All ───────────────────────────────────────────── */
    btnClear.addEventListener('click', () => {
        urlInput.value = '';
        textInput.value = '';
        charCount.textContent = '0';
        firstName.value = '';
        lastName.value = '';
        phoneNumber.value = '';
        emailAddr.value = '';
        orgName.value = '';
        jobTitle.value = '';
        contactUrl1.value = '';
        contactUrl2.value = '';
        contactUrl3.value = '';
        urlGroup2.style.display = 'none';
        urlGroup3.style.display = 'none';
        // Clear Image+Text tab
        clearImageSelection();
        imgTextMessage.value = '';
        imgTextCharCount.textContent = '0';
        setImgtextStatus('');
        hideQR();
        setCopied(false);

        // Brief shake animation
        btnClear.style.transition = 'transform .15s ease';
        btnClear.style.transform  = 'rotate(-5deg) scale(.97)';
        setTimeout(() => {
            btnClear.style.transform = 'rotate(5deg)';
            setTimeout(() => { btnClear.style.transform = ''; }, 120);
        }, 120);
    });

    /* ══════════════════════════════════════════════════════════════
       IMAGE + TEXT TAB – Logic
    ═══════════════════════════════════════════════════════════════ */

    /* ── File Selection Helpers ───────────────────────────────── */
    function formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(2) + ' MB';
    }

    function applyFile(file) {
        if (!file) return;
        if (!file.type.match(/image\/(jpeg|png)/)) {
            setImgtextStatus('error', '⚠ Only JPG/PNG files are supported.');
            return;
        }
        if (file.size > 32 * 1024 * 1024) {
            setImgtextStatus('error', '⚠ File is too large. Maximum size is 32 MB.');
            return;
        }
        selectedImageFile = file;
        fileSelectedName.textContent = file.name;
        fileSelectedSize.textContent = formatBytes(file.size);

        const reader = new FileReader();
        reader.onload = e => { fileThumb.src = e.target.result; };
        reader.readAsDataURL(file);

        fileDropContent.style.display = 'none';
        fileSelectedInfo.style.display = 'flex';
        fileDropZone.classList.add('has-file');
        setImgtextStatus('');
    }

    function clearImageSelection() {
        selectedImageFile = null;
        imgFileInput.value = '';
        fileThumb.src = '';
        fileSelectedName.textContent = '';
        fileSelectedSize.textContent = '';
        fileDropContent.style.display = 'flex';
        fileSelectedInfo.style.display = 'none';
        fileDropZone.classList.remove('has-file', 'drag-over');
    }

    /* ── File Input Change ───────────────────────────────────────*/
    imgFileInput.addEventListener('change', () => {
        if (imgFileInput.files.length > 0) applyFile(imgFileInput.files[0]);
    });

    /* ── Clicking the drop zone triggers file picker ─────────── */
    fileDropZone.addEventListener('click', (e) => {
        if (e.target === fileRemoveBtn || fileRemoveBtn.contains(e.target)) return;
        imgFileInput.click();
    });

    /* ── Remove button ────────────────────────────────────────── */
    fileRemoveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearImageSelection();
    });

    /* ── Drag & Drop ─────────────────────────────────────────── */
    fileDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDropZone.classList.add('drag-over');
    });
    fileDropZone.addEventListener('dragleave', () => {
        fileDropZone.classList.remove('drag-over');
    });
    fileDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) applyFile(files[0]);
    });

    /* ── Character counter ───────────────────────────────────── */
    imgTextMessage.addEventListener('input', () => {
        imgTextCharCount.textContent = imgTextMessage.value.length;
    });

    /* ── Status display ──────────────────────────────────────── */
    // type: '' | 'loading' | 'success' | 'error'
    function setImgtextStatus(type, message) {
        if (!type) {
            imgtextStatus.style.display = 'none';
            imgtextStatusInner.className = 'imgtext-status-inner';
            imgtextStatusInner.textContent = '';
            return;
        }
        imgtextStatus.style.display = 'block';
        imgtextStatusInner.className = `imgtext-status-inner status-${type}`;
        imgtextStatusInner.textContent = message;
    }

    /* ── Set button loading state ────────────────────────────── */
    function setGenBtnLoading(loading) {
        btnGenImgText.disabled = loading;
        btnGenImgText.classList.toggle('loading', loading);
        btnGenImgTextLabel.textContent = loading ? 'Uploading & Generating…' : 'Generate QR Code';
    }

    /* ── Main Generate Handler ───────────────────────────────── */
    btnGenImgText.addEventListener('click', async () => {
        const message = imgTextMessage.value.trim();

        if (!selectedImageFile && !message) {
            setImgtextStatus('error', '⚠ Please select an image and/or enter a message.');
            return;
        }

        setGenBtnLoading(true);
        setImgtextStatus('loading', '⏳ Uploading image to ImgBB…');

        let combinedString = '';

        try {
            if (selectedImageFile) {
                const formData = new FormData();
                formData.append('image', selectedImageFile);

                const response = await fetch(
                    `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
                    { method: 'POST', body: formData }
                );

                if (!response.ok) {
                    throw new Error(`ImgBB responded with HTTP ${response.status}`);
                }

                const json = await response.json();

                if (!json.success) {
                    throw new Error(json.error?.message || 'ImgBB upload failed.');
                }

                const imageUrl = json.data.url;
                setImgtextStatus('loading', '✅ Image uploaded! Generating QR code…');

                if (message) {
                    combinedString = `Image: ${imageUrl} | Message: ${message}`;
                } else {
                    combinedString = `Image: ${imageUrl}`;
                }
            } else {
                // No image – QR code for the message only
                combinedString = message;
            }

            // Check QR data length (QRious limit ~2953 bytes for binary / ~4296 for alphanumeric)
            if (combinedString.length > 2900) {
                setImgtextStatus('error', '⚠ Combined data is too long for a QR code. Try a shorter message.');
                setGenBtnLoading(false);
                return;
            }

            showQR(combinedString);
            setImgtextStatus('success', `✔ QR code generated! Encodes ${combinedString.length} characters.`);

        } catch (err) {
            console.error('Image+Text QR error:', err);
            setImgtextStatus('error', `✖ Error: ${err.message}`);
        } finally {
            setGenBtnLoading(false);
        }
    });

    /* ── Init: Indicator positioning ────────────────────────── */
    window.addEventListener('DOMContentLoaded', () => {
        updateTabIndicator();
    });

    // Also update on resize (tab widths may change)
    window.addEventListener('resize', updateTabIndicator);

    // Initial run
    updateTabIndicator();

})();
