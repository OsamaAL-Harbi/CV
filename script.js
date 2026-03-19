/**
 * OSAMA PORTFOLIO — script.js  v2.0
 * =========================================================
 * Features: SPA | AR/EN | Admin CRUD | GitHub Sync | PWA
 *           PDF Export | Print Mode | Stats Counter
 *           Skill Progress Bars | Project Modal
 *           Share API | Project View Counter | LinkedIn Referrer
 * =========================================================
 */

// =========================================================
// 1. GLOBALS
// =========================================================
let appData     = {};
let githubInfo  = { token: '', repo: '' };
let currentLang = localStorage.getItem('lang') || 'ar';
let isAdmin     = false;
let clickCount  = 0;
let activeSkillTab = 'hard';  // current skills tab

const SESSION_DURATION   = 60 * 60 * 1000;
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xqarljpg";

// =========================================================
// 2. BOOT
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    AOS.init({ duration: 800, once: true });

    if (document.getElementById('year')) {
        document.getElementById('year').textContent = new Date().getFullYear();
    }

    setDirection();
    loadContent();
    initTheme();
    initParticles();
    setupSecretTrigger();
    checkSession();
    setupCmdPalette();
    setupKonamiCode();
    registerPWA();
    setupScrollTop();
    checkLinkedInReferrer();   // Feature 10
    initStatsObserver();       // Feature 6

    if (localStorage.getItem('saved_repo')) {
        document.getElementById('repo-input').value  = localStorage.getItem('saved_repo');
        document.getElementById('token-input').value = localStorage.getItem('saved_token');
    }
});

function registerPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('[SW] Registered'))
            .catch(err => console.log('[SW] Failed:', err));
    }
}

// =========================================================
// 3. NAVIGATION (SPA)
// =========================================================
function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('nav-active'));
    const navBtn = document.getElementById(`nav-${pageId}`);
    if (navBtn) navBtn.classList.add('nav-active');

    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && mobileMenu.classList.contains('open')) toggleMobileMenu();
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('closed');
    menu.classList.toggle('open');
}

function setupScrollTop() {
    window.addEventListener('scroll', () => {
        const btn = document.getElementById('scrollTopBtn');
        if (window.scrollY > 300) { btn.classList.add('show'); btn.classList.remove('translate-y-10'); }
        else { btn.classList.remove('show'); btn.classList.add('translate-y-10'); }
    });
}

// =========================================================
// 4. LOCALISATION
// =========================================================
function t(data) {
    if (data === null || data === undefined) return '';
    if (typeof data === 'object') return data[currentLang] || data.ar || '';
    return String(data);
}

function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('lang', currentLang);
    setDirection();
    renderAll();
    updateStaticText();
}

function setDirection() {
    document.documentElement.dir  = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
    const btn = document.getElementById('lang-btn');
    if (btn) btn.textContent = currentLang === 'ar' ? 'EN' : 'عربي';
}

const STATIC_TEXT = {
    ar: {
        nav_home:'الرئيسية', nav_resume:'السيرة الذاتية', nav_portfolio:'الأعمال', nav_contact:'تواصل',
        btn_projects:'أعمالي', btn_save:'حفظ', btn_email:'إرسال',
        btn_download_cv:'تحميل PDF', btn_share:'مشاركة', btn_print:'طباعة',
        sec_resume:'السيرة الذاتية', sec_exp:'الخبرات', sec_edu:'التعليم',
        sec_volunteer:'التطوع', sec_skills:'المهارات', sec_certs:'الشهادات',
        sec_workshops:'ورش العمل', sec_languages:'اللغات', sec_projects:'معرض المشاريع',
        contact_title:'راسلني',
        tab_hard:'تقنية', tab_soft:'شخصية',
        stat_certs:'شهادات مهنية', stat_volunteer:'ساعة تطوع',
        stat_projects:'مشروع تخرج', stat_graduation:'سنة التخرج'
    },
    en: {
        nav_home:'Home', nav_resume:'Resume', nav_portfolio:'Portfolio', nav_contact:'Contact',
        btn_projects:'My Work', btn_save:'Save', btn_email:'Send',
        btn_download_cv:'Download PDF', btn_share:'Share', btn_print:'Print',
        sec_resume:'Resume', sec_exp:'Experience', sec_edu:'Education',
        sec_volunteer:'Volunteer', sec_skills:'Skills', sec_certs:'Certificates',
        sec_workshops:'Workshops', sec_languages:'Languages', sec_projects:'Portfolio',
        contact_title:'Get in Touch',
        tab_hard:'Technical', tab_soft:'Soft Skills',
        stat_certs:'Certifications', stat_volunteer:'Volunteer Hours',
        stat_projects:'Graduation Project', stat_graduation:'Graduation Year'
    }
};

