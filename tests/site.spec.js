import { test, expect, openSite } from './fixtures.js';

const SECTIONS = ['home', 'resume', 'portfolio', 'contact'];

test.describe('page load', () => {
    test('renders data.json content without console errors', async ({ page, consoleErrors }) => {
        await openSite(page);
        await expect(page.locator('#experience-container > div')).not.toHaveCount(0);
        await expect(page.locator('#projects-container > div')).not.toHaveCount(0);
        await page.waitForTimeout(500);   // let late errors (fonts, lazy work) surface
        expect(consoleErrors).toEqual([]);
    });

    test('ships a Content-Security-Policy and Referrer-Policy', async ({ page }) => {
        await page.goto('./');
        const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("object-src 'none'");
        expect(csp).not.toContain('unsafe-inline');
        expect(csp).not.toContain('unsafe-eval');
        await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'strict-origin-when-cross-origin');
    });

    test('heavy libraries are not loaded until needed', async ({ page }) => {
        await openSite(page);
        expect(await page.evaluate(() => ({
            jspdf: typeof window.jspdf, html2canvas: typeof window.html2canvas,
            swal: typeof window.Swal, sortable: typeof window.Sortable
        }))).toEqual({ jspdf: 'undefined', html2canvas: 'undefined', swal: 'undefined', sortable: 'undefined' });
    });
});

test.describe('language', () => {
    test('switches between Arabic (RTL) and English (LTR) and remembers the choice', async ({ page, consoleErrors }) => {
        await openSite(page);
        const html = page.locator('html');
        await expect(html).toHaveAttribute('dir', 'rtl');
        await expect(html).toHaveAttribute('lang', 'ar');
        const arabicName = await page.locator('[data-path="profile.name"]').innerText();

        await page.locator('#lang-btn').click();
        await expect(html).toHaveAttribute('dir', 'ltr');
        await expect(html).toHaveAttribute('lang', 'en');
        await expect(page.locator('[data-path="profile.name"]')).not.toHaveText(arabicName);
        await expect(page.locator('#lang-btn')).toHaveText('عربي');

        await page.reload();
        await expect(html).toHaveAttribute('dir', 'ltr');

        await page.locator('#lang-btn').click();
        await expect(html).toHaveAttribute('dir', 'rtl');
        await expect(page.locator('[data-path="profile.name"]')).toHaveText(arabicName);
        expect(consoleErrors).toEqual([]);
    });
});

test.describe('theme', () => {
    test('toggles dark mode and keeps it after reload', async ({ page }) => {
        await page.emulateMedia({ colorScheme: 'light' });
        await openSite(page);
        const html = page.locator('html');
        await expect(html).not.toHaveClass(/\bdark\b/);
        await page.locator('#theme-btn').click();
        await expect(html).toHaveClass(/\bdark\b/);
        await page.reload();
        await expect(html).toHaveClass(/\bdark\b/);
        await page.locator('#theme-btn').click();
        await expect(html).not.toHaveClass(/\bdark\b/);
    });
});

