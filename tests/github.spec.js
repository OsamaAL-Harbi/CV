import { readFileSync } from 'node:fs';
import { test, expect, openSite } from './fixtures.js';

const read = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const DATA = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
const GH = JSON.parse(read('github.json'));
const STATUS = JSON.parse(read('status.json'));

function withSettings(extra = {}) {
    return {
        ...structuredClone(DATA),
        github: { user: 'OsamaAL-Harbi', repos: ['jobmatch', 'VOS'], calendar: true, languages: true, activity: true },
        monitor: [{ name: 'Portfolio', url: 'https://osamaal-harbi.github.io/CV/' }],
        ...extra
    };
}

// context.route also covers requests made by the service worker
async function serve(page, data, { gh = GH, status = STATUS } = {}) {
    const ctx = page.context();
    await ctx.route('**/data.json*', route => route.fulfill({ json: data }));
    await ctx.route('**/generated/github.json*', route => (gh ? route.fulfill({ json: gh }) : route.fulfill({ status: 404, body: '' })));
    await ctx.route('**/generated/status.json*', route => (status ? route.fulfill({ json: status }) : route.fulfill({ status: 404, body: '' })));
    await ctx.route('**/generated/readme/jobmatch.html*', route => route.fulfill({ body: read('readme-jobmatch.html'), contentType: 'text/html' }));
}

test.describe('GitHub section', () => {
    test('renders calendar, languages, repositories and activity from github.json', async ({ page, consoleErrors }) => {
        await serve(page, withSettings());
        await openSite(page, 'portfolio');
        const section = page.locator('#github-section');
        await expect(section).toBeVisible();
        await expect(page.locator('#github-calendar rect')).toHaveCount(GH.calendar.days.length);
        await expect(page.locator('#github-calendar-summary')).toContainText(GH.calendar.total.toLocaleString('en'));
        await expect(page.locator('#github-languages-legend li')).toHaveCount(2);
        await expect(page.locator('#github-repos article')).toHaveCount(2);
        await expect(page.locator('#github-repos article').first()).toContainText('jobmatch');
        await expect(page.locator('#github-repos article').nth(1)).toContainText('مؤرشف');
        // unsafe homepage dropped, unsafe colour replaced
        await expect(page.locator('#github-repos article').nth(1).locator('a[href^="javascript"]')).toHaveCount(0);
        expect(await page.locator('#github-repos article').nth(1).locator('[data-bg]').getAttribute('data-bg')).toBe('#9ca3af');
        // commit messages are text
        await expect(page.locator('#github-activity li')).toHaveCount(2);
        await expect(page.locator('#github-activity')).toContainText('<img src=x');
        expect(await page.evaluate(() => window.__xss || 0)).toBe(0);
        // RTL: the newest week is on the left
        const xs = await page.locator('#github-calendar rect').evaluateAll(r => [Number(r[0].getAttribute('x')), Number(r[r.length - 1].getAttribute('x'))]);
        expect(xs[0]).toBeGreaterThan(xs[1]);
        await page.locator('#lang-btn').click();
        await expect(page.locator('#github-title')).toContainText('My GitHub Activity');
        const ltr = await page.locator('#github-calendar rect').evaluateAll(r => [Number(r[0].getAttribute('x')), Number(r[r.length - 1].getAttribute('x'))]);
        expect(ltr[0]).toBeLessThan(ltr[1]);
        expect(consoleErrors).toEqual([]);
    });

    test('hidden, and github.json never requested, without settings in data.json', async ({ page }) => {
        const requested = [];
        page.on('request', r => { if (r.url().includes('/generated/')) requested.push(r.url()); });
        const { github, monitor, ...plain } = structuredClone(DATA);
        await serve(page, plain);
        await openSite(page, 'portfolio');
        await expect(page.locator('#projects-container > div')).not.toHaveCount(0);
        await expect(page.locator('#github-section')).toBeHidden();
        await expect(page.locator('#status-section')).toBeHidden();
        expect(requested).toEqual([]);
    });

    test('hidden when the workflow has not generated github.json yet', async ({ page }) => {
        await serve(page, withSettings(), { gh: null, status: null });
        await openSite(page, 'portfolio');
        await expect(page.locator('#projects-container > div')).not.toHaveCount(0);
        await page.waitForTimeout(300);
        await expect(page.locator('#github-section')).toBeHidden();
        await expect(page.locator('#status-section')).toBeHidden();
    });
});