function updateStaticText() {
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (STATIC_TEXT[currentLang][key]) el.innerText = STATIC_TEXT[currentLang][key];
    });
}

// =========================================================
// 5. DATA LOADING
// =========================================================
async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if (!res.ok) throw new Error('data.json not found');
        appData = await res.json();
        renderAll();
        updateStaticText();
        setSmartGreeting();
        setTimeout(() => document.getElementById('loading-screen').classList.add('hidden'), 500);
    } catch (err) {
        showToast('خطأ في تحميل البيانات / Error loading data', 'error');
        document.getElementById('loading-screen').classList.add('hidden');
    }
}

// =========================================================
// 6. RENDER ENGINE
// =========================================================
function renderAll() {
    renderProfile();
    renderSection('experience',   appData.experience   || [], renderExperienceItem, 'relative group mb-8');
    renderSection('education',    appData.education    || [], renderEducationItem,  'relative group mb-6');
    renderSection('volunteer',    appData.volunteer    || [], renderVolunteerItem,  'relative group mb-6');
    renderSkillsWithProgress(activeSkillTab);
    renderSection('certificates', appData.certificates || [], renderCertItem,      'flex items-center gap-4 bg-white dark:bg-cardBg p-4 rounded-xl border dark:border-gray-700 shadow-sm hover:shadow-md transition');
    renderSection('workshops',    appData.workshops    || [], renderWorkshopItem,   'bg-white dark:bg-cardBg p-4 rounded-xl border dark:border-gray-700 shadow-sm');
    renderSection('projects',     appData.projects     || [], renderProjectItem,    'bg-white dark:bg-cardBg rounded-2xl border dark:border-gray-700 overflow-hidden flex flex-col h-full shadow-sm hover:shadow-2xl transition duration-300 transform hover:-translate-y-1');
    renderLanguages();
    updatePrintHeader();
    if (isAdmin) initSortable();
}

