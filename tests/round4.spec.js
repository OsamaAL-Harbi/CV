import { readFileSync } from 'node:fs';
import { test, expect, openSite } from './fixtures.js';

// The real data.json without the owner's display settings, which change whenever they are edited in the admin panel
const DATA = (({ visibility, fonts, scrollbar, motion, cursor, skillsStyle, ...rest }) => rest)(JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8')));
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

test.describe('fixes from the review', () => {
    test('the skip link moves focus to the content and never opens the 404 view', async ({ page, isMobile }) => {
        test.skip(isMobile, 'keyboard navigation');
        await serve(page, clone());
        await openSite(page);
        await page.keyboard.press('Tab');
        await expect(page.locator('.skip-link')).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator('#main')).toBeFocused();
        await expect(page.locator('#home')).toBeVisible();
        await expect(page.locator('#not-found')).toBeHidden();
        expect(await page.title()).not.toMatch(/غير موجودة|Not Found/);
        await page.goto('./#main');                                   // a shared #main link shows the home page
        await expect(page.locator('#home')).toBeVisible();
    });

    test('the not-found view is marked noindex and keeps its title in the other language', async ({ page }) => {
        await serve(page, clone());
        await page.goto('./?lang=en#nope');
        await expect(page).toHaveTitle(/Page Not Found/);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
        await page.locator('#lang-btn').click();
        await expect(page).toHaveTitle(/الصفحة غير موجودة/);
        await page.evaluate(() => { location.hash = 'resume'; });
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    });

    test('home stats follow hidden sections and say "1 Project"', async ({ page }) => {
        const data = clone();
        data.projects = [data.projects[0]];
        data.visibility = { sections: ['certificates'] };
        await serve(page, data);
        await page.goto('./?lang=en');
        await expect(page.locator('[data-stat="projects"]')).toHaveText('1');
        await expect(page.locator('.stat-card:has([data-stat="projects"]) [data-lang^="stat_projects"]')).toHaveText('Project');
        await expect(page.locator('.stat-card:has([data-stat="certificates"])')).toBeHidden();
    });

    test('the project editor leaves a missing English translation empty', async ({ page }) => {
        const data = clone();
        data.projects[0].desc = { ar: 'وصف عربي', en: '' };
        data.projects[0].details = { ...(data.projects[0].details || {}), challenges: { ar: 'تحدي', en: '' } };
        await serve(page, data);
        await openSite(page);
        await login(page, data);
        await page.evaluate(() => { location.hash = 'portfolio'; });
        await page.locator('#projects-container .sortable-item').first().hover();
        await page.locator('#projects-container [data-action="edit-item"]').first().click();
        await expect(page.locator('#pj-desc-en')).toHaveValue('');
        await page.locator('.swal2-confirm').click();
        const saved = (await state(page)).projects[0];
        expect(saved.desc).toEqual({ ar: 'وصف عربي', en: '' });
        expect(saved.details.challenges.en).toBe('');
    });
});

test.describe('new features', () => {
    test('certificates in progress or planned: labelled, not counted, not on the timeline, not verified', async ({ page }) => {
        const data = clone();
        data.certificates = [
            { name: { ar: 'شهادة أ', en: 'Cert A' }, issuer: { ar: 'جهة', en: 'Org' }, date: 'May 2025' },
            { name: { ar: 'سي سي إن إيه', en: 'CCNA' }, issuer: { ar: 'سيسكو', en: 'Cisco' }, date: 'June 2026', status: 'in-progress', url: 'https://example.com/v' },
            { name: { ar: 'أزور', en: 'AZ-900' }, issuer: { ar: 'مايكروسوفت', en: 'Microsoft' }, date: 'December 2026', status: 'planned' }
        ];
        await serve(page, data);
        await page.goto('./?lang=en#resume');
        const cards = page.locator('#certificates-container > div');
        await expect(cards).toHaveCount(3);
        await expect(cards.nth(1).locator('.cert-status')).toHaveText('In progress');
        await expect(cards.nth(1)).toContainText('Target: ');
        await expect(cards.nth(1).locator('.cert-verified')).toHaveCount(0);       // nothing to verify yet
        await expect(cards.nth(2).locator('.cert-status')).toHaveText('Planned');
        await expect(cards.nth(0).locator('.cert-status')).toHaveCount(0);
        await expect(page.locator('#timeline-track')).not.toContainText('CCNA');
        await page.evaluate(() => { location.hash = 'home'; });
        await expect(page.locator('[data-stat="certificates"]')).toHaveText('1');
    });

    test('availability badge shows a "Book a call" link for an https booking page only', async ({ page }) => {
        const data = clone();
        data.availability = { enabled: true, status: { ar: 'متاح للعمل', en: 'Open to work' }, booking: 'https://calendly.com/example/15min' };
        await serve(page, data);
        await page.goto('./?lang=en');
        const book = page.locator('#availability-book');
        await expect(book).toBeVisible();
        await expect(book).toHaveAttribute('href', 'https://calendly.com/example/15min');
        await expect(book).toHaveText('Book a call');
        data.availability.booking = 'javascript:alert(1)';
        await page.reload();
        await expect(page.locator('#availability-badge')).toBeVisible();
        await expect(book).toBeHidden();
    });

    test('skills as levels or tags, picked in admin with a live preview', async ({ page }) => {
        const data = clone();
        data.skills = [
            { ar: 'الشبكات', en: 'Networking', level: 30, category: 'hard' },
            { ar: 'ويندوز', en: 'Windows', level: 90, category: 'hard' }
        ];
        await serve(page, { ...data, skillsStyle: 'levels' });
        await page.goto('./?lang=en#resume');
        const items = page.locator('#skills-container .skill-item');
        await expect(items.nth(0)).toContainText('Beginner');
        await expect(items.nth(1)).toContainText('Expert');
        await expect(page.locator('#skills-container .skill-bar-fill')).toHaveCount(0);

        await login(page, data);                                        // GitHub copy: bars (no skillsStyle)
        await page.evaluate(() => { location.hash = 'resume'; });
        await expect(page.locator('#skills-container .skill-bar-fill')).toHaveCount(2);
        await tool(page, 'عرض المهارات');
        await page.locator('input[name="skills-style"][value="tags"]').check();
        await expect(page.locator('#skills-container')).toHaveAttribute('data-skills-style', 'tags');
        await expect(page.locator('#skills-container .skill-item')).toHaveText(['Networking', 'Windows'].map(n => new RegExp(n)));
        await page.locator('.swal2-cancel').click();
        await expect(page.locator('#skills-container')).toHaveAttribute('data-skills-style', 'bars');
        await tool(page, 'عرض المهارات');
        await page.locator('input[name="skills-style"][value="levels"]').check();
        await page.locator('.swal2-confirm').click();
        expect((await state(page)).skillsStyle).toBe('levels');
    });

    test('a 404 page for addresses that do not exist under /CV/', async ({ page }) => {
        await page.goto('./404.html');
        await expect(page.locator('h1')).toHaveText('الصفحة غير موجودة');
        await expect(page.locator('a[href="/CV/"]')).toBeVisible();
        await expect(page.locator('nav a')).toHaveCount(3);
    });
});
