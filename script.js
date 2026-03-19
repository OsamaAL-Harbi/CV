/**
 * OSAMA PORTFOLIO — script.js
 * =========================================
 * SPA Routing | Bilingual (AR/EN) | Admin CRUD | GitHub Sync | PWA
 * =========================================
 */

// =========================================
// 1. GLOBALS
// =========================================
let appData         = {};
let githubInfo      = { token: '', repo: '' };
let currentLang     = localStorage.getItem('lang') || 'ar';
let isAdmin         = false;
let clickCount      = 0;

const SESSION_DURATION    = 60 * 60 * 1000; // 1 hour
const FORMSPREE_ENDPOINT  = "https://formspree.io/f/xqarljpg";

// =========================================
// 2. BOOT
// =========================================
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

    // Restore saved admin credentials
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

// =========================================
// 3. NAVIGATION (SPA)
// =========================================
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
        if (window.scrollY > 300) {
            btn.classList.add('show');
            btn.classList.remove('translate-y-10');
        } else {
            btn.classList.remove('show');
            btn.classList.add('translate-y-10');
        }
    });
}

// =========================================
// 4. LOCALISATION
// =========================================
/**
 * Returns the string for the current language.
 * Handles both bilingual objects {ar, en} and plain strings.
 */
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
        nav_home: 'الرئيسية', nav_resume: 'السيرة الذاتية', nav_portfolio: 'الأعمال', nav_contact: 'تواصل',
        btn_projects: 'أعمالي', btn_save: 'حفظ', btn_email: 'إرسال', btn_download_cv: 'تحميل السيرة الذاتية',
        sec_resume: 'السيرة الذاتية', sec_exp: 'الخبرات', sec_edu: 'التعليم',
        sec_volunteer: 'التطوع', sec_skills: 'المهارات', sec_certs: 'الشهادات',
        sec_workshops: 'ورش العمل', sec_languages: 'اللغات', sec_projects: 'معرض المشاريع',
        contact_title: 'راسلني'
    },
    en: {
        nav_home: 'Home', nav_resume: 'Resume', nav_portfolio: 'Portfolio', nav_contact: 'Contact',
        btn_projects: 'My Work', btn_save: 'Save', btn_email: 'Send', btn_download_cv: 'Download CV',
        sec_resume: 'Resume', sec_exp: 'Experience', sec_edu: 'Education',
        sec_volunteer: 'Volunteer', sec_skills: 'Skills', sec_certs: 'Certificates',
        sec_workshops: 'Workshops', sec_languages: 'Languages', sec_projects: 'Portfolio',
        contact_title: 'Get in Touch'
    }
};

function updateStaticText() {
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (STATIC_TEXT[currentLang][key]) el.innerText = STATIC_TEXT[currentLang][key];
    });
}

// =========================================
// 5. DATA LOADING
// =========================================
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