// --- Profile ---
function renderProfile() {
    const p = appData.profile;
    if (!p) return;
    updateText('profile.name',    t(p.name));
    updateText('profile.summary', t(p.summary));

    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(t(p.name))}&background=0D8ABC&color=fff&size=200`;
    const imgEl = document.getElementById('profile-img');
    if (imgEl) { imgEl.src = p.image || fallback; imgEl.onerror = () => { imgEl.src = fallback; }; }

    typeWriter(t(p.title), 'typewriter');

    const locEl = document.getElementById('profile-location');
    if (locEl) locEl.textContent = t(p.location);

    const emailDisplay = document.getElementById('contact-email-display');
    if (emailDisplay) emailDisplay.textContent = p.email;
    const locDisplay = document.getElementById('contact-location-display');
    if (locDisplay) locDisplay.textContent = t(p.location);

    const linkedin = document.getElementById('social-linkedin');
    if (linkedin) linkedin.href = p.linkedin || '#';
    const github = document.getElementById('social-github');
    if (github) github.href = p.github || '#';
}

// --- Generic section renderer ---
function renderSection(type, data, contentFn, wrapperClass) {
    const container = document.getElementById(`${type}-container`);
    if (!container) return;
    container.innerHTML = data.map((item, i) => `
        <div class="${wrapperClass} sortable-item" data-id="${i}">
            ${renderAdminButtons(type, i)}
            ${['experience','education','volunteer'].includes(type)
                ? `<div class="absolute -right-[39px] ltr:-left-[39px] top-1 w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-darkBg z-10 group-hover:scale-125 transition"></div>`
                : ''}
            ${contentFn(item, i)}
        </div>
    `).join('');
}

// --- Item renderers ---
function renderExperienceItem(item) {
    return `
        <h3 class="text-xl font-bold dark:text-white hover:text-primary transition">${t(item.role)}</h3>
        <p class="text-primary font-medium text-sm">${t(item.company)}</p>
        <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs mb-3 font-bold">${t(item.period)}</span>
        <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${t(item.description)}</p>
    `;
}

function renderEducationItem(item) {
    return `
        <h3 class="text-xl font-bold dark:text-white hover:text-blue-500 transition">${t(item.degree)}</h3>
        <p class="text-blue-500 font-medium text-sm">${t(item.institution)}</p>
        <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs mb-3 font-bold">${t(item.period)}</span>
        <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${t(item.description)}</p>
    `;
}

function renderVolunteerItem(item) {
    return `
        <h3 class="text-xl font-bold dark:text-white hover:text-orange-500 transition">${t(item.role)}</h3>
        <p class="text-orange-500 font-medium text-sm">${t(item.organization)}</p>
        <div class="flex flex-wrap gap-2 mb-3">
            <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs font-bold">${t(item.period)}</span>
            ${item.hours ? `<span class="inline-block bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded text-xs font-bold">${item.hours} ${currentLang === 'ar' ? 'ساعة' : 'hrs'}</span>` : ''}
        </div>
        <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${t(item.description)}</p>
    `;
}

function renderCertItem(item) {
    return `
        <div class="text-2xl text-secondary flex-shrink-0"><i class="fas fa-certificate"></i></div>
        <div class="w-full">
            <h4 class="font-bold text-sm dark:text-white">${t(item.name)}</h4>
            <p class="text-xs text-gray-500 mt-1">${t(item.issuer)}${item.credential ? ` · ${item.credential}` : ''}</p>
            ${item.date ? `<p class="text-xs text-gray-400 mt-0.5">${item.date}</p>` : ''}
        </div>
    `;
}

function renderWorkshopItem(item) {
    return `
        <div class="flex items-start gap-3">
            <div class="text-yellow-500 mt-1 flex-shrink-0"><i class="fas fa-chalkboard-teacher"></i></div>
            <div>
                <h4 class="font-bold text-sm dark:text-white">${t(item.name)}</h4>
                <p class="text-xs text-gray-500 mt-1">${t(item.organizer)}</p>
                <p class="text-xs text-gray-400 mt-0.5">${t(item.date)}</p>
            </div>
        </div>
    `;
}

// --- Project Card (with view counter badge) ---
function renderProjectItem(item, i) {
    // Always read fresh from sessionStorage so badge updates after openProjectModal
    const views     = JSON.parse(sessionStorage.getItem('project_views') || '{}');
    const count     = views[i] || 0;
    const viewLabel = count === 1
        ? (currentLang === 'ar' ? 'مشاهدة' : 'view')
        : (currentLang === 'ar' ? 'مشاهدة' : 'views');

    return `
        <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center relative overflow-hidden group cursor-pointer" onclick="openProjectModal(${i})">
            <i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500"></i>
            <div class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 backdrop-blur-sm">
                <span class="px-6 py-2 bg-white text-gray-900 rounded-full font-bold transform translate-y-4 group-hover:translate-y-0 transition duration-300 shadow-xl">
                    ${currentLang === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                </span>
            </div>
            ${count > 0 ? `
                <span class="absolute top-3 right-3 ltr:left-3 ltr:right-auto bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <i class="fas fa-eye text-[10px]"></i> ${count} ${viewLabel}
                </span>` : ''}
        </div>
        <div class="p-6 flex-grow">
            <h3 class="text-lg font-bold mb-2">${t(item.title)}</h3>
            <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-4">${t(item.desc)}</p>
            ${item.technologies && item.technologies.length ? `
                <div class="flex flex-wrap gap-1.5">
                    ${item.technologies.map(tech => `<span class="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded font-bold">${tech}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

// --- Languages (with full admin support) ---
function renderLanguageItem(item, i) {
    return `
        <i class="fas fa-language text-teal-500 text-lg flex-shrink-0 mt-0.5"></i>
        <div>
            <p class="font-bold text-sm dark:text-white">${t(item.name)}</p>
            <p class="text-xs text-gray-500">${t(item.level)}</p>
        </div>
    `;
}

function renderLanguages() {
    renderSection(
        'languages',
        appData.languages || [],
        renderLanguageItem,
        'relative group flex items-center gap-3 bg-white dark:bg-cardBg px-4 py-3 rounded-xl border dark:border-gray-700 shadow-sm hover:shadow-md transition'
    );
}

// --- Print Header (for @media print) ---
function updatePrintHeader() {
    const p = appData.profile;
    if (!p) return;
    const nameEl = document.getElementById('print-name');
    if (nameEl) nameEl.textContent = t(p.name);
    const contactEl = document.getElementById('print-contact');
    if (contactEl) contactEl.textContent = `${p.email} · ${p.phone} · ${t(p.location)}`;
}

// =========================================================
// 7. FEATURE: SKILL PROGRESS BARS
// =========================================================
let skillBarsAnimated = false;

function setSkillTab(tab) {
    activeSkillTab = tab;
    // Update tab button styles
    const tabHard = document.getElementById('tab-hard');
    const tabSoft = document.getElementById('tab-soft');
    if (tabHard && tabSoft) {
        const activeClass   = ['bg-primary', 'text-white'];
        const inactiveClass = ['bg-gray-100', 'dark:bg-gray-800', 'text-gray-600', 'dark:text-gray-300'];
        if (tab === 'hard') {
            activeClass.forEach(c => tabHard.classList.add(c));
            inactiveClass.forEach(c => { tabHard.classList.remove(c); tabSoft.classList.add(c); });
            activeClass.forEach(c => tabSoft.classList.remove(c));
        } else {
            activeClass.forEach(c => tabSoft.classList.add(c));
            inactiveClass.forEach(c => { tabSoft.classList.remove(c); tabHard.classList.add(c); });
            activeClass.forEach(c => tabHard.classList.remove(c));
        }
    }
    skillBarsAnimated = false;
    renderSkillsWithProgress(tab);
}

function renderSkillsWithProgress(tab = 'hard') {
    const container = document.getElementById('skills-container');
    if (!container) return;

    const filtered = (appData.skills || []).filter(s => s.category === tab);

    const barColor = tab === 'hard'
        ? 'bg-gradient-to-r from-primary to-blue-400'
        : 'bg-gradient-to-r from-secondary to-pink-400';

    container.innerHTML = filtered.map((skill, i) => `
        <div class="skill-item relative group${isAdmin ? ' sortable-item' : ''}" data-id="${i}">
            ${isAdmin ? renderAdminButtons('skills', (appData.skills || []).indexOf(skill)) : ''}
            <div class="flex justify-between items-center mb-1">
                <span class="text-sm font-bold dark:text-white">${t(skill)}</span>
                <span class="text-xs font-bold text-gray-500">${skill.level || 0}%</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div class="skill-bar-fill h-2.5 rounded-full ${barColor}"
                     style="--target-width: ${skill.level || 0}%"></div>
            </div>
        </div>
    `).join('');

    // Trigger animation after a short delay
    setTimeout(() => animateSkillBars(), 100);
}

function animateSkillBars() {
    const bars = document.querySelectorAll('.skill-bar-fill');
    bars.forEach(bar => bar.classList.add('animate'));
    skillBarsAnimated = true;
}

// Observe skills container to animate on scroll into view
function initSkillsObserver() {
    const container = document.getElementById('skills-container');
    if (!container || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !skillBarsAnimated) animateSkillBars();
        });
    }, { threshold: 0.2 });
    observer.observe(container);
}

