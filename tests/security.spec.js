import { readFileSync } from 'node:fs';
import { test, expect, openSite } from './fixtures.js';

const PAYLOAD = '<img src=x onerror="window.__xss=(window.__xss||0)+1">';

function maliciousData() {
    const data = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
    data.profile.name.ar = PAYLOAD;
    data.profile.title.ar = PAYLOAD;
    data.profile.linkedin = 'javascript:window.__xss=99';
    data.experience[0].role.ar = PAYLOAD;
    data.experience[0].description.ar = '"><script>window.__xss=1</script>';
    data.projects[0].title.ar = PAYLOAD;
    data.projects[0].technologies.push("x');window.__xss=1;('", PAYLOAD);
    data.projects[0].link = 'javascript:window.__xss=5';
    data.projects[0].liveUrl = 'javascript:window.__xss=6';
    data.skills[0].ar = PAYLOAD;
    data.skills[0].level = '50"><img src=x onerror=window.__xss=1>';
    data.certificates[0].credential = PAYLOAD;
    data.volunteer[0].hours = PAYLOAD;
    return data;
}

test('values from data.json are rendered as text, never as HTML', async ({ page }) => {
    await page.route('**/data.json*', route => route.fulfill({ json: maliciousData() }));
    await openSite(page);
    for (const id of ['resume', 'portfolio']) {
        await page.evaluate(h => { location.hash = h; }, id);
        await expect(page.locator(`#${id}`)).toBeVisible();
    }
    await page.locator('#projects-container [data-action="open-project"]').first().click();
    await expect(page.locator('#modal-github-link')).toBeHidden();      // javascript: link dropped
    await expect(page.locator('#modal-live-link')).toBeHidden();
    await expect(page.locator('main img:not(#profile-img), #project-modal img')).toHaveCount(0);
    await expect(page.locator('[data-path="profile.name"]')).toHaveText(PAYLOAD);
    await page.keyboard.press('Escape');
    await page.evaluate(() => { location.hash = 'contact'; });
    await page.locator('[data-action="contact"][data-contact="linkedin"]').click();
    expect(await page.evaluate(() => window.__xss || 0)).toBe(0);
});

test.describe('admin session', () => {
    const TOKEN = 'github_pat_TEST_ONLY_not_a_real_token';

    test.beforeEach(async ({ page }) => {
        await page.route('https://api.github.com/**', route => route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } }));
    });

    async function login(page) {
        await openSite(page);
        for (let i = 0; i < 3; i++) await page.locator('#secret-trigger').click();
        await expect(page.locator('#admin-modal')).toBeVisible();
        await expect(page.locator('#admin-modal')).toContainText('Fine-grained PAT');
        await page.locator('#token-input').fill(TOKEN);
        await page.locator('[data-action="login"]').click();
        await expect(page.locator('#admin-toolbar')).toBeVisible();
    }

    test('keeps the token in sessionStorage only and clears it on logout', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('saved_token', 'legacy-token'));
        await login(page);
        const stored = await page.evaluate(() => ({
            session: sessionStorage.getItem('gh_token'),
            local: Object.keys(localStorage).filter(k => localStorage.getItem(k)?.includes('github_pat_') || /token|backup/.test(k)),
            field: document.getElementById('token-input').value
        }));
        expect(stored.session).toBe(TOKEN);
        expect(stored.local).toEqual([]);
        expect(stored.field).toBe('');

        await page.locator('[data-action="logout"]').click();
        await page.waitForLoadState('load');
        await expect(page.locator('#admin-toolbar')).toBeHidden();
        expect(await page.evaluate(() => sessionStorage.getItem('gh_token'))).toBeNull();
    });

    test('expires the session after one hour', async ({ page }) => {
        await login(page);
        await page.evaluate(() => sessionStorage.setItem('gh_login_time', String(Date.now() - 2 * 60 * 60 * 1000)));
        await page.reload();
        await expect(page.locator('#admin-toolbar')).toBeHidden();
        expect(await page.evaluate(() => sessionStorage.getItem('gh_token'))).toBeNull();
    });

    test('when the session expires, unsaved edits stay and the login dialog reopens', async ({ page }) => {
        await page.clock.install();
        await login(page);
        const name = page.locator('[data-path="profile.name"]');
        await name.click();
        await page.keyboard.press('End');
        await page.keyboard.type(' (edited)');
        await page.locator('#year').click();          // blur → saved into the in-memory data
        await page.clock.fastForward('01:01:00');
        await expect(page.locator('#admin-modal')).toBeVisible();
        await expect(name).toContainText('(edited)');
        expect(await page.evaluate(() => sessionStorage.getItem('gh_token'))).toBeNull();
        await page.locator('#token-input').fill(TOKEN);   // logging in again resumes the session
        await page.locator('[data-action="login"]').click();
        await expect(page.locator('#admin-modal')).toBeHidden();
        await expect(name).toContainText('(edited)');
    });

    test('loads SweetAlert2 on demand for the editors', async ({ page }) => {
        await login(page);
        await page.locator('#admin-toolbar [data-action="manage-profile"]').click();
        await expect(page.locator('.swal2-popup')).toBeVisible();
        await expect(page.locator('#pf-name-ar')).not.toHaveValue('');
    });
});
