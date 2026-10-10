import { readFileSync } from 'node:fs';
import { test, expect, openSite } from './fixtures.js';

const DATA = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
const TOKEN = 'github_pat_TEST_ONLY';
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

async function login(page) {
    await openSite(page);
    for (let i = 0; i < 3; i++) await page.locator('#secret-trigger').click();
    await page.locator('#token-input').fill(TOKEN);
    await page.locator('[data-action="login"]').click();
    await expect(page.locator('#admin-toolbar')).toBeVisible();
}

const cssVar = (page, name) => page.evaluate(n => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

test.describe('theme colours', () => {
    test('admin picks a preset: live preview, contrast report, saved in data.json', async ({ page }) => {
        await page.route('https://api.github.com/**', route => route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } }));
        await login(page);
        const before = await cssVar(page, '--color-primary');
        await page.locator('#admin-toolbar [data-action="manage-theme"]').click();
        await expect(page.locator('#th-report li')).toHaveCount(5);
        await page.locator('[data-th-preset="1"]').click();                       // emerald / sky
        await expect.poll(() => cssVar(page, '--color-primary')).not.toBe(before);  // previewed on the page
        await expect(page.locator('#th-report')).not.toContainText('✗');
        await expect(page.locator('#th-adjusted')).toContainText('#059669');        // adjusted for contrast
        await page.locator('.swal2-confirm').click();
        expect(await page.evaluate(async () => (await import('./js/state.js')).state.appData.theme)).toEqual({ primary: '#059669', secondary: '#0ea5e9' });
    });

    test('cancel restores the previous colours', async ({ page }) => {
        await page.route('https://api.github.com/**', route => route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } }));
        await login(page);
        const before = await cssVar(page, '--color-primary');
        await page.locator('#admin-toolbar [data-action="manage-theme"]').click();
        await page.locator('[data-th-preset="4"]').click();
        await page.locator('.swal2-cancel').click();
        await expect.poll(() => cssVar(page, '--color-primary')).toBe(before);
    });

    test('a theme in data.json is applied, and cached for the first paint of the next visit', async ({ page }) => {
        await page.context().route('**/data.json*', route => route.fulfill({ json: { ...DATA, theme: { primary: '#dc2626', secondary: '#ea580c' } } }));
        await openSite(page);
        await expect.poll(() => cssVar(page, '--color-primary')).toBe('220 38 38');
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem('theme_vars'))['--primary-light'])).toBe('220 38 38');
        // next visit: applied by js/early.js before data.json arrives
        await page.context().route('**/data.json*', async route => { await new Promise(r => setTimeout(r, 1500)); route.fulfill({ json: { ...DATA, theme: { primary: '#dc2626', secondary: '#ea580c' } } }); });
        await page.reload({ waitUntil: 'domcontentloaded' });
        expect(await cssVar(page, '--color-primary')).toBe('220 38 38');
    });
});

test.describe('CV file', () => {
    test('uploads a PDF from the device into cv/ and links it', async ({ page }) => {
        const puts = [];
        await page.route('https://api.github.com/**', async route => {
            const req = route.request();
            if (req.url().includes('/contents/cv/')) {
                if (req.method() === 'PUT') { puts.push({ url: req.url(), body: JSON.parse(req.postData()) }); return route.fulfill({ status: 201, json: {} }); }
                return route.fulfill({ status: 404, json: { message: 'Not Found' } });
            }
            return route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } });
        });
        await login(page);
        await page.locator('#admin-toolbar [data-action="manage-profile"]').click();
        await page.locator('#pf-cv-file').setInputFiles({ name: 'سيرتي Osama CV 2026.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\n%test\n') });
        await expect(page.locator('#pf-cv')).toHaveValue('cv/Osama_CV_2026.pdf');
        await expect(page.locator('#pf-cv-status')).toContainText('✅');
        expect(puts).toHaveLength(1);
        expect(puts[0].url).toMatch(/\/contents\/cv\/Osama_CV_2026\.pdf$/);
        expect(Buffer.from(puts[0].body.content, 'base64').toString()).toContain('%PDF-1.7');
        expect(puts[0].body.sha).toBeUndefined();
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('[data-cv-link]').first()).toHaveAttribute('href', 'cv/Osama_CV_2026.pdf');
    });

    test('rejects files that are not PDFs', async ({ page }) => {
        await page.route('https://api.github.com/**', route => route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } }));
        await login(page);
        await page.locator('#admin-toolbar [data-action="manage-profile"]').click();
        await page.locator('#pf-cv-file').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('<html>not a pdf') });
        await expect(page.locator('#pf-cv-status')).toContainText('ليس PDF');
    });

    test('a Google Drive share link becomes a direct link that opens in a new tab', async ({ page }) => {
        await page.route('https://api.github.com/**', route => route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } }));
        await login(page);
        await page.locator('#admin-toolbar [data-action="manage-profile"]').click();
        await page.locator('#pf-cv-drive').click();
        await page.locator('#pf-cv').fill('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp_qR-stuv/view?usp=sharing');
        await page.locator('#pf-cv').blur();
        await expect(page.locator('#pf-cv')).toHaveValue('https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOp_qR-stuv');
        await page.locator('.swal2-confirm').click();
        const link = page.locator('[data-cv-link]').first();
        await expect(link).toHaveAttribute('href', /drive\.google\.com\/uc\?export=download/);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).not.toHaveAttribute('download', /.*/);
    });

    test('invalid CV links are refused', async ({ page }) => {
        await page.route('https://api.github.com/**', route => route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } }));
        await login(page);
        await page.locator('#admin-toolbar [data-action="manage-profile"]').click();
        await page.locator('#pf-cv').fill('javascript:alert(1)');
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('.swal2-validation-message')).toBeVisible();
    });
});

