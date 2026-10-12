import { readFileSync } from 'node:fs';
import { test, expect, openSite } from './fixtures.js';

// The real data.json without the owner's display settings (hidden sections, fonts), which change whenever they are
// edited in the admin panel; each test sets the ones it is about.
const DATA = (({ visibility, fonts, ...rest }) => rest)(JSON.parse(readFileSync(new URL('../data.json', import.meta.url), 'utf8')));
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

test.describe('fonts', () => {
    const bodyFont = page => page.evaluate(() => getComputedStyle(document.body).fontFamily);

    test('visitors get the fonts from data.json, downloaded from this site only', async ({ page }) => {
        const data = clone();
        data.fonts = { ar: 'cairo', en: 'inter' };
        await page.context().route('**/data.json*', route => route.fulfill({ json: data }));
        const fontFiles = [];
        page.on('request', r => { if (r.resourceType() === 'font') fontFiles.push(new URL(r.url())); });
        await openSite(page);
        await expect.poll(() => bodyFont(page)).toMatch(/^Inter, Cairo,/);
        await page.evaluate(() => document.fonts.ready);
        expect(await page.evaluate(() => document.fonts.check('700 16px Cairo', 'أسامة'))).toBe(true);
        expect(fontFiles.length).toBeGreaterThan(0);
        const site = new URL(page.url()).origin;
        expect(fontFiles.every(u => u.origin === site && u.pathname.includes('/assets/fonts/'))).toBe(true);
        expect(fontFiles.some(u => u.pathname.includes('cairo-arabic'))).toBe(true);
        // cached for the next visit's first paint (js/early.js)
        expect(await page.evaluate(() => localStorage.getItem('font_stack'))).toBe('"Inter", "Cairo", system-ui, sans-serif');
    });

    test('the deployed page applies the fonts before first paint, so the default font is never downloaded', async ({ page }) => {
        const data = clone();
        data.fonts = { ar: 'almarai', en: 'same' };
        const { applyFonts } = await import('../scripts/assemble-site.mjs');
        const html = applyFonts(readFileSync(new URL('../index.html', import.meta.url), 'utf8'), data);
        await page.context().route('**/data.json*', route => route.fulfill({ json: data }));
        await page.context().route(url => /\/(index\.html)?$/.test(url.pathname), route => route.fulfill({ body: html, contentType: 'text/html' }));
        const fontFiles = [];
        page.on('request', r => { if (r.resourceType() === 'font') fontFiles.push(r.url()); });
        await openSite(page);
        await page.evaluate(() => document.fonts.ready);
        expect(await bodyFont(page)).toBe('Almarai, system-ui, sans-serif');
        expect(fontFiles.some(u => u.includes('almarai-arabic'))).toBe(true);
        expect(fontFiles.some(u => u.includes('tajawal'))).toBe(false);
    });

    // data.json as it would be with the default fonts (the real file follows whatever admin → Fonts saved)
    const withDefaultFonts = () => { const data = clone(); delete data.fonts; return data; };

    test('a tampered cached font stack is ignored before first paint', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('font_stack', 'x; background: url(https://evil.example/)'));
        await page.context().route('**/data.json*', route => route.fulfill({ json: withDefaultFonts() }));
        await openSite(page);
        expect(await bodyFont(page)).toBe('Tajawal, system-ui, sans-serif');
    });

    test('admin previews fonts live, cancel restores, apply saves to data.json', async ({ page }) => {
        const data = withDefaultFonts();
        await page.context().route('**/data.json*', route => route.fulfill({ json: data }));
        await stubGitHub(page, { remote: data });
        await login(page);
        await tool(page, 'الخطوط');
        await expect(page.locator('[data-font-sample="Almarai"]')).toHaveCSS('font-family', /Almarai/);
        await page.locator('input[name="font-ar"][value="almarai"]').check();
        await expect.poll(() => bodyFont(page)).toContain('Almarai');
        await page.locator('.swal2-cancel').click();
        await expect.poll(() => bodyFont(page)).toBe('Tajawal, system-ui, sans-serif');

        await tool(page, 'الخطوط');
        await page.locator('input[name="font-ar"][value="ibm-plex-sans-arabic"]').check();
        await page.locator('input[name="font-en"][value="poppins"]').check();
        await page.locator('.swal2-confirm').click();
        await expect.poll(() => bodyFont(page)).toMatch(/^Poppins, "IBM Plex Sans Arabic",/);
        expect((await state(page)).fonts).toEqual({ ar: 'ibm-plex-sans-arabic', en: 'poppins' });

        await tool(page, 'الخطوط');                                  // back to the default removes the setting
        await page.locator('input[name="font-ar"][value="tajawal"]').check();
        await page.locator('input[name="font-en"][value="same"]').check();
        await page.locator('.swal2-confirm').click();
        expect((await state(page)).fonts).toBeUndefined();
        expect(await page.evaluate(() => localStorage.getItem('font_stack'))).toBeNull();
    });
});

