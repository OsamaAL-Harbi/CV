// Builds generated/status.json for the "System status" panel: every site listed in data.json → monitor
// is requested once per run (the "Deploy site" workflow runs every 12 hours), PRTG-style sensors with
// state, response time and the history needed for 30-day uptime. The history is carried over from the
// status.json currently deployed on the site, so no commits are needed.
//
// Usage: node scripts/check-status.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './cdn-assets.mjs';
import { SITE_URL } from './fetch-github.mjs';

const OUT = join(ROOT, 'generated');
const MAX_TARGETS = 10;
const HISTORY = 60;            // 60 checks × 12 h = 30 days
const TIMEOUT_MS = 15_000;
const SLOW_MS = 3_000;

export function targetsFrom(data) {
    return (data.monitor || [])
        .filter(t => t && /^https:\/\//i.test(t.url || ''))
        .slice(0, MAX_TARGETS)
        .map(t => ({ name: String(t.name || new URL(t.url).hostname).slice(0, 60), url: t.url }));
}

async function probe(url) {
    const started = performance.now();
    try {
        const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS), headers: { 'User-Agent': 'osama-portfolio-monitor' } });
        await res.arrayBuffer();                       // time the whole response, like a browser would
        const ms = Math.round(performance.now() - started);
        return { ok: res.status < 400, code: res.status, ms };
    } catch (err) {
        return { ok: false, code: 0, ms: Math.round(performance.now() - started), error: err.name === 'TimeoutError' ? 'timeout' : 'unreachable' };
    }
}

// One retry before reporting a site as down, so a single dropped connection is not an outage.
export async function check(url, probeFn = probe) {
    const first = await probeFn(url);
    return first.ok ? first : probeFn(url);
}

export function merge(previous, targets, results, now) {
    const old = new Map((previous?.sensors || []).map(s => [s.url, s]));
    return {
        generatedAt: now,
        intervalHours: 12,
        sensors: targets.map((t, i) => {
            const r = results[i];
            const history = [...(old.get(t.url)?.history || []), [now, r.ok ? 1 : 0, r.ms, r.code]].slice(-HISTORY);
            return {
                name: t.name, url: t.url,
                state: !r.ok ? 'down' : r.ms > SLOW_MS ? 'slow' : 'up',
                code: r.code, ms: r.ms, error: r.error || null,
                history
            };
        })
    };
}

export async function main() {
    const data = JSON.parse(await readFile(join(ROOT, 'data.json'), 'utf8'));
    const targets = targetsFrom(data);
    if (!targets.length) { console.log('data.json has no "monitor" targets: nothing to check'); return; }
    let previous = null;
    try {
        const res = await fetch(`${SITE_URL}generated/status.json`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (res.ok) previous = await res.json();
    } catch { /* first run */ }
    const results = [];
    for (const t of targets) results.push(await check(t.url));
    const status = merge(previous, targets, results, new Date().toISOString());
    await mkdir(OUT, { recursive: true });
    await writeFile(join(OUT, 'status.json'), JSON.stringify(status));
    for (const s of status.sensors) console.log(`${s.state.padEnd(4)} ${String(s.ms).padStart(5)} ms  ${s.code}  ${s.url}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
