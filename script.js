/**
 * OSAMA PORTFOLIO — script.js  v3.0
 * Fixes:
 *  1. relative+group on ALL section wrappers → admin buttons visible & hover works
 *  2. overflow-hidden moved off projects outer wrapper → buttons not clipped
 *  3. skills sortable uses real appData indices not filtered indices
 *  4. typeWriter clears previous interval before starting
 *  5. AOS.refresh() called after every renderAll
 *  6. sessionStorage uses stable title-based key not array index
 *  7. enableAdminMode only re-renders after appData is loaded
 */

// =========================================================
// 1. GLOBALS
// =========================================================
let appData        = {};
let githubInfo     = { token: '', repo: '' };
let currentLang    = localStorage.getItem('lang') || 'ar';
let isAdmin        = false;
let clickCount     = 0;
let activeSkillTab = 'hard';
let dataLoaded     = false;        // guard: skip admin renderAll before data loads
let twInterval     = null;         // typewriter interval handle

const SESSION_DURATION   = 60 * 60 * 1000;
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xqarljpg";

// =========================================================
// 2. BOOT
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    AOS.init({ duration: 800, once: true });

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    setDirection();
    initTheme();
    initParticles();
    setupSecretTrigger();
    setupCmdPalette();
    setupKonamiCode();
    registerPWA();
    setupScrollTop();
    checkLinkedInReferrer();
    initStatsObserver();

    if (localStorage.getItem('saved_repo')) {
        document.getElementById('repo-input').value = localStorage.getItem('saved_repo');
        // Token not pre-filled (security: user must re-enter each browser session)
    }

    // Load data FIRST, then check session so admin renderAll has real data
    loadContent().then(() => {
        checkSession();
    });
});

function registerPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
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
        setTimeout(() => { target.classList.add('active'); AOS.refresh(); }, 10);
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
        if (!btn) return;
        if (window.scrollY > 300) { btn.classList.add('show'); btn.classList.remove('translate-y-10'); }
        else                      { btn.classList.remove('show'); btn.classList.add('translate-y-10'); }
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
        contact_title:'راسلني', tab_hard:'تقنية', tab_soft:'شخصية',
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
        contact_title:'Get in Touch', tab_hard:'Technical', tab_soft:'Soft Skills',
        stat_certs:'Certifications', stat_volunteer:'Volunteer Hours',
        stat_projects:'Graduation Project', stat_graduation:'Graduation Year'
    }
};

function updateStaticText() {
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (STATIC_TEXT[currentLang]?.[key]) el.innerText = STATIC_TEXT[currentLang][key];
    });
}

// =========================================================
// 5. DATA LOADING
// =========================================================
async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if (!res.ok) throw new Error('data.json not found');
        appData    = await res.json();
        dataLoaded = true;
        renderAll();
        updateStaticText();
        setSmartGreeting();
        const loadingEl = document.getElementById('loading-screen');
        loadingEl.style.transition = 'opacity 0.6s ease';
        loadingEl.style.opacity    = '0';
        setTimeout(() => loadingEl.classList.add('hidden'), 650);
    } catch (err) {
        showToast('خطأ في تحميل البيانات / Error loading data', 'error');
        document.getElementById('loading-screen').classList.add('hidden');
    }
}

// =========================================================
// 6. RENDER ENGINE
// =========================================================

// WRAPPER CLASSES — all include 'relative group' so:
//   • admin buttons (absolute) are positioned inside the card
//   • group-hover:opacity-100 triggers on mouse enter
const WC = {
    experience:   'relative group mb-8',
    education:    'relative group mb-6',
    volunteer:    'relative group mb-6',
    // projects outer wrapper must NOT have overflow-hidden (clips admin buttons)
    // overflow-hidden is on the inner image div only
    projects:     'relative group bg-white dark:bg-cardBg rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col h-full shadow-sm hover:shadow-2xl transition duration-300 transform hover:-translate-y-1',
    certificates: 'relative group flex items-center gap-4 bg-white dark:bg-cardBg p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition',
    workshops:    'relative group bg-white dark:bg-cardBg p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition',
    languages:    'relative group flex items-center gap-3 bg-white dark:bg-cardBg px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition',
};

function renderAll() {
    renderProfile();
    renderSection('experience',   appData.experience   || [], renderExperienceItem,  WC.experience);
    renderSection('education',    appData.education    || [], renderEducationItem,   WC.education);
    renderSection('volunteer',    appData.volunteer    || [], renderVolunteerItem,   WC.volunteer);
    renderSkillsWithProgress(activeSkillTab);
    renderSection('certificates', appData.certificates || [], renderCertItem,        WC.certificates);
    renderSection('workshops',    appData.workshops    || [], renderWorkshopItem,    WC.workshops);
    renderSection('projects',     appData.projects     || [], renderProjectItem,     WC.projects);
    renderProjectFilters();
    renderSection('languages',    appData.languages    || [], renderLanguageItem,    WC.languages);
    updatePrintHeader();
    if (isAdmin) initSortable();
    // Refresh AOS so newly rendered elements animate on scroll
    setTimeout(() => AOS.refresh(), 50);
}

