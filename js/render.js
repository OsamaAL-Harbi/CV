// Render engine: builds every section from data.json (all values escaped).
import { state } from './state.js';
import { escapeHTML, safeAssetUrl, safeUrl, showToast, skillLevel } from './utils.js';
import { STATIC_TEXT, t } from './i18n.js';

let twInterval     = null;

const WC = {
    experience:   'relative group mb-8',
    education:    'relative group mb-6',
    volunteer:    'relative group mb-6',
    projects:     'relative group bg-white dark:bg-cardBg rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col h-full shadow-sm hover:shadow-2xl transition duration-300 transform hover:-translate-y-1',
    certificates: 'relative group flex items-center gap-4 bg-white dark:bg-cardBg p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition',
    workshops:    'relative group bg-white dark:bg-cardBg p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition',
    languages:    'relative group flex items-center gap-3 bg-white dark:bg-cardBg px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition'
};

export function renderAll() {
    renderProfile();
    renderSection('experience',   state.appData.experience   || [], renderExperienceItem,  WC.experience);
    renderSection('education',    state.appData.education    || [], renderEducationItem,   WC.education);
    renderSection('volunteer',    state.appData.volunteer    || [], renderVolunteerItem,   WC.volunteer);
    renderSkillsWithProgress(state.activeSkillTab);
    renderSection('certificates', state.appData.certificates || [], renderCertItem,        WC.certificates);
    renderSection('workshops',    state.appData.workshops    || [], renderWorkshopItem,    WC.workshops);
    renderSection('languages',    state.appData.languages    || [], renderLanguageItem,    WC.languages);
    // Projects: filters first, then filtered grid
    renderProjectFilters();
    renderFilteredProjects();
    updatePrintHeader();
    if (state.isAdmin) import('./admin.js').then(m => m.enableSorting()).catch(() => showToast('تعذّر تحميل أداة الترتيب', 'error'));
    setTimeout(() => AOS.refresh(), 50);
}

// ─── Profile ──────────────────────────────────────────
function renderProfile() {
    const p = state.appData.profile;
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
            ${item.hours ? `<span class="inline-block bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-3 py-1 rounded text-xs font-bold">${escapeHTML(item.hours)} ${state.currentLang === 'ar' ? 'ساعة' : 'hrs'}</span>` : ''}
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
export function getProjectKey(item, fallback) {
    const raw = item.title?.en || item.title?.ar || String(fallback);
    return 'pv_' + raw.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_').substring(0, 40);
}

function renderProjectItem(item, realIdx) {
    const key       = getProjectKey(item, realIdx);
    const views     = JSON.parse(sessionStorage.getItem('project_views') || '{}');
    const count     = views[key] || 0;
    const viewLabel = count === 1
        ? (state.currentLang === 'ar' ? 'مشاهدة' : 'view')
        : (state.currentLang === 'ar' ? 'مشاهدة' : 'views');
    const liveUrl   = safeUrl(item.liveUrl);
    const hasLive   = liveUrl !== '';

    return `
        <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900
                    flex items-center justify-center relative overflow-hidden rounded-t-2xl cursor-pointer"
             data-action="open-project" data-index="${realIdx}">
            <i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500"></i>
            <div class="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition duration-300 backdrop-blur-sm">
                <span class="px-4 py-2 bg-white text-gray-900 rounded-full font-bold text-sm transform translate-y-4 group-hover:translate-y-0 transition duration-300 shadow-xl">
                    ${state.currentLang === 'ar' ? 'التفاصيل' : 'Details'}
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
    const p = state.appData.profile;
    if (!p) return;
    const nameEl = document.getElementById('print-name');
    if (nameEl) nameEl.textContent = t(p.name);
    const contactEl = document.getElementById('print-contact');
    if (contactEl) contactEl.textContent = `${p.email} · ${p.phone || ''} · ${t(p.location)}`;
}

function renderProjectFilters() {
    const container = document.getElementById('project-filters');
    if (!container) return;

    // Collect all unique techs across all projects
    const techSet = new Set();
    (state.appData.projects || []).forEach(p => (p.technologies || []).forEach(t => techSet.add(t)));

    if (techSet.size === 0) { container.innerHTML = ''; return; }

    const allLabel = STATIC_TEXT[state.currentLang]?.filter_all || 'الكل';
    const techs    = [{ key: 'all', label: allLabel }, ...Array.from(techSet).map(t => ({ key: t, label: t }))];

    container.innerHTML = techs.map(({ key, label }) => `
        <button data-action="set-filter" data-filter="${escapeHTML(key)}"
                class="filter-btn px-3 py-1.5 text-xs font-bold rounded-full border border-gray-200 dark:border-gray-700 transition hover:border-primary hover:text-primary ${state.activeFilter === key ? 'active bg-primary text-white border-primary' : 'bg-white dark:bg-cardBg text-gray-600 dark:text-gray-300'}">
            ${escapeHTML(label)}
        </button>
    `).join('');
}

export function setProjectFilter(tech) {
    state.activeFilter = tech;
    renderProjectFilters();
    renderFilteredProjects();
}

// FIX: use original array index for modal so openProjectModal gets correct item
export function renderFilteredProjects() {
    const container  = document.getElementById('projects-container');
    if (!container) return;
    const allProjects = state.appData.projects || [];
    const filtered    = state.activeFilter === 'all'
        ? allProjects.map((item, i) => ({ item, realIdx: i }))
        : allProjects.map((item, i) => ({ item, realIdx: i })).filter(({ item }) =>
            (item.technologies || []).includes(state.activeFilter));

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-16 text-gray-400">
                <i class="fas fa-search text-4xl mb-4 block opacity-30"></i>
                <p class="font-medium">${state.currentLang === 'ar' ? 'لا توجد مشاريع بهذه التقنية' : 'No projects found for this technology'}</p>
                <button data-action="set-filter" data-filter="all" class="mt-4 text-primary text-sm font-bold hover:underline">${STATIC_TEXT[state.currentLang]?.filter_all}</button>
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

export function setSkillTab(tab) {
    state.activeSkillTab    = tab;
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
    const allSkills  = state.appData.skills || [];
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

function renderAdminButtons(type, index) {
    if (!state.isAdmin) return '';
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

function updateText(key, value) {
    const el = document.querySelector(`[data-path="${key}"]`);
    if (!el) return;
    el.innerText = value;
    if (state.isAdmin) {
        el.contentEditable = 'true';
        el.classList.add('editable-active');
        el.onblur = () => {
            const parts = key.split('.');
            let obj = state.appData;
            for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
            const last = parts[parts.length - 1];
            if (typeof obj[last] === 'object') obj[last][state.currentLang] = el.innerText;
            else obj[last] = el.innerText;
        };
    }
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

export function setSmartGreeting() {
    const hour = new Date().getHours();
    const msgs = {
        ar: { m:'صباح الخير ☀️', a:'مساء الخير 🌤️', e:'مساء النور 🌙' },
        en: { m:'Good Morning ☀️', a:'Good Afternoon 🌤️', e:'Good Evening 🌙' }
    };
    const key = hour < 12 ? 'm' : (hour < 18 ? 'a' : 'e');
    const el  = document.getElementById('smart-greeting');
    if (el) el.innerText = msgs[state.currentLang][key];
}
