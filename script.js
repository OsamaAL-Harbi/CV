/**
 * OSAMA PORTFOLIO — script.js  v4.0
 * =====================================================
 * New in v4:
 *  20. Dynamic SEO meta tags per page + hash URL routing
 *  21. Custom 404 handler
 *  22. Project filtering by technology
 *  23. Live Demo button on projects
 *  24. Particles hue-rotate by section
 *  25. Admin analytics dashboard (session stats + GA4 link)
 *  26. Contact actions (email copy, LinkedIn, GitHub open)
 *  27. sendMailto & char counter
 *  28. Page visit tracking in sessionStorage
 * =====================================================
 */

// =====================================================
// 1. GLOBALS
// =====================================================
let appData        = {};
let githubInfo     = { token: '', repo: '' };
let currentLang    = localStorage.getItem('lang') || 'ar';
let isAdmin        = false;
let clickCount     = 0;
let activeSkillTab = 'hard';
let activeFilter   = 'all';          // project filter
let dataLoaded     = false;
let twInterval     = null;

const SESSION_DURATION   = 60 * 60 * 1000;
const DEFAULT_REPO       = 'OsamaAL-Harbi/CV';
const REPO_PATTERN       = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
// The GitHub token lives in sessionStorage only: it disappears when the tab closes.
const SESSION_KEYS       = { token: 'gh_token', repo: 'gh_repo', loginTime: 'gh_login_time' };
let sessionTimer         = null;
let lastSavedSnapshot    = null;     // in-memory copy of the last loaded/saved data
const VALID_PAGES        = ['home', 'resume', 'portfolio', 'contact'];

// Particles hue-rotation per section
const SECTION_HUE = { home: 0, resume: 180, portfolio: 120, contact: 90, 'not-found': 0 };

// =====================================================
// 2. BOOT
// =====================================================
document.addEventListener('DOMContentLoaded', () => {
    AOS.init({ duration: 800, once: true });

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    setDirection();
    initTheme();
    initParticles();
    setupSecretTrigger();
    setupCmdPalette();
    registerPWA();
    setupScrollTop();
    checkLinkedInReferrer();
    initStatsObserver();

    purgeLegacyAdminStorage();
    const ri = document.getElementById('repo-input');
    if (ri) ri.value = localStorage.getItem('saved_repo') || DEFAULT_REPO;

    // Hash routing — must run after data loads
    loadContent().then(() => {
        checkSession();
        handleHash();                  // respect URL hash on first load
    });

    setupActions();

    // React to hash changes (back/forward browser buttons + nav links)
    window.addEventListener('hashchange', handleHash);
});

function registerPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
}

// =====================================================
// 3. NAVIGATION + HASH ROUTING
// =====================================================

// Called on every hashchange and on first load
function handleHash() {
    const hash   = window.location.hash.replace('#', '').trim();
    const pageId = VALID_PAGES.includes(hash) ? hash : (hash === '' ? 'home' : null);
    if (pageId) showPage(pageId, false);  // false = don't push state again
    else if (hash !== '') show404();
}

function showPage(pageId, pushState = true) {
    if (!VALID_PAGES.includes(pageId)) { show404(); return; }

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

    // Update hash without triggering hashchange again
    if (pushState && window.location.hash !== `#${pageId}`) {
        history.pushState(null, '', `#${pageId}`);
    }

    // Update dynamic SEO meta tags
    updateMetaTags(pageId);

    // Shift particles hue per section
    const hue = SECTION_HUE[pageId] ?? 0;
    const pEl = document.getElementById('particles-js');
    if (pEl) pEl.style.filter = `hue-rotate(${hue}deg)`;

    // Track page visit in sessionStorage
    trackPageVisit(pageId);
}

function show404() {
    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    const el = document.getElementById('not-found');
    if (el) { el.style.display = 'block'; setTimeout(() => { el.classList.add('active'); AOS.refresh(); }, 10); }
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('nav-active'));
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

// =====================================================
// 4. DYNAMIC SEO META TAGS
// =====================================================
const PAGE_META = {
    ar: {
        home:      { title: 'أسامة الحربي | الرئيسية',                    desc: 'الموقع الشخصي لأسامة عبدالعزيز الحربي - خريج تقنية المعلومات من الجامعة الإسلامية بالمدينة المنورة.' },
        resume:    { title: 'السيرة الذاتية | أسامة الحربي',              desc: 'السيرة الذاتية الكاملة لأسامة الحربي: خبرات، تعليم، مهارات، شهادات.' },
        portfolio: { title: 'معرض الأعمال | أسامة الحربي',                desc: 'مشاريع أسامة الحربي البرمجية والتقنية.' },
        contact:   { title: 'تواصل معي | أسامة الحربي',                   desc: 'تواصل مع أسامة الحربي عبر البريد الإلكتروني أو LinkedIn.' }
    },
    en: {
        home:      { title: 'Osama Al-Harbi | Portfolio',                  desc: 'Personal website of Osama Abdulaziz Al-Harbi – IT Graduate, Islamic University of Madinah.' },
        resume:    { title: 'Resume | Osama Al-Harbi',                     desc: 'Full resume of Osama Al-Harbi: experience, education, skills, certifications.' },
        portfolio: { title: 'Portfolio | Osama Al-Harbi',                  desc: 'Technical and programming projects by Osama Al-Harbi.' },
        contact:   { title: 'Contact | Osama Al-Harbi',                    desc: 'Get in touch with Osama Al-Harbi via email or LinkedIn.' }
    }
};

function updateMetaTags(pageId) {
    const meta    = PAGE_META[currentLang]?.[pageId];
    if (!meta) return;
    const pageUrl = `${window.location.origin}${window.location.pathname}#${pageId}`;

    document.title = meta.title;

    const setMeta = (id, attr, val) => { const el = document.getElementById(id); if (el) el.setAttribute(attr, val); };
    setMeta('meta-description', 'content', meta.desc);
    setMeta('og-title',         'content', meta.title);
    setMeta('og-description',   'content', meta.desc);
    setMeta('og-url',           'content', pageUrl);
    setMeta('tw-title',         'content', meta.title);
    setMeta('canonical',        'href',    pageUrl);
}

// =====================================================
// 5. LOCALISATION
// =====================================================
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
    // Re-apply meta for current page
    const hash = window.location.hash.replace('#', '') || 'home';
    updateMetaTags(hash);
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
        btn_projects:'أعمالي', btn_save:'حفظ', btn_email:'فتح تطبيق الإيميل للإرسال',
        btn_download_cv:'تحميل PDF', btn_share:'مشاركة', btn_print:'طباعة',
        sec_resume:'السيرة الذاتية', sec_exp:'الخبرات', sec_edu:'التعليم',
        sec_volunteer:'التطوع', sec_skills:'المهارات', sec_certs:'الشهادات',
        sec_workshops:'ورش العمل', sec_languages:'اللغات', sec_projects:'معرض المشاريع',
        contact_title:'تواصل معي', contact_email_label:'البريد الإلكتروني',
        contact_click_copy:'انقر للنسخ', contact_open:'فتح الملف',
        contact_compose:'اكتب رسالة', contact_subject_label:'الموضوع',
        contact_message_label:'الرسالة', contact_mailto_note:'سيفتح تطبيق الإيميل على جهازك',
        contact_cv_title:'هل تريد مراجعة سيرتي الذاتية أولاً؟', contact_cv_sub:'تحميل مباشر — PDF جاهز',
        tab_hard:'تقنية', tab_soft:'شخصية',
        stat_certs:'شهادات مهنية', stat_volunteer:'ساعة تطوع',
        stat_projects:'مشروع تخرج', stat_graduation:'سنة التخرج',
        not_found_title:'الصفحة غير موجودة', not_found_desc:'يبدو أن الرابط الذي طلبته غير موجود',
        not_found_btn:'العودة للرئيسية',
        filter_all:'الكل'
    },
    en: {
        nav_home:'Home', nav_resume:'Resume', nav_portfolio:'Portfolio', nav_contact:'Contact',
        btn_projects:'My Work', btn_save:'Save', btn_email:'Open Email App',
        btn_download_cv:'Download PDF', btn_share:'Share', btn_print:'Print',
        sec_resume:'Resume', sec_exp:'Experience', sec_edu:'Education',
        sec_volunteer:'Volunteer', sec_skills:'Skills', sec_certs:'Certificates',
        sec_workshops:'Workshops', sec_languages:'Languages', sec_projects:'Portfolio',
        contact_title:'Get in Touch', contact_email_label:'Email',
        contact_click_copy:'Click to copy', contact_open:'Open Profile',
        contact_compose:'Write a Message', contact_subject_label:'Subject',
        contact_message_label:'Message', contact_mailto_note:'Your email app will open with the message',
        contact_cv_title:'Want to review my CV first?', contact_cv_sub:'Direct download — PDF ready',
        tab_hard:'Technical', tab_soft:'Soft Skills',
        stat_certs:'Certifications', stat_volunteer:'Volunteer Hours',
        stat_projects:'Graduation Project', stat_graduation:'Graduation Year',
        not_found_title:'Page Not Found', not_found_desc:'The link you requested does not exist',
        not_found_btn:'Back to Home',
        filter_all:'All'
    }
};

