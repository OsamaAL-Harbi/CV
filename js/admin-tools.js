// Admin tools loaded on demand from js/admin.js: data.json history and restore, image upload with crop and
// WebP, content and translation checks, hidden sections, "open to work" and SEO settings.
import { state } from './state.js';
import { escapeHTML, loadVendor, safeAssetUrl, showToast } from './utils.js';
import { renderAll } from './render.js';
import { syncSiteTheme } from './color.js';
import { diffHTML, editItem, fromBase64Utf8, ghApi, manageProfile, putRepoFile, readAsBase64 } from './admin.js';

const pretty = data => JSON.stringify(data, null, 2);
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
export const slug = text => String(text || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'item';
const dateFmt = new Intl.DateTimeFormat('ar-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' });

// ─── 1–2. History of data.json: preview any version against the editor, restore it ───
export async function openHistory() {
    await loadVendor('swal');
    let commits;
    try {
        const res = await ghApi('/commits?path=data.json&per_page=30');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        commits = await res.json();
    } catch (err) {
        showToast(`تعذّر جلب السجل: ${err.message}`, 'error');
        return;
    }
    let chosen = null;
    await Swal.fire({
        title: 'سجل التعديلات',
        width: '900px',
        html: `<div class="text-right space-y-3" dir="rtl">
            <p class="text-xs text-gray-500">آخر ${commits.length} نسخة من data.json. «معاينة» تعرض الفرق بين تلك النسخة وما في المحرر الآن، و«استرجاع» يضعها في المحرر لتراجعها ثم تحفظها.</p>
            <ol class="space-y-2 max-h-[35vh] overflow-y-auto">${commits.map((c, i) => `
                <li class="flex flex-wrap items-center gap-3 p-2.5 rounded-xl border border-gray-200">
                    <div class="flex-1 min-w-[12rem]">
                        <p class="text-sm font-bold" dir="auto">${escapeHTML((c.commit?.message || '').split('\n')[0])}</p>
                        <p class="text-[11px] text-gray-500"><span dir="ltr" class="font-mono">${escapeHTML(c.sha.slice(0, 7))}</span> · ${escapeHTML(dateFmt.format(new Date(c.commit?.author?.date)))} · ${escapeHTML(c.commit?.author?.name || '')}${i === 0 ? ' · <b>الحالية على GitHub</b>' : ''}</p>
                    </div>
                    <button type="button" class="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-bold" data-hist-preview="${escapeHTML(c.sha)}">معاينة</button>
                </li>`).join('')}
            </ol>
            <div id="hist-panel" class="hidden space-y-2">
                <div class="flex items-center justify-between gap-2"><p id="hist-title" class="text-sm font-bold"></p>
                    <button type="button" id="hist-restore" class="px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold">استرجاع هذه النسخة</button></div>
                <div id="hist-diff"></div>
            </div>
        </div>`,
        showConfirmButton: false,
        showCloseButton: true,
        didOpen: popup => {
            const cache = {};
            popup.addEventListener('click', async e => {
                const btn = e.target.closest('[data-hist-preview]');
                if (btn) {
                    const sha = btn.dataset.histPreview;
                    const panel = popup.querySelector('#hist-panel');
                    panel.classList.remove('hidden');
                    popup.querySelector('#hist-title').textContent = `⏳ ${sha.slice(0, 7)}…`;
                    try {
                        if (!cache[sha]) {
                            const res = await ghApi(`/contents/data.json?ref=${encodeURIComponent(sha)}`);
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            cache[sha] = JSON.parse(fromBase64Utf8((await res.json()).content));
                        }
                        chosen = { sha, data: cache[sha] };
                        const d = diffHTML(pretty(state.appData), pretty(cache[sha]));
                        popup.querySelector('#hist-title').innerHTML = `الفرق من المحرر الحالي إلى النسخة <span dir="ltr" class="font-mono">${escapeHTML(sha.slice(0, 7))}</span>
                            <span class="font-mono text-xs" dir="ltr"><span class="text-green-700">+${d.added}</span> <span class="text-red-600">−${d.removed}</span></span>`;
                        popup.querySelector('#hist-diff').innerHTML = d.html;
                    } catch (err) {
                        popup.querySelector('#hist-title').textContent = `تعذّر تحميل النسخة: ${err.message}`;
                    }
                    return;
                }
                if (e.target.closest('#hist-restore') && chosen) {
                    state.appData = structuredClone(chosen.data);
                    syncSiteTheme(state.appData.theme);
                    renderAll();
                    Swal.close();
                    showToast(`استُرجعت النسخة ${chosen.sha.slice(0, 7)} في المحرر — راجعها ثم اضغط «حفظ» لنشرها`, 'success');
                }
            });
        }
    });
}

