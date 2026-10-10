// Render engine: builds every section from data.json (all values escaped).
import { state } from './state.js';
import { escapeHTML, imageSrc, safeAssetUrl, safeUrl, showToast, skillLevel } from './utils.js';
import { t, ui } from './i18n.js';

let twInterval     = null;

const WC = {
    experience:   'relative group mb-8',
    education:    'relative group mb-6',
    volunteer:    'relative group mb-6',
    projects:     'tilt relative group bg-white dark:bg-cardBg rounded-2xl border border-gray-200 dark:border-gray-700 flex flex-col h-full shadow-sm',
    certificates: 'relative group flex items-center gap-4 bg-white dark:bg-cardBg p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition',
    workshops:    'relative group bg-white dark:bg-cardBg p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition',
    languages:    'relative group flex items-center gap-3 bg-white dark:bg-cardBg px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition'
};

const SKILL_TAB_ON  = 'px-4 py-1.5 text-xs font-bold rounded-full bg-primary text-white transition';
const SKILL_TAB_OFF = 'px-4 py-1.5 text-xs font-bold rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 transition';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Hidden items (item.hidden) and sections (data.json → visibility.sections) are skipped for visitors;
// the admin still sees them, dimmed and labelled, to switch them back on.
const isShown = item => state.isAdmin || !item?.hidden;
const shownOnly = list => (list || []).filter(item => !item?.hidden);

function applySectionVisibility() {
    const off = new Set(state.appData.visibility?.sections || []);
    document.querySelectorAll('[data-section]').forEach(el => {
        const hidden = off.has(el.dataset.section);
        el.classList.toggle('section-off', hidden && !state.isAdmin);
        el.classList.toggle('section-off-admin', hidden && state.isAdmin);
    });
}

export function renderAll() {
    applySectionVisibility();
    renderProfile();
    renderAvailability();
    renderStats();
    renderSection('experience',   state.appData.experience   || [], renderExperienceItem,  WC.experience);
    renderSection('education',    state.appData.education    || [], renderEducationItem,   WC.education);
    renderSection('volunteer',    state.appData.volunteer    || [], renderVolunteerItem,   WC.volunteer);
    setSkillTab(state.activeSkillTab);
    renderSection('certificates', state.appData.certificates || [], renderCertItem,        WC.certificates);
    renderSection('workshops',    state.appData.workshops    || [], renderWorkshopItem,    WC.workshops);
    renderSection('languages',    state.appData.languages    || [], renderLanguageItem,    WC.languages);
    // Projects: filters first, then filtered grid
    renderProjectFilters();
    renderFilteredProjects();
    updatePrintHeader();
    if (state.isAdmin) import('./admin.js').then(m => m.enableSorting()).catch(() => showToast('تعذّر تحميل أداة الترتيب', 'error'));
    setTimeout(() => window.AOS?.refresh(), 50);
}