// ─── Profile ───────────────────────────────────────────────
function renderProfile() {
    const p = appData.profile;
    if (!p) return;

    updateText('profile.name',    t(p.name));
    updateText('profile.summary', t(p.summary));

    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(t(p.name))}&background=0D8ABC&color=fff&size=200`;
    const imgEl = document.getElementById('profile-img');
    if (imgEl) {
        imgEl.src = p.image || fallback;
        imgEl.loading = 'lazy';
        imgEl.onerror = () => { imgEl.src = fallback; };
    }

    // FIX: clear previous typewriter interval before starting a new one
    if (twInterval) { clearInterval(twInterval); twInterval = null; }
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

    // C — Update OG & Twitter meta tags dynamically
    const fullName  = t(p.name);
    const summary   = t(p.summary).substring(0, 160);
    const avatar    = p.image || 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png';
    _setMeta('og-title',       fullName + ' | Portfolio');
    _setMeta('og-description', summary);
    _setMeta('og-image',       avatar);
    _setMeta('og-locale',      currentLang === 'ar' ? 'ar_SA' : 'en_US');
    _setMeta('tw-title',       fullName + ' | Portfolio');
    _setMeta('tw-description', summary);
    document.title = fullName + ' | Portfolio';

    // A — Availability badge
    renderAvailability(p);
}

function _setMeta(id, content) {
    const el = document.getElementById(id);
    if (el) el.setAttribute('content', content);
}

// A2 — Availability badge
function renderAvailability(p) {
    const badge  = document.getElementById('availability-badge');
    const pill   = document.getElementById('availability-pill');
    const dot    = document.getElementById('availability-dot');
    const text   = document.getElementById('availability-text');
    if (!badge || !p) return;

    const available = p.available !== false; // default true if not set
    badge.classList.remove('hidden');
    badge.classList.add('flex');

    if (available) {
        pill.className  = 'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-700 transition-all';
        dot.className   = 'w-2 h-2 rounded-full bg-green-500 animate-pulse';
        text.textContent = currentLang === 'ar' ? 'متاح للعمل' : 'Open to Work';
    } else {
        pill.className  = 'inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 transition-all';
        dot.className   = 'w-2 h-2 rounded-full bg-gray-400';
        text.textContent = currentLang === 'ar' ? 'غير متاح حالياً' : 'Not Available';
    }
}

// ─── Generic section renderer ──────────────────────────────
function renderSection(type, data, contentFn, wrapperClass) {
    const container = document.getElementById(`${type}-container`);
    if (!container) return;

    const hasTimeline = ['experience', 'education', 'volunteer'].includes(type);

    container.innerHTML = data.map((item, i) => `
        <div class="${wrapperClass} sortable-item" data-index="${i}">
            ${renderAdminButtons(type, i)}
            ${hasTimeline
                ? `<div class="absolute -right-[39px] ltr:-left-[39px] ltr:right-auto top-1 w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-darkBg z-10 group-hover:scale-125 transition"></div>`
                : ''}
            ${contentFn(item, i)}
        </div>
    `).join('');
}

// ─── Item renderers ────────────────────────────────────────
function renderExperienceItem(item) {
    // Extract year from period for timeline badge
    const periodStr = t(item.period);
    const yearMatch = periodStr.match(/\d{4}/);
    const yearBadge = yearMatch ? `<span class="timeline-year">${yearMatch[0]}</span>` : '';
    return `
        ${yearBadge}
        <h3 class="text-xl font-bold dark:text-white hover:text-primary transition">${t(item.role)}</h3>
        <p class="text-primary font-medium text-sm">${t(item.company)}</p>
        <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs mb-3 font-bold">${periodStr}</span>
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
        <div class="flex-1 min-w-0">
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

