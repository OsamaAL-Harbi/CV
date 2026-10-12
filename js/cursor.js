// Mouse cursor of the site, picked in admin → tools → «مؤشر الفأرة» (data.json → cursor), on <html data-cursor>.
// The arrow and the hand are SVG images in the site's own colours (admin → colours, light/dark mode), built here
// and handed to src/tailwind.css as --cursor-arrow / --cursor-hand. «ring» and «dot» add an element that follows
// the pointer. Mouse and trackpad only: touch screens have no cursor, so nothing here runs there. Icons: Font
// Awesome Free arrow-pointer and hand-pointer (CC BY 4.0), with a white outline so they show on every background.
import { local } from './storage.js';

export const CURSORS = [
    { id: 'brand',    label: 'بلون الموقع (الافتراضي)', desc: 'سهم ويد بلون الموقع الأساسي مع حدّ أبيض' },
    { id: 'gradient', label: 'متدرّج',                 desc: 'سهم ويد بتدرّج من اللون الأساسي إلى الثانوي' },
    { id: 'ring',     label: 'سهم وحلقة',              desc: 'سهم بلون الموقع وحلقة تلحقه وتكبر فوق الروابط والأزرار' },
    { id: 'dot',      label: 'نقطة وحلقة',             desc: 'نقطة صغيرة مكان السهم وحلقة تلحقها، نمط عصري للمعارض' },
    { id: 'classic',  label: 'مؤشر النظام',            desc: 'مؤشر الجهاز الأصلي دون تغيير' }
];
export const DEFAULT_CURSOR = 'brand';
export const isCursor = id => CURSORS.some(c => c.id === id);

const ARROW = 'M0 55.2V426c0 12.2 9.9 22 22 22c6.3 0 12.4-2.7 16.6-7.5L121.2 346l58.1 116.3c7.9 15.8 27.1 22.2 42.9 14.3s22.2-27.1 14.3-42.9L179.8 320H297.9c12.2 0 22.1-9.9 22.1-22.1c0-6.3-2.7-12.3-7.4-16.5L38.6 37.9C34.3 34.1 28.9 32 23.2 32C10.4 32 0 42.4 0 55.2z';
const HAND = 'M128 40c0-22.1 17.9-40 40-40s40 17.9 40 40V188.2c8.5-7.6 19.7-12.2 32-12.2c20.6 0 38.2 13 45 31.2c8.8-9.3 21.2-15.2 35-15.2c25.3 0 46 19.5 47.9 44.3c8.5-7.7 19.8-12.3 32.1-12.3c26.5 0 48 21.5 48 48v48 16 48c0 70.7-57.3 128-128 128l-16 0H240l-.1 0h-5.2c-5 0-9.9-.3-14.7-1c-55.3-5.6-106.2-34-140-79L8 336c-13.3-17.7-9.7-42.7 8-56s42.7-9.7 56 8l56 74.7V40zM240 304c0-8.8-7.2-16-16-16s-16 7.2-16 16v96c0 8.8 7.2 16 16 16s16-7.2 16-16V304zm48-16c-8.8 0-16 7.2-16 16v96c0 8.8 7.2 16 16 16s16-7.2 16-16V304c0-8.8-7.2-16-16-16zm80 16c0-8.8-7.2-16-16-16s-16 7.2-16 16v96c0 8.8 7.2 16 16 16s16-7.2 16-16V304z';
const HEX = /^#[0-9a-f]{6}$/i;

// One cursor image as a data: URI: the icon path, outlined in white, at a size browsers accept everywhere (≤ 32 px)
function svgImage({ path, box, width, height, fill, gradient }) {
    const paint = gradient ? 'url(#g)' : fill;
    const defs = gradient ? `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${gradient[0]}'/><stop offset='1' stop-color='${gradient[1]}'/></linearGradient></defs>` : '';
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}' viewBox='${box}'>${defs}<path d='${path}' fill='${paint}' stroke='#fff' stroke-width='36' stroke-linejoin='round' paint-order='stroke'/></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// The arrow and hand images for a style. Colours are #rrggbb (anything else falls back to the default theme).
export function cursorImages(style, { primary, secondary } = {}) {
    const p = HEX.test(primary || '') ? primary : '#2563eb';
    const s = HEX.test(secondary || '') ? secondary : '#8b5cf6';
    const gradient = style === 'gradient' ? [p, s] : null;
    return {
        arrow: svgImage({ path: ARROW, box: '-30 -2 380 512', width: 19, height: 26, fill: p, gradient }),
        hand: svgImage({ path: HAND, box: '-30 -30 508 572', width: 24, height: 27, fill: p, gradient })
    };
}

