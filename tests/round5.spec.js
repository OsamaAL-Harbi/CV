import { readFileSync } from 'node:fs';
import { test, expect, openSite } from './fixtures.js';

// The real data.json without the owner's display settings, which change whenever they are edited in the admin panel
const DATA = (({ visibility, fonts, scrollbar, motion, cursor, skillsStyle, cvVersions, ...rest }) => rest)(JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8')));
const clone = () => structuredClone(DATA);
const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64');
const state = page => page.evaluate(async () => (await import('./js/state.js')).state.appData);
const serve = (page, data) => page.context().route('**/data.json*', route => route.fulfill({ json: data }));

async function login(page, data = DATA) {
    await page.route('https://api.github.com/**', route => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/contents/data.json')) return route.fulfill({ json: { sha: 'abc', content: b64(data) } });
        return route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } });
    });
    for (let i = 0; i < 3; i++) await page.locator('#secret-trigger').click();
    await page.locator('#token-input').fill('github_pat_TEST_ONLY');
    await page.locator('[data-action="login"]').click();
    await expect(page.locator('#admin-toolbar')).toBeVisible();
}
async function tool(page, label) {
    await page.locator('#admin-toolbar [data-action="open-tools"]').click();
    await page.locator('[data-tool]', { hasText: label }).click();
}

