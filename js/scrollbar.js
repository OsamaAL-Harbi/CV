// Scrollbar style of the site, picked in admin → tools → Scrollbar (data.json → scrollbar). The styles are CSS
// in src/tailwind.css keyed on [data-scrollbar] (the page's <html>, or a preview box in the admin dialog), in the
// brand colours chosen in admin → colours and matched to light/dark mode. The deploy writes the choice into the
// page (<meta id="site-scrollbar">) so js/early.js applies it before first paint.
import { local } from './storage.js';

export const SCROLLBARS = [
    { id: 'brand',    label: 'بلون الموقع (الافتراضي)', desc: 'رفيع بلون الموقع الأساسي وزوايا دائرية' },
    { id: 'gradient', label: 'متدرّج',                 desc: 'تدرّج من اللون الأساسي إلى الثانوي' },
    { id: 'slim',     label: 'نحيف وهادئ',             desc: 'نحيف جداً ورمادي، يتلوّن عند المرور عليه' },
    { id: 'bold',     label: 'عريض',                   desc: 'أعرض وأسهل في الإمساك على الكمبيوتر' },
    { id: 'classic',  label: 'شريط النظام',            desc: 'شريط المتصفح الأصلي، متوافق مع الوضع الليلي' }
];
export const DEFAULT_SCROLLBAR = 'brand';
export const isScrollbar = id => SCROLLBARS.some(s => s.id === id);

export function applyScrollbar(id) {
    const style = isScrollbar(id) ? id : DEFAULT_SCROLLBAR;
    document.documentElement.dataset.scrollbar = style;
    return style;
}

// Applies data.json → scrollbar and caches it for js/early.js (the next visit's first paint)
export function syncSiteScrollbar(id) {
    const style = applyScrollbar(id);
    if (style === DEFAULT_SCROLLBAR) local.remove('scrollbar'); else local.set('scrollbar', style);
}