// ─── 3–4. Images: pick, crop, resize and encode (WebP, JPEG fallback), then commit to images/ ───
function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();               // data: URL — the CSP allows data: images, not blob:
        reader.onload = () => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('not_image'));
            img.src = reader.result;
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

function encode(canvas, format) {
    const tryType = (type, q) => new Promise(r => canvas.toBlob(r, type, q));
    return (async () => {
        if (format !== 'jpeg') {
            const webp = await tryType('image/webp', 0.85);
            if (webp && webp.type === 'image/webp') return { blob: webp, ext: 'webp' };
        }
        return { blob: await tryType('image/jpeg', 0.88), ext: 'jpg' };      // Safari < 17, or OG images
    })();
}

// opts: { title, aspect (w/h, or null = keep the original shape), outW, outH, maxSide, format: 'webp'|'jpeg' }
export async function pickAndCropImage(opts) {
    await loadVendor('swal');
    const PREVIEW = 320;
    let img = null, zoom = 1, cx = 0, cy = 0;
    const cw = PREVIEW, ch = opts.aspect ? Math.round(PREVIEW / opts.aspect) : PREVIEW;

    const source = () => {
        const cover = Math.max(cw / img.naturalWidth, ch / img.naturalHeight) * zoom;
        const sw = cw / cover, sh = ch / cover;
        const sx = Math.min(Math.max(cx - sw / 2, 0), img.naturalWidth - sw);
        const sy = Math.min(Math.max(cy - sh / 2, 0), img.naturalHeight - sh);
        return { sx, sy, sw, sh, cover };
    };
    const draw = canvas => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!img) return;
        if (!opts.aspect) {                             // free shape: whole image, scaled to the preview
            const k = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
            const w = img.naturalWidth * k, h = img.naturalHeight * k;
            ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
            return;
        }
        const { sx, sy, sw, sh } = source();
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
    };

    const result = await Swal.fire({
        title: opts.title || 'رفع صورة',
        width: '520px',
        html: `<div class="space-y-3 text-center" dir="rtl">
            <input type="file" id="img-file" accept="image/*" class="hidden">
            <button type="button" id="img-pick" class="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold">اختيار صورة من الجهاز</button>
            <div id="img-stage" class="hidden space-y-3">
                <canvas id="img-canvas" width="${cw}" height="${ch}" class="mx-auto rounded-xl border border-gray-200 touch-none ${opts.aspect ? 'cursor-move' : ''}"></canvas>
                ${opts.aspect ? `<label class="flex items-center gap-3 text-xs text-gray-600 justify-center">تكبير
                    <input type="range" id="img-zoom" min="1" max="4" step="0.01" value="1" class="w-48"></label>
                    <p class="text-[11px] text-gray-500">اسحب الصورة لاختيار الجزء الظاهر.</p>` : ''}
                <p id="img-info" class="text-[11px] text-gray-500" dir="ltr"></p>
            </div>
        </div>`,
        showCancelButton: true,
        confirmButtonText: 'رفع',
        cancelButtonText: 'إلغاء',
        didOpen: popup => {
            const canvas = popup.querySelector('#img-canvas'), file = popup.querySelector('#img-file');
            Swal.getConfirmButton().disabled = true;
            popup.querySelector('#img-pick').addEventListener('click', () => file.click());
            file.addEventListener('change', async () => {
                const f = file.files?.[0];
                if (!f) return;
                if (f.size > 15 * 1024 * 1024) { Swal.showValidationMessage('الصورة أكبر من 15 MB'); return; }
                try {
                    img = await loadImage(f);
                } catch {
                    Swal.showValidationMessage('تعذّر قراءة الصورة');
                    return;
                }
                Swal.resetValidationMessage();
                zoom = 1; cx = img.naturalWidth / 2; cy = img.naturalHeight / 2;
                popup.querySelector('#img-stage').classList.remove('hidden');
                popup.querySelector('#img-info').textContent = `${img.naturalWidth}×${img.naturalHeight} → ${opts.aspect ? `${opts.outW}×${opts.outH}` : `≤ ${opts.maxSide}px`} ${opts.format === 'jpeg' ? 'JPEG' : 'WebP'}`;
                Swal.getConfirmButton().disabled = false;
                draw(canvas);
            });
            if (!opts.aspect) return;
            popup.querySelector('#img-zoom').addEventListener('input', e => { zoom = Number(e.target.value); draw(canvas); });
            let drag = null;
            canvas.addEventListener('pointerdown', e => { if (img) { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); } });
            canvas.addEventListener('pointermove', e => {
                if (!drag) return;
                const { cover } = source();
                cx -= (e.clientX - drag.x) / cover; cy -= (e.clientY - drag.y) / cover;
                const { sx, sy, sw, sh } = source();           // keep the centre where the clamped crop is
                cx = sx + sw / 2; cy = sy + sh / 2;
                drag = { x: e.clientX, y: e.clientY };
                draw(canvas);
            });
            canvas.addEventListener('pointerup', () => { drag = null; });
        },
        preConfirm: async () => {
            if (!img) return false;
            const out = document.createElement('canvas');
            if (opts.aspect) {
                out.width = opts.outW; out.height = opts.outH;
                const { sx, sy, sw, sh } = source();
                const ctx = out.getContext('2d');
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);
            } else {
                const k = Math.min(1, opts.maxSide / Math.max(img.naturalWidth, img.naturalHeight));
                out.width = Math.round(img.naturalWidth * k); out.height = Math.round(img.naturalHeight * k);
                const ctx = out.getContext('2d');
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, out.width, out.height);
            }
            return encode(out, opts.format);
        }
    });
    return result.isConfirmed ? result.value : null;
}

