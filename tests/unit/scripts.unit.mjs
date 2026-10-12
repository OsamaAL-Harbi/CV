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
    assert.deepEqual(names.filter(n => !new RegExp(`export (async )?(function|const) ${n}\\b`).test(admin)), []);
});

test('deriveTheme keeps every preset within WCAG contrast', async () => {
    const { PRESETS, deriveTheme } = await import('../../js/color.js');
    for (const p of [...PRESETS, { primary: '#facc15', secondary: '#22d3ee' }, { primary: '#ffffff', secondary: '#000000' }]) {
        const d = deriveTheme(p);
        assert.deepEqual(d.report.filter(r => !r.pass).map(r => `${p.primary}: ${r.id} ${r.ratio}`), []);
    }
    assert.equal(deriveTheme({ primary: 'nope' }).chosen.primary, '#2563eb');
});

test('diffLines finds the changed lines and hunks keeps context around them', async () => {
    const { diffLines, hunks, diffStats } = await import('../../js/diff.js');
    const a = ['{', '  "a": 1,', '  "b": 2,', '  "c": 3,', '  "d": 4,', '  "e": 5,', '  "f": 6,', '}'].join('\n');
    const b = a.replace('"c": 3', '"c": 30').replace('"f": 6', '"f": 6,\n  "g": 7');
    const ops = diffLines(a, b);
    assert.deepEqual(diffStats(ops), { added: 2, removed: 1 });
    assert.deepEqual(ops.filter(o => o.op !== ' ').map(o => o.op + o.text.trim()), ['-"c": 3,', '+"c": 30,', '+"g": 7,']);
    assert.deepEqual(ops.find(o => o.op === '+' && o.text.includes('"g"')), { op: '+', text: '  "g": 7,', b: 8 });
    const h = hunks(ops, 1);                       // c (±1 line) and g (±1 line), with a gap between
    assert.deepEqual(h.map(o => o.op), [' ', '-', '+', ' ', '…', ' ', '+', ' ']);
    assert.deepEqual(diffStats(diffLines(a, a)), { added: 0, removed: 0 });
    assert.equal(hunks(diffLines(a, a)).length, 0);
});

test('applySeo writes escaped meta tags; applyProfileImage sets the JSON-LD photo', async () => {
    const { applySeo, applyProfileImage, touchSitemap } = await import('../../scripts/assemble-site.mjs');
    const { readFile } = await import('node:fs/promises');
    const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
    const out = applySeo(html, { seo: { ar: { title: 'T "q" <x> $1', description: 'D & d' }, image: 'images/og.jpg' } });
    assert.match(out, /<title>T "q" &lt;x&gt; \$1<\/title>/);
    assert.match(out, /id="og-title"[^>]*content="T &quot;q&quot; &lt;x&gt; \$1"/);
    assert.match(out, /id="meta-description"[^>]*content="D &amp; d"/);
    assert.match(out, /property="og:image"\s+content="https:\/\/osamaal-harbi\.github\.io\/CV\/images\/og\.jpg"/);
    assert.equal(applySeo(html, {}), html);
    assert.equal(applySeo(html, { seo: { image: 'javascript:alert(1)' } }).includes('javascript'), false);
    assert.match(applyProfileImage(html, { profile: { image: 'images/p.webp' } }), /"image": "https:\/\/osamaal-harbi\.github\.io\/CV\/images\/p\.webp"/);
    assert.equal(applyProfileImage(html, { profile: { image: '' } }), html);
    assert.equal(touchSitemap('<lastmod>2020-01-01</lastmod>', '2026-10-11'), '<lastmod>2026-10-11</lastmod>');
});

