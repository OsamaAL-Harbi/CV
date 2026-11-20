// resume-ats.html, written at deploy from data.json: the CV in English as one plain, single-column page that
// applicant tracking systems and application forms read well (real headings, no columns, icons, bars or images),
// ready to copy from or to print to PDF. No JavaScript; its only style is the inline <style> its CSP allows by hash.
import { createHash } from 'node:crypto';
import { isEarned } from '../js/timeline-data.js';

const SITE_URL = 'https://osamaal-harbi.github.io/CV/';
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const en = v => (v && typeof v === 'object' ? (v.en || v.ar || '') : String(v ?? '')).trim();
const https = v => (/^https:\/\/[^\s"<>]+$/.test(String(v || '')) ? String(v) : '');
const shown = (data, section) => ((data?.visibility?.sections || []).includes(section) ? [] : (data?.[section] || []).filter(i => i && !i.hidden));
const para = text => en(text).split(/\n+/).map(s => s.trim()).filter(Boolean);

const STYLE = `
body { font-family: Arial, Helvetica, sans-serif; color: #111; background: #fff; max-width: 820px; margin: 0 auto; padding: 32px 20px; line-height: 1.5; }
h1 { font-size: 26px; margin: 0; } h2 { font-size: 16px; text-transform: uppercase; letter-spacing: .04em; border-bottom: 1px solid #999; padding-bottom: 2px; margin: 22px 0 8px; }
h3 { font-size: 15px; margin: 10px 0 0; } p, li { font-size: 14px; margin: 2px 0; } ul { margin: 4px 0; padding-left: 20px; }
.meta { color: #333; font-size: 13px; } .contact { margin-top: 4px; font-size: 13px; } a { color: #111; }
.note { margin-top: 28px; font-size: 12px; color: #555; border-top: 1px dashed #bbb; padding-top: 8px; }
.back { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 20px; font-size: 13px; }
.back a { display: inline-block; padding: 6px 12px; border: 1px solid #999; border-radius: 8px; text-decoration: none; font-weight: bold; }
.back a:focus-visible { outline: 3px solid #111; outline-offset: 2px; }
@media print { .note, .back { display: none; } body { padding: 0; } }`;

const entry = (title, org, when, text) => `
    <h3>${esc(title)}${org ? ` — ${esc(org)}` : ''}</h3>
    ${when ? `<p class="meta">${esc(when)}</p>` : ''}
    ${para(text).map(p => `<p>${esc(p)}</p>`).join('')}`;

export function atsPage(data) {
    const p = data?.profile || {};
    const contact = [en(p.location), p.email && `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>`, p.phone && esc(p.phone),
        https(p.linkedin) && `<a href="${esc(https(p.linkedin))}">LinkedIn</a>`, https(p.github) && `<a href="${esc(https(p.github))}">GitHub</a>`,
        `<a href="${SITE_URL}">${SITE_URL.replace(/^https:\/\//, '').replace(/\/$/, '')}</a>`].filter(Boolean);
    const sections = [];
    const add = (title, body) => { if (body.trim()) sections.push(`<h2>${esc(title)}</h2>${body}`); };

    if (en(p.summary)) add('Summary', `<p>${esc(en(p.summary))}</p>`);
    add('Experience', shown(data, 'experience').map(x => entry(en(x.role), en(x.company), en(x.period), x.description)).join(''));
    add('Education', shown(data, 'education').map(x => entry(en(x.degree), en(x.institution), en(x.period), x.description)).join(''));
    const certs = shown(data, 'certificates');
    const earned = certs.filter(isEarned), studying = certs.filter(c => !isEarned(c));
    add('Certifications', earned.length ? `<ul>${earned.map(c => `<li>${esc(en(c.name))}${en(c.issuer) ? ` — ${esc(en(c.issuer))}` : ''}${en(c.date) ? ` (${esc(en(c.date))})` : ''}${c.credential ? `, ID ${esc(c.credential)}` : ''}</li>`).join('')}</ul>` : '');
    add('Certifications in progress', studying.length ? `<ul>${studying.map(c => `<li>${esc(en(c.name))}${en(c.issuer) ? ` — ${esc(en(c.issuer))}` : ''}${en(c.date) ? ` (target: ${esc(en(c.date))})` : ''}</li>`).join('')}</ul>` : '');
    const skills = shown(data, 'skills');
    const group = cat => skills.filter(s => s.category === cat).map(en).filter(Boolean).map(esc).join(', ');
    add('Skills', [group('hard') && `<p><b>Technical:</b> ${group('hard')}</p>`, group('soft') && `<p><b>Professional:</b> ${group('soft')}</p>`].filter(Boolean).join(''));
    add('Projects', shown(data, 'projects').map(x => entry(en(x.title), (x.technologies || []).join(', '), '', x.desc)).join(''));
    add('Volunteering', shown(data, 'volunteer').map(x => entry(en(x.role), en(x.organization), [en(x.period), x.hours ? `${x.hours} hours` : ''].filter(Boolean).join(' · '), x.description)).join(''));
    add('Training', shown(data, 'workshops').map(x => `<p>${esc(en(x.name))}${en(x.organizer) ? ` — ${esc(en(x.organizer))}` : ''}${en(x.date) ? ` (${esc(en(x.date))})` : ''}</p>`).join(''));
    add('Languages', shown(data, 'languages').map(l => `<p>${esc(en(l.name))}${en(l.level) ? `: ${esc(en(l.level))}` : ''}</p>`).join(''));

    const hash = createHash('sha256').update(STYLE).digest('base64');
    const name = en(p.name) || 'Resume';
    return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'sha256-${hash}'; base-uri 'none'; form-action 'none'">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <title>${esc(name)} — Resume (plain text)</title>
    <meta name="description" content="${esc(`${name}: ${en(p.title)}. Plain-text resume.`)}">
    <link rel="canonical" href="${SITE_URL}resume-ats.html">
    <style>${STYLE}</style>
</head>
<body>
    <nav class="back" aria-label="Portfolio"><a href="./en.html#resume">&larr; Back to the portfolio</a><a href="./#resume" lang="ar" dir="rtl">العودة إلى الموقع &rarr;</a></nav>
    <h1>${esc(name)}</h1>
    ${en(p.title) ? `<p class="meta">${esc(en(p.title))}</p>` : ''}
    <p class="contact">${contact.join(' · ')}</p>
    ${sections.join('\n    ')}
    <p class="note">Plain version of the portfolio at <a href="${SITE_URL}">${SITE_URL}</a> for applicant tracking systems: copy from it, or print it and choose “Save as PDF”.</p>
</body>
</html>
`;
}
