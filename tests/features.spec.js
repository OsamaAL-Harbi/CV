import { readFileSync } from 'node:fs';
import { test, expect, openSite } from './fixtures.js';

const DATA = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(DATA);

test.describe('robustness', () => {
    test('still loads when the browser blocks site storage', async ({ page, consoleErrors }) => {
        await page.addInitScript(() => {
            for (const name of ['localStorage', 'sessionStorage']) {
                Object.defineProperty(window, name, { get() { throw new DOMException('blocked', 'SecurityError'); } });
            }
        });
        await openSite(page);
        await page.locator('#lang-btn').click();
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        expect(consoleErrors.filter(e => !/blocked/i.test(e))).toEqual([]);
    });

    test('shows an error with a retry button when data.json cannot be loaded', async ({ page }) => {
        await page.route('**/data.json*', route => route.fulfill({ status: 500, body: 'oops' }));
        await page.goto('./');
        await expect(page.locator('#loading-screen')).toBeHidden();
        await expect(page.locator('#load-error')).toBeVisible();
        await expect(page.locator('#load-error [data-action="retry-load"]')).toBeVisible();
    });

    test('without JavaScript a static card replaces the loading screen', async ({ browser }) => {
        const context = await browser.newContext({ javaScriptEnabled: false, baseURL: test.info().project.use.baseURL });
        const page = await context.newPage();
        await page.goto('./');
        await expect(page.locator('.noscript-card')).toBeVisible();
        await expect(page.locator('#loading-screen')).toBeHidden();
        await context.close();
    });
});

test.describe('language links', () => {
    test('?lang=en opens English, and switching keeps the URL, canonical and greeting in step', async ({ page }) => {
        await page.clock.setFixedTime(new Date('2026-10-10T09:00:00'));
        await page.goto('./?lang=en#resume');
        await expect(page.locator('html')).toHaveAttribute('lang', 'en');
        await expect(page.locator('#resume')).toBeVisible();
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://osamaal-harbi.github.io/CV/?lang=en');
        await expect(page.locator('#smart-greeting')).toHaveText(/Good Morning/);
        await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\?lang=en$/);

        await page.locator('#lang-btn').click();
        await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
        await expect(page).toHaveURL(/\/CV\/#resume$/);               // ?lang removed, hash kept
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://osamaal-harbi.github.io/CV/');
        await expect(page.locator('#smart-greeting')).toHaveText(/صباح الخير/);
        await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'ar_SA');
    });

    test('Arabic month names in the Arabic UI', async ({ page }) => {
        await openSite(page, 'resume');
        const firstDate = DATA.certificates.find(c => /^[A-Za-z]+ \d{4}$/.test(c.date)).date;
        const [, year] = firstDate.split(' ');
        await expect(page.locator('#certificates-container')).not.toContainText(firstDate);
        await expect(page.locator('#certificates-container')).toContainText(new RegExp(`[\\u0600-\\u06FF]+ ${year}`));
    });
});

test.describe('content rendering', () => {
    test('home stats are computed from data.json (no "2,026")', async ({ page }) => {
        await page.goto('./?lang=en');
        await expect(page.locator('#loading-screen')).toBeHidden();
        const year = Math.max(...JSON.stringify(DATA.education).match(/\b20\d{2}\b/g).map(Number));
        await expect(page.locator('[data-stat="certificates"]')).toHaveText(String(DATA.certificates.length));
        await expect(page.locator('[data-stat="graduationYear"]')).toHaveText(String(year));
        await expect(page.locator('[data-stat="projects"]')).toHaveText(String(DATA.projects.length));
    });

    test('multi-paragraph descriptions become lists and empty periods leave no empty badge', async ({ page }) => {
        const data = clone();
        data.experience[0].description.ar = 'سطر أول\n\nسطر ثانٍ\n\nسطر ثالث';
        data.experience[0].period = { ar: '', en: '' };
        await page.route('**/data.json*', route => route.fulfill({ json: data }));
        await openSite(page, 'resume');
        const first = page.locator('#experience-container > div').first();
        await expect(first.locator('li')).toHaveCount(3);
        await expect(first.locator('span.inline-block')).toHaveCount(0);
    });

    test('certificates show a verification link only for https URLs', async ({ page }) => {
        const data = clone();
        data.certificates[0].url = 'https://www.credly.com/badges/example';
        data.certificates[1].url = 'javascript:alert(1)';
        await page.route('**/data.json*', route => route.fulfill({ json: data }));
        await openSite(page, 'resume');
        const links = page.locator('#certificates-container a[target="_blank"]');
        await expect(links).toHaveCount(1);
        await expect(links.first()).toHaveAttribute('href', 'https://www.credly.com/badges/example');
    });

    test('printing includes both skill groups, then the tabs come back', async ({ page }) => {
        await openSite(page, 'resume');
        const hard = DATA.skills.filter(s => s.category === 'hard').length;
        const soft = DATA.skills.filter(s => s.category === 'soft').length;
        await expect(page.locator('#skills-container .skill-item')).toHaveCount(hard);
        await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')));
        await expect(page.locator('#skills-container .skill-item')).toHaveCount(hard + soft);
        await expect(page.locator('#skills-container .skill-bar-fill.animate')).toHaveCount(hard + soft);
        await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
        await expect(page.locator('#skills-container .skill-item')).toHaveCount(hard);
    });
});

