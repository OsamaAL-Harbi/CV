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
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xqarljpg";
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
    setupKonamiCode();
    registerPWA();
    setupScrollTop();
    checkLinkedInReferrer();
    initStatsObserver();

    if (localStorage.getItem('saved_repo')) {
        const ri = document.getElementById('repo-input');
        const ti = document.getElementById('token-input');
        if (ri) ri.value = localStorage.getItem('saved_repo');
        if (ti) ti.value = localStorage.getItem('saved_token');
    }

    // Hash routing — must run after data loads
    loadContent().then(() => {
        checkSession();
        handleHash();                  // respect URL hash on first load
    });

    // React to hash changes (back/forward browser buttons + nav links)
    window.addEventListener('hashchange', handleHash);
});

function registerPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
}

// =====================================================
// LAZY LOADING SYSTEM
// =====================================================
function initLazyLoading() {
    // Lazy load images
    const imgObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.add('loaded');
                imgObserver.unobserve(img);
            }
        });
    }, { rootMargin: '50px' });

    document.querySelectorAll('img[data-src]').forEach(img => imgObserver.observe(img));

    // Lazy load sections
    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                sectionObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.lazy-section').forEach(sec => sectionObserver.observe(sec));
}

// Call in DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // ... existing code ...
    loadContent().then(() => {
        checkSession();
        handleHash();
        initLazyLoading(); // ← ADD THIS
    });
});

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
    if (isAdmin) initSortable();
    setTimeout(() => AOS.refresh(), 50);
}

