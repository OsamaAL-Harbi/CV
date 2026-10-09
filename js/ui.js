// Page chrome: theme, particles, scroll button, stats, command palette, sharing, contact and PDF.
import { state } from './state.js';
import { loadVendor, safeUrl, showToast } from './utils.js';
import { t, toggleLanguage } from './i18n.js';
import { showPage } from './router.js';

let clickCount     = 0;

export function registerPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
}

export function setupScrollTop() {
    window.addEventListener('scroll', () => {
        const btn = document.getElementById('scrollTopBtn');
        if (!btn) return;
        if (window.scrollY > 300) { btn.classList.add('show'); btn.classList.remove('translate-y-10'); }
        else                      { btn.classList.remove('show'); btn.classList.add('translate-y-10'); }
    });
}

export function initStatsObserver() {
    if (!window.IntersectionObserver) return;
    let animated = false;
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting && !animated) { animated = true; animateCounters(); } });
    }, { threshold: 0.3 });
    const tryObserve = () => {
        const el = document.getElementById('stats-section');
        if (el) observer.observe(el); else setTimeout(tryObserve, 200);
    };
    tryObserve();
}

function animateCounters() {
    document.querySelectorAll('.stat-number').forEach(el => {
        const target   = parseInt(el.getAttribute('data-target'), 10);
        const duration = target > 1000 ? 2000 : (target > 100 ? 1800 : 1200);
        const step     = Math.ceil(target / (duration / 16));
        let   current  = 0;
        const timer    = setInterval(() => {
            current = Math.min(current + step, target);
            el.textContent = current.toLocaleString();
            if (current >= target) clearInterval(timer);
        }, 16);
    });
}

async function generatePDF() {
    showToast(state.currentLang === 'ar' ? 'جاري إنشاء PDF...' : 'Generating PDF...', 'info');
    const resumeEl  = document.getElementById('resume');
    const wasActive = resumeEl.classList.contains('active');
    if (!wasActive) { resumeEl.style.display = 'block'; resumeEl.classList.add('active'); }
    try {
        await Promise.all([loadVendor('pdf'), new Promise(r => setTimeout(r, 600))]);
        const { jsPDF } = window.jspdf;
        const canvas = await html2canvas(resumeEl, {
            scale: 2, useCORS: true, allowTaint: true,
            backgroundColor: document.documentElement.classList.contains('dark') ? '#0b1120' : '#ffffff',
            logging: false, windowWidth: 1200
        });
        const pdf   = new jsPDF('p', 'mm', 'a4');
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const imgH  = (canvas.height * pageW) / canvas.width;
        let pos = 0, left = imgH;
        const img = canvas.toDataURL('image/jpeg', 0.92);
        pdf.addImage(img, 'JPEG', 0, pos, pageW, imgH); left -= pageH;
        while (left > 0) { pos -= pageH; pdf.addPage(); pdf.addImage(img, 'JPEG', 0, pos, pageW, imgH); left -= pageH; }
        const name = t(state.appData.profile?.name || { ar: 'Osama', en: 'Osama' }).replace(/\s+/g, '_');
        pdf.save(`${name}_CV.pdf`);
        showToast(state.currentLang === 'ar' ? 'تم تحميل PDF ✅' : 'PDF downloaded ✅', 'success');
    } catch (err) {
        console.error(err);
        showToast(state.currentLang === 'ar' ? 'فشل إنشاء PDF' : 'PDF generation failed', 'error');
    } finally {
        if (!wasActive) { resumeEl.classList.remove('active'); resumeEl.style.display = 'none'; }
    }
}

export function triggerPrint() { showPage('resume'); setTimeout(() => window.print(), 400); }

export async function shareProfile() {
    const name    = t(state.appData.profile?.name || { ar: 'أسامة الحربي', en: 'Osama Al-Harbi' });
    const summary = t(state.appData.profile?.summary || {});
    const url     = window.location.href;
    if (navigator.share) {
        try { await navigator.share({ title: name, text: summary.substring(0, 120) + '...', url }); return; }
        catch (e) { if (e.name === 'AbortError') return; }
    }
    copyToClipboard(url);
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(state.currentLang === 'ar' ? 'تم نسخ الرابط ✅' : 'Link copied ✅', 'success');
    } catch { showToast(state.currentLang === 'ar' ? 'تعذّر النسخ' : 'Copy failed', 'error'); }
}

