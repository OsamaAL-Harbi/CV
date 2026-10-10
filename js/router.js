// Hash routing between the SPA sections, per-page meta tags and visit tracking.
import { state } from './state.js';
import { track } from './utils.js';

export const VALID_PAGES        = ['home', 'resume', 'portfolio', 'contact'];

// Particles hue-rotation per section
const SECTION_HUE = { home: 0, resume: 180, portfolio: 120, contact: 90, 'not-found': 0 };

export const PAGE_META = {
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
// Sub-routes: #portfolio/<repo> opens that repository's case study on top of the portfolio.
export function handleHash() {
    const hash   = decodeHash(window.location.hash.replace('#', '').trim());
    const [page, sub] = hash.split(/\/(.*)/s);
    const pageId = VALID_PAGES.includes(page) ? page : (hash === '' ? 'home' : null);
    // Opening/closing a case study keeps the portfolio where it was (no re-render, no scroll to top)
    if (pageId && !(pageId === 'portfolio' && currentPage === 'portfolio')) showPage(pageId, false);
    else if (!pageId && hash !== '') { show404(); return; }
    if (pageId !== 'portfolio') return;
    import('./github.js').then(m => (sub ? m.openCaseStudy(sub) : m.closeCaseStudy())).catch(() => {});
}

function decodeHash(value) {
    try { return decodeURIComponent(value); } catch { return value; }
}

export function showPage(pageId, pushState = true) {
    if (!VALID_PAGES.includes(pageId)) { show404(); return; }

    const changed = sectionChanges(pageId);
    currentPage = pageId;
    withTransition(changed, () => {
        activateSection(pageId, changed);
        document.querySelectorAll('.nav-link').forEach(btn => {
            const active = btn.id === `nav-${pageId}`;
            btn.classList.toggle('nav-active', active);
            if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
        });
    });
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });

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

    // GitHub activity and system status are fetched the first time the portfolio is shown
    if (pageId === 'portfolio') import('./github.js').then(m => m.showPortfolioExtras()).catch(() => {});

    if (changed) trackPageView(pageId);
}

// One GA page_view per section shown, titled like the page so the dashboard can group AR and EN together
function trackPageView(pageId) {
    if (state.isAdmin) return;                 // the owner's own visits are not counted
    track('page_view', {
        page_title: PAGE_META[state.currentLang]?.[pageId]?.title || pageId,
        page_location: `${location.origin}${location.pathname}${location.search}#${pageId}`,
        page_path: `${location.pathname}#${pageId}`,
        site_language: state.currentLang
    });
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canTransition = () => typeof document.startViewTransition === 'function' && !prefersReducedMotion();
if (canTransition()) document.documentElement.classList.add('vt');

// Section switches cross-fade with the View Transitions API where available (the nav underline glides
// to the new link); elsewhere, and on the first render, the DOM simply changes.
function withTransition(changed, update) {
    if (changed && initialised && canTransition() && !document.hidden) {
        try { document.startViewTransition(update); return; } catch { /* fall through */ }
    }
    update();
}

function sectionChanges(id) {
    const target = document.getElementById(id);
    return !!target && (target.style.display !== 'block' || !target.classList.contains('active'));
}

// Shows one section and hides the others.
function activateSection(id, changed = sectionChanges(id)) {
    const target = document.getElementById(id);
    if (!target) return;
    document.querySelectorAll('.page-section').forEach(sec => {
        if (sec === target) return;
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    if (!changed) return;
    target.style.display = 'block';
    if (document.documentElement.classList.contains('vt')) target.classList.add('active');
    setTimeout(() => { target.classList.add('active'); window.AOS?.refresh(); }, 10);
    // Screen readers and keyboard users start at the new section's heading, not at the old link.
    if (initialised) {
        const heading = target.querySelector('h1, h2') || target;
        heading.setAttribute('tabindex', '-1');
        heading.focus({ preventScroll: true });
    }
    initialised = true;
}

let initialised = false;

let currentPage = null;

function show404() {
    if (currentPage !== 'not-found') trackPageView('not-found');
    currentPage = 'not-found';
    const changed = sectionChanges('not-found');
    withTransition(changed, () => activateSection('not-found', changed));
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
    let meta = PAGE_META[state.currentLang]?.[pageId];
    if (!meta) return;
    // Home title/description can be set in admin → SEO (data.json → seo)
    const seo = state.appData.seo?.[state.currentLang];
    if (pageId === 'home' && seo) meta = { title: seo.title || meta.title, desc: seo.description || meta.desc };
    const image = state.appData.seo?.image;
    if (image) {
        const abs = /^https:\/\//.test(image) ? image : new URL(image, 'https://osamaal-harbi.github.io/CV/').href;
        document.querySelectorAll('meta[property="og:image"], meta[name="twitter:image"]').forEach(el => el.setAttribute('content', abs));
    }

    document.title = meta.title;

    const setMeta = (id, val) => { const el = document.getElementById(id); if (el) el.setAttribute('content', val); };
    setMeta('meta-description', meta.desc);
    setMeta('og-title',         meta.title);
    setMeta('og-description',   meta.desc);
    setMeta('tw-title',         meta.title);   // was writing the title into twitter:card
    setMeta('tw-description',   meta.desc);
}
