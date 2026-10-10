// Admin → Statistics: live numbers from Google Analytics 4 (the GA Data API), for every visitor on every
// device — not this browser's own counters. The admin signs in with Google in a popup (oauth.html); the
// short-lived read-only token stays in this tab's sessionStorage. Nothing secret lives in the site:
// data.json → analytics holds the GA property ID and the OAuth client ID, both public identifiers.
import { state } from './state.js';
import { session } from './storage.js';
import { escapeHTML, loadVendor, showToast } from './utils.js';
import { PAGE_META } from './router.js';

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const API = 'https://analyticsdata.googleapis.com/v1beta/properties/';
const TOKEN_KEY = 'ga_token';
const RANGES = [7, 28, 90];

export const EVENT_LABELS = {
    cv_download: 'تحميل السيرة الذاتية', file_download: 'تحميل ملف (تلقائي من GA)', contact_email: 'نسخ البريد',
    contact_linkedin: 'فتح LinkedIn', contact_github: 'فتح GitHub', contact_whatsapp: 'محادثة واتساب',
    contact_vcard: 'حفظ جهة الاتصال', contact_message: 'كتابة رسالة', share: 'مشاركة الموقع',
    view_project: 'فتح تفاصيل مشروع', view_case_study: 'قراءة دراسة حالة', generate_pdf: 'إنشاء PDF من الصفحة'
};
const DEVICE_LABELS = { desktop: 'كمبيوتر', mobile: 'جوال', tablet: 'جهاز لوحي', smart_tv: 'تلفاز' };

let range = 28;

const settings = () => state.appData.analytics || {};
export const isConfigured = s => /^\d{5,}$/.test(String(s?.propertyId || '')) && /\.apps\.googleusercontent\.com$/.test(String(s?.clientId || ''));

// ─── Google sign-in (implicit OAuth flow in a popup; no Google script is loaded into the site) ───
function savedToken() {
    const t = session.getJSON(TOKEN_KEY, null);
    return t && t.exp > Date.now() ? t.token : '';
}

export function signIn(clientId) {
    const nonce = crypto.randomUUID();
    const redirectUri = new URL('oauth.html', location.href).href.split('#')[0];
    const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
        client_id: clientId, redirect_uri: redirectUri, response_type: 'token', scope: SCOPE,
        state: nonce, include_granted_scopes: 'true', prompt: 'select_account'
    })}`;
    // Opened synchronously inside the click handler, so pop-up blockers allow it
    const popup = window.open(url, 'ga-oauth', 'popup,width=480,height=660');
    return new Promise((resolve, reject) => {
        if (!popup) { reject(new Error('popup_blocked')); return; }
        const channel = new BroadcastChannel('ga-oauth');
        const timer = setTimeout(() => { channel.close(); reject(new Error('timeout')); }, 5 * 60 * 1000);
        channel.onmessage = ({ data }) => {
            if (data?.type !== 'ga-oauth' || data.state !== nonce) return;   // not the answer to this request
            clearTimeout(timer);
            channel.close();
            if (data.error || !data.token) { reject(new Error(data.error || 'no_token')); return; }
            if (!String(data.scope).includes('analytics')) { reject(new Error('scope_denied')); return; }
            session.setJSON(TOKEN_KEY, { token: data.token, exp: Date.now() + (data.expiresIn - 60) * 1000 });
            resolve(data.token);
        };
    });
}

export function signOut() { session.remove(TOKEN_KEY); }

// ─── GA Data API ───
class AuthError extends Error {}

async function call(method, body) {
    const token = savedToken();
    if (!token) throw new AuthError('signed_out');
    const res = await fetch(`${API}${encodeURIComponent(settings().propertyId)}:${method}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (res.status === 401) { signOut(); throw new AuthError('expired'); }
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `HTTP ${res.status}`);
    }
    return res.json();
}

const rows = report => (report?.rows || []).map(r => ({
    dims: (r.dimensionValues || []).map(d => d.value),
    vals: (r.metricValues || []).map(m => Number(m.value) || 0)
}));