test.describe('navigation', () => {
    test('every section is reachable from the menu', async ({ page, consoleErrors, isMobile }) => {
        await openSite(page);
        for (const id of SECTIONS) {
            if (isMobile) {
                await page.locator('nav [data-action="toggle-menu"]').click();
                await page.locator(`#mobile-menu a[href="#${id}"]`).click();
                await expect(page.locator('#mobile-menu')).toHaveClass(/\bclosed\b/);
            } else {
                await page.locator(`#nav-${id}`).click();
            }
            await expect(page).toHaveURL(new RegExp(`#${id}$`));
            await expect(page.locator(`#${id}`)).toBeVisible();
            for (const other of SECTIONS.filter(s => s !== id)) await expect(page.locator(`#${other}`)).toBeHidden();
        }
        expect(consoleErrors).toEqual([]);
    });

    test('deep links open the right section and unknown hashes show 404', async ({ page }) => {
        await openSite(page, 'contact');
        await expect(page.locator('#contact')).toBeVisible();
        await expect(page).toHaveTitle(/تواصل|Contact/);
        await page.evaluate(() => { location.hash = 'does-not-exist'; });
        await expect(page.locator('#not-found')).toBeVisible();
        await page.locator('#not-found a[href="#home"]').click();
        await expect(page.locator('#home')).toBeVisible();
    });

    test('project modal opens and closes (button, backdrop, Escape)', async ({ page }) => {
        await openSite(page, 'portfolio');
        const modal = page.locator('#project-modal');
        const card  = page.locator('#projects-container [data-action="open-project"]').first();
        await card.click();
        await expect(modal).toBeVisible();
        await expect(page.locator('#modal-title')).not.toBeEmpty();
        await page.keyboard.press('Escape');
        await expect(modal).toBeHidden();
        await card.click();
        await modal.click({ position: { x: 5, y: 5 } });
        await expect(modal).toBeHidden();
        await card.click();
        await page.locator('[data-action="close-project-modal"]').click();
        await expect(modal).toBeHidden();
    });

    test('CV download links point to an existing PDF', async ({ page, request }) => {
        await openSite(page);
        const hrefs = await page.locator('a[download]').evaluateAll(as => [...new Set(as.map(a => a.getAttribute('href')))]);
        expect(hrefs.length).toBeGreaterThan(0);
        for (const href of hrefs) {
            const res = await request.get(href);
            expect(res.status(), href).toBe(200);
            expect(res.headers()['content-type']).toContain('pdf');
        }
    });
});

test.describe('service worker', () => {
    test('registers under /CV/ and precaches the app shell', async ({ page }) => {
        await openSite(page);
        // ready resolves while the worker may still be "activating"
        await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state)).toBe('activated');
        const sw = await page.evaluate(async () => {
            const reg = await navigator.serviceWorker.ready;
            const keys = await caches.keys();
            const shell = await caches.open(keys.find(k => /^portfolio-v\d+$/.test(k)));
            return { scope: reg.scope, state: reg.active?.state, keys, offline: !!(await shell.match('./offline.html')) };
        });
        expect(sw.scope).toMatch(/\/CV\/$/);
        expect(sw.state).toBe('activated');
        expect(sw.keys).toContain('portfolio-v4');
        expect(sw.offline).toBe(true);
    });

    test('serves the site and the offline page without network', async ({ page, context }) => {
        await openSite(page);
        await page.evaluate(() => navigator.serviceWorker.ready);
        await page.reload();                         // make sure this page is controlled
        await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
        // Simulate losing the network: every request to the site fails, so only the SW cache can answer.
        await context.route(/\/CV\//, route => route.abort('internetdisconnected'));
        await page.reload();
        await expect(page.locator('[data-path="profile.name"]')).not.toBeEmpty();
        await page.goto('./some/unknown/page.html');
        await expect(page.locator('body')).toContainText(/you are offline/i);
    });
});

test.describe('command palette', () => {
    test('generates a PDF, loading jsPDF and html2canvas only then', async ({ page, isMobile, consoleErrors }) => {
        test.skip(isMobile, 'keyboard shortcut (Ctrl+K) is a desktop feature');
        await openSite(page);
        expect(await page.evaluate(() => typeof window.jspdf)).toBe('undefined');
        await page.keyboard.press('Control+k');
        await expect(page.locator('#cmd-palette')).toBeVisible();
        await page.locator('#cmd-input').fill('PDF');
        const download = page.waitForEvent('download', { timeout: 30_000 });
        await page.locator('#cmd-list [data-action="run-command"]:visible').first().click();
        expect((await download).suggestedFilename()).toMatch(/_CV\.pdf$/);
        expect(await page.evaluate(() => typeof window.jspdf)).toBe('object');
        expect(consoleErrors).toEqual([]);
    });
});
