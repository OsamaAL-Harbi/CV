// One-way import from LinkedIn into data.json (admin → tools → «استيراد من LinkedIn»). LinkedIn offers no API for a
// personal profile and does not allow reading its pages, so the source is the official copy of your data: LinkedIn →
// Settings → Data privacy → Get a copy of your data. The ZIP (or the CSV files inside it) is read in the browser, mapped
// to the site's sections, shown as a preview, and applied only when the admin confirms; nothing is sent anywhere.
// Bilingual texts written as «عربي | English» (titles) or separated by ━━━ (descriptions) are split into ar / en.
// What only the site knows is kept: certificate images, statuses and badges, hidden flags, skill levels, project details.
// No browser globals at load time: the unit tests use these functions in Node too.

const ARABIC = /[؀-ۿ]/;
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

// ─── ZIP (only what LinkedIn's export uses: stored or deflated entries) ───
export async function unzip(buffer) {
    const bytes = new Uint8Array(buffer);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
        if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('not_zip');
    const count = view.getUint16(eocd + 10, true);
    let p = view.getUint32(eocd + 16, true);
    const files = {};
    const decoder = new TextDecoder();
    for (let n = 0; n < count && view.getUint32(p, true) === 0x02014b50; n++) {
        const method = view.getUint16(p + 10, true);
        const size = view.getUint32(p + 20, true);
        const nameLen = view.getUint16(p + 28, true), extraLen = view.getUint16(p + 30, true), commentLen = view.getUint16(p + 32, true);
        const local = view.getUint32(p + 42, true);
        const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
        p += 46 + nameLen + extraLen + commentLen;
        if (!/\.csv$/i.test(name)) continue;
        const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        const raw = bytes.subarray(start, start + size);
        let data;
        if (method === 0) data = raw;
        else if (method === 8) data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
        else continue;
        files[name.split('/').pop()] = decoder.decode(data);
    }
    return files;
}

// ─── CSV (RFC 4180: quotes, doubled quotes, line breaks inside quotes) ───
export function parseCsv(text) {
    const rows = [];
    let row = [], field = '', quoted = false;
    const s = String(text || '').replace(/^﻿/, '');
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (quoted) {
            if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
            else if (c === '"') quoted = false;
            else field += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && s[i + 1] === '\n') i++;
            row.push(field); field = '';
            if (row.some(v => v !== '')) rows.push(row);
            row = [];
        } else field += c;
    }
    row.push(field);
    if (row.some(v => v !== '')) rows.push(row);
    // Some exports start with a "Notes:" paragraph before the header row
    const headerAt = /^notes:?$/i.test(rows[0]?.[0] || '') ? 2 : 0;
    if (!rows[headerAt]) return [];
    const header = rows[headerAt].map(h => h.trim());
    return rows.slice(headerAt + 1).map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
}

// ─── Text helpers ───
const clean = v => String(v ?? '').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').trim();

// «عربي | English» or «English | عربي» → { ar, en }; a single language fills its side only
export function splitTitle(value) {
    const text = clean(value);
    const parts = text.split(/\s+\|\s+/);
    if (parts.length === 2 && ARABIC.test(parts[0]) !== ARABIC.test(parts[1])) {
        const [ar, en] = ARABIC.test(parts[0]) ? parts : [parts[1], parts[0]];
        return { ar: ar.trim(), en: en.trim() };
    }
    return ARABIC.test(text) ? { ar: text, en: '' } : { ar: '', en: text };
}

// Arabic text, then ━━━━, then English (or the other way round) → { ar, en }. Bullets «•» become separate lines.
export function splitDescription(value) {
    const text = clean(value);
    const blocks = text.split(/\n?\s*━{3,}\s*\n?/).map(b => b.trim()).filter(Boolean);
    const tidy = b => b.split('\n').map(l => l.replace(/^\s*[•●▪◦-]\s*/, '').trim()).filter(Boolean).join('\n');
    const out = { ar: '', en: '' };
    for (const b of blocks.length ? blocks : [text]) {
        // Arabic text mentions Cisco, VLAN…: it counts as Arabic when its Arabic letters are at least a third of the Latin ones
        const arabic = (b.match(/[؀-ۿ]/g) || []).length, latin = (b.match(/[A-Za-z]/g) || []).length;
        const lang = arabic > 0 && arabic * 3 >= latin ? 'ar' : 'en';
        out[lang] = out[lang] ? `${out[lang]}\n${tidy(b)}` : tidy(b);
    }
    return out;
}

