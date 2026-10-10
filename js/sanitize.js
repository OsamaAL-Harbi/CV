// Allow-list HTML sanitizer for README files rendered by GitHub (case-study pages).
// The HTML is parsed with DOMParser — an inert document where scripts never run and nothing is
// fetched — and only known-safe elements and attributes are rebuilt in the page. Everything else is
// dropped (with its content) or unwrapped (keeping its text). Links and images must end up https.
const DROP = new Set(['script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed', 'form', 'input', 'button',
    'textarea', 'select', 'option', 'svg', 'math', 'template', 'noscript', 'link', 'meta', 'base', 'video', 'audio',
    'source', 'track', 'canvas', 'dialog', 'portal', 'title', 'head']);
const KEEP = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'ul', 'ol', 'li', 'a', 'strong', 'b', 'em', 'i',
    'code', 'pre', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'del', 's', 'sup', 'sub',
    'details', 'summary', 'kbd', 'dl', 'dt', 'dd']);
// Text blocks pick their own direction, so Arabic and English paragraphs both read correctly.
const AUTO_DIR = new Set(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th', 'blockquote', 'summary', 'dt', 'dd']);
const MAX_DEPTH = 40;

export function safeHttpsUrl(value, base) {
    const raw = String(value ?? '').trim();
    if (!raw || raw.startsWith('#')) return '';
    try {
        const url = new URL(raw, base);
        return url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
}

// linkBase: https://github.com/<owner>/<repo>/blob/<branch>/  imageBase: https://raw.githubusercontent.com/<owner>/<repo>/<branch>/
export function sanitizeReadme(html, { linkBase, imageBase }) {
    const doc = new DOMParser().parseFromString(String(html ?? ''), 'text/html');
    const out = document.createDocumentFragment();
    doc.body.childNodes.forEach(node => appendClean(node, out, { linkBase, imageBase }, 0));
    return out;
}

function appendChildren(node, parent, opts, depth) {
    node.childNodes.forEach(child => appendClean(child, parent, opts, depth + 1));
}

function appendClean(node, parent, opts, depth) {
    if (depth > MAX_DEPTH) return;
    if (node.nodeType === Node.TEXT_NODE) { parent.appendChild(document.createTextNode(node.data)); return; }
    if (node.nodeType !== Node.ELEMENT_NODE) return;                 // comments, processing instructions…
    const tag = node.localName;
    if (DROP.has(tag)) return;
    if (!KEEP.has(tag)) { appendChildren(node, parent, opts, depth); return; }   // div, span, article… → unwrap

    if (tag === 'a') {
        const href = safeHttpsUrl(node.getAttribute('href'), opts.linkBase);
        if (!href) { appendChildren(node, parent, opts, depth); return; }       // in-page anchors, mailto:, javascript:…
        const a = document.createElement('a');
        a.href = href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        appendChildren(node, a, opts, depth);
        parent.appendChild(a);
        return;
    }
    if (tag === 'img') {
        const raw = node.getAttribute('src') || '';
        const src = safeHttpsUrl(raw, raw.startsWith('/') ? opts.linkBase : opts.imageBase);
        if (!src) return;
        const img = document.createElement('img');
        img.src = src;
        img.alt = node.getAttribute('alt') || '';
        img.loading = 'lazy';
        img.decoding = 'async';
        img.referrerPolicy = 'no-referrer';
        for (const dim of ['width', 'height']) {
            const n = Number(node.getAttribute(dim));
            if (Number.isFinite(n) && n > 0 && n <= 2000) img.setAttribute(dim, String(Math.round(n)));
        }
        parent.appendChild(img);
        return;
    }

    const el = document.createElement(tag);
    if (AUTO_DIR.has(tag)) el.dir = 'auto';
    if (tag === 'pre' || tag === 'code' || tag === 'kbd') el.dir = 'ltr';
    if ((tag === 'td' || tag === 'th') && /^(left|center|right)$/.test(node.getAttribute('align') || '')) el.setAttribute('align', node.getAttribute('align'));
    if (tag === 'details' && node.hasAttribute('open')) el.open = true;
    if (tag === 'ol' && /^\d+$/.test(node.getAttribute('start') || '')) el.setAttribute('start', node.getAttribute('start'));
    appendChildren(node, el, opts, depth);
    parent.appendChild(el);
}
