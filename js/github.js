// Portfolio extras built from the files the "Deploy site" workflow generates every 12 hours:
//   generated/github.json   → contribution calendar, languages, featured repositories, recent activity
//   generated/readme/*.html → case-study pages (#portfolio/<repo>), sanitized by js/sanitize.js
//   generated/status.json   → "System status" sensors (uptime, response time)
// Loaded on demand the first time the portfolio is shown; every section stays hidden when its file is missing.
import { state } from './state.js';
import { escapeHTML, safeUrl, track } from './utils.js';
import { ui } from './i18n.js';
import { closeDialog, isDialogOpen, openDialog } from './modal.js';
import { sanitizeReadme } from './sanitize.js';

const cache = {};
let started = false;

const ar = () => state.currentLang === 'ar';
const locale = () => (ar() ? 'ar-u-nu-latn' : 'en');

async function loadJSON(path) {
    if (!(path in cache)) {
        cache[path] = fetch(path, { cache: 'no-cache' })
            .then(res => (res.ok ? res.json() : null))
            .catch(() => null);
    }
    return cache[path];
}

const settings = () => ({ calendar: true, activity: true, languages: true, ...(state.appData.github || {}) });

// ─── Entry points ─────────────────────────────────────
export async function showPortfolioExtras() {
    if (!started) {
        started = true;
        window.addEventListener('langchange', renderExtras);
    }
    await renderExtras();
}

async function renderExtras() {
    const [gh, status] = await Promise.all([
        state.appData.github ? loadJSON('generated/github.json') : null,
        (state.appData.monitor || []).length ? loadJSON('generated/status.json') : null
    ]);
    renderGithub(gh);
    renderStatus(status);
}

// ─── Formatting ───────────────────────────────────────
function relativeTime(iso) {
    const diff = (new Date(iso).getTime() - Date.now()) / 1000;
    if (!Number.isFinite(diff)) return '';
    const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
    const steps = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unit, secs] of steps) if (Math.abs(diff) >= secs) return rtf.format(Math.round(diff / secs), unit);
    return rtf.format(0, 'minute');
}

const number = n => new Intl.NumberFormat(locale()).format(n);

// CSP forbids style="" in generated markup; colours and widths are applied through the CSSOM instead.
function applyStyles(root) {
    root.querySelectorAll('[data-bg]').forEach(el => { el.style.backgroundColor = el.dataset.bg; });
    root.querySelectorAll('[data-w]').forEach(el => { el.style.width = `${el.dataset.w}%`; });
}

