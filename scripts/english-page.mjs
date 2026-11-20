// en.html, written at deploy next to index.html: the same page in English, so search engines and link previews get
// an English URL with English content without running JavaScript (the Arabic page stays at the root). The site
// itself is unchanged: en.html says data-page-lang="en", js/early.js and js/state.js start it in English, and the
// language button moves between the two addresses. Both pages declare each other with hreflang.
import { STATIC_TEXT } from '../js/strings.js';

const SITE_URL = 'https://osamaal-harbi.github.io/CV/';
const EN_URL = `${SITE_URL}en.html`;
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const en = v => (v && typeof v === 'object' ? (v.en || v.ar || '') : String(v ?? '')).trim();
const clip = (text, max = 160) => (text.length > max ? `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…` : text);

// content="" of the meta tag (or href="" of the link) found by a marker such as id="og-title"
function setAttr(html, marker, attr, value) {
    const re = new RegExp(`(<(?:meta|link)\\b[^>]*${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*\\b${attr}=")[^"]*(")`);
    return html.replace(re, (_, a, b) => `${a}${esc(value)}${b}`);
}

export function englishPage(html, data) {
    const p = data?.profile || {};
    const seo = data?.seo?.en || {};
    const title = seo.title || [en(p.name), en(p.title)].filter(Boolean).join(' | ') || 'Osama Al-Harbi | Portfolio';
    const description = seo.description || clip(en(p.summary)) || 'Portfolio of Osama Al-Harbi.';
    const T = STATIC_TEXT.en;

    html = html.replace(/<html\b([^>]*)>/, (_, attrs) => `<html${attrs.replace(/\blang="[^"]*"/, 'lang="en"').replace(/\bdir="[^"]*"/, 'dir="ltr"')} data-page-lang="en">`);
    html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${esc(title)}</title>`);
    for (const m of ['id="og-title"', 'id="tw-title"']) html = setAttr(html, m, 'content', title);
    for (const m of ['id="meta-description"', 'id="og-description"', 'id="tw-description"']) html = setAttr(html, m, 'content', description);
    html = setAttr(html, 'rel="canonical"', 'href', EN_URL);
    html = setAttr(html, 'property="og:url"', 'content', EN_URL);
    html = setAttr(html, 'property="og:locale"', 'content', 'en_US');
    html = setAttr(html, 'property="og:locale:alternate"', 'content', 'ar_SA');

    // Static texts, labels and placeholders in English (the same strings js/i18n.js puts in on load)
    html = html.replace(/(<([a-z0-9]+)\b[^>]*\bdata-lang="([\w-]+)"[^>]*>)([^<]*)(<\/\2>)/g, (m, open, _tag, key, _text, close) => (T[key] ? `${open}${esc(T[key])}${close}` : m));
    html = html.replace(/<[a-z0-9]+\b[^>]*\bdata-lang-aria="([\w-]+)"[^>]*>/g, (tag, key) => (T[key] ? tag.replace(/\baria-label="[^"]*"/, `aria-label="${esc(T[key])}"`) : tag));
    html = html.replace(/<[a-z0-9]+\b[^>]*\bdata-lang-placeholder="([\w-]+)"[^>]*>/g, (tag, key) => (T[key] ? tag.replace(/\bplaceholder="[^"]*"/, `placeholder="${esc(T[key])}"`) : tag));
    return html;
}

// Both pages: hreflang="en" points at en.html, and a marker tells js/i18n.js that the English page exists
export function linkEnglishPage(html) {
    return html
        .replace(/(<link rel="alternate" hreflang="en" href=")[^"]*(")/, `$1${EN_URL}$2`)
        .replace(/(\s*)(<meta id="site-cursor")/, '$1<meta name="site-en-page" content="en.html">$1$2');
}