// ─── Formatting helpers ───────────────────────────────
const MONTHS_EN = ['january','february','march','april','may','june','july','august','september','october','november','december'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

// Plain-string dates such as "January 2025" are shown with Arabic month names in the Arabic UI.
export function localDate(value) {
    const text = t(value);
    if (state.currentLang !== 'ar') return text;
    return text.replace(/\b([A-Za-z]+)(\s+\d{4})\b/g, (match, month, year) => {
        const i = MONTHS_EN.indexOf(month.toLowerCase());
        return i === -1 ? match : MONTHS_AR[i] + year;
    });
}

// Multi-line descriptions (blank-line separated in data.json) become a bullet list.
function renderDescription(value) {
    const lines = t(value).split(/\n+/).map(s => s.trim()).filter(Boolean);
    if (lines.length === 0) return '';
    if (lines.length === 1) return `<p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${escapeHTML(lines[0])}</p>`;
    return `<ul class="list-disc ps-5 space-y-1.5 text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
        ${lines.map(line => `<li>${escapeHTML(line)}</li>`).join('')}
    </ul>`;
}

function periodBadge(value, extraClass = 'mb-3') {
    const text = localDate(value);
    return text ? `<span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs ${extraClass} font-bold">${escapeHTML(text)}</span>` : '';
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
        const src = imageSrc(p.image, state.previewImages) || fallback;
        if (imgEl.getAttribute('src') !== src) imgEl.src = src;
        imgEl.alt = t(p.name);
    }

    typeWriter(t(p.title), 'typewriter');

    const locEl = document.getElementById('profile-location');
    if (locEl) locEl.textContent = t(p.location);

    const emailDisplay = document.getElementById('contact-email-display');
    if (emailDisplay) emailDisplay.textContent = p.email || '';
    const locDisplay = document.getElementById('contact-location-display');
    if (locDisplay) locDisplay.textContent = t(p.location);

    renderWhatsApp(p);

    // CV download buttons follow profile.cv (the static href is the fallback)
    // A CV hosted elsewhere (e.g. Google Drive) opens in a new tab; a file on this site downloads.
    const cv = safeAssetUrl(p.cv);
    if (cv) document.querySelectorAll('[data-cv-link]').forEach(a => {
        a.href = cv;
        const external = /^https:/i.test(cv);
        if (external) { a.target = '_blank'; a.rel = 'noopener noreferrer'; a.removeAttribute('download'); }
        else { a.removeAttribute('target'); a.removeAttribute('rel'); a.setAttribute('download', ''); }
    });
}

