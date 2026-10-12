// Standalone pages written at deploy (scripts/assemble-site.mjs): projects/<slug>.html, blog/<slug>.html and
// blog/index.html. Each is plain HTML in both languages (Arabic first, then English) with its own title,
// description, canonical URL, social-card tags and schema.org data, so every project and article can be found
// in search and shared on its own. No JavaScript; the site's stylesheet and fonts are reused.
import { projectPages, postPages, projectPath, postPath, BLOG_INDEX } from '../js/pages.js';
import { renderMarkdown, plainText, readingMinutes } from '../js/markdown.js';
import { DEFAULT_SCROLLBAR, isScrollbar } from '../js/scrollbar.js';

const SITE_URL = 'https://osamaal-harbi.github.io/CV/';
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ar = v => (v && typeof v === 'object' ? (v.ar || v.en || '') : String(v ?? ''));
const en = v => (v && typeof v === 'object' ? (v.en || v.ar || '') : String(v ?? ''));
const has = (v, lang) => Boolean(v && typeof v === 'object' ? v[lang] : v);
const https = v => (/^https:\/\/[^\s"<>]+$/.test(String(v || '')) ? String(v) : '');
const asset = v => (/^[\w\-./]+$/.test(String(v || '')) && !String(v).includes('..') ? String(v) : '');
const clip = (text, max = 160) => { const s = String(text).replace(/\s+/g, ' ').trim(); return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s; };
const jsonLd = obj => JSON.stringify(obj, null, 2).replace(/</g, '\\u003c');
const dateText = (d, lang) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d || ''))) return '';
    return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : 'en', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`));
};

const CSP = "default-src 'self'; script-src 'none'; style-src 'self'; font-src 'self'; img-src 'self' data: https:; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'; upgrade-insecure-requests";

function page({ path, title, description, image, type = 'article', ld, body, scrollbar }) {
    const url = new URL(path, SITE_URL).href;
    const img = image ? new URL(image, SITE_URL).href : new URL('assets/img/og-image.jpg', SITE_URL).href;
    const depth = '../';
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl" data-scrollbar="${isScrollbar(scrollbar) ? scrollbar : DEFAULT_SCROLLBAR}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${CSP}">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${esc(url)}">
    <meta property="og:type" content="${type}">
    <meta property="og:site_name" content="Osama Al-Harbi">
    <meta property="og:locale" content="ar_SA">
    <meta property="og:locale:alternate" content="en_US">
    <meta property="og:url" content="${esc(url)}">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:image" content="${esc(img)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(title)}">
    <meta name="twitter:description" content="${esc(description)}">
    <meta name="twitter:image" content="${esc(img)}">
    <meta name="theme-color" content="#2563eb">
    <link rel="icon" href="${depth}assets/icons/favicon.svg" type="image/svg+xml">
    <link rel="icon" href="${depth}assets/icons/favicon-32.png" sizes="32x32" type="image/png">
    <link rel="apple-touch-icon" href="${depth}assets/icons/apple-touch-icon.png">
    <link rel="stylesheet" href="${depth}assets/css/tailwind.css">
    <link rel="stylesheet" href="${depth}assets/css/site-fonts.css">
    <script type="application/ld+json">
${jsonLd(ld)}
    </script>
</head>
<body class="bg-gray-50 text-gray-800 font-sans min-h-screen flex flex-col">
    <header class="bg-white border-b border-gray-200">
        <nav class="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4 text-sm font-bold">
            <a href="${depth}" class="text-xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">OSAMA.</a>
            <span class="flex gap-4">
                <a href="${depth}#portfolio" class="hover:text-primary">المشاريع <span lang="en">· Projects</span></a>
                <a href="${depth}${BLOG_INDEX}" class="hover:text-primary">المقالات <span lang="en">· Articles</span></a>
                <a href="${depth}#contact" class="hover:text-primary">تواصل <span lang="en">· Contact</span></a>
            </span>
        </nav>
    </header>
    <main class="flex-1 w-full max-w-3xl mx-auto px-4 py-10 space-y-10">
${body}
    </main>
    <footer class="border-t border-gray-200 bg-white text-center text-xs text-gray-500 py-6">
        <a href="${depth}" class="font-bold text-primary hover:underline">osamaal-harbi.github.io/CV</a>
    </footer>
</body>
</html>
`;
}

const person = data => ({ '@type': 'Person', name: en(data?.profile?.name) || 'Osama Al-Harbi', alternateName: ar(data?.profile?.name) || undefined, url: SITE_URL });
const chips = list => (list || []).map(t => `<span class="text-xs px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-bold" dir="ltr">${esc(t)}</span>`).join('');

