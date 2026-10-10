// Hash routing between the SPA sections, per-page meta tags and visit tracking.
import { state } from './state.js';
import { session } from './storage.js';

export const VALID_PAGES        = ['home', 'resume', 'portfolio', 'contact'];

// Particles hue-rotation per section
const SECTION_HUE = { home: 0, resume: 180, portfolio: 120, contact: 90, 'not-found': 0 };

const PAGE_META = {
    ar: {
        home:      { title: 'أسامة الحربي | الرئيسية',                    desc: 'الموقع الشخصي لأسامة عبدالعزيز الحربي - خريج تقنية المعلومات من الجامعة الإسلامية بالمدينة المنورة.' },
        resume:    { title: 'السيرة الذاتية | أسامة الحربي',              desc: 'السيرة الذاتية الكاملة لأسامة الحربي: خبرات، تعليم، مهارات، شهادات.' },
        portfolio: { title: 'معرض الأعمال | أسامة الحربي',                desc: 'مشاريع أسامة الحربي البرمجية والتقنية.' },
        contact:   { title: 'تواصل معي | أسامة الحربي',                   desc: 'تواصل مع أسامة الحربي عبر البريد الإلكتروني أو LinkedIn.' },
        'not-found': { title: 'الصفحة غير موجودة | أسامة الحربي',          desc: 'الرابط المطلوب غير موجود في موقع أسامة الحربي.' }
    },
    en: {
        home:      { title: 'Osama Al-Harbi | Portfolio',                  desc: 'Personal website of Osama Abdulaziz Al-Harbi – IT Graduate, Islamic University of Madinah.' },
        resume:    { title: 'Resume | Osama Al-Harbi',                     desc: 'Full resume of Osama Al-Harbi: experience, education, skills, certifications.' },
        portfolio: { title: 'Portfolio | Osama Al-Harbi',                  desc: 'Technical and programming projects by Osama Al-Harbi.' },
        contact:   { title: 'Contact | Osama Al-Harbi',                    desc: 'Get in touch with Osama Al-Harbi via email or LinkedIn.' },
        'not-found': { title: 'Page Not Found | Osama Al-Harbi',           desc: 'The requested link does not exist on this site.' }
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

    const changed = activateSection(pageId);
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });

    document.querySelectorAll('.nav-link').forEach(btn => {
        const active = btn.id === `nav-${pageId}`;
        btn.classList.toggle('nav-active', active);
        if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
    });

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
    if (changed) trackPageVisit(pageId);
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Shows one section and hides the others. Returns false when it was already the visible one.
function activateSection(id) {
    const target = document.getElementById(id);
    if (!target) return false;
    const changed = target.style.display !== 'block' || !target.classList.contains('active');
    document.querySelectorAll('.page-section').forEach(sec => {
        if (sec === target) return;
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    if (!changed) return false;
    target.style.display = 'block';
    setTimeout(() => { target.classList.add('active'); window.AOS?.refresh(); }, 10);
    // Screen readers and keyboard users start at the new section's heading, not at the old link.
    if (initialised) {
        const heading = target.querySelector('h1, h2') || target;
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
    }
    initialised = true;
    return true;
}

let initialised = false;

function show404() {
    activateSection('not-found');
    document.querySelectorAll('.nav-link').forEach(btn => { btn.classList.remove('nav-active'); btn.removeAttribute('aria-current'); });
    updateMetaTags('not-found');
}

export function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    const opening = !menu.classList.contains('open');
    menu.classList.toggle('closed', !opening);
    menu.classList.toggle('open', opening);
    const opener = document.querySelector('nav [aria-controls="mobile-menu"]');
    opener?.setAttribute('aria-expanded', String(opening));
    document.body.classList.toggle('overflow-hidden', opening);
    if (opening) menu.querySelector('a, button')?.focus();
    else if (menu.contains(document.activeElement)) opener?.focus();
}

// The canonical URL and og:url stay on the site root: hash fragments are not separate pages for crawlers.
export function updateMetaTags(pageId) {
    const meta = PAGE_META[state.currentLang]?.[pageId];
    if (!meta) return;

    document.title = meta.title;

    const setMeta = (id, val) => { const el = document.getElementById(id); if (el) el.setAttribute('content', val); };
    setMeta('meta-description', meta.desc);
    setMeta('og-title',         meta.title);
    setMeta('og-description',   meta.desc);
    setMeta('tw-title',         meta.title);   // was writing the title into twitter:card
    setMeta('tw-description',   meta.desc);
}

function trackPageVisit(pageId) {
    const visits = session.getJSON('page_visits', {});
    visits[pageId] = (visits[pageId] || 0) + 1;
    session.setJSON('page_visits', visits);
}