// =========================================
// 6. RENDER ENGINE
// =========================================
function renderAll() {
    renderProfile();
    renderSection('experience',    appData.experience    || [], renderExperienceItem,  'relative group mb-8');
    renderSection('education',     appData.education     || [], renderEducationItem,   'relative group mb-6');
    renderSection('volunteer',     appData.volunteer     || [], renderVolunteerItem,   'relative group mb-6');
    renderSection('skills',        appData.skills        || [], renderSkillItem,       'inline-block px-4 py-2 bg-white dark:bg-cardBg rounded-lg border dark:border-gray-700 shadow-sm hover:border-primary transition');
    renderSection('certificates',  appData.certificates  || [], renderCertItem,        'flex items-center gap-4 bg-white dark:bg-cardBg p-4 rounded-xl border dark:border-gray-700 shadow-sm hover:shadow-md transition');
    renderSection('workshops',     appData.workshops     || [], renderWorkshopItem,    'bg-white dark:bg-cardBg p-4 rounded-xl border dark:border-gray-700 shadow-sm');
    renderSection('projects',      appData.projects      || [], renderProjectItem,     'bg-white dark:bg-cardBg rounded-2xl border dark:border-gray-700 overflow-hidden flex flex-col h-full shadow-sm hover:shadow-2xl transition duration-300 transform hover:-translate-y-1');
    renderLanguages();
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
    if (imgEl) {
        imgEl.src = p.image || fallback;
        imgEl.onerror = function () { this.src = fallback; };
    }

    typeWriter(t(p.title), 'typewriter');

    // Location
    const locEl = document.getElementById('profile-location');
    if (locEl) locEl.textContent = t(p.location);

    // Contact page info
    const emailDisplay = document.getElementById('contact-email-display');
    if (emailDisplay) emailDisplay.textContent = p.email;
    const locDisplay = document.getElementById('contact-location-display');
    if (locDisplay) locDisplay.textContent = t(p.location);

    // Social links
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
            ${needsTimelineDot(type) ? `<div class="timeline-dot absolute -right-[39px] ltr:-left-[39px] top-1 w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-darkBg z-10 group-hover:scale-125 transition"></div>` : ''}
            ${contentFn(item, i)}
        </div>
    `).join('');
}

function needsTimelineDot(type) {
    return ['experience', 'education', 'volunteer'].includes(type);
}

// --- Item renderers ---
function renderExperienceItem(item, i) {
    return `
        <h3 class="text-xl font-bold dark:text-white hover:text-primary transition">${t(item.role)}</h3>
        <p class="text-primary font-medium text-sm">${t(item.company)}</p>
        <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs mb-3 font-bold">${t(item.period)}</span>
        <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${t(item.description)}</p>
    `;
}

function renderEducationItem(item, i) {
    return `
        <h3 class="text-xl font-bold dark:text-white hover:text-blue-500 transition">${t(item.degree)}</h3>
        <p class="text-blue-500 font-medium text-sm">${t(item.institution)}</p>
        <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs mb-3 font-bold">${t(item.period)}</span>
        <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${t(item.description)}</p>
    `;
}

function renderVolunteerItem(item, i) {
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

function renderSkillItem(item, i) {
    return `<span class="font-bold text-sm">${t(item)}</span>`;
}

function renderCertItem(item, i) {
    return `
        <div class="text-2xl text-secondary flex-shrink-0"><i class="fas fa-certificate"></i></div>
        <div class="w-full">
            <h4 class="font-bold text-sm dark:text-white">${t(item.name)}</h4>
            <p class="text-xs text-gray-500 mt-1">${t(item.issuer)}${item.credential ? ` | ${item.credential}` : ''}</p>
            ${item.date ? `<p class="text-xs text-gray-400 mt-0.5">${item.date}</p>` : ''}
        </div>
    `;
}

function renderWorkshopItem(item, i) {
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

function renderProjectItem(item, i) {
    return `
        <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center relative overflow-hidden group">
            <i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500"></i>
            <div class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 backdrop-blur-sm">
                ${item.link && item.link !== '#'
                    ? `<a href="${item.link}" target="_blank" rel="noopener noreferrer" class="px-6 py-2 bg-white text-gray-900 rounded-full font-bold transform translate-y-4 group-hover:translate-y-0 transition duration-300 shadow-xl">${currentLang === 'ar' ? 'عرض' : 'View'}</a>`
                    : `<span class="px-6 py-2 bg-white/50 text-white rounded-full font-bold text-sm">${currentLang === 'ar' ? 'غير متاح' : 'Private'}</span>`
                }
            </div>
        </div>
        <div class="p-6 flex-grow">
            <h3 class="text-lg font-bold mb-2">${t(item.title)}</h3>
            <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">${t(item.desc)}</p>
        </div>
    `;
}

// Languages (static render, not sortable)
function renderLanguages() {
    const container = document.getElementById('languages-container');
    if (!container || !appData.languages) return;
    container.innerHTML = appData.languages.map(lang => `
        <div class="flex items-center gap-3 bg-white dark:bg-cardBg px-4 py-3 rounded-xl border dark:border-gray-700 shadow-sm">
            <i class="fas fa-language text-teal-500 text-lg"></i>
            <div>
                <p class="font-bold text-sm">${t(lang.name)}</p>
                <p class="text-xs text-gray-500">${t(lang.level)}</p>
            </div>
        </div>
    `).join('');
}

// =========================================
// 7. ADMIN BUTTONS
// =========================================
function renderAdminButtons(type, index) {
    if (!isAdmin) return '';
    return `
        <div class="admin-element absolute top-2 left-2 ltr:right-2 ltr:left-auto z-20 gap-2 opacity-0 group-hover:opacity-100 transition flex items-center">
            <span class="drag-handle bg-gray-200 dark:bg-gray-700 text-gray-500 w-7 h-7 rounded shadow flex items-center justify-center hover:bg-gray-300 cursor-move" title="Drag to reorder">
                <i class="fas fa-grip-vertical text-[10px]"></i>
            </span>
            <button onclick="manageItem('${type}', ${index})" class="bg-blue-500 text-white w-7 h-7 rounded shadow flex items-center justify-center hover:scale-110 transition" title="Edit">
                <i class="fas fa-pen text-[10px]"></i>
            </button>
            <button onclick="deleteItem('${type}', ${index})" class="bg-red-500 text-white w-7 h-7 rounded shadow flex items-center justify-center hover:scale-110 transition" title="Delete">
                <i class="fas fa-trash text-[10px]"></i>
            </button>
        </div>
    `;
}

// =========================================
// 8. ADMIN CRUD
// =========================================
const SCHEMAS = {
    skills: [
        { key: 'ar', label: 'اسم المهارة (عربي)', simple: true },
        { key: 'en', label: 'Skill Name (English)', simple: true }
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
        { key: 'title', label: 'عنوان المشروع / Title' },
        { key: 'desc',  label: 'الوصف / Description', type: 'textarea' },
        { key: 'link',  label: 'رابط / Link', simple: true }
    ],
    certificates: [
        { key: 'name',       label: 'اسم الشهادة / Name' },
        { key: 'issuer',     label: 'الجهة / Issuer' },
        { key: 'credential', label: 'رقم الاعتماد / Credential ID', simple: true },
        { key: 'date',       label: 'التاريخ / Date', simple: true }
    ],
    workshops: [
        { key: 'name',      label: 'اسم الورشة / Name' },
        { key: 'organizer', label: 'الجهة المنظمة / Organizer' },
        { key: 'date',      label: 'التاريخ / Date' }
    ]
};

async function manageItem(type, index = null) {
    if (!isAdmin) return;
    const isEdit = index !== null;
    const item   = isEdit ? appData[type][index] : {};
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
        title: isEdit ? 'تعديل' : 'إضافة جديدة',
        html: `<div class="text-right" dir="rtl">${html}</div>`,
        width: '700px',
        confirmButtonText: 'حفظ',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        focusConfirm: false,
        preConfirm: () => {
            const obj = {};
            schema.forEach(f => {
                if (f.simple) {
                    obj[f.key] = document.getElementById(`swal-${f.key}`).value;
                } else {
                    obj[f.key] = {
                        ar: document.getElementById(`swal-${f.key}-ar`).value,
                        en: document.getElementById(`swal-${f.key}-en`).value
                    };
                }
            });
            return obj;
        }
    });

    if (value) {
        if (!appData[type]) appData[type] = [];
        if (isEdit) appData[type][index] = value;
        else appData[type].push(value);
        renderAll();
        showToast(isEdit ? 'تم التعديل' : 'تمت الإضافة', 'success');
    }
}

function addItem(type)         { manageItem(type); }
function editItem(type, index) { manageItem(type, index); }

function deleteItem(type, index) {
    if (!isAdmin) return;
    Swal.fire({
        title: 'هل أنت متأكد؟',
        text: 'لن تتمكن من التراجع!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'تراجع'
    }).then(result => {
        if (result.isConfirmed) {
            appData[type].splice(index, 1);
            renderAll();
            showToast('تم الحذف', 'success');
        }
    });
}

// =========================================
// 9. DRAG & DROP (Sortable)
// =========================================
function initSortable() {
    const SORTABLE_TYPES = ['experience', 'education', 'volunteer', 'skills', 'certificates', 'workshops', 'projects'];
    SORTABLE_TYPES.forEach(type => {
        const el = document.getElementById(`${type}-container`);
        if (!el) return;
        new Sortable(el, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'bg-blue-100',
            onEnd(evt) {
                const moved = appData[type].splice(evt.oldIndex, 1)[0];
                appData[type].splice(evt.newIndex, 0, moved);
                renderAll();
            }
        });
    });
}

// =========================================
// 10. INLINE EDITING
// =========================================
function updateText(key, value) {
    const el = document.querySelector(`[data-path="${key}"]`);
    if (!el) return;
    el.innerText = value;
    if (isAdmin) {
        el.contentEditable = 'true';
        el.classList.add('editable-active');
        el.onblur = () => {
            const pathParts = key.split('.');
            let obj = appData;
            for (let i = 0; i < pathParts.length - 1; i++) obj = obj[pathParts[i]];
            const last = pathParts[pathParts.length - 1];
            if (typeof obj[last] === 'object') obj[last][currentLang] = el.innerText;
            else obj[last] = el.innerText;
        };
    }
}

async function editImage(key) {
    if (!isAdmin) return;
    const { value } = await Swal.fire({
        title: 'تغيير الصورة الشخصية',
        input: 'url',
        inputLabel: 'رابط الصورة (Imgur, GitHub, Drive)',
        inputPlaceholder: 'https://...'
    });
    if (value) {
        setDeepValue(appData, key, value);
        renderAll();
    }
}

// =========================================
// 11. AUTH & GITHUB SYNC
// =========================================
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
}

function logout() {
    ['saved_repo', 'saved_token', 'login_time'].forEach(k => localStorage.removeItem(k));
    location.reload();
}

async function saveToGitHub() {
    const saveBtn  = document.querySelector('#admin-toolbar button');
    const origHTML = saveBtn.innerHTML;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';

    // Auto backup before save
    localStorage.setItem('backup_data', JSON.stringify(appData));

    try {
        const url    = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(url, { headers: { Authorization: `token ${githubInfo.token}` } });
        if (!getRes.ok) throw new Error('فشل الاتصال بـ GitHub. تحقق من الـ Token.');

        const fileData = await getRes.json();
        const content  = btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2))));

        const putRes = await fetch(url, {
            method:  'PUT',
            headers: { Authorization: `token ${githubInfo.token}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ message: 'Update via Admin Panel', content, sha: fileData.sha })
        });
        if (!putRes.ok) throw new Error('فشل الحفظ في GitHub.');

        showToast('تم الحفظ في GitHub ✅', 'success');
    } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
    } finally {
        saveBtn.innerHTML = origHTML;
    }
}