export async function fetchReports(days) {
    const current = { startDate: `${days - 1}daysAgo`, endDate: 'today' };
    const previous = { startDate: `${2 * days - 1}daysAgo`, endDate: `${days}daysAgo` };
    const report = (dimensions, metrics, extra = {}) => call('runReport', {
        dateRanges: [current], dimensions: dimensions.map(name => ({ name })), metrics: metrics.map(name => ({ name })), ...extra
    });
    const byMetric = (metric, limit) => ({ orderBys: [{ metric: { metricName: metric }, desc: true }], limit });
    const eventFilter = names => ({ dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: names } } } });

    const [totals, daily, pages, events, countries, devices, sources, realtime, projects] = await Promise.allSettled([
        call('runReport', { dateRanges: [current, previous], metrics: ['activeUsers', 'sessions', 'screenPageViews', 'engagementRate'].map(name => ({ name })) }),
        report(['date'], ['activeUsers', 'screenPageViews'], { orderBys: [{ dimension: { dimensionName: 'date' } }] }),
        report(['pageTitle'], ['screenPageViews'], byMetric('screenPageViews', 25)),
        call('runReport', { dateRanges: [current, previous], dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }], ...eventFilter(Object.keys(EVENT_LABELS)) }),
        report(['country'], ['activeUsers'], byMetric('activeUsers', 6)),
        report(['deviceCategory'], ['activeUsers'], byMetric('activeUsers', 4)),
        report(['sessionSource'], ['sessions'], byMetric('sessions', 6)),
        call('runRealtimeReport', { metrics: [{ name: 'activeUsers' }] }),
        // Needs the custom dimension "project" (GA → Admin → Custom definitions); hidden when missing
        report(['customEvent:project'], ['eventCount'], { ...eventFilter(['view_project', 'view_case_study']), ...byMetric('eventCount', 8) })
    ]);
    const auth = [totals, daily].find(r => r.status === 'rejected' && r.reason instanceof AuthError);
    if (auth) throw auth.reason;
    if (totals.status === 'rejected') throw totals.reason;
    const ok = r => (r.status === 'fulfilled' ? r.value : null);
    return shapeReports({
        totals: ok(totals), daily: ok(daily), pages: ok(pages), events: ok(events), countries: ok(countries),
        devices: ok(devices), sources: ok(sources), realtime: ok(realtime), projects: ok(projects)
    });
}

// Section of a GA page title, in both languages ("السيرة الذاتية | …" and "Resume | …" → resume)
const TITLE_TO_SECTION = new Map(Object.values(PAGE_META).flatMap(lang => Object.entries(lang).map(([id, m]) => [m.title, id])));
const SECTION_LABELS = { home: 'الرئيسية', resume: 'السيرة الذاتية', portfolio: 'الأعمال', contact: 'تواصل', 'not-found': 'صفحة غير موجودة' };

export function shapeReports(r) {
    const totalRows = rows(r.totals);
    const pick = range => totalRows.find(x => x.dims[0] === range)?.vals || [0, 0, 0, 0];
    const [cur, prev] = [pick('date_range_0'), pick('date_range_1')];
    const eventRows = rows(r.events);
    const eventCount = (name, rangeId) => eventRows.filter(x => x.dims[0] === name && x.dims[1] === rangeId).reduce((s, x) => s + x.vals[0], 0);
    const cv = id => eventCount('cv_download', id) + eventCount('file_download', id);

    const sections = new Map();
    for (const row of rows(r.pages)) {
        const id = TITLE_TO_SECTION.get(row.dims[0]) || 'other';
        sections.set(id, (sections.get(id) || 0) + row.vals[0]);
    }
    return {
        kpis: [
            { id: 'users', label: 'الزوار', value: cur[0], previous: prev[0] },
            { id: 'sessions', label: 'الزيارات', value: cur[1], previous: prev[1] },
            { id: 'views', label: 'مشاهدات الأقسام', value: cur[2], previous: prev[2] },
            { id: 'cv', label: 'تحميل السيرة الذاتية', value: cv('date_range_0'), previous: cv('date_range_1') }
        ],
        engagement: cur[3],
        daily: rows(r.daily).map(x => ({ date: x.dims[0], users: x.vals[0], views: x.vals[1] })),
        sections: [...sections].map(([id, views]) => ({ label: SECTION_LABELS[id] || 'أخرى', views })).sort((a, b) => b.views - a.views),
        events: Object.keys(EVENT_LABELS).map(name => ({ name, label: EVENT_LABELS[name], count: eventCount(name, 'date_range_0') })).filter(e => e.count > 0)
            .sort((a, b) => b.count - a.count),
        countries: rows(r.countries).map(x => ({ label: x.dims[0], value: x.vals[0] })),
        devices: rows(r.devices).map(x => ({ label: DEVICE_LABELS[x.dims[0]] || x.dims[0], value: x.vals[0] })),
        sources: rows(r.sources).map(x => ({ label: x.dims[0] === '(direct)' ? 'مباشر (direct)' : x.dims[0], value: x.vals[0] })),
        projects: r.projects ? rows(r.projects).filter(x => x.dims[0] && x.dims[0] !== '(not set)').map(x => ({ label: x.dims[0], value: x.vals[0] })) : null,
        realtime: rows(r.realtime)[0]?.vals[0] ?? 0
    };
}

