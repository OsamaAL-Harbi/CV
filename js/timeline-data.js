// Career timeline data (no DOM, no browser globals — shared with the unit tests): which CV items have a date and
// in what order. The dates are the texts already in the CV ("January 2026 – Present", "April 2026",
// "April 2024 (5 hours)"); items without a year are left out.
export const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
export const MONTHS_AR = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export const TIMELINE_TYPES = {
    experience:   { icon: 'fa-briefcase',          color: 'bg-primary',     title: i => i.role,   org: i => i.company,      when: i => i.period, label: 'sec_exp' },
    education:    { icon: 'fa-university',         color: 'bg-blue-600',    title: i => i.degree, org: i => i.institution,  when: i => i.period, label: 'sec_edu' },
    volunteer:    { icon: 'fa-hands-helping',      color: 'bg-orange-600',  title: i => i.role,   org: i => i.organization, when: i => i.period, label: 'sec_volunteer' },
    certificates: { icon: 'fa-certificate',        color: 'bg-secondary',   title: i => i.name,   org: i => i.issuer,       when: i => i.date,   label: 'sec_certs' },
    workshops:    { icon: 'fa-chalkboard-teacher', color: 'bg-amber-600',   title: i => i.name,   org: i => i.organizer,    when: i => i.date,   label: 'sec_workshops' }
};

// The English text is parsed (the Arabic one is the same date in Arabic); a plain string is used as is.
export function parseStart(value) {
    const text = String(value && typeof value === 'object' ? (value.en || value.ar || '') : value || '');
    const m = text.match(/\b([A-Za-z]+)\s+((?:19|20)\d{2})\b/);
    if (m && MONTHS.includes(m[1].toLowerCase())) return { year: Number(m[2]), month: MONTHS.indexOf(m[1].toLowerCase()) + 1 };
    const y = text.match(/\b((?:19|20)\d{2})\b/);
    return y ? { year: Number(y[1]), month: 0 } : null;
}

const isOngoing = value => /present|current|حاضر|حالي/i.test(value && typeof value === 'object' ? `${value.en || ''} ${value.ar || ''}` : String(value || ''));

// Visible entries, oldest first (same date: data order), with hidden sections and items left out
export function timelineEntries(data) {
    const off = new Set(data?.visibility?.sections || []);
    const out = [];
    for (const [type, def] of Object.entries(TIMELINE_TYPES)) {
        if (off.has(type)) continue;
        (data?.[type] || []).forEach((item, index) => {
            if (!item || item.hidden) return;
            const start = parseStart(def.when(item));
            if (!start) return;
            out.push({ type, index, item, start, ongoing: isOngoing(def.when(item)), order: out.length });
        });
    }
    return out.sort((a, b) => a.start.year - b.start.year || a.start.month - b.start.month || a.order - b.order);
}