// ─── WhatsApp (wa.me link from profile.phone, with a greeting in the visitor's language) ───
export function whatsAppUrl(profile, lang) {
    const digits = String(profile?.phone || '').replace(/\D/g, '');
    if (digits.length < 8) return '';
    const first = (profile.name?.[lang] || profile.name?.en || '').trim().split(/\s+/)[0] || '';
    const text  = lang === 'ar'
        ? `مرحباً ${first}، اطّلعت على موقعك الشخصي وأودّ التواصل معك.`
        : `Hello ${first}, I visited your portfolio and would like to get in touch.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

// +966537820694 → +966 53 782 0694 (other numbers are shown as stored)
function formatPhone(phone) {
    const m = String(phone || '').replace(/[\s-]/g, '').match(/^\+966(5\d)(\d{3})(\d{4})$/);
    return m ? `+966 ${m[1]} ${m[2]} ${m[3]}` : String(phone || '');
}

function renderWhatsApp(p) {
    const card = document.getElementById('contact-whatsapp');
    if (!card) return;
    const url = whatsAppUrl(p, state.currentLang);
    card.classList.toggle('hidden', !url);
    if (!url) return;
    card.href = url;
    card.setAttribute('aria-label', `WhatsApp: ${formatPhone(p.phone)}`);
    const num = document.getElementById('contact-whatsapp-number');
    if (num) num.textContent = formatPhone(p.phone);
}

// ─── "Open to work" badge ─────────────────────────────
function renderAvailability() {
    const badge = document.getElementById('availability-badge');
    if (!badge) return;
    const a = state.appData.availability;
    badge.classList.toggle('hidden', !a?.enabled);
    if (!a?.enabled) return;
    document.getElementById('availability-status').textContent = t(a.status) || ui('open_to_work');
    document.getElementById('availability-details').textContent = [t(a.roles), t(a.cities), t(a.types)].filter(Boolean).join(' · ');
}

// ─── Home stats (computed from data.json instead of hard-coded numbers) ───
export function computeStats(data) {
    const years = (data.education || [])
        .filter(e => !e.hidden)
        .flatMap(e => [e.period?.en, e.period?.ar, typeof e.period === 'string' ? e.period : ''])
        .flatMap(text => String(text || '').match(/\b(?:19|20)\d{2}\b/g) || [])
        .map(Number);
    return {
        certificates:   shownOnly(data.certificates).length,
        volunteerHours: shownOnly(data.volunteer).reduce((sum, v) => sum + (Number.parseInt(v.hours, 10) || 0), 0),
        projects:       shownOnly(data.projects).length,
        graduationYear: years.length ? Math.max(...years) : 0
    };
}

function renderStats() {
    const stats = computeStats(state.appData);
    document.querySelectorAll('.stat-number[data-stat]').forEach(el => {
        const value = stats[el.dataset.stat] ?? 0;
        el.dataset.target = String(value);
        el.closest('.stat-card')?.classList.toggle('hidden', value === 0);
        // The real number is in the page right away; it counts up from 0 when scrolled into view
        if (!el.dataset.counting) el.textContent = String(value);
    });
}

// ─── Generic section renderer ─────────────────────────
function renderSection(type, data, contentFn, wrapperClass) {
    const container = document.getElementById(`${type}-container`);
    if (!container) return;
    const hasTimeline = ['experience','education','volunteer'].includes(type);
    container.innerHTML = data.map((item, i) => (isShown(item) ? `
        <div class="${wrapperClass} sortable-item${item.hidden ? ' item-hidden' : ''}" data-index="${i}">
            ${renderAdminButtons(type, i, item)}
            ${hasTimeline ? `<div class="absolute -right-[39px] ltr:-left-[39px] ltr:right-auto top-1 w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-darkBg z-10 group-hover:scale-125 transition" aria-hidden="true"></div>` : ''}
            ${contentFn(item, i)}
        </div>
    ` : '')).join('');
}

// ─── Item renderers ───────────────────────────────────
function renderExperienceItem(item) {
    return `
        <h3 class="text-xl font-bold dark:text-white hover:text-primary transition">${escapeHTML(t(item.role))}</h3>
        <p class="text-primary font-medium text-sm mb-2">${escapeHTML(t(item.company))}</p>
        ${periodBadge(item.period)}
        ${renderDescription(item.description)}`;
}

function renderEducationItem(item) {
    return `
        <h3 class="text-xl font-bold dark:text-white hover:text-blue-600 transition">${escapeHTML(t(item.degree))}</h3>
        <p class="text-blue-600 dark:text-blue-400 font-medium text-sm mb-2">${escapeHTML(t(item.institution))}</p>
        ${periodBadge(item.period)}
        ${renderDescription(item.description)}`;
}

function renderVolunteerItem(item) {
    const hours = Number.parseInt(item.hours, 10);
    const badges = [
        periodBadge(item.period, ''),
        hours > 0 ? `<span class="inline-block bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 px-3 py-1 rounded text-xs font-bold">${hours} ${state.currentLang === 'ar' ? 'ساعة' : 'hrs'}</span>` : ''
    ].filter(Boolean).join('');
    return `
        <h3 class="text-xl font-bold dark:text-white hover:text-orange-600 transition">${escapeHTML(t(item.role))}</h3>
        <p class="text-orange-600 dark:text-orange-400 font-medium text-sm mb-2">${escapeHTML(t(item.organization))}</p>
        ${badges ? `<div class="flex flex-wrap gap-2 mb-3">${badges}</div>` : ''}
        ${renderDescription(item.description)}`;
}

function renderCertItem(item) {
    const verify = safeUrl(item.url);
    const date   = localDate(item.date);
    const image  = imageSrc(item.image, state.previewImages);
    return `
        ${image
            ? `<a href="${escapeHTML(safeAssetUrl(item.image))}" target="_blank" rel="noopener" class="flex-shrink-0 print-hide" aria-label="${escapeHTML(`${state.currentLang === 'ar' ? 'صورة الشهادة' : 'Certificate image'}: ${t(item.name)}`)}">
                   <img src="${escapeHTML(image)}" alt="" width="56" height="56" loading="lazy" decoding="async" class="w-14 h-14 object-cover rounded-lg border border-gray-200 dark:border-gray-700"></a>`
            : '<div class="text-2xl text-secondary flex-shrink-0" aria-hidden="true"><i class="fas fa-certificate"></i></div>'}
        <div class="flex-1 min-w-0">
            <h4 class="font-bold text-sm dark:text-white">${escapeHTML(t(item.name))}</h4>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${escapeHTML(t(item.issuer))}${item.credential ? ` · <span dir="ltr" class="font-mono">${escapeHTML(item.credential)}</span>` : ''}</p>
            ${date ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${escapeHTML(date)}</p>` : ''}
        </div>
        ${verify ? `<a href="${escapeHTML(verify)}" target="_blank" rel="noopener noreferrer"
                      class="flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline print-hide"
                      aria-label="${escapeHTML(`${ui('cert_verify')}: ${t(item.name)}`)}">
                      <i class="fas fa-external-link-alt" aria-hidden="true"></i><span>${escapeHTML(ui('cert_verify'))}</span></a>` : ''}`;
}

function renderWorkshopItem(item) {
    const date = localDate(item.date);
    return `
        <div class="flex items-start gap-3">
            <div class="text-yellow-500 mt-1 flex-shrink-0" aria-hidden="true"><i class="fas fa-chalkboard-teacher"></i></div>
            <div>
                <h4 class="font-bold text-sm dark:text-white">${escapeHTML(t(item.name))}</h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${escapeHTML(t(item.organizer))}</p>
                ${date ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${escapeHTML(date)}</p>` : ''}
            </div>
        </div>`;
}

function renderLanguageItem(item) {
    return `
        <i class="fas fa-language text-teal-500 text-lg flex-shrink-0" aria-hidden="true"></i>
        <div>
            <p class="font-bold text-sm dark:text-white">${escapeHTML(t(item.name))}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHTML(t(item.level))}</p>
        </div>`;
}

// ─── Project Card ─────────────────────────────────────
function renderProjectItem(item, realIdx) {
    const liveUrl = safeUrl(item.liveUrl);
    const hasLive = liveUrl !== '';
    const title   = t(item.title);

    return `
        <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900
                    flex items-center justify-center relative overflow-hidden rounded-t-2xl cursor-pointer
                    focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/60"
             data-action="open-project" data-index="${realIdx}" role="button" tabindex="0"
             aria-haspopup="dialog" aria-label="${escapeHTML(`${ui('btn_details')}: ${title}`)}">
            ${imageSrc(item.image, state.previewImages)
                ? `<img src="${escapeHTML(imageSrc(item.image, state.previewImages))}" alt="" loading="lazy" decoding="async" class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-500">`
                : '<i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500" aria-hidden="true"></i>'}
            <div class="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition duration-300 backdrop-blur-sm">
                <span class="px-4 py-2 bg-white text-gray-900 rounded-full font-bold text-sm transform translate-y-4 group-hover:translate-y-0 transition duration-300 shadow-xl">
                    ${escapeHTML(ui('btn_details'))}
                </span>
                ${hasLive ? `<a href="${escapeHTML(liveUrl)}" target="_blank" rel="noopener noreferrer"
                    class="px-4 py-2 bg-green-600 text-white rounded-full font-bold text-sm transform translate-y-4 group-hover:translate-y-0 transition duration-500 shadow-xl">
                    ${escapeHTML(ui('btn_live'))}</a>` : ''}
            </div>
            ${hasLive ? `<span class="absolute top-3 left-3 ltr:right-3 ltr:left-auto bg-green-600 text-white text-xs px-2 py-1 rounded-full font-bold pointer-events-none">${escapeHTML(ui('badge_live'))}</span>` : ''}
        </div>
        <div class="p-5 flex-grow flex flex-col">
            <h3 class="text-base font-bold mb-2 dark:text-white">${escapeHTML(title)}</h3>
            <p class="text-gray-500 dark:text-gray-400 text-sm leading-relaxed flex-grow">${escapeHTML(t(item.desc))}</p>
            ${item.technologies?.length ? `
                <div class="flex flex-wrap gap-1.5 mt-3">
                    ${item.technologies.map(tech =>
                        `<span class="text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-bold" dir="ltr">${escapeHTML(tech)}</span>`
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
    const titleEl = document.getElementById('print-title');
    if (titleEl) titleEl.textContent = t(p.title);
    const contactEl = document.getElementById('print-contact');
    if (contactEl) contactEl.textContent = [p.email, p.phone, t(p.location)].filter(Boolean).join(' · ');
    // A printed CV cannot be clicked: spell the profile URLs out.
    const linksEl = document.getElementById('print-links');
    if (linksEl) linksEl.textContent = [p.linkedin, p.github].map(safeUrl).filter(Boolean)
        .map(u => u.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')).join(' · ');
}

function renderProjectFilters() {
    const container = document.getElementById('project-filters');
    if (!container) return;

    // Collect all unique techs across all projects
    const techSet = new Set();
    const projects = (state.appData.projects || []).filter(isShown);
    projects.forEach(p => (p.technologies || []).forEach(tech => techSet.add(tech)));

    // One project (or no technologies) — a filter bar would only offer "All" plus its own tags.
    if (techSet.size === 0 || projects.length < 2) {
        container.innerHTML = '';
        state.activeFilter = 'all';
        return;
    }
    if (state.activeFilter !== 'all' && !techSet.has(state.activeFilter)) state.activeFilter = 'all';

    const techs = [{ key: 'all', label: ui('filter_all') }, ...Array.from(techSet).map(tech => ({ key: tech, label: tech }))];

    container.innerHTML = techs.map(({ key, label }) => {
        const active = state.activeFilter === key;
        return `
        <button type="button" data-action="set-filter" data-filter="${escapeHTML(key)}" aria-pressed="${active}"
                class="filter-btn px-3 py-1.5 text-xs font-bold rounded-full border border-gray-200 dark:border-gray-700 transition hover:border-primary hover:text-primary ${active ? 'active bg-primary text-white border-primary' : 'bg-white dark:bg-cardBg text-gray-600 dark:text-gray-300'}">
            ${escapeHTML(label)}
        </button>`;
    }).join('');
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
    const filtered    = allProjects.map((item, i) => ({ item, realIdx: i }))
        .filter(({ item }) => isShown(item))
        .filter(({ item }) => state.activeFilter === 'all' || (item.technologies || []).includes(state.activeFilter));

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-16 text-gray-500">
                <i class="fas fa-search text-4xl mb-4 block opacity-30" aria-hidden="true"></i>
                <p class="font-medium">${state.currentLang === 'ar' ? 'لا توجد مشاريع بهذه التقنية' : 'No projects found for this technology'}</p>
                <button type="button" data-action="set-filter" data-filter="all" class="mt-4 text-primary text-sm font-bold hover:underline">${escapeHTML(ui('filter_all'))}</button>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(({ item, realIdx }) => `
        <div class="${WC.projects} sortable-item${item.hidden ? ' item-hidden' : ''}" data-index="${realIdx}">
            ${renderAdminButtons('projects', realIdx, item)}
            ${renderProjectItem(item, realIdx)}
        </div>
    `).join('');
}

export function setSkillTab(tab) {
    state.activeSkillTab = tab === 'soft' ? 'soft' : 'hard';
    ['hard', 'soft'].forEach(name => {
        const btn = document.getElementById(`tab-${name}`);
        if (!btn) return;
        const on = name === state.activeSkillTab;
        btn.className = on ? SKILL_TAB_ON : SKILL_TAB_OFF;
        btn.setAttribute('aria-pressed', String(on));
    });
    renderSkills(state.activeSkillTab);
}

function skillRow(skill, allSkills, barColor) {
    const realIdx = allSkills.indexOf(skill);
    const level   = skillLevel(skill);
    const name    = t(skill);
    return `
        <div class="skill-item relative group sortable-item${skill.hidden ? ' item-hidden' : ''}" data-real-index="${realIdx}">
            ${renderAdminButtons('skills', realIdx, skill)}
            <div class="flex justify-between items-center mb-1">
                <span class="text-sm font-bold dark:text-white">${escapeHTML(name)}</span>
                <span class="text-xs font-bold text-gray-500 dark:text-gray-400" aria-hidden="true">${level}%</span>
            </div>
            <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden"
                 role="progressbar" aria-valuenow="${level}" aria-valuemin="0" aria-valuemax="100" aria-label="${escapeHTML(name)}">
                <div class="skill-bar-fill h-2.5 rounded-full ${barColor}" data-level="${level}"></div>
            </div>
        </div>`;
}

const BAR_COLOR = {
    hard: 'bg-gradient-to-r from-primary to-blue-400',
    soft: 'bg-gradient-to-r from-secondary to-pink-400'
};

// tab = 'hard' | 'soft' on screen; 'all' for print and the PDF export, which have no tabs.
export function renderSkills(tab = 'hard', { instant = false } = {}) {
    const container = document.getElementById('skills-container');
    if (!container) return;
    const allSkills = state.appData.skills || [];
    if (tab === 'all') {
        container.innerHTML = ['hard', 'soft'].map(cat => {
            const rows = allSkills.filter(s => s.category === cat && isShown(s)).map(s => skillRow(s, allSkills, BAR_COLOR[cat])).join('');
            return rows ? `<h4 class="text-sm font-bold text-gray-500 dark:text-gray-400 pt-2">${escapeHTML(ui(`skills_${cat}`))}</h4>${rows}` : '';
        }).join('');
    } else {
        container.innerHTML = allSkills.filter(s => s.category === tab && isShown(s)).map(s => skillRow(s, allSkills, BAR_COLOR[tab])).join('');
    }
    if (instant || prefersReducedMotion()) animateSkillBars();
    else setTimeout(animateSkillBars, 80);
}

function animateSkillBars() {
    document.querySelectorAll('.skill-bar-fill').forEach(bar => {
        bar.style.setProperty('--target-width', `${bar.dataset.level || 0}%`);
        bar.classList.add('animate');
    });
}

function renderAdminButtons(type, index, item = {}) {
    if (!state.isAdmin) return '';
    const hidden = !!item.hidden;
    return `
        ${hidden ? '<span class="admin-element absolute top-2 left-2 ltr:right-2 ltr:left-auto z-30 px-2 py-0.5 rounded-full bg-gray-800 text-white text-[10px] font-bold items-center gap-1"><i class="fas fa-eye-slash"></i> مخفي</span>' : ''}
        <div class="admin-element absolute top-2 right-2 ltr:left-2 ltr:right-auto z-30
                    gap-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center">
            <span class="drag-handle bg-white dark:bg-gray-700 text-gray-500 w-7 h-7 rounded-lg shadow
                         flex items-center justify-center hover:bg-gray-100 cursor-move border border-gray-200 dark:border-gray-600">
                <i class="fas fa-grip-vertical text-[10px]"></i>
            </span>
            <button type="button" data-action="toggle-hidden" data-type="${type}" data-index="${index}" aria-pressed="${hidden}"
                    aria-label="${hidden ? 'إظهار للزوار / Show' : 'إخفاء عن الزوار / Hide'}" title="${hidden ? 'إظهار للزوار' : 'إخفاء عن الزوار'}"
                    class="bg-gray-700 text-white w-7 h-7 rounded-lg shadow flex items-center justify-center hover:bg-gray-800 hover:scale-110 transition">
                <i class="fas ${hidden ? 'fa-eye' : 'fa-eye-slash'} text-[10px]"></i>
            </button>
            <button type="button" data-action="edit-item" data-type="${type}" data-index="${index}" aria-label="Edit"
                    class="bg-blue-500 text-white w-7 h-7 rounded-lg shadow flex items-center justify-center hover:bg-blue-600 hover:scale-110 transition">
                <i class="fas fa-pen text-[10px]"></i>
            </button>
            <button type="button" data-action="delete-item" data-type="${type}" data-index="${index}" aria-label="Delete"
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
            if (obj[last] && typeof obj[last] === 'object') obj[last][state.currentLang] = el.innerText;
            else obj[last] = el.innerText;
        };
    }
}

function typeWriter(text, elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    if (twInterval) { clearInterval(twInterval); twInterval = null; }
    // Screen readers get the whole title at once (the animated copy is aria-hidden).
    const srEl = document.getElementById(`${elementId}-sr`);
    if (srEl) srEl.textContent = text;
    if (prefersReducedMotion()) { el.textContent = text; return; }
    el.textContent = '';
    const chars = Array.from(text);       // whole code points, so emoji/Arabic marks are never split
    let i = 0;
    if (!chars.length) return;
    twInterval = setInterval(() => {
        el.textContent += chars[i];
        if (++i >= chars.length) { clearInterval(twInterval); twInterval = null; }
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
    if (el) el.innerText = (msgs[state.currentLang] || msgs.ar)[key];
}