// =========================================================
// 8. FEATURE: STATS COUNTER ANIMATION
// =========================================================
function initStatsObserver() {
    const statsSection = document.getElementById('stats-section');
    if (!statsSection || !window.IntersectionObserver) return;

    let animated = false;
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !animated) {
                animated = true;
                animateCounters();
            }
        });
    }, { threshold: 0.3 });
    observer.observe(statsSection);
}

function animateCounters() {
    document.querySelectorAll('.stat-number').forEach(el => {
        const target   = parseInt(el.getAttribute('data-target'), 10);
        const duration = target > 100 ? 1800 : 1200;
        const step     = Math.ceil(target / (duration / 16));
        let current    = 0;
        const timer    = setInterval(() => {
            current = Math.min(current + step, target);
            el.textContent = current.toLocaleString();
            if (current >= target) clearInterval(timer);
        }, 16);
    });
}

// =========================================================
// 9. FEATURE: PROJECT MODAL + VIEW COUNTER
// =========================================================
function openProjectModal(index) {
    const item = (appData.projects || [])[index];
    if (!item) return;

    // Increment view counter in sessionStorage (session-based, resets on tab close)
    const views = JSON.parse(sessionStorage.getItem('project_views') || '{}');
    views[index] = (views[index] || 0) + 1;
    sessionStorage.setItem('project_views', JSON.stringify(views));

    // Populate modal
    document.getElementById('modal-title').textContent = t(item.title);
    document.getElementById('modal-desc').textContent  = t(item.desc);

    const viewCount = document.getElementById('modal-views-count');
    if (viewCount) {
        const viewLabel = currentLang === 'ar' ? 'مشاهدة' : (views[index] === 1 ? 'view' : 'views');
        viewCount.textContent = `${views[index]} ${viewLabel}`;
    }

    // Technologies
    const techContainer = document.getElementById('modal-technologies');
    if (techContainer && item.technologies) {
        techContainer.innerHTML = item.technologies.map(tech =>
            `<span class="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full font-bold">${tech}</span>`
        ).join('');
    }
    const techSection = document.getElementById('modal-tech-section');
    if (techSection) techSection.style.display = (item.technologies && item.technologies.length) ? 'block' : 'none';

    // Challenges & Results labels
    document.getElementById('modal-tech-label').textContent        = currentLang === 'ar' ? 'التقنيات المستخدمة' : 'Technologies Used';
    document.getElementById('modal-challenges-label').textContent  = currentLang === 'ar' ? 'التحديات'            : 'Challenges';
    document.getElementById('modal-results-label').textContent     = currentLang === 'ar' ? 'النتائج والإنجازات'  : 'Results & Achievements';
    document.getElementById('modal-link-label').textContent        = currentLang === 'ar' ? 'عرض المشروع'          : 'View Project';

    document.getElementById('modal-challenges').textContent = item.details ? t(item.details.challenges) : '';
    document.getElementById('modal-results').textContent    = item.details ? t(item.details.results)    : '';

    // Link
    const linkSection = document.getElementById('modal-link-section');
    const linkEl      = document.getElementById('modal-link');
    if (item.link && item.link !== '#') {
        linkEl.href = item.link;
        linkSection.style.display = 'block';
    } else {
        linkSection.style.display = 'none';
    }

    // Re-render project cards to update view badge (reads fresh sessionStorage)
    renderSection('projects', appData.projects || [], renderProjectItem,
        'bg-white dark:bg-cardBg rounded-2xl border dark:border-gray-700 overflow-hidden flex flex-col h-full shadow-sm hover:shadow-2xl transition duration-300 transform hover:-translate-y-1');

    // Show modal
    const modal = document.getElementById('project-modal');
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeProjectModal(event) {
    // Close only if clicking overlay or close button (not the modal box itself)
    if (event && event.target !== document.getElementById('project-modal')) return;
    _closeProjectModal();
}

function _closeProjectModal() {
    document.getElementById('project-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

// ESC key closes modal
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') _closeProjectModal();
});

// =========================================================
// 10. FEATURE: PDF GENERATION (html2canvas + jsPDF)
// =========================================================
async function generatePDF() {
    showToast(currentLang === 'ar' ? 'جاري إنشاء PDF...' : 'Generating PDF...', 'info');

    // Make resume visible for capture
    const wasActive = document.getElementById('resume').classList.contains('active');
    if (!wasActive) {
        document.getElementById('resume').style.display = 'block';
        document.getElementById('resume').classList.add('active');
    }

    // Wait for render
    await new Promise(r => setTimeout(r, 600));

    try {
        const { jsPDF } = window.jspdf;
        const element = document.getElementById('resume');

        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: document.documentElement.classList.contains('dark') ? '#0b1120' : '#ffffff',
            logging: false,
            windowWidth: 1200
        });

        const imgData  = canvas.toDataURL('image/jpeg', 0.92);
        const pdf      = new jsPDF('p', 'mm', 'a4');
        const pageW    = pdf.internal.pageSize.getWidth();
        const pageH    = pdf.internal.pageSize.getHeight();
        const imgW     = pageW;
        const imgH     = (canvas.height * imgW) / canvas.width;

        let position  = 0;
        let heightLeft = imgH;

        pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
        heightLeft -= pageH;

        while (heightLeft > 0) {
            position -= pageH;
            pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, position, imgW, imgH);
            heightLeft -= pageH;
        }

        const name = t(appData.profile?.name || { ar: 'Osama', en: 'Osama' }).replace(/\s+/g, '_');
        pdf.save(`${name}_CV.pdf`);
        showToast(currentLang === 'ar' ? 'تم تحميل PDF بنجاح ✅' : 'PDF downloaded ✅', 'success');
    } catch (err) {
        console.error(err);
        showToast(currentLang === 'ar' ? 'فشل إنشاء PDF' : 'PDF generation failed', 'error');
    } finally {
        // Restore previous state
        if (!wasActive) {
            document.getElementById('resume').classList.remove('active');
            document.getElementById('resume').style.display = 'none';
        }
    }
}