// FIX: projects outer wrapper has NO overflow-hidden (moved to image div only)
function renderProjectItem(item, i) {
    // FIX: stable key = title string, not array index → survives drag-reorder
    // FIX: extract string safely before calling replace
    const _titleStr = (typeof item.title === 'object')
        ? (item.title.en || item.title.ar || String(i))
        : String(item.title || i);
    const stableKey = 'pv_' + _titleStr.replace(/[^a-zA-Z0-9؀-ۿ]/g, '_');
    const views     = JSON.parse(sessionStorage.getItem('project_views') || '{}');
    const count     = views[stableKey] || 0;
    const viewLabel = count === 1
        ? (currentLang === 'ar' ? 'مشاهدة' : 'view')
        : (currentLang === 'ar' ? 'مشاهدة' : 'views');

    return `
        <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900
                    flex items-center justify-center relative overflow-hidden rounded-t-2xl group cursor-pointer"
             onclick="openProjectModal(${i})">
            <i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500"></i>
            <div class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 backdrop-blur-sm">
                <span class="px-6 py-2 bg-white text-gray-900 rounded-full font-bold transform translate-y-4 group-hover:translate-y-0 transition duration-300 shadow-xl">
                    ${currentLang === 'ar' ? 'عرض التفاصيل' : 'View Details'}
                </span>
            </div>
            ${count > 0 ? `
                <span class="absolute top-3 right-3 ltr:left-3 ltr:right-auto bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 pointer-events-none">
                    <i class="fas fa-eye" style="font-size:10px"></i>&nbsp;${count} ${viewLabel}
                </span>` : ''}
        </div>
        <div class="p-5 flex-grow flex flex-col">
            <h3 class="text-base font-bold mb-2 dark:text-white">${t(item.title)}</h3>
            <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed flex-grow line-clamp-3">${t(item.desc)}</p>
            ${item.technologies?.length ? `
                <div class="flex flex-wrap gap-1.5 mt-3">
                    ${item.technologies.map(tech =>
                        `<span class="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-bold">${tech}</span>`
                    ).join('')}
                </div>` : ''}
        </div>
    `;
}

function renderLanguageItem(item) {
    return `
        <i class="fas fa-language text-teal-500 text-lg flex-shrink-0"></i>
        <div>
            <p class="font-bold text-sm dark:text-white">${t(item.name)}</p>
            <p class="text-xs text-gray-500">${t(item.level)}</p>
        </div>
    `;
}

// ─── A: Project Filters ────────────────────────────────
let activeFilter = 'all';

function renderProjectFilters() {
    const container = document.getElementById('project-filters');
    if (!container) return;

    // Collect all unique technologies across projects
    const allTechs = new Set();
    (appData.projects || []).forEach(p => {
        (p.technologies || []).forEach(t => allTechs.add(t));
    });

    if (allTechs.size === 0) { container.innerHTML = ''; return; }

    const allLabel = currentLang === 'ar' ? 'الكل' : 'All';
    const buttons  = [`<button onclick="filterProjects('all')"
        class="filter-btn ${activeFilter === 'all' ? 'active' : ''} px-4 py-1.5 text-xs font-bold rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-cardBg text-gray-600 dark:text-gray-300 hover:border-primary transition"
        >${allLabel}</button>`];

    [...allTechs].sort().forEach(tech => {
        buttons.push(`<button onclick="filterProjects('${tech}')"
            class="filter-btn ${activeFilter === tech ? 'active' : ''} px-4 py-1.5 text-xs font-bold rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-cardBg text-gray-600 dark:text-gray-300 hover:border-primary transition"
            >${tech}</button>`);
    });

    container.innerHTML = buttons.join('');
}

function filterProjects(tech) {
    activeFilter = tech;
    const projects  = appData.projects || [];
    const filtered  = tech === 'all'
        ? projects
        : projects.filter(p => (p.technologies || []).includes(tech));

    // Re-render only visible cards (keep real indices for modal)
    const container = document.getElementById('projects-container');
    if (!container) return;

    container.innerHTML = filtered.map(item => {
        const realIdx = projects.indexOf(item);
        return `<div class="${WC.projects} sortable-item" data-index="${realIdx}">
            ${renderAdminButtons('projects', realIdx)}
            ${renderProjectItem(item, realIdx)}
        </div>`;
    }).join('');

    // Update active state on filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === tech || (tech === 'all' && (btn.textContent.trim() === 'الكل' || btn.textContent.trim() === 'All')));
    });
}

// ─── Print header ──────────────────────────────────────────
function updatePrintHeader() {
    const p = appData.profile;
    if (!p) return;
    const nameEl = document.getElementById('print-name');
    if (nameEl) nameEl.textContent = t(p.name);
    const contactEl = document.getElementById('print-contact');
    if (contactEl) contactEl.textContent = `${p.email} · ${p.phone || ''} · ${t(p.location)}`;
}

// =========================================================
// 7. SKILL PROGRESS BARS
// =========================================================
let skillBarsAnimated = false;

function setSkillTab(tab) {
    activeSkillTab    = tab;
    skillBarsAnimated = false;

    const tabHard = document.getElementById('tab-hard');
    const tabSoft = document.getElementById('tab-soft');
    if (!tabHard || !tabSoft) return;

    if (tab === 'hard') {
        tabHard.className = 'px-4 py-1.5 text-xs font-bold rounded-full bg-primary text-white transition';
        tabSoft.className = 'px-4 py-1.5 text-xs font-bold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition';
    } else {
        tabSoft.className = 'px-4 py-1.5 text-xs font-bold rounded-full bg-primary text-white transition';
        tabHard.className = 'px-4 py-1.5 text-xs font-bold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition';
    }
    renderSkillsWithProgress(tab);
}

