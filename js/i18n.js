// Localisation: bilingual values, static UI strings and RTL/LTR switching.
import { state } from './state.js';
import { local } from './storage.js';
import { updateMetaTags } from './router.js';
import { renderAll, setSmartGreeting } from './render.js';

export const SITE_URL = 'https://osamaal-harbi.github.io/CV/';

// Arabic lives at the site root (x-default); English at ?lang=en, as declared by the hreflang links.
export function langUrl(lang) {
    return lang === 'en' ? `${SITE_URL}?lang=en` : SITE_URL;
}

export function t(data) {
    if (data === null || data === undefined) return '';
    if (typeof data === 'object') return data[state.currentLang] || data.ar || data.en || '';
    return String(data);
}

export const STATIC_TEXT = {
    ar: {
        nav_home:'الرئيسية', nav_resume:'السيرة الذاتية', nav_portfolio:'الأعمال', nav_contact:'تواصل',
        btn_projects:'أعمالي', btn_save:'حفظ', btn_email:'فتح تطبيق الإيميل للإرسال',
        btn_download_cv:'تحميل PDF', btn_share:'مشاركة', btn_print:'طباعة',
        sec_resume:'السيرة الذاتية', sec_exp:'الخبرات', sec_edu:'التعليم',
        sec_volunteer:'التطوع', sec_skills:'المهارات', sec_certs:'الشهادات',
        sec_workshops:'ورش العمل', sec_languages:'اللغات', sec_projects:'معرض المشاريع',
        contact_title:'تواصل معي', contact_email_label:'البريد الإلكتروني',
        contact_click_copy:'انقر للنسخ', contact_open:'فتح الملف',
        contact_compose:'اكتب رسالة', contact_subject_label:'الموضوع',
        contact_message_label:'الرسالة', contact_mailto_note:'سيفتح تطبيق الإيميل على جهازك',
        contact_cv_title:'هل تريد مراجعة سيرتي الذاتية أولاً؟', contact_cv_sub:'تحميل مباشر — PDF جاهز',
        tab_hard:'تقنية', tab_soft:'شخصية',
        stat_certs:'شهادات مهنية', stat_volunteer:'ساعة تطوع',
        stat_projects:'مشاريع', stat_graduation:'سنة التخرج',
        not_found_title:'الصفحة غير موجودة', not_found_desc:'يبدو أن الرابط الذي طلبته غير موجود',
        not_found_btn:'العودة للرئيسية',
        aria_theme:'الوضع الليلي', aria_menu_open:'فتح القائمة', aria_menu_close:'إغلاق القائمة', aria_scroll_top:'العودة للأعلى',
        filter_all:'الكل',
        aria_lang:'EN — التبديل إلى الإنجليزية', aria_close:'إغلاق', aria_cmd:'لوحة الأوامر (Ctrl+K)', skip_link:'تخطَّ إلى المحتوى',
        btn_details:'التفاصيل', btn_live:'عرض مباشر', badge_live:'مباشر',
        cert_verify:'تحقق من الشهادة', btn_vcard:'حفظ جهة الاتصال', contact_vcard_sub:'بطاقة vCard لهاتفك أو بريدك',
        cmd_placeholder:'اكتب أمراً...', cmd_hint:'للتنقل ↑↓ · للتنفيذ Enter', cmd_empty:'لا توجد نتائج',
        load_error:'تعذّر تحميل المحتوى. تحقق من اتصالك ثم أعد المحاولة.', btn_retry:'إعادة المحاولة',
        skills_hard:'المهارات التقنية', skills_soft:'المهارات الشخصية'
    },
    en: {
        nav_home:'Home', nav_resume:'Resume', nav_portfolio:'Portfolio', nav_contact:'Contact',
        btn_projects:'My Work', btn_save:'Save', btn_email:'Open Email App',
        btn_download_cv:'Download PDF', btn_share:'Share', btn_print:'Print',
        sec_resume:'Resume', sec_exp:'Experience', sec_edu:'Education',
        sec_volunteer:'Volunteer', sec_skills:'Skills', sec_certs:'Certificates',
        sec_workshops:'Workshops', sec_languages:'Languages', sec_projects:'Portfolio',
        contact_title:'Get in Touch', contact_email_label:'Email',
        contact_click_copy:'Click to copy', contact_open:'Open Profile',
        contact_compose:'Write a Message', contact_subject_label:'Subject',
        contact_message_label:'Message', contact_mailto_note:'Your email app will open with the message',
        contact_cv_title:'Want to review my CV first?', contact_cv_sub:'Direct download — PDF ready',
        tab_hard:'Technical', tab_soft:'Soft Skills',
        stat_certs:'Certifications', stat_volunteer:'Volunteer Hours',
        stat_projects:'Projects', stat_graduation:'Graduation Year',
        not_found_title:'Page Not Found', not_found_desc:'The link you requested does not exist',
        not_found_btn:'Back to Home',
        aria_theme:'Toggle dark mode', aria_menu_open:'Open menu', aria_menu_close:'Close menu', aria_scroll_top:'Back to top',
        filter_all:'All',
        aria_lang:'عربي — Switch to Arabic', aria_close:'Close', aria_cmd:'Command palette (Ctrl+K)', skip_link:'Skip to content',
        btn_details:'Details', btn_live:'Live Demo', badge_live:'Live',
        cert_verify:'Verify credential', btn_vcard:'Save Contact', contact_vcard_sub:'vCard for your phone or mail app',
        cmd_placeholder:'Type a command...', cmd_hint:'↑↓ to navigate · Enter to run', cmd_empty:'No results',
        load_error:'Could not load the content. Check your connection and try again.', btn_retry:'Try again',
        skills_hard:'Technical Skills', skills_soft:'Soft Skills'
    }
};

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
    if (state.currentLang === 'en') url.searchParams.set('lang', 'en');
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
    // Re-apply meta for current page
    const hash = window.location.hash.replace('#', '') || 'home';
    updateMetaTags(hash);
}