test('planAlerts opens one issue per outage and closes it on recovery', async () => {
    const { planAlerts, issueFor } = await import('../../scripts/alert-status.mjs');
    const sensors = [
        { name: 'A', url: 'https://a.example/', state: 'down', code: 0, error: 'timeout' },
        { name: 'B', url: 'https://b.example/', state: 'down', code: 503 },
        { name: 'C', url: 'https://c.example/', state: 'up', code: 200, ms: 90 }
    ];
    const open = [{ number: 7, body: 'x <!-- status-alert:https://b.example/ -->' }, { number: 8, body: '<!-- status-alert:https://c.example/ -->' }, { number: 9, body: 'unrelated' }];
    const plan = planAlerts(sensors, open);
    assert.deepEqual(plan.open.map(s => s.name), ['A']);              // B already has an open issue
    assert.deepEqual(plan.close.map(c => c.issue.number), [8]);       // C recovered
    const issue = issueFor(sensors[0], 'OsamaAL-Harbi', '2026-10-11T03:23:00Z');
    assert.match(issue.body, /^@OsamaAL-Harbi /);
    assert.match(issue.body, /<!-- status-alert:https:\/\/a\.example\/ -->$/);
    assert.match(issue.body, /انتهت المهلة/);
});

test('merge3 keeps both sides: a stale editor copy never erases a newer value on GitHub', async () => {
    const { merge3 } = await import('../../js/diff.js');
    // The real case: photo saved from one load, availability saved from a stale load
    const base   = { profile: { name: 'O', image: '' }, theme: { primary: '#334155' } };
    const local  = { profile: { name: 'O', image: '' }, theme: { primary: '#334155' }, availability: { enabled: true } };
    const remote = { profile: { name: 'O', image: 'images/profile-1.webp' }, theme: { primary: '#334155' } };
    const { merged, conflicts } = merge3(base, local, remote);
    assert.deepEqual(merged, { profile: { name: 'O', image: 'images/profile-1.webp' }, theme: { primary: '#334155' }, availability: { enabled: true } });
    assert.deepEqual(conflicts, []);
    // both changed the same value → the editor wins and it is reported
    const c = merge3({ a: 1, list: [1] }, { a: 2, list: [1] }, { a: 3, list: [1, 2] });
    assert.deepEqual(c.merged, { a: 2, list: [1, 2] });
    assert.deepEqual(c.conflicts, ['a']);
    // deletions in the editor survive when GitHub did not touch the key
    assert.deepEqual(merge3({ a: 1, b: 2 }, { a: 1 }, { a: 1, b: 2, c: 3 }).merged, { a: 1, c: 3 });
});

test('fonts: every option has its files, stacks put the Latin family first', async () => {
    const { FONTS, fontStack } = await import('../../js/fonts.js');
    const { readFile } = await import('node:fs/promises');
    const css = await readFile(new URL('../../src/vendor/fonts.css', import.meta.url), 'utf8');
    for (const f of [...FONTS.ar, ...FONTS.en].filter(f => f.family)) {
        assert.ok(css.includes(`font-family: '${f.family}'`), `${f.family} missing from fonts.css`);
    }
    assert.ok(/U\+0600-06FF/.test(css));
    assert.equal(fontStack({}), '"Tajawal", system-ui, sans-serif');
    assert.equal(fontStack({ ar: 'cairo', en: 'same' }), '"Cairo", system-ui, sans-serif');
    assert.equal(fontStack({ ar: 'cairo', en: 'inter' }), '"Inter", "Cairo", system-ui, sans-serif');
    assert.equal(fontStack({ ar: '"; x', en: 'nope' }), '"Tajawal", system-ui, sans-serif');
    const { applyFonts } = await import('../../scripts/assemble-site.mjs');
    const html = '<meta id="site-fonts" name="site-fonts" content="">';
    assert.equal(applyFonts(html, { fonts: { ar: 'cairo', en: 'inter' } }), '<meta id="site-fonts" name="site-fonts" content="&quot;Inter&quot;, &quot;Cairo&quot;, system-ui, sans-serif">');
    assert.match(applyFonts(html, {}), /content="&quot;Tajawal&quot;, system-ui, sans-serif"/);
});

