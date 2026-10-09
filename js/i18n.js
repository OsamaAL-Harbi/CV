// Localisation: bilingual values, static UI strings and RTL/LTR switching.
import { state } from './state.js';
import { updateMetaTags } from './router.js';
import { renderAll } from './render.js';

export function t(data) {
    if (data === null || data === undefined) return '';
    if (typeof data === 'object') return data[state.currentLang] || data.ar || '';
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
        stat_projects:'مشروع تخرج', stat_graduation:'سنة التخرج',
        not_found_title:'الصفحة غير موجودة', not_found_desc:'يبدو أن الرابط الذي طلبته غير موجود',
        not_found_btn:'العودة للرئيسية',
        aria_theme:'الوضع الليلي', aria_menu_open:'فتح القائمة', aria_menu_close:'إغلاق القائمة', aria_scroll_top:'العودة للأعلى',
        filter_all:'الكل'
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
        stat_projects:'Graduation Project', stat_graduation:'Graduation Year',
        not_found_title:'Page Not Found', not_found_desc:'The link you requested does not exist',
        not_found_btn:'Back to Home',
        aria_theme:'Toggle dark mode', aria_menu_open:'Open menu', aria_menu_close:'Close menu', aria_scroll_top:'Back to top',
        filter_all:'All'
    }
};

export function setDirection() {
    document.documentElement.dir  = state.currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = state.currentLang;
    const btn = document.getElementById('lang-btn');
    if (btn) btn.textContent = state.currentLang === 'ar' ? 'EN' : 'عربي';
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
}

export function toggleLanguage() {
    state.currentLang = state.currentLang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('lang', state.currentLang);
    setDirection();
    renderAll();
    updateStaticText();
    // Re-apply meta for current page
    const hash = window.location.hash.replace('#', '') || 'home';
    updateMetaTags(hash);
}
