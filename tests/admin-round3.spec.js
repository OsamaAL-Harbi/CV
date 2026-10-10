import { readFileSync } from 'node:fs';
import { test, expect, openSite } from './fixtures.js';

const DATA = JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8'));
const clone = () => structuredClone(DATA);
const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64');
const state = page => page.evaluate(async () => (await import('./js/state.js')).state.appData);

// GitHub API stub: data.json on GitHub = `remote`; history of two commits; file PUTs recorded.
async function stubGitHub(page, { remote = DATA, versions = {} } = {}) {
    const puts = [];
    await page.route('https://api.github.com/**', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname.endsWith('/commits')) {
            return route.fulfill({ json: [
                { sha: 'a'.repeat(40), commit: { message: 'Update data.json via admin panel (الخبرات)', author: { name: 'Osama', date: '2026-10-10T20:00:00Z' } } },
                { sha: 'b'.repeat(40), commit: { message: 'Older version', author: { name: 'Osama', date: '2026-10-01T10:00:00Z' } } }
            ] });
        }
        if (url.pathname.endsWith('/contents/data.json')) {
            const ref = url.searchParams.get('ref');
            if (req.method() === 'PUT') { puts.push({ path: 'data.json', body: JSON.parse(req.postData()) }); return route.fulfill({ json: {} }); }
            return route.fulfill({ json: { sha: 'abc', content: b64(ref ? versions[ref] : remote) } });
        }
        if (url.pathname.includes('/contents/')) {
            if (req.method() === 'PUT') { puts.push({ path: decodeURIComponent(url.pathname.split('/contents/')[1]), body: JSON.parse(req.postData()) }); return route.fulfill({ status: 201, json: {} }); }
            return route.fulfill({ status: 404, json: {} });
        }
        return route.fulfill({ json: { full_name: 'OsamaAL-Harbi/CV' } });
    });
    return puts;
}

async function login(page) {
    await openSite(page);
    for (let i = 0; i < 3; i++) await page.locator('#secret-trigger').click();
    await page.locator('#token-input').fill('github_pat_TEST_ONLY');
    await page.locator('[data-action="login"]').click();
    await expect(page.locator('#admin-toolbar')).toBeVisible();
}

async function tool(page, label) {
    await page.locator('#admin-toolbar [data-action="open-tools"]').click();
    await page.locator('[data-tool]', { hasText: label }).click();
}

// A real PNG drawn by the browser
const png = page => page.evaluate(() => {
    const c = Object.assign(document.createElement('canvas'), { width: 800, height: 600 });
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#0d9488'; ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = '#fff'; ctx.fillRect(300, 200, 200, 200);
    return c.toDataURL('image/png').split(',')[1];
}).then(s => Buffer.from(s, 'base64'));

test.describe('history and diff', () => {
    test('save shows a line diff of exactly what changes on GitHub', async ({ page }) => {
        const puts = await stubGitHub(page);
        await login(page);
        const name = page.locator('[data-path="profile.name"]');
        await name.click();
        await page.keyboard.press('End');
        await page.keyboard.type(' (edited)');
        await page.locator('#year').click();
        await page.locator('#admin-toolbar [data-action="save"]').click();
        const diff = page.locator('.swal2-popup .diff');
        await expect(diff).toBeVisible();
        await expect(diff.locator('div', { hasText: '(edited)' }).first()).toContainText('+');
        await expect(page.locator('.swal2-popup summary')).toContainText('+1');
        await expect(page.locator('.swal2-popup summary')).toContainText('−1');
        await page.locator('.swal2-confirm').click();
        await expect.poll(() => puts.length).toBe(1);
    });

    test('history previews an older version and restores it into the editor', async ({ page }) => {
        const older = clone();
        older.profile.title.ar = 'مسمى قديم من السجل';
        await stubGitHub(page, { versions: { ['b'.repeat(40)]: older } });
        await login(page);
        await page.locator('#admin-toolbar [data-action="open-history"]').click();
        await expect(page.locator('[data-hist-preview]')).toHaveCount(2);
        await page.locator(`[data-hist-preview="${'b'.repeat(40)}"]`).click();
        await expect(page.locator('#hist-diff')).toContainText('مسمى قديم من السجل');
        await page.locator('#hist-restore').click();
        await expect(page.locator('.swal2-popup')).toBeHidden();
        expect((await state(page)).profile.title.ar).toBe('مسمى قديم من السجل');
        await expect(page.locator('#typewriter-sr')).toHaveText('مسمى قديم من السجل');
    });
});