test.describe('search engines', () => {
    // index.html as the deploy writes it (scripts/assemble-site.mjs)
    async function deployedPage(page, data) {
        const { applySeo, applyProfileImage, applyFonts } = await import('../scripts/assemble-site.mjs');
        const { applyJsonLd, applyVerification, prerenderContent } = await import('../scripts/prerender.mjs');
        const html = [applySeo, applyProfileImage, applyJsonLd, applyVerification, prerenderContent, applyFonts]
            .reduce((out, step) => step(out, data), readFileSync(new URL('../index.html', import.meta.url), 'utf8'));
        await page.context().route('**/data.json*', route => route.fulfill({ json: data }));
        await page.context().route(url => /\/(index\.html)?$/.test(url.pathname), route => route.fulfill({ body: html, contentType: 'text/html' }));
        return html;
    }

    test('the deployed HTML carries the CV, and the app replaces it with the real cards', async ({ page }) => {
        const data = clone();
        const html = await deployedPage(page, data);
        expect(html).toContain(data.experience[0].role.ar);
        expect(html).toContain(data.certificates[0].name.ar);
        expect(html).toContain('"hasCredential"');
        await openSite(page);
        await expect(page.locator('[data-path="profile.name"]')).toHaveText(data.profile.name.ar);
        await page.evaluate(() => { location.hash = 'resume'; });
        await expect(page.locator('#experience-container article')).toHaveCount(0);
        await expect(page.locator('#experience-container .sortable-item')).toHaveCount(data.experience.filter(x => !x.hidden).length);
        await page.locator('#lang-btn').click();
        await expect(page.locator('[data-path="profile.name"]')).toHaveText(data.profile.name.en);
    });

    test('admin pastes the Google verification tag; only the token is kept', async ({ page }) => {
        await stubGitHub(page);
        await login(page);
        await tool(page, 'SEO');
        await page.locator('#seo-verify-google').fill('<meta name="google-site-verification" content="Ab_12-cdEFgh" />');
        await page.locator('#seo-verify-bing').fill('not a token!');
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('.swal2-validation-message')).toContainText('Bing');
        await page.locator('#seo-verify-bing').fill('');
        await page.locator('.swal2-confirm').click();
        expect((await state(page)).seo.verify).toEqual({ google: 'Ab_12-cdEFgh' });
    });
});

