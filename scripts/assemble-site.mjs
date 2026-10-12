// Copies only the files the site serves into a folder for GitHub Pages (the "Deploy site" workflow
// uploads it), so tests, scripts, sources and package files are not published. It also writes the SEO
// settings from data.json (admin → SEO) into index.html, because link previews (WhatsApp, LinkedIn, X)
// read the HTML without running JavaScript, writes the chosen fonts (admin → Fonts) so the first paint already
// uses them, writes the CV itself into the page for crawlers (scripts/prerender.mjs), and refreshes the
// sitemap date.
// Usage: node scripts/assemble-site.mjs _site
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './cdn-assets.mjs';
import { fontStack } from '../js/fonts.js';
import { DEFAULT_SCROLLBAR, isScrollbar } from '../js/scrollbar.js';
import { DEFAULT_MOTION, isMotion } from '../js/motion.js';
import { applyJsonLd, applyVerification, prerenderContent } from './prerender.mjs';
import { addToSitemap, fontsCss, sitePages } from './pages.mjs';

export const SITE_URL = 'https://osamaal-harbi.github.io/CV/';

export const PUBLIC = [
    'index.html', 'offline.html', 'script.js', 'sw.js', 'data.json', 'manifest.json',
    'robots.txt', 'sitemap.xml', '.nojekyll', 'Osama_Alharbi.pdf',
    'oauth.html', 'assets', 'js', 'images', 'cv', 'generated'
];

const attr = v => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = v => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Rewrites the content="" of a meta tag found by a marker such as id="og-title" or property="og:image".
function setMeta(html, marker, value) {
    const re = new RegExp(`(<meta\\b[^>]*${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*\\bcontent=")[^"]*(")`);
    return re.test(html) ? html.replace(re, (_, start, end) => `${start}${attr(value)}${end}`) : html;
}

export function applySeo(html, data) {
    const seo = data?.seo;
    if (!seo) return html;
    const ar = seo.ar || {};
    if (ar.title) {
        html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${text(ar.title)}</title>`);
        for (const m of ['id="og-title"', 'id="tw-title"']) html = setMeta(html, m, ar.title);
    }
    if (ar.description) for (const m of ['id="meta-description"', 'id="og-description"', 'id="tw-description"']) html = setMeta(html, m, ar.description);
    const abs = absolute(seo.image);
    if (abs) {
        for (const m of ['property="og:image"', 'name="twitter:image"']) html = setMeta(html, m, abs);
    }
    return html;
}

// https URLs without quotes, angle brackets, backslashes or spaces, or a plain path on this site
const absolute = path => {
    const v = String(path || '');
    if (/^https:\/\/[^\s"'<>\\]+$/.test(v)) return v;
    return /^[\w\-./]+$/.test(v) && !v.includes('..') ? new URL(v, SITE_URL).href : '';
};

// Schema.org Person image: the profile photo uploaded in the admin panel, when there is one
export function applyProfileImage(html, data) {
    const img = absolute(data?.profile?.image);
    // JSON-encoded (and "<" escaped) so no value can end the string or the script element
    const value = JSON.stringify(img).slice(1, -1).replace(/</g, '\\u003c');
    return img ? html.replace(/(<script type="application\/ld\+json">[\s\S]*?"image": ")[^"]*(")/, (_, a, b) => `${a}${value}${b}`) : html;
}

// Font stack from admin → Fonts for js/early.js (always written, so a stale cached stack never wins)
export function applyFonts(html, data) {
    return setMeta(html, 'id="site-fonts"', fontStack(data?.fonts || {}));
}

// js/early.js inlined into the page: it runs before first paint, so as a separate file it cost a network round
// trip before anything showed. The CSP allows exactly this script by its sha256 hash, nothing else inline.
export function inlineEarlyScript(html, code) {
    const tag = '<script src="js/early.js"></script>';
    if (!html.includes(tag) || code.includes('</script')) return html;
    const hash = `'sha256-${createHash('sha256').update(code).digest('base64')}'`;
    return html
        .replace(/(<meta http-equiv="Content-Security-Policy" content="[^"]*?script-src 'self')/, `$1 ${hash}`)
        .replace(tag, () => `<script>${code}</script>`);
}

// Scrollbar style from admin → Scrollbar for js/early.js; also the default on <html>, so there is no flash
export function applyScrollbarStyle(html, data) {
    const style = isScrollbar(data?.scrollbar) ? data.scrollbar : DEFAULT_SCROLLBAR;
    return setMeta(html, 'id="site-scrollbar"', style).replace(/(<html\b[^>]*\bdata-scrollbar=")[^"]*(")/, `$1${style}$2`);
}

// Motion level from admin → Motion for js/early.js, and the default on <html>
export function applyMotionLevel(html, data) {
    const motion = isMotion(data?.motion) ? data.motion : DEFAULT_MOTION;
    return setMeta(html, 'id="site-motion"', motion).replace(/(<html\b[^>]*\bdata-motion=")[^"]*(")/, `$1${motion}$2`);
}

export function touchSitemap(xml, date = new Date().toISOString().slice(0, 10)) {
    return xml.replace(/<lastmod>[^<]*<\/lastmod>/g, `<lastmod>${date}</lastmod>`);
}

async function main() {
    const dest = join(ROOT, process.argv[2] || '_site');
    await rm(dest, { recursive: true, force: true });
    await mkdir(dest, { recursive: true });
    for (const entry of PUBLIC) {
        try { await stat(join(ROOT, entry)); } catch { console.log(`skip  ${entry} (not present)`); continue; }
        await cp(join(ROOT, entry), join(dest, entry), { recursive: true });
        console.log(`copy  ${entry}`);
    }
    const data = JSON.parse(await readFile(join(ROOT, 'data.json'), 'utf8'));
    const index = join(dest, 'index.html');
    const html = await readFile(index, 'utf8');
    const steps = [applySeo, applyProfileImage, applyJsonLd, applyVerification, prerenderContent, applyFonts, applyScrollbarStyle, applyMotionLevel];
    const early = await readFile(join(ROOT, 'js/early.js'), 'utf8');
    const seoHtml = inlineEarlyScript(steps.reduce((out, step) => step(out, data), html), early);
    if (seoHtml !== html) { await writeFile(index, seoHtml); console.log('seo   index.html meta tags, JSON-LD, CV content, fonts and inlined early.js'); }
    // One page per project and per blog post (scripts/pages.mjs), listed in the sitemap
    const pages = sitePages(data);
    for (const page of pages) {
        await mkdir(join(dest, page.path, '..'), { recursive: true });
        await writeFile(join(dest, page.path), page.html);
    }
    if (pages.length) console.log(`pages ${pages.map(p => p.path).join(', ')}`);
    await writeFile(join(dest, 'assets/css/site-fonts.css'), fontsCss(fontStack(data?.fonts || {})));
    const today = new Date().toISOString().slice(0, 10);
    const sitemap = join(dest, 'sitemap.xml');
    await writeFile(sitemap, addToSitemap(touchSitemap(await readFile(sitemap, 'utf8'), today), pages, today));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
