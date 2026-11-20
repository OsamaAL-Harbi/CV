// resume.json in the JSON Resume format (https://jsonresume.org/schema), written at deploy from data.json:
// the CV in English (Arabic where no English text exists) as structured data that resume tools, ATS importers and
// JSON Resume themes read. Only what the site already shows publicly, without hidden sections or items.
import { parseStart, isEarned } from '../js/timeline-data.js';
import { skillStep } from '../js/utils.js';

const SITE_URL = 'https://osamaal-harbi.github.io/CV/';
const en = v => (v && typeof v === 'object' ? (v.en || v.ar || '') : String(v ?? '')).trim();
const https = v => (/^https:\/\/[^\s"<>]+$/.test(String(v || '')) ? String(v) : '');
const asset = v => {
    const s = String(v || '');
    if (https(s)) return s;
    return /^[\w\-./]+$/.test(s) && !s.includes('..') ? new URL(s, SITE_URL).href : '';
};
const shown = (data, section) => ((data?.visibility?.sections || []).includes(section) ? [] : (data?.[section] || []).filter(i => i && !i.hidden));
const compact = obj => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && !(Array.isArray(v) && !v.length)));

// "January 2026 – Present" → { startDate: "2026-01" }; "May 2024 – March 2025" → both ends
const ymd = d => (d ? `${d.year}${d.month ? `-${String(d.month).padStart(2, '0')}` : ''}` : '');
function dates(value) {
    const text = en(value);
    const [from, to] = text.split(/\s[–-]\s/);
    const start = parseStart(from);
    const ongoing = /present|current/i.test(to || '');
    const end = to && !ongoing ? parseStart(to) : null;
    return { startDate: ymd(start), endDate: ymd(end) };
}
const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

export function jsonResume(data) {
    const p = data?.profile || {};
    const profiles = [
        https(p.linkedin) && { network: 'LinkedIn', url: https(p.linkedin), username: https(p.linkedin).replace(/\/+$/, '').split('/').pop() },
        https(p.github) && { network: 'GitHub', url: https(p.github), username: https(p.github).replace(/\/+$/, '').split('/').pop() }
    ].filter(Boolean);
    return compact({
        $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
        basics: compact({
            name: en(p.name), label: en(p.title), image: asset(p.image), email: String(p.email || ''), phone: String(p.phone || ''),
            url: SITE_URL, summary: en(p.summary),
            location: en(p.location) ? { address: en(p.location), countryCode: 'SA' } : undefined,
            profiles
        }),
        work: shown(data, 'experience').map(x => compact({ name: en(x.company), position: en(x.role), ...dates(x.period), summary: en(x.description) })),
        volunteer: shown(data, 'volunteer').map(x => compact({ organization: en(x.organization), position: en(x.role), ...dates(x.period), summary: en(x.description) })),
        education: shown(data, 'education').map(x => compact({ institution: en(x.institution), studyType: en(x.degree), endDate: dates(x.period).startDate })),
        certificates: shown(data, 'certificates').filter(isEarned).map(c => compact({ name: en(c.name), issuer: en(c.issuer), date: dates(c.date).startDate, url: https(c.url) })),
        skills: shown(data, 'skills').map(s => compact({ name: en(s), level: Number.isFinite(Number(s.level)) ? SKILL_LEVELS[skillStep(Number(s.level)) - 1] : '' })),
        languages: shown(data, 'languages').map(l => compact({ language: en(l.name), fluency: en(l.level) })),
        projects: shown(data, 'projects').map(x => compact({ name: en(x.title), description: en(x.desc), url: https(x.liveUrl) || https(x.link), keywords: (x.technologies || []).map(String) })),
        meta: { canonical: `${SITE_URL}resume.json`, version: 'v1.0.0', lastModified: new Date().toISOString().slice(0, 10) }
    });
}