// ─── Rendering ───
const fmt = n => new Intl.NumberFormat('ar-u-nu-latn', { maximumFractionDigits: 1 }).format(n);
const gaDate = d => new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)));
const dayFmt = new Intl.DateTimeFormat('ar-u-nu-latn', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function delta(value, previous) {
    if (!previous) return value ? '<span class="text-xs text-gray-500">جديد</span>' : '';
    const pct = Math.round(((value - previous) / previous) * 100);
    const up = pct >= 0;
    return `<span class="text-xs font-bold ${up ? 'text-green-700' : 'text-red-600'}" dir="ltr">${up ? '▲' : '▼'} ${Math.abs(pct)}%</span>
            <span class="sr-only">${up ? 'زيادة' : 'انخفاض'} عن الفترة السابقة</span>`;
}

// Single-series area chart of daily visitors, with a crosshair tooltip and a table fallback
function trendChart(daily) {
    if (daily.length < 2) return '<p class="text-sm text-gray-500 py-8 text-center">لا توجد بيانات كافية بعد لهذه الفترة.</p>';
    const W = 860, H = 190, padL = 34, padB = 22, padT = 10;
    const max = Math.max(1, ...daily.map(d => d.users));
    const niceMax = Math.ceil(max / 5) * 5 || 5;
    const x = i => padL + (i / (daily.length - 1)) * (W - padL - 8);
    const y = v => padT + (1 - v / niceMax) * (H - padT - padB);
    const line = daily.map((d, i) => `${x(i).toFixed(1)},${y(d.users).toFixed(1)}`).join(' ');
    const area = `${padL},${y(0)} ${line} ${x(daily.length - 1).toFixed(1)},${y(0)}`;
    const grid = [0, niceMax / 2, niceMax].map(v => `
        <line x1="${padL}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}" stroke="#e5e7eb" stroke-width="1"/>
        <text x="${padL - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#6b7280">${fmt(v)}</text>`).join('');
    const ticks = [0, Math.floor((daily.length - 1) / 2), daily.length - 1].map(i => `
        <text x="${x(i)}" y="${H - 4}" text-anchor="${i === 0 ? 'start' : i === daily.length - 1 ? 'end' : 'middle'}" font-size="11" fill="#6b7280">${escapeHTML(dayFmt.format(gaDate(daily[i].date)))}</text>`).join('');
    const step = (W - padL - 8) / (daily.length - 1);
    const hits = daily.map((d, i) => `<rect x="${(x(i) - step / 2).toFixed(1)}" y="0" width="${step.toFixed(1)}" height="${H - padB}" fill="transparent" data-i="${i}"/>`).join('');
    return `
        <div class="relative" id="st-chart" dir="ltr">
            <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto text-primary" role="img" aria-label="الزوار يومياً">
                ${grid}
                <polygon points="${area}" fill="currentColor" fill-opacity="0.12"/>
                <polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
                <line id="st-cross" x1="0" x2="0" y1="${padT}" y2="${H - padB}" stroke="#9ca3af" stroke-width="1" visibility="hidden"/>
                <circle id="st-dot" r="4" fill="currentColor" stroke="#fff" stroke-width="2" visibility="hidden"/>
                ${ticks}
                ${hits}
            </svg>
            <div id="st-tip" class="hidden absolute pointer-events-none px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold whitespace-nowrap" dir="rtl"></div>
        </div>
        <details class="mt-2 text-xs"><summary class="cursor-pointer text-gray-500">عرض البيانات كجدول</summary>
            <table class="w-full mt-2"><thead><tr class="text-gray-500"><th class="text-right py-1">اليوم</th><th class="text-right">الزوار</th><th class="text-right">المشاهدات</th></tr></thead>
            <tbody>${daily.map(d => `<tr class="border-t border-gray-100"><td class="py-1">${escapeHTML(dayFmt.format(gaDate(d.date)))}</td><td>${fmt(d.users)}</td><td>${fmt(d.views)}</td></tr>`).join('')}</tbody></table>
        </details>`;
}

function bindChart(root, daily) {
    const svg = root.querySelector('#st-chart svg');
    if (!svg) return;
    const tip = root.querySelector('#st-tip'), cross = root.querySelector('#st-cross'), dot = root.querySelector('#st-dot');
    const pts = svg.querySelector('polyline').getAttribute('points').split(' ').map(p => p.split(',').map(Number));
    svg.addEventListener('pointermove', e => {
        const i = e.target.dataset?.i;
        if (i === undefined) return;
        const [px, py] = pts[Number(i)], d = daily[Number(i)];
        cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
        dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('visibility', 'visible');
        tip.textContent = `${dayFmt.format(gaDate(d.date))} · ${fmt(d.users)} زائر · ${fmt(d.views)} مشاهدة`;
        const box = svg.getBoundingClientRect(), scale = box.width / svg.viewBox.baseVal.width;
        tip.style.left = `${Math.min(box.width - 160, Math.max(0, px * scale - 80))}px`;
        tip.style.top = `${Math.max(0, py * scale - 40)}px`;
        tip.classList.remove('hidden');
    });
    svg.addEventListener('pointerleave', () => { tip.classList.add('hidden'); cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); });
}

