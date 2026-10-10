// E-mail alerts for the system-status sensors, without any mail password: when a monitored site goes down,
// the "Deploy site" workflow opens a GitHub issue that @-mentions the owner, and GitHub e-mails it to them
// (a mention always notifies). When the site is back up, the issue gets a comment and is closed, which
// e-mails again. One issue per site and outage — no repeat mails every 12 hours.
// Usage (in the workflow): GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo node scripts/alert-status.mjs
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './cdn-assets.mjs';

const MARKER = url => `<!-- status-alert:${url} -->`;

export function planAlerts(sensors, openIssues) {
    const byUrl = new Map();
    for (const issue of openIssues) {
        const url = issue.body?.match(/<!-- status-alert:(\S+) -->/)?.[1];
        if (url) byUrl.set(url, issue);
    }
    const open = [], close = [];
    for (const s of sensors) {
        const issue = byUrl.get(s.url);
        if (s.state === 'down' && !issue) open.push(s);
        if (s.state !== 'down' && issue) close.push({ sensor: s, issue });
    }
    return { open, close };
}

export function issueFor(sensor, owner, checkedAt) {
    const reason = sensor.error === 'timeout' ? 'انتهت المهلة (15 ثانية)' : sensor.code ? `HTTP ${sensor.code}` : 'تعذّر الاتصال';
    return {
        title: `🔴 الموقع متوقف: ${sensor.name}`,
        body: [
            `@${owner} تنبيه من مراقبة الأنظمة في موقعك الشخصي.`,
            '',
            `| | |`, `|---|---|`,
            `| الموقع | ${sensor.name} |`, `| الرابط | ${sensor.url} |`, `| السبب | ${reason} |`, `| وقت الفحص | ${checkedAt} (UTC) |`,
            '',
            'تمت محاولة الفحص مرتين. سيُغلق هذا التنبيه تلقائياً عند عودة الموقع في فحص لاحق (كل 12 ساعة، أو شغّل Actions → Deploy site يدوياً).',
            '',
            MARKER(sensor.url)
        ].join('\n'),
        labels: ['status-alert']
    };
}

async function main() {
    const data = JSON.parse(await readFile(join(ROOT, 'data.json'), 'utf8'));
    if (data.monitorAlerts === false) { console.log('alerts are off (data.json → monitorAlerts)'); return; }
    let status;
    try { status = JSON.parse(await readFile(join(ROOT, 'generated', 'status.json'), 'utf8')); }
    catch { console.log('no status.json: nothing to alert'); return; }
    const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPOSITORY;
    if (!token || !repo) { console.log('missing GITHUB_TOKEN / GITHUB_REPOSITORY'); return; }
    const owner = repo.split('/')[0];
    const api = (path, init = {}) => fetch(`https://api.github.com/repos/${repo}${path}`, {
        ...init,
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'osama-portfolio', ...(init.body ? { 'Content-Type': 'application/json' } : {}) }
    });
    // Matched by the marker in the body, so it works even if labels cannot be set by the workflow token
    const res = await api('/issues?state=open&per_page=100');
    if (!res.ok) { console.log(`cannot list issues: HTTP ${res.status}`); return; }
    const { open, close } = planAlerts(status.sensors || [], await res.json());
    for (const s of open) {
        const r = await api('/issues', { method: 'POST', body: JSON.stringify(issueFor(s, owner, status.generatedAt)) });
        console.log(`${r.ok ? 'opened' : `FAILED (${r.status})`} alert for ${s.url}`);
    }
    for (const { sensor, issue } of close) {
        await api(`/issues/${issue.number}/comments`, { method: 'POST', body: JSON.stringify({ body: `@${owner} ✅ عاد الموقع للعمل (${sensor.ms} ms، HTTP ${sensor.code}) في فحص ${status.generatedAt}.` }) });
        const r = await api(`/issues/${issue.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
        console.log(`${r.ok ? 'closed' : `FAILED (${r.status})`} alert for ${sensor.url}`);
    }
    if (!open.length && !close.length) console.log('no alert changes');
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
