// Shared, mutable application state. ES modules cannot reassign each other's bindings,
// so everything that changes at runtime lives on this one object.
import { local } from './storage.js';

export const LANGS = ['ar', 'en'];

// ?lang=en|ar (shareable links, hreflang) wins over the saved choice; Arabic is the default.
// js/early.js applies the same rule before first paint.
function initialLang() {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(fromUrl)) return fromUrl;
    const saved = local.get('lang');
    return LANGS.includes(saved) ? saved : 'ar';
}

export const state = {
    appData:           {},
    currentLang:       initialLang(),
    isAdmin:           false,
    activeSkillTab:    'hard',
    activeFilter:      'all',        // project filter
    dataLoaded:        false,
    lastSavedSnapshot: null          // in-memory copy of the last loaded/saved data (admin "restore")
};

// The GitHub token lives in sessionStorage only: it disappears when the tab closes.
export const SESSION_KEYS = { token: 'gh_token', repo: 'gh_repo', loginTime: 'gh_login_time' };
export const DEFAULT_REPO = 'OsamaAL-Harbi/CV';