const blobToDataUrl = blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
});

// Crops/encodes and commits the image; returns its path in the site (or null when cancelled/failed).
export async function uploadImage(opts, baseName) {
    const picked = await pickAndCropImage(opts);
    if (!picked) return null;
    const path = `${baseName}-${stamp()}.${picked.ext}`;
    showToast('⏳ جاري رفع الصورة…', 'info');
    try {
        const res = await putRepoFile(path, await readAsBase64(picked.blob), `Upload image (${path}) via admin panel`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
        showToast(`فشل رفع الصورة: ${err.message}`, 'error');
        return null;
    }
    // Until the next deploy the file exists only in the repository: preview it from memory meanwhile
    state.previewImages = { ...(state.previewImages || {}), [path]: await blobToDataUrl(picked.blob) };
    showToast(`تم رفع الصورة (${Math.round(picked.blob.size / 1024)} KB) — اضغط «حفظ» لنشر الربط ✅`, 'success');
    return path;
}

export const IMAGE_PRESETS = {
    profile:     { title: 'الصورة الشخصية', aspect: 1, outW: 512, outH: 512 },
    project:     { title: 'صورة المشروع', aspect: 16 / 9, outW: 1200, outH: 675 },
    certificate: { title: 'صورة الشهادة', aspect: null, maxSide: 1600 },
    og:          { title: 'صورة المشاركة (1200×630)', aspect: 1200 / 630, outW: 1200, outH: 630, format: 'jpeg' }
};

export async function uploadProfilePhoto() {
    const path = await uploadImage(IMAGE_PRESETS.profile, 'images/profile');
    if (!path) return;
    state.appData.profile = { ...(state.appData.profile || {}), image: path };
    renderAll();
}

// ─── 5–6. Content and translation checks ───
const AR = /[؀-ۿ]/;
const textOf = v => (v && typeof v === 'object' ? `${v.ar || ''} ${v.en || ''}` : String(v ?? '')).trim();
const isEmpty = v => !textOf(v);

const SECTIONS = {
    experience:   { label: 'الخبرات',  title: i => i.role,   fields: { role: 'المسمى', company: 'الجهة', period: 'الفترة', description: 'الوصف' } },
    education:    { label: 'التعليم',  title: i => i.degree, fields: { degree: 'الدرجة', institution: 'المؤسسة', period: 'التاريخ', description: 'الوصف' } },
    volunteer:    { label: 'التطوع',   title: i => i.role,   fields: { role: 'الدور', organization: 'المنظمة', period: 'الفترة', description: 'الوصف' } },
    certificates: { label: 'الشهادات', title: i => i.name,   fields: { name: 'الاسم', issuer: 'الجهة المانحة', date: 'التاريخ' } },
    workshops:    { label: 'ورش العمل', title: i => i.name,  fields: { name: 'الاسم', organizer: 'الجهة', date: 'التاريخ' } },
    languages:    { label: 'اللغات',   title: i => i.name,   fields: { name: 'اللغة', level: 'المستوى' } },
    projects:     { label: 'المشاريع', title: i => i.title,  fields: { title: 'العنوان', desc: 'الوصف' } },
    skills:       { label: 'المهارات', title: i => i,        fields: {} }
};
const LIMITS = { summary: [120, 700], description: [0, 900], title: [0, 90] };

const nameOf = (type, item) => {
    const t = SECTIONS[type]?.title(item);
    return t && typeof t === 'object' ? (t.ar || t.en || '') : String(t || '');
};

export function checkContent(data) {
    const issues = [];
    const add = (severity, type, index, message) => issues.push({ severity, type, index, where: index === null ? (SECTIONS[type]?.label || 'الملف الشخصي') : `${SECTIONS[type].label}: ${nameOf(type, data[type][index]) || `#${index + 1}`}`, message });
    const p = data.profile || {};
    if (!p.image) add('info', 'profile', null, 'لا توجد صورة شخصية — الصورة تزيد ثقة الزائر.');
    for (const lang of ['ar', 'en']) {
        const len = (p.summary?.[lang] || '').length;
        if (len && len < LIMITS.summary[0]) add('warning', 'profile', null, `النبذة (${lang}) قصيرة جداً (${len} حرفاً).`);
        if (len > LIMITS.summary[1]) add('warning', 'profile', null, `النبذة (${lang}) طويلة (${len} حرفاً) — الأفضل أقل من ${LIMITS.summary[1]}.`);
    }
    if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) add('error', 'profile', null, 'صيغة البريد الإلكتروني غير صحيحة.');
    for (const key of ['linkedin', 'github']) if (p[key] && !/^https:\/\//.test(p[key])) add('error', 'profile', null, `رابط ${key} يجب أن يبدأ بـ https://`);
    if (p.cv && !safeAssetUrl(p.cv)) add('error', 'profile', null, 'رابط السيرة الذاتية غير صالح.');

    for (const [type, def] of Object.entries(SECTIONS)) {
        const list = data[type] || [];
        const seen = new Map();
        list.forEach((item, i) => {
            if (item.hidden) return;
            for (const [field, label] of Object.entries(def.fields)) {
                if (isEmpty(item[field])) add(field === 'description' || field === 'desc' ? 'info' : 'warning', type, i, `الحقل «${label}» فارغ.`);
            }
            for (const lang of ['ar', 'en']) {
                const d = (item.description || item.desc)?.[lang] || '';
                if (d.length > LIMITS.description[1]) add('info', type, i, `الوصف (${lang}) طويل (${d.length} حرفاً) — النقاط المختصرة أسهل قراءة.`);
                const t = (typeof def.title(item) === 'object' ? def.title(item)?.[lang] : '') || '';
                if (t.length > LIMITS.title[1]) add('info', type, i, `العنوان (${lang}) طويل (${t.length} حرفاً).`);
            }
            const key = (typeof def.title(item) === 'object' ? def.title(item)?.en || def.title(item)?.ar : def.title(item)?.en) || '';
            const norm = String(key || (type === 'skills' ? item.en : '')).trim().toLowerCase();
            if (norm) {
                if (seen.has(norm)) add('warning', type, i, `مكرر مع العنصر رقم ${seen.get(norm) + 1}.`);
                else seen.set(norm, i);
            }
        });
    }
    (data.certificates || []).forEach((c, i) => {
        if (!c.hidden && !c.credential && !c.url) add('info', 'certificates', i, 'لا يوجد رقم اعتماد ولا رابط تحقق — رابط التحقق يرفع المصداقية.');
    });
    (data.projects || []).forEach((pr, i) => {
        if (pr.hidden) return;
        if (!pr.technologies?.length) add('warning', 'projects', i, 'لم تُحدَّد التقنيات المستخدمة.');
        if (!/^https:\/\//.test(pr.link || '') && !/^https:\/\//.test(pr.liveUrl || '')) add('info', 'projects', i, 'لا يوجد رابط GitHub أو عرض مباشر.');
        if (!pr.image) add('info', 'projects', i, 'لا توجد صورة للمشروع.');
        if (isEmpty(pr.details?.challenges) && isEmpty(pr.details?.results)) add('info', 'projects', i, 'لا توجد تحديات ولا نتائج في التفاصيل.');
    });
    (data.skills || []).forEach((s, i) => {
        if (s.hidden) return;
        const level = Number(s.level);
        if (!Number.isFinite(level) || level <= 0 || level > 100) add('error', 'skills', i, 'المستوى يجب أن يكون من 1 إلى 100.');
        if (!['hard', 'soft'].includes(s.category)) add('error', 'skills', i, 'النوع يجب أن يكون تقنية أو شخصية.');
    });
    const seoDesc = data.seo?.ar?.description;
    if (seoDesc && (seoDesc.length < 50 || seoDesc.length > 160)) add('info', 'seo', null, `وصف SEO (ar) ${seoDesc.length} حرفاً — الأنسب بين 50 و160.`);
    return issues;
}

// Every { ar, en } pair: one side missing, Arabic text in the English field, no Arabic in the Arabic field
export function checkTranslations(data) {
    const issues = [];
    const walk = (node, type, index, path) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach((v, i) => walk(v, type, index, `${path}[${i}]`)); return; }
        if ('ar' in node || 'en' in node) {
            const ar = String(node.ar ?? '').trim(), en = String(node.en ?? '').trim();
            const where = index === null ? (SECTIONS[type]?.label || 'الملف الشخصي') : `${SECTIONS[type]?.label || type}: ${nameOf(type, data[type][index]) || `#${index + 1}`}`;
            const field = path.replace(/^\./, '') || 'الاسم';
            const push = (severity, message) => issues.push({ severity, type, index, where, field, message });
            if (ar && !en) push('error', `«${field}» موجود بالعربي وناقص بالإنجليزي.`);
            else if (en && !ar) push('error', `«${field}» موجود بالإنجليزي وناقص بالعربي.`);
            else if (ar && en) {
                if (AR.test(en)) push('error', `«${field}»: نص عربي داخل الحقل الإنجليزي.`);
                if (!AR.test(ar) && ar !== en && /[a-z]{4,}/i.test(ar)) push('warning', `«${field}»: الحقل العربي بلا حروف عربية.`);
                const [s, l] = [Math.min(ar.length, en.length), Math.max(ar.length, en.length)];
                if (l > 120 && s / l < 0.45) push('info', `«${field}»: أحد النصين أقصر بكثير من الآخر (${ar.length} / ${en.length}) — قد تكون الترجمة ناقصة.`);
            }
            return;
        }
        for (const [k, v] of Object.entries(node)) walk(v, type, index, `${path}.${k}`);   // plain values return at once
    };
    walk(data.profile, 'profile', null, '');
    for (const type of Object.keys(SECTIONS)) (data[type] || []).forEach((item, i) => { if (!item.hidden) walk(item, type, i, ''); });
    if (data.availability?.enabled) walk(data.availability, 'availability', null, '');
    if (data.seo) walk({ title: { ar: data.seo.ar?.title, en: data.seo.en?.title }, description: { ar: data.seo.ar?.description, en: data.seo.en?.description } }, 'seo', null, '');
    return issues;
}

const SEVERITY = { error: { icon: '⛔', label: 'خطأ', cls: 'text-red-700' }, warning: { icon: '⚠️', label: 'تنبيه', cls: 'text-amber-700' }, info: { icon: 'ℹ️', label: 'اقتراح', cls: 'text-blue-700' } };
const ORDER = { error: 0, warning: 1, info: 2 };

export async function openChecker() {
    await loadVendor('swal');
    const quality = checkContent(state.appData).sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
    const translation = checkTranslations(state.appData).sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
    const list = items => items.length ? `<ul class="space-y-2">${items.map(it => `
        <li class="flex items-start gap-3 p-2.5 rounded-xl border border-gray-200">
            <span class="text-sm ${SEVERITY[it.severity].cls} font-bold whitespace-nowrap">${SEVERITY[it.severity].icon} ${SEVERITY[it.severity].label}</span>
            <div class="flex-1 min-w-0"><p class="text-xs text-gray-500" dir="auto">${escapeHTML(it.where)}</p><p class="text-sm">${escapeHTML(it.message)}</p></div>
            ${it.type !== 'seo' && it.type !== 'availability' ? `<button type="button" class="px-2.5 py-1 rounded-lg bg-gray-100 text-xs font-bold" data-fix-type="${it.type}" data-fix-index="${it.index ?? ''}">تعديل</button>` : ''}
        </li>`).join('')}</ul>` : '<p class="text-sm text-green-700 py-6 text-center">✅ لا توجد ملاحظات</p>';
    const count = items => `${items.filter(i => i.severity === 'error').length} خطأ · ${items.filter(i => i.severity === 'warning').length} تنبيه · ${items.filter(i => i.severity === 'info').length} اقتراح`;
    await Swal.fire({
        title: 'مدقق المحتوى',
        width: '820px',
        html: `<div class="text-right" dir="rtl">
            <div class="flex gap-2 mb-4" role="tablist">
                <button type="button" role="tab" aria-selected="true" data-tab="quality" class="px-4 py-1.5 rounded-full text-xs font-bold bg-primary text-white">جودة السيرة (${quality.length})</button>
                <button type="button" role="tab" aria-selected="false" data-tab="translation" class="px-4 py-1.5 rounded-full text-xs font-bold bg-gray-100">الترجمة (${translation.length})</button>
            </div>
            <div data-panel="quality"><p class="text-xs text-gray-500 mb-2">${count(quality)}</p>${list(quality)}</div>
            <div data-panel="translation" class="hidden"><p class="text-xs text-gray-500 mb-2">${count(translation)}</p>${list(translation)}</div>
        </div>`,
        showConfirmButton: false,
        showCloseButton: true,
        didOpen: popup => popup.addEventListener('click', e => {
            const tab = e.target.closest('[data-tab]');
            if (tab) {
                popup.querySelectorAll('[data-tab]').forEach(b => {
                    const on = b === tab;
                    b.setAttribute('aria-selected', String(on));
                    b.className = `px-4 py-1.5 rounded-full text-xs font-bold ${on ? 'bg-primary text-white' : 'bg-gray-100'}`;
                });
                popup.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== tab.dataset.tab));
                return;
            }
            const fix = e.target.closest('[data-fix-type]');
            if (!fix) return;
            Swal.close();
            const { fixType, fixIndex } = fix.dataset;
            setTimeout(() => (fixType === 'profile' ? manageProfile() : editItem(fixType, Number(fixIndex))), 200);
        })
    });
}