function renderSkillsWithProgress(tab = 'hard') {
    const container = document.getElementById('skills-container');
    if (!container) return;

    const allSkills  = appData.skills || [];
    const filtered   = allSkills.filter(s => s.category === tab);
    const barColor   = tab === 'hard'
        ? 'bg-gradient-to-r from-primary to-blue-400'
        : 'bg-gradient-to-r from-secondary to-pink-400';

    container.innerHTML = filtered.map(skill => {
        // FIX: use real index in appData.skills for admin operations
        const realIdx = allSkills.indexOf(skill);
        return `
        <div class="skill-item relative group sortable-item" data-real-index="${realIdx}">
            ${renderAdminButtons('skills', realIdx)}
            <div class="flex justify-between items-center mb-1">
                <span class="text-sm font-bold dark:text-white">${t(skill)}</span>
                <span class="text-xs font-bold text-gray-400">${skill.level || 0}%</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div class="skill-bar-fill h-2.5 rounded-full ${barColor}"
                     style="--target-width: ${skill.level || 0}%"></div>
            </div>
        </div>`;
    }).join('');

    setTimeout(() => animateSkillBars(), 80);
}

function animateSkillBars() {
    document.querySelectorAll('.skill-bar-fill').forEach(bar => bar.classList.add('animate'));
    skillBarsAnimated = true;
}

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
// 8. STATS COUNTER ANIMATION
// =========================================================
function initStatsObserver() {
    if (!window.IntersectionObserver) return;
    let animated = false;
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !animated) {
                animated = true;
                animateCounters();
            }
        });
    }, { threshold: 0.3 });
    // Observer might run before stats-section is in DOM - retry
    const tryObserve = () => {
        const el = document.getElementById('stats-section');
        if (el) observer.observe(el);
        else    setTimeout(tryObserve, 200);
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

// =========================================================
// 9. PROJECT MODAL + VIEW COUNTER
// =========================================================
function openProjectModal(index) {
    const item = (appData.projects || [])[index];
    if (!item) return;

    // FIX: use stable key based on project title, not array index
    const _titleStr2 = (typeof item.title === 'object')
        ? (item.title.en || item.title.ar || String(index))
        : String(item.title || index);
    const stableKey = 'pv_' + _titleStr2.replace(/[^a-zA-Z0-9؀-ۿ]/g, '_');
    const views     = JSON.parse(sessionStorage.getItem('project_views') || '{}');
    views[stableKey] = (views[stableKey] || 0) + 1;
    sessionStorage.setItem('project_views', JSON.stringify(views));

    const count      = views[stableKey];
    const viewLabel  = currentLang === 'ar' ? 'مشاهدة' : (count === 1 ? 'view' : 'views');

    // Populate modal fields
    document.getElementById('modal-title').textContent = t(item.title);
    document.getElementById('modal-desc').textContent  = t(item.desc);

    const viewCount = document.getElementById('modal-views-count');
    if (viewCount) viewCount.textContent = `${count} ${viewLabel}`;

    // Technologies
    const techContainer = document.getElementById('modal-technologies');
    const techSection   = document.getElementById('modal-tech-section');
    if (techContainer) {
        techContainer.innerHTML = (item.technologies || []).map(tech =>
            `<span class="text-xs px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-bold">${tech}</span>`
        ).join('');
    }
    if (techSection) techSection.style.display = item.technologies?.length ? 'block' : 'none';

    // Labels
    document.getElementById('modal-tech-label').textContent       = currentLang === 'ar' ? 'التقنيات المستخدمة' : 'Technologies Used';
    document.getElementById('modal-challenges-label').textContent = currentLang === 'ar' ? 'التحديات'           : 'Challenges';
    document.getElementById('modal-results-label').textContent    = currentLang === 'ar' ? 'النتائج والإنجازات' : 'Results & Achievements';
    document.getElementById('modal-link-label').textContent       = currentLang === 'ar' ? 'عرض المشروع'        : 'View Project';

    document.getElementById('modal-challenges').textContent = item.details ? t(item.details.challenges) : '';
    document.getElementById('modal-results').textContent    = item.details ? t(item.details.results)    : '';

    // Link
    const linkSection = document.getElementById('modal-link-section');
    const linkEl      = document.getElementById('modal-link');
    if (item.link && item.link !== '#') { linkEl.href = item.link; linkSection.style.display = 'block'; }
    else                                { linkSection.style.display = 'none'; }

    // Re-render project cards so badge updates immediately
    renderSection('projects', appData.projects || [], renderProjectItem, WC.projects);
    if (isAdmin) {
        // Re-attach sortable after innerHTML replacement
        const el = document.getElementById('projects-container');
        if (el) new Sortable(el, {
            animation: 150, handle: '.drag-handle', ghostClass: 'opacity-50',
            onEnd(evt) { reorderSection('projects', evt.oldIndex, evt.newIndex); }
        });
    }

    document.getElementById('project-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeProjectModal(event) {
    if (event && event.target !== document.getElementById('project-modal')) return;
    _closeProjectModal();
}
function _closeProjectModal() {
    document.getElementById('project-modal').classList.add('hidden');
    document.body.style.overflow = '';
}
document.addEventListener('keydown', e => {
    if (e.key === 'Escape') _closeProjectModal();
});

// =========================================================
// 10. PDF GENERATION
// =========================================================
async function generatePDF() {
    showToast(currentLang === 'ar' ? 'جاري إنشاء PDF...' : 'Generating PDF...', 'info');
    const resumeEl  = document.getElementById('resume');
    const wasActive = resumeEl.classList.contains('active');
    if (!wasActive) { resumeEl.style.display = 'block'; resumeEl.classList.add('active'); }
    await new Promise(r => setTimeout(r, 600));
    try {
        const { jsPDF } = window.jspdf;
        const canvas    = await html2canvas(resumeEl, {
            scale: 2, useCORS: true, allowTaint: true,
            backgroundColor: document.documentElement.classList.contains('dark') ? '#0b1120' : '#ffffff',
            logging: false, windowWidth: 1200
        });
        const pdf    = new jsPDF('p', 'mm', 'a4');
        const pageW  = pdf.internal.pageSize.getWidth();
        const pageH  = pdf.internal.pageSize.getHeight();
        const imgW   = pageW;
        const imgH   = (canvas.height * imgW) / canvas.width;
        let pos = 0, left = imgH;
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, pos, imgW, imgH);
        left -= pageH;
        while (left > 0) { pos -= pageH; pdf.addPage(); pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, pos, imgW, imgH); left -= pageH; }
        const name = t(appData.profile?.name || { ar: 'Osama', en: 'Osama' }).replace(/\s+/g, '_');
        pdf.save(`${name}_CV.pdf`);
        showToast(currentLang === 'ar' ? 'تم تحميل PDF ✅' : 'PDF downloaded ✅', 'success');
    } catch (err) {
        console.error(err);
        showToast(currentLang === 'ar' ? 'فشل إنشاء PDF' : 'PDF generation failed', 'error');
    } finally {
        if (!wasActive) { resumeEl.classList.remove('active'); resumeEl.style.display = 'none'; }
    }
}