// "May 2026", "Mar 2026", "2026-05", "05/2026", "2026" → { en: "May 2026", ar: "مايو 2026" }
export function parseDate(value) {
    const text = clean(value);
    if (!text) return null;
    let m = text.match(/^([A-Za-z]{3,})\.?\s+(\d{4})$/);
    if (m) {
        const i = MONTHS_EN.findIndex(name => name.toLowerCase().startsWith(m[1].toLowerCase().slice(0, 3)));
        if (i >= 0) return { en: `${MONTHS_EN[i]} ${m[2]}`, ar: `${MONTHS_AR[i]} ${m[2]}` };
    }
    const month = (mm, year) => {
        const i = Number(mm) - 1;
        return i >= 0 && i < 12 ? { en: `${MONTHS_EN[i]} ${year}`, ar: `${MONTHS_AR[i]} ${year}` } : null;
    };
    m = text.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
    if (m && month(m[2], m[1])) return month(m[2], m[1]);
    m = text.match(/^(\d{1,2})\/(\d{4})$/);
    if (m && month(m[1], m[2])) return month(m[1], m[2]);
    m = text.match(/^(\d{4})$/);
    return m ? { en: m[1], ar: m[1] } : { en: text, ar: text };
}

export function period(start, end) {
    const s = parseDate(start), e = parseDate(end);
    if (!s && !e) return { ar: '', en: '' };
    if (!e) return s ? { ar: `${s.ar} - حاضر`, en: `${s.en} – Present` } : { ar: '', en: '' };
    if (!s || s.en === e.en) return { ar: e.ar, en: e.en };
    return { ar: `${s.ar} - ${e.ar}`, en: `${s.en} – ${e.en}` };
}

// A language LinkedIn does not have keeps the site's text (e.g. Arabic company names), and a hidden item stays hidden
function fillFrom(item, was, fields) {
    if (!was) return item;
    for (const f of fields) {
        if (item[f] && typeof item[f] === 'object' && was[f] && typeof was[f] === 'object') {
            for (const lang of ['ar', 'en']) if (!item[f][lang] && was[f][lang]) item[f] = { ...item[f], [lang]: was[f][lang] };
        }
    }
    return was.hidden ? { ...item, hidden: true } : item;
}

