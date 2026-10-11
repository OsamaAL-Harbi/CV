// Deploy-time content for search engines and link previews (used by scripts/assemble-site.mjs).
// The site renders data.json with JavaScript; Google runs it late and many crawlers never do, so the deploy
// also writes the CV into index.html: the profile texts in place (same text js/render.js sets, so nothing moves),
// plain versions of every list inside their containers (js/render.js replaces them on load, behind the loading
// screen), a schema.org Person built from the CV, and the search-console verification tags from admin → SEO.
// Everything is escaped; hidden sections and items (admin → visibility) are left out.
import { verificationToken } from '../js/seo.js';

const SITE_URL = 'https://osamaal-harbi.github.io/CV/';

const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ar = v => (v && typeof v === 'object' ? (v.ar || v.en || '') : String(v ?? ''));
const en = v => (v && typeof v === 'object' ? (v.en || v.ar || '') : String(v ?? ''));
const https = v => (/^https:\/\/[^\s"<>]+$/.test(String(v || '')) ? String(v) : '');

const hiddenSections = data => new Set(data?.visibility?.sections || []);
const shown = (data, section) => (hiddenSections(data).has(section) ? [] : (data?.[section] || []).filter(item => item && !item.hidden));

// Replaces the inside of an empty element found by its opening-tag marker, e.g. id="experience-container".
function fill(html, marker, inner) {
    const re = new RegExp(`(<([a-z0-9]+)\\b[^>]*${marker}[^>]*>)\\s*(</\\2>)`);
    return re.test(html) ? html.replace(re, (_, open, _tag, close) => `${open}${inner}${close}`) : html;
}

const lines = text => ar(text).split(/\n+/).map(s => s.trim()).filter(Boolean);
const desc = text => {
    const l = lines(text);
    if (!l.length) return '';
    return l.length === 1 ? `<p class="text-gray-600 text-sm">${esc(l[0])}</p>` : `<ul class="list-disc ps-5 text-gray-600 text-sm">${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
};
const item = (title, meta, body = '') => `<article class="mb-6"><h3 class="text-xl font-bold">${esc(title)}</h3>${meta ? `<p class="text-sm text-gray-500">${esc(meta)}</p>` : ''}${body}</article>`;
const joinMeta = (...parts) => parts.map(ar).filter(Boolean).join(' · ');

export function prerenderContent(html, data) {
    const p = data?.profile;
    if (p) {
        html = fill(html, 'data-path="profile.name"', esc(ar(p.name)));
        html = fill(html, 'data-path="profile.summary"', esc(ar(p.summary)));
        html = fill(html, 'id="typewriter-sr"', esc(ar(p.title)));
        html = fill(html, 'id="profile-location"', esc(ar(p.location)));
        html = fill(html, 'id="contact-location-display"', esc(ar(p.location)));
        html = fill(html, 'id="contact-email-display"', esc(p.email || ''));
    }
    const lists = {
        experience:   x => item(ar(x.role), joinMeta(x.company, x.period), desc(x.description)),
        education:    x => item(ar(x.degree), joinMeta(x.institution, x.period), desc(x.description)),
        volunteer:    x => item(ar(x.role), joinMeta(x.organization, x.period, x.hours ? `${x.hours} ساعة` : ''), desc(x.description)),
        certificates: x => item(ar(x.name), joinMeta(x.issuer, x.date)),
        workshops:    x => item(ar(x.name), joinMeta(x.organizer, x.date)),
        languages:    x => item(ar(x.name), ar(x.level)),
        projects:     x => item(ar(x.title), (x.technologies || []).join('، '), desc(x.desc))
    };
    for (const [section, render] of Object.entries(lists)) {
        const items = shown(data, section);
        if (items.length) html = fill(html, `id="${section}-container"`, items.map(render).join(''));
    }
    const skills = shown(data, 'skills');
    if (skills.length) html = fill(html, 'id="skills-container"', `<ul class="list-disc ps-5">${skills.map(s => `<li>${esc(ar(s))}</li>`).join('')}</ul>`);
    return html;
}

// schema.org Person from the CV, merged over the static JSON-LD in index.html (contact details, sameAs, photo).
export function personJsonLd(base, data) {
    const p = data?.profile || {};
    const person = { ...base };
    if (p.name) { person.name = en(p.name); person.alternateName = ar(p.name); }
    if (p.title) person.jobTitle = en(p.title);
    if (p.summary) person.description = en(p.summary);
    const sameAs = [https(p.linkedin), https(p.github), ...(base.sameAs || [])].filter(Boolean);
    if (sameAs.length) person.sameAs = [...new Set(sameAs)];
    const schools = shown(data, 'education').map(e => en(e.institution)).filter(Boolean);
    if (schools.length) person.alumniOf = [...new Set(schools)].map(name => ({ '@type': 'CollegeOrUniversity', name }));
    const skills = shown(data, 'skills').map(en).filter(Boolean);
    if (skills.length) person.knowsAbout = skills;
    const langs = shown(data, 'languages').map(l => en(l.name)).filter(Boolean);
    if (langs.length) person.knowsLanguage = langs;
    const certs = shown(data, 'certificates').filter(c => c.name);
    if (certs.length) person.hasCredential = certs.map(c => ({
        '@type': 'EducationalOccupationalCredential',
        name: en(c.name),
        credentialCategory: 'certificate',
        ...(c.issuer ? { recognizedBy: { '@type': 'Organization', name: en(c.issuer) } } : {}),
        ...(https(c.credential) ? { url: https(c.credential) } : {})
    }));
    const current = shown(data, 'experience')[0];
    if (current?.role) person.hasOccupation = { '@type': 'Occupation', name: en(current.role) };
    person.url = SITE_URL;
    return person;
}

export function applyJsonLd(html, data) {
    const re = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
    const m = html.match(re);
    if (!m) return html;
    let base;
    try { base = JSON.parse(m[2]); } catch { return html; }
    // "<" escaped so no text in data.json can close the script element
    const json = JSON.stringify(personJsonLd(base, data), null, 2).replace(/</g, '\\u003c').replace(/\n/g, '\n    ');
    return html.replace(re, (_, open, _old, close) => `${open}\n    ${json}\n    ${close}`);
}

// Search Console / Bing Webmaster verification tags (admin → SEO)
export function applyVerification(html, data) {
    const verify = data?.seo?.verify || {};
    const tags = [['google-site-verification', verify.google], ['msvalidate.01', verify.bing]]
        .map(([name, value]) => [name, verificationToken(value)])
        .filter(([, token]) => token)
        .map(([name, token]) => `<meta name="${name}" content="${token}">`);
    if (!tags.length) return html;
    return html.replace(/(<meta name="robots"[^>]*>)/, (tag) => `${tag}\n    ${tags.join('\n    ')}`);
}
