// Dialogs (project details, command palette, admin login): open/close, focus trap and focus restore,
// plus the project modal content.
import { state } from './state.js';
import { escapeHTML, imageSrc, safeUrl, track } from './utils.js';
import { t } from './i18n.js';
import { toggleMobileMenu } from './router.js';


const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
const openDialogs = [];   // stack: the last one is on top

const visible = el => el.offsetParent !== null || el === document.activeElement;

// opts.focus: element to focus first; opts.restoreFocus(): where focus goes on close when the
// opener no longer exists (e.g. a re-rendered card); opts.onClose(): cleanup.
export function openDialog(el, opts = {}) {
    if (!el || openDialogs.some(d => d.el === el)) return;
    openDialogs.push({ el, opener: document.activeElement, ...opts });
    el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    (opts.focus || [...el.querySelectorAll(FOCUSABLE)].find(visible))?.focus();
}

export function closeDialog(el) {
    if (!el) return;
    el.classList.add('hidden');
    const i = openDialogs.findIndex(d => d.el === el);
    if (i === -1) return;
    const [dialog] = openDialogs.splice(i, 1);
    if (!openDialogs.length) document.body.style.overflow = '';
    dialog.onClose?.();
    if (dialog.opener?.isConnected && dialog.opener !== document.body) dialog.opener.focus();
    else dialog.restoreFocus?.();
}

export const isDialogOpen = el => openDialogs.some(d => d.el === el);

function trapFocus(e) {
    const top = openDialogs[openDialogs.length - 1];
    if (!top) return;
    const items = [...top.el.querySelectorAll(FOCUSABLE)].filter(visible);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (!top.el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

export function openProjectModal(index) {
    const item = (state.appData.projects || [])[index];
    if (!item) return;
    const modal = document.getElementById('project-modal');

    // Counted in Google Analytics (admin → Statistics), not on this device
    if (!isDialogOpen(modal) && !state.isAdmin) track('view_project', { project: item.title?.en || item.title?.ar || String(index) });
    modal.dataset.index = String(index);

    const ar = state.currentLang === 'ar';
    document.getElementById('modal-title').textContent = t(item.title);
    const image = document.getElementById('modal-image');
    const src = imageSrc(item.image, state.previewImages);
    image.classList.toggle('hidden', !src);
    if (src) { image.src = src; image.alt = t(item.title); } else image.removeAttribute('src');
    document.getElementById('modal-desc').textContent  = t(item.desc);

    const techContainer = document.getElementById('modal-technologies');
    const techSection   = document.getElementById('modal-tech-section');
    if (techContainer) {
        techContainer.innerHTML = (item.technologies || []).map(tech =>
            `<span class="text-xs px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-bold" dir="ltr">${escapeHTML(tech)}</span>`
        ).join('');
    }
    if (techSection) techSection.style.display = item.technologies?.length ? 'block' : 'none';

    document.getElementById('modal-tech-label').textContent       = ar ? 'التقنيات المستخدمة' : 'Technologies Used';
    document.getElementById('modal-challenges-label').textContent = ar ? 'التحديات'           : 'Challenges';
    document.getElementById('modal-results-label').textContent    = ar ? 'النتائج والإنجازات' : 'Results & Achievements';
    document.getElementById('modal-link-label').textContent       = 'GitHub';
    document.getElementById('modal-live-label').textContent       = ar ? 'عرض مباشر' : 'Live Demo';

    // Empty blocks are hidden instead of showing an empty coloured box
    [['challenges', item.details?.challenges], ['results', item.details?.results]].forEach(([name, value]) => {
        const text = t(value);
        document.getElementById(`modal-${name}`).textContent = text;
        document.getElementById(`modal-${name}-block`).style.display = text ? 'block' : 'none';
    });

    const githubLink = document.getElementById('modal-github-link');
    const link = safeUrl(item.link);
    if (link) { githubLink.href = link; githubLink.style.display = 'inline-flex'; }
    else githubLink.style.display = 'none';

    const liveLink = document.getElementById('modal-live-link');
    const live = safeUrl(item.liveUrl);
    if (live) { liveLink.href = live; liveLink.style.display = 'inline-flex'; }
    else liveLink.style.display = 'none';
    document.getElementById('modal-actions').style.display = link || live ? 'flex' : 'none';

    openDialog(modal, {
        focus: modal.querySelector('[data-action="close-project-modal"]'),
        restoreFocus: () => document.querySelector(`#projects-container [data-action="open-project"][data-index="${index}"]`)?.focus()
    });
}

export function closeProjectModal() {
    closeDialog(document.getElementById('project-modal'));
}

export function setupModal() {
    document.addEventListener('keydown', e => {
        if (e.key === 'Tab') trapFocus(e);
        if (e.key !== 'Escape') return;
        if (document.querySelector('.swal2-container')) return;      // SweetAlert2 handles its own Escape
        const top = openDialogs[openDialogs.length - 1];
        if (top) { e.preventDefault(); closeDialog(top.el); return; }
        const menu = document.getElementById('mobile-menu');
        if (menu?.classList.contains('open')) toggleMobileMenu();
    });
}
