// UI actions: one delegated listener dispatches data-action attributes (no inline handlers, CSP-safe).
import { state } from './state.js';
import { showToast } from './utils.js';
import { toggleLanguage } from './i18n.js';
import { toggleMobileMenu } from './router.js';
import { setProjectFilter, setSkillTab } from './render.js';
import { closeDialog, closeProjectModal, openProjectModal } from './modal.js';
import { closeCmdPalette, contactAction, downloadVCard, filterCmd, openCmdPalette, runCommand, sendMailto, shareProfile, triggerPrint, updateCharCounter } from './ui.js';

// Admin code is only downloaded when an admin action is used.
const admin = (name, ...args) => import('./admin.js').then(m => m[name](...args));

const ACTIONS = {
    'toggle-language':       () => toggleLanguage(),
    'toggle-menu':           () => toggleMobileMenu(),
    'share':                 () => shareProfile(),
    'print':                 () => triggerPrint(),
    'scroll-top':            () => window.scrollTo({ top: 0, behavior: 'smooth' }),
    'send-mail':             () => sendMailto(),
    'contact':               el => contactAction(el.dataset.contact),
    'set-skill-tab':         el => setSkillTab(el.dataset.tab),
    'set-filter':            el => setProjectFilter(el.dataset.filter),
    'open-project':          el => openProjectModal(Number(el.dataset.index)),
    'close-project-modal':   () => closeProjectModal(),
    'project-modal-backdrop': (el, e) => { if (e.target === el) closeProjectModal(); },
    'run-command':           el => runCommand(Number(el.dataset.index)),
    'open-cmd':              () => openCmdPalette(),
    'cmd-backdrop':          (el, e) => { if (e.target === el) closeCmdPalette(); },
    'download-vcard':        () => downloadVCard(),
    'retry-load':            () => location.reload(),
    'close-admin-modal':     () => closeDialog(document.getElementById('admin-modal')),
    'admin-backdrop':        (el, e) => { if (e.target === el) closeDialog(el); },
    'login':                 () => admin('authenticateAndEdit'),
    'logout':                () => admin('logout'),
    'save':                  () => admin('saveToGitHub'),
    'analytics':             () => admin('showAnalyticsDashboard'),
    'restore-backup':        () => admin('restoreBackup'),
    'manage-profile':        () => admin('manageProfile'),
    'edit-image':            el => admin('editImage', el.dataset.path),
    'add-item':              el => admin('addItem', el.dataset.type),
    'edit-item':             el => admin('editItem', el.dataset.type, Number(el.dataset.index)),
    'delete-item':           el => admin('deleteItem', el.dataset.type, Number(el.dataset.index))
};

function runAction(e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    // A real link inside an action area (e.g. "Live Demo" on a project card) keeps its own behaviour.
    const link = e.target.closest('a[href]');
    if (link && link !== el && el.contains(link)) return;
    const action = ACTIONS[el.dataset.action];
    if (!action) return;
    Promise.resolve()
        .then(() => action(el, e))
        .catch(() => showToast(state.currentLang === 'ar' ? 'حدث خطأ، حاول مجدداً' : 'Something went wrong, please retry', 'error'));
}

export function setupActions() {
    document.addEventListener('click', runAction);
    // Keyboard support for non-button elements acting as buttons
    document.addEventListener('keydown', e => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const el = e.target.closest('[data-action][role="button"]');
        if (!el || el !== e.target) return;
        e.preventDefault();
        runAction(e);
    });
    document.getElementById('contact-message')?.addEventListener('input', e => updateCharCounter(e.target));
    document.getElementById('cmd-input')?.addEventListener('input', e => filterCmd(e.target.value));
    // Enter in the login fields submits, like a form would
    ['repo-input', 'token-input'].forEach(id => document.getElementById(id)?.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); document.querySelector('[data-action="login"]')?.click(); }
    }));
}