function restoreBackup() {
    const data = localStorage.getItem('backup_data');
    if (data) {
        appData = JSON.parse(data);
        renderAll();
        showToast('تم استعادة النسخة الاحتياطية', 'success');
    } else {
        showToast('لا توجد نسخة احتياطية', 'error');
    }
}

// =========================================
// 12. UTILITIES
// =========================================
function setSmartGreeting() {
    const hour  = new Date().getHours();
    const msgs  = {
        ar: { m: 'صباح الخير ☀️', a: 'مساء الخير 🌤️', e: 'مساء النور 🌙' },
        en: { m: 'Good Morning ☀️', a: 'Good Afternoon 🌤️', e: 'Good Evening 🌙' }
    };
    const key   = hour < 12 ? 'm' : (hour < 18 ? 'a' : 'e');
    const el    = document.getElementById('smart-greeting');
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
            number:    { value: party ? 100 : 40 },
            color:     { value: party ? ['#f00','#0f0','#00f'] : (isDark ? '#ffffff' : '#3b82f6') },
            opacity:   { value: 0.3 },
            size:      { value: 3 },
            line_linked: { enable: true, distance: 150, color: isDark ? '#ffffff' : '#3b82f6', opacity: 0.1, width: 1 },
            move:      { enable: true, speed: party ? 10 : 1 }
        },
        interactivity: {
            detect_on: 'canvas',
            events:    { onhover: { enable: true, mode: 'grab' } }
        },
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
        { icon: 'fa-home',     text: 'الرئيسية / Home',        action: () => showPage('home') },
        { icon: 'fa-id-card',  text: 'السيرة الذاتية / Resume', action: () => showPage('resume') },
        { icon: 'fa-briefcase',text: 'الأعمال / Portfolio',     action: () => showPage('portfolio') },
        { icon: 'fa-envelope', text: 'تواصل / Contact',         action: () => showPage('contact') },
        { icon: 'fa-language', text: 'تبديل اللغة / Language',  action: toggleLanguage },
        { icon: 'fa-moon',     text: 'الوضع الليلي / Theme',    action: () => document.getElementById('theme-btn').click() }
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
    const items = document.querySelectorAll('#cmd-list > div');
    items.forEach(el => {
        el.style.display = el.textContent.toLowerCase().includes(val.toLowerCase()) ? 'flex' : 'none';
    });
}