function barList(title, items, empty = 'لا توجد بيانات بعد') {
    const max = Math.max(1, ...items.map(i => i.value ?? i.views ?? i.count));
    const body = items.length ? items.map(i => {
        const v = i.value ?? i.views ?? i.count;
        return `<li class="text-sm">
            <div class="flex justify-between gap-3 mb-1"><span class="truncate" dir="auto">${escapeHTML(i.label)}</span><span class="font-bold" dir="ltr">${fmt(v)}</span></div>
            <div class="h-1.5 rounded-full bg-gray-100"><div class="h-1.5 rounded-full bg-primary" data-w="${Math.max(2, Math.round((v / max) * 100))}"></div></div>
        </li>`;
    }).join('') : `<li class="text-sm text-gray-500">${empty}</li>`;
    return `<section class="p-4 rounded-2xl border border-gray-200"><h4 class="font-bold text-sm mb-3">${title}</h4><ul class="space-y-3">${body}</ul></section>`;
}

function renderDashboard(root, data) {
    root.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div class="flex gap-1" role="group" aria-label="الفترة">${RANGES.map(d => `
                <button type="button" data-st-range="${d}" aria-pressed="${d === range}" class="px-3 py-1.5 rounded-full text-xs font-bold ${d === range ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700'}">آخر ${d} يوماً</button>`).join('')}
            </div>
            <div class="flex items-center gap-2 text-xs">
                <span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 text-green-800 font-bold"><span class="w-2 h-2 rounded-full bg-green-500 motion-safe:animate-pulse" aria-hidden="true"></span>${fmt(data.realtime)} الآن (آخر 30 دقيقة)</span>
                <button type="button" data-st-refresh class="px-3 py-1.5 rounded-full bg-gray-100 font-bold">↻ تحديث</button>
                <button type="button" data-st-settings class="px-3 py-1.5 rounded-full bg-gray-100 font-bold">⚙ الإعدادات</button>
                <button type="button" data-st-signout class="px-3 py-1.5 rounded-full bg-gray-100 font-bold">خروج من Google</button>
            </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">${data.kpis.map(k => `
            <div class="p-4 rounded-2xl border border-gray-200 text-center">
                <p class="text-xs text-gray-500 mb-1">${k.label}</p>
                <p class="text-2xl font-extrabold text-primary" dir="ltr">${fmt(k.value)}</p>
                <p class="mt-1">${delta(k.value, k.previous)}</p>
            </div>`).join('')}
        </div>
        <section class="p-4 rounded-2xl border border-gray-200 mb-5">
            <div class="flex justify-between items-baseline mb-2"><h4 class="font-bold text-sm">الزوار يومياً</h4>
                <span class="text-xs text-gray-500">نسبة التفاعل ${fmt(Math.round(data.engagement * 100))}%</span></div>
            ${trendChart(data.daily)}
        </section>
        <div class="grid md:grid-cols-2 gap-4">
            ${barList('الأقسام الأكثر مشاهدة', data.sections)}
            ${barList('التفاعل', data.events.map(e => ({ label: e.label, value: e.count })), 'لا توجد تفاعلات مسجّلة بعد')}
            ${data.projects ? barList('المشاريع الأكثر اهتماماً', data.projects) : ''}
            ${barList('الدول', data.countries)}
            ${barList('الأجهزة', data.devices)}
            ${barList('مصادر الزيارات', data.sources)}
        </div>
        ${data.projects ? '' : '<p class="text-[11px] text-gray-500 mt-3">لعرض المشاريع الأكثر اهتماماً: أنشئ في GA بُعداً مخصصاً باسم <b dir="ltr">project</b> (Admin → Custom definitions → Event scope، المعامل project).</p>'}
        <p class="text-[11px] text-gray-500 mt-3">البيانات من Google Analytics لكل الزوار. التقارير اليومية تتأخر عادة بضع ساعات، والرقم «الآن» مباشر. زياراتك أثناء وضع المدير لا تُحسب.</p>
        <div class="flex gap-2 justify-center mt-4 text-xs">
            <a href="https://analytics.google.com/analytics/web/#/p${encodeURIComponent(settings().propertyId)}/reports/intelligenthome" target="_blank" rel="noopener noreferrer" class="px-4 py-2 rounded-xl bg-orange-500 text-white font-bold">فتح Google Analytics</a>
            <a href="https://clarity.microsoft.com/" target="_blank" rel="noopener noreferrer" class="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold">فتح Microsoft Clarity</a>
        </div>`;
    root.querySelectorAll('[data-w]').forEach(el => { el.style.width = `${el.dataset.w}%`; });
    bindChart(root, data.daily);
}