test.describe('layout and headings', () => {
    for (const lang of ['ar', 'en']) {
        test(`no page is wider than the screen, and each view has one main heading (${lang})`, async ({ page }) => {
            await serve(page, clone());
            await page.goto(`./?lang=${lang}`);
            for (const view of ['home', 'resume', 'portfolio', 'contact', 'nope']) {
                await page.evaluate(h => { location.hash = h; }, view);
                await page.waitForTimeout(150);
                expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${view} overflows`).toBeLessThanOrEqual(0);
                expect(await page.locator('main h1:visible').count(), `${view} h1`).toBe(1);
            }
        });
    }
});

test.describe('real-visitor speed measurements', () => {
    test('a web_vitals event goes to analytics when the page is hidden', async ({ page }) => {
        await serve(page, clone());
        await openSite(page);
        await page.locator('#lang-btn').click();                      // an interaction to measure
        await page.evaluate(() => {
            Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
            document.dispatchEvent(new Event('visibilitychange'));
        });
        const event = await page.evaluate(() => [...window.dataLayer].map(a => Array.from(a)).find(a => a[0] === 'event' && a[1] === 'web_vitals'));
        expect(event).toBeTruthy();
        expect(event[2]).toMatchObject({ page: 'home', lang: 'en' });
        expect(typeof event[2].cls).toBe('number');
        expect(event[2].cls_rating).toMatch(/good|needs-improvement|poor/);
    });
});

test.describe('intro video', () => {
    test('a thumbnail until clicked, then the privacy-enhanced YouTube player; nothing for other links', async ({ page }) => {
        const data = clone();
        data.profile.video = 'https://youtu.be/dQw4w9WgXcQ';
        await serve(page, data);
        await page.context().route(/i\.ytimg\.com|youtube-nocookie\.com/, route => route.fulfill({ status: 204, body: '' }));
        await openSite(page);
        const box = page.locator('#intro-video');
        await expect(box).toBeVisible();
        await expect(page.locator('#intro-video-thumb')).toHaveAttribute('src', 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
        await expect(box.locator('iframe')).toHaveCount(0);
        await page.locator('#intro-video-play').click();
        await expect(box.locator('iframe')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?autoplay=1/);
        data.profile.video = 'https://evil.example/watch?v=dQw4w9WgXcQ';
        await page.reload();
        await expect(page.locator('[data-path="profile.name"]')).not.toBeEmpty();
        await expect(box).toBeHidden();
    });
});

test.describe('CV per career track', () => {
    test('versions and the ATS page are listed under the resume heading; admin edits them', async ({ page }) => {
        const data = clone();
        data.cvVersions = [{ label: { ar: 'الشبكات', en: 'Networking' }, file: 'cv/net.pdf' }, { label: { ar: 'خارجي', en: 'Drive' }, file: 'https://drive.google.com/uc?export=download&id=abcdefghijk' }];
        await serve(page, data);
        await page.goto('./?lang=en#resume');
        const list = page.locator('#cv-versions');
        await expect(list).toBeVisible();
        await expect(list.locator('a')).toHaveText([/Networking/, /Drive/, /Plain-text \(ATS\)/]);
        await expect(list.locator('a').nth(0)).toHaveAttribute('download', '');
        await expect(list.locator('a').nth(1)).toHaveAttribute('target', '_blank');
        await expect(list.locator('a').nth(2)).toHaveAttribute('href', 'resume-ats.html');

        await login(page, clone());                                      // GitHub copy: no versions yet
        await expect(list).toBeHidden();
        await tool(page, 'نسخ السيرة الذاتية');
        await page.locator('[data-cv-row="1"] [data-cv="file"]').fill('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view');
        await page.locator('.swal2-confirm').click();
        expect((await state(page)).cvVersions).toEqual([{ label: { ar: 'الشبكات', en: 'Networking' }, file: 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOp' }]);
        await expect(list).toBeVisible();
    });
});

test.describe('labs, support cases and projects in the blog', () => {
    const posts = [
        { title: { ar: 'مقال', en: 'Article' }, body: { ar: 'نص' }, date: '2026-11-03' },
        { title: { ar: 'مختبر VLAN', en: 'VLAN lab' }, kind: 'lab', body: { ar: '## الهدف\n```\nshow vlan\n```' }, date: '2026-11-02', slug: 'vlan-lab' },
        { title: { ar: 'طابعة', en: 'Printer case' }, kind: 'case', body: { ar: '## المشكلة' }, date: '2026-11-01' }
    ];

    test('kind badges and filter chips on the portfolio page', async ({ page }) => {
        await serve(page, { ...clone(), posts });
        await page.goto('./?lang=en#portfolio');
        const cards = page.locator('#posts-container > article');
        await expect(cards).toHaveCount(3);
        await expect(page.locator('#posts-filters button')).toHaveText(['All', 'Article', 'Hands-on lab', 'Support case']);
        await expect(cards.nth(1).locator('.post-kind')).toHaveText('Hands-on lab');
        await page.locator('#posts-filters [data-filter="lab"]').click();
        await expect(cards).toHaveCount(1);
        await expect(cards.first()).toContainText('VLAN lab');
        await expect(page.locator('#posts-filters [data-filter="lab"]')).toHaveAttribute('aria-pressed', 'true');
    });

    test('a new lab starts from its template', async ({ page }) => {
        await serve(page, clone());
        await openSite(page);
        await login(page);
        await page.evaluate(() => { location.hash = 'portfolio'; });
        await page.locator('#blog-section [data-action="add-item"]').click();
        await page.locator('#swal-kind').selectOption('lab');
        await expect(page.locator('#swal-body-ar')).toHaveValue(/## الهدف/);
        await expect(page.locator('#swal-body-en')).toHaveValue(/## Goal/);
        await page.locator('#swal-kind').selectOption('case');                 // an untouched template follows the kind
        await expect(page.locator('#swal-body-ar')).toHaveValue(/## المشكلة/);
        await page.locator('#swal-body-ar').fill('نصي الخاص');
        await page.locator('#swal-kind').selectOption('project');              // typed text is never replaced
        await expect(page.locator('#swal-body-ar')).toHaveValue('نصي الخاص');
    });

    test('the article page has a Copy button on code blocks, under its CSP', async ({ page, consoleErrors, browserName }) => {
        test.skip(browserName !== 'chromium');
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
        const { sitePages } = await import('../scripts/pages.mjs');
        const pages = sitePages({ ...clone(), posts });
        await page.context().route(/\/CV\/blog\//, route => {
            const path = new URL(route.request().url()).pathname.replace('/CV/', '');
            const hit = pages.find(p => p.path === path);
            return hit ? route.fulfill({ body: hit.html, contentType: 'text/html' }) : route.fallback();
        });
        for (const css of ['site-fonts', 'site-cursor']) await page.context().route(`**/assets/css/${css}.css`, route => route.fulfill({ body: ':root{}', contentType: 'text/css' }));
        await page.goto('./blog/vlan-lab.html');
        const copy = page.locator('.readme pre .copy-code');
        await expect(copy).toHaveText('نسخ');
        await copy.click();
        await expect(copy).toHaveText('تم النسخ ✓');
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('show vlan');
        expect(consoleErrors).toEqual([]);
    });
});

test.describe('English page (en.html)', () => {
    test('opens in English and the language button moves between the two addresses', async ({ page }) => {
        const { englishPage, linkEnglishPage } = await import('../scripts/english-page.mjs');
        const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
        await serve(page, clone());
        await page.context().route(/\/CV\/(index\.html)?(\?[^#]*)?$/, route => route.fulfill({ body: linkEnglishPage(index), contentType: 'text/html' }));
        await page.context().route(/\/CV\/en\.html/, route => route.fulfill({ body: linkEnglishPage(englishPage(index, clone())), contentType: 'text/html' }));
        await page.goto('./en.html#resume');
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.locator('#resume [data-lang="sec_resume"]')).toHaveText('Resume');
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://osamaal-harbi.github.io/CV/en.html');
        await page.locator('#lang-btn').click();
        await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
        await expect(page).toHaveURL(/\/CV\/#resume$/);
        await page.locator('#lang-btn').click();
        await expect(page).toHaveURL(/\/CV\/en\.html#resume$/);
        await page.reload();
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
});
