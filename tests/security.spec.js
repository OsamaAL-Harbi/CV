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
        await expect(page.locator('#loading-screen')).toBeHidden();
        await expect.poll(() => page.evaluate(() => sessionStorage.getItem('gh_token'))).toBeNull();
        await expect(page.locator('#admin-toolbar')).toBeHidden();
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

    // GitHub contents API stub: GET returns `remote` as the file, PUTs are recorded.
    async function stubContents(page, remote) {
        const puts = [];
        await page.route('https://api.github.com/repos/*/*/contents/data.json', async route => {
            if (route.request().method() === 'PUT') {
                puts.push(JSON.parse(route.request().postData()));
                return route.fulfill({ json: { content: { sha: 'new' } } });
            }
            return route.fulfill({ json: { sha: 'abc123', content: Buffer.from(JSON.stringify(remote)).toString('base64') } });
        });
        return puts;
    }

    async function editName(page) {
        const name = page.locator('[data-path="profile.name"]');
        await name.click();
        await page.keyboard.press('End');
        await page.keyboard.type(' (edited)');
        await page.locator('#year').click();          // blur → saved into the in-memory data
    }

    test('saving: nothing to save, then one confirmed PUT with the changed sections', async ({ page }) => {
        const original = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
        const puts = await stubContents(page, original);
        await login(page);
        const save = page.locator('#admin-toolbar [data-action="save"]');
        await save.click();
        await expect(page.locator('.toastify', { hasText: 'Nothing to save' })).toBeVisible();
        expect(puts).toHaveLength(0);

        await editName(page);
        await page.evaluate(() => { const b = document.querySelector('#admin-toolbar [data-action="save"]'); b.click(); b.click(); });
        await expect(page.locator('.swal2-popup')).toContainText('الملف الشخصي');
        await expect(page.locator('.swal2-popup')).not.toContainText('تغيّر ملف data.json');
        await page.locator('.swal2-confirm').click();
        await expect.poll(() => puts.length).toBe(1);
        await page.waitForTimeout(300);
        expect(puts).toHaveLength(1);                  // the double click did not save twice
        const saved = JSON.parse(Buffer.from(puts[0].content, 'base64').toString('utf8'));
        expect(saved.profile.name.ar).toContain('(edited)');
        expect(puts[0].sha).toBe('abc123');
        expect(puts[0].message).toContain('الملف الشخصي');
    });

    test('saving warns when data.json changed on GitHub since the page loaded', async ({ page }) => {
        const remote = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
        remote.profile.phone = '+966500000000';           // someone committed in the meantime
        const puts = await stubContents(page, remote);
        await login(page);
        await editName(page);
        await page.locator('#admin-toolbar [data-action="save"]').click();
        await expect(page.locator('.swal2-popup')).toContainText('تغيّر ملف data.json');
        await page.locator('.swal2-cancel').click();
        await page.waitForTimeout(300);
        expect(puts).toHaveLength(0);
    });

    test('loads SweetAlert2 on demand for the editors', async ({ page }) => {
        await login(page);
        await page.locator('#admin-toolbar [data-action="manage-profile"]').click();
        await expect(page.locator('.swal2-popup')).toBeVisible();
        await expect(page.locator('#pf-name-ar')).not.toHaveValue('');
    });
});