test.describe('blog, recommendations, project pages, verified certificates', () => {
    const extra = () => {
        const data = clone();
        data.testimonials = [{ name: { ar: 'م. خالد', en: 'Eng. Khalid' }, role: { ar: 'مشرف التدريب', en: 'Training supervisor' }, text: { ar: 'متدرب مميز <b>جداً</b>', en: 'An outstanding trainee' }, link: 'https://www.linkedin.com/in/x/' },
                             { name: { ar: 'مخفية' }, text: { ar: 'لا تظهر' }, hidden: true }];
        data.posts = [{ title: { ar: 'مقال قديم', en: 'Old post' }, body: { ar: 'نص', en: 'Text' }, date: '2025-01-01' },
                      { title: { ar: 'إعداد شبكة منزلية', en: 'Home network setup' }, summary: { ar: 'خطوات عملية' }, body: { ar: '## مقدمة\nنص', en: 'Text' }, date: '2026-10-01', tags: ['شبكات'] }];
        data.certificates = [{ name: { ar: 'شهادة موثقة', en: 'Verified cert' }, issuer: { ar: 'IBM', en: 'IBM' }, url: 'https://www.credly.com/badges/x' }, ...data.certificates.map(c => ({ ...c, url: '' }))];
        return data;
    };

    test('visitors: empty recommendations and blog are hidden', async ({ page }) => {
        const data = clone();
        delete data.testimonials; delete data.posts;
        await page.context().route('**/data.json*', route => route.fulfill({ json: data }));
        await openSite(page);
        await expect(page.locator('[data-section="testimonials"]')).toHaveClass(/hidden/);
        await expect(page.locator('[data-section="blog"]')).toHaveClass(/hidden/);
    });

    test('visitors see recommendations, newest articles first with links to their pages, and verified badges', async ({ page }) => {
        await page.context().route('**/data.json*', route => route.fulfill({ json: extra() }));
        await openSite(page, 'resume');
        const cards = page.locator('#testimonials-container > div');
        await expect(cards).toHaveCount(1);
        await expect(cards.first()).toContainText('متدرب مميز <b>جداً</b>');           // shown as text, not markup
        await expect(cards.first().locator('a[href="https://www.linkedin.com/in/x/"]')).toBeVisible();
        await expect(page.locator('#certs-verified')).toHaveText('1 شهادة موثّقة');
        await expect(page.locator('#certificates-container .cert-verified')).toHaveCount(1);
        await page.evaluate(() => { location.hash = 'portfolio'; });
        const posts = page.locator('#posts-container article');
        await expect(posts).toHaveCount(2);
        await expect(posts.first()).toContainText('إعداد شبكة منزلية');
        await expect(posts.first().locator('h3 a')).toHaveAttribute('href', 'blog/home-network-setup.html');
        await page.locator('#lang-btn').click();
        await expect(posts.first()).toContainText('Home network setup');
        await expect(page.locator('#certs-verified')).toHaveText('1 verified');
    });

    test('the project dialog links to the project page, and the generated page renders under the CSP', async ({ page, consoleErrors }) => {
        const data = extra();
        await page.context().route('**/data.json*', route => route.fulfill({ json: data }));
        await openSite(page, 'portfolio');
        await page.locator('#projects-container [data-action="open-project"]').first().click();
        const { projectPages } = await import('../js/pages.js');
        const first = projectPages(data)[0];
        await expect(page.locator('#modal-page-link')).toHaveAttribute('href', `projects/${first.slug}.html`);

        const { sitePages } = await import('../scripts/pages.mjs');
        const pages = sitePages(data);
        await page.context().route(/\/CV\/(projects|blog)\//, route => {
            const path = new URL(route.request().url()).pathname.replace('/CV/', '');
            const hit = pages.find(p => p.path === path || p.path === `${path}index.html`);
            return hit ? route.fulfill({ body: hit.html, contentType: 'text/html' }) : route.fallback();
        });
        await page.context().route('**/assets/css/site-fonts.css', route => route.fulfill({ body: ':root{}', contentType: 'text/css' }));
        await page.goto(`./projects/${first.slug}.html`);
        await expect(page.locator('h1')).toHaveText(data.projects[first.index].title.ar);
        await expect(page.locator('a[href="../#portfolio"]').first()).toBeVisible();
        await page.goto('./blog/');
        await expect(page.locator('main li')).toHaveCount(2);
        await page.locator('main li a').first().click();
        await expect(page.locator('h1')).toHaveText('إعداد شبكة منزلية');
        await expect(page.locator('.readme h3')).toHaveText('مقدمة');
        expect(consoleErrors).toEqual([]);
    });

    test('admin writes an article (validated), previews it, and adds a recommendation', async ({ page }) => {
        await stubGitHub(page);
        await login(page);
        await page.evaluate(() => { location.hash = 'portfolio'; });
        await page.locator('[data-action="add-item"][data-type="posts"]').click();
        await page.locator('#swal-title-ar').fill('أول مقال');
        await page.locator('#swal-body-ar').fill('## مقدمة\nهذا **نص** المقال');
        await expect(page.locator('#swal-date')).toHaveValue(/^\d{4}-\d{2}-\d{2}$/);
        await page.locator('#swal-slug').fill('Bad Slug!');
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('.swal2-validation-message')).toContainText('رابط المقال');
        await page.locator('#swal-slug').fill('first-post');
        await page.locator('.swal2-confirm').click();
        const posts = (await state(page)).posts;
        expect(posts.at(-1)).toMatchObject({ title: { ar: 'أول مقال' }, slug: 'first-post' });
        await page.locator('#posts-container [data-action="preview-post"]').first().click();
        await expect(page.locator('.swal2-popup .readme strong')).toHaveText('نص');
        await page.locator('.swal2-confirm').click();

        await page.evaluate(() => { location.hash = 'resume'; });
        await page.locator('[data-action="add-item"][data-type="testimonials"]').click();
        await page.locator('#swal-name-ar').fill('أ. سارة');
        await page.locator('#swal-text-ar').fill('عمل متقن');
        await page.locator('#swal-link').fill('http://insecure.example');
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('.swal2-validation-message')).toContainText('https://');
        await page.locator('#swal-link').fill('');
        await page.locator('.swal2-confirm').click();
        await expect(page.locator('#testimonials-container')).toContainText('عمل متقن');
    });
});