// =========================================================
// 11. FEATURE: PRINT MODE
// =========================================================
function triggerPrint() {
    // Ensure resume page is shown before printing
    showPage('resume');
    setTimeout(() => window.print(), 400);
}

// =========================================================
// 12. FEATURE: SHARE PROFILE
// =========================================================
async function shareProfile() {
    const name    = t(appData.profile?.name || { ar: 'أسامة الحربي', en: 'Osama Al-Harbi' });
    const summary = t(appData.profile?.summary || {});
    const url     = window.location.href;

    if (navigator.share) {
        try {
            await navigator.share({
                title: name,
                text:  summary.substring(0, 120) + '...',
                url
            });
        } catch (e) {
            if (e.name !== 'AbortError') copyToClipboard(url);
        }
    } else {
        copyToClipboard(url);
    }
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast(currentLang === 'ar' ? 'تم نسخ الرابط ✅' : 'Link copied ✅', 'success');
    } catch {
        showToast(currentLang === 'ar' ? 'تعذّر النسخ' : 'Copy failed', 'error');
    }
}

// =========================================================
// 13. FEATURE: LINKEDIN REFERRER DETECTION
// =========================================================
function checkLinkedInReferrer() {
    if (document.referrer && document.referrer.includes('linkedin.com')) {
        setTimeout(() => {
            showToast(
                currentLang === 'ar'
                    ? 'مرحباً، يبدو أنك قادم من LinkedIn 👋'
                    : 'Welcome from LinkedIn! 👋',
                'info'
            );
        }, 2000);
    }
}