function setupKonamiCode() {
    const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let idx = 0;
    document.addEventListener('keydown', e => {
        idx = (e.key === code[idx]) ? idx + 1 : 0;
        if (idx === code.length) {
            showToast('Party Mode Activated! 🎉', 'success');
            initParticles(true);
            idx = 0;
        }
    });
}

function handleContact(e) {
    e.preventDefault();
    const form = e.target;
    fetch(FORMSPREE_ENDPOINT, {
        method:  'POST',
        body:    new FormData(form),
        headers: { Accept: 'application/json' }
    }).then(res => {
        if (res.ok) { showToast('تم الإرسال بنجاح ✅', 'success'); form.reset(); }
        else showToast('حدث خطأ في الإرسال', 'error');
    }).catch(() => showToast('تعذّر الاتصال بالخادم', 'error'));
}

function setDeepValue(obj, path, value) {
    const keys    = path.split('.');
    let   current = obj;
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
    current[keys[keys.length - 1]] = value;
}

function showToast(msg, type = 'info') {
    const colors = { success: '#10B981', error: '#EF4444', info: '#3b82f6' };
    Toastify({
        text:     msg,
        duration: 3000,
        gravity:  'top',
        position: 'center',
        style:    { background: colors[type] || colors.info }
    }).showToast();
}