// ─── Profile ──────────────────────────────────────────
function renderProfile() {
    const p = appData.profile;
    if (!p) return;

    updateText('profile.name',    t(p.name));
    updateText('profile.summary', t(p.summary));

    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(t(p.name))}&background=0D8ABC&color=fff&size=200`;
    const imgEl = document.getElementById('profile-img');
    if (imgEl) { imgEl.src = p.image || fallback; imgEl.onerror = () => { imgEl.src = fallback; }; }

    if (twInterval) clearInterval(twInterval);
    typeWriter(t(p.title), 'typewriter');

    const locEl = document.getElementById('profile-location');
    if (locEl) locEl.textContent = t(p.location);

    const emailDisplay = document.getElementById('contact-email-display');
    if (emailDisplay) emailDisplay.textContent = p.email;
    const locDisplay = document.getElementById('contact-location-display');
    if (locDisplay) locDisplay.textContent = t(p.location);
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
        <h3 class="text-xl font-bold dark:text-white hover:text-primary transition">${t(item.role)}</h3>
        <p class="text-primary font-medium text-sm">${t(item.company)}</p>
        <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs mb-3 font-bold">${t(item.period)}</span>
        <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${t(item.description)}</p>`;
}
function renderEducationItem(item) {
    return `
        <h3 class="text-xl font-bold dark:text-white hover:text-blue-500 transition">${t(item.degree)}</h3>
        <p class="text-blue-500 font-medium text-sm">${t(item.institution)}</p>
        <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs mb-3 font-bold">${t(item.period)}</span>
        <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${t(item.description)}</p>`;
}
function renderVolunteerItem(item) {
    return `
        <h3 class="text-xl font-bold dark:text-white hover:text-orange-500 transition">${t(item.role)}</h3>
        <p class="text-orange-500 font-medium text-sm">${t(item.organization)}</p>
        <div class="flex flex-wrap gap-2 mb-3">
            <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs font-bold">${t(item.period)}</span>
            ${item.hours ? `<span class="inline-block bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded text-xs font-bold">${item.hours} ${currentLang === 'ar' ? 'ساعة' : 'hrs'}</span>` : ''}
        </div>
        <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${t(item.description)}</p>`;
}
function renderCertItem(item) {
    return `
        <div class="text-2xl text-secondary flex-shrink-0"><i class="fas fa-certificate"></i></div>
        <div class="flex-1 min-w-0">
            <h4 class="font-bold text-sm dark:text-white">${t(item.name)}</h4>
            <p class="text-xs text-gray-500 mt-1">${t(item.issuer)}${item.credential ? ` · ${item.credential}` : ''}</p>
            ${item.date ? `<p class="text-xs text-gray-400 mt-0.5">${item.date}</p>` : ''}
        </div>`;
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
        </div>`;
}
function renderLanguageItem(item) {
    return `
        <i class="fas fa-language text-teal-500 text-lg flex-shrink-0"></i>
        <div>
            <p class="font-bold text-sm dark:text-white">${t(item.name)}</p>
            <p class="text-xs text-gray-500">${t(item.level)}</p>
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
    const hasLive   = item.liveUrl && item.liveUrl.trim() !== '' && item.liveUrl !== '#';

    return `
        <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900
                    flex items-center justify-center relative overflow-hidden rounded-t-2xl cursor-pointer"
             onclick="openProjectModal(${realIdx})">
            <i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500"></i>
            <div class="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition duration-300 backdrop-blur-sm">
                <span class="px-4 py-2 bg-white text-gray-900 rounded-full font-bold text-sm transform translate-y-4 group-hover:translate-y-0 transition duration-300 shadow-xl">
                    ${currentLang === 'ar' ? 'التفاصيل' : 'Details'}
                </span>
                ${hasLive ? `<a href="${item.liveUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()"
                    class="px-4 py-2 bg-green-500 text-white rounded-full font-bold text-sm transform translate-y-4 group-hover:translate-y-0 transition duration-500 shadow-xl">
                    Live Demo</a>` : ''}
            </div>
            ${count > 0 ? `
                <span class="absolute top-3 right-3 ltr:left-3 ltr:right-auto bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 pointer-events-none">
                    <i class="fas fa-eye" style="font-size:10px"></i>&nbsp;${count} ${viewLabel}
                </span>` : ''}
            ${hasLive ? `<span class="absolute top-3 left-3 ltr:right-3 ltr:left-auto bg-green-500/90 text-white text-xs px-2 py-1 rounded-full font-bold pointer-events-none">Live</span>` : ''}
        </div>
        <div class="p-5 flex-grow flex flex-col">
            <h3 class="text-base font-bold mb-2 dark:text-white">${t(item.title)}</h3>
            <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed flex-grow">${t(item.desc)}</p>
            ${item.technologies?.length ? `
                <div class="flex flex-wrap gap-1.5 mt-3">
                    ${item.technologies.map(tech =>
                        `<span class="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-bold">${tech}</span>`
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
        <button onclick="setProjectFilter('${key}')"
                class="filter-btn px-3 py-1.5 text-xs font-bold rounded-full border border-gray-200 dark:border-gray-700 transition hover:border-primary hover:text-primary ${activeFilter === key ? 'active bg-primary text-white border-primary' : 'bg-white dark:bg-cardBg text-gray-600 dark:text-gray-300'}">
            ${label}
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
                <button onclick="setProjectFilter('all')" class="mt-4 text-primary text-sm font-bold hover:underline">${STATIC_TEXT[currentLang]?.filter_all}</button>
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
                <span class="text-sm font-bold dark:text-white">${t(skill)}</span>
                <span class="text-xs font-bold text-gray-400">${skill.level || 0}%</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div class="skill-bar-fill h-2.5 rounded-full ${barColor}" style="--target-width: ${skill.level || 0}%"></div>
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
        entries.forEach(entry => { if (entry.isIntersecting && !skillBarsAnimated) animateSkillBars(); });
    }, { threshold: 0.2 });
    observer.observe(container);
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
            `<span class="text-xs px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-bold">${tech}</span>`
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
        if (item.link && item.link !== '#') { githubLink.href = item.link; githubLink.style.display = 'inline-flex'; }
        else githubLink.style.display = 'none';
    }

    // Live Demo link
    const liveLink = document.getElementById('modal-live-link');
    if (liveLink) {
        if (item.liveUrl && item.liveUrl.trim() !== '' && item.liveUrl !== '#') {
            liveLink.href = item.liveUrl; liveLink.style.display = 'inline-flex';
        } else liveLink.style.display = 'none';
    }

    // Re-render cards to update badge
    renderFilteredProjects();

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
function showAnalyticsDashboard() {
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
            <td class="py-2 px-3 font-medium text-xs">${t(proj.title)}</td>
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
    await new Promise(r => setTimeout(r, 600));
    try {
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
    } else if (type === 'linkedin') {
        window.open(p.linkedin, '_blank', 'noopener');
    } else if (type === 'github') {
        window.open(p.github, '_blank', 'noopener');
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
        ), 250);
    }
}

