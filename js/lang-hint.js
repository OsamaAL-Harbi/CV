// A one-time hint for visitors whose browser is not set to Arabic (recruiters abroad, English-speaking IT teams):
// the site opens in Arabic and says, in English, that an English version is one click away. Shown once; switching
// or closing it is remembered. Never shown when a language was chosen before, when the link asks for one (?lang=),
// or to a browser that lists Arabic among its languages.
import { state } from './state.js';
import { local } from './storage.js';
import { toggleLanguage } from './i18n.js';

const KEY = 'lang_hint';
// As opened: the page drops ?lang=ar from the address bar once it has applied it
const OPENED_WITH = location.search;

export function wantsEnglishHint({ lang, languages = [], saved, query = '', dismissed }) {
    if (lang !== 'ar' || saved || dismissed || /[?&]lang=/.test(query)) return false;
    const list = languages.filter(Boolean).map(l => String(l).toLowerCase());
    return list.length > 0 && !list.some(l => l === 'ar' || l.startsWith('ar-'));
}

export function showLangHint() {
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language];
    if (!wantsEnglishHint({ lang: state.currentLang, languages, saved: local.get('lang'), query: OPENED_WITH, dismissed: local.get(KEY) })) return;
    if (document.getElementById('lang-hint')) return;

    const bar = document.createElement('div');
    bar.id = 'lang-hint';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Language');
    bar.lang = 'en';
    bar.dir = 'ltr';
    bar.className = 'print-hide fixed z-50 bottom-4 inset-x-4 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 flex items-center gap-3 rounded-2xl bg-gray-900/95 dark:bg-gray-800/95 text-white text-sm shadow-xl px-4 py-3';
    bar.innerHTML = `<i class="fas fa-language text-lg shrink-0" aria-hidden="true"></i>
        <span class="flex-1">This portfolio is also available in English.</span>
        <button type="button" data-hint="switch" class="shrink-0 rounded-lg bg-white text-gray-900 font-bold px-3 py-1.5 hover:bg-gray-100">Switch to English</button>
        <button type="button" data-hint="close" aria-label="Dismiss" class="shrink-0 w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"><i class="fas fa-times" aria-hidden="true"></i></button>`;

    const close = () => { bar.remove(); window.removeEventListener('langchange', onChange); };
    const onChange = () => close();                       // switched with the header button instead
    bar.addEventListener('click', e => {
        const action = e.target.closest('[data-hint]')?.dataset.hint;
        if (!action) return;
        local.set(KEY, 'seen');
        close();
        if (action === 'switch' && state.currentLang === 'ar') toggleLanguage();
    });
    window.addEventListener('langchange', onChange);
    document.body.appendChild(bar);
}
