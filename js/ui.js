// Page chrome: theme, particles, scroll button, stats, command palette, sharing, contact, vCard and PDF.
import { state } from './state.js';
import { local } from './storage.js';
import { loadVendor, safeUrl, showToast } from './utils.js';
import { SITE_URL, t, toggleLanguage, ui } from './i18n.js';
import { showPage } from './router.js';
import { renderSkills, setSkillTab } from './render.js';
import { closeDialog, isDialogOpen, openDialog } from './modal.js';

let clickCount     = 0;

const ar = () => state.currentLang === 'ar';
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function registerPWA() {
    if (!('serviceWorker' in navigator)) return;
    // After load, so installing the worker (it precaches the shell) never competes with the page itself
    const register = () => navigator.serviceWorker.register('sw.js').catch(() => {});
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
}

export function setupScrollTop() {
    const btn = document.getElementById('scrollTopBtn');
    const progress = document.getElementById('scroll-progress');
    if (!btn && !progress) return;
    let queued = false;
    const update = () => {
        queued = false;
        const y = window.scrollY;
        btn?.classList.toggle('show', y > 300);
        btn?.classList.toggle('translate-y-10', y <= 300);
        if (progress) {
            const max = document.documentElement.scrollHeight - window.innerHeight;
            progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
        }
    };
    window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    update();
}

// Starts once the stats have their real values (computed from data.json by render.js).
export function initStatsObserver() {
    const el = document.getElementById('stats-section');
    if (!el) return;
    if (!window.IntersectionObserver) { animateCounters(); return; }
    const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); animateCounters(); }
    }, { threshold: 0.3 });
    observer.observe(el);
}

function animateCounters() {
    document.querySelectorAll('.stat-number').forEach(el => {
        const target = parseInt(el.dataset.target, 10) || 0;
        // No digit grouping: the graduation year must read 2026, not "2,026"
        if (prefersReducedMotion() || target === 0) { el.textContent = String(target); return; }
        el.dataset.counting = '1';
        const duration = target > 1000 ? 1600 : 1200;
        const start = performance.now();
        const tick = now => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            el.textContent = String(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(tick);
            else delete el.dataset.counting;
        };
        requestAnimationFrame(tick);
    });
}

// ─── Tilt: cards lean toward the pointer, with a soft light spot (mouse/trackpad only) ───
export function setupTilt() {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
    if (!fine.matches || prefersReducedMotion()) return;
    const MAX = 6;                                  // degrees
    let card = null, frame = 0, last = null;
    const reset = el => {
        el.classList.remove('tilting');
        ['--rx', '--ry'].forEach(v => el.style.removeProperty(v));
    };
    const apply = () => {
        frame = 0;
        if (!card || !last) return;
        const r = card.getBoundingClientRect();
        const x = (last.clientX - r.left) / r.width, y = (last.clientY - r.top) / r.height;
        card.style.setProperty('--ry', `${((x - 0.5) * 2 * MAX).toFixed(2)}deg`);
        card.style.setProperty('--rx', `${((0.5 - y) * 2 * MAX).toFixed(2)}deg`);
        card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
    };
    document.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse') return;
        const el = e.target.closest?.('.tilt');
        if (el !== card) { if (card) reset(card); card = el; if (card) card.classList.add('tilting'); }
        if (!card) return;
        last = e;
        if (!frame) frame = requestAnimationFrame(apply);
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { if (card) reset(card); card = null; });
}

// ─── Print and PDF: tabs, animations and admin controls do not exist on paper ───
export function setupPrint() {
    window.addEventListener('beforeprint', () => renderSkills('all', { instant: true }));
    window.addEventListener('afterprint',  () => setSkillTab(state.activeSkillTab));
}

