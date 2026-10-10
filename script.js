/**
 * OSAMA PORTFOLIO — entry module (loaded with type="module").
 * The code lives in js/: state, storage, utils, i18n, router, render, modal, ui, actions and admin.
 * admin.js is downloaded only when an admin session exists or an admin action is used.
 */
import { state, SESSION_KEYS, DEFAULT_REPO } from './js/state.js';
import { local, session } from './js/storage.js';
import { showToast } from './js/utils.js';
import { setDirection, updateStaticText } from './js/i18n.js';
import { handleHash } from './js/router.js';
import { renderAll, setSmartGreeting } from './js/render.js';
import { setupModal } from './js/modal.js';
import { initTheme, initParticles, setupSecretTrigger, setupCmdPalette, registerPWA, setupScrollTop, checkLinkedInReferrer, initStatsObserver, setupPrint, setupTilt } from './js/ui.js';
import { setupActions } from './js/actions.js';
import { syncSiteTheme } from './js/color.js';

// Older versions kept the token (and a data backup) in localStorage forever.
function purgeLegacyAdminStorage() {
    ['saved_token', 'login_time', 'backup_data'].forEach(k => local.remove(k));
}

async function loadContent() {
    try {
        // no-cache = revalidate with the server (ETag) instead of a cache-busting query string
        const res = await fetch('data.json', { cache: 'no-cache' });
        if (!res.ok) throw new Error('data.json not found');
        state.appData    = await res.json();
        state.dataLoaded = true;
        state.lastSavedSnapshot = JSON.stringify(state.appData);
        syncSiteTheme(state.appData.theme);
        renderAll();
        setSmartGreeting();
        initStatsObserver();
        return true;
    } catch (err) {
        // Offline without a cached copy, or a broken deploy: say so instead of an empty page
        document.getElementById('load-error')?.classList.remove('hidden');
        showToast('خطأ في تحميل البيانات / Error loading data', 'error');
        return false;
    } finally {
        updateStaticText();
        document.getElementById('loading-screen').classList.add('hidden');
    }
}

function boot() {
    // Reduced motion: AOS removes its attributes so content is shown without animation
    window.AOS?.init({ duration: 800, once: true, disable: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches });

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    setDirection();
    initTheme();
    // Decorative, so it waits until the page is idle
    (window.requestIdleCallback || (cb => setTimeout(cb, 1500)))(() => initParticles());
    setupSecretTrigger();
    setupCmdPalette();
    setupModal();
    setupPrint();
    registerPWA();
    setupScrollTop();
    setupTilt();
    checkLinkedInReferrer();

    purgeLegacyAdminStorage();
    const ri = document.getElementById('repo-input');
    if (ri) ri.value = local.get('saved_repo') || DEFAULT_REPO;

    // Hash routing — must run after data loads
    loadContent().then(loaded => {
        if (loaded && session.get(SESSION_KEYS.token)) {
            import('./js/admin.js').then(m => m.checkSession())
                .catch(() => showToast('تعذّر تحميل لوحة الإدارة / Could not load the admin panel', 'error'));
        }
        handleHash();                  // respect URL hash on first load
    });

    setupActions();

    // React to hash changes (back/forward browser buttons + nav links)
    window.addEventListener('hashchange', handleHash);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