const safeColor = c => (/^#[0-9a-f]{3,8}$/i.test(c || '') ? c : '#9ca3af');

// ─── GitHub section ───────────────────────────────────
function renderGithub(gh) {
    const section = document.getElementById('github-section');
    if (!section) return;
    if (!gh) { section.classList.add('hidden'); return; }
    const s = settings();
    section.classList.remove('hidden');
    const profile = safeUrl(gh.user?.url);

    document.querySelector('#github-title span').textContent = ar() ? 'نشاطي على GitHub' : 'My GitHub Activity';
    const link = document.getElementById('github-profile-link');
    if (profile) { link.href = profile; link.classList.remove('hidden'); } else link.classList.add('hidden');
    document.getElementById('github-profile-login').textContent = `@${gh.user?.login || ''}`;
    document.getElementById('github-updated').textContent =
        `${ar() ? 'آخر تحديث' : 'Updated'} ${relativeTime(gh.generatedAt)}`;

    const repos = gh.repos || [];
    const top = gh.languages?.[0]?.name;
    document.getElementById('github-stats').innerHTML = [
        [number(gh.calendar?.total ?? 0), ar() ? 'مساهمة خلال سنة' : 'contributions in the last year'],
        repos.length ? [number(repos.length), ar() ? 'مستودع مختار' : 'featured repositories'] : null,
        repos.length ? [number(gh.totals?.stars ?? 0), ar() ? 'نجمة' : 'stars'] : null,
        top ? [escapeHTML(top), ar() ? 'اللغة الأكثر استخداماً' : 'top language'] : null
    ].filter(Boolean).map(([value, label]) => `
        <div class="bg-white dark:bg-cardBg rounded-2xl p-4 border border-gray-100 dark:border-gray-700 text-center">
            <div class="text-2xl font-extrabold text-primary" dir="ltr">${value}</div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${label}</p>
        </div>`).join('');

    renderCalendar(s.calendar ? gh.calendar : null);
    renderLanguages(s.languages ? gh.languages : null);
    renderRepos(repos);
    renderActivity(s.activity ? gh.activity : null);
}

// Contribution calendar as one SVG (53 weeks × 7 days), mirrored in RTL so time flows with the text.
function renderCalendar(calendar) {
    const box = document.getElementById('github-calendar');
    const wrap = document.getElementById('github-calendar-wrap');
    if (!calendar?.days?.length) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');

    const days = calendar.days;
    const first = new Date(`${days[0][0]}T00:00:00Z`).getUTCDay();
    const cols = Math.ceil((days.length + first) / 7);
    const cell = 11, gap = 3, step = cell + gap, topPad = 18;
    const left = ar() ? 46 : 30;            // Arabic weekday names have no short form
    const width = left + cols * step, height = topPad + 7 * step;
    const rtl = ar();
    const colX = col => (rtl ? width - left - (col + 1) * step + gap : left + col * step);

    const months = new Intl.DateTimeFormat(locale(), { month: 'short', timeZone: 'UTC' });
    let lastMonth = -1;
    const labels = [];
    const rects = days.map(([date, count, level], i) => {
        const pos = i + first, col = Math.floor(pos / 7), row = pos % 7;
        const d = new Date(`${date}T00:00:00Z`);
        if (row === 0 || i === 0) {
            const m = d.getUTCMonth();
            if (m !== lastMonth && d.getUTCDate() <= 7 && col < cols - 1) {
                labels.push(`<text x="${colX(col) + (rtl ? cell : 0)}" y="11" text-anchor="${rtl ? 'end' : 'start'}">${escapeHTML(months.format(d))}</text>`);
                lastMonth = m;
            }
        }
        return `<rect class="gh-l${Math.min(4, Math.max(0, level))}" x="${colX(col)}" y="${topPad + row * step}" width="${cell}" height="${cell}" rx="2" data-i="${i}"/>`;
    }).join('');
    const weekday = new Intl.DateTimeFormat(locale(), { weekday: 'short', timeZone: 'UTC' });
    const dayLabels = [1, 3, 5].map(r => {
        const d = new Date(Date.UTC(2023, 0, 1 + r));          // 1 Jan 2023 was a Sunday
        const x = rtl ? width - 2 : 0;
        return `<text x="${x}" y="${topPad + r * step + 9}" text-anchor="${rtl ? 'end' : 'start'}">${escapeHTML(weekday.format(d))}</text>`;
    }).join('');

    box.innerHTML = `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" class="gh-calendar mx-auto" aria-hidden="true" focusable="false">${labels.join('')}${dayLabels}${rects}</svg>`;

    // Screen readers get a summary instead of 371 squares.
    const busiest = days.reduce((best, d) => (d[1] > best[1] ? d : best), days[0]);
    const dateFmt = new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
    document.getElementById('github-calendar-summary').textContent = ar()
        ? `${number(calendar.total)} مساهمة خلال آخر سنة. أكثر يوم نشاطاً: ${dateFmt.format(new Date(`${busiest[0]}T00:00:00Z`))} (${number(busiest[1])}).`
        : `${number(calendar.total)} contributions in the last year. Busiest day: ${dateFmt.format(new Date(`${busiest[0]}T00:00:00Z`))} (${number(busiest[1])}).`;
    document.getElementById('github-legend-less').textContent = ar() ? 'أقل' : 'Less';
    document.getElementById('github-legend-more').textContent = ar() ? 'أكثر' : 'More';

    // One shared tooltip for every square
    const tip = document.getElementById('github-tooltip');
    const svg = box.querySelector('svg');
    svg.addEventListener('pointerover', e => {
        const i = e.target.dataset?.i;
        if (i === undefined) return;
        const [date, count] = days[Number(i)];
        const when = dateFmt.format(new Date(`${date}T00:00:00Z`));
        tip.textContent = ar() ? `${number(count)} مساهمة · ${when}` : `${number(count)} contribution${count === 1 ? '' : 's'} · ${when}`;
        const r = e.target.getBoundingClientRect(), host = box.getBoundingClientRect();
        tip.style.left = `${r.left - host.left + box.scrollLeft + r.width / 2}px`;
        tip.style.top = `${r.top - host.top - 6}px`;
        tip.classList.remove('hidden');
    });
    svg.addEventListener('pointerleave', () => tip.classList.add('hidden'));
    // Newest weeks first on narrow screens
    requestAnimationFrame(() => { box.scrollLeft = rtl ? -box.scrollWidth : box.scrollWidth; });
}

function renderLanguages(languages) {
    const wrap = document.getElementById('github-languages-wrap');
    if (!languages?.length) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    document.getElementById('github-languages-title').textContent = ar() ? 'اللغات في مشاريعي' : 'Languages in my projects';
    const bar = document.getElementById('github-languages-bar');
    bar.innerHTML = languages.map(l => `<span class="h-full" data-bg="${safeColor(l.color)}" data-w="${Number(l.percent) || 0}" title="${escapeHTML(l.name)} ${Number(l.percent)}%"></span>`).join('');
    const legend = document.getElementById('github-languages-legend');
    legend.innerHTML = languages.map(l => `
        <li class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" data-bg="${safeColor(l.color)}" aria-hidden="true"></span>
            <span class="font-bold" dir="ltr">${escapeHTML(l.name === 'Other' ? (ar() ? 'أخرى' : 'Other') : l.name)}</span>
            <span class="text-gray-500 dark:text-gray-400" dir="ltr">${Number(l.percent)}%</span></li>`).join('');
    applyStyles(bar);
    applyStyles(legend);
}

function renderRepos(repos) {
    const grid = document.getElementById('github-repos');
    if (!repos.length) { grid.innerHTML = ''; return; }
    grid.innerHTML = repos.map(repo => {
        const url = safeUrl(repo.url), home = safeUrl(repo.homepage);
        return `
        <article class="tilt relative bg-white dark:bg-cardBg rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm flex flex-col">
            <div class="flex items-start justify-between gap-3 mb-2">
                <h4 class="font-bold text-base dark:text-white break-all" dir="ltr"><i class="fas fa-book-bookmark text-gray-400 me-1.5" aria-hidden="true"></i>${escapeHTML(repo.name)}</h4>
                ${repo.archived ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-400 text-amber-700 dark:text-amber-300">${ar() ? 'مؤرشف' : 'Archived'}</span>` : ''}
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed flex-grow" dir="auto">${escapeHTML(repo.description || (ar() ? 'بلا وصف' : 'No description'))}</p>
            ${repo.topics?.length ? `<div class="flex flex-wrap gap-1.5 mt-3">${repo.topics.map(tp => `<span class="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold" dir="ltr">${escapeHTML(tp)}</span>`).join('')}</div>` : ''}
            <div class="flex flex-wrap items-center gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
                ${repo.language ? `<span class="flex items-center gap-1.5" dir="ltr"><span class="w-2.5 h-2.5 rounded-full" data-bg="${safeColor(repo.language.color)}" aria-hidden="true"></span>${escapeHTML(repo.language.name)}</span>` : ''}
                <span class="flex items-center gap-1" dir="ltr" aria-label="${ar() ? 'النجوم' : 'Stars'}: ${repo.stars}"><i class="fas fa-star" aria-hidden="true"></i>${number(repo.stars)}</span>
                <span class="flex items-center gap-1" dir="ltr" aria-label="${ar() ? 'النسخ' : 'Forks'}: ${repo.forks}"><i class="fas fa-code-branch" aria-hidden="true"></i>${number(repo.forks)}</span>
                <span>${escapeHTML(relativeTime(repo.pushedAt))}</span>
            </div>
            <div class="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                ${repo.readme ? `<a href="#portfolio/${encodeURIComponent(repo.name)}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition"><i class="fas fa-book-open" aria-hidden="true"></i>${ar() ? 'دراسة الحالة' : 'Case study'}</a>` : ''}
                ${url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs font-bold hover:opacity-90 transition"><i class="fab fa-github" aria-hidden="true"></i>GitHub</a>` : ''}
                ${home ? `<a href="${escapeHTML(home)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold hover:opacity-90 transition"><i class="fas fa-external-link-alt" aria-hidden="true"></i>${escapeHTML(ui('btn_live'))}</a>` : ''}
            </div>
        </article>`;
    }).join('');
    applyStyles(grid);
}

const ACTIVITY_TEXT = {
    push:    (e, a) => a ? `دفع ${e.count || ''} تحديث إلى` : `Pushed ${e.count || ''} commit${e.count === 1 ? '' : 's'} to`,
    release: (e, a) => a ? 'نشر إصداراً في' : 'Published a release in',
    create:  (e, a) => a ? 'أنشأ المستودع' : 'Created',
    pr:      (e, a) => a ? 'فتح طلب دمج في' : 'Opened a pull request in',
    merge:   (e, a) => a ? 'دمج طلباً في' : 'Merged a pull request in'
};
const ACTIVITY_ICON = { push: 'fa-code-commit', release: 'fa-tag', create: 'fa-plus', pr: 'fa-code-pull-request', merge: 'fa-code-merge' };

function renderActivity(activity) {
    const wrap = document.getElementById('github-activity-wrap');
    if (!activity?.length) { wrap.classList.add('hidden'); return; }
    wrap.classList.remove('hidden');
    document.getElementById('github-activity-title').textContent = ar() ? 'آخر النشاطات' : 'Recent activity';
    document.getElementById('github-activity').innerHTML = activity.map(e => {
        const text = ACTIVITY_TEXT[e.type]?.(e, ar());
        if (!text) return '';
        const detail = e.message || e.name || '';
        return `
        <li class="relative ps-8">
            <span class="absolute start-0 top-0.5 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-primary flex items-center justify-center text-[11px]" aria-hidden="true"><i class="fas ${ACTIVITY_ICON[e.type]}"></i></span>
            <p class="text-sm dark:text-gray-200">${escapeHTML(text)} <b dir="ltr">${escapeHTML(e.repo)}</b></p>
            ${detail ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate" dir="auto">${escapeHTML(detail)}</p>` : ''}
            <p class="text-[11px] text-gray-400 mt-0.5">${escapeHTML(relativeTime(e.at))}</p>
        </li>`;
    }).join('');
}

// ─── System status (PRTG-style sensors) ───────────────
const STATE = {
    up:   { ar: 'يعمل',  en: 'Up',   dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400', ring: 'border-green-200 dark:border-green-900' },
    slow: { ar: 'بطيء',  en: 'Slow', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', ring: 'border-amber-200 dark:border-amber-900' },
    down: { ar: 'متوقف', en: 'Down', dot: 'bg-red-500',   text: 'text-red-700 dark:text-red-400',     ring: 'border-red-200 dark:border-red-900' }
};

export function uptime(history) {
    if (!history?.length) return null;
    return Math.round((history.filter(h => h[1] === 1).length / history.length) * 1000) / 10;
}

function sparkline(history) {
    const values = history.map(h => h[2]).filter(Number.isFinite);
    if (values.length < 2) return '';
    const w = 120, h = 28, max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
    const points = values.map((v, i) => `${((i / (values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`).join(' ');
    return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="text-primary" aria-hidden="true" focusable="false"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function renderStatus(status) {
    const section = document.getElementById('status-section');
    if (!section) return;
    const sensors = status?.sensors || [];
    if (!sensors.length) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    const allUp = sensors.every(s => s.state === 'up');
    document.querySelector('#status-title span').textContent = ar() ? 'مراقبة الأنظمة' : 'System Status';
    document.getElementById('status-summary').textContent = ar()
        ? `${allUp ? 'كل الأنظمة تعمل' : 'بعض الأنظمة تحتاج انتباهاً'} · فحص كل ${status.intervalHours || 12} ساعة · آخر فحص ${relativeTime(status.generatedAt)}`
        : `${allUp ? 'All systems operational' : 'Some systems need attention'} · checked every ${status.intervalHours || 12} h · last check ${relativeTime(status.generatedAt)}`;
    document.getElementById('status-summary-dot').className = `w-2.5 h-2.5 rounded-full ${allUp ? 'bg-green-500' : 'bg-amber-500'} motion-safe:animate-pulse`;

    document.getElementById('status-sensors').innerHTML = sensors.map(s => {
        const st = STATE[s.state] || STATE.down;
        const up = uptime(s.history);
        const url = safeUrl(s.url);
        let host = '';
        try { host = new URL(s.url).host; } catch { /* invalid url */ }
        return `
        <li class="bg-white dark:bg-cardBg rounded-2xl p-4 border ${st.ring} flex items-center gap-4 flex-wrap">
            <span class="w-3 h-3 rounded-full ${st.dot} flex-shrink-0" aria-hidden="true"></span>
            <div class="flex-1 min-w-[10rem]">
                <p class="font-bold text-sm dark:text-white" dir="auto">${escapeHTML(s.name)}</p>
                ${url ? `<a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer" class="text-xs text-gray-500 dark:text-gray-400 hover:text-primary" dir="ltr">${escapeHTML(host)}</a>` : ''}
            </div>
            <span class="text-xs font-bold ${st.text}">${st[state.currentLang] || st.en}${s.code ? ` <span dir="ltr">(${Number(s.code)})</span>` : ''}</span>
            <div class="text-center"><p class="text-sm font-extrabold dark:text-white" dir="ltr">${up === null ? '—' : `${up}%`}</p><p class="text-[10px] text-gray-500 dark:text-gray-400">${ar() ? 'التوفر (30 يوماً)' : 'Uptime (30 d)'}</p></div>
            <div class="text-center"><p class="text-sm font-extrabold dark:text-white" dir="ltr">${number(s.ms)} ms</p><p class="text-[10px] text-gray-500 dark:text-gray-400">${ar() ? 'زمن الاستجابة' : 'Response'}</p></div>
            <div class="hidden sm:block" title="${ar() ? 'زمن الاستجابة عبر الفحوص الأخيرة' : 'Response time over recent checks'}">${sparkline(s.history || [])}</div>
        </li>`;
    }).join('');
}

// ─── Case-study page (#portfolio/<repo>) ──────────────
export async function openCaseStudy(name) {
    const gh = state.appData.github ? await loadJSON('generated/github.json') : null;
    const repo = gh?.repos?.find(r => r.name.toLowerCase() === String(name).toLowerCase());
    const modal = document.getElementById('case-modal');
    if (!repo || !repo.readme) {
        history.replaceState(history.state, '', '#portfolio');
        return;
    }
    const owner = gh.user.login;
    const body = document.getElementById('case-body');
    document.getElementById('case-title').textContent = repo.name;
    document.getElementById('case-desc').textContent = repo.description || '';
    const meta = [
        repo.language && `<span class="flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full" data-bg="${safeColor(repo.language.color)}"></span>${escapeHTML(repo.language.name)}</span>`,
        `<span><i class="fas fa-star" aria-hidden="true"></i> ${number(repo.stars)}</span>`,
        `<span>${escapeHTML(relativeTime(repo.pushedAt))}</span>`
    ].filter(Boolean).join('');
    const metaEl = document.getElementById('case-meta');
    metaEl.innerHTML = meta;
    applyStyles(metaEl);
    const gl = document.getElementById('case-github');
    const repoUrl = safeUrl(repo.url);
    gl.classList.toggle('hidden', !repoUrl);
    if (repoUrl) gl.href = repoUrl;
    const live = document.getElementById('case-live');
    const home = safeUrl(repo.homepage);
    live.classList.toggle('hidden', !home);
    if (home) live.href = home;
    document.getElementById('case-live-label').textContent = ui('btn_live');

    body.replaceChildren(Object.assign(document.createElement('p'), { className: 'text-gray-500', textContent: ar() ? 'جاري التحميل…' : 'Loading…' }));
    if (!isDialogOpen(modal)) {
        if (!state.isAdmin) track('view_case_study', { project: repo.name });
        openDialog(modal, {
            focus: modal.querySelector('[data-action="close-case"]'),
            restoreFocus: () => document.querySelector(`#github-repos a[href="#portfolio/${CSS.escape(encodeURIComponent(repo.name))}"]`)?.focus(),
            onClose: () => { if (location.hash.startsWith('#portfolio/')) history.replaceState(history.state, '', '#portfolio'); }
        });
    }
    document.title = `${repo.name} | ${ar() ? 'أسامة الحربي' : 'Osama Al-Harbi'}`;
    try {
        const res = await fetch(`generated/readme/${encodeURIComponent(repo.name)}.html`, { cache: 'no-cache' });
        if (!res.ok) throw new Error(String(res.status));
        const enc = encodeURIComponent;
        body.replaceChildren(sanitizeReadme(await res.text(), {
            linkBase:  `https://github.com/${enc(owner)}/${enc(repo.name)}/blob/${enc(repo.branch)}/`,
            imageBase: `https://raw.githubusercontent.com/${enc(owner)}/${enc(repo.name)}/${enc(repo.branch)}/`
        }));
    } catch {
        body.replaceChildren(Object.assign(document.createElement('p'), { className: 'text-red-600', textContent: ar() ? 'تعذّر تحميل الملف.' : 'Could not load the README.' }));
    }
    body.scrollTop = 0;
}

export function closeCaseStudy() {
    closeDialog(document.getElementById('case-modal'));
}