test.describe('statistics (Google Analytics)', () => {
    const GA = { propertyId: '123456789', clientId: 'test-client.apps.googleusercontent.com' };
    const report = (dims, rows) => ({ rows: rows.map(r => ({ dimensionValues: r.slice(0, dims).map(value => ({ value })), metricValues: r.slice(dims).map(v => ({ value: String(v) })) })) });

    async function stubGA(page, calls) {
        await page.context().route('https://analyticsdata.googleapis.com/**', async route => {
            const body = JSON.parse(route.request().postData());
            calls.push({ url: route.request().url(), auth: route.request().headers().authorization, body });
            if (route.request().url().endsWith(':runRealtimeReport')) return route.fulfill({ json: report(0, [[3]]) });
            const dims = (body.dimensions || []).map(d => d.name).join(',');
            const two = body.dateRanges.length === 2;
            const data = {
                '': report(1, [['date_range_0', 120, 150, 400, 0.62], ['date_range_1', 100, 130, 300, 0.5]]),
                date: report(1, Array.from({ length: 28 }, (_, i) => [`202609${String(i + 1).padStart(2, '0')}`, 3 + (i % 5), 10 + i])),
                pageTitle: report(1, [['السيرة الذاتية | أسامة الحربي', 90], ['Resume | Osama Al-Harbi', 30], ['أسامة الحربي | الرئيسية', 200]]),
                eventName: report(2, [['cv_download', 'date_range_0', 12], ['cv_download', 'date_range_1', 6], ['contact_whatsapp', 'date_range_0', 4]]),
                country: report(1, [['Saudi Arabia', 100], ['Egypt', 8]]),
                deviceCategory: report(1, [['mobile', 80], ['desktop', 40]]),
                sessionSource: report(1, [['(direct)', 70], ['linkedin.com', 40]]),
                'customEvent:project': { error: { message: 'Field customEvent:project is not a valid dimension.' } }
            }[dims];
            if (data?.error) return route.fulfill({ status: 400, json: data });
            expect(two).toBe(dims === '' || dims === 'eventName');
            return route.fulfill({ json: data });
        });
    }

    test('signs in with Google in a popup and shows live numbers for all visitors', async ({ page }) => {
        const calls = [];
        await page.context().route('**/data.json*', route => route.fulfill({ json: { ...DATA, analytics: GA } }));
        await page.route('https://api.github.com/**', route => route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } }));
        // Google's consent page, stubbed: redirect straight back to oauth.html with a token
        await page.context().route('https://accounts.google.com/**', route => {
            const u = new URL(route.request().url());
            expect(u.searchParams.get('client_id')).toBe(GA.clientId);
            expect(u.searchParams.get('response_type')).toBe('token');
            expect(u.searchParams.get('scope')).toBe(SCOPE);
            const back = `${u.searchParams.get('redirect_uri')}#access_token=ya29.test&expires_in=3599&token_type=Bearer&scope=${encodeURIComponent(SCOPE)}&state=${u.searchParams.get('state')}`;
            return route.fulfill({ status: 302, headers: { location: back } });
        });
        await stubGA(page, calls);
        await login(page);
        await page.locator('#admin-toolbar [data-action="analytics"]').click();
        const popupPromise = page.waitForEvent('popup');
        await page.locator('[data-st-signin]').click();
        const popup = await popupPromise;
        await popup.waitForEvent('close');

        const root = page.locator('#st-root');
        await expect(root).toContainText('الزوار');
        await expect(root.locator('.text-2xl').first()).toHaveText('120');
        await expect(root).toContainText('▲ 20%');                    // 120 vs 100 visitors
        await expect(root).toContainText('3 الآن');
        await expect(root).toContainText('تحميل السيرة الذاتية');
        await expect(root.locator('#st-chart polyline')).toHaveCount(1);
        await expect(root).toContainText('محادثة واتساب');
        // Arabic and English titles of the same section are added up
        const resume = root.locator('li', { hasText: 'السيرة الذاتية' }).first();
        await expect(resume).toContainText('120');
        expect(calls.every(c => c.auth === 'Bearer ya29.test')).toBe(true);
        expect(calls[0].url).toContain('/properties/123456789:');
        expect(await page.evaluate(() => sessionStorage.getItem('ga_token'))).toContain('ya29.test');
        // The token never reaches localStorage
        expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('ya29');
    });

    test('an expired token asks to sign in again', async ({ page }) => {
        await page.context().route('**/data.json*', route => route.fulfill({ json: { ...DATA, analytics: GA } }));
        await page.route('https://api.github.com/**', route => route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } }));
        await page.context().route('https://analyticsdata.googleapis.com/**', route => route.fulfill({ status: 401, json: { error: { message: 'expired' } } }));
        await login(page);
        await page.evaluate(() => sessionStorage.setItem('ga_token', JSON.stringify({ token: 'old', exp: Date.now() + 3600e3 })));
        await page.locator('#admin-toolbar [data-action="analytics"]').click();
        await expect(page.locator('[data-st-signin]')).toBeVisible();
        await expect(page.locator('#st-root')).toContainText('انتهت الجلسة');
        expect(await page.evaluate(() => sessionStorage.getItem('ga_token'))).toBeNull();
    });

    test('without settings it opens the setup guide and validates the IDs', async ({ page }) => {
        await page.route('https://api.github.com/**', route => route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } }));
        await login(page);
        await page.locator('#admin-toolbar [data-action="analytics"]').click();
        await expect(page.locator('.swal2-popup')).toContainText('oauth.html');
        await page.locator('#st-pid').fill('G-KE86NNMX3J');
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('.swal2-validation-message')).toBeVisible();
        await page.locator('#st-pid').fill('123456789');
        await page.locator('#st-cid').fill('abc.apps.googleusercontent.com');
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('[data-st-signin]')).toBeVisible();
        expect(await page.evaluate(async () => (await import('./js/state.js')).state.appData.analytics)).toEqual({ propertyId: '123456789', clientId: 'abc.apps.googleusercontent.com' });
    });
});