// ─── Projects ───
function projectBlock(item, lang) {
    const L = lang === 'ar'
        ? { tech: 'التقنيات المستخدمة', challenges: 'التحديات', results: 'النتائج والإنجازات', live: 'عرض مباشر', back: 'كل المشاريع' }
        : { tech: 'Technologies', challenges: 'Challenges', results: 'Results & achievements', live: 'Live demo', back: 'All projects' };
    const pick = lang === 'ar' ? ar : en;
    const text = v => esc(pick(v)).replace(/\n+/g, '<br>');
    const link = https(item.link), live = https(item.liveUrl);
    // Arabic block: title h1, sections h2; English block: title h2, sections h3 (headings never skip a level)
    const t = lang === 'ar' ? 1 : 2, h = t + 1;
    return `        <article lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}" class="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-5">
            <h${t} class="text-3xl font-extrabold text-gray-900">${esc(pick(item.title))}</h${t}>
            ${item.desc ? `<p class="text-gray-600 leading-relaxed">${text(item.desc)}</p>` : ''}
            ${item.technologies?.length ? `<section><h${h} class="font-bold text-sm mb-3">${L.tech}</h${h}><div class="flex flex-wrap gap-2">${chips(item.technologies)}</div></section>` : ''}
            ${has(item.details?.challenges, lang) || has(item.details?.challenges, 'ar') ? `<section><h${h} class="font-bold text-sm mb-2">${L.challenges}</h${h}><p class="text-gray-600 text-sm leading-relaxed bg-yellow-50 p-3 rounded-xl border border-yellow-100">${text(item.details.challenges)}</p></section>` : ''}
            ${has(item.details?.results, lang) || has(item.details?.results, 'ar') ? `<section><h${h} class="font-bold text-sm mb-2">${L.results}</h${h}><p class="text-gray-600 text-sm leading-relaxed bg-green-50 p-3 rounded-xl border border-green-100">${text(item.details.results)}</p></section>` : ''}
            ${link || live ? `<p class="flex flex-wrap gap-3 pt-2">${link ? `<a href="${esc(link)}" rel="noopener noreferrer" class="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-bold">GitHub</a>` : ''}${live ? `<a href="${esc(live)}" rel="noopener noreferrer" class="px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold">${L.live}</a>` : ''}</p>` : ''}
            <p><a href="../#portfolio" class="text-sm font-bold text-primary hover:underline">${L.back}</a></p>
        </article>`;
}

export function projectPage({ slug, item }, data) {
    const path = projectPath(slug);
    const image = asset(item.image);
    const body = [
        image ? `        <img src="../${esc(image)}" alt="${esc(ar(item.title))}" class="w-full aspect-video object-cover rounded-3xl border border-gray-200" width="1200" height="675">` : '',
        projectBlock(item, 'ar'),
        has(item.title, 'en') || has(item.desc, 'en') ? projectBlock(item, 'en') : ''
    ].filter(Boolean).join('\n');
    return page({
        path,
        title: `${ar(item.title)} | ${ar(data?.profile?.name) || 'أسامة الحربي'}`,
        description: clip(ar(item.desc) || en(item.desc) || ar(item.title)),
        image,
        ld: {
            '@context': 'https://schema.org',
            '@type': https(item.link) ? 'SoftwareSourceCode' : 'CreativeWork',
            name: en(item.title), alternateName: ar(item.title),
            description: en(item.desc) || ar(item.desc),
            url: new URL(path, SITE_URL).href,
            ...(https(item.link) ? { codeRepository: https(item.link) } : {}),
            ...(item.technologies?.length ? { keywords: item.technologies.join(', ') } : {}),
            ...(image ? { image: new URL(image, SITE_URL).href } : {}),
            author: person(data)
        },
        body,
        scrollbar: data?.scrollbar
    });
}

// ─── Blog ───
function postBlock(item, lang) {
    const pick = lang === 'ar' ? ar : en;
    const date = dateText(item.date, lang);
    const minutes = readingMinutes(pick(item.body));
    const meta = [date, lang === 'ar' ? `${minutes} د قراءة` : `${minutes} min read`].filter(Boolean).join(' · ');
    return `        <article lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}" class="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-4">
            <h${lang === 'ar' ? 1 : 2} class="text-3xl font-extrabold text-gray-900 leading-tight">${esc(pick(item.title))}</h${lang === 'ar' ? 1 : 2}>
            <p class="text-xs text-gray-500">${esc(meta)}</p>
            ${item.tags?.length ? `<div class="flex flex-wrap gap-2">${chips(item.tags)}</div>` : ''}
            <div class="readme">${renderMarkdown(pick(item.body))}</div>
            <p><a href="./" class="text-sm font-bold text-primary hover:underline">${lang === 'ar' ? 'كل المقالات' : 'All articles'}</a></p>
        </article>`;
}

