// Copies only the files the site serves into a folder for GitHub Pages (the "Deploy site" workflow
// uploads it), so tests, scripts, sources and package files are not published. It also writes the SEO
// settings from data.json (admin → SEO) into index.html, because link previews (WhatsApp, LinkedIn, X)
// read the HTML without running JavaScript, writes the chosen fonts (admin → Fonts) so the first paint already
// uses them, and refreshes the sitemap date.
// Usage: node scripts/assemble-site.mjs _site
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './cdn-assets.mjs';
import { fontStack } from '../js/fonts.js';

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

const absolute = path => {
    const v = String(path || '');
    if (/^https:\/\//.test(v)) return v;
    return /^[\w\-./]+$/.test(v) && !v.includes('..') ? new URL(v, SITE_URL).href : '';
};

// Schema.org Person image: the profile photo uploaded in the admin panel, when there is one
export function applyProfileImage(html, data) {
    const img = absolute(data?.profile?.image);
    return img ? html.replace(/(<script type="application\/ld\+json">[\s\S]*?"image": ")[^"]*(")/, (_, a, b) => `${a}${img}${b}`) : html;
}

// Font stack from admin → Fonts for js/early.js (always written, so a stale cached stack never wins)
export function applyFonts(html, data) {
    return setMeta(html, 'id="site-fonts"', fontStack(data?.fonts || {}));
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
    const seoHtml = applyFonts(applyProfileImage(applySeo(html, data), data), data);
    if (seoHtml !== html) { await writeFile(index, seoHtml); console.log('seo   index.html meta tags and fonts from data.json'); }
    const sitemap = join(dest, 'sitemap.xml');
    await writeFile(sitemap, touchSitemap(await readFile(sitemap, 'utf8')));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
