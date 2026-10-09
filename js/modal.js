// Project details modal and its per-session view counter.
import { state } from './state.js';
import { escapeHTML, safeUrl } from './utils.js';
import { t } from './i18n.js';
import { getProjectKey, renderFilteredProjects } from './render.js';

export function openProjectModal(index) {
    const item = (state.appData.projects || [])[index];
    if (!item) return;

    // Stable key per project title
    const key     = getProjectKey(item, index);
    const views   = JSON.parse(sessionStorage.getItem('project_views') || '{}');
    views[key]    = (views[key] || 0) + 1;
    sessionStorage.setItem('project_views', JSON.stringify(views));

    const count      = views[key];
    const viewLabel  = state.currentLang === 'ar' ? 'مشاهدة' : (count === 1 ? 'view' : 'views');

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

    document.getElementById('modal-tech-label').textContent       = state.currentLang === 'ar' ? 'التقنيات المستخدمة' : 'Technologies Used';
    document.getElementById('modal-challenges-label').textContent = state.currentLang === 'ar' ? 'التحديات'           : 'Challenges';
    document.getElementById('modal-results-label').textContent    = state.currentLang === 'ar' ? 'النتائج والإنجازات' : 'Results & Achievements';
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

export function closeProjectModal() {
    document.getElementById('project-modal').classList.add('hidden');
    document.body.style.overflow = '';
}

export function setupModal() {
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeProjectModal(); });
}