// ─── 7. Hidden sections (items are toggled with the eye button on each card) ───
export const HIDEABLE = {
    experience: 'الخبرات', education: 'التعليم', volunteer: 'التطوع', skills: 'المهارات', certificates: 'الشهادات',
    workshops: 'ورش العمل', languages: 'اللغات', projects: 'المشاريع', stats: 'الأرقام في الرئيسية',
    github: 'قسم GitHub', status: 'مراقبة الأنظمة', whatsapp: 'بطاقة واتساب', vcard: 'حفظ جهة الاتصال'
};

async function manageVisibility() {
    const hidden = new Set(state.appData.visibility?.sections || []);
    const { value } = await Swal.fire({
        title: 'إظهار وإخفاء الأقسام',
        width: '620px',
        html: `<div class="text-right space-y-3" dir="rtl">
            <p class="text-xs text-gray-500">القسم المخفي لا يظهر للزوار ولا في الطباعة، ويبقى محتواه محفوظاً. لإخفاء عنصر واحد استخدم زر العين 👁 على بطاقته.</p>
            <div class="grid grid-cols-2 gap-2">${Object.entries(HIDEABLE).map(([id, label]) => `
                <label class="flex items-center gap-2 p-2 rounded-lg border border-gray-200 text-sm"><input type="checkbox" class="w-4 h-4" data-vis="${id}" ${hidden.has(id) ? '' : 'checked'}> ${label}</label>`).join('')}
            </div></div>`,
        showCancelButton: true, confirmButtonText: 'تطبيق', cancelButtonText: 'إلغاء',
        preConfirm: () => [...document.querySelectorAll('[data-vis]')].filter(b => !b.checked).map(b => b.dataset.vis)
    });
    if (!value) return;
    if (value.length) state.appData.visibility = { ...(state.appData.visibility || {}), sections: value };
    else delete state.appData.visibility;
    renderAll();
    showToast('تم التطبيق — اضغط «حفظ» لنشره ✅', 'success');
}