function renderSignIn(root, message = '') {
    root.innerHTML = `
        <div class="text-center py-8 space-y-4">
            <p class="text-sm text-gray-600">سجّل الدخول بحساب Google الذي يملك صلاحية على خاصية Google Analytics لعرض الإحصائيات الحقيقية لكل الزوار.</p>
            ${message ? `<p class="text-sm text-red-600">${escapeHTML(message)}</p>` : ''}
            <button type="button" data-st-signin class="px-5 py-2.5 rounded-xl bg-white border border-gray-300 font-bold text-sm shadow-sm hover:bg-gray-50">
                <i class="fab fa-google text-red-500 me-2" aria-hidden="true"></i>تسجيل الدخول بحساب Google
            </button>
            <p class="text-[11px] text-gray-500">صلاحية قراءة فقط (analytics.readonly)، والرمز يبقى في هذا التبويب لمدة ساعة.</p>
            <button type="button" data-st-settings class="text-xs text-gray-500 underline">الإعدادات</button>
        </div>`;
}

const SETUP_STEPS = `
    <ol class="list-decimal ps-5 space-y-1.5 text-xs leading-relaxed text-gray-700">
        <li>في <a class="text-blue-600 underline" href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer">Google Analytics</a>: Admin → Property details → انسخ <b>Property ID</b> (أرقام فقط).</li>
        <li>في <a class="text-blue-600 underline" href="https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com" target="_blank" rel="noopener noreferrer">Google Cloud Console</a>: أنشئ مشروعاً وفعّل <b>Google Analytics Data API</b>.</li>
        <li>APIs &amp; Services → OAuth consent screen: النوع External، وأضف بريدك في Test users.</li>
        <li>Credentials → Create credentials → OAuth client ID → Web application، ثم أضف:
            <div class="mt-1 p-2 rounded bg-gray-100 font-mono text-[11px] leading-5" dir="ltr">Authorized JavaScript origins: ${escapeHTML(location.origin)}<br>Authorized redirect URIs: ${escapeHTML(new URL('oauth.html', location.href).href.split('#')[0])}</div>
            وانسخ <b>Client ID</b>.</li>
        <li>في GA: Admin → Data streams → الموقع → Enhanced measurement → أوقف «Page changes based on browser history events» (الموقع يرسل مشاهدات الأقسام بنفسه، فلا تتكرر).</li>
        <li>(اختياري) Admin → Custom definitions → Create custom dimension: الاسم project، النطاق Event، المعامل <b dir="ltr">project</b>.</li>
    </ol>`;