// =========================================================
// 14. ADMIN BUTTONS
// =========================================================
function renderAdminButtons(type, index) {
    if (!isAdmin) return '';
    return `
        <div class="admin-element absolute top-2 left-2 ltr:right-2 ltr:left-auto z-20 gap-2 opacity-0 group-hover:opacity-100 transition flex items-center">
            <span class="drag-handle bg-gray-200 dark:bg-gray-700 text-gray-500 w-7 h-7 rounded shadow flex items-center justify-center hover:bg-gray-300 cursor-move">
                <i class="fas fa-grip-vertical text-[10px]"></i>
            </span>
            <button onclick="manageItem('${type}', ${index})" class="bg-blue-500 text-white w-7 h-7 rounded shadow flex items-center justify-center hover:scale-110 transition">
                <i class="fas fa-pen text-[10px]"></i>
            </button>
            <button onclick="deleteItem('${type}', ${index})" class="bg-red-500 text-white w-7 h-7 rounded shadow flex items-center justify-center hover:scale-110 transition">
                <i class="fas fa-trash text-[10px]"></i>
            </button>
        </div>
    `;
}

// =========================================================
// 15. ADMIN CRUD
// =========================================================
const SCHEMAS = {
    skills: [
        { key: 'ar',    label: 'اسم المهارة (عربي)',    simple: true },
        { key: 'en',    label: 'Skill Name (English)',  simple: true },
        { key: 'level', label: 'المستوى % (0-100)',     simple: true },
        { key: 'category', label: 'النوع (hard/soft)',  simple: true }
    ],
    experience: [
        { key: 'role',        label: 'المسمى الوظيفي / Role' },
        { key: 'company',     label: 'الشركة / Company' },
        { key: 'period',      label: 'الفترة / Period' },
        { key: 'description', label: 'الوصف / Description', type: 'textarea' }
    ],
    education: [
        { key: 'degree',      label: 'الدرجة العلمية / Degree' },
        { key: 'institution', label: 'المؤسسة / Institution' },
        { key: 'period',      label: 'التاريخ / Date' },
        { key: 'description', label: 'الوصف / Description', type: 'textarea' }
    ],
    volunteer: [
        { key: 'role',         label: 'الدور / Role' },
        { key: 'organization', label: 'المنظمة / Organization' },
        { key: 'period',       label: 'الفترة / Period' },
        { key: 'hours',        label: 'الساعات / Hours', simple: true },
        { key: 'description',  label: 'الوصف / Description', type: 'textarea' }
    ],
    projects: [
        { key: 'title', label: 'العنوان / Title' },
        { key: 'desc',  label: 'الوصف / Description', type: 'textarea' },
        { key: 'link',  label: 'الرابط / Link', simple: true }
    ],
    certificates: [
        { key: 'name',       label: 'اسم الشهادة / Name' },
        { key: 'issuer',     label: 'الجهة / Issuer' },
        { key: 'credential', label: 'Credential ID', simple: true },
        { key: 'date',       label: 'التاريخ / Date', simple: true }
    ],
    workshops: [
        { key: 'name',      label: 'اسم الورشة / Name' },
        { key: 'organizer', label: 'الجهة / Organizer' },
        { key: 'date',      label: 'التاريخ / Date' }
    ],
    languages: [
        { key: 'name',  label: 'اللغة / Language' },
        { key: 'level', label: 'المستوى / Level' }
    ]
};

async function manageItem(type, index = null) {
    if (!isAdmin) return;
    const isEdit = index !== null;
    const item   = isEdit ? (appData[type] || [])[index] : {};
    const schema = SCHEMAS[type];
    if (!schema) return;

    const getVal = (obj, key, lang) => {
        if (!obj[key]) return '';
        if (typeof obj[key] === 'object') return obj[key][lang] || '';
        return obj[key];
    };

    const html = schema.map(f => {
        if (f.simple) {
            const val = isEdit ? (item[f.key] || '') : '';
            return `<div class="mb-3">
                <label class="block text-xs mb-1 text-gray-500 text-right">${f.label}</label>
                <input id="swal-${f.key}" class="swal2-input m-0 w-full" value="${val}" dir="ltr">
            </div>`;
        }
        const valAr = getVal(item, f.key, 'ar');
        const valEn = getVal(item, f.key, 'en');
        if (f.type === 'textarea') {
            return `<div class="grid grid-cols-2 gap-2 mb-3">
                <div><label class="block text-xs mb-1 text-gray-500 text-right">${f.label} (AR)</label>
                <textarea id="swal-${f.key}-ar" class="swal2-textarea m-0 w-full h-24 text-right" dir="rtl">${valAr}</textarea></div>
                <div><label class="block text-xs mb-1 text-gray-500 text-left">${f.label} (EN)</label>
                <textarea id="swal-${f.key}-en" class="swal2-textarea m-0 w-full h-24 text-left" dir="ltr">${valEn}</textarea></div>
            </div>`;
        }
        return `<div class="grid grid-cols-2 gap-2 mb-3">
            <div><label class="block text-xs mb-1 text-gray-500 text-right">${f.label} (AR)</label>
            <input id="swal-${f.key}-ar" class="swal2-input m-0 w-full text-right" value="${valAr}" dir="rtl"></div>
            <div><label class="block text-xs mb-1 text-gray-500 text-left">${f.label} (EN)</label>
            <input id="swal-${f.key}-en" class="swal2-input m-0 w-full text-left" value="${valEn}" dir="ltr"></div>
        </div>`;
    }).join('');

    const { value } = await Swal.fire({
        title: isEdit ? 'تعديل' : 'إضافة جديدة',
        html: `<div class="text-right" dir="rtl">${html}</div>`,
        width: '700px', confirmButtonText: 'حفظ',
        showCancelButton: true, cancelButtonText: 'إلغاء',
        focusConfirm: false,
        preConfirm: () => {
            const obj = {};
            schema.forEach(f => {
                if (f.simple) obj[f.key] = document.getElementById(`swal-${f.key}`).value;
                else obj[f.key] = { ar: document.getElementById(`swal-${f.key}-ar`).value, en: document.getElementById(`swal-${f.key}-en`).value };
            });
            return obj;
        }
    });

    if (value) {
        if (!appData[type]) appData[type] = [];
        if (isEdit) appData[type][index] = value; else appData[type].push(value);
        renderAll();
        showToast(isEdit ? 'تم التعديل' : 'تمت الإضافة', 'success');
    }
}