// ─── 8. "Open to work" badge ───
async function manageAvailability() {
    const a = state.appData.availability || {};
    const pair = (key, label, ph = {}) => `
        <div class="grid grid-cols-2 gap-2">
            <label class="block text-xs text-gray-500">${label} (AR)<input class="swal2-input m-0 mt-1 w-full" dir="rtl" data-av="${key}.ar" value="${escapeHTML(a[key]?.ar || '')}" placeholder="${escapeHTML(ph.ar || '')}"></label>
            <label class="block text-xs text-gray-500 text-left">${label} (EN)<input class="swal2-input m-0 mt-1 w-full" dir="ltr" data-av="${key}.en" value="${escapeHTML(a[key]?.en || '')}" placeholder="${escapeHTML(ph.en || '')}"></label>
        </div>`;
    const { value } = await Swal.fire({
        title: 'متاح للعمل',
        width: '720px',
        html: `<div class="text-right space-y-3" dir="rtl">
            <label class="flex items-center gap-2 text-sm font-bold"><input type="checkbox" id="av-enabled" class="w-4 h-4" ${a.enabled ? 'checked' : ''}> إظهار شارة «متاح للعمل» أعلى الصفحة الرئيسية</label>
            ${pair('status', 'نص الشارة', { ar: 'متاح للعمل', en: 'Open to work' })}
            ${pair('roles', 'المجالات', { ar: 'الدعم التقني، الشبكات، التحول الرقمي', en: 'IT Support, Networking, Digital Transformation' })}
            ${pair('cities', 'المدن', { ar: 'الرياض، المدينة المنورة', en: 'Riyadh, Madinah' })}
            ${pair('types', 'نوع العمل', { ar: 'دوام كامل، عن بُعد', en: 'Full-time, Remote' })}
        </div>`,
        showCancelButton: true, confirmButtonText: 'تطبيق', cancelButtonText: 'إلغاء', focusConfirm: false,
        preConfirm: () => {
            const out = { enabled: document.getElementById('av-enabled').checked };
            document.querySelectorAll('[data-av]').forEach(el => {
                const [key, lang] = el.dataset.av.split('.');
                out[key] = { ...(out[key] || {}), [lang]: el.value.trim() };
            });
            if (out.enabled && !out.status.ar && !out.status.en) { out.status = { ar: 'متاح للعمل', en: 'Open to work' }; }
            return out;
        }
    });
    if (!value) return;
    state.appData.availability = value;
    renderAll();
    showToast('تم التطبيق — اضغط «حفظ» لنشره ✅', 'success');
}