test.describe('images', () => {
    test('profile photo: cropped square, encoded as WebP, committed to images/', async ({ page }) => {
        const puts = await stubGitHub(page);
        await login(page);
        await tool(page, 'رفع الصورة الشخصية');
        await page.locator('#img-file').setInputFiles({ name: 'me.png', mimeType: 'image/png', buffer: await png(page) });
        await expect(page.locator('#img-canvas')).toBeVisible();
        await expect(page.locator('#img-info')).toContainText('800×600 → 512×512');
        await page.locator('#img-zoom').fill('1.5');
        await page.locator('.swal2-confirm').click();
        await expect.poll(() => puts.length).toBe(1);
        expect(puts[0].path).toMatch(/^images\/profile-\d{12}\.webp$/);
        const bytes = Buffer.from(puts[0].body.content, 'base64');
        expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
        expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
        await expect(page.locator('#profile-img')).toHaveAttribute('src', /^data:image\/webp;base64,/);   // previewed until deployed
        expect((await state(page)).profile.image).toBe(puts[0].path);
    });

    test('project image from the project editor shows on the card and in the modal', async ({ page }) => {
        const puts = await stubGitHub(page);
        await login(page);
        await page.evaluate(() => { location.hash = 'portfolio'; });
        await page.locator('#projects-container .sortable-item').first().hover();
        await page.locator('#projects-container [data-action="edit-item"]').first().click();
        await page.locator('#pj-image-upload').click();
        await page.locator('#img-file').setInputFiles({ name: 'p.png', mimeType: 'image/png', buffer: await png(page) });
        await page.locator('.swal2-confirm').click();                 // upload
        await expect(page.locator('#pj-image')).toHaveValue(/^images\/projects\/.+\.webp$/);   // editor reopened
        await expect(page.locator('#pj-title-ar')).not.toHaveValue('');                          // typed values kept
        await page.locator('.swal2-confirm').click();                 // save the project
        const img = page.locator('#projects-container img').first();
        await expect(img).toHaveAttribute('src', /^data:image\/webp;base64,/);
        expect((await state(page)).projects[0].image).toBe(puts[0].path);
        await page.locator('#projects-container [data-action="open-project"]').first().click();
        await expect(page.locator('#modal-image')).toBeVisible();
    });

    test('certificate image keeps its shape and becomes a thumbnail link', async ({ page }) => {
        const puts = await stubGitHub(page);
        await login(page);
        await page.evaluate(() => { location.hash = 'resume'; });
        await page.locator('#certificates-container .sortable-item').first().hover();
        await page.locator('#certificates-container [data-action="edit-item"]').first().click();
        await page.locator('#swal-image-upload').click();
        await page.locator('#img-file').setInputFiles({ name: 'c.png', mimeType: 'image/png', buffer: await png(page) });
        await expect(page.locator('#img-info')).toContainText('≤ 1600px');
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('#swal-image')).toHaveValue(/^images\/certificates\/.+\.webp$/);
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('#certificates-container a img').first()).toHaveAttribute('src', /^data:image\/webp;base64,/);
        expect((await state(page)).certificates[0].image).toBe(puts[0].path);
    });
});

test.describe('checker', () => {
    test('finds empty fields, missing translations and Arabic in English fields, and jumps to the editor', async ({ page }) => {
        const data = clone();
        data.languages[1].level.en = '';
        data.workshops[0].name.en = 'ورشة بالعربي';
        await page.context().route('**/data.json*', route => route.fulfill({ json: data }));
        await stubGitHub(page, { remote: data });       // the admin panel loads the GitHub copy at login
        await login(page);
        await page.locator('#admin-toolbar [data-action="open-checker"]').click();
        const quality = page.locator('[data-panel="quality"]');
        await expect(quality).toContainText('متدرب شبكات');          // its period is empty
        await expect(quality).toContainText('«الفترة» فارغ');
        await expect(quality).toContainText('AWS');                  // certificate without date
        await page.locator('[data-tab="translation"]').click();
        const tr = page.locator('[data-panel="translation"]');
        await expect(tr).toContainText('ناقص بالإنجليزي');
        await expect(tr).toContainText('نص عربي داخل الحقل الإنجليزي');
        await tr.locator('li', { hasText: 'نص عربي داخل' }).locator('[data-fix-type]').click();
        await expect(page.locator('#swal-name-en')).toHaveValue('ورشة بالعربي');
    });
});

