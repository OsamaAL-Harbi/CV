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

test.describe('achievements in numbers and job readiness', () => {
    test('rendered from data.json, hidden for visitors when empty, edited in admin', async ({ page }) => {
        const data = clone();
        data.highlights = [{ value: '30+', label: { ar: 'مستنداً', en: 'documents reviewed' } }];
        data.readiness = [
            { title: { ar: 'المراقبة', en: 'Monitoring' }, evidence: { ar: 'PRTG', en: 'PRTG with 11 sensors' }, link: 'projects/network-monitoring-ticketing-lab.html' },
            { title: { ar: 'خطر', en: 'Bad link' }, evidence: { ar: 'x', en: 'x' }, link: 'javascript:alert(1)' }
        ];
        await serve(page, data);
        await page.goto('./?lang=en');
        await expect(page.locator('#highlights-container > div')).toHaveCount(1);
        await expect(page.locator('#highlights-container')).toContainText('30+');
        await expect(page.locator('#highlights-container')).toContainText('documents reviewed');
        await page.evaluate(() => { location.hash = 'resume'; });
        const items = page.locator('#readiness-container > div');
        await expect(items).toHaveCount(2);
        await expect(items.nth(0).locator('a')).toHaveAttribute('href', 'projects/network-monitoring-ticketing-lab.html');
        await expect(items.nth(1).locator('a')).toHaveCount(0);            // unsafe evidence link dropped
        // Empty lists: the sections disappear for visitors
        data.highlights = []; data.readiness = [];
        await page.reload();
        await expect(page.locator('[data-section="readiness"]')).toBeHidden();
        await page.evaluate(() => { location.hash = 'home'; });
        await expect(page.locator('[data-section="highlights"]')).toBeHidden();
    });

    test('admin adds a readiness point; a bad evidence link is refused', async ({ page }) => {
        await serve(page, clone());
        await openSite(page);
        await login(page, clone());
        await page.evaluate(() => { location.hash = 'resume'; });
        await page.locator('[data-section="readiness"] [data-action="add-item"]').click();
        await page.locator('#swal-title-en').fill('Shift work');
        await page.locator('#swal-link').fill('ftp://x');
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('.swal2-validation-message')).toContainText('رابط الدليل');
        await page.locator('#swal-link').fill('#contact');
        await page.locator('.swal2-confirm').click();
        const saved = (await state(page)).readiness.at(-1);
        expect(saved.title.en).toBe('Shift work');
        expect(saved.link).toBe('#contact');
    });
});

test.describe('recruiter summary', () => {
    test('copies a short summary in the page language and offers WhatsApp', async ({ page, browserName }) => {
        test.skip(browserName !== 'chromium');
        await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
        await serve(page, clone());
        await page.goto('./?lang=en#contact');
        await page.locator('[data-action="copy-summary"]').click();
        const text = await page.evaluate(() => navigator.clipboard.readText());
        const lines = text.split('\n');
        expect(lines[0]).toBe(`${DATA.profile.name.en} — ${DATA.profile.title.en}`);
        expect(text).toContain('Availability: ');
        expect(text).toContain(DATA.profile.email);
        expect(text).toMatch(/Portfolio & CV: https:\/\/osamaal-harbi\.github\.io\/CV\//);
        expect(text).not.toContain('CCNA');                                  // planned certificates are not claimed
        await page.context().route(/^https:\/\/(wa\.me|api\.whatsapp\.com)\//, route => route.fulfill({ status: 200, body: 'ok' }));
        const popup = page.waitForEvent('popup');
        await page.locator('[data-action="share-summary"]').click();
        expect((await popup).url()).toMatch(/^https:\/\/(wa\.me|api\.whatsapp\.com)\//);
    });
});

test.describe('Credly badges and articles from LinkedIn', () => {
    test('a Credly badge link shows on its certificate and counts as verified; other hosts are ignored', async ({ page }) => {
        const data = clone();
        data.certificates = [
            { name: { ar: 'سي', en: 'CCNA' }, issuer: { ar: 'سيسكو', en: 'Cisco' }, date: 'May 2027', badge: 'https://www.credly.com/badges/1a2b3c4d-1234-5678-9abc-def012345678' },
            { name: { ar: 'ب', en: 'B' }, issuer: { ar: 'ب', en: 'B' }, date: 'May 2026', badge: 'https://evil.example/badges/x' }
        ];
        await serve(page, data);
        await page.goto('./?lang=en#resume');
        const first = page.locator('#certificates-container > div').first();
        await expect(first.locator('a[href^="https://www.credly.com/badges/"]')).toHaveCount(1);
        await expect(page.locator('#certs-verified')).toHaveText('1 verified');
        await expect(page.locator('#certificates-container > div').nth(1).locator('a[href*="evil"]')).toHaveCount(0);
    });

    test('the LinkedIn posts are articles on the portfolio page', async ({ page }) => {
        await serve(page, clone());
        await page.goto('./?lang=en#portfolio');
        await expect(page.locator('#posts-container > article')).toHaveCount(DATA.posts.length);
        await expect(page.locator('#posts-container')).toContainText('Saudi Council of Engineers');
    });
});

test.describe('import from LinkedIn (admin only)', () => {
    test('reads the LinkedIn data export, previews, and applies only the chosen sections', async ({ page }) => {
        await serve(page, clone());
        await openSite(page);
        await expect(page.locator('[data-tool]')).toHaveCount(0);           // nothing for visitors
        await login(page, clone());
        await tool(page, 'استيراد من LinkedIn');
        await expect(page.locator('.swal2-confirm')).toBeDisabled();
        await page.locator('#li-file').setInputFiles(new URL('./fixtures/linkedin-export.zip', import.meta.url).pathname);
        await expect(page.locator('#li-status')).toContainText('قُرئت 5 ملفات');
        await expect(page.locator('[data-li-section="skills"]')).not.toBeChecked();     // opt-in
        await expect(page.locator('[data-li-section="experience"]')).toBeChecked();
        await expect(page.locator('#li-preview')).toContainText('Digital Transformation Specialist');
        for (const s of ['summary', 'certificates', 'languages']) await page.locator(`[data-li-section="${s}"]`).uncheck();
        await page.locator('.swal2-confirm').click();
        const after = await state(page);
        expect(after.experience.map(e => e.role.en)).toEqual(['Digital Transformation Specialist', '']);
        expect(after.experience[1].role.ar).toBe('شبكات');
        expect(after.certificates).toEqual(DATA.certificates);              // not chosen: untouched
        expect(after.profile.summary).toEqual(DATA.profile.summary);
    });
});