// ─── 9. SEO: title, description and share image per language ───
async function manageSeo() {
    const seo = state.appData.seo || {};
    const field = (lang, key, label, max) => {
        const v = escapeHTML(seo[lang]?.[key] || '');
        const attrs = `dir="${lang === 'ar' ? 'rtl' : 'ltr'}" data-seo="${lang}.${key}" maxlength="${max + 40}"`;
        const control = key === 'description'
            ? `<textarea class="swal2-textarea h-20 m-0 mt-1 w-full" ${attrs}>${v}</textarea>`
            : `<input class="swal2-input m-0 mt-1 w-full" ${attrs} value="${v}">`;
        return `<label class="block text-xs text-gray-500">${label} (${lang.toUpperCase()}) <span class="font-mono" data-count="${lang}-${key}" data-max="${max}"></span>${control}</label>`;
    };
    const { value } = await Swal.fire({
        title: 'إعدادات SEO والمشاركة',
        width: '760px',
        html: `<div class="text-right space-y-3" dir="rtl">
            <p class="text-xs text-gray-500">تظهر في نتائج Google وفي معاينة الرابط عند مشاركته (واتساب، LinkedIn، X). تُكتب في صفحة الموقع عند النشر لتقرأها المنصات دون JavaScript. اتركها فارغة لاستخدام النص الافتراضي.</p>
            <div class="grid md:grid-cols-2 gap-3">${field('ar', 'title', 'العنوان', 60)}${field('en', 'title', 'Title', 60)}</div>
            <div class="grid md:grid-cols-2 gap-3">${field('ar', 'description', 'الوصف', 160)}${field('en', 'description', 'Description', 160)}</div>
            <div class="p-3 rounded-xl border border-gray-200" aria-label="معاينة Google">
                <p class="text-[11px] text-gray-500 mb-1">معاينة في Google</p>
                <p class="text-[#1a0dab] text-lg leading-tight" id="seo-prev-title"></p>
                <p class="text-[#006621] text-xs" dir="ltr">osamaal-harbi.github.io › CV</p>
                <p class="text-sm text-gray-600" id="seo-prev-desc"></p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <input id="seo-image" class="swal2-input m-0 flex-1" dir="ltr" placeholder="assets/img/og-image.jpg" value="${escapeHTML(seo.image || '')}" aria-label="صورة المشاركة">
                <button type="button" id="seo-upload" class="px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold">رفع صورة 1200×630</button>
            </div>
        </div>`,
        showCancelButton: true, confirmButtonText: 'تطبيق', cancelButtonText: 'إلغاء', focusConfirm: false,
        didOpen: popup => {
            const update = () => {
                popup.querySelectorAll('[data-count]').forEach(c => {
                    const el = popup.querySelector(`[data-seo="${c.dataset.count.replace('-', '.')}"]`);
                    const n = el.value.length, max = Number(c.dataset.max);
                    c.textContent = `${n}/${max}`;
                    c.className = `font-mono ${n > max ? 'text-red-600 font-bold' : 'text-gray-400'}`;
                });
                popup.querySelector('#seo-prev-title').textContent = popup.querySelector('[data-seo="ar.title"]').value || 'أسامة الحربي | الرئيسية';
                popup.querySelector('#seo-prev-desc').textContent = popup.querySelector('[data-seo="ar.description"]').value || 'الموقع الشخصي لأسامة عبدالعزيز الحربي…';
            };
            popup.addEventListener('input', update);
            update();
            // The image crop dialog replaces this one; reopen afterwards with the new path filled in
            popup.querySelector('#seo-upload').addEventListener('click', async () => {
                const draft = collect();
                const path = await uploadImage(IMAGE_PRESETS.og, 'images/og');
                state.appData.seo = { ...draft, ...(path ? { image: path } : {}) };
                manageSeo();
            });
        },
        preConfirm: () => collect()
    });
    if (!value) return;
    const empty = !value.image && ['ar', 'en'].every(l => !value[l].title && !value[l].description);
    if (empty) delete state.appData.seo; else state.appData.seo = value;
    renderAll();
    showToast('تم التطبيق — اضغط «حفظ» لنشره ✅', 'success');
}