function addItem(type)         { manageItem(type); }
function editItem(type, index) { manageItem(type, index); }

function deleteItem(type, index) {
    if (!isAdmin) return;
    Swal.fire({
        title: 'هل أنت متأكد؟', text: 'لن تتمكن من التراجع!', icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33',
        confirmButtonText: 'نعم، احذف', cancelButtonText: 'تراجع'
    }).then(result => {
        if (result.isConfirmed) {
            appData[type].splice(index, 1);
            renderAll();
            showToast('تم الحذف', 'success');
        }
    });
}

// =========================================================
// 16. DRAG & DROP (Sortable)
// =========================================================
function initSortable() {
    ['experience','education','volunteer','skills','certificates','workshops','projects','languages'].forEach(type => {
        const el = document.getElementById(`${type}-container`);
        if (!el) return;
        new Sortable(el, {
            animation: 150, handle: '.drag-handle', ghostClass: 'bg-blue-100',
            onEnd(evt) {
                const moved = appData[type].splice(evt.oldIndex, 1)[0];
                appData[type].splice(evt.newIndex, 0, moved);
                renderAll();
            }
        });
    });
}

// =========================================================
// 17. INLINE EDITING
// =========================================================
function updateText(key, value) {
    const el = document.querySelector(`[data-path="${key}"]`);
    if (!el) return;
    el.innerText = value;
    if (isAdmin) {
        el.contentEditable = 'true';
        el.classList.add('editable-active');
        el.onblur = () => {
            const parts = key.split('.');
            let obj = appData;
            for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
            const last = parts[parts.length - 1];
            if (typeof obj[last] === 'object') obj[last][currentLang] = el.innerText;
            else obj[last] = el.innerText;
        };
    }
}

async function editImage(key) {
    if (!isAdmin) return;
    const { value } = await Swal.fire({
        title: 'تغيير الصورة', input: 'url',
        inputLabel: 'رابط الصورة (Imgur, GitHub, Drive)',
        inputPlaceholder: 'https://...'
    });
    if (value) { setDeepValue(appData, key, value); renderAll(); }
}

// =========================================================
// 18. AUTH & GITHUB SYNC
// =========================================================
function checkSession() {
    const loginTime = localStorage.getItem('login_time');
    if (localStorage.getItem('saved_token')) {
        if (loginTime && (Date.now() - loginTime > SESSION_DURATION)) {
            logout();
            showToast('انتهت الجلسة، يرجى تسجيل الدخول مجدداً', 'error');
        } else {
            githubInfo.repo  = localStorage.getItem('saved_repo');
            githubInfo.token = localStorage.getItem('saved_token');
            enableAdminMode();
        }
    }
}

function setupSecretTrigger() {
    document.getElementById('secret-trigger').addEventListener('click', () => {
        clickCount++;
        if (clickCount >= 3) {
            document.getElementById('admin-modal').classList.remove('hidden');
            clickCount = 0;
        }
    });
}

function authenticateAndEdit() {
    const repo  = document.getElementById('repo-input').value.trim();
    const token = document.getElementById('token-input').value.trim();
    if (!repo || !token) return showToast('يرجى إدخال البيانات كاملة', 'error');
    localStorage.setItem('saved_repo',  repo);
    localStorage.setItem('saved_token', token);
    localStorage.setItem('login_time',  Date.now());
    githubInfo.repo  = repo;
    githubInfo.token = token;
    document.getElementById('admin-modal').classList.add('hidden');
    enableAdminMode();
    showToast('تم تفعيل وضع المدير 🚀', 'success');
}