// =========================================================
// 11. PRINT MODE
// =========================================================
function triggerPrint() {
    showPage('resume');
    setTimeout(() => window.print(), 400);
}

// =========================================================
// 12. SHARE PROFILE
// =========================================================
async function shareProfile() {
    const name    = t(appData.profile?.name || { ar: 'أسامة الحربي', en: 'Osama Al-Harbi' });
    const summary = t(appData.profile?.summary || {});
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
        showToast(currentLang === 'ar' ? 'تم نسخ الرابط ✅' : 'Link copied ✅', 'success');
    } catch { showToast(currentLang === 'ar' ? 'تعذّر النسخ' : 'Copy failed', 'error'); }
}

// =========================================================
// 13. LINKEDIN REFERRER
// =========================================================
function checkLinkedInReferrer() {
    if (document.referrer && document.referrer.includes('linkedin.com')) {
        setTimeout(() => showToast(
            currentLang === 'ar' ? 'مرحباً، يبدو أنك قادم من LinkedIn 👋' : 'Welcome from LinkedIn! 👋',
            'info'
        ), 2000);
    }
}

// =========================================================
// 14. ADMIN BUTTONS
// =========================================================
function renderAdminButtons(type, index) {
    if (!isAdmin) return '';
    return `
        <div class="admin-element absolute top-2 right-2 ltr:left-2 ltr:right-auto z-30
                    gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
            <span class="drag-handle bg-white dark:bg-gray-700 text-gray-500 w-7 h-7 rounded-lg shadow
                         flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-600 cursor-move border border-gray-200 dark:border-gray-600"
                  title="سحب لإعادة الترتيب">
                <i class="fas fa-grip-vertical" style="font-size:10px"></i>
            </span>
            <button onclick="event.stopPropagation(); manageItem('${type}', ${index})"
                    class="bg-blue-500 text-white w-7 h-7 rounded-lg shadow flex items-center justify-center hover:bg-blue-600 hover:scale-110 transition"
                    title="تعديل">
                <i class="fas fa-pen" style="font-size:10px"></i>
            </button>
            <button onclick="event.stopPropagation(); deleteItem('${type}', ${index})"
                    class="bg-red-500 text-white w-7 h-7 rounded-lg shadow flex items-center justify-center hover:bg-red-600 hover:scale-110 transition"
                    title="حذف">
                <i class="fas fa-trash" style="font-size:10px"></i>
            </button>
        </div>
    `;
}