function updateStaticText() {
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (STATIC_TEXT[currentLang]?.[key]) el.innerText = STATIC_TEXT[currentLang][key];
    });
}

// =====================================================
// 6. DATA LOADING
// =====================================================
async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if (!res.ok) throw new Error('data.json not found');
        appData    = await res.json();
        dataLoaded = true;
        lastSavedSnapshot = JSON.stringify(appData);
        renderAll();
        updateStaticText();
        setSmartGreeting();
        setTimeout(() => document.getElementById('loading-screen').classList.add('hidden'), 500);
    } catch (err) {
        showToast('خطأ في تحميل البيانات / Error loading data', 'error');
        document.getElementById('loading-screen').classList.add('hidden');
    }
}

// =====================================================
// 7. RENDER ENGINE
// =====================================================

const WC = {
    experience:   'relative group mb-8',
    education:    'relative group mb-6',
    volunteer:    'relative group mb-6',
    projects:     'relative group bg-white dark:bg-cardBg rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col h-full shadow-sm hover:shadow-2xl transition duration-300 transform hover:-translate-y-1',
    certificates: 'relative group flex items-center gap-4 bg-white dark:bg-cardBg p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition',
    workshops:    'relative group bg-white dark:bg-cardBg p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition',
    languages:    'relative group flex items-center gap-3 bg-white dark:bg-cardBg px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition'
};

function renderAll() {
    renderProfile();
    renderSection('experience',   appData.experience   || [], renderExperienceItem,  WC.experience);
    renderSection('education',    appData.education    || [], renderEducationItem,   WC.education);
    renderSection('volunteer',    appData.volunteer    || [], renderVolunteerItem,   WC.volunteer);
    renderSkillsWithProgress(activeSkillTab);
    renderSection('certificates', appData.certificates || [], renderCertItem,        WC.certificates);
    renderSection('workshops',    appData.workshops    || [], renderWorkshopItem,    WC.workshops);
    renderSection('languages',    appData.languages    || [], renderLanguageItem,    WC.languages);
    // Projects: filters first, then filtered grid
    renderProjectFilters();
    renderFilteredProjects();
    updatePrintHeader();
    if (isAdmin) loadVendor('sortable').then(initSortable).catch(() => showToast('تعذّر تحميل أداة الترتيب', 'error'));
    setTimeout(() => AOS.refresh(), 50);
}

// ─── Profile ──────────────────────────────────────────
function renderProfile() {
    const p = appData.profile;
    if (!p) return;

    updateText('profile.name',    t(p.name));
    updateText('profile.summary', t(p.summary));

    const fallback = 'assets/img/avatar.svg';
    const imgEl = document.getElementById('profile-img');
    if (imgEl) {
        imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = fallback; };
        imgEl.src = safeAssetUrl(p.image) || fallback;
        imgEl.alt = t(p.name);
    }

    if (twInterval) clearInterval(twInterval);
    typeWriter(t(p.title), 'typewriter');

    const locEl = document.getElementById('profile-location');
    if (locEl) locEl.textContent = t(p.location);

    const emailDisplay = document.getElementById('contact-email-display');
    if (emailDisplay) emailDisplay.textContent = p.email;
    const locDisplay = document.getElementById('contact-location-display');
    if (locDisplay) locDisplay.textContent = t(p.location);

    // CV download buttons follow profile.cv (the static href is the fallback)
    const cv = safeAssetUrl(p.cv);
    if (cv) document.querySelectorAll('[data-cv-link]').forEach(a => { a.href = cv; });
}

// ─── Generic section renderer ─────────────────────────
function renderSection(type, data, contentFn, wrapperClass) {
    const container = document.getElementById(`${type}-container`);
    if (!container) return;
    const hasTimeline = ['experience','education','volunteer'].includes(type);
    container.innerHTML = data.map((item, i) => `
        <div class="${wrapperClass} sortable-item" data-index="${i}">
            ${renderAdminButtons(type, i)}
            ${hasTimeline ? `<div class="absolute -right-[39px] ltr:-left-[39px] ltr:right-auto top-1 w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-darkBg z-10 group-hover:scale-125 transition"></div>` : ''}
            ${contentFn(item, i)}
        </div>
    `).join('');
}

// ─── Item renderers ───────────────────────────────────
function renderExperienceItem(item) {
    return `
        <h3 class="text-xl font-bold dark:text-white hover:text-primary transition">${escapeHTML(t(item.role))}</h3>
        <p class="text-primary font-medium text-sm">${escapeHTML(t(item.company))}</p>
        <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs mb-3 font-bold">${escapeHTML(t(item.period))}</span>
        <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${escapeHTML(t(item.description))}</p>`;
}
function renderEducationItem(item) {
    return `
        <h3 class="text-xl font-bold dark:text-white hover:text-blue-500 transition">${escapeHTML(t(item.degree))}</h3>
        <p class="text-blue-500 font-medium text-sm">${escapeHTML(t(item.institution))}</p>
        <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs mb-3 font-bold">${escapeHTML(t(item.period))}</span>
        <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${escapeHTML(t(item.description))}</p>`;
}
function renderVolunteerItem(item) {
    return `
        <h3 class="text-xl font-bold dark:text-white hover:text-orange-500 transition">${escapeHTML(t(item.role))}</h3>
        <p class="text-orange-500 font-medium text-sm">${escapeHTML(t(item.organization))}</p>
        <div class="flex flex-wrap gap-2 mb-3">
            <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs font-bold">${escapeHTML(t(item.period))}</span>
            ${item.hours ? `<span class="inline-block bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded text-xs font-bold">${escapeHTML(item.hours)} ${currentLang === 'ar' ? 'ساعة' : 'hrs'}</span>` : ''}
        </div>
        <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${escapeHTML(t(item.description))}</p>`;
}
function renderCertItem(item) {
    return `
        <div class="text-2xl text-secondary flex-shrink-0"><i class="fas fa-certificate"></i></div>
        <div class="flex-1 min-w-0">
            <h4 class="font-bold text-sm dark:text-white">${escapeHTML(t(item.name))}</h4>
            <p class="text-xs text-gray-500 mt-1">${escapeHTML(t(item.issuer))}${item.credential ? ` · ${escapeHTML(item.credential)}` : ''}</p>
            ${item.date ? `<p class="text-xs text-gray-400 mt-0.5">${escapeHTML(item.date)}</p>` : ''}
        </div>`;
}
function renderWorkshopItem(item) {
    return `
        <div class="flex items-start gap-3">
            <div class="text-yellow-500 mt-1 flex-shrink-0"><i class="fas fa-chalkboard-teacher"></i></div>
            <div>
                <h4 class="font-bold text-sm dark:text-white">${escapeHTML(t(item.name))}</h4>
                <p class="text-xs text-gray-500 mt-1">${escapeHTML(t(item.organizer))}</p>
                <p class="text-xs text-gray-400 mt-0.5">${escapeHTML(t(item.date))}</p>
            </div>
        </div>`;
}
function renderLanguageItem(item) {
    return `
        <i class="fas fa-language text-teal-500 text-lg flex-shrink-0"></i>
        <div>
            <p class="font-bold text-sm dark:text-white">${escapeHTML(t(item.name))}</p>
            <p class="text-xs text-gray-500">${escapeHTML(t(item.level))}</p>
        </div>`;
}