function enableAdminMode() {
    isAdmin = true;
    document.body.classList.add('admin-mode');
    document.getElementById('admin-toolbar').classList.remove('hidden');
    renderAll();
    initSkillsObserver();
}

function logout() {
    ['saved_repo','saved_token','login_time'].forEach(k => localStorage.removeItem(k));
    location.reload();
}

async function saveToGitHub() {
    const saveBtn  = document.querySelector('#admin-toolbar button');
    const origHTML = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    localStorage.setItem('backup_data', JSON.stringify(appData));
    try {
        const url    = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(url, { headers: { Authorization: `token ${githubInfo.token}` } });
        if (!getRes.ok) throw new Error('فشل الاتصال بـ GitHub');
        const fileData = await getRes.json();
        const content  = btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2))));
        const putRes   = await fetch(url, {
            method: 'PUT',
            headers: { Authorization: `token ${githubInfo.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Update via Admin Panel', content, sha: fileData.sha })
        });
        if (!putRes.ok) throw new Error('فشل الحفظ');
        showToast('تم الحفظ في GitHub ✅', 'success');
    } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
    } finally {
        saveBtn.innerHTML = origHTML;
    }
}

function restoreBackup() {
    const data = localStorage.getItem('backup_data');
    if (data) { appData = JSON.parse(data); renderAll(); showToast('تم استعادة النسخة الاحتياطية', 'success'); }
    else showToast('لا توجد نسخة احتياطية', 'error');
}

// =========================================================
// 19. UTILITIES
// =========================================================
function setSmartGreeting() {
    const hour = new Date().getHours();
    const msgs = {
        ar: { m: 'صباح الخير ☀️', a: 'مساء الخير 🌤️', e: 'مساء النور 🌙' },
        en: { m: 'Good Morning ☀️', a: 'Good Afternoon 🌤️', e: 'Good Evening 🌙' }
    };
    const key = hour < 12 ? 'm' : (hour < 18 ? 'a' : 'e');
    const el  = document.getElementById('smart-greeting');
    if (el) el.innerText = msgs[currentLang][key];
}

function typeWriter(text, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.innerHTML = '';
    let i = 0;
    const iv = setInterval(() => {
        el.innerHTML += text.charAt(i);
        if (++i >= text.length) clearInterval(iv);
    }, 90);
}

function initTheme() {
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

function initParticles(party = false) {
    const isDark = document.documentElement.classList.contains('dark');
    particlesJS('particles-js', {
        particles: {
            number: { value: party ? 100 : 40 },
            color:  { value: party ? ['#f00','#0f0','#00f'] : (isDark ? '#ffffff' : '#3b82f6') },
            opacity: { value: 0.3 },
            size:   { value: 3 },
            line_linked: { enable: true, distance: 150, color: isDark ? '#ffffff' : '#3b82f6', opacity: 0.1, width: 1 },
            move:   { enable: true, speed: party ? 10 : 1 }
        },
        interactivity: { detect_on: 'canvas', events: { onhover: { enable: true, mode: 'grab' } } },
        retina_detect: true
    });
}

function setupCmdPalette() {
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

function renderCmdItems() {
    const items = [
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
    document.getElementById('cmd-list').innerHTML = items.map(item => `
        <div class="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex gap-3 items-center rounded transition"
             onclick="document.getElementById('cmd-palette').classList.add('hidden'); (${item.action})()">
            <i class="fas ${item.icon} text-primary w-4"></i>
            <span class="font-bold dark:text-white text-sm">${item.text}</span>
        </div>
    `).join('');
}

function filterCmd(val) {
    document.querySelectorAll('#cmd-list > div').forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(val.toLowerCase()) ? 'flex' : 'none';
    });
}

function setupKonamiCode() {
    const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let idx = 0;
    document.addEventListener('keydown', e => {
        idx = (e.key === code[idx]) ? idx + 1 : 0;
        if (idx === code.length) { showToast('Party Mode! 🎉', 'success'); initParticles(true); idx = 0; }
    });
}

function handleContact(e) {
    e.preventDefault();
    fetch(FORMSPREE_ENDPOINT, {
        method: 'POST', body: new FormData(e.target), headers: { Accept: 'application/json' }
    }).then(res => {
        if (res.ok) { showToast('تم الإرسال بنجاح ✅', 'success'); e.target.reset(); }
        else showToast('حدث خطأ في الإرسال', 'error');
    }).catch(() => showToast('تعذّر الاتصال بالخادم', 'error'));
}

function setDeepValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
    current[keys[keys.length - 1]] = value;
}

function showToast(msg, type = 'info') {
    const colors = { success: '#10B981', error: '#EF4444', info: '#3b82f6' };
    Toastify({ text: msg, duration: 3500, gravity: 'top', position: 'center', style: { background: colors[type] || colors.info } }).showToast();
}