test.describe('keyboard and dialogs', () => {
    test('project cards open with the keyboard; focus moves in and comes back', async ({ page }) => {
        await openSite(page, 'portfolio');
        const card = page.locator('#projects-container [data-action="open-project"]').first();
        await card.focus();
        await page.keyboard.press('Enter');
        await expect(page.locator('#project-modal')).toBeVisible();
        await expect(page.locator('[data-action="close-project-modal"]')).toBeFocused();
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => document.getElementById('project-modal').contains(document.activeElement))).toBe(true);
        await page.keyboard.press('Escape');
        await expect(page.locator('#project-modal')).toBeHidden();
        await expect(page.locator('#projects-container [data-action="open-project"]').first()).toBeFocused();
    });

    test('command palette: Arabic keyboard layout, fresh filter, arrows + Enter, backdrop', async ({ page, isMobile }) => {
        await openSite(page);
        const palette = page.locator('#cmd-palette');
        if (isMobile) {
            await page.locator('nav [data-action="open-cmd"]').click();
        } else {
            // Ctrl + the K key on an Arabic layout reports key "ن"
            await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ن', code: 'KeyK', ctrlKey: true, bubbles: true })));
        }
        await expect(palette).toBeVisible();
        await page.locator('#cmd-input').fill('portfolio');
        await expect(page.locator('#cmd-list .cmd-item:visible')).toHaveCount(1);
        await page.locator('#cmd-input').press('Enter');
        await expect(palette).toBeHidden();
        await expect(page.locator('#portfolio')).toBeVisible();

        await page.locator('nav [data-action="open-cmd"]').click();
        await expect(page.locator('#cmd-input')).toHaveValue('');
        await expect(page.locator('#cmd-list .cmd-item:visible')).not.toHaveCount(1);
        await page.locator('#cmd-input').fill('سيرة');                 // Arabic search works too
        await page.locator('#cmd-input').press('ArrowDown');
        await expect(page.locator('#cmd-list [aria-selected="true"]')).toHaveCount(1);
        await palette.click({ position: { x: 5, y: 5 } });
        await expect(palette).toBeHidden();
    });

    test('the mobile menu closes with Escape', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'mobile layout only');
        await openSite(page);
        const opener = page.locator('nav [data-action="toggle-menu"]');
        await opener.click();
        await expect(opener).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape');
        await expect(page.locator('#mobile-menu')).toHaveClass(/\bclosed\b/);
        await expect(opener).toHaveAttribute('aria-expanded', 'false');
    });
});

test('downloads a vCard built from data.json', async ({ page }) => {
    await openSite(page, 'contact');
    const download = page.waitForEvent('download');
    await page.locator('[data-action="download-vcard"]').click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/\.vcf$/);
    const text = readFileSync(await file.path(), 'utf8');
    expect(text).toMatch(/^BEGIN:VCARD\r\nVERSION:3\.0\r\n/);
    expect(text).toContain(`EMAIL;TYPE=INTERNET:${DATA.profile.email}`);
    expect(text).toContain(`FN:${DATA.profile.name.ar}`);
    expect(text).toContain('URL:https://osamaal-harbi.github.io/CV/');
    expect(text.trimEnd()).toMatch(/END:VCARD$/);
});

test('WhatsApp card opens wa.me with the number from data.json and a greeting', async ({ page }) => {
    await openSite(page, 'contact');
    const card = page.locator('#contact-whatsapp');
    await expect(card).toBeVisible();
    const href = new URL(await card.getAttribute('href'));
    expect(href.origin + href.pathname).toBe(`https://wa.me/${DATA.profile.phone.replace(/\D/g, '')}`);
    expect(href.searchParams.get('text')).toContain('مرحباً');
    await expect(card).toHaveAttribute('rel', /noopener/);
    await page.locator('#lang-btn').click();
    expect(new URL(await card.getAttribute('href')).searchParams.get('text')).toMatch(/^Hello /);

    const data = clone();
    data.profile.phone = '';
    // context.route: once the service worker controls the page, it makes the data.json request
    await page.context().route('**/data.json*', route => route.fulfill({ json: data }));
    await page.reload();
    await expect(page.locator('#loading-screen')).toBeHidden();
    await expect(card).toBeHidden();
});
