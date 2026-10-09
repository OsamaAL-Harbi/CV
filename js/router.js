// Hash routing between the SPA sections, per-page meta tags and visit tracking.
import { state } from './state.js';

export const VALID_PAGES        = ['home', 'resume', 'portfolio', 'contact'];

// Particles hue-rotation per section
const SECTION_HUE = { home: 0, resume: 180, portfolio: 120, contact: 90, 'not-found': 0 };

const PAGE_META = {
    ar: {
        home:      { title: 'أسامة الحربي | الرئيسية',                    desc: 'الموقع الشخصي لأسامة عبدالعزيز الحربي - خريج تقنية المعلومات من الجامعة الإسلامية بالمدينة المنورة.' },
        resume:    { title: 'السيرة الذاتية | أسامة الحربي',              desc: 'السيرة الذاتية الكاملة لأسامة الحربي: خبرات، تعليم، مهارات، شهادات.' },
        portfolio: { title: 'معرض الأعمال | أسامة الحربي',                desc: 'مشاريع أسامة الحربي البرمجية والتقنية.' },
        contact:   { title: 'تواصل معي | أسامة الحربي',                   desc: 'تواصل مع أسامة الحربي عبر البريد الإلكتروني أو LinkedIn.' }
    },
    en: {
        home:      { title: 'Osama Al-Harbi | Portfolio',                  desc: 'Personal website of Osama Abdulaziz Al-Harbi – IT Graduate, Islamic University of Madinah.' },
        resume:    { title: 'Resume | Osama Al-Harbi',                     desc: 'Full resume of Osama Al-Harbi: experience, education, skills, certifications.' },
        portfolio: { title: 'Portfolio | Osama Al-Harbi',                  desc: 'Technical and programming projects by Osama Al-Harbi.' },
        contact:   { title: 'Contact | Osama Al-Harbi',                    desc: 'Get in touch with Osama Al-Harbi via email or LinkedIn.' }
    }
};

// Called on every hashchange and on first load
export function handleHash() {
    const hash   = window.location.hash.replace('#', '').trim();
    const pageId = VALID_PAGES.includes(hash) ? hash : (hash === '' ? 'home' : null);
    if (pageId) showPage(pageId, false);  // false = don't push state again
    else if (hash !== '') show404();
}

export function showPage(pageId, pushState = true) {
    if (!VALID_PAGES.includes(pageId)) { show404(); return; }

    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });

    const target = document.getElementById(pageId);
    if (target) {
        target.style.display = 'block';
        setTimeout(() => { target.classList.add('active'); AOS.refresh(); }, 10);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('nav-active'));
    const navBtn = document.getElementById(`nav-${pageId}`);
    if (navBtn) navBtn.classList.add('nav-active');

    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu && mobileMenu.classList.contains('open')) toggleMobileMenu();

    // Update hash without triggering hashchange again
    if (pushState && window.location.hash !== `#${pageId}`) {
        history.pushState(null, '', `#${pageId}`);
    }

    // Update dynamic SEO meta tags
    updateMetaTags(pageId);

    // Shift particles hue per section
    const hue = SECTION_HUE[pageId] ?? 0;
    const pEl = document.getElementById('particles-js');
    if (pEl) pEl.style.filter = `hue-rotate(${hue}deg)`;

    // Track page visit in sessionStorage
    trackPageVisit(pageId);
}

function show404() {
    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    const el = document.getElementById('not-found');
    if (el) { el.style.display = 'block'; setTimeout(() => { el.classList.add('active'); AOS.refresh(); }, 10); }
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('nav-active'));
}

export function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('closed');
    menu.classList.toggle('open');
}

export function updateMetaTags(pageId) {
    const meta    = PAGE_META[state.currentLang]?.[pageId];
    if (!meta) return;
    const pageUrl = `${window.location.origin}${window.location.pathname}#${pageId}`;

    document.title = meta.title;

    const setMeta = (id, attr, val) => { const el = document.getElementById(id); if (el) el.setAttribute(attr, val); };
    setMeta('meta-description', 'content', meta.desc);
    setMeta('og-title',         'content', meta.title);
    setMeta('og-description',   'content', meta.desc);
    setMeta('og-url',           'content', pageUrl);
    setMeta('tw-title',         'content', meta.title);
    setMeta('canonical',        'href',    pageUrl);
}

function trackPageVisit(pageId) {
    const visits = JSON.parse(sessionStorage.getItem('page_visits') || '{}');
    visits[pageId] = (visits[pageId] || 0) + 1;
    sessionStorage.setItem('page_visits', JSON.stringify(visits));
}
