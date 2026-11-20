// Core Web Vitals from real visitors (no library): Largest Contentful Paint, Cumulative Layout Shift and an
// Interaction to Next Paint estimate (the slowest interaction), sent once to Google Analytics as a "web_vitals"
// event when the visitor leaves or hides the page. Nothing is sent for the admin, or where the browser does not
// support these measurements (then the values are simply missing).
import { state } from './state.js';
import { track } from './utils.js';

const RATING = { lcp: [2500, 4000], cls: [0.1, 0.25], inp: [200, 500] };
export const rate = (metric, value) => (value <= RATING[metric][0] ? 'good' : value <= RATING[metric][1] ? 'needs-improvement' : 'poor');

export function initVitals() {
    if (!('PerformanceObserver' in window)) return;
    const supported = PerformanceObserver.supportedEntryTypes || [];
    const values = {};
    const observe = (type, onEntries, options = {}) => {
        if (!supported.includes(type)) return;
        try { new PerformanceObserver(list => onEntries(list.getEntries())).observe({ type, buffered: true, ...options }); } catch { /* not supported */ }
    };

    observe('largest-contentful-paint', entries => { values.lcp = Math.round(entries[entries.length - 1].startTime); });

    // CLS: the largest burst of shifts (gaps under 1 s, at most 5 s long), shifts right after input excluded
    let session = 0, sessionStart = 0, last = 0;
    values.cls = 0;
    observe('layout-shift', entries => {
        for (const e of entries) {
            if (e.hadRecentInput) continue;
            if (session && (e.startTime - last > 1000 || e.startTime - sessionStart > 5000)) session = 0;
            if (!session) sessionStart = e.startTime;
            session += e.value;
            last = e.startTime;
            values.cls = Math.max(values.cls, Math.round(session * 1000) / 1000);
        }
    });

    observe('event', entries => {
        for (const e of entries) if (e.interactionId) values.inp = Math.max(values.inp || 0, Math.round(e.duration));
    }, { durationThreshold: 40 });

    let sent = false;
    const send = () => {
        if (sent || state.isAdmin || document.visibilityState !== 'hidden') return;
        sent = true;
        const params = { page: (location.hash.replace('#', '').split('/')[0] || 'home'), lang: state.currentLang };
        for (const [metric, value] of Object.entries(values)) {
            if (value === undefined) continue;
            params[metric] = value;
            params[`${metric}_rating`] = rate(metric, value);
        }
        track('web_vitals', params);
    };
    document.addEventListener('visibilitychange', send);
    window.addEventListener('pagehide', () => { if (document.visibilityState === 'hidden') send(); });
}