// =====================================================
// 18. ADMIN BUTTONS
// =====================================================
function renderAdminButtons(type, index) {
    if (!isAdmin) return '';
    const key = `${type}-${index}`;
    const isSelected = selectedItems.has(key);
    
    return `
        <div class="admin-element absolute top-2 right-2 ltr:left-2 ltr:right-auto z-30
                    gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
            ${bulkMode ? `
                <input type="checkbox" 
                       ${isSelected ? 'checked' : ''}
                       onclick="toggleItemSelection('${type}', ${index})"
                       class="w-5 h-5 rounded border-2 border-primary cursor-pointer">
            ` : `
                <span class="drag-handle bg-white dark:bg-gray-700 text-gray-500 w-7 h-7 rounded-lg shadow
                             flex items-center justify-center hover:bg-gray-100 cursor-move border border-gray-200 dark:border-gray-600">
                    <i class="fas fa-grip-vertical" style="font-size:10px"></i>
                </span>
            `}
            <button onclick="event.stopPropagation(); editItem('${type}', ${index})"
                    class="bg-blue-500 text-white w-7 h-7 rounded-lg shadow flex items-center justify-center hover:bg-blue-600 hover:scale-110 transition">
                <i class="fas fa-pen" style="font-size:10px"></i>
            </button>
            <button onclick="event.stopPropagation(); deleteItem('${type}', ${index})"
                    class="bg-red-500 text-white w-7 h-7 rounded-lg shadow flex items-center justify-center hover:bg-red-600 hover:scale-110 transition">
                <i class="fas fa-trash" style="font-size:10px"></i>
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
                <input id="swal-${f.key}" class="swal2-input m-0 w-full" value="${val}" dir="ltr">
            </div>`;
        }
        const valAr = getVal(item, f, 'ar');
        const valEn = getVal(item, f, 'en');
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
                        : raw;
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
              <input id="pj-title-ar" class="swal2-input m-0 w-full text-right" value="${bv(item.title,'ar')}" dir="rtl" placeholder="اسم المشروع بالعربي">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Project Title (EN)</label>
              <input id="pj-title-en" class="swal2-input m-0 w-full text-left" value="${bv(item.title,'en')}" dir="ltr" placeholder="Project name in English">
            </div>
          </div>

          <!-- Description -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">وصف المشروع (AR)</label>
              <textarea id="pj-desc-ar" class="swal2-textarea m-0 w-full h-20 text-right" dir="rtl" placeholder="وصف مختصر...">${bv(item.desc,'ar')}</textarea>
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Description (EN)</label>
              <textarea id="pj-desc-en" class="swal2-textarea m-0 w-full h-20 text-left" dir="ltr" placeholder="Short description...">${bv(item.desc,'en')}</textarea>
            </div>
          </div>

          <!-- Technologies -->
          <div>
            <label class="block text-xs mb-1 text-gray-500">
              التقنيات المستخدمة / Technologies
              <span class="text-gray-400 mr-1">(مفصولة بفاصلة — e.g. SQL, HTML5, CSS3)</span>
            </label>
            <input id="pj-tech" class="swal2-input m-0 w-full" value="${techVal}" dir="ltr" placeholder="SQL, MySQL, HTML5, CSS3, JavaScript">
          </div>

          <!-- Challenges -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">التحديات (AR)</label>
              <textarea id="pj-chal-ar" class="swal2-textarea m-0 w-full h-20 text-right" dir="rtl" placeholder="التحديات التي واجهتها...">${challAr}</textarea>
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Challenges (EN)</label>
              <textarea id="pj-chal-en" class="swal2-textarea m-0 w-full h-20 text-left" dir="ltr" placeholder="Challenges faced...">${challEn}</textarea>
            </div>
          </div>

          <!-- Results -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">النتائج والإنجازات (AR)</label>
              <textarea id="pj-res-ar" class="swal2-textarea m-0 w-full h-20 text-right" dir="rtl" placeholder="النتائج والإنجازات...">${resultsAr}</textarea>
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Results & Achievements (EN)</label>
              <textarea id="pj-res-en" class="swal2-textarea m-0 w-full h-20 text-left" dir="ltr" placeholder="Results achieved...">${resultsEn}</textarea>
            </div>
          </div>

          <!-- Links -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500">رابط GitHub</label>
              <input id="pj-link" class="swal2-input m-0 w-full" value="${item.link || ''}" dir="ltr" placeholder="https://github.com/...">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500">رابط Live Demo</label>
              <input id="pj-live" class="swal2-input m-0 w-full" value="${item.liveUrl || ''}" dir="ltr" placeholder="https://...">
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
    const p = appData.profile || {};
    const v = (k) => p[k] || '';
    const vb = (k, lang) => (typeof p[k] === 'object' ? p[k][lang] : p[k]) || '';

    const { value } = await Swal.fire({
        title: currentLang === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile',
        html: `<div class="text-right space-y-3" dir="rtl">

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">الاسم (AR)</label>
              <input id="pf-name-ar" class="swal2-input m-0 w-full text-right" value="${vb('name','ar')}" dir="rtl">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Name (EN)</label>
              <input id="pf-name-en" class="swal2-input m-0 w-full text-left" value="${vb('name','en')}" dir="ltr">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">المسمى الوظيفي (AR)</label>
              <input id="pf-title-ar" class="swal2-input m-0 w-full text-right" value="${vb('title','ar')}" dir="rtl">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Title (EN)</label>
              <input id="pf-title-en" class="swal2-input m-0 w-full text-left" value="${vb('title','en')}" dir="ltr">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">النبذة (AR)</label>
              <textarea id="pf-summary-ar" class="swal2-textarea m-0 w-full h-20 text-right" dir="rtl">${vb('summary','ar')}</textarea>
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Summary (EN)</label>
              <textarea id="pf-summary-en" class="swal2-textarea m-0 w-full h-20 text-left" dir="ltr">${vb('summary','en')}</textarea>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">الموقع (AR)</label>
              <input id="pf-location-ar" class="swal2-input m-0 w-full text-right" value="${vb('location','ar')}" dir="rtl">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Location (EN)</label>
              <input id="pf-location-en" class="swal2-input m-0 w-full text-left" value="${vb('location','en')}" dir="ltr">
            </div>
          </div>

          <div>
            <label class="block text-xs mb-1 text-gray-500">البريد الإلكتروني / Email</label>
            <input id="pf-email" class="swal2-input m-0 w-full" value="${v('email')}" dir="ltr" type="email">
          </div>
          <div>
            <label class="block text-xs mb-1 text-gray-500">رقم الجوال / Phone</label>
            <input id="pf-phone" class="swal2-input m-0 w-full" value="${v('phone')}" dir="ltr">
          </div>
          <div>
            <label class="block text-xs mb-1 text-gray-500">رابط LinkedIn</label>
            <input id="pf-linkedin" class="swal2-input m-0 w-full" value="${v('linkedin')}" dir="ltr" placeholder="https://linkedin.com/in/...">
          </div>
          <div>
            <label class="block text-xs mb-1 text-gray-500">رابط GitHub</label>
            <input id="pf-github" class="swal2-input m-0 w-full" value="${v('github')}" dir="ltr" placeholder="https://github.com/...">
          </div>
          <div>
            <label class="block text-xs mb-1 text-gray-500">رابط السيرة الذاتية (PDF path)</label>
            <input id="pf-cv" class="swal2-input m-0 w-full" value="${v('cv')}" dir="ltr" placeholder="Osama_Alharbi_IT_CV.pdf">
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

function deleteItem(type, index) {
    if (!isAdmin) return;
    Swal.fire({
        title: 'هل أنت متأكد؟', text: 'لن تتمكن من التراجع!', icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33',
        confirmButtonText: 'نعم، احذف', cancelButtonText: 'تراجع'
    }).then(result => {
        if (result.isConfirmed) { appData[type].splice(index, 1); renderAll(); showToast('تم الحذف', 'success'); }
    });
}

// =====================================================
// 20. DRAG & DROP (Sortable)
// =====================================================
function reorderSection(type, oldIdx, newIdx) {
    const moved = appData[type].splice(oldIdx, 1)[0];
    appData[type].splice(newIdx, 0, moved);
    renderAll();
}

function reorderSkills(tab, oldFilteredIdx, newFilteredIdx) {
    const all      = appData.skills || [];
    const filtered = all.filter(s => s.category === tab);
    const moved    = filtered[oldFilteredIdx];
    const target   = filtered[newFilteredIdx];
    const realOld  = all.indexOf(moved);
    const realNew  = all.indexOf(target);
    if (realOld === -1 || realNew === -1) return;
    all.splice(realOld, 1);
    all.splice(realNew > realOld ? realNew - 1 : realNew, 0, moved);
    renderAll();
}

function initSortable() {
    ['experience','education','volunteer','certificates','workshops','languages'].forEach(type => {
        const el = document.getElementById(`${type}-container`);
        if (!el) return;
        new Sortable(el, {
            animation: 150, handle: '.drag-handle', ghostClass: 'opacity-40',
            onEnd(evt) { reorderSection(type, evt.oldIndex, evt.newIndex); }
        });
    });

    // Projects: sortable on full array (filter is visual only)
    const projEl = document.getElementById('projects-container');
    if (projEl) {
        new Sortable(projEl, {
            animation: 150, handle: '.drag-handle', ghostClass: 'opacity-40',
            onEnd(evt) {
                // Get real indices from data-index attributes
                const items  = [...projEl.querySelectorAll('.sortable-item')];
                const oldReal = parseInt(items[evt.oldIndex]?.dataset.index ?? evt.oldIndex);
                const newReal = parseInt(items[evt.newIndex]?.dataset.index ?? evt.newIndex);
                reorderSection('projects', oldReal, newReal);
            }
        });
    }

    const skillsEl = document.getElementById('skills-container');
    if (skillsEl) {
        new Sortable(skillsEl, {
            animation: 150, handle: '.drag-handle', ghostClass: 'opacity-40',
            onEnd(evt) { reorderSkills(activeSkillTab, evt.oldIndex, evt.newIndex); }
        });
    }
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
    const { value } = await Swal.fire({
        title: 'تغيير الصورة الشخصية', input: 'url',
        inputLabel: 'رابط الصورة (Imgur, GitHub, Drive)', inputPlaceholder: 'https://...'
    });
    if (value) { setDeepValue(appData, key, value); renderAll(); }
}

// =====================================================
// 22. AUTH & GITHUB SYNC
// =====================================================
function checkSession() {
    const loginTime = localStorage.getItem('login_time');
    if (!localStorage.getItem('saved_token')) return;
    if (loginTime && (Date.now() - Number(loginTime) > SESSION_DURATION)) {
        logout(); showToast('انتهت الجلسة، يرجى تسجيل الدخول مجدداً', 'error'); return;
    }
    githubInfo.repo  = localStorage.getItem('saved_repo');
    githubInfo.token = localStorage.getItem('saved_token');
    enableAdminMode();
}

function setupSecretTrigger() {
    document.getElementById('secret-trigger').addEventListener('click', () => {
        clickCount++;
        if (clickCount >= 3) { document.getElementById('admin-modal').classList.remove('hidden'); clickCount = 0; }
    });
}

function authenticateAndEdit() {
    const repo  = document.getElementById('repo-input').value.trim();
    const token = document.getElementById('token-input').value.trim();
    if (!repo || !token) return showToast('يرجى إدخال البيانات كاملة', 'error');
    localStorage.setItem('saved_repo', repo); localStorage.setItem('saved_token', token);
    localStorage.setItem('login_time', Date.now());
    githubInfo.repo = repo; githubInfo.token = token;
    document.getElementById('admin-modal').classList.add('hidden');
    enableAdminMode();
    showToast('تم تفعيل وضع المدير 🚀', 'success');
}

function enableAdminMode() {
    isAdmin = true;
    document.body.classList.add('admin-mode');
    document.getElementById('admin-toolbar').classList.remove('hidden');
    if (dataLoaded) renderAll();
    initSkillsObserver();
}

function logout() {
    ['saved_repo','saved_token','login_time'].forEach(k => localStorage.removeItem(k));
    location.reload();
}

async function saveToGitHub() {
    const btn      = document.querySelector('#admin-toolbar button');
    const origHTML = btn.innerHTML;
    btn.innerHTML  = '<i class="fas fa-spinner fa-spin"></i>';
    localStorage.setItem('backup_data', JSON.stringify(appData));
    try {
        const url    = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(url, { headers: { Authorization: `token ${githubInfo.token}` } });
        if (!getRes.ok) throw new Error('فشل الاتصال. تحقق من الـ Token.');
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
    } finally { btn.innerHTML = origHTML; }
}

function restoreBackup() {
    const data = localStorage.getItem('backup_data');
    if (data) { appData = JSON.parse(data); renderAll(); showToast('تم استعادة النسخة الاحتياطية ✅', 'success'); }
    else showToast('لا توجد نسخة احتياطية', 'error');
}

// =====================================================
// 23. UTILITIES
// =====================================================
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
// =====================================================
// REAL-TIME SEARCH
// =====================================================
let searchTimeout = null;

function initSearch() {
    const searchInput = document.getElementById('global-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => performSearch(e.target.value), 300);
    });
}

function performSearch(query) {
    if (!query.trim()) {
        renderAll();
        return;
    }

    const q = query.toLowerCase();
    const results = {
        experience: (appData.experience || []).filter(item => 
            t(item.role).toLowerCase().includes(q) || 
            t(item.company).toLowerCase().includes(q) ||
            t(item.description).toLowerCase().includes(q)
        ),
        projects: (appData.projects || []).filter(item =>
            t(item.title).toLowerCase().includes(q) ||
            t(item.desc).toLowerCase().includes(q) ||
            (item.technologies || []).some(tech => tech.toLowerCase().includes(q))
        ),
        skills: (appData.skills || []).filter(item =>
            t(item).toLowerCase().includes(q)
        ),
        certificates: (appData.certificates || []).filter(item =>
            t(item.name).toLowerCase().includes(q) ||
            t(item.issuer).toLowerCase().includes(q)
        )
    };

    // Re-render with filtered results
    renderSection('experience', results.experience, renderExperienceItem, WC.experience);
    renderFilteredProjectsWithData(results.projects);
    // ... render other sections
}
// =====================================================
// UNDO/REDO SYSTEM
// =====================================================
const historyStack = {
    past: [],
    future: [],
    maxSize: 50
};

function saveState(action = 'edit') {
    historyStack.past.push({
        data: JSON.parse(JSON.stringify(appData)),
        action,
        timestamp: Date.now()
    });
    
    if (historyStack.past.length > historyStack.maxSize) {
        historyStack.past.shift();
    }
    
    historyStack.future = []; // Clear redo stack
    updateUndoRedoUI();
}

function undo() {
    if (historyStack.past.length === 0) return;
    
    historyStack.future.push({
        data: JSON.parse(JSON.stringify(appData)),
        timestamp: Date.now()
    });
    
    const state = historyStack.past.pop();
    appData = state.data;
    renderAll();
    updateUndoRedoUI();
    showToast(`تراجع عن: ${state.action}`, 'info');
}

function redo() {
    if (historyStack.future.length === 0) return;
    
    historyStack.past.push({
        data: JSON.parse(JSON.stringify(appData)),
        timestamp: Date.now()
    });
    
    const state = historyStack.future.pop();
    appData = state.data;
    renderAll();
    updateUndoRedoUI();
    showToast('إعادة التنفيذ', 'info');
}

function updateUndoRedoUI() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = historyStack.past.length === 0;
    if (redoBtn) redoBtn.disabled = historyStack.future.length === 0;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (!isAdmin) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
    }
});

// Call saveState before any edit
function editItem(type, index) {
    saveState(`تعديل ${type}`);
    // ... existing edit logic
}
// =====================================================
// BULK OPERATIONS
// =====================================================
let bulkMode = false;
let selectedItems = new Set();

function toggleBulkMode() {
    bulkMode = !bulkMode;
    selectedItems.clear();
    document.body.classList.toggle('bulk-mode', bulkMode);
    renderAll();
    
    const btn = document.getElementById('bulk-mode-btn');
    if (btn) {
        btn.innerHTML = bulkMode 
            ? '<i class="fas fa-times"></i> إلغاء التحديد' 
            : '<i class="fas fa-check-square"></i> تحديد متعدد';
    }
}

function toggleItemSelection(type, index) {
    const key = `${type}-${index}`;
    if (selectedItems.has(key)) {
        selectedItems.delete(key);
    } else {
        selectedItems.add(key);
    }
    updateBulkUI();
}

function bulkDelete() {
    if (selectedItems.size === 0) return;
    
    Swal.fire({
        title: `حذف ${selectedItems.size} عنصر؟`,
        text: 'لن تتمكن من التراجع!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'نعم، احذف الكل',
        cancelButtonText: 'إلغاء'
    }).then(result => {
        if (result.isConfirmed) {
            saveState('حذف جماعي');
            
            // Group by type
            const byType = {};
            selectedItems.forEach(key => {
                const [type, idx] = key.split('-');
                if (!byType[type]) byType[type] = [];
                byType[type].push(parseInt(idx));
            });
            
            // Delete in reverse order to maintain indices
            Object.entries(byType).forEach(([type, indices]) => {
                indices.sort((a, b) => b - a).forEach(idx => {
                    appData[type].splice(idx, 1);
                });
            });
            
            selectedItems.clear();
            renderAll();
            showToast(`تم حذف ${selectedItems.size} عنصر`, 'success');
        }
    });
}

function bulkExport() {
    const data = {};
    selectedItems.forEach(key => {
        const [type, idx] = key.split('-');
        if (!data[type]) data[type] = [];
        data[type].push(appData[type][parseInt(idx)]);
    });
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bulk-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}
// =====================================================
// IMPORT/EXPORT SYSTEM
// =====================================================
async function exportFullData() {
    const exportData = {
        version: '4.0',
        exported: new Date().toISOString(),
        data: appData,
        metadata: {
            totalProjects: appData.projects?.length || 0,
            totalSkills: appData.skills?.length || 0,
            totalCerts: appData.certificates?.length || 0
        }
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portfolio-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('تم تصدير البيانات ✅', 'success');
}

async function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        try {
            const text = await file.text();
            const imported = JSON.parse(text);
            
            // Validate structure
            if (!imported.data || !imported.version) {
                throw new Error('ملف غير صالح');
            }
            
            // Confirm before import
            const { value } = await Swal.fire({
                title: 'استيراد البيانات؟',
                html: `
                    <div class="text-right" dir="rtl">
                        <p class="text-sm text-gray-600 mb-4">سيتم استبدال جميع البيانات الحالية</p>
                        <div class="bg-gray-50 p-4 rounded-lg text-xs">
                            <p>📊 المشاريع: ${imported.metadata?.totalProjects || 0}</p>
                            <p>🎯 المهارات: ${imported.metadata?.totalSkills || 0}</p>
                            <p>📜 الشهادات: ${imported.metadata?.totalCerts || 0}</p>
                        </div>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'استيراد',
                cancelButtonText: 'إلغاء'
            });
            
            if (value) {
                saveState('استيراد بيانات');
                appData = imported.data;
                renderAll();
                showToast('تم استيراد البيانات ✅', 'success');
            }
        } catch (err) {
            showToast('خطأ: ' + err.message, 'error');
        }
    };
    
    input.click();
}

// Export as CSV
function exportAsCSV(type) {
    const data = appData[type] || [];
    if (data.length === 0) {
        showToast('لا توجد بيانات للتصدير', 'error');
        return;
    }
    
    // Convert to CSV
    const headers = Object.keys(data[0]);
    const rows = data.map(item => 
        headers.map(h => {
            const val = item[h];
            if (typeof val === 'object') return JSON.stringify(val);
            return `"${String(val).replace(/"/g, '""')}"`;
        }).join(',')
    );
    
    const csv = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