// html2canvas cannot draw CSS masks, which is how the icons are rendered: in its copy of the page,
// replace every icon with an <img> of the same SVG, filled with the icon's text colour. The returned
// promise waits until the images are decoded (html2canvas skips images without a size yet).
export function inlineIconsForCanvas(doc) {
    const view = doc.defaultView;
    const images = [];
    doc.querySelectorAll('.fa, .fas, .fab, .far').forEach(icon => {
        const style = view.getComputedStyle(icon);
        const uri = style.getPropertyValue('--fa-icon').trim().match(/^url\((['"]?)(.+)\1\)$/)?.[2];
        const width = uri?.match(/viewBox='0 0 (\d+) 512'/)?.[1];
        if (!uri || !width) return;
        const box = view.getComputedStyle(icon, '::before');
        const img = doc.createElement('img');
        img.alt = '';
        img.src = uri
            .replace('%3Csvg ', `%3Csvg width='${width}' height='512' `)
            .replace('%3Cpath ', `%3Cpath fill='${encodeURIComponent(style.color)}' `);
        img.style.cssText = `display:inline-block;width:${box.width};height:${box.height};vertical-align:-0.125em`;
        icon.classList.remove('fa', 'fas', 'fab', 'far');   // drops the masked ::before…
        icon.style.display = 'inline-block';                // …but keep the icon box those classes gave
        icon.style.lineHeight = '1';
        icon.replaceChildren(img);
        images.push(img.decode().catch(() => {}));
    });
    return Promise.all(images);
}

// The copy html2canvas draws: finished animations, no admin controls, icons as images.
function prepareCanvasCopy(doc) {
    doc.body.classList.remove('admin-mode');
    doc.querySelectorAll('[data-aos]').forEach(el => el.classList.add('aos-animate'));
    doc.querySelectorAll('.print-hide').forEach(el => el.remove());
    doc.getElementById('print-header')?.classList.remove('hidden');
    return inlineIconsForCanvas(doc);
}

async function generatePDF() {
    showToast(ar() ? 'جاري إنشاء PDF...' : 'Generating PDF...', 'info');
    const resumeEl  = document.getElementById('resume');
    const wasActive = resumeEl.classList.contains('active');
    if (!wasActive) { resumeEl.style.display = 'block'; resumeEl.classList.add('active'); }
    renderSkills('all', { instant: true });
    try {
        await Promise.all([loadVendor('pdf'), new Promise(r => setTimeout(r, 600))]);
        const { jsPDF } = window.jspdf;
        const canvas = await html2canvas(resumeEl, {
            scale: 2, useCORS: true, allowTaint: true,
            backgroundColor: document.documentElement.classList.contains('dark') ? '#0b1120' : '#ffffff',
            logging: false, windowWidth: 1200,
            onclone: prepareCanvasCopy
        });
        const pdf   = new jsPDF('p', 'mm', 'a4');
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const imgH  = (canvas.height * pageW) / canvas.width;
        let pos = 0, left = imgH;
        const img = canvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(img, 'JPEG', 0, pos, pageW, imgH); left -= pageH;
        while (left > 0) { pos -= pageH; pdf.addPage(); pdf.addImage(img, 'JPEG', 0, pos, pageW, imgH); left -= pageH; }
        const name = asciiName();
        pdf.setProperties({ title: `${t(state.appData.profile?.name)} — CV`, author: state.appData.profile?.name?.en || '' });
        pdf.save(`${name}_CV.pdf`);
        showToast(ar() ? 'تم تحميل PDF ✅' : 'PDF downloaded ✅', 'success');
    } catch (err) {
        console.error(err);
        showToast(ar() ? 'فشل إنشاء PDF' : 'PDF generation failed', 'error');
    } finally {
        setSkillTab(state.activeSkillTab);
        if (!wasActive) { resumeEl.classList.remove('active'); resumeEl.style.display = 'none'; }
    }
}

// ASCII file names in both languages: browsers drop non-Latin download names (file saved as "download")
function asciiName() {
    return (state.appData.profile?.name?.en || 'Osama').trim().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
}

export function triggerPrint() { showPage('resume'); setTimeout(() => window.print(), 400); }

export async function shareProfile() {
    const name    = t(state.appData.profile?.name || { ar: 'أسامة الحربي', en: 'Osama Al-Harbi' });
    const summary = t(state.appData.profile?.summary || {});
    const url     = window.location.href;
    if (navigator.share) {
        try { await navigator.share({ title: name, text: summary.length > 120 ? `${summary.substring(0, 120)}…` : summary, url }); return; }
        catch (e) { if (e.name === 'AbortError') return; }
    }
    copyText(url, ar() ? 'تم نسخ الرابط ✅' : 'Link copied ✅');
}

// Clipboard API needs a secure context and permission; fall back to showing the text.
async function copyText(text, okMessage) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(okMessage, 'success');
    } catch {
        showToast(text, 'info');
    }
}

export function contactAction(type) {
    const p = state.appData.profile;
    if (!p) return;
    if (type === 'email') {
        if (p.email) copyText(p.email, ar() ? 'تم نسخ البريد ✅' : 'Email copied ✅');
    } else if (type === 'linkedin' || type === 'github') {
        const url = safeUrl(p[type]);
        if (url) window.open(url, '_blank', 'noopener');
    }
}

// ─── vCard: "save contact" for recruiters' phones and mail apps (generated from data.json) ───
const vcardEscape = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

export function buildVCard(profile, lang) {
    const pick = v => (v && typeof v === 'object' ? v[lang] || v.en || v.ar : v) || '';
    const nameEn = (profile.name?.en || pick(profile.name)).trim().split(/\s+/);
    const family = nameEn.length > 1 ? nameEn.pop() : '';
    const parts  = pick(profile.location).split(/[،,]/).map(s => s.trim()).filter(Boolean);
    const lines  = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `N:${vcardEscape(family)};${vcardEscape(nameEn.join(' '))};;;`,
        `FN:${vcardEscape(pick(profile.name))}`,
        pick(profile.title) && `TITLE:${vcardEscape(pick(profile.title))}`,
        profile.email && `EMAIL;TYPE=INTERNET:${vcardEscape(profile.email)}`,
        profile.phone && `TEL;TYPE=CELL:${vcardEscape(profile.phone)}`,
        parts.length && `ADR;TYPE=HOME:;;;${vcardEscape(parts[0])};;;${vcardEscape(parts.length > 1 ? parts[parts.length - 1] : '')}`,
        `URL:${SITE_URL}`,
        safeUrl(profile.linkedin) && `X-SOCIALPROFILE;TYPE=linkedin:${safeUrl(profile.linkedin)}`,
        safeUrl(profile.github) && `X-SOCIALPROFILE;TYPE=github:${safeUrl(profile.github)}`,
        'END:VCARD'
    ];
    return lines.filter(Boolean).join('\r\n') + '\r\n';
}

export function downloadVCard() {
    const p = state.appData.profile;
    if (!p) return;
    const blob = new Blob([buildVCard(p, state.currentLang)], { type: 'text/vcard;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `${asciiName()}.vcf` });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function sendMailto() {
    const p       = state.appData.profile;
    const subject = encodeURIComponent(document.getElementById('contact-subject')?.value.trim() || '');
    const body    = encodeURIComponent(document.getElementById('contact-message')?.value.trim() || '');
    if (!subject && !body) {
        showToast(ar() ? 'يرجى كتابة موضوع أو رسالة' : 'Please enter a subject or message', 'error');
        document.getElementById('contact-subject')?.focus();
        return;
    }
    window.location.href = `mailto:${p?.email || 'osamafcv214@gmail.com'}?subject=${subject}&body=${body}`;
}

export function updateCharCounter(el) {
    const counter = document.getElementById('char-counter');
    const max = Number(el.getAttribute('maxlength')) || 2000;
    if (counter) counter.textContent = `${el.value.length} / ${max}`;
}

export function checkLinkedInReferrer() {
    if (document.referrer && /(^|\.)linkedin\.com$/.test(safeHost(document.referrer))) {
        setTimeout(() => showToast(
            ar() ? 'مرحباً، يبدو أنك قادم من LinkedIn 👋' : 'Welcome from LinkedIn! 👋', 'info'
        ), 700);
    }
}

function safeHost(url) {
    try { return new URL(url).hostname; } catch { return ''; }
}

export function setupSecretTrigger() {
    document.getElementById('secret-trigger').addEventListener('click', () => {
        clickCount++;
        if (clickCount >= 3) { openDialog(document.getElementById('admin-modal')); clickCount = 0; }
    });
}

// ─── Theme ───────────────────────────────────────────
function applyTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
    document.getElementById('theme-btn')?.setAttribute('aria-pressed', String(dark));
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1120' : '#2563eb');
}

export function initTheme() {
    const btn = document.getElementById('theme-btn');
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const saved = local.get('theme');
    applyTheme(saved === 'dark' || (saved !== 'light' && system.matches));
    btn.addEventListener('click', () => {
        const dark = !document.documentElement.classList.contains('dark');
        local.set('theme', dark ? 'dark' : 'light');
        applyTheme(dark);
        initParticles();
    });
    // Until the visitor picks a theme, follow the operating system when it changes.
    system.addEventListener?.('change', e => {
        if (local.get('theme')) return;
        applyTheme(e.matches);
        initParticles();
    });
}

// Decorative background: fetched after start-up (SRI-checked) and skipped for reduced motion,
// data saver and phone-sized screens (it costs battery for little effect there).
export function initParticles() {
    if (prefersReducedMotion() || navigator.connection?.saveData || window.matchMedia('(max-width: 767px)').matches) return;
    loadVendor('particles').then(() => {
        // particlesJS() adds a new instance each call; stop the previous one before redrawing.
        (window.pJSDom || []).forEach(p => cancelAnimationFrame(p.pJS.fn.drawAnimFrame));
        window.pJSDom = [];
        const isDark = document.documentElement.classList.contains('dark');
        particlesJS('particles-js', {
            particles: {
                number:      { value: 40 },
                color:       { value: isDark ? '#ffffff' : '#3b82f6' },
                opacity:     { value: 0.3 },
                size:        { value: 3 },
                line_linked: { enable: true, distance: 150, color: isDark ? '#ffffff' : '#3b82f6', opacity: 0.1, width: 1 },
                move:        { enable: true, speed: 1 }
            },
            interactivity: { detect_on: 'canvas', events: { onhover: { enable: true, mode: 'grab' } } },
            retina_detect: true
        });
    }).catch(() => {});   // decorative only
}

// ─── Command palette (Ctrl/⌘ + K or the search button) ───
let cmdItems   = [];
let cmdVisible = [];
let cmdActive  = 0;

function commands() {
    const cv = document.querySelector('[data-cv-link]');
    return [
        { icon: 'fa-home',          ar: 'الرئيسية',                 en: 'Home',                 run: () => showPage('home') },
        { icon: 'fa-id-card',       ar: 'السيرة الذاتية',           en: 'Resume',               run: () => showPage('resume') },
        { icon: 'fa-briefcase',     ar: 'الأعمال',                  en: 'Portfolio',            run: () => showPage('portfolio') },
        { icon: 'fa-envelope',      ar: 'تواصل',                    en: 'Contact',              run: () => showPage('contact') },
        { icon: 'fa-download',      ar: 'تحميل السيرة الذاتية PDF', en: 'Download CV (PDF)',    run: () => cv?.click() },
        { icon: 'fa-file-pdf',      ar: 'إنشاء PDF من الصفحة',      en: 'Generate PDF of this page', run: generatePDF },
        { icon: 'fa-print',         ar: 'طباعة',                    en: 'Print',                run: triggerPrint },
        { icon: 'fa-share-alt',     ar: 'مشاركة',                   en: 'Share',                run: shareProfile },
        { icon: 'fa-copy',          ar: 'نسخ البريد الإلكتروني',    en: 'Copy email',           run: () => contactAction('email') },
        { icon: 'fa-address-card',  ar: 'حفظ جهة الاتصال (vCard)',  en: 'Save contact (vCard)', run: downloadVCard },
        { icon: 'fa-whatsapp',      ar: 'محادثة واتساب',            en: 'WhatsApp chat',        run: () => document.getElementById('contact-whatsapp')?.click(), keywords: 'whatsapp واتساب' },
        { icon: 'fa-language',      ar: 'English',                  en: 'العربية',              run: toggleLanguage, keywords: 'language لغة' },
        { icon: 'fa-moon',          ar: 'الوضع الليلي',             en: 'Dark mode',            run: () => document.getElementById('theme-btn').click(), keywords: 'theme ثيم' }
    ];
}

export function openCmdPalette() {
    const palette = document.getElementById('cmd-palette');
    const input   = document.getElementById('cmd-input');
    input.value = '';                       // a reopened palette must not keep the old filter
    renderCmdItems();
    openDialog(palette, { focus: input });
}

export function closeCmdPalette() {
    closeDialog(document.getElementById('cmd-palette'));
}

export function setupCmdPalette() {
    document.addEventListener('keydown', e => {
        // e.code: the K key also on Arabic layouts (e.key is "ن" there) and with Caps Lock ("K")
        if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.code === 'KeyK' || e.key?.toLowerCase() === 'k')) {
            e.preventDefault();
            if (isDialogOpen(document.getElementById('cmd-palette'))) closeCmdPalette(); else openCmdPalette();
        }
    });
    const input = document.getElementById('cmd-input');
    input.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!cmdVisible.length) return;
            const step = e.key === 'ArrowDown' ? 1 : -1;
            cmdActive = (cmdActive + step + cmdVisible.length) % cmdVisible.length;
            highlightCmd();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (cmdVisible.length) runCommand(cmdVisible[cmdActive]);
        }
    });
}