export function contactAction(type) {
    const p = state.appData.profile;
    if (!p) return;
    if (type === 'email') {
        navigator.clipboard.writeText(p.email).then(() => {
            showToast(state.currentLang === 'ar' ? 'تم نسخ البريد ✅' : 'Email copied ✅', 'success');
        }).catch(() => showToast(p.email, 'info'));
    } else if (type === 'linkedin' || type === 'github') {
        const url = safeUrl(p[type]);
        if (url) window.open(url, '_blank', 'noopener');
    }
}

export function sendMailto() {
    const p       = state.appData.profile;
    const subject = encodeURIComponent(document.getElementById('contact-subject')?.value || '');
    const body    = encodeURIComponent(document.getElementById('contact-message')?.value || '');
    if (!subject && !body) {
        showToast(state.currentLang === 'ar' ? 'يرجى كتابة موضوع أو رسالة' : 'Please enter a subject or message', 'error');
        return;
    }
    window.location.href = `mailto:${p?.email || 'osamafcv214@gmail.com'}?subject=${subject}&body=${body}`;
}

export function updateCharCounter(el) {
    const counter = document.getElementById('char-counter');
    if (counter) counter.textContent = `${el.value.length} / 2000`;
    if (el.value.length > 2000) el.value = el.value.substring(0, 2000);
}

export function checkLinkedInReferrer() {
    if (document.referrer && document.referrer.includes('linkedin.com')) {
        setTimeout(() => showToast(
            state.currentLang === 'ar' ? 'مرحباً، يبدو أنك قادم من LinkedIn 👋' : 'Welcome from LinkedIn! 👋', 'info'
        ), 700);
    }
}

export function setupSecretTrigger() {
    document.getElementById('secret-trigger').addEventListener('click', () => {
        clickCount++;
        if (clickCount >= 3) { document.getElementById('admin-modal').classList.remove('hidden'); clickCount = 0; }
    });
}

export function initTheme() {
    const btn = document.getElementById('theme-btn');
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
    btn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        initParticles();
    });
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Decorative background: fetched after start-up (SRI-checked) and skipped for reduced motion.
export function initParticles() {
    if (prefersReducedMotion()) return;
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

export function setupCmdPalette() {
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('cmd-palette').classList.remove('hidden');
            document.getElementById('cmd-input').focus();
            renderCmdItems();
        }
        if (e.key === 'Escape') document.getElementById('cmd-palette').classList.add('hidden');
    });
}

let cmdItems = [];

function renderCmdItems() {
    cmdItems = [
        { icon: 'fa-home',      text: 'الرئيسية / Home',        action: () => showPage('home') },
        { icon: 'fa-id-card',   text: 'السيرة الذاتية / Resume', action: () => showPage('resume') },
        { icon: 'fa-briefcase', text: 'الأعمال / Portfolio',     action: () => showPage('portfolio') },
        { icon: 'fa-envelope',  text: 'تواصل / Contact',         action: () => showPage('contact') },
        { icon: 'fa-file-pdf',  text: 'تحميل PDF',               action: generatePDF },
        { icon: 'fa-print',     text: 'طباعة / Print',           action: triggerPrint },
        { icon: 'fa-share-alt', text: 'مشاركة / Share',          action: shareProfile },
        { icon: 'fa-language',  text: 'تبديل اللغة / Language',  action: toggleLanguage },
        { icon: 'fa-moon',      text: 'الوضع الليلي / Theme',    action: () => document.getElementById('theme-btn').click() }
    ];
    document.getElementById('cmd-list').innerHTML = cmdItems.map((item, i) => `
        <div class="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex gap-3 items-center rounded transition"
             data-action="run-command" data-index="${i}" role="button" tabindex="0">
            <i class="fas ${item.icon} text-primary w-4"></i>
            <span class="font-bold dark:text-white text-sm">${item.text}</span>
        </div>
    `).join('');
}

export function runCommand(index) {
    document.getElementById('cmd-palette').classList.add('hidden');
    cmdItems[index]?.action();
}

export function filterCmd(val) {
    document.querySelectorAll('#cmd-list > div').forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(val.toLowerCase()) ? 'flex' : 'none';
    });
}