// ─── Project Card ─────────────────────────────────────
// Uses stable key (title-based) for sessionStorage, not array index
function getProjectKey(item, fallback) {
    const raw = item.title?.en || item.title?.ar || String(fallback);
    return 'pv_' + raw.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_').substring(0, 40);
}

function renderProjectItem(item, realIdx) {
    const key       = getProjectKey(item, realIdx);
    const views     = JSON.parse(sessionStorage.getItem('project_views') || '{}');
    const count     = views[key] || 0;
    const viewLabel = count === 1
        ? (currentLang === 'ar' ? 'مشاهدة' : 'view')
        : (currentLang === 'ar' ? 'مشاهدة' : 'views');
    const liveUrl   = safeUrl(item.liveUrl);
    const hasLive   = liveUrl !== '';

    return `
        <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900
                    flex items-center justify-center relative overflow-hidden rounded-t-2xl cursor-pointer"
             data-action="open-project" data-index="${realIdx}">
            <i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500"></i>
            <div class="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition duration-300 backdrop-blur-sm">
                <span class="px-4 py-2 bg-white text-gray-900 rounded-full font-bold text-sm transform translate-y-4 group-hover:translate-y-0 transition duration-300 shadow-xl">
                    ${currentLang === 'ar' ? 'التفاصيل' : 'Details'}
                </span>
                ${hasLive ? `<a href="${escapeHTML(liveUrl)}" target="_blank" rel="noopener noreferrer"
                    class="px-4 py-2 bg-green-500 text-white rounded-full font-bold text-sm transform translate-y-4 group-hover:translate-y-0 transition duration-500 shadow-xl">
                    Live Demo</a>` : ''}
            </div>
            ${count > 0 ? `
                <span class="absolute top-3 right-3 ltr:left-3 ltr:right-auto bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 pointer-events-none">
                    <i class="fas fa-eye text-[10px]"></i>&nbsp;${count} ${viewLabel}
                </span>` : ''}
            ${hasLive ? `<span class="absolute top-3 left-3 ltr:right-3 ltr:left-auto bg-green-500/90 text-white text-xs px-2 py-1 rounded-full font-bold pointer-events-none">Live</span>` : ''}
        </div>
        <div class="p-5 flex-grow flex flex-col">
            <h3 class="text-base font-bold mb-2 dark:text-white">${escapeHTML(t(item.title))}</h3>
            <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed flex-grow">${escapeHTML(t(item.desc))}</p>
            ${item.technologies?.length ? `
                <div class="flex flex-wrap gap-1.5 mt-3">
                    ${item.technologies.map(tech =>
                        `<span class="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-bold">${escapeHTML(tech)}</span>`
                    ).join('')}
                </div>` : ''}
        </div>`;
}

// ─── Print header ──────────────────────────────────────
function updatePrintHeader() {
    const p = appData.profile;
    if (!p) return;
    const nameEl = document.getElementById('print-name');
    if (nameEl) nameEl.textContent = t(p.name);
    const contactEl = document.getElementById('print-contact');
    if (contactEl) contactEl.textContent = `${p.email} · ${p.phone || ''} · ${t(p.location)}`;
}

// =====================================================
// 8. PROJECT FILTERING
// =====================================================
function renderProjectFilters() {
    const container = document.getElementById('project-filters');
    if (!container) return;

    // Collect all unique techs across all projects
    const techSet = new Set();
    (appData.projects || []).forEach(p => (p.technologies || []).forEach(t => techSet.add(t)));

    if (techSet.size === 0) { container.innerHTML = ''; return; }

    const allLabel = STATIC_TEXT[currentLang]?.filter_all || 'الكل';
    const techs    = [{ key: 'all', label: allLabel }, ...Array.from(techSet).map(t => ({ key: t, label: t }))];

    container.innerHTML = techs.map(({ key, label }) => `
        <button data-action="set-filter" data-filter="${escapeHTML(key)}"
                class="filter-btn px-3 py-1.5 text-xs font-bold rounded-full border border-gray-200 dark:border-gray-700 transition hover:border-primary hover:text-primary ${activeFilter === key ? 'active bg-primary text-white border-primary' : 'bg-white dark:bg-cardBg text-gray-600 dark:text-gray-300'}">
            ${escapeHTML(label)}
        </button>
    `).join('');
}

function setProjectFilter(tech) {
    activeFilter = tech;
    renderProjectFilters();
    renderFilteredProjects();
}

// FIX: use original array index for modal so openProjectModal gets correct item
function renderFilteredProjects() {
    const container  = document.getElementById('projects-container');
    if (!container) return;
    const allProjects = appData.projects || [];
    const filtered    = activeFilter === 'all'
        ? allProjects.map((item, i) => ({ item, realIdx: i }))
        : allProjects.map((item, i) => ({ item, realIdx: i })).filter(({ item }) =>
            (item.technologies || []).includes(activeFilter));

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-16 text-gray-400">
                <i class="fas fa-search text-4xl mb-4 block opacity-30"></i>
                <p class="font-medium">${currentLang === 'ar' ? 'لا توجد مشاريع بهذه التقنية' : 'No projects found for this technology'}</p>
                <button data-action="set-filter" data-filter="all" class="mt-4 text-primary text-sm font-bold hover:underline">${STATIC_TEXT[currentLang]?.filter_all}</button>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(({ item, realIdx }) => `
        <div class="${WC.projects} sortable-item" data-index="${realIdx}">
            ${renderAdminButtons('projects', realIdx)}
            ${renderProjectItem(item, realIdx)}
        </div>
    `).join('');
}

// =====================================================
// 9. SKILL PROGRESS BARS
// =====================================================
function setSkillTab(tab) {
    activeSkillTab    = tab;
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
    const container  = document.getElementById('skills-container');
    if (!container) return;
    const allSkills  = appData.skills || [];
    const filtered   = allSkills.filter(s => s.category === tab);
    const barColor   = tab === 'hard'
        ? 'bg-gradient-to-r from-primary to-blue-400'
        : 'bg-gradient-to-r from-secondary to-pink-400';

    container.innerHTML = filtered.map(skill => {
        const realIdx = allSkills.indexOf(skill);
        return `
        <div class="skill-item relative group sortable-item" data-real-index="${realIdx}">
            ${renderAdminButtons('skills', realIdx)}
            <div class="flex justify-between items-center mb-1">
                <span class="text-sm font-bold dark:text-white">${escapeHTML(t(skill))}</span>
                <span class="text-xs font-bold text-gray-400">${skillLevel(skill)}%</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div class="skill-bar-fill h-2.5 rounded-full ${barColor}" data-level="${skillLevel(skill)}"></div>
            </div>
        </div>`;
    }).join('');

    setTimeout(() => animateSkillBars(), 80);
}

function animateSkillBars() {
    document.querySelectorAll('.skill-bar-fill').forEach(bar => {
        bar.style.setProperty('--target-width', `${bar.dataset.level || 0}%`);
        bar.classList.add('animate');
    });
}