// =========================================================
// 15. ADMIN CRUD
// =========================================================
const SCHEMAS = {
    skills: [
        { key: 'ar',       label: 'اسم المهارة (عربي)',   simple: true },
        { key: 'en',       label: 'Skill Name (English)', simple: true },
        { key: 'level',    label: 'المستوى % (0-100)',    simple: true },
        { key: 'category', label: 'النوع (hard / soft)',  simple: true }
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
        { key: 'hours',        label: 'عدد الساعات / Hours', simple: true },
        { key: 'description',  label: 'الوصف / Description', type: 'textarea' }
    ],
    projects: [
        { key: 'title',        label: 'العنوان / Title' },
        { key: 'desc',         label: 'الوصف / Description', type: 'textarea' },
        { key: 'technologies', label: 'التقنيات — افصل بفاصلة: Python,SQL,HTML5', simple: true, isArray: true },
        { key: 'challenges',   label: 'التحديات / Challenges', type: 'textarea', nested: 'details' },
        { key: 'results',      label: 'النتائج / Results',     type: 'textarea', nested: 'details' },
        { key: 'link',         label: 'الرابط / Link', simple: true }
    ],
    certificates: [
        { key: 'name',       label: 'اسم الشهادة / Name' },
        { key: 'issuer',     label: 'الجهة المانحة / Issuer' },
        { key: 'credential', label: 'Credential ID', simple: true },
        { key: 'date',       label: 'التاريخ / Date', simple: true }
    ],
    workshops: [
        { key: 'name',      label: 'اسم الورشة / Name' },
        { key: 'organizer', label: 'الجهة المنظمة / Organizer' },
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

    // Get value helper — supports nested keys (e.g. details.challenges)
    const getVal = (obj, f, lang) => {
        const src = f.nested ? (obj[f.nested] || {}) : obj;
        const v   = src[f.key];
        if (!v) return '';
        if (typeof v === 'object') return v[lang] || '';
        return String(v);
    };

    // For isArray fields, show comma-separated string of current array
    const getArrayVal = (obj, f) => {
        const arr = obj[f.key];
        if (!arr) return '';
        if (Array.isArray(arr)) return arr.join(', ');
        return String(arr);
    };

    const html = schema.map(f => {
        // simple text input (also handles isArray and nested-simple)
        if (f.simple) {
            const val = isEdit
                ? (f.isArray ? getArrayVal(item, f) : (item[f.key] ?? ''))
                : '';
            return `<div class="mb-3">
                <label class="block text-xs mb-1 text-gray-500 text-right">${f.label}</label>
                <input id="swal-${f.key}" class="swal2-input m-0 w-full" value="${val}" dir="ltr">
            </div>`;
        }
        // bilingual textarea or input (supports nested)
        const valAr = getVal(item, f, 'ar');
        const valEn = getVal(item, f, 'en');
        if (f.type === 'textarea') {
            return `<div class="grid grid-cols-2 gap-2 mb-3">
                <div>
                    <label class="block text-xs mb-1 text-gray-500 text-right">${f.label} (AR)</label>
                    <textarea id="swal-${f.key}-ar" class="swal2-textarea m-0 w-full h-24 text-right" dir="rtl">${valAr}</textarea>
                </div>
                <div>
                    <label class="block text-xs mb-1 text-gray-500 text-left">${f.label} (EN)</label>
                    <textarea id="swal-${f.key}-en" class="swal2-textarea m-0 w-full h-24 text-left" dir="ltr">${valEn}</textarea>
                </div>
            </div>`;
        }
        return `<div class="grid grid-cols-2 gap-2 mb-3">
            <div>
                <label class="block text-xs mb-1 text-gray-500 text-right">${f.label} (AR)</label>
                <input id="swal-${f.key}-ar" class="swal2-input m-0 w-full text-right" value="${valAr}" dir="rtl">
            </div>
            <div>
                <label class="block text-xs mb-1 text-gray-500 text-left">${f.label} (EN)</label>
                <input id="swal-${f.key}-en" class="swal2-input m-0 w-full text-left" value="${valEn}" dir="ltr">
            </div>
        </div>`;
    }).join('');

    const { value } = await Swal.fire({
        title: isEdit ? 'تعديل البيانات' : 'إضافة جديدة',
        html: `<div class="text-right" dir="rtl">${html}</div>`,
        width: '700px',
        confirmButtonText: 'حفظ التغييرات',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        focusConfirm: false,
        preConfirm: () => {
            const obj   = {};
            const nestedGroups = {};   // accumulates nested keys e.g. details: { challenges: {}, results: {} }

            schema.forEach(f => {
                if (f.simple) {
                    const raw = document.getElementById(`swal-${f.key}`)?.value ?? '';
                    // isArray: split comma-separated string into array, trim each element
                    obj[f.key] = f.isArray
                        ? raw.split(',').map(s => s.trim()).filter(Boolean)
                        : raw;
                } else {
                    const biVal = {
                        ar: document.getElementById(`swal-${f.key}-ar`)?.value ?? '',
                        en: document.getElementById(`swal-${f.key}-en`)?.value ?? ''
                    };
                    if (f.nested) {
                        // group under the parent key e.g. details.challenges
                        if (!nestedGroups[f.nested]) nestedGroups[f.nested] = {};
                        nestedGroups[f.nested][f.key] = biVal;
                    } else {
                        obj[f.key] = biVal;
                    }
                }
            });

            // Merge nested groups into obj
            Object.assign(obj, nestedGroups);
            return obj;
        }
    });

    if (value) {
        if (!appData[type]) appData[type] = [];
        if (isEdit) appData[type][index] = value;
        else        appData[type].push(value);
        renderAll();
        showToast(isEdit ? 'تم التعديل ✅' : 'تمت الإضافة ✅', 'success');
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
// FIX: skills container shows FILTERED items → must map filtered index back to real appData index
function reorderSection(type, oldIdx, newIdx) {
    const moved = appData[type].splice(oldIdx, 1)[0];
    appData[type].splice(newIdx, 0, moved);
    renderAll();
}

function reorderSkills(tab, oldFilteredIdx, newFilteredIdx) {
    const allSkills    = appData.skills || [];
    const filteredSkills = allSkills.filter(s => s.category === tab);
    const movedItem    = filteredSkills[oldFilteredIdx];
    const targetItem   = filteredSkills[newFilteredIdx];
    const realOld      = allSkills.indexOf(movedItem);
    const realNew      = allSkills.indexOf(targetItem);
    if (realOld === -1 || realNew === -1) return;
    allSkills.splice(realOld, 1);
    const adjustedNew = realNew > realOld ? realNew - 1 : realNew; // index shifts after splice
    allSkills.splice(adjustedNew, 0, movedItem);
    renderAll();
}

function initSortable() {
    const types = ['experience', 'education', 'volunteer', 'certificates', 'workshops', 'projects', 'languages'];
    types.forEach(type => {
        const el = document.getElementById(`${type}-container`);
        if (!el) return;
        new Sortable(el, {
            animation: 150, handle: '.drag-handle', ghostClass: 'opacity-40',
            onEnd(evt) { reorderSection(type, evt.oldIndex, evt.newIndex); }
        });
    });

    // FIX: skills needs special reorder because container is filtered
    const skillsEl = document.getElementById('skills-container');
    if (skillsEl) {
        new Sortable(skillsEl, {
            animation: 150, handle: '.drag-handle', ghostClass: 'opacity-40',
            onEnd(evt) { reorderSkills(activeSkillTab, evt.oldIndex, evt.newIndex); }
        });
    }
}

// =========================================================
// 17. INLINE EDITING (profile text)
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
        title: 'تغيير الصورة الشخصية', input: 'url',
        inputLabel: 'رابط الصورة (Imgur, GitHub, Drive)',
        inputPlaceholder: 'https://...'
    });
    if (value) { setDeepValue(appData, key, value); renderAll(); }
}