test.describe('tracking', () => {
    test('each section is a GA page view; clicks on CV and WhatsApp are events; nothing while admin', async ({ page }) => {
        await openSite(page);
        await page.evaluate(() => { location.hash = 'resume'; });
        await expect(page.locator('#resume')).toBeVisible();
        const events = () => page.evaluate(() => (window.dataLayer || []).filter(a => a[0] === 'event').map(a => [a[1], a[2]?.page_title || '']));
        await expect.poll(async () => (await events()).filter(e => e[0] === 'page_view').length).toBe(2);
        expect((await events()).find(e => e[0] === 'page_view' && /السيرة/.test(e[1]))).toBeTruthy();
        expect(await page.evaluate(() => (window.dataLayer || []).some(a => a[0] === 'config' && a[2]?.send_page_view === false))).toBe(true);

        await page.evaluate(() => { location.hash = 'contact'; });
        await page.locator('#contact-whatsapp').evaluate(a => a.addEventListener('click', e => e.preventDefault()));
        await page.locator('#contact-whatsapp').click();
        await expect.poll(async () => (await events()).some(e => e[0] === 'contact_whatsapp')).toBe(true);

        await page.route('https://api.github.com/**', route => route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } }));
        for (let i = 0; i < 3; i++) await page.locator('#secret-trigger').click();
        await page.locator('#token-input').fill(TOKEN);
        await page.locator('[data-action="login"]').click();
        await expect(page.locator('#admin-toolbar')).toBeVisible();
        const count = (await events()).length;
        await page.evaluate(() => { location.hash = 'portfolio'; });
        await expect(page.locator('#portfolio')).toBeVisible();
        await page.waitForTimeout(200);
        expect((await events()).length).toBe(count);
    });
});