test.describe('career timeline and QR code', () => {
    test('timeline: every dated item oldest first, filters, and a click jumps to the card', async ({ page }) => {
        const data = clone();
        await page.context().route('**/data.json*', route => route.fulfill({ json: data }));
        await openSite(page, 'resume');
        const { timelineEntries } = await import('../js/timeline-data.js');
        const expected = timelineEntries(data);
        const items = page.locator('#timeline-track .timeline-item');
        await expect(page.locator('#timeline-section')).toBeVisible();
        await expect(items).toHaveCount(expected.length);
        await expect(page.locator('#timeline-track .timeline-year').first()).toHaveText(String(expected[0].start.year));
        await page.locator('[data-action="timeline-filter"][data-filter="certificates"]').click();
        await expect(items).toHaveCount(expected.filter(e => e.type === 'certificates').length);
        await page.locator('[data-action="timeline-filter"][data-filter="all"]').click();
        const last = expected.at(-1);
        await items.last().locator('button').click();
        const card = page.locator(`#${last.type}-container [data-index="${last.index}"]`);
        await expect(card).toHaveClass(/timeline-flash/);
        await expect(card).toBeInViewport();
        await page.locator('#lang-btn').click();
        await expect(page.locator('#timeline-title')).toContainText('Journey');
    });

    test('the QR card offers the SVG and a PNG of the site address', async ({ page }) => {
        await openSite(page, 'contact');
        const card = page.locator('#contact [data-section="qr"]');
        await expect(card.locator('img')).toBeVisible();
        expect(await card.locator('img').evaluate(img => img.naturalWidth > 0)).toBe(true);
        await expect(card.locator('a[download]')).toHaveAttribute('href', 'assets/img/qr-site.svg');
        const download = page.waitForEvent('download');
        await card.locator('[data-action="download-qr-png"]').click();
        expect((await download).suggestedFilename()).toBe('osama-alharbi-qr.png');
    });
});

test.describe('scrollbar style', () => {
    const sb = page => page.evaluate(() => document.documentElement.dataset.scrollbar);

    test('brand style by default; data.json picks another; dark mode gets dark native controls', async ({ page }) => {
        await openSite(page);
        expect(await sb(page)).toBe('brand');
        const data = clone();
        data.scrollbar = 'gradient';
        await page.context().route('**/data.json*', route => route.fulfill({ json: data }));
        await page.reload();
        await expect.poll(() => sb(page)).toBe('gradient');
        expect(await page.evaluate(() => localStorage.getItem('scrollbar'))).toBe('gradient');
        await page.locator('#theme-btn').click();
        await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toMatch(/dark/);
    });

    test('a tampered cached style is ignored', async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('scrollbar', 'x"><img src=x>'));
        await page.context().route('**/data.json*', route => route.fulfill({ json: clone() }));
        await openSite(page);
        expect(await sb(page)).toBe('brand');
    });

    test('admin previews each style live, cancel restores, apply saves', async ({ page }) => {
        await stubGitHub(page);
        await login(page);
        await tool(page, 'شريط التمرير');
        await expect(page.locator('.swal2-popup [data-scrollbar]')).toHaveCount(5);
        await page.locator('input[name="scrollbar"][value="bold"]').check();
        expect(await sb(page)).toBe('bold');
        await page.locator('.swal2-cancel').click();
        await expect.poll(() => sb(page)).toBe('brand');
        await tool(page, 'شريط التمرير');
        await page.locator('input[name="scrollbar"][value="slim"]').check();
        await page.locator('.swal2-confirm').click();
        expect((await state(page)).scrollbar).toBe('slim');
        expect(await sb(page)).toBe('slim');
    });
});
