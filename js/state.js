// Shared, mutable application state. ES modules cannot reassign each other's bindings,
// so everything that changes at runtime lives on this one object.
export const state = {
    appData:           {},
    currentLang:       localStorage.getItem('lang') || 'ar',
    isAdmin:           false,
    activeSkillTab:    'hard',
    activeFilter:      'all',        // project filter
    dataLoaded:        false,
    lastSavedSnapshot: null          // in-memory copy of the last loaded/saved data (admin "restore")
};

// The GitHub token lives in sessionStorage only: it disappears when the tab closes.
export const SESSION_KEYS = { token: 'gh_token', repo: 'gh_repo', loginTime: 'gh_login_time' };
export const DEFAULT_REPO = 'OsamaAL-Harbi/CV';