function collect() {
    const out = { ar: {}, en: {} };
    document.querySelectorAll('[data-seo]').forEach(el => { const [lang, key] = el.dataset.seo.split('.'); out[lang][key] = el.value.trim(); });
    const image = document.getElementById('seo-image')?.value.trim() || '';
    if (image && !safeAssetUrl(image)) { Swal.showValidationMessage('مسار الصورة غير صالح'); return false; }
    return { ...out, image };
}

// ─── Tools menu (keeps the toolbar short) ───
const TOOLS = [
    { action: 'manage-visibility',   icon: 'fa-eye-slash',   label: 'إظهار وإخفاء الأقسام', run: manageVisibility },
    { action: 'manage-availability', icon: 'fa-briefcase',   label: 'متاح للعمل',            run: manageAvailability },
    { action: 'manage-seo',          icon: 'fa-magnifying-glass', label: 'SEO والمشاركة',   run: manageSeo },
    { action: 'upload-photo',        icon: 'fa-camera',      label: 'رفع الصورة الشخصية',   run: uploadProfilePhoto },
    { action: 'open-checker',        icon: 'fa-list-check',  label: 'مدقق المحتوى والترجمة', run: openChecker },
    { action: 'open-history',        icon: 'fa-clock-rotate-left', label: 'سجل التعديلات',  run: openHistory }
];

