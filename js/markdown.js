// A small, safe Markdown subset for blog posts (admin → Blog), used by the site and by the deploy
// (scripts/pages.mjs). No library and no raw HTML: every character of the source is escaped first, then only
// these constructs become markup —
//   ## / ### / #### headings, paragraphs, - or * lists, 1. lists, > quotes, ``` code blocks,
//   **bold**, *italic*, `code`, [text](https://… or a site path) links, and --- rules.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// https links, mailto:, or a path on this site (no "..", no scheme) — anything else stays plain text
export function safeLink(url) {
    const u = String(url || '').trim();
    if (/^https:\/\/[^\s"<>]+$/i.test(u) || /^mailto:[^\s"<>]+$/i.test(u)) return u;
    if (/^(?:\.?\/)?[\w\-./#?=&]+$/.test(u) && !u.includes('..') && !/^\/\//.test(u)) return u;
    return '';
}

function inline(text) {
    // code spans first, so their content is not formatted; placeholders keep them out of the other rules
    const codes = [];
    let s = esc(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
        const url = safeLink(href.replace(/&amp;/g, '&'));
        if (!url) return label;
        const external = /^https:/i.test(url);
        return `<a href="${esc(url)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

export function renderMarkdown(source) {
    const lines = String(source ?? '').replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let para = [], list = null, quote = [];
    const flushPara = () => { if (para.length) out.push(`<p dir="auto">${inline(para.join(' '))}</p>`); para = []; };
    const flushList = () => { if (list) out.push(`<${list.tag}>${list.items.map(i => `<li dir="auto">${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; };
    const flushQuote = () => { if (quote.length) out.push(`<blockquote dir="auto">${inline(quote.join(' '))}</blockquote>`); quote = []; };
    const flush = () => { flushPara(); flushList(); flushQuote(); };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^```/.test(line.trim())) {
            flush();
            const code = [];
            while (++i < lines.length && !/^```/.test(lines[i].trim())) code.push(lines[i]);
            out.push(`<pre dir="ltr"><code>${esc(code.join('\n'))}</code></pre>`);
            continue;
        }
        const heading = line.match(/^(#{1,4})\s+(.+)$/);
        if (heading) { flush(); const level = Math.min(4, Math.max(2, heading[1].length + 1)); out.push(`<h${level} dir="auto">${inline(heading[2].trim())}</h${level}>`); continue; }
        if (/^\s*(---|\*\*\*)\s*$/.test(line)) { flush(); out.push('<hr>'); continue; }
        const bullet = line.match(/^\s*[-*]\s+(.+)$/), numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
        if (bullet || numbered) {
            flushPara(); flushQuote();
            const tag = bullet ? 'ul' : 'ol';
            if (list && list.tag !== tag) flushList();
            if (!list) list = { tag, items: [] };
            list.items.push((bullet || numbered)[1]);
            continue;
        }
        const q = line.match(/^\s*>\s?(.*)$/);
        if (q) { flushPara(); flushList(); quote.push(q[1]); continue; }
        if (!line.trim()) { flush(); continue; }
        flushList(); flushQuote();
        para.push(line.trim());
    }
    flush();
    return out.join('\n');
}

// Plain text of a post (for descriptions and reading time)
export const plainText = source => String(source ?? '')
    .replace(/```[\s\S]*?```/g, ' ').replace(/[#>*`_-]+/g, ' ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ').trim();

export const readingMinutes = source => Math.max(1, Math.round(plainText(source).split(' ').filter(Boolean).length / 200));
