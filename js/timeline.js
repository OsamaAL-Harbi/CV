// Career timeline (resume page): experience, education, volunteering, certificates and workshops on one line,
// oldest to newest, grouped by year. Built from data.json in the browser; the dates are the texts already in the
// CV ("January 2026 – Present", "April 2026", "April 2024 (5 hours)") — items without a year are left out.
// Each entry jumps to its card in the resume below.
import { state } from './state.js';
import { escapeHTML } from './utils.js';
import { t, ui } from './i18n.js';
import { MONTHS, MONTHS_AR, TIMELINE_TYPES, timelineEntries } from './timeline-data.js';

const monthLabel = ({ year, month }) => (month ? `${state.currentLang === 'ar' ? MONTHS_AR[month - 1] : MONTHS[month - 1].replace(/^./, c => c.toUpperCase()).slice(0, 3)} ${year}` : String(year));

export function renderTimeline() {
    const wrap = document.getElementById('timeline-section');
    const track = document.getElementById('timeline-track');
    const chips = document.getElementById('timeline-filters');
    if (!wrap || !track || !chips) return;
    const all = timelineEntries(state.appData);
    const used = Object.keys(TIMELINE_TYPES).filter(type => all.some(e => e.type === type));
    if (!used.includes(state.timelineFilter)) state.timelineFilter = 'all';
    const entries = state.timelineFilter === 'all' ? all : all.filter(e => e.type === state.timelineFilter);
    wrap.classList.toggle('hidden', all.length < 2);          // a timeline of one point says nothing

    const chip = (key, label) => `<button type="button" data-action="timeline-filter" data-filter="${key}" aria-pressed="${state.timelineFilter === key}"
        class="px-3 py-1 text-xs font-bold rounded-full transition ${state.timelineFilter === key ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}">${escapeHTML(label)}</button>`;
    chips.innerHTML = chip('all', ui('filter_all')) + used.map(type => chip(type, ui(TIMELINE_TYPES[type].label))).join('');

    let lastYear = null;
    track.innerHTML = entries.map(e => {
        const def = TIMELINE_TYPES[e.type];
        const year = e.start.year !== lastYear ? `<li class="timeline-year" aria-hidden="true"><span>${e.start.year}</span></li>` : '';
        lastYear = e.start.year;
        const org = t(def.org(e.item));
        return `${year}<li class="timeline-item">
            <button type="button" data-action="timeline-go" data-type="${e.type}" data-index="${e.index}" class="timeline-card group text-start">
                <span class="timeline-dot ${def.color}" aria-hidden="true"><i class="fas ${def.icon}"></i></span>
                <span class="block text-[11px] font-bold text-gray-500 dark:text-gray-400">${escapeHTML(monthLabel(e.start))}${e.ongoing ? ` · ${escapeHTML(state.currentLang === 'ar' ? 'حتى الآن' : 'present')}` : ''}</span>
                <span class="block text-sm font-bold dark:text-white leading-snug group-hover:text-primary transition">${escapeHTML(t(def.title(e.item)))}</span>
                ${org ? `<span class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">${escapeHTML(org)}</span>` : ''}
            </button>
        </li>`;
    }).join('');
}

export function setTimelineFilter(filter) {
    state.timelineFilter = filter;
    renderTimeline();
}

// Scroll to the entry's card in the resume and highlight it briefly
export function goToTimelineItem(type, index) {
    const card = document.querySelector(`#${type}-container [data-index="${Number(index)}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    card.classList.add('timeline-flash');
    setTimeout(() => card.classList.remove('timeline-flash'), 1600);
}
