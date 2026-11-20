// Localisation: bilingual values, static UI strings and RTL/LTR switching.
import { state } from './state.js';
import { local } from './storage.js';
import { refreshMeta } from './router.js';
import { renderAll, setSmartGreeting } from './render.js';
import { STATIC_TEXT } from './strings.js';

export const SITE_URL = 'https://osamaal-harbi.github.io/CV/';

// Arabic lives at the site root (x-default). English: en.html on the deployed site (scripts/english-page.mjs writes it
// and marks both pages with <meta name="site-en-page">), else ?lang=en — as declared by the hreflang links.
const hasEnPage = () => document.querySelector('meta[name="site-en-page"]')?.getAttribute('content') === 'en.html';
export function langUrl(lang) {
    if (lang !== 'en') return SITE_URL;
    return hasEnPage() ? `${SITE_URL}en.html` : `${SITE_URL}?lang=en`;
}

export function t(data) {
    if (data === null || data === undefined) return '';
    if (typeof data === 'object') return data[state.currentLang] || data.ar || data.en || '';
    return String(data);
}

export { STATIC_TEXT };

// Static UI string for the current language.
export function ui(key) {
    return STATIC_TEXT[state.currentLang]?.[key] ?? STATIC_TEXT.ar[key] ?? '';
}

export function setDirection() {
    document.documentElement.dir  = state.currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = state.currentLang;
    const btn = document.getElementById('lang-btn');
    if (btn) btn.textContent = state.currentLang === 'ar' ? 'EN' : 'عربي';
    syncLangUrl();
}

// Keeps the address bar, canonical URL and Open Graph locale in step with the language.
function syncLangUrl() {
    const url = new URL(location.href);
    if (hasEnPage()) {
        url.searchParams.delete('lang');
        url.pathname = url.pathname.replace(/[^/]*$/, state.currentLang === 'en' ? 'en.html' : '');
    } else if (state.currentLang === 'en') url.searchParams.set('lang', 'en');
    else url.searchParams.delete('lang');
    if (url.href !== location.href) history.replaceState(history.state, '', url);

    const canonical = langUrl(state.currentLang);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical);
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical);
    const [locale, other] = state.currentLang === 'en' ? ['en_US', 'ar_SA'] : ['ar_SA', 'en_US'];
    document.querySelector('meta[property="og:locale"]')?.setAttribute('content', locale);
    document.querySelector('meta[property="og:locale:alternate"]')?.setAttribute('content', other);
}

export function updateStaticText() {
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if (STATIC_TEXT[state.currentLang]?.[key]) el.innerText = STATIC_TEXT[state.currentLang][key];
    });
    document.querySelectorAll('[data-lang-aria]').forEach(el => {
        const label = STATIC_TEXT[state.currentLang]?.[el.getAttribute('data-lang-aria')];
        if (label) el.setAttribute('aria-label', label);
    });
    document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
        const text = STATIC_TEXT[state.currentLang]?.[el.getAttribute('data-lang-placeholder')];
        if (text) el.setAttribute('placeholder', text);
    });
}

export function toggleLanguage() {
    state.currentLang = state.currentLang === 'ar' ? 'en' : 'ar';
    local.set('lang', state.currentLang);
    setDirection();
    renderAll();
    updateStaticText();
    setSmartGreeting();               // the greeting stayed in the previous language
    window.dispatchEvent(new Event('langchange'));   // lazily loaded parts (js/github.js) re-render
    refreshMeta();                    // title and description of the current address, in the new language
}