test('prerender writes the CV into the page, escaped, without hidden sections or items', async () => {
    const { prerenderContent, applyJsonLd, applyVerification } = await import('../../scripts/prerender.mjs');
    const html = '<h1 class="x" data-path="profile.name"></h1><p data-path="profile.summary"></p>'
        + '<div id="experience-container" class="a"></div><div id="certificates-container"></div><div id="skills-container"></div>'
        + '<script type="application/ld+json">{"@type":"Person","image":"https://x/p.webp","sameAs":["https://github.com/OsamaAL-Harbi"]}</script>'
        + '<meta name="robots"   content="index, follow">';
    const data = {
        profile: { name: { ar: 'أسامة <b>', en: 'Osama' }, summary: { ar: 'نبذة', en: 'About' }, title: { ar: 'خريج', en: 'Graduate' }, linkedin: 'https://www.linkedin.com/in/x/' },
        experience: [{ role: { ar: 'متدرب', en: 'Trainee' }, company: { ar: 'جهة', en: 'Org' }, period: { ar: '2026', en: '2026' }, description: { ar: 'سطر 1\nسطر 2', en: '' } },
                     { role: { ar: 'مخفي', en: 'Hidden' }, hidden: true }],
        certificates: [{ name: { ar: 'شهادة', en: 'Cert </script>' }, issuer: { ar: 'IBM', en: 'IBM' }, credential: 'ID-1', url: 'javascript:alert(1)' }],
        skills: [{ ar: 'الشبكات', en: 'Networking', category: 'hard' }],
        visibility: { sections: ['skills'] },
        seo: { verify: { google: '<meta name="google-site-verification" content="abc_DEF-12345" />', bing: 'bad token!' } }
    };
    const out = prerenderContent(html, data);
    assert.match(out, /data-path="profile.name">أسامة &lt;b&gt;<\/h1>/);
    assert.match(out, /<div id="experience-container" class="a"><article.*متدرب.*جهة · 2026.*<li>سطر 1<\/li><li>سطر 2<\/li>/);
    assert.ok(!out.includes('مخفي'));
    assert.match(out, /<div id="skills-container"><\/div>/);           // hidden section stays empty
    const ld = applyJsonLd(out, data);
    const json = JSON.parse(ld.match(/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(json.name, 'Osama');
    assert.equal(json.image, 'https://x/p.webp');
    assert.equal(json.hasCredential[0].recognizedBy.name, 'IBM');
    assert.equal(json.hasCredential[0].url, undefined);
    assert.equal(json.knowsAbout, undefined);
    assert.deepEqual(json.sameAs, ['https://www.linkedin.com/in/x/', 'https://github.com/OsamaAL-Harbi']);
    assert.ok(!ld.includes('Cert </script>'));
    const verified = applyVerification(html, data);
    assert.match(verified, /<meta name="google-site-verification" content="abc_DEF-12345">/);
    assert.ok(!verified.includes('msvalidate'));
    assert.equal(applyVerification(html, {}), html);
});

test('markdown: a safe subset — everything escaped, only https/site links', async () => {
    const { renderMarkdown, readingMinutes } = await import('../../js/markdown.js');
    const html = renderMarkdown('## عنوان\n\nنص **عريض** و*مائل* و`<b>`\n\n- أ\n- ب\n\n1. one\n\n> quote\n\n```\n<script>x</script>\n```\n[ok](https://example.com) [bad](javascript:alert(1)) [site](blog/x.html)\n\n<img src=x onerror=alert(1)>');
    assert.match(html, /<h3 dir="auto">عنوان<\/h3>/);
    assert.match(html, /<strong>عريض<\/strong>/);
    assert.match(html, /<em>مائل<\/em>/);
    assert.match(html, /<code>&lt;b&gt;<\/code>/);
    assert.match(html, /<ul><li dir="auto">أ<\/li><li dir="auto">ب<\/li><\/ul>/);
    assert.match(html, /<ol><li dir="auto">one<\/li><\/ol>/);
    assert.match(html, /<blockquote dir="auto">quote<\/blockquote>/);
    assert.match(html, /<pre dir="ltr"><code>&lt;script&gt;x&lt;\/script&gt;<\/code><\/pre>/);
    assert.match(html, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">ok<\/a>/);
    assert.match(html, /<a href="blog\/x.html">site<\/a>/);
    assert.ok(!html.includes('javascript:'));
    assert.ok(!/<img|<script/.test(html));
    assert.equal(readingMinutes('word '.repeat(450)), 2);
});

test('pages: one per visible project and post, stable unique slugs', async () => {
    const { projectPages, postPages } = await import('../../js/pages.js');
    const data = {
        projects: [{ title: { ar: 'أ', en: 'Voice of Student' } }, { title: { ar: 'ب', en: 'Voice of Student' } }, { title: { ar: 'مخفي' }, hidden: true }, { title: { ar: 'عربي فقط' } }],
        posts: [{ title: { en: 'Old' }, date: '2025-01-01' }, { title: { en: 'New' }, date: '2026-05-01', slug: 'my-post' }]
    };
    assert.deepEqual(projectPages(data).map(p => [p.slug, p.index]), [['voice-of-student', 0], ['voice-of-student-2', 1], ['project-4', 3]]);
    assert.deepEqual(postPages(data).map(p => p.slug), ['my-post', 'old']);
    assert.deepEqual(postPages({ ...data, visibility: { sections: ['blog'] } }), []);
});

test('sitePages: project and article pages with their own meta, JSON-LD and sitemap entries', async () => {
    const { sitePages, addToSitemap } = await import('../../scripts/pages.mjs');
    const data = {
        profile: { name: { ar: 'أسامة', en: 'Osama' } },
        projects: [{ title: { ar: 'نظام <x>', en: 'System' }, desc: { ar: 'وصف', en: 'Desc' }, technologies: ['SQL'], link: 'https://github.com/u/r', liveUrl: 'javascript:alert(1)' }],
        posts: [{ title: { ar: 'مقال', en: 'Post' }, summary: { ar: 'ملخص' }, body: { ar: '## قسم\nنص', en: 'Text' }, date: '2026-10-01', tags: ['شبكات'] }]
    };
    const pages = sitePages(data);
    assert.deepEqual(pages.map(p => p.path), ['projects/system.html', 'blog/index.html', 'blog/post.html']);
    const project = pages[0].html;
    assert.match(project, /<title>نظام &lt;x&gt; \| أسامة<\/title>/);
    assert.match(project, /<link rel="canonical" href="https:\/\/osamaal-harbi.github.io\/CV\/projects\/system.html">/);
    assert.match(project, /script-src 'none'/);
    assert.ok(!project.includes('javascript:'));
    const ld = JSON.parse(project.match(/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(ld['@type'], 'SoftwareSourceCode');
    assert.equal(ld.codeRepository, 'https://github.com/u/r');
    const post = pages[2].html;
    assert.match(post, /<h3 dir="auto">قسم<\/h3>/);
    assert.match(post, /<meta name="description" content="ملخص">/);
    assert.equal(JSON.parse(post.match(/ld\+json">([\s\S]*?)<\/script>/)[1]).datePublished, '2026-10-01');
    assert.match(pages[1].html, /href="post.html"/);
    const xml = addToSitemap('<urlset>\n</urlset>', pages, '2026-10-11');
    assert.match(xml, /<loc>https:\/\/osamaal-harbi.github.io\/CV\/projects\/system.html<\/loc>\s*<lastmod>2026-10-11<\/lastmod>/);
    assert.match(xml, /<loc>https:\/\/osamaal-harbi.github.io\/CV\/blog\/post.html<\/loc>\s*<lastmod>2026-10-01<\/lastmod>/);
    assert.equal(sitePages({}).length, 0);
});

test('inlineEarlyScript: inlines js/early.js and allows exactly it by hash in the CSP', async () => {
    const { inlineEarlyScript } = await import('../../scripts/assemble-site.mjs');
    const { createHash } = await import('node:crypto');
    const html = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://cdn.example/; style-src 'self'">\n<script src="js/early.js"></script>`;
    const code = '(function () { document.documentElement.lang = "ar"; })();\n';
    const out = inlineEarlyScript(html, code);
    const hash = createHash('sha256').update(code).digest('base64');
    assert.ok(out.includes(`script-src 'self' 'sha256-${hash}' https://cdn.example/`));
    assert.ok(out.includes(`<script>${code}</script>`));
    assert.ok(!out.includes('src="js/early.js"'));
    assert.equal(inlineEarlyScript(html, 'x("</script>")'), html);      // never breaks out of the tag
    assert.equal(inlineEarlyScript('<p></p>', code), '<p></p>');
});

test('offline.html: strict CSP whose style hash matches its inline <style>', async () => {
    const { readFile } = await import('node:fs/promises');
    const { createHash } = await import('node:crypto');
    const html = await readFile(new URL('../../offline.html', import.meta.url), 'utf8');
    const style = html.match(/<style>([\s\S]*?)<\/style>/)[1];
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    assert.match(csp, /default-src 'none'/);
    assert.ok(csp.includes(`'sha256-${createHash('sha256').update(style).digest('base64')}'`), 'update the style hash in offline.html');
    assert.ok(!/<script/i.test(html));
});

test('project pages: headings never skip a level (h1 → h2, then English h2 → h3)', async () => {
    const { sitePages } = await import('../../scripts/pages.mjs');
    const data = { projects: [{ title: { ar: 'أ', en: 'A' }, desc: { ar: 'و', en: 'd' }, technologies: ['SQL'], details: { challenges: { ar: 'ت', en: 'c' }, results: { ar: 'ن', en: 'r' } } }] };
    const levels = [...sitePages(data)[0].html.matchAll(/<h([1-6])\b/g)].map(m => Number(m[1]));
    levels.forEach((l, i) => assert.ok(i === 0 ? l === 1 : l <= levels[i - 1] + 1, `h${levels[i - 1]} → h${l}`));
});

test('deploy: a crafted profile image cannot break out of the JSON-LD script', async () => {
    const { applySeo, applyProfileImage } = await import('../../scripts/assemble-site.mjs');
    const { applyJsonLd } = await import('../../scripts/prerender.mjs');
    const { readFile } = await import('node:fs/promises');
    const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
    for (const image of ['https://x.example/a"</script><meta http-equiv="refresh" content="0;url=https://evil.example/"><script>',
                         'https://x.example/a\\"</script><meta http-equiv="refresh">', 'https://x.example/</script>']) {
        const data = { profile: { image } };
        const out = applyJsonLd(applyProfileImage(applySeo(html, data), data), data);
        assert.ok(!/<meta http-equiv="refresh"/.test(out), image);
        assert.equal(out.match(/<\/script>/g).length, html.match(/<\/script>/g).length);
    }
    assert.throws(() => applyJsonLd('<script type="application/ld+json">{"broken": </script>', {}), /not valid JSON/);
});

test('markdown: emphasis never alters link addresses', async () => {
    const { renderMarkdown } = await import('../../js/markdown.js');
    const html = renderMarkdown('[a](https://x/*) [b](https://y/*) and [**c**](blog/x.html)');
    assert.match(html, /href="https:\/\/x\/\*"/);
    assert.match(html, /href="https:\/\/y\/\*"/);
    assert.match(html, /<a href="blog\/x.html"><strong>c<\/strong><\/a>/);
});

test('timeline: start dates from the CV texts, oldest first, hidden things left out', async () => {
    const { parseStart, timelineEntries } = await import('../../js/timeline-data.js');
    assert.deepEqual(parseStart({ ar: 'يناير 2026 - حاضر', en: 'January 2026 – Present' }), { year: 2026, month: 1 });
    assert.deepEqual(parseStart('April 2024 (5 hours)'), { year: 2024, month: 4 });
    assert.deepEqual(parseStart({ en: '2023 – 2024' }), { year: 2023, month: 0 });
    assert.equal(parseStart(''), null);
    const data = {
        experience: [{ role: { ar: 'متدرب' }, period: { en: 'January 2026 – Present' } }, { role: { ar: 'بلا تاريخ' }, period: { en: '' } }],
        education: [{ degree: { ar: 'بكالوريوس' }, period: { en: 'January 2026' } }],
        certificates: [{ name: { ar: 'شهادة' }, date: 'January 2025' }, { name: { ar: 'مخفية' }, date: 'May 2020', hidden: true }],
        workshops: [{ name: { ar: 'ورشة' }, date: { en: 'April 2024 (5 hours)' } }],
        volunteer: [{ role: { ar: 'تطوع' }, period: { en: 'August 2025' } }],
        visibility: { sections: ['volunteer'] }
    };
    const entries = timelineEntries(data);
    assert.deepEqual(entries.map(e => `${e.type}:${e.index}`), ['workshops:0', 'certificates:0', 'experience:0', 'education:0']);
    assert.equal(entries[2].ongoing, true);
});