// =========================================================
// 18. AUTH & GITHUB SYNC
// =========================================================
function checkSession() {
    // Only called AFTER loadContent() resolves so appData is populated
    const loginTime = localStorage.getItem('login_time');
    // D — token is in sessionStorage; if tab was closed token is gone
    const savedToken = sessionStorage.getItem('saved_token') || localStorage.getItem('saved_token');
    if (!savedToken) return;

    if (loginTime && (Date.now() - Number(loginTime) > SESSION_DURATION)) {
        logout();
        showToast('انتهت الجلسة، يرجى تسجيل الدخول مجدداً', 'error');
        return;
    }
    githubInfo.repo  = localStorage.getItem('saved_repo');
    githubInfo.token = savedToken;
    enableAdminMode();
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

    // D — Security: token in sessionStorage only (cleared on tab close)
    //     repo name (not sensitive) in localStorage for convenience
    localStorage.setItem('saved_repo',   repo);
    sessionStorage.setItem('saved_token', token);  // never persisted to disk
    localStorage.setItem('login_time',   Date.now());

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
    if (dataLoaded) renderAll();   // FIX: only render if data is loaded
    initSkillsObserver();
}

function logout() {
    ['saved_repo', 'login_time'].forEach(k => localStorage.removeItem(k));
    sessionStorage.removeItem('saved_token');
    localStorage.removeItem('saved_token'); // clean up old storage too
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
        if (!getRes.ok) throw new Error('فشل الاتصال بـ GitHub. تأكد من الـ Token.');
        const fileData = await getRes.json();
        const content  = btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2))));
        const putRes   = await fetch(url, {
            method: 'PUT',
            headers: { Authorization: `token ${githubInfo.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Update via Admin Panel', content, sha: fileData.sha })
        });
        if (!putRes.ok) throw new Error('فشل الحفظ في GitHub');
        showToast('تم الحفظ في GitHub ✅', 'success');
    } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
    } finally {
        saveBtn.innerHTML = origHTML;
    }
}

function restoreBackup() {
    const data = localStorage.getItem('backup_data');
    if (data) { appData = JSON.parse(data); renderAll(); showToast('تم استعادة النسخة الاحتياطية ✅', 'success'); }
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

// FIX: clear previous interval to prevent stacked animations
function typeWriter(text, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (twInterval) clearInterval(twInterval);
    el.innerHTML = '';
    let i = 0;
    twInterval = setInterval(() => {
        el.innerHTML += text.charAt(i);
        if (++i >= text.length) { clearInterval(twInterval); twInterval = null; }
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
            number:      { value: party ? 100 : 40 },
            color:       { value: party ? ['#f00','#0f0','#00f'] : (isDark ? '#ffffff' : '#3b82f6') },
            opacity:     { value: 0.3 },
            size:        { value: 3 },
            line_linked: { enable: true, distance: 150, color: isDark ? '#ffffff' : '#3b82f6', opacity: 0.1, width: 1 },
            move:        { enable: true, speed: party ? 10 : 1 }
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

// D — Rate limiting: max 3 messages per 60 minutes
const CONTACT_RATE = { max: 3, window: 60 * 60 * 1000 };

function getContactAttempts() {
    try {
        const raw = sessionStorage.getItem('contact_attempts');
        if (!raw) return [];
        return JSON.parse(raw).filter(ts => Date.now() - ts < CONTACT_RATE.window);
    } catch { return []; }
}

function recordContactAttempt() {
    const attempts = getContactAttempts();
    attempts.push(Date.now());
    sessionStorage.setItem('contact_attempts', JSON.stringify(attempts));
}

function updateContactRateUI() {
    const attempts  = getContactAttempts();
    const remaining = CONTACT_RATE.max - attempts.length;
    const infoEl    = document.getElementById('contact-rate-info');
    const btnEl     = document.getElementById('contact-submit-btn');
    if (!infoEl || !btnEl) return;
    if (remaining <= 1 && remaining > 0) {
        infoEl.classList.remove('hidden');
        infoEl.textContent = currentLang === 'ar'
            ? `متبقي ${remaining} محاولة`
            : `${remaining} attempt remaining`;
    } else if (remaining <= 0) {
        infoEl.classList.remove('hidden');
        infoEl.textContent = currentLang === 'ar'
            ? 'تم الوصول للحد الأقصى. حاول بعد ساعة.'
            : 'Rate limit reached. Try again in an hour.';
        btnEl.disabled = true;
        btnEl.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

function handleContact(e) {
    e.preventDefault();

    // D — Honeypot check
    const honeypot = e.target.querySelector('input[name="_gotcha"]');
    if (honeypot && honeypot.value) return; // bot detected, silently ignore

    // D — Rate limit check
    const attempts = getContactAttempts();
    if (attempts.length >= CONTACT_RATE.max) {
        showToast(
            currentLang === 'ar' ? 'تم الوصول للحد الأقصى. حاول بعد ساعة.' : 'Rate limit reached. Try again in an hour.',
            'error'
        );
        return;
    }

    const btn     = document.getElementById('contact-submit-btn');
    const origTxt = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = '...'; }

    recordContactAttempt();
    updateContactRateUI();

    fetch(FORMSPREE_ENDPOINT, {
        method: 'POST', body: new FormData(e.target), headers: { Accept: 'application/json' }
    }).then(res => {
        if (res.ok) {
            showToast('تم الإرسال بنجاح ✅', 'success');
            e.target.reset();
        } else {
            showToast('حدث خطأ في الإرسال', 'error');
        }
    }).catch(() => showToast('تعذّر الاتصال بالخادم', 'error'))
    .finally(() => { if (btn && btn.disabled && getContactAttempts().length < CONTACT_RATE.max) { btn.disabled = false; btn.textContent = origTxt; } });
}

function setDeepValue(obj, path, value) {
    const keys    = path.split('.');
    let   current = obj;
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
    current[keys[keys.length - 1]] = value;
}

function showToast(msg, type = 'info') {
    const colors = { success: '#10B981', error: '#EF4444', info: '#3b82f6' };
    Toastify({ text: msg, duration: 3500, gravity: 'top', position: 'center', style: { background: colors[type] || colors.info } }).showToast();
}