export async function openTools() {
    await loadVendor('swal');
    const others = [
        ['manage-theme', 'fa-palette', 'ألوان الموقع'], ['manage-github', 'fa-github', 'GitHub'],
        ['manage-monitor', 'fa-heart-pulse', 'مراقبة الأنظمة'], ['manage-profile', 'fa-user-pen', 'الملف الشخصي'], ['analytics', 'fa-chart-bar', 'الإحصائيات']
    ];
    const tile = (action, icon, label) => `<button type="button" data-tool="${action}" class="flex flex-col items-center gap-2 p-4 rounded-2xl border border-gray-200 hover:border-primary hover:bg-gray-50 transition text-sm font-bold">
        <i class="${icon === 'fa-github' ? 'fab' : 'fas'} ${icon} text-xl text-primary" aria-hidden="true"></i>${label}</button>`;
    await Swal.fire({
        title: 'أدوات المدير',
        width: '640px',
        html: `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3" dir="rtl">${TOOLS.map(t => tile(t.action, t.icon, t.label)).join('')}${others.map(o => tile(...o)).join('')}</div>`,
        showConfirmButton: false,
        showCloseButton: true,
        didOpen: popup => popup.addEventListener('click', e => {
            const btn = e.target.closest('[data-tool]');
            if (!btn) return;
            Swal.close();
            const own = TOOLS.find(t => t.action === btn.dataset.tool);
            // other tools are ordinary toolbar actions: dispatch a click on the matching toolbar button
            setTimeout(() => (own ? own.run() : document.querySelector(`#admin-toolbar [data-action="${btn.dataset.tool}"]`)?.click()), 150);
        })
    });
}

export { manageVisibility, manageAvailability, manageSeo };