async function editSettings() {
    const s = settings();
    const { value } = await Swal.fire({
        title: 'إعداد إحصائيات Google Analytics',
        width: '720px',
        html: `<div class="text-right space-y-4" dir="rtl">
            ${SETUP_STEPS}
            <label class="block text-xs font-bold text-gray-500">GA4 Property ID
                <input id="st-pid" class="swal2-input m-0 mt-1 w-full font-mono" dir="ltr" inputmode="numeric" placeholder="123456789" value="${escapeHTML(s.propertyId || '')}"></label>
            <label class="block text-xs font-bold text-gray-500">OAuth Client ID
                <input id="st-cid" class="swal2-input m-0 mt-1 w-full font-mono" dir="ltr" placeholder="xxxx.apps.googleusercontent.com" value="${escapeHTML(s.clientId || '')}"></label>
        </div>`,
        showCancelButton: true, confirmButtonText: 'تطبيق', cancelButtonText: 'إلغاء', focusConfirm: false,
        preConfirm: () => {
            const next = { propertyId: document.getElementById('st-pid').value.trim(), clientId: document.getElementById('st-cid').value.trim() };
            if (!isConfigured(next)) { Swal.showValidationMessage('تحقق من القيم: Property ID أرقام فقط، وClient ID ينتهي بـ .apps.googleusercontent.com'); return false; }
            return next;
        }
    });
    if (!value) return false;
    state.appData.analytics = { ...(state.appData.analytics || {}), ...value };
    signOut();
    showToast('تم التطبيق — اضغط «حفظ» في شريط المدير ليبقى الإعداد ✅', 'success');
    return true;
}

export async function openStatistics() {
    if (!state.isAdmin) return;
    await loadVendor('swal');
    if (!isConfigured(settings())) {
        if (!(await editSettings())) return;
    }
    let root;
    const load = async () => {
        if (!savedToken()) { renderSignIn(root); return; }
        root.innerHTML = '<p class="text-center text-sm text-gray-500 py-16">⏳ جاري جلب الإحصائيات من Google Analytics…</p>';
        try {
            renderDashboard(root, await fetchReports(range));
        } catch (err) {
            if (err instanceof AuthError) renderSignIn(root, 'انتهت الجلسة، سجّل الدخول مجدداً.');
            else root.innerHTML = `<div class="text-center py-10 space-y-3"><p class="text-sm text-red-600">تعذّر جلب البيانات: ${escapeHTML(err.message)}</p>
                <p class="text-xs text-gray-500">تأكد من Property ID ومن أن حسابك يملك صلاحية عليه، ومن تفعيل Google Analytics Data API.</p>
                <button type="button" data-st-settings class="px-4 py-2 rounded-lg bg-gray-100 text-xs font-bold">الإعدادات</button>
                <button type="button" data-st-refresh class="px-4 py-2 rounded-lg bg-gray-100 text-xs font-bold">إعادة المحاولة</button></div>`;
        }
    };
    await Swal.fire({
        title: '📊 الإحصائيات',
        width: '980px',
        html: '<div id="st-root" class="text-right" dir="rtl"></div>',
        showConfirmButton: false,
        showCloseButton: true,
        didOpen: popup => {
            root = popup.querySelector('#st-root');
            root.addEventListener('click', async e => {
                const btn = e.target.closest('button');
                if (!btn) return;
                if (btn.dataset.stRange) { range = Number(btn.dataset.stRange); load(); }
                else if (btn.hasAttribute('data-st-refresh')) load();
                else if (btn.hasAttribute('data-st-signout')) { signOut(); renderSignIn(root); }
                else if (btn.hasAttribute('data-st-settings')) { Swal.close(); if (await editSettings()) openStatistics(); }
                else if (btn.hasAttribute('data-st-signin')) {
                    const p = signIn(settings().clientId);
                    root.querySelector('[data-st-signin]').disabled = true;
                    try { await p; load(); }
                    catch (err) {
                        const why = { popup_blocked: 'المتصفح منع النافذة المنبثقة، اسمح بها ثم أعد المحاولة.', access_denied: 'أُلغي تسجيل الدخول.', scope_denied: 'لم تُمنح صلاحية قراءة الإحصائيات.', timeout: 'انتهت المهلة.' }[err.message];
                        renderSignIn(root, why || `تعذّر تسجيل الدخول (${err.message}).`);
                    }
                }
            });
            load();
        }
    });
}