const key = v => String((v && typeof v === 'object' ? (v.en || v.ar) : v) || '').toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
const pick = (row, ...names) => { for (const n of names) if (row[n] !== undefined && row[n] !== '') return row[n]; return ''; };
const https = v => (/^https:\/\/[^\s"<>]+$/.test(String(v || '').trim()) ? String(v).trim() : '');
const LEVELS = {
    'native or bilingual proficiency': { ar: 'اللغة الأم أو ثنائية اللغة', en: 'Native or bilingual' },
    'full professional proficiency': { ar: 'إتقان مهني كامل', en: 'Full professional' },
    'professional working proficiency': { ar: 'إتقان مهني', en: 'Professional working' },
    'limited working proficiency': { ar: 'إتقان محدود', en: 'Limited working' },
    'elementary proficiency': { ar: 'مبتدئ', en: 'Elementary' }
};
const file = (files, name) => {
    const hit = Object.keys(files).find(f => f.toLowerCase() === `${name.toLowerCase()}.csv`);
    return hit ? parseCsv(files[hit]) : null;
};

// ─── LinkedIn export → the site's sections. Returns only the sections the export contains. ───
export function mapLinkedIn(files, current = {}) {
    const out = {};
    const profile = file(files, 'Profile')?.[0];
    if (profile) {
        const p = {};
        const headline = splitTitle(pick(profile, 'Headline'));
        if (headline.en || headline.ar) p.headline = headline;
        const summary = splitDescription(pick(profile, 'Summary'));
        if (summary.ar || summary.en) p.summary = summary;
        if (Object.keys(p).length) out.profile = p;
    }
    const positions = file(files, 'Positions');
    if (positions?.length) {
        const old = current.experience || [];
        out.experience = positions.map(r => {
            const item = {
                role: splitTitle(pick(r, 'Title')),
                company: splitTitle(pick(r, 'Company Name')),
                period: period(pick(r, 'Started On', 'Start Date'), pick(r, 'Finished On', 'End Date')),
                description: splitDescription(pick(r, 'Description'))
            };
            const was = old.find(e => key(e.role) === key(item.role) && key(e.company) === key(item.company))
                || old.find(e => key(e.role) === key(item.role));
            return fillFrom(item, was, ['role', 'company', 'period', 'description']);
        });
    }
    const education = file(files, 'Education');
    if (education?.length) {
        out.education = education.map(r => ({
            degree: splitTitle([pick(r, 'Degree Name'), pick(r, 'Field Of Study')].filter(Boolean).join(' - ') || pick(r, 'School Name')),
            institution: splitTitle(pick(r, 'School Name')),
            period: period('', pick(r, 'End Date', 'Finished On') || pick(r, 'Start Date')),
            description: splitDescription([pick(r, 'Notes'), pick(r, 'Activities')].filter(Boolean).join('\n'))
        }));
    }
    const certs = file(files, 'Certifications');
    if (certs?.length) {
        const old = current.certificates || [];
        const imported = certs.map(r => {
            const item = {
                name: splitTitle(pick(r, 'Name')),
                issuer: splitTitle(pick(r, 'Authority')),
                credential: pick(r, 'License Number'),
                date: parseDate(pick(r, 'Started On', 'Issued On'))?.en || ''
            };
            const url = https(pick(r, 'Url', 'URL'));
            if (url) item.url = url;
            const was = old.find(c => (item.credential && c.credential === item.credential) || (item.url && c.url === item.url) || key(c.name) === key(item.name));
            if (was) for (const k of ['image', 'badge', 'status']) if (was[k] !== undefined && was[k] !== '') item[k] = was[k];
            if (was && !item.url && was.url) item.url = was.url;
            return fillFrom(item, was, ['name', 'issuer']);
        });
        // Certificates still being studied for exist only on the site: they stay
        const studying = old.filter(c => ['in-progress', 'planned'].includes(c.status) && !imported.some(i => key(i.name) === key(c.name)));
        out.certificates = [...imported, ...studying];
    }
    const skills = file(files, 'Skills');
    if (skills?.length) {
        const old = current.skills || [];
        out.skills = skills.map(r => pick(r, 'Name')).filter(Boolean).map(name => {
            const was = old.find(s => key(s.en) === key(name) || key(s.ar) === key(name));
            return was ? { ...was } : { ...splitTitle(name), level: 60, category: 'hard' };
        });
    }
    const languages = file(files, 'Languages');
    if (languages?.length) {
        const old = current.languages || [];
        out.languages = languages.map(r => {
            const name = splitTitle(pick(r, 'Name'));
            const was = old.find(l => key(l.name) === key(name));
            const level = LEVELS[pick(r, 'Proficiency').toLowerCase()];
            return { name: was?.name || name, level: level || was?.level || { ar: '', en: pick(r, 'Proficiency') } };
        });
    }
    const projects = file(files, 'Projects');
    if (projects?.length) {
        const old = current.projects || [];
        out.projects = projects.map(r => {
            const title = splitTitle(pick(r, 'Title'));
            const was = old.find(p => key(p.title) === key(title));
            const desc = splitDescription(pick(r, 'Description'));
            const url = https(pick(r, 'Url', 'URL'));
            return { ...(was || { technologies: [], link: '#', liveUrl: '' }), title: was?.title || title, desc, ...(url ? { liveUrl: url } : {}) };
        });
    }
    const volunteering = file(files, 'Volunteering') || file(files, 'Volunteer Experiences');
    if (volunteering?.length) {
        out.volunteer = volunteering.map(r => {
            const description = splitDescription(pick(r, 'Description'));
            const hours = `${description.en} ${description.ar}`.match(/(\d{1,4})\s*(?:certified\s*)?(?:hours|ساعة)/i)?.[1];
            return {
                role: splitTitle(pick(r, 'Role')),
                organization: splitTitle(pick(r, 'Company Name', 'Organization')),
                period: period(pick(r, 'Started On', 'Start Date'), pick(r, 'Finished On', 'End Date')),
                ...(hours ? { hours } : {}),
                description
            };
        });
    }
    return out;
}

// Sections the import can fill, in the order the admin dialog lists them
export const IMPORT_SECTIONS = {
    summary: 'النبذة', title: 'المسمى (العنوان الرئيسي)', experience: 'الخبرات', education: 'التعليم', certificates: 'الشهادات',
    skills: 'المهارات', languages: 'اللغات', projects: 'المشاريع', volunteer: 'التطوع'
};
export const available = (mapped, section) => (section === 'summary' ? !!mapped.profile?.summary : section === 'title' ? !!mapped.profile?.headline : !!mapped[section]);

// Applies the chosen sections of mapLinkedIn's result to a copy of the data (one way: LinkedIn → site).
// A language missing on LinkedIn keeps the site's text in that language.
export function applyLinkedIn(data, mapped, sections) {
    const next = structuredClone(data);
    const merge = (old, add) => ({ ...(old || {}), ...Object.fromEntries(Object.entries(add || {}).filter(([, v]) => v)) });
    for (const section of sections) {
        if (!available(mapped, section)) continue;
        if (section === 'summary') next.profile = { ...next.profile, summary: merge(next.profile?.summary, mapped.profile.summary) };
        else if (section === 'title') next.profile = { ...next.profile, title: merge(next.profile?.title, mapped.profile.headline) };
        else next[section] = mapped[section];
    }
    return next;
}