// CSS values for --cursor-arrow / --cursor-hand (hotspots: the arrow's tip, the fingertip)
export function cursorValues(style, colours) {
    const { arrow, hand } = cursorImages(style, colours);
    return { arrow: `url("${arrow}") 2 2, auto`, hand: `url("${hand}") 9 2, pointer` };
}

// ─── In the browser ───
const finePointer = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
const calm = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
const current = () => (isCursor(document.documentElement.dataset.cursor) ? document.documentElement.dataset.cursor : DEFAULT_CURSOR);

// The colours actually in use (custom theme, light or dark mode), read from the page itself
export function pageColours() {
    const css = getComputedStyle(document.documentElement);
    const hex = name => {
        const m = css.getPropertyValue(name).trim().match(/^(\d{1,3}) (\d{1,3}) (\d{1,3})$/);
        return m ? `#${m.slice(1).map(v => Math.min(255, +v).toString(16).padStart(2, '0')).join('')}` : '';
    };
    return { primary: hex('--color-primary'), secondary: hex('--color-secondary') };
}

let paintedKey = '';
function paint() {
    const root = document.documentElement;
    const style = current();
    const colours = pageColours();
    const key = `${style}|${colours.primary}|${colours.secondary}`;
    if (key === paintedKey) return;                // also ends the loop with the style observer below
    paintedKey = key;
    if (style === 'classic') { root.style.removeProperty('--cursor-arrow'); root.style.removeProperty('--cursor-hand'); return; }
    const { arrow, hand } = cursorValues(style, colours);
    root.style.setProperty('--cursor-arrow', arrow);
    root.style.setProperty('--cursor-hand', hand);
}

// ─── Follower (ring / dot) ───
const CLICKABLE = 'a[href], button:not(:disabled), [role="button"], summary, label, select, [data-action], input[type="checkbox"], input[type="radio"], input[type="color"], input[type="range"], input[type="submit"], input[type="button"]';
const TYPING = 'input:not([type="checkbox"], [type="radio"], [type="color"], [type="range"], [type="submit"], [type="button"]), textarea, [contenteditable="true"], .editable-active';
let follower = null, frame = 0;
const target = { x: -100, y: -100 }, ring = { x: -100, y: -100 };

function draw() {
    frame = 0;
    if (!follower) return;
    const ease = calm() ? 1 : 0.22;
    ring.x += (target.x - ring.x) * ease;
    ring.y += (target.y - ring.y) * ease;
    follower.ring.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0)`;
    follower.dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
    if (Math.abs(target.x - ring.x) > 0.3 || Math.abs(target.y - ring.y) > 0.3) frame = requestAnimationFrame(draw);
}

function onMove(e) {
    if (!follower || e.pointerType !== 'mouse') return;
    const el = e.target instanceof Element ? e.target : null;
    target.x = e.clientX; target.y = e.clientY;
    document.documentElement.classList.add('cursor-live');
    follower.root.classList.add('is-on');
    follower.root.classList.toggle('is-hover', !!el?.closest(CLICKABLE));
    follower.root.classList.toggle('is-text', !!el?.closest(TYPING));
    if (!frame) frame = requestAnimationFrame(draw);
}
const onDown = e => { if (e.pointerType === 'mouse') follower?.root.classList.add('is-down'); };
const onUp = () => follower?.root.classList.remove('is-down');
const onLeave = e => { if (!e.relatedTarget) follower?.root.classList.remove('is-on'); };

function startFollower() {
    if (follower) return;
    const root = document.createElement('div');
    root.id = 'cursor-follower';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = '<span class="cursor-ring"><span></span></span><span class="cursor-dot"></span>';
    document.body.appendChild(root);
    follower = { root, ring: root.firstElementChild, dot: root.lastElementChild };
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerdown', onDown, { passive: true });
    document.addEventListener('pointerup', onUp, { passive: true });
    document.addEventListener('mouseout', onLeave, { passive: true });
}

function stopFollower() {
    document.documentElement.classList.remove('cursor-live');
    if (!follower) return;
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('mouseout', onLeave);
    follower.root.remove();
    follower = null;
}

export function applyCursor(id) {
    const style = isCursor(id) ? id : DEFAULT_CURSOR;
    document.documentElement.dataset.cursor = style;
    paint();
    if ((style === 'ring' || style === 'dot') && finePointer() && document.body) startFollower(); else stopFollower();
    return style;
}

// Applies data.json → cursor and caches it for js/early.js (the next visit's first paint)
export function syncSiteCursor(id) {
    const style = applyCursor(id);
    if (style === DEFAULT_CURSOR) local.remove('cursor'); else local.set('cursor', style);
}

// Colours change with the theme (admin → colours) and with dark mode: repaint the cursor when they do
export function initCursor() {
    applyCursor(document.documentElement.dataset.cursor);
    if (!('MutationObserver' in window)) return;
    let queued = false;
    new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => { queued = false; paint(); });
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
}