function renderCmdItems() {
    cmdItems = commands();
    const lang = state.currentLang;
    document.getElementById('cmd-list').innerHTML = cmdItems.map((item, i) => `
        <div id="cmd-opt-${i}" class="cmd-item p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex gap-3 items-center rounded transition"
             data-action="run-command" data-index="${i}" role="option" aria-selected="false">
            <i class="fas ${item.icon} text-primary w-4" aria-hidden="true"></i>
            <span class="font-bold dark:text-white text-sm">${item[lang]}</span>
        </div>
    `).join('') + `<p id="cmd-empty" class="hidden p-3 text-sm text-gray-500 text-center">${ui('cmd_empty')}</p>`;
    filterCmd('');
}

export function runCommand(index) {
    closeCmdPalette();
    cmdItems[index]?.run();
}

// Matches the label in either language plus keywords, so "pdf", "سيرة" or "resume" all work.
export function filterCmd(val) {
    const q = val.trim().toLowerCase();
    cmdVisible = [];
    document.querySelectorAll('#cmd-list > .cmd-item').forEach(el => {
        const item = cmdItems[Number(el.dataset.index)];
        const hay  = `${item.ar} ${item.en} ${item.keywords || ''}`.toLowerCase();
        const show = !q || hay.includes(q);
        el.style.display = show ? 'flex' : 'none';
        if (show) cmdVisible.push(Number(el.dataset.index));
    });
    document.getElementById('cmd-empty')?.classList.toggle('hidden', cmdVisible.length > 0);
    cmdActive = 0;
    highlightCmd();
}

function highlightCmd() {
    const input = document.getElementById('cmd-input');
    document.querySelectorAll('#cmd-list > .cmd-item').forEach(el => {
        const on = Number(el.dataset.index) === cmdVisible[cmdActive];
        el.setAttribute('aria-selected', String(on));
        el.classList.toggle('bg-gray-100', on);
        el.classList.toggle('dark:bg-gray-800', on);
        if (on) { input.setAttribute('aria-activedescendant', el.id); el.scrollIntoView({ block: 'nearest' }); }
    });
    if (!cmdVisible.length) input.removeAttribute('aria-activedescendant');
}
