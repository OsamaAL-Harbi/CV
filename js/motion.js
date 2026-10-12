// Motion across the site (admin → tools → «الحركة والتأثيرات», data.json → motion): «lively» (default), «subtle»
// or «off», on <html data-motion>. The effects themselves are CSS in src/tailwind.css; this module adds:
//   - scroll reveal: cards and headings rise into place the first time they scroll into view, staggered within
//     their list (IntersectionObserver, no library). Content is never hidden without JavaScript, and lists that
//     were already revealed do not animate again when they re-render (language switch, admin edits);
//   - a soft spotlight that follows the pointer on cards (lively, mouse only);
//   - .is-ready on <html> when the loading screen is gone, which starts the hero entrance.
// The visitor's «reduce motion» system setting always wins: nothing here runs then.
import { local } from './storage.js';

export const MOTIONS = [
    { id: 'lively', label: 'حيوية (الافتراضي)', desc: 'ظهور تدريجي للأقسام والبطاقات، دخول متحرك للواجهة، توهّج يتبع المؤشر، ونبض للمحطات الجارية' },
    { id: 'subtle', label: 'هادئة',            desc: 'ظهور ناعم وتأثيرات المرور فقط، دون حركة مستمرة' },
    { id: 'off',    label: 'بدون حركة',         desc: 'كل شيء يظهر فوراً دون أي حركة' }
];
export const DEFAULT_MOTION = 'lively';
export const isMotion = id => MOTIONS.some(m => m.id === id);

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const level = () => document.documentElement.dataset.motion || DEFAULT_MOTION;
const enabled = () => !reduced() && level() !== 'off';

export function applyMotion(id) {
    const motion = isMotion(id) ? id : DEFAULT_MOTION;
    document.documentElement.dataset.motion = motion;
    if (motion === 'off') document.querySelectorAll('.reveal').forEach(finish);
    return motion;
}

// Applies data.json → motion and caches it for js/early.js (the next visit's first paint)
export function syncSiteMotion(id) {
    const motion = applyMotion(id);
    if (motion === DEFAULT_MOTION) local.remove('motion'); else local.set('motion', motion);
}

// ─── Scroll reveal ───
const REVEAL = [
    '#experience-container > div', '#education-container > div', '#volunteer-container > div',
    '#skills-container > div', '#certificates-container > div', '#workshops-container > div', '#languages-container > div',
    '#projects-container > div', '#testimonials-container > div', '#posts-container > article', '#timeline-track',
    '#github-repos > article', '#status-sensors > *', '#contact .contact-card', '#contact [data-section="qr"]', '#contact [data-section="vcard"]',
    '.page-section:not(#home) h3.text-2xl'
].join(', ');
const revealedLists = new WeakSet();     // lists whose items already animated once
let observer = null;

function finish(el) {
    el.classList.remove('reveal', 'reveal-in');
    el.style.removeProperty('--reveal-delay');
}

function onIntersect(entries) {
    for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target;
        observer.unobserve(el);
        if (el.parentElement) revealedLists.add(el.parentElement);
        el.classList.add('reveal-in');
        // Back to the element's own transitions (tilt, hover lift) once it is in place
        setTimeout(() => finish(el), 900 + (parseInt(el.style.getPropertyValue('--reveal-delay'), 10) || 0));
    }
}

export function revealContent(root = document) {
    if (!enabled() || !('IntersectionObserver' in window)) return;
    observer ||= new IntersectionObserver(onIntersect, { rootMargin: '0px 0px -4% 0px', threshold: 0 });
    const counts = new Map();
    root.querySelectorAll(REVEAL).forEach(el => {
        const list = el.parentElement;
        if (!list || revealedLists.has(list) || el.classList.contains('reveal')) return;
        const i = counts.get(list) || 0;
        counts.set(list, i + 1);
        el.style.setProperty('--reveal-delay', `${Math.min(i, 6) * 70}ms`);
        el.classList.add('reveal');
        observer.observe(el);
    });
}

// ─── Pointer spotlight on cards (lively, mouse only) ───
const SPOTLIGHT = '.contact-card, .timeline-card, #posts-container > article, #testimonials-container > div, #certificates-container > div, .stat-card';

function setupSpotlight() {
    if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches) return;
    let frame = 0, last = null;
    document.addEventListener('pointermove', e => {
        if (e.pointerType !== 'mouse' || level() !== 'lively' || reduced()) return;
        last = e;
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            const card = last.target.closest?.(SPOTLIGHT);
            if (!card) return;
            const r = card.getBoundingClientRect();
            card.style.setProperty('--spot-x', `${(((last.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
            card.style.setProperty('--spot-y', `${(((last.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
        });
    }, { passive: true });
}

// Every render (data.json, GitHub data, status, admin edits) goes through innerHTML: new cards are picked up here
export function initMotion() {
    setupSpotlight();
    const main = document.querySelector('main');
    if (!main || !('MutationObserver' in window)) return;
    let queued = false;
    new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; revealContent(); });
    }).observe(main, { childList: true, subtree: true });
}

// The hero entrance plays when the content is on screen, i.e. once the loading screen is gone
export function markReady() {
    requestAnimationFrame(() => document.documentElement.classList.add('is-ready'));
}
