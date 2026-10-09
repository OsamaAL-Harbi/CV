/**
 * OSAMA PORTFOLIO — entry module (loaded with type="module").
 * The code lives in js/: state, utils, i18n, router, render, modal, ui, actions and admin.
 * admin.js is downloaded only when an admin session exists or an admin action is used.
 */
import { state, SESSION_KEYS, DEFAULT_REPO } from './js/state.js';
import { showToast } from './js/utils.js';
import { setDirection, updateStaticText } from './js/i18n.js';
import { handleHash } from './js/router.js';
import { renderAll, setSmartGreeting } from './js/render.js';
import { setupModal } from './js/modal.js';
import { initTheme, initParticles, setupSecretTrigger, setupCmdPalette, registerPWA, setupScrollTop, checkLinkedInReferrer, initStatsObserver } from './js/ui.js';
import { setupActions } from './js/actions.js';

// Older versions kept the token (and a data backup) in localStorage forever.
function purgeLegacyAdminStorage() {
    ['saved_token', 'login_time', 'backup_data'].forEach(k => localStorage.removeItem(k));
}

async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if (!res.ok) throw new Error('data.json not found');
        state.appData    = await res.json();
        state.dataLoaded = true;
        state.lastSavedSnapshot = JSON.stringify(state.appData);
        renderAll();
        updateStaticText();
        setSmartGreeting();
        setTimeout(() => document.getElementById('loading-screen').classList.add('hidden'), 500);
    } catch (err) {
        showToast('خطأ في تحميل البيانات / Error loading data', 'error');
        document.getElementById('loading-screen').classList.add('hidden');
    }
}

function boot() {
    AOS.init({ duration: 800, once: true });

    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    setDirection();
    initTheme();
    initParticles();
    setupSecretTrigger();
    setupCmdPalette();
    setupModal();
    registerPWA();
    setupScrollTop();
    checkLinkedInReferrer();
    initStatsObserver();

    purgeLegacyAdminStorage();
    const ri = document.getElementById('repo-input');
    if (ri) ri.value = localStorage.getItem('saved_repo') || DEFAULT_REPO;

    // Hash routing — must run after data loads
    loadContent().then(() => {
        if (sessionStorage.getItem(SESSION_KEYS.token)) import('./js/admin.js').then(m => m.checkSession());
        handleHash();                  // respect URL hash on first load
    });

    setupActions();

    // React to hash changes (back/forward browser buttons + nav links)
    window.addEventListener('hashchange', handleHash);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
