import { test as base, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

// Never send test traffic to the real analytics accounts.
const ANALYTICS = /^https:\/\/([\w-]+\.)*(googletagmanager\.com|google-analytics\.com|analytics\.google\.com|clarity\.ms|bing\.com|doubleclick\.net)\//;
// Optional: serve jsDelivr files from a local npm mirror when the CDN is unreachable
// (node scripts/mirror-cdn.mjs && CDN_MIRROR_DIR=.cdn-mirror npm test).
const MIRROR = process.env.CDN_MIRROR_DIR;
const TYPES = { '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

export const test = base.extend({
    context: async ({ context }, use) => {
        await context.route(ANALYTICS, route => route.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
        if (MIRROR) {
            await context.route(/^https:\/\/cdn\.jsdelivr\.net\/npm\//, async route => {
                const path = decodeURIComponent(new URL(route.request().url()).pathname.slice('/npm/'.length));
                try {
                    const body = await readFile(join(MIRROR, path));
                    await route.fulfill({ status: 200, body, contentType: TYPES[extname(path)] || 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' } });
                } catch {
                    await route.fulfill({ status: 404, body: 'not mirrored' });
                }
            });
            await context.route(/^https:\/\/fonts\.(googleapis|gstatic)\.com\//, route =>
                route.fulfill({ status: 200, contentType: 'text/css', body: '', headers: { 'Access-Control-Allow-Origin': '*' } }));
        }
        await use(context);
    },

    // Collects console errors, uncaught exceptions and CSP violations for the whole test.
    consoleErrors: async ({ page }, use) => {
        const errors = [];
        page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
        page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
        await use(errors);
    }
});

// Opens the site and waits until data.json has been rendered.
export async function openSite(page, hash = '') {
    await page.goto(hash ? `./#${hash}` : './');
    await expect(page.locator('#loading-screen')).toBeHidden();
    await expect(page.locator('[data-path="profile.name"]')).not.toBeEmpty();
}

export { expect };