test.describe('visibility', () => {
    test('hidden sections and items disappear for visitors and from the stats', async ({ page }) => {
        const data = clone();
        data.visibility = { sections: ['workshops'] };
        data.certificates[0].hidden = true;
        await page.context().route('**/data.json*', route => route.fulfill({ json: data }));
        await openSite(page, 'resume');
        await expect(page.locator('[data-section="workshops"]')).toBeHidden();
        await expect(page.locator('#certificates-container > div')).toHaveCount(DATA.certificates.length - 1);
        await expect(page.locator('#certificates-container')).not.toContainText(DATA.certificates[0].name.ar);
        await page.evaluate(() => { location.hash = 'home'; });
        await expect(page.locator('[data-stat="certificates"]')).toHaveText(String(DATA.certificates.length - 1));
    });

    test('admin sees hidden things dimmed, and toggles items with the eye button', async ({ page }) => {
        await stubGitHub(page);
        await login(page);
        await page.evaluate(() => { location.hash = 'resume'; });
        const first = page.locator('#languages-container .sortable-item').first();
        await first.hover();
        await first.locator('[data-action="toggle-hidden"]').click();
        await expect(page.locator('#languages-container .sortable-item').first()).toHaveClass(/item-hidden/);
        expect((await state(page)).languages[0].hidden).toBe(true);
        await tool(page, 'إظهار وإخفاء الأقسام');
        await page.locator('[data-vis="languages"]').uncheck();
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('[data-section="languages"]')).toHaveClass(/section-off-admin/);
        await expect(page.locator('[data-section="languages"]')).toBeVisible();
        expect((await state(page)).visibility).toEqual({ sections: ['languages'] });
    });
});

test.describe('open to work and SEO', () => {
    test('availability badge shows in both languages', async ({ page }) => {
        const data = clone();
        data.availability = { enabled: true, status: { ar: 'متاح للعمل', en: 'Open to work' }, cities: { ar: 'الرياض', en: 'Riyadh' }, types: { ar: 'دوام كامل', en: 'Full-time' } };
        await page.context().route('**/data.json*', route => route.fulfill({ json: data }));
        await openSite(page);
        const badge = page.locator('#availability-badge');
        await expect(badge).toBeVisible();
        await expect(badge).toContainText('متاح للعمل');
        await expect(badge).toContainText('الرياض · دوام كامل');
        await page.locator('#lang-btn').click();
        await expect(badge).toContainText('Open to work');
        await expect(badge).toContainText('Riyadh · Full-time');
    });

    test('admin enables the badge from the tools menu', async ({ page }) => {
        await stubGitHub(page);
        await login(page);
        await tool(page, 'متاح للعمل');
        await page.locator('#av-enabled').check();
        await page.locator('[data-av="cities.ar"]').fill('المدينة المنورة');
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('#availability-badge')).toContainText('متاح للعمل');
        await expect(page.locator('#availability-badge')).toContainText('المدينة المنورة');
    });

    test('SEO settings set the home title, description and share image', async ({ page }) => {
        const data = clone();
        data.seo = { ar: { title: 'أسامة الحربي | تقنية المعلومات', description: 'وصف SEO مخصص' }, en: { title: 'Osama | IT', description: 'Custom SEO' }, image: 'images/og-1.jpg' };
        await page.context().route('**/data.json*', route => route.fulfill({ json: data }));
        await openSite(page);
        await expect(page).toHaveTitle('أسامة الحربي | تقنية المعلومات');
        await expect(page.locator('#meta-description')).toHaveAttribute('content', 'وصف SEO مخصص');
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://osamaal-harbi.github.io/CV/images/og-1.jpg');
        await page.locator('#lang-btn').click();
        await expect(page).toHaveTitle('Osama | IT');
        await page.evaluate(() => { location.hash = 'resume'; });
        await expect(page).toHaveTitle(/Resume/);                   // other sections keep their own titles
    });

    test('SEO page counts characters and previews the Google result', async ({ page }) => {
        await stubGitHub(page);
        await login(page);
        await tool(page, 'SEO');
        await page.locator('[data-seo="ar.title"]').fill('عنوان تجريبي');
        await expect(page.locator('#seo-prev-title')).toHaveText('عنوان تجريبي');
        await expect(page.locator('[data-count="ar-title"]')).toHaveText('12/60');
        await page.locator('[data-seo="ar.description"]').fill('و'.repeat(170));
        await expect(page.locator('[data-count="ar-description"]')).toHaveClass(/text-red-600/);
        await page.locator('.swal2-confirm').click();
        expect((await state(page)).seo.ar.title).toBe('عنوان تجريبي');
    });
});
