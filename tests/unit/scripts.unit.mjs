// Unit tests for the deploy-time data scripts: node --test tests/unit/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { githubUser, languageShare, shapeActivity, shapeCalendar, shapeRepo } from '../../scripts/fetch-github.mjs';
import { check, merge, targetsFrom } from '../../scripts/check-status.mjs';

test('githubUser: explicit setting, then the profile URL', () => {
    assert.equal(githubUser({ github: { user: 'abc' } }), 'abc');
    assert.equal(githubUser({ profile: { github: 'https://github.com/OsamaAL-Harbi' } }), 'OsamaAL-Harbi');
    assert.equal(githubUser({ profile: { github: 'https://evil.example/OsamaAL-Harbi' } }), '');
});

test('shapeRepo keeps only https homepages', () => {
    const base = { name: 'r', url: 'https://github.com/u/r', stargazerCount: 1, forkCount: 0, isFork: false, isArchived: false, pushedAt: 'x' };
    assert.equal(shapeRepo({ ...base, homepageUrl: 'javascript:alert(1)' }).homepage, '');
    assert.equal(shapeRepo({ ...base, homepageUrl: 'https://ok.example' }).homepage, 'https://ok.example');
    assert.equal(shapeRepo(base).branch, 'main');
});

test('languageShare sums bytes across repositories, top 6 + Other', () => {
    const repo = langs => ({ languages: langs.map(([name, size]) => ({ name, size, color: '#000' })) });
    const share = languageShare([repo([['A', 600], ['B', 200]]), repo([['A', 200], ['C', 1], ['D', 1], ['E', 1], ['F', 1], ['G', 1], ['H', 1]])]);
    assert.equal(share[0].name, 'A');
    assert.equal(share[0].percent, 79.5);          // 800 of 1006 bytes
    assert.equal(share.length, 7);
    assert.equal(share.at(-1).name, 'Other');
    assert.deepEqual(languageShare([]), []);
});

test('shapeCalendar flattens weeks into [date, count, level]', () => {
    const cal = shapeCalendar({ totalContributions: 3, weeks: [{ contributionDays: [
        { date: '2026-01-04', contributionCount: 0, contributionLevel: 'NONE' },
        { date: '2026-01-05', contributionCount: 3, contributionLevel: 'FOURTH_QUARTILE' }
    ] }] });
    assert.deepEqual(cal, { total: 3, days: [['2026-01-04', 0, 0], ['2026-01-05', 3, 4]] });
});

test('shapeActivity keeps featured repositories only and known event types', () => {
    const events = [
        { type: 'PushEvent', repo: { name: 'u/test' }, created_at: '1', payload: { size: 1 } },
        { type: 'PushEvent', repo: { name: 'u/JobMatch' }, created_at: '2', payload: { size: 2, commits: [{ message: 'first' }, { message: 'last line\nbody' }] } },
        { type: 'WatchEvent', repo: { name: 'u/jobmatch' }, created_at: '3', payload: {} },
        { type: 'ReleaseEvent', repo: { name: 'u/jobmatch' }, created_at: '4', payload: { action: 'published', release: { tag_name: 'v1' } } },
        { type: 'PullRequestEvent', repo: { name: 'u/jobmatch' }, created_at: '5', payload: { action: 'closed', pull_request: { merged: true, title: 'Add x' } } }
    ];
    assert.deepEqual(shapeActivity(events, ['jobmatch']), [
        { repo: 'JobMatch', at: '2', type: 'push', count: 2, message: 'last line' },
        { repo: 'jobmatch', at: '4', type: 'release', name: 'v1' },
        { repo: 'jobmatch', at: '5', type: 'merge', name: 'Add x' }
    ]);
});

test('targetsFrom: https only, at most 10, default name from the host', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ url: `https://s${i}.example/` }));
    assert.equal(targetsFrom({ monitor: many }).length, 10);
    assert.deepEqual(targetsFrom({ monitor: [{ url: 'http://x.example' }, { url: 'https://y.example/a' }] }), [{ name: 'y.example', url: 'https://y.example/a' }]);
    assert.deepEqual(targetsFrom({}), []);
});

test('check retries once before reporting a site as down', async () => {
    let calls = 0;
    const flaky = async () => (++calls === 1 ? { ok: false, code: 0, ms: 10 } : { ok: true, code: 200, ms: 50 });
    assert.deepEqual(await check('https://x.example', flaky), { ok: true, code: 200, ms: 50 });
    assert.equal(calls, 2);
});

test('merge appends to the deployed history, keeps 60 entries, and grades slow responses', () => {
    const url = 'https://x.example/';
    const previous = { sensors: [{ url, history: Array.from({ length: 60 }, (_, i) => [`t${i}`, 1, 100, 200]) }] };
    const out = merge(previous, [{ name: 'X', url }, { name: 'Y', url: 'https://y.example/' }],
        [{ ok: true, code: 200, ms: 4000 }, { ok: false, code: 0, ms: 15000, error: 'timeout' }], 'now');
    assert.equal(out.sensors[0].history.length, 60);
    assert.deepEqual(out.sensors[0].history.at(-1), ['now', 1, 4000, 200]);
    assert.equal(out.sensors[0].history[0][0], 't1');
    assert.equal(out.sensors[0].state, 'slow');
    assert.equal(out.sensors[1].state, 'down');
    assert.equal(out.sensors[1].error, 'timeout');
    assert.equal(out.intervalHours, 12);
});

// Every admin('<name>') action in js/actions.js must be exported by js/admin.js (a missing one fails silently in the UI).
test('admin actions resolve to exported functions', async () => {
    const { readFile } = await import('node:fs/promises');
    const actions = await readFile(new URL('../../js/actions.js', import.meta.url), 'utf8');
    const admin = await readFile(new URL('../../js/admin.js', import.meta.url), 'utf8');
    const names = [...new Set([...actions.matchAll(/admin\('(\w+)'/g)].map(m => m[1]))];
    assert.ok(names.length > 10);
    assert.deepEqual(names.filter(n => !new RegExp(`export (async )?function ${n}\\b`).test(admin)), []);
});

test('deriveTheme keeps every preset within WCAG contrast', async () => {
    const { PRESETS, deriveTheme } = await import('../../js/color.js');
    for (const p of [...PRESETS, { primary: '#facc15', secondary: '#22d3ee' }, { primary: '#ffffff', secondary: '#000000' }]) {
        const d = deriveTheme(p);
        assert.deepEqual(d.report.filter(r => !r.pass).map(r => `${p.primary}: ${r.id} ${r.ratio}`), []);
    }
    assert.equal(deriveTheme({ primary: 'nope' }).chosen.primary, '#2563eb');
});
