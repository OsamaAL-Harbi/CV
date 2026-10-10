// Shared helpers: escaping, URL validation, toasts and the on-demand CDN loader.


// Heavy libraries are fetched only when a feature needs them, pinned and with SRI.
const CDN = 'https://cdn.jsdelivr.net/npm/';

const VENDOR = {
    swal: {
        styles:  [{ href: 'sweetalert2@11.26.25/dist/sweetalert2.min.css', integrity: 'sha384-dCW5imOdApH6OwpFau8cZNKjqVbJYnCA5q+8YsMYP3XwXKsV6Jfz1u6MZLnXaBsS' }],
        scripts: [{ src: 'sweetalert2@11.26.25/dist/sweetalert2.min.js', integrity: 'sha384-hW8ZCQHtRH+nVOAkHZ4amZvYsAtKn1ZOvMV6dNag1Rb1thWmLZMBKTRxFV0cOxiK' }]
    },
    particles: {
        scripts: [{ src: 'particles.js@2.0.0/particles.js', integrity: 'sha384-AWFROZ10DoeXcNjhoQe0agryexFsipZEA17Cde6/tknpOUacvUGk27vXQ2a6ljSt' }]
    },
    toast: {
        styles:  [{ href: 'toastify-js@1.12.0/src/toastify.css', integrity: 'sha384-TO4IUm4upNqQuSHA3xAk5ixibmqyKUAvTD3UIJdx9KctftYoctvBVGeH6nzXTOO2' }],
        scripts: [{ src: 'toastify-js@1.12.0/src/toastify.js', integrity: 'sha384-VwoO4KYHycI5E2Vzjf4m+IY3C8JKnLhRzzVeR7n4Qdx+Qkq0YUC3aiJ6vY0XVlVT' }]
    },
    sortable: {
        scripts: [{ src: 'sortablejs@1.15.0/Sortable.min.js', integrity: 'sha384-eeLEhtwdMwD3X9y+8P3Cn7Idl/M+w8H4uZqkgD/2eJVkWIN1yKzEj6XegJ9dL3q0' }]
    },
    pdf: {
        scripts: [
            { src: 'jspdf@2.5.1/dist/jspdf.umd.min.js',       integrity: 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk' },
            { src: 'html2canvas@1.4.1/dist/html2canvas.min.js', integrity: 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H' }
        ]
    }
};

const vendorLoads = {};

function injectAsset(tag, url, integrity) {
    return new Promise((resolve, reject) => {
        const el = document.createElement(tag);
        if (tag === 'link') { el.rel = 'stylesheet'; el.href = url; } else { el.src = url; }
        el.integrity   = integrity;
        el.crossOrigin = 'anonymous';
        el.onload  = resolve;
        el.onerror = () => { el.remove(); reject(new Error(`Failed to load ${url}`)); };
        document.head.appendChild(el);
    });
}

export function loadVendor(name) {
    if (!vendorLoads[name]) {
        const { styles = [], scripts = [] } = VENDOR[name];
        vendorLoads[name] = Promise.all([
            ...styles.map(f => injectAsset('link', CDN + f.href, f.integrity)),
            ...scripts.map(f => injectAsset('script', CDN + f.src, f.integrity))
        ]).catch(err => { delete vendorLoads[name]; throw err; });
    }
    return vendorLoads[name];
}

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// Every value from data.json that goes into an HTML string must pass through this.
export function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

// External links are accepted only when they are absolute https:// URLs.
export function safeUrl(value) {
    const raw = String(value ?? '').trim();
    if (!/^https:\/\//i.test(raw)) return '';
    try { return new URL(raw).href; } catch { return ''; }
}

// Images/files may also be relative paths inside this site (e.g. images/me.jpg).
export function safeAssetUrl(value) {
    const raw = String(value ?? '').trim();
    if (/^[\w\-./]+$/.test(raw) && !raw.startsWith('//') && !raw.includes('..')) return raw;
    return safeUrl(raw);
}

export function skillLevel(skill) {
    const n = Number(skill?.level);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
}

export function setDeepValue(obj, path, value) {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) cur = cur[keys[i]];
    cur[keys[keys.length - 1]] = value;
}

// Toastify is fetched with the first toast, so it is not on the page's critical path.
export function showToast(msg, type = 'info') {
    const colors = { success: '#10B981', error: '#EF4444', info: '#3b82f6' };
    // Short and dismissible: success/info 2 s, errors a little longer so they can be read
    const duration = type === 'error' ? 3000 : 2000;
    loadVendor('toast')
        .then(() => Toastify({ text: msg, duration, close: true, stopOnFocus: true, gravity: 'top', position: 'center', style: { background: colors[type] || colors.info } }).showToast())
        .catch(() => {});   // a toast is never worth an error of its own
}

// Google Analytics events (js/analytics.js queues them until gtag loads; nothing is sent when it is blocked).
// Section changes are sent as page_view by js/router.js because the SPA never reloads.
export function track(name, params = {}) {
    try { window.gtag?.('event', name, params); } catch { /* analytics must never break the page */ }
}
