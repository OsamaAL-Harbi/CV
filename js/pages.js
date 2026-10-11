// Standalone pages written by the deploy (scripts/pages.mjs): one per project (projects/<slug>.html) and per
// blog post (blog/<slug>.html), plus blog/index.html. Shared by the site (links) and the deploy (file names),
// so both always agree on the address. Hidden items get no page.
const slugify = text => String(text || '').normalize('NFKD').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

const en = v => (v && typeof v === 'object' ? (v.en || '') : String(v ?? ''));

// item.slug (set in the editor) wins; else the English title; else "<kind>-<n>". Duplicates get -2, -3…
function withSlugs(list, kind, titleOf) {
    const used = new Set();
    return (list || []).map((item, index) => {
        if (!item || item.hidden) return null;
        let base = slugify(item.slug) || slugify(en(titleOf(item))) || `${kind}-${index + 1}`;
        let slug = base;
        for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
        used.add(slug);
        return { slug, item, index };
    }).filter(Boolean);
}

const sectionHidden = (data, section) => (data?.visibility?.sections || []).includes(section);

export const projectPages = data => (sectionHidden(data, 'projects') ? [] : withSlugs(data?.projects, 'project', p => p.title));

// Newest first (date "YYYY-MM-DD"; undated posts last, in their data order)
export const postPages = data => (sectionHidden(data, 'blog') ? [] : withSlugs(data?.posts, 'post', p => p.title))
    .sort((a, b) => String(b.item.date || '').localeCompare(String(a.item.date || '')) || a.index - b.index);

export const projectPath = slug => `projects/${slug}.html`;
export const postPath = slug => `blog/${slug}.html`;
export const BLOG_INDEX = 'blog/';