test.describe('case study', () => {
    test('shows the README sanitized, deep-linkable, and closes back to #portfolio', async ({ page }) => {
        await serve(page, withSettings());
        await openSite(page, 'portfolio');
        await page.locator('#github-repos a[href="#portfolio/jobmatch"]').click();
        const modal = page.locator('#case-modal');
        await expect(modal).toBeVisible();
        await expect(page).toHaveURL(/#portfolio\/jobmatch$/);
        const body = page.locator('#case-body');
        await expect(body.locator('h1')).toHaveText('JobMatch');
        await expect(body.locator('script, style, iframe, form, input, svg')).toHaveCount(0);
        await expect(body.locator('[onerror], [onclick]')).toHaveCount(0);
        await expect(body.locator('a[href^="javascript"]')).toHaveCount(0);
        await expect(body.locator('a', { hasText: 'Usage' })).toHaveAttribute('href', 'https://github.com/OsamaAL-Harbi/jobmatch/blob/main/docs/USAGE.md');
        await expect(body.locator('a', { hasText: 'site' })).toHaveAttribute('rel', 'noopener noreferrer');
        const srcs = await body.locator('img').evaluateAll(imgs => imgs.map(i => i.getAttribute('src')));
        expect(srcs).toEqual([
            'https://raw.githubusercontent.com/OsamaAL-Harbi/jobmatch/main/docs/screen.png',
            'https://github.com/OsamaAL-Harbi/jobmatch/raw/main/logo.png'
        ]);
        await expect(body.locator('pre')).toHaveAttribute('dir', 'ltr');
        await expect(body.locator('td')).toHaveAttribute('align', 'center');
        expect(await page.evaluate(() => window.__xss || 0)).toBe(0);
        expect(await page.evaluate(() => getComputedStyle(document.body).display)).not.toBe('none');

        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden();
        await expect(page).toHaveURL(/#portfolio$/);

        await page.goto('./#portfolio/jobmatch');
        await expect(modal).toBeVisible();
        await expect(page.locator('#case-title')).toHaveText('jobmatch');
    });
});

test('system status shows each sensor with uptime and response time', async ({ page }) => {
    await serve(page, withSettings());
    await openSite(page, 'portfolio');
    await expect(page.locator('#status-section')).toBeVisible();
    const rows = page.locator('#status-sensors li');
    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toContainText('95%');            // 19 of 20 checks were up
    await expect(rows.first()).toContainText('412 ms');
    await expect(rows.nth(1)).toContainText('متوقف');
    await expect(page.locator('#status-summary')).toContainText('12');
});

test.describe('admin GitHub page', () => {
    test('picks and orders repositories, then saves them in data.json', async ({ page }) => {
        const puts = [];
        await page.route('https://api.github.com/**', async route => {
            const url = route.request().url();
            if (url.includes('/users/OsamaAL-Harbi/repos')) {
                return route.fulfill({ json: [
                    { name: 'jobmatch', description: 'Match CVs', language: 'Python', stargazers_count: 3, pushed_at: '2026-10-01T00:00:00Z' },
                    { name: 'VOS', description: '<b>bold</b>', language: 'PHP', stargazers_count: 0, archived: true, pushed_at: '2025-04-05T00:00:00Z' },
                    { name: 'test', description: null, fork: true, pushed_at: '2026-01-18T00:00:00Z' }
                ] });
            }
            if (url.endsWith('/contents/data.json')) {
                if (route.request().method() === 'PUT') { puts.push(JSON.parse(route.request().postData())); return route.fulfill({ json: {} }); }
                return route.fulfill({ json: { sha: 'abc', content: Buffer.from(JSON.stringify(DATA)).toString('base64') } });
            }
            return route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } });
        });
        await openSite(page);
        for (let i = 0; i < 3; i++) await page.locator('#secret-trigger').click();
        await page.locator('#token-input').fill('github_pat_TEST_ONLY');
        await page.locator('[data-action="login"]').click();
        await expect(page.locator('#admin-toolbar')).toBeVisible();

        await page.locator('#admin-toolbar [data-action="manage-github"]').click();
        await expect(page.locator('#gh-list li')).toHaveCount(3);
        await expect(page.locator('#gh-list')).toContainText('<b>bold</b>');      // shown as text
        await expect(page.locator('#gh-list b')).toHaveCount(0);
        await page.locator('[data-gh-toggle="jobmatch"]').check();
        await page.locator('[data-gh-toggle="VOS"]').check();
        await page.locator('[data-gh-move="VOS"][data-dir="-1"]').click();       // VOS first
        await page.locator('#gh-activity').uncheck();
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('.swal2-popup')).toBeHidden();
        expect(await page.evaluate(async () => (await import('./js/state.js')).state.appData.github))
            .toEqual({ user: 'OsamaAL-Harbi', repos: ['VOS', 'jobmatch'], calendar: true, languages: true, activity: false });

        await page.locator('#admin-toolbar [data-action="save"]').click();
        await expect(page.locator('.swal2-popup')).toContainText('GitHub');
        await page.locator('.swal2-confirm').click();
        await expect.poll(() => puts.length).toBe(1);
        const saved = JSON.parse(Buffer.from(puts[0].content, 'base64').toString('utf8'));
        expect(saved.github.repos).toEqual(['VOS', 'jobmatch']);
    });

    test('monitoring page accepts https sites only', async ({ page }) => {
        await page.route('https://api.github.com/**', route => route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } }));
        await openSite(page);
        for (let i = 0; i < 3; i++) await page.locator('#secret-trigger').click();
        await page.locator('#token-input').fill('github_pat_TEST_ONLY');
        await page.locator('[data-action="login"]').click();
        await page.locator('#admin-toolbar [data-action="manage-monitor"]').click();
        await expect(page.locator('[data-mon-url="0"]')).toHaveValue('https://osamaal-harbi.github.io/CV/');
        await page.locator('#mon-add').click();
        await page.locator('[data-mon-url="1"]').fill('http://insecure.example');
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('.swal2-validation-message')).toContainText('https://');
        await page.locator('[data-mon-url="1"]').fill('https://jobmatch.example/');
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('.swal2-popup')).toBeHidden();
        expect(await page.evaluate(async () => (await import('./js/state.js')).state.appData.monitor)).toEqual([
            { name: 'Portfolio (GitHub Pages)', url: 'https://osamaal-harbi.github.io/CV/' },
            { name: 'jobmatch.example', url: 'https://jobmatch.example/' }
        ]);
    });
});