// =====================================================
// 10. STATS COUNTER
// =====================================================
function initStatsObserver() {
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

// =====================================================
// 11. PROJECT MODAL + VIEW COUNTER
// =====================================================
function openProjectModal(index) {
    const item = (appData.projects || [])[index];
    if (!item) return;

    // Stable key per project title
    const key     = getProjectKey(item, index);
    const views   = JSON.parse(sessionStorage.getItem('project_views') || '{}');
    views[key]    = (views[key] || 0) + 1;
    sessionStorage.setItem('project_views', JSON.stringify(views));

    const count      = views[key];
    const viewLabel  = currentLang === 'ar' ? 'مشاهدة' : (count === 1 ? 'view' : 'views');

    document.getElementById('modal-title').textContent = t(item.title);
    document.getElementById('modal-desc').textContent  = t(item.desc);
    document.getElementById('modal-views-count').textContent = `${count} ${viewLabel}`;

    const techContainer = document.getElementById('modal-technologies');
    const techSection   = document.getElementById('modal-tech-section');
    if (techContainer) {
        techContainer.innerHTML = (item.technologies || []).map(tech =>
            `<span class="text-xs px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-bold">${escapeHTML(tech)}</span>`
        ).join('');
    }
    if (techSection) techSection.style.display = item.technologies?.length ? 'block' : 'none';

    document.getElementById('modal-tech-label').textContent       = currentLang === 'ar' ? 'التقنيات المستخدمة' : 'Technologies Used';
    document.getElementById('modal-challenges-label').textContent = currentLang === 'ar' ? 'التحديات'           : 'Challenges';
    document.getElementById('modal-results-label').textContent    = currentLang === 'ar' ? 'النتائج والإنجازات' : 'Results & Achievements';
    document.getElementById('modal-link-label').textContent       = 'GitHub';
    document.getElementById('modal-live-label').textContent       = 'Live Demo';

    document.getElementById('modal-challenges').textContent = item.details ? t(item.details.challenges) : '';
    document.getElementById('modal-results').textContent    = item.details ? t(item.details.results)    : '';

    // GitHub link
    const githubLink = document.getElementById('modal-github-link');
    if (githubLink) {
        const link = safeUrl(item.link);
        if (link) { githubLink.href = link; githubLink.style.display = 'inline-flex'; }
        else githubLink.style.display = 'none';
    }

    // Live Demo link
    const liveLink = document.getElementById('modal-live-link');
    if (liveLink) {
        const live = safeUrl(item.liveUrl);
        if (live) { liveLink.href = live; liveLink.style.display = 'inline-flex'; }
        else liveLink.style.display = 'none';
    }

    // Re-render cards to update badge
    renderFilteredProjects();

    document.getElementById('project-modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function _closeProjectModal() {
    document.getElementById('project-modal').classList.add('hidden');
    document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') _closeProjectModal(); });

// =====================================================
// 12. PAGE VISIT TRACKING (sessionStorage)
// =====================================================
function trackPageVisit(pageId) {
    const visits = JSON.parse(sessionStorage.getItem('page_visits') || '{}');
    visits[pageId] = (visits[pageId] || 0) + 1;
    sessionStorage.setItem('page_visits', JSON.stringify(visits));
}

// =====================================================
// 13. ADMIN ANALYTICS DASHBOARD
// =====================================================
async function showAnalyticsDashboard() {
    await loadVendor('swal');
    const visits  = JSON.parse(sessionStorage.getItem('page_visits')  || '{}');
    const pViews  = JSON.parse(sessionStorage.getItem('project_views') || '{}');
    const allProjects = appData.projects || [];

    const pageNames = {
        ar: { home:'الرئيسية', resume:'السيرة الذاتية', portfolio:'الأعمال', contact:'تواصل' },
        en: { home:'Home', resume:'Resume', portfolio:'Portfolio', contact:'Contact' }
    };

    const visitRows = VALID_PAGES.map(p => `
        <tr class="border-b border-gray-100 dark:border-gray-700">
            <td class="py-2 px-3 font-medium text-sm">${pageNames[currentLang][p] || p}</td>
            <td class="py-2 px-3 text-center">
                <span class="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold text-xs">${visits[p] || 0}</span>
            </td>
        </tr>
    `).join('');

    const projectRows = allProjects.map((proj, i) => {
        const key   = getProjectKey(proj, i);
        const count = pViews[key] || 0;
        return `
        <tr class="border-b border-gray-100 dark:border-gray-700">
            <td class="py-2 px-3 font-medium text-xs">${escapeHTML(t(proj.title))}</td>
            <td class="py-2 px-3 text-center">
                <span class="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-bold text-xs">${count}</span>
            </td>
        </tr>`;
    }).join('');

    Swal.fire({
        title: currentLang === 'ar' ? '📊 لوحة الإحصائيات' : '📊 Analytics Dashboard',
        html: `
        <div class="text-right" dir="${currentLang === 'ar' ? 'rtl' : 'ltr'}">
            <p class="text-xs text-gray-400 mb-4">${currentLang === 'ar' ? 'بيانات الجلسة الحالية فقط' : 'Current session data only'}</p>

            <h4 class="font-bold text-sm mb-2">${currentLang === 'ar' ? 'زيارات الصفحات' : 'Page Visits'}</h4>
            <table class="w-full mb-6 text-right">
                <thead><tr class="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500">
                    <th class="py-2 px-3 text-right">${currentLang === 'ar' ? 'الصفحة' : 'Page'}</th>
                    <th class="py-2 px-3 text-center">${currentLang === 'ar' ? 'الزيارات' : 'Visits'}</th>
                </tr></thead>
                <tbody>${visitRows}</tbody>
            </table>

            <h4 class="font-bold text-sm mb-2">${currentLang === 'ar' ? 'مشاهدات المشاريع' : 'Project Views'}</h4>
            <table class="w-full mb-6 text-right">
                <thead><tr class="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500">
                    <th class="py-2 px-3 text-right">${currentLang === 'ar' ? 'المشروع' : 'Project'}</th>
                    <th class="py-2 px-3 text-center">${currentLang === 'ar' ? 'المشاهدات' : 'Views'}</th>
                </tr></thead>
                <tbody>${projectRows}</tbody>
            </table>

            <div class="flex gap-2 flex-wrap justify-center mt-4">
                <a href="https://analytics.google.com/" target="_blank"
                   class="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition">
                   <i class="fab fa-google"></i> Google Analytics
                </a>
                <a href="https://clarity.microsoft.com/" target="_blank"
                   class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition">
                   <i class="fas fa-eye"></i> Microsoft Clarity
                </a>
            </div>
        </div>`,
        width: '600px',
        showConfirmButton: false,
        showCloseButton: true
    });
}

// =====================================================
// 14. PDF GENERATION
// =====================================================
async function generatePDF() {
    showToast(currentLang === 'ar' ? 'جاري إنشاء PDF...' : 'Generating PDF...', 'info');
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

function triggerPrint() { showPage('resume'); setTimeout(() => window.print(), 400); }

// =====================================================
// 15. SHARE PROFILE
// =====================================================
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

// =====================================================
// 16. CONTACT ACTIONS
// =====================================================
function contactAction(type) {
    const p = appData.profile;
    if (!p) return;
    if (type === 'email') {
        navigator.clipboard.writeText(p.email).then(() => {
            showToast(currentLang === 'ar' ? 'تم نسخ البريد ✅' : 'Email copied ✅', 'success');
        }).catch(() => showToast(p.email, 'info'));
    } else if (type === 'linkedin' || type === 'github') {
        const url = safeUrl(p[type]);
        if (url) window.open(url, '_blank', 'noopener');
    }
}

function sendMailto() {
    const p       = appData.profile;
    const subject = encodeURIComponent(document.getElementById('contact-subject')?.value || '');
    const body    = encodeURIComponent(document.getElementById('contact-message')?.value || '');
    if (!subject && !body) {
        showToast(currentLang === 'ar' ? 'يرجى كتابة موضوع أو رسالة' : 'Please enter a subject or message', 'error');
        return;
    }
    window.location.href = `mailto:${p?.email || 'osamafcv214@gmail.com'}?subject=${subject}&body=${body}`;
}

function updateCharCounter(el) {
    const counter = document.getElementById('char-counter');
    if (counter) counter.textContent = `${el.value.length} / 2000`;
    if (el.value.length > 2000) el.value = el.value.substring(0, 2000);
}

// =====================================================
// 17. LINKEDIN REFERRER
// =====================================================
function checkLinkedInReferrer() {
    if (document.referrer && document.referrer.includes('linkedin.com')) {
        setTimeout(() => showToast(
            currentLang === 'ar' ? 'مرحباً، يبدو أنك قادم من LinkedIn 👋' : 'Welcome from LinkedIn! 👋', 'info'
        ), 700);
    }
}

// =====================================================
// 18. ADMIN BUTTONS
// =====================================================
function renderAdminButtons(type, index) {
    if (!isAdmin) return '';
    return `
        <div class="admin-element absolute top-2 right-2 ltr:left-2 ltr:right-auto z-30
                    gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
            <span class="drag-handle bg-white dark:bg-gray-700 text-gray-500 w-7 h-7 rounded-lg shadow
                         flex items-center justify-center hover:bg-gray-100 cursor-move border border-gray-200 dark:border-gray-600">
                <i class="fas fa-grip-vertical text-[10px]"></i>
            </span>
            <button data-action="edit-item" data-type="${type}" data-index="${index}" aria-label="Edit"
                    class="bg-blue-500 text-white w-7 h-7 rounded-lg shadow flex items-center justify-center hover:bg-blue-600 hover:scale-110 transition">
                <i class="fas fa-pen text-[10px]"></i>
            </button>
            <button data-action="delete-item" data-type="${type}" data-index="${index}" aria-label="Delete"
                    class="bg-red-500 text-white w-7 h-7 rounded-lg shadow flex items-center justify-center hover:bg-red-600 hover:scale-110 transition">
                <i class="fas fa-trash text-[10px]"></i>
            </button>
        </div>`;
}

// =====================================================
// 19. ADMIN CRUD (SCHEMAS)
// =====================================================
const SCHEMAS = {
    skills: [
        { key: 'ar',       label: 'اسم المهارة (عربي)',   simple: true },
        { key: 'en',       label: 'Skill Name (English)', simple: true },
        { key: 'level',    label: 'المستوى % (0-100)',    simple: true, number: true },
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
        { key: 'title',               label: 'العنوان / Title' },
        { key: 'desc',                label: 'الوصف / Description', type: 'textarea' },
        { key: 'technologies',        label: 'التقنيات / Technologies (مفصولة بفاصلة)', simple: true, array: true },
        { key: 'link',                label: 'رابط GitHub',    simple: true },
        { key: 'liveUrl',             label: 'رابط Live Demo', simple: true },
        { key: 'details_challenges',  label: 'التحديات / Challenges', type: 'textarea', nested: 'details', subkey: 'challenges' },
        { key: 'details_results',     label: 'النتائج / Results',     type: 'textarea', nested: 'details', subkey: 'results'    }
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
    await loadVendor('swal');

    // Helper: get value supporting nested objects (e.g. details.challenges)
    const getVal = (obj, f, lang) => {
        let src = obj;
        if (f.nested) src = obj[f.nested] || {};
        const k = f.subkey || f.key;
        if (!src[k]) return '';
        if (typeof src[k] === 'object') return src[k][lang] || '';
        return String(src[k]);
    };
    const getSimple = (obj, f) => {
        let src = obj;
        if (f.nested) src = obj[f.nested] || {};
        const k = f.subkey || f.key;
        const v = src[k];
        if (Array.isArray(v)) return v.join(', ');
        return v ?? '';
    };

    const html = schema.map(f => {
        // Simple field (string / array)
        if (f.simple) {
            const val = isEdit ? getSimple(item, f) : '';
            const hint = f.array ? ' <span class="text-gray-400 text-xs">(مفصولة بفاصلة)</span>' : '';
            return `<div class="mb-3">
                <label class="block text-xs mb-1 text-gray-500 text-right">${f.label}${hint}</label>
                <input id="swal-${f.key}" class="swal2-input m-0 w-full" value="${escapeHTML(val)}" dir="ltr">
            </div>`;
        }
        const valAr = getVal(item, f, 'ar');
        const valEn = getVal(item, f, 'en');
        if (f.type === 'textarea') {
            return `<div class="grid grid-cols-2 gap-2 mb-3">
                <div><label class="block text-xs mb-1 text-gray-500 text-right">${f.label} (AR)</label>
                <textarea id="swal-${f.key}-ar" class="swal2-textarea m-0 w-full h-24 text-right" dir="rtl">${escapeHTML(valAr)}</textarea></div>
                <div><label class="block text-xs mb-1 text-gray-500 text-left">${f.label} (EN)</label>
                <textarea id="swal-${f.key}-en" class="swal2-textarea m-0 w-full h-24 text-left" dir="ltr">${escapeHTML(valEn)}</textarea></div>
            </div>`;
        }
        return `<div class="grid grid-cols-2 gap-2 mb-3">
            <div><label class="block text-xs mb-1 text-gray-500 text-right">${f.label} (AR)</label>
            <input id="swal-${f.key}-ar" class="swal2-input m-0 w-full text-right" value="${escapeHTML(valAr)}" dir="rtl"></div>
            <div><label class="block text-xs mb-1 text-gray-500 text-left">${f.label} (EN)</label>
            <input id="swal-${f.key}-en" class="swal2-input m-0 w-full text-left" value="${escapeHTML(valEn)}" dir="ltr"></div>
        </div>`;
    }).join('');

    const { value } = await Swal.fire({
        title: isEdit ? 'تعديل البيانات' : 'إضافة جديدة',
        html: `<div class="text-right" dir="rtl">${html}</div>`,
        width: '700px', confirmButtonText: 'حفظ التغييرات',
        showCancelButton: true, cancelButtonText: 'إلغاء',
        focusConfirm: false,
        preConfirm: () => {
            const obj = {};
            schema.forEach(f => {
                const inputId = `swal-${f.key}`;
                if (f.simple) {
                    let raw = document.getElementById(inputId)?.value ?? '';
                    // Array fields: split by comma and trim
                    const val = f.array
                        ? raw.split(',').map(x => x.trim()).filter(Boolean)
                        : (f.number ? skillLevel({ level: raw }) : raw);
                    if (f.nested) {
                        if (!obj[f.nested]) obj[f.nested] = {};
                        obj[f.nested][f.subkey || f.key] = val;
                    } else {
                        obj[f.key] = val;
                    }
                } else {
                    const val = {
                        ar: document.getElementById(`${inputId}-ar`)?.value ?? '',
                        en: document.getElementById(`${inputId}-en`)?.value ?? ''
                    };
                    if (f.nested) {
                        if (!obj[f.nested]) obj[f.nested] = {};
                        obj[f.nested][f.subkey || f.key] = val;
                    } else {
                        obj[f.key] = val;
                    }
                }
            });
            return obj;
        }
    });

    if (value) {
        if (!appData[type]) appData[type] = [];
        if (isEdit) appData[type][index] = value; else appData[type].push(value);
        renderAll();
        showToast(isEdit ? 'تم التعديل ✅' : 'تمت الإضافة ✅', 'success');
    }
}

function addItem(type)         { if (type === 'projects') manageProjectItem(); else manageItem(type); }
function editItem(type, index) { if (type === 'projects') manageProjectItem(index); else manageItem(type, index); }

// ── Dedicated project editor (handles technologies array + nested details) ──
async function manageProjectItem(index = null) {
    if (!isAdmin) return;
    await loadVendor('swal');
    const isEdit = index !== null;
    const item   = isEdit ? (appData.projects || [])[index] : {};

    // Helper: extract bilingual string
    const bv = (obj, lang) => {
        if (!obj) return '';
        if (typeof obj === 'object') return obj[lang] || obj.ar || '';
        return String(obj);
    };

    const techVal   = Array.isArray(item.technologies) ? item.technologies.join(', ') : (item.technologies || '');
    const challAr   = bv(item.details?.challenges, 'ar');
    const challEn   = bv(item.details?.challenges, 'en');
    const resultsAr = bv(item.details?.results,    'ar');
    const resultsEn = bv(item.details?.results,    'en');

    const { value } = await Swal.fire({
        title: isEdit
            ? (currentLang === 'ar' ? 'تعديل المشروع' : 'Edit Project')
            : (currentLang === 'ar' ? 'إضافة مشروع جديد' : 'Add New Project'),
        html: `<div class="text-right space-y-3" dir="rtl">

          <!-- Title -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">عنوان المشروع (AR)</label>
              <input id="pj-title-ar" class="swal2-input m-0 w-full text-right" value="${escapeHTML(bv(item.title,'ar'))}" dir="rtl" placeholder="اسم المشروع بالعربي">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Project Title (EN)</label>
              <input id="pj-title-en" class="swal2-input m-0 w-full text-left" value="${escapeHTML(bv(item.title,'en'))}" dir="ltr" placeholder="Project name in English">
            </div>
          </div>

          <!-- Description -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">وصف المشروع (AR)</label>
              <textarea id="pj-desc-ar" class="swal2-textarea m-0 w-full h-20 text-right" dir="rtl" placeholder="وصف مختصر...">${escapeHTML(bv(item.desc,'ar'))}</textarea>
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Description (EN)</label>
              <textarea id="pj-desc-en" class="swal2-textarea m-0 w-full h-20 text-left" dir="ltr" placeholder="Short description...">${escapeHTML(bv(item.desc,'en'))}</textarea>
            </div>
          </div>

          <!-- Technologies -->
          <div>
            <label class="block text-xs mb-1 text-gray-500">
              التقنيات المستخدمة / Technologies
              <span class="text-gray-400 mr-1">(مفصولة بفاصلة — e.g. SQL, HTML5, CSS3)</span>
            </label>
            <input id="pj-tech" class="swal2-input m-0 w-full" value="${escapeHTML(techVal)}" dir="ltr" placeholder="SQL, MySQL, HTML5, CSS3, JavaScript">
          </div>

          <!-- Challenges -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">التحديات (AR)</label>
              <textarea id="pj-chal-ar" class="swal2-textarea m-0 w-full h-20 text-right" dir="rtl" placeholder="التحديات التي واجهتها...">${escapeHTML(challAr)}</textarea>
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Challenges (EN)</label>
              <textarea id="pj-chal-en" class="swal2-textarea m-0 w-full h-20 text-left" dir="ltr" placeholder="Challenges faced...">${escapeHTML(challEn)}</textarea>
            </div>
          </div>

          <!-- Results -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">النتائج والإنجازات (AR)</label>
              <textarea id="pj-res-ar" class="swal2-textarea m-0 w-full h-20 text-right" dir="rtl" placeholder="النتائج والإنجازات...">${escapeHTML(resultsAr)}</textarea>
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Results & Achievements (EN)</label>
              <textarea id="pj-res-en" class="swal2-textarea m-0 w-full h-20 text-left" dir="ltr" placeholder="Results achieved...">${escapeHTML(resultsEn)}</textarea>
            </div>
          </div>

          <!-- Links -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500">رابط GitHub</label>
              <input id="pj-link" class="swal2-input m-0 w-full" value="${escapeHTML(item.link || '')}" dir="ltr" placeholder="https://github.com/...">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500">رابط Live Demo</label>
              <input id="pj-live" class="swal2-input m-0 w-full" value="${escapeHTML(item.liveUrl || '')}" dir="ltr" placeholder="https://...">
            </div>
          </div>

        </div>`,
        width: '760px',
        confirmButtonText: isEdit ? 'حفظ التغييرات' : 'إضافة المشروع',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        focusConfirm: false,
        preConfirm: () => {
            const titleAr = document.getElementById('pj-title-ar')?.value.trim();
            const titleEn = document.getElementById('pj-title-en')?.value.trim();
            if (!titleAr && !titleEn) {
                Swal.showValidationMessage(currentLang === 'ar' ? 'يرجى إدخال عنوان المشروع' : 'Please enter a project title');
                return false;
            }
            const rawTech = document.getElementById('pj-tech')?.value || '';
            const techs   = rawTech.split(',').map(t => t.trim()).filter(Boolean);
            return {
                title: {
                    ar: titleAr || titleEn,
                    en: titleEn || titleAr
                },
                desc: {
                    ar: document.getElementById('pj-desc-ar')?.value.trim() || '',
                    en: document.getElementById('pj-desc-en')?.value.trim() || ''
                },
                technologies: techs,
                link:    document.getElementById('pj-link')?.value.trim() || '#',
                liveUrl: document.getElementById('pj-live')?.value.trim() || '',
                details: {
                    challenges: {
                        ar: document.getElementById('pj-chal-ar')?.value.trim() || '',
                        en: document.getElementById('pj-chal-en')?.value.trim() || ''
                    },
                    results: {
                        ar: document.getElementById('pj-res-ar')?.value.trim() || '',
                        en: document.getElementById('pj-res-en')?.value.trim() || ''
                    }
                }
            };
        }
    });

    if (value) {
        if (!appData.projects) appData.projects = [];
        if (isEdit) appData.projects[index] = value;
        else        appData.projects.push(value);
        renderAll();
        showToast(isEdit ? 'تم تعديل المشروع ✅' : 'تمت إضافة المشروع ✅', 'success');
    }
}

// ── Profile editor ─────────────────────────────────────────────────────────
async function manageProfile() {
    if (!isAdmin) return;
    await loadVendor('swal');
    const p = appData.profile || {};
    const v = (k) => p[k] || '';
    const vb = (k, lang) => (typeof p[k] === 'object' ? p[k][lang] : p[k]) || '';

    const { value } = await Swal.fire({
        title: currentLang === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile',
        html: `<div class="text-right space-y-3" dir="rtl">

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">الاسم (AR)</label>
              <input id="pf-name-ar" class="swal2-input m-0 w-full text-right" value="${escapeHTML(vb('name','ar'))}" dir="rtl">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Name (EN)</label>
              <input id="pf-name-en" class="swal2-input m-0 w-full text-left" value="${escapeHTML(vb('name','en'))}" dir="ltr">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">المسمى الوظيفي (AR)</label>
              <input id="pf-title-ar" class="swal2-input m-0 w-full text-right" value="${escapeHTML(vb('title','ar'))}" dir="rtl">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Title (EN)</label>
              <input id="pf-title-en" class="swal2-input m-0 w-full text-left" value="${escapeHTML(vb('title','en'))}" dir="ltr">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">النبذة (AR)</label>
              <textarea id="pf-summary-ar" class="swal2-textarea m-0 w-full h-20 text-right" dir="rtl">${escapeHTML(vb('summary','ar'))}</textarea>
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Summary (EN)</label>
              <textarea id="pf-summary-en" class="swal2-textarea m-0 w-full h-20 text-left" dir="ltr">${escapeHTML(vb('summary','en'))}</textarea>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">الموقع (AR)</label>
              <input id="pf-location-ar" class="swal2-input m-0 w-full text-right" value="${escapeHTML(vb('location','ar'))}" dir="rtl">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Location (EN)</label>
              <input id="pf-location-en" class="swal2-input m-0 w-full text-left" value="${escapeHTML(vb('location','en'))}" dir="ltr">
            </div>
          </div>

          <div>
            <label class="block text-xs mb-1 text-gray-500">البريد الإلكتروني / Email</label>
            <input id="pf-email" class="swal2-input m-0 w-full" value="${escapeHTML(v('email'))}" dir="ltr" type="email">
          </div>
          <div>
            <label class="block text-xs mb-1 text-gray-500">رقم الجوال / Phone</label>
            <input id="pf-phone" class="swal2-input m-0 w-full" value="${escapeHTML(v('phone'))}" dir="ltr">
          </div>
          <div>
            <label class="block text-xs mb-1 text-gray-500">رابط LinkedIn</label>
            <input id="pf-linkedin" class="swal2-input m-0 w-full" value="${escapeHTML(v('linkedin'))}" dir="ltr" placeholder="https://www.linkedin.com/in/osama-alharbi-it/">
          </div>
          <div>
            <label class="block text-xs mb-1 text-gray-500">رابط GitHub</label>
            <input id="pf-github" class="swal2-input m-0 w-full" value="${escapeHTML(v('github'))}" dir="ltr" placeholder="https://github.com/...">
          </div>
          <div>
            <label class="block text-xs mb-1 text-gray-500">رابط السيرة الذاتية (PDF path)</label>
            <input id="pf-cv" class="swal2-input m-0 w-full" value="${escapeHTML(v('cv'))}" dir="ltr" placeholder="Osama_Alharbi.pdf">
          </div>

        </div>`,
        width: '740px',
        confirmButtonText: 'حفظ التغييرات',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        focusConfirm: false,
        preConfirm: () => ({
            name:     { ar: document.getElementById('pf-name-ar').value,     en: document.getElementById('pf-name-en').value },
            title:    { ar: document.getElementById('pf-title-ar').value,    en: document.getElementById('pf-title-en').value },
            summary:  { ar: document.getElementById('pf-summary-ar').value,  en: document.getElementById('pf-summary-en').value },
            location: { ar: document.getElementById('pf-location-ar').value, en: document.getElementById('pf-location-en').value },
            email:    document.getElementById('pf-email').value,
            phone:    document.getElementById('pf-phone').value,
            linkedin: document.getElementById('pf-linkedin').value,
            github:   document.getElementById('pf-github').value,
            cv:       document.getElementById('pf-cv').value,
            // preserve unchanged fields
            image:       appData.profile?.image || '',
            nationality: appData.profile?.nationality || { ar: 'سعودي', en: 'Saudi' }
        })
    });

    if (value) {
        appData.profile = value;
        renderAll();
        showToast(currentLang === 'ar' ? 'تم تحديث الملف الشخصي ✅' : 'Profile updated ✅', 'success');
    }
}

async function deleteItem(type, index) {
    if (!isAdmin) return;
    await loadVendor('swal');
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟', text: 'لن تتمكن من التراجع!', icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33',
        confirmButtonText: 'نعم، احذف', cancelButtonText: 'تراجع'
    });
    if (result.isConfirmed) { appData[type].splice(index, 1); renderAll(); showToast('تم الحذف', 'success'); }
}

// =====================================================
// 20. DRAG & DROP (Sortable)
// =====================================================
function reorderSection(type, oldIdx, newIdx) {
    const moved = appData[type].splice(oldIdx, 1)[0];
    appData[type].splice(newIdx, 0, moved);
    renderAll();
}

// Writes the visible items (identified by their real indices, in their new on-screen
// order) back into the same array slots they occupied. Works for filtered views.
function applyVisualOrder(type, newOrder) {
    const arr   = appData[type] || [];
    const slots = [...newOrder].sort((x, y) => x - y);
    const items = newOrder.map(i => arr[i]);
    slots.forEach((slot, k) => { arr[slot] = items[k]; });
    renderAll();
}

function makeSortable(el, onEnd) {
    if (!el || Sortable.get(el)) return;   // renderAll() runs often; never stack instances
    new Sortable(el, { animation: 150, handle: '.drag-handle', ghostClass: 'opacity-40', onEnd });
}

function initSortable() {
    ['experience','education','volunteer','certificates','workshops','languages'].forEach(type => {
        makeSortable(document.getElementById(`${type}-container`), evt => reorderSection(type, evt.oldIndex, evt.newIndex));
    });

    // Projects and skills can be filtered, so read the real indices from the DOM after the move
    const projEl = document.getElementById('projects-container');
    makeSortable(projEl, () => applyVisualOrder('projects',
        [...projEl.querySelectorAll('.sortable-item')].map(item => Number(item.dataset.index))));

    const skillsEl = document.getElementById('skills-container');
    makeSortable(skillsEl, () => applyVisualOrder('skills',
        [...skillsEl.querySelectorAll('.sortable-item')].map(item => Number(item.dataset.realIndex))));
}

// =====================================================
// 21. INLINE EDITING
// =====================================================
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
    await loadVendor('swal');
    const { value } = await Swal.fire({
        title: 'تغيير الصورة الشخصية', input: 'url',
        inputLabel: 'رابط الصورة (Imgur, GitHub, Drive)', inputPlaceholder: 'https://...'
    });
    if (value) { setDeepValue(appData, key, value); renderAll(); }
}

// =====================================================
// 22. AUTH & GITHUB SYNC
// =====================================================
function readSession() {
    return {
        token:     sessionStorage.getItem(SESSION_KEYS.token),
        repo:      sessionStorage.getItem(SESSION_KEYS.repo),
        loginTime: Number(sessionStorage.getItem(SESSION_KEYS.loginTime)) || 0
    };
}

function isSessionExpired(loginTime) {
    return !loginTime || Date.now() - loginTime > SESSION_DURATION;
}

function clearSession() {
    Object.values(SESSION_KEYS).forEach(k => sessionStorage.removeItem(k));
    githubInfo = { token: '', repo: '' };
    if (sessionTimer) { clearTimeout(sessionTimer); sessionTimer = null; }
}

// Older versions kept the token (and a data backup) in localStorage forever.
function purgeLegacyAdminStorage() {
    ['saved_token', 'login_time', 'backup_data'].forEach(k => localStorage.removeItem(k));
}

function scheduleSessionExpiry(loginTime) {
    if (sessionTimer) clearTimeout(sessionTimer);
    sessionTimer = setTimeout(expireSession, Math.max(0, loginTime + SESSION_DURATION - Date.now()));
}

function expireSession() {
    clearSession();
    showToast('انتهت الجلسة، يرجى تسجيل الدخول مجدداً / Session expired', 'error');
    setTimeout(() => location.reload(), 1500);
}

function checkSession() {
    const { token, repo, loginTime } = readSession();
    if (!token) return;
    if (isSessionExpired(loginTime)) { expireSession(); return; }
    githubInfo.repo  = repo;
    githubInfo.token = token;
    scheduleSessionExpiry(loginTime);
    enableAdminMode();
}

function setupSecretTrigger() {
    document.getElementById('secret-trigger').addEventListener('click', () => {
        clickCount++;
        if (clickCount >= 3) { document.getElementById('admin-modal').classList.remove('hidden'); clickCount = 0; }
    });
}

function githubHeaders(token) {
    return {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
    };
}

async function authenticateAndEdit() {
    const repoInput  = document.getElementById('repo-input');
    const tokenInput = document.getElementById('token-input');
    const repo  = repoInput.value.trim();
    const token = tokenInput.value.trim();
    if (!repo || !token) return showToast('يرجى إدخال البيانات كاملة', 'error');
    if (!REPO_PATTERN.test(repo)) return showToast('صيغة المستودع غير صحيحة (owner/repo)', 'error');

    // Verify access before enabling admin mode, so a bad token fails here and not on save.
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}`, { headers: githubHeaders(token) });
        if (!res.ok) throw new Error(String(res.status));
    } catch {
        return showToast('تعذّر الوصول للمستودع. تحقق من الـ Token / Could not access the repository', 'error');
    }

    tokenInput.value = '';
    const loginTime = Date.now();
    sessionStorage.setItem(SESSION_KEYS.token, token);
    sessionStorage.setItem(SESSION_KEYS.repo, repo);
    sessionStorage.setItem(SESSION_KEYS.loginTime, String(loginTime));
    localStorage.setItem('saved_repo', repo);   // repo name only, not secret
    githubInfo.repo = repo; githubInfo.token = token;
    scheduleSessionExpiry(loginTime);
    document.getElementById('admin-modal').classList.add('hidden');
    enableAdminMode();
    showToast('تم تفعيل وضع المدير 🚀', 'success');
    if (!token.startsWith('github_pat_')) {
        setTimeout(() => showToast('⚠️ يُفضّل Fine-grained PAT مقيّد بهذا المستودع / Prefer a fine-grained PAT', 'info'), 800);
    }
}

function enableAdminMode() {
    isAdmin = true;
    document.body.classList.add('admin-mode');
    document.getElementById('admin-toolbar').classList.remove('hidden');
    if (dataLoaded) renderAll();
}

function logout() {
    clearSession();
    location.reload();
}

// btoa() only accepts Latin-1, so encode the UTF-8 bytes first.
function toBase64Utf8(text) {
    let binary = '';
    new TextEncoder().encode(text).forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
}

async function saveToGitHub() {
    if (isSessionExpired(readSession().loginTime)) { expireSession(); return; }
    const btn      = document.querySelector('#admin-toolbar button');
    const origHTML = btn.innerHTML;
    btn.innerHTML  = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const url    = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(url, { headers: githubHeaders(githubInfo.token) });
        if (!getRes.ok) throw new Error('فشل الاتصال. تحقق من الـ Token.');
        const fileData = await getRes.json();
        const json     = JSON.stringify(appData, null, 2);
        const putRes   = await fetch(url, {
            method: 'PUT',
            headers: { ...githubHeaders(githubInfo.token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Update via Admin Panel', content: toBase64Utf8(json), sha: fileData.sha })
        });
        if (!putRes.ok) throw new Error('فشل الحفظ في GitHub');
        lastSavedSnapshot = json;
        showToast('تم الحفظ في GitHub ✅', 'success');
    } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
    } finally { btn.innerHTML = origHTML; }
}

// Reverts unsaved edits to the last version loaded from or saved to GitHub (memory only).
function restoreBackup() {
    if (lastSavedSnapshot) { appData = JSON.parse(lastSavedSnapshot); renderAll(); showToast('تم التراجع إلى آخر نسخة محفوظة ✅', 'success'); }
    else showToast('لا توجد نسخة احتياطية', 'error');
}

// =====================================================
// 22b. UI ACTIONS (event delegation, no inline handlers)
// =====================================================
const ACTIONS = {
    'toggle-language':       () => toggleLanguage(),
    'toggle-menu':           () => toggleMobileMenu(),
    'share':                 () => shareProfile(),
    'print':                 () => triggerPrint(),
    'scroll-top':            () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    'send-mail':             () => sendMailto(),
    'contact':               el => contactAction(el.dataset.contact),
    'set-skill-tab':         el => setSkillTab(el.dataset.tab),
    'set-filter':            el => setProjectFilter(el.dataset.filter),
    'open-project':          el => openProjectModal(Number(el.dataset.index)),
    'close-project-modal':   () => _closeProjectModal(),
    'project-modal-backdrop': (el, e) => { if (e.target === el) _closeProjectModal(); },
    'run-command':           el => {
        document.getElementById('cmd-palette').classList.add('hidden');
        cmdItems[Number(el.dataset.index)]?.action();
    },
    'close-admin-modal':     () => document.getElementById('admin-modal').classList.add('hidden'),
    'login':                 () => authenticateAndEdit(),
    'logout':                () => logout(),
    'save':                  () => saveToGitHub(),
    'analytics':             () => showAnalyticsDashboard(),
    'restore-backup':        () => restoreBackup(),
    'manage-profile':        () => manageProfile(),
    'edit-image':            el => editImage(el.dataset.path),
    'add-item':              el => addItem(el.dataset.type),
    'edit-item':             el => editItem(el.dataset.type, Number(el.dataset.index)),
    'delete-item':           el => deleteItem(el.dataset.type, Number(el.dataset.index))
};

function runAction(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    // A real link inside an action area (e.g. "Live Demo" on a project card) keeps its own behaviour.
    const link = e.target.closest('a[href]');
    if (link && link !== el && el.contains(link)) return;
    const action = ACTIONS[el.dataset.action];
    if (!action) return;
    Promise.resolve()
        .then(() => action(el, e))
        .catch(() => showToast(currentLang === 'ar' ? 'حدث خطأ، حاول مجدداً' : 'Something went wrong, please retry', 'error'));
}

function setupActions() {
    document.addEventListener('click', runAction);
    // Keyboard support for non-button elements acting as buttons
    document.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const el = e.target.closest('[data-action][role="button"]');
        if (!el || el !== e.target) return;
        e.preventDefault();
        runAction(e);
    });
    document.getElementById('contact-message')?.addEventListener('input', e => updateCharCounter(e.target));
    document.getElementById('cmd-input')?.addEventListener('input', e => filterCmd(e.target.value));
}

// =====================================================
// 23. UTILITIES
// =====================================================
// Heavy libraries are fetched only when a feature needs them, pinned and with SRI.
const CDN = 'https://cdn.jsdelivr.net/npm/';
const VENDOR = {
    swal: {
        styles:  [{ href: 'sweetalert2@11.26.25/dist/sweetalert2.min.css', integrity: 'sha384-dCW5imOdApH6OwpFau8cZNKjqVbJYnCA5q+8YsMYP3XwXKsV6Jfz1u6MZLnXaBsS' }],
        scripts: [{ src: 'sweetalert2@11.26.25/dist/sweetalert2.min.js', integrity: 'sha384-hW8ZCQHtRH+nVOAkHZ4amZvYsAtKn1ZOvMV6dNag1Rb1thWmLZMBKTRxFV0cOxiK' }]
    },
    sortable: {
        scripts: [{ src: 'sortablejs@1.15.0/Sortable.min.js', integrity: 'sha384-eeLEhtwdMwD3X9y+8P3Cn7Idl/M+w8H4uZqkgD/2eJVkWIN1yKzEj6XegJ9dL3q0' }]
    },
    pdf: {
        scripts: [
            { src: 'jspdf@2.5.1/dist/jspdf.umd.min.js',       integrity: 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk' },
            { src: 'html2canvas@1.4.1/dist/html2canvas.min.js', integrity: 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H' }
        ]
    }
};
const vendorLoads = {};

function injectAsset(tag, url, integrity) {
    return new Promise((resolve, reject) => {
        const el = document.createElement(tag);
        if (tag === 'link') { el.rel = 'stylesheet'; el.href = url; } else { el.src = url; }
        el.integrity   = integrity;
        el.crossOrigin = 'anonymous';
        el.onload  = resolve;
        el.onerror = () => { el.remove(); reject(new Error(`Failed to load ${url}`)); };
        document.head.appendChild(el);
    });
}

function loadVendor(name) {
    if (!vendorLoads[name]) {
        const { styles = [], scripts = [] } = VENDOR[name];
        vendorLoads[name] = Promise.all([
            ...styles.map(f => injectAsset('link', CDN + f.href, f.integrity)),
            ...scripts.map(f => injectAsset('script', CDN + f.src, f.integrity))
        ]).catch(err => { delete vendorLoads[name]; throw err; });
    }
    return vendorLoads[name];
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Every value from data.json that goes into an HTML string must pass through this.
function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

// External links are accepted only when they are absolute https:// URLs.
function safeUrl(value) {
    const raw = String(value ?? '').trim();
    if (!/^https:\/\//i.test(raw)) return '';
    try { return new URL(raw).href; } catch { return ''; }
}

// Images/files may also be relative paths inside this site (e.g. images/me.jpg).
function safeAssetUrl(value) {
    const raw = String(value ?? '').trim();
    if (/^[\w\-./]+$/.test(raw) && !raw.startsWith('//') && !raw.includes('..')) return raw;
    return safeUrl(raw);
}

function skillLevel(skill) {
    const n = Number(skill?.level);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
}

function setSmartGreeting() {
    const hour = new Date().getHours();
    const msgs = {
        ar: { m:'صباح الخير ☀️', a:'مساء الخير 🌤️', e:'مساء النور 🌙' },
        en: { m:'Good Morning ☀️', a:'Good Afternoon 🌤️', e:'Good Evening 🌙' }
    };
    const key = hour < 12 ? 'm' : (hour < 18 ? 'a' : 'e');
    const el  = document.getElementById('smart-greeting');
    if (el) el.innerText = msgs[currentLang][key];
}

function typeWriter(text, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (twInterval) clearInterval(twInterval);
    el.textContent = '';
    let i = 0;
    twInterval = setInterval(() => {
        el.textContent += text.charAt(i);
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

function filterCmd(val) {
    document.querySelectorAll('#cmd-list > div').forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(val.toLowerCase()) ? 'flex' : 'none';
    });
}

function setDeepValue(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
    cur[keys[keys.length - 1]] = value;
}

function showToast(msg, type = 'info') {
    const colors = { success: '#10B981', error: '#EF4444', info: '#3b82f6' };
    Toastify({ text: msg, duration: 3500, gravity: 'top', position: 'center', style: { background: colors[type] || colors.info } }).showToast();
}