export function postPage({ slug, item }, data) {
    const path = postPath(slug);
    const image = asset(item.image);
    const description = clip(ar(item.summary) || plainText(ar(item.body)) || ar(item.title));
    const body = [
        image ? `        <img src="../${esc(image)}" alt="${esc(ar(item.title))}" class="w-full aspect-video object-cover rounded-3xl border border-gray-200" width="1200" height="675">` : '',
        postBlock(item, 'ar'),
        has(item.title, 'en') && has(item.body, 'en') ? postBlock(item, 'en') : ''
    ].filter(Boolean).join('\n');
    return page({
        path,
        title: `${ar(item.title)} | ${ar(data?.profile?.name) || 'أسامة الحربي'}`,
        description,
        image,
        ld: {
            '@context': 'https://schema.org',
            '@type': 'BlogPosting',
            headline: ar(item.title),
            alternativeHeadline: en(item.title) !== ar(item.title) ? en(item.title) : undefined,
            description,
            ...(/^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')) ? { datePublished: item.date } : {}),
            inLanguage: has(item.body, 'en') ? ['ar', 'en'] : 'ar',
            ...(item.tags?.length ? { keywords: item.tags.join(', ') } : {}),
            ...(image ? { image: new URL(image, SITE_URL).href } : {}),
            mainEntityOfPage: new URL(path, SITE_URL).href,
            author: person(data)
        },
        body,
        scrollbar: data?.scrollbar
    });
}

export function blogIndex(data) {
    const posts = postPages(data);
    const card = ({ slug, item }) => `            <li class="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <a href="${esc(`${slug}.html`)}" class="block space-y-2">
                    <h2 class="text-xl font-bold text-gray-900 hover:text-primary">${esc(ar(item.title))}</h2>
                    ${has(item.title, 'en') && en(item.title) !== ar(item.title) ? `<p class="text-sm font-bold text-gray-500" lang="en" dir="ltr">${esc(en(item.title))}</p>` : ''}
                    <p class="text-xs text-gray-500">${esc(dateText(item.date, 'ar'))}</p>
                    <p class="text-sm text-gray-600 leading-relaxed">${esc(clip(ar(item.summary) || plainText(ar(item.body)), 220))}</p>
                </a>
            </li>`;
    return page({
        path: BLOG_INDEX,
        title: `المقالات | ${ar(data?.profile?.name) || 'أسامة الحربي'}`,
        description: 'مقالات تقنية في الشبكات والتحول الرقمي والدعم التقني — Articles on networking, digital transformation and IT support.',
        type: 'website',
        ld: {
            '@context': 'https://schema.org', '@type': 'Blog', name: 'المقالات — Articles',
            url: new URL(BLOG_INDEX, SITE_URL).href, author: person(data),
            blogPost: posts.map(({ slug, item }) => ({ '@type': 'BlogPosting', headline: ar(item.title), url: new URL(postPath(slug), SITE_URL).href, ...(item.date ? { datePublished: item.date } : {}) }))
        },
        body: `        <h1 class="text-4xl font-extrabold">المقالات <span class="text-gray-400 text-2xl" lang="en">Articles</span></h1>
        ${posts.length ? `<ul class="space-y-4">\n${posts.map(card).join('\n')}\n        </ul>` : '<p class="text-gray-500">لا توجد مقالات بعد.</p>'}`,
        scrollbar: data?.scrollbar
    });
}

// Every page as { path, html } for the deploy, plus the URLs for the sitemap
export function sitePages(data) {
    const projects = projectPages(data).map(p => ({ path: projectPath(p.slug), html: projectPage(p, data) }));
    const posts = postPages(data);
    const blog = posts.length ? [{ path: `${BLOG_INDEX}index.html`, url: BLOG_INDEX, html: blogIndex(data) },
        ...posts.map(p => ({ path: postPath(p.slug), html: postPage(p, data), lastmod: p.item.date }))] : [];
    return [...projects, ...blog].map(p => ({ ...p, url: new URL(p.url || p.path, SITE_URL).href }));
}

// Adds the pages to sitemap.xml (before </urlset>)
export function addToSitemap(xml, pages, date) {
    const entries = pages.map(p => `  <url>
    <loc>${esc(p.url)}</loc>
    <lastmod>${/^\d{4}-\d{2}-\d{2}$/.test(String(p.lastmod || '')) ? p.lastmod : date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n');
    return entries ? xml.replace('</urlset>', `${entries}\n</urlset>`) : xml;
}

export const fontsCss = stack => `:root { --font-stack: ${stack}; }\n`;
