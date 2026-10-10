// Admin panel (loaded only after login): GitHub session, editors, drag & drop and saving.
// The token is kept in sessionStorage only and expires after SESSION_DURATION.
import { SESSION_KEYS, state } from './state.js';
import { local, session } from './storage.js';
import { escapeHTML, loadVendor, setDeepValue, showToast, skillLevel } from './utils.js';
import { renderAll } from './render.js';
import { closeDialog, openDialog } from './modal.js';
import { DEFAULT_THEME, PRESETS, applyTheme, harmonies, isHex, syncSiteTheme } from './color.js';
import { diffLines, diffStats, hunks } from './diff.js';

let githubInfo     = { token: '', repo: '' };

const SESSION_DURATION   = 60 * 60 * 1000;

const REPO_PATTERN       = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

let sessionTimer         = null;

function readSession() {
    return {
        token:     session.get(SESSION_KEYS.token),
        repo:      session.get(SESSION_KEYS.repo),
        loginTime: Number(session.get(SESSION_KEYS.loginTime)) || 0
    };
}

function isSessionExpired(loginTime) {
    return !loginTime || Date.now() - loginTime > SESSION_DURATION;
}

function clearSession() {
    Object.values(SESSION_KEYS).forEach(k => session.remove(k));
    githubInfo = { token: '', repo: '' };
    if (sessionTimer) { clearTimeout(sessionTimer); sessionTimer = null; }
}

function scheduleSessionExpiry(loginTime) {
    if (sessionTimer) clearTimeout(sessionTimer);
    sessionTimer = setTimeout(expireSession, Math.max(0, loginTime + SESSION_DURATION - Date.now()));
}

// Drops the token but keeps unsaved edits on the page: logging in again resumes where you were.
function expireSession() {
    clearSession();
    showToast('انتهت الجلسة — سجّل الدخول مجدداً للحفظ، تعديلاتك باقية / Session expired — log in again to save', 'error');
    if (state.isAdmin) openDialog(document.getElementById('admin-modal'));
}

export function checkSession() {
    const { token, repo, loginTime } = readSession();
    if (!token) return;
    if (isSessionExpired(loginTime)) { expireSession(); return; }
    githubInfo.repo  = repo;
    githubInfo.token = token;
    scheduleSessionExpiry(loginTime);
    enableAdminMode();
}

function githubHeaders(token) {
    return {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
    };
}

// ── GitHub helpers shared with the lazily loaded admin tools (js/admin-tools.js) ──
export function ghApi(path, init = {}) {
    if (isSessionExpired(readSession().loginTime)) { expireSession(); return Promise.reject(new Error('انتهت الجلسة')); }
    return fetch(`https://api.github.com/repos/${githubInfo.repo}${path}`, {
        cache: 'no-store',      // the API answers with max-age=60; a cached sha would make the next write fail
        ...init,
        headers: { ...githubHeaders(githubInfo.token), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers }
    });
}

// Creates or replaces a file in the repository (content already base64). Returns the API response.
export async function putRepoFile(path, base64, message) {
    const url = `/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
    let sha;
    const existing = await ghApi(url);
    if (existing.ok) sha = (await existing.json()).sha;
    else if (existing.status !== 404) throw new Error(`HTTP ${existing.status}`);
    return ghApi(url, { method: 'PUT', body: JSON.stringify({ message, content: base64, ...(sha ? { sha } : {}) }) });
}

// Line-by-line diff as HTML (− removed, + added; signs as well as colours)
export function diffHTML(before, after, { context = 3, maxLines = 400 } = {}) {
    const ops = diffLines(before, after);
    const { added, removed } = diffStats(ops);
    if (!added && !removed) return { html: '<p class="text-xs text-gray-500">لا توجد فروق.</p>', added, removed };
    const lines = hunks(ops, context);
    const rows = lines.slice(0, maxLines).map(o => {
        if (o.op === '…') return '<div class="px-2 text-gray-400 select-none">⋯</div>';
        const cls = o.op === '+' ? 'bg-green-50 text-green-900' : o.op === '-' ? 'bg-red-50 text-red-900 line-through decoration-red-300' : 'text-gray-600';
        const num = o.op === '-' ? o.a : o.b;
        return `<div class="flex ${cls}"><span class="w-10 shrink-0 text-end pe-2 text-gray-400 select-none">${num ?? ''}</span><span class="w-4 shrink-0 select-none font-bold">${o.op === ' ' ? '' : o.op}</span><span class="whitespace-pre-wrap break-all">${escapeHTML(o.text)}</span></div>`;
    }).join('');
    const more = lines.length > maxLines ? `<div class="px-2 text-gray-500">… و${lines.length - maxLines} سطراً آخر</div>` : '';
    return {
        added, removed,
        html: `<div class="diff font-mono text-[11px] leading-5 text-left max-h-[45vh] overflow-auto rounded-lg border border-gray-200" dir="ltr">${rows}${more}</div>`
    };
}

export async function authenticateAndEdit() {
    const repoInput  = document.getElementById('repo-input');
    const tokenInput = document.getElementById('token-input');
    const repo  = repoInput.value.trim();
    const token = tokenInput.value.trim();
    if (!repo || !token) return showToast('يرجى إدخال البيانات كاملة', 'error');
    if (!REPO_PATTERN.test(repo)) return showToast('صيغة المستودع غير صحيحة (owner/repo)', 'error');

    // Verify access before enabling admin mode, so a bad token fails here and not on save.
    try {
        const res = await fetch(`https://api.github.com/repos/${repo}`, { headers: githubHeaders(token) });
        if (!res.ok) throw new Error(String(res.status));
    } catch {
        return showToast('تعذّر الوصول للمستودع. تحقق من الـ Token / Could not access the repository', 'error');
    }

    tokenInput.value = '';
    const loginTime = Date.now();
    session.set(SESSION_KEYS.token, token);
    session.set(SESSION_KEYS.repo, repo);
    session.set(SESSION_KEYS.loginTime, String(loginTime));
    local.set('saved_repo', repo);   // repo name only, not secret
    githubInfo.repo = repo; githubInfo.token = token;
    scheduleSessionExpiry(loginTime);
    closeDialog(document.getElementById('admin-modal'));
    enableAdminMode();
    showToast('تم تفعيل وضع المدير 🚀', 'success');
    if (!token.startsWith('github_pat_')) {
        setTimeout(() => showToast('⚠️ يُفضّل Fine-grained PAT مقيّد بهذا المستودع / Prefer a fine-grained PAT', 'info'), 800);
    }
}

function enableAdminMode() {
    if (!state.isAdmin) window.addEventListener('beforeunload', warnUnsaved);
    state.isAdmin = true;
    document.body.classList.add('admin-mode');
    document.getElementById('admin-toolbar').classList.remove('hidden');
    if (state.dataLoaded) renderAll();
}

const hasUnsavedChanges = () => state.lastSavedSnapshot !== null && JSON.stringify(state.appData) !== state.lastSavedSnapshot;

// Closing the tab, reloading or logging out with unsaved edits asks first.
function warnUnsaved(e) {
    if (!hasUnsavedChanges()) return;
    e.preventDefault();
    e.returnValue = '';
}

export function logout() {
    clearSession();
    location.reload();
}

// btoa() only accepts Latin-1, so encode the UTF-8 bytes first (and the reverse for reading).
export function toBase64Utf8(text) {
    let binary = '';
    new TextEncoder().encode(text).forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
}

export function fromBase64Utf8(b64) {
    const binary = atob(String(b64).replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
}

const SECTION_NAMES = {
    profile: 'الملف الشخصي', experience: 'الخبرات', education: 'التعليم', volunteer: 'التطوع', skills: 'المهارات',
    projects: 'المشاريع', certificates: 'الشهادات', workshops: 'ورش العمل', languages: 'اللغات',
    github: 'GitHub', monitor: 'المراقبة', theme: 'ألوان الموقع', analytics: 'الإحصائيات',
    visibility: 'الأقسام المخفية', availability: 'متاح للعمل', seo: 'SEO', monitorAlerts: 'تنبيهات المراقبة'
};

// Which sections differ from the last loaded/saved version, e.g. ["الخبرات (+1)", "الملف الشخصي"].
export function describeChanges(before, after) {
    const keys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
    return keys.filter(k => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k])).map(k => {
        const name = SECTION_NAMES[k] || k;
        if (Array.isArray(before?.[k]) && Array.isArray(after?.[k])) {
            const diff = after[k].length - before[k].length;
            if (diff) return `${name} (${diff > 0 ? '+' : ''}${diff})`;
        }
        return name;
    });
}

let saving = false;

export async function saveToGitHub() {
    if (isSessionExpired(readSession().loginTime)) { expireSession(); return; }
    if (saving) return;                                   // a second click would PUT with a stale sha
    const before  = state.lastSavedSnapshot ? JSON.parse(state.lastSavedSnapshot) : {};
    const changes = describeChanges(before, state.appData);
    if (!changes.length) { showToast('لا توجد تعديلات للحفظ / Nothing to save', 'info'); return; }

    const btn      = document.querySelector('#admin-toolbar [data-action="save"]');
    const origHTML = btn.innerHTML;
    saving = true;
    btn.disabled = true;
    btn.innerHTML  = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const url    = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        // no-store: the API answers with max-age=60, and a cached sha makes the next save fail (409)
        const getRes = await fetch(url, { headers: githubHeaders(githubInfo.token), cache: 'no-store' });
        if (!getRes.ok) throw new Error('فشل الاتصال. تحقق من الـ Token.');
        const fileData = await getRes.json();

        await loadVendor('swal');
        let remoteChanged = false, remoteText = '';
        try {
            const remote = JSON.parse(fromBase64Utf8(fileData.content));
            remoteChanged = JSON.stringify(remote) !== state.lastSavedSnapshot;
            remoteText = JSON.stringify(remote, null, 2);
        } catch { remoteChanged = true; }
        const json = JSON.stringify(state.appData, null, 2) + '\n';
        // Preview: exactly what changes in the file on GitHub, line by line
        const diff = diffHTML(remoteText, json.trimEnd());
        const answer = await Swal.fire({
            title: 'حفظ التعديلات في GitHub؟',
            width: '820px',
            html: `<div class="text-right" dir="rtl"><p class="text-sm mb-2">الأقسام المعدّلة:</p>
                   <ul class="text-sm font-bold list-disc ps-6">${changes.map(c => `<li>${escapeHTML(c)}</li>`).join('')}</ul>
                   ${remoteChanged ? `<p class="mt-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm">⚠️ تغيّر ملف data.json في GitHub منذ تحميل الصفحة (تعديل أو commit آخر). الحفظ سيستبدل تلك التغييرات.</p>` : ''}
                   <details class="mt-4" open><summary class="cursor-pointer text-sm font-bold mb-2">معاينة الفرق سطراً بسطر
                       <span class="font-mono text-xs" dir="ltr"><span class="text-green-700">+${diff.added}</span> <span class="text-red-600">−${diff.removed}</span></span></summary>
                       ${diff.html}</details></div>`,
            icon: remoteChanged ? 'warning' : 'question',
            showCancelButton: true,
            confirmButtonText: remoteChanged ? 'استبدال وحفظ' : 'حفظ',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: remoteChanged ? '#d33' : '#2563eb'
        });
        if (!answer.isConfirmed) return;

        const putRes = await fetch(url, {
            method: 'PUT',
            headers: { ...githubHeaders(githubInfo.token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: `Update data.json via admin panel (${changes.join(', ')})`, content: toBase64Utf8(json), sha: fileData.sha })
        });
        if (putRes.status === 409) throw new Error('تعارض: الملف تغيّر أثناء الحفظ، أعد المحاولة');
        if (!putRes.ok) throw new Error('فشل الحفظ في GitHub');
        state.lastSavedSnapshot = JSON.stringify(state.appData);
        showToast('تم الحفظ في GitHub ✅ يظهر على الموقع خلال دقيقة تقريباً', 'success');
    } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
    } finally {
        saving = false;
        btn.disabled = false;
        btn.innerHTML = origHTML;
    }
}

// Reverts unsaved edits to the last version loaded from or saved to GitHub (memory only).
export async function restoreBackup() {
    if (!state.lastSavedSnapshot) { showToast('لا توجد نسخة احتياطية', 'error'); return; }
    if (!hasUnsavedChanges()) { showToast('لا توجد تعديلات غير محفوظة', 'info'); return; }
    await loadVendor('swal');
    const { isConfirmed } = await Swal.fire({
        title: 'التراجع عن كل التعديلات غير المحفوظة؟', icon: 'warning',
        showCancelButton: true, confirmButtonText: 'نعم، تراجع', cancelButtonText: 'إلغاء', confirmButtonColor: '#d33'
    });
    if (!isConfirmed) return;
    state.appData = JSON.parse(state.lastSavedSnapshot);
    renderAll();
    showToast('تم التراجع إلى آخر نسخة محفوظة ✅', 'success');
}

const SCHEMAS = {
    skills: [
        { key: 'ar',       label: 'اسم المهارة (عربي)',   simple: true },
        { key: 'en',       label: 'Skill Name (English)', simple: true },
        { key: 'level',    label: 'المستوى % (0-100)',    simple: true, number: true },
        { key: 'category', label: 'النوع / Type',         simple: true, options: { hard: 'تقنية / Technical', soft: 'شخصية / Soft' } }
    ],
    experience: [
        { key: 'role',        label: 'المسمى الوظيفي / Role' },
        { key: 'company',     label: 'الشركة / Company' },
        { key: 'period',      label: 'الفترة / Period' },
        { key: 'description', label: 'الوصف / Description', type: 'textarea' }
    ],
    education: [
        { key: 'degree',      label: 'الدرجة العلمية / Degree' },
        { key: 'institution', label: 'المؤسسة / Institution' },
        { key: 'period',      label: 'التاريخ / Date' },
        { key: 'description', label: 'الوصف / Description', type: 'textarea' }
    ],
    volunteer: [
        { key: 'role',         label: 'الدور / Role' },
        { key: 'organization', label: 'المنظمة / Organization' },
        { key: 'period',       label: 'الفترة / Period' },
        { key: 'hours',        label: 'عدد الساعات / Hours', simple: true },
        { key: 'description',  label: 'الوصف / Description', type: 'textarea' }
    ],
    projects: [
        { key: 'title',               label: 'العنوان / Title' },
        { key: 'desc',                label: 'الوصف / Description', type: 'textarea' },
        { key: 'technologies',        label: 'التقنيات / Technologies (مفصولة بفاصلة)', simple: true, array: true },
        { key: 'link',                label: 'رابط GitHub',    simple: true },
        { key: 'liveUrl',             label: 'رابط Live Demo', simple: true },
        { key: 'details_challenges',  label: 'التحديات / Challenges', type: 'textarea', nested: 'details', subkey: 'challenges' },
        { key: 'details_results',     label: 'النتائج / Results',     type: 'textarea', nested: 'details', subkey: 'results'    }
    ],
    certificates: [
        { key: 'name',       label: 'اسم الشهادة / Name' },
        { key: 'issuer',     label: 'الجهة المانحة / Issuer' },
        { key: 'credential', label: 'Credential ID', simple: true },
        { key: 'url',        label: 'رابط التحقق / Verification URL (https://)', simple: true },
        { key: 'date',       label: 'التاريخ / Date', simple: true },
        { key: 'image',      label: 'صورة الشهادة (اختياري)', simple: true, upload: 'certificate' }
    ],
    workshops: [
        { key: 'name',      label: 'اسم الورشة / Name' },
        { key: 'organizer', label: 'الجهة المنظمة / Organizer' },
        { key: 'date',      label: 'التاريخ / Date' }
    ],
    languages: [
        { key: 'name',  label: 'اللغة / Language' },
        { key: 'level', label: 'المستوى / Level' }
    ]
};

// draft: values typed before an image upload interrupted the dialog (it reopens with them)
async function manageItem(type, index = null, draft = null) {
    if (!state.isAdmin) return;
    const isEdit = index !== null;
    const saved  = isEdit ? (state.appData[type] || [])[index] : {};
    const item   = draft ? { ...saved, ...draft } : saved;
    const schema = SCHEMAS[type];
    if (!schema) return;
    await loadVendor('swal');

    // Helper: get value supporting nested objects (e.g. details.challenges)
    const getVal = (obj, f, lang) => {
        let src = obj;
        if (f.nested) src = obj[f.nested] || {};
        const k = f.subkey || f.key;
        if (!src[k]) return '';
        if (typeof src[k] === 'object') return src[k][lang] || '';
        return String(src[k]);
    };
    const getSimple = (obj, f) => {
        let src = obj;
        if (f.nested) src = obj[f.nested] || {};
        const k = f.subkey || f.key;
        const v = src[k];
        if (Array.isArray(v)) return v.join(', ');
        return v ?? '';
    };

    const html = schema.map(f => {
        // Simple field (string / array)
        if (f.options) {
            const current = isEdit ? getSimple(item, f) : (type === 'skills' ? state.activeSkillTab : '');
            return `<div class="mb-3">
                <label class="block text-xs mb-1 text-gray-500 text-right" for="swal-${f.key}">${f.label}</label>
                <select id="swal-${f.key}" class="swal2-select m-0 w-full">
                    ${Object.entries(f.options).map(([v, label]) => `<option value="${v}"${v === current ? ' selected' : ''}>${label}</option>`).join('')}
                </select>
            </div>`;
        }
        if (f.simple) {
            const val = isEdit || draft ? getSimple(item, f) : '';
            const hint = f.array ? ' <span class="text-gray-400 text-xs">(مفصولة بفاصلة)</span>' : '';
            return `<div class="mb-3">
                <label class="block text-xs mb-1 text-gray-500 text-right" for="swal-${f.key}">${f.label}${hint}</label>
                <div class="flex gap-2"><input id="swal-${f.key}" class="swal2-input m-0 w-full" value="${escapeHTML(val)}" dir="ltr">
                ${f.upload ? `<button type="button" id="swal-${f.key}-upload" class="px-3 rounded-lg bg-blue-600 text-white text-xs font-bold whitespace-nowrap">رفع صورة</button>` : ''}</div>
            </div>`;
        }
        const valAr = getVal(item, f, 'ar');
        const valEn = getVal(item, f, 'en');
        if (f.type === 'textarea') {
            return `<div class="grid grid-cols-2 gap-2 mb-3">
                <div><label class="block text-xs mb-1 text-gray-500 text-right">${f.label} (AR)</label>
                <textarea id="swal-${f.key}-ar" class="swal2-textarea m-0 w-full h-24 text-right" dir="rtl">${escapeHTML(valAr)}</textarea></div>
                <div><label class="block text-xs mb-1 text-gray-500 text-left">${f.label} (EN)</label>
                <textarea id="swal-${f.key}-en" class="swal2-textarea m-0 w-full h-24 text-left" dir="ltr">${escapeHTML(valEn)}</textarea></div>
            </div>`;
        }
        return `<div class="grid grid-cols-2 gap-2 mb-3">
            <div><label class="block text-xs mb-1 text-gray-500 text-right">${f.label} (AR)</label>
            <input id="swal-${f.key}-ar" class="swal2-input m-0 w-full text-right" value="${escapeHTML(valAr)}" dir="rtl"></div>
            <div><label class="block text-xs mb-1 text-gray-500 text-left">${f.label} (EN)</label>
            <input id="swal-${f.key}-en" class="swal2-input m-0 w-full text-left" value="${escapeHTML(valEn)}" dir="ltr"></div>
        </div>`;
    }).join('');

    const collect = () => {
            const obj = {};
            schema.forEach(f => {
                const inputId = `swal-${f.key}`;
                if (f.simple) {
                    let raw = document.getElementById(inputId)?.value ?? '';
                    // Array fields: split by comma and trim
                    const val = f.array
                        ? raw.split(',').map(x => x.trim()).filter(Boolean)
                        : (f.number ? skillLevel({ level: raw }) : raw);
                    if (f.nested) {
                        if (!obj[f.nested]) obj[f.nested] = {};
                        obj[f.nested][f.subkey || f.key] = val;
                    } else {
                        obj[f.key] = val;
                    }
                } else {
                    const val = {
                        ar: document.getElementById(`${inputId}-ar`)?.value ?? '',
                        en: document.getElementById(`${inputId}-en`)?.value ?? ''
                    };
                    if (f.nested) {
                        if (!obj[f.nested]) obj[f.nested] = {};
                        obj[f.nested][f.subkey || f.key] = val;
                    } else {
                        obj[f.key] = val;
                    }
                }
            });
            return obj;
    };

    const { value } = await Swal.fire({
        title: isEdit ? 'تعديل البيانات' : 'إضافة جديدة',
        html: `<div class="text-right" dir="rtl">${html}</div>`,
        width: '700px', confirmButtonText: 'حفظ التغييرات',
        showCancelButton: true, cancelButtonText: 'إلغاء',
        focusConfirm: false,
        didOpen: popup => schema.filter(f => f.upload).forEach(f => {
            popup.querySelector(`#swal-${f.key}-upload`)?.addEventListener('click', async () => {
                const typed = collect();
                Swal.close();
                const tools = await import('./admin-tools.js');
                const title = typed.name?.en || typed.name?.ar || typed.title?.en || type;
                const path = await tools.uploadImage(tools.IMAGE_PRESETS[f.upload], `images/${type}/${tools.slug(title)}`);
                manageItem(type, index, { ...typed, ...(path ? { [f.key]: path } : {}) });
            });
        }),
        preConfirm: collect
    });

    if (value) {
        if (!state.appData[type]) state.appData[type] = [];
        // Merge: fields the editor does not show (added by hand in data.json) are kept
        if (isEdit) state.appData[type][index] = { ...saved, ...value }; else state.appData[type].push(value);
        if (type === 'skills' && value.category !== state.activeSkillTab) state.activeSkillTab = value.category;
        renderAll();
        showToast(isEdit ? 'تم التعديل ✅' : 'تمت الإضافة ✅', 'success');
    }
}

export function addItem(type)         { return type === 'projects' ? manageProjectItem() : manageItem(type); }

export function editItem(type, index) { return type === 'projects' ? manageProjectItem(index) : manageItem(type, index); }

// ── Dedicated project editor (handles technologies array + nested details) ──
async function manageProjectItem(index = null, draft = null) {
    if (!state.isAdmin) return;
    await loadVendor('swal');
    const isEdit = index !== null;
    const saved  = isEdit ? (state.appData.projects || [])[index] : {};
    const item   = draft ? { ...saved, ...draft } : saved;

    // Helper: extract bilingual string
    const bv = (obj, lang) => {
        if (!obj) return '';
        if (typeof obj === 'object') return obj[lang] || obj.ar || '';
        return String(obj);
    };

    const techVal   = Array.isArray(item.technologies) ? item.technologies.join(', ') : (item.technologies || '');
    const challAr   = bv(item.details?.challenges, 'ar');
    const challEn   = bv(item.details?.challenges, 'en');
    const resultsAr = bv(item.details?.results,    'ar');
    const resultsEn = bv(item.details?.results,    'en');

    // validate = false while an image upload interrupts the dialog (an untitled draft is fine then)
    const collectProject = validate => {
            const titleAr = document.getElementById('pj-title-ar')?.value.trim();
            const titleEn = document.getElementById('pj-title-en')?.value.trim();
            if (validate && !titleAr && !titleEn) {
                Swal.showValidationMessage(state.currentLang === 'ar' ? 'يرجى إدخال عنوان المشروع' : 'Please enter a project title');
                return false;
            }
            const rawTech = document.getElementById('pj-tech')?.value || '';
            const techs   = rawTech.split(',').map(t => t.trim()).filter(Boolean);
            return {
                title: {
                    ar: titleAr || titleEn,
                    en: titleEn || titleAr
                },
                desc: {
                    ar: document.getElementById('pj-desc-ar')?.value.trim() || '',
                    en: document.getElementById('pj-desc-en')?.value.trim() || ''
                },
                technologies: techs,
                link:    document.getElementById('pj-link')?.value.trim() || '#',
                liveUrl: document.getElementById('pj-live')?.value.trim() || '',
                image:   document.getElementById('pj-image')?.value.trim() || '',
                details: {
                    challenges: {
                        ar: document.getElementById('pj-chal-ar')?.value.trim() || '',
                        en: document.getElementById('pj-chal-en')?.value.trim() || ''
                    },
                    results: {
                        ar: document.getElementById('pj-res-ar')?.value.trim() || '',
                        en: document.getElementById('pj-res-en')?.value.trim() || ''
                    }
                }
            };
    };

    const { value } = await Swal.fire({
        title: isEdit
            ? (state.currentLang === 'ar' ? 'تعديل المشروع' : 'Edit Project')
            : (state.currentLang === 'ar' ? 'إضافة مشروع جديد' : 'Add New Project'),
        html: `<div class="text-right space-y-3" dir="rtl">

          <!-- Title -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">عنوان المشروع (AR)</label>
              <input id="pj-title-ar" class="swal2-input m-0 w-full text-right" value="${escapeHTML(bv(item.title,'ar'))}" dir="rtl" placeholder="اسم المشروع بالعربي">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Project Title (EN)</label>
              <input id="pj-title-en" class="swal2-input m-0 w-full text-left" value="${escapeHTML(bv(item.title,'en'))}" dir="ltr" placeholder="Project name in English">
            </div>
          </div>

          <!-- Description -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">وصف المشروع (AR)</label>
              <textarea id="pj-desc-ar" class="swal2-textarea m-0 w-full h-20 text-right" dir="rtl" placeholder="وصف مختصر...">${escapeHTML(bv(item.desc,'ar'))}</textarea>
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Description (EN)</label>
              <textarea id="pj-desc-en" class="swal2-textarea m-0 w-full h-20 text-left" dir="ltr" placeholder="Short description...">${escapeHTML(bv(item.desc,'en'))}</textarea>
            </div>
          </div>

          <!-- Technologies -->
          <div>
            <label class="block text-xs mb-1 text-gray-500">
              التقنيات المستخدمة / Technologies
              <span class="text-gray-400 mr-1">(مفصولة بفاصلة — e.g. SQL, HTML5, CSS3)</span>
            </label>
            <input id="pj-tech" class="swal2-input m-0 w-full" value="${escapeHTML(techVal)}" dir="ltr" placeholder="SQL, MySQL, HTML5, CSS3, JavaScript">
          </div>

          <!-- Challenges -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">التحديات (AR)</label>
              <textarea id="pj-chal-ar" class="swal2-textarea m-0 w-full h-20 text-right" dir="rtl" placeholder="التحديات التي واجهتها...">${escapeHTML(challAr)}</textarea>
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Challenges (EN)</label>
              <textarea id="pj-chal-en" class="swal2-textarea m-0 w-full h-20 text-left" dir="ltr" placeholder="Challenges faced...">${escapeHTML(challEn)}</textarea>
            </div>
          </div>

          <!-- Results -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">النتائج والإنجازات (AR)</label>
              <textarea id="pj-res-ar" class="swal2-textarea m-0 w-full h-20 text-right" dir="rtl" placeholder="النتائج والإنجازات...">${escapeHTML(resultsAr)}</textarea>
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Results & Achievements (EN)</label>
              <textarea id="pj-res-en" class="swal2-textarea m-0 w-full h-20 text-left" dir="ltr" placeholder="Results achieved...">${escapeHTML(resultsEn)}</textarea>
            </div>
          </div>

          <!-- Image (16:9, cropped and saved as WebP) -->
          <div>
            <label class="block text-xs mb-1 text-gray-500" for="pj-image">صورة المشروع (اختياري)</label>
            <div class="flex gap-2"><input id="pj-image" class="swal2-input m-0 w-full" value="${escapeHTML(item.image || '')}" dir="ltr" placeholder="images/projects/…webp">
            <button type="button" id="pj-image-upload" class="px-3 rounded-lg bg-blue-600 text-white text-xs font-bold whitespace-nowrap">رفع صورة</button></div>
          </div>

          <!-- Links -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500">رابط GitHub</label>
              <input id="pj-link" class="swal2-input m-0 w-full" value="${escapeHTML(item.link || '')}" dir="ltr" placeholder="https://github.com/...">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500">رابط Live Demo</label>
              <input id="pj-live" class="swal2-input m-0 w-full" value="${escapeHTML(item.liveUrl || '')}" dir="ltr" placeholder="https://...">
            </div>
          </div>

        </div>`,
        width: '760px',
        confirmButtonText: isEdit ? 'حفظ التغييرات' : 'إضافة المشروع',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        focusConfirm: false,
        didOpen: popup => popup.querySelector('#pj-image-upload').addEventListener('click', async () => {
            const typed = collectProject(false);
            Swal.close();
            const tools = await import('./admin-tools.js');
            const path = await tools.uploadImage(tools.IMAGE_PRESETS.project, `images/projects/${tools.slug(typed.title?.en || typed.title?.ar)}`);
            manageProjectItem(index, { ...typed, ...(path ? { image: path } : {}) });
        }),
        preConfirm: () => collectProject(true)
    });

    if (value) {
        if (!state.appData.projects) state.appData.projects = [];
        if (isEdit) state.appData.projects[index] = { ...saved, ...value };
        else        state.appData.projects.push(value);
        renderAll();
        showToast(isEdit ? 'تم تعديل المشروع ✅' : 'تمت إضافة المشروع ✅', 'success');
    }
}

// ── Profile editor ─────────────────────────────────────────────────────────
export async function manageProfile() {
    if (!state.isAdmin) return;
    await loadVendor('swal');
    const p = state.appData.profile || {};
    const v = (k) => p[k] || '';
    const vb = (k, lang) => (typeof p[k] === 'object' ? p[k][lang] : p[k]) || '';

    const { value } = await Swal.fire({
        title: state.currentLang === 'ar' ? 'تعديل الملف الشخصي' : 'Edit Profile',
        html: `<div class="text-right space-y-3" dir="rtl">

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">الاسم (AR)</label>
              <input id="pf-name-ar" class="swal2-input m-0 w-full text-right" value="${escapeHTML(vb('name','ar'))}" dir="rtl">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Name (EN)</label>
              <input id="pf-name-en" class="swal2-input m-0 w-full text-left" value="${escapeHTML(vb('name','en'))}" dir="ltr">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">المسمى الوظيفي (AR)</label>
              <input id="pf-title-ar" class="swal2-input m-0 w-full text-right" value="${escapeHTML(vb('title','ar'))}" dir="rtl">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Title (EN)</label>
              <input id="pf-title-en" class="swal2-input m-0 w-full text-left" value="${escapeHTML(vb('title','en'))}" dir="ltr">
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">النبذة (AR)</label>
              <textarea id="pf-summary-ar" class="swal2-textarea m-0 w-full h-20 text-right" dir="rtl">${escapeHTML(vb('summary','ar'))}</textarea>
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Summary (EN)</label>
              <textarea id="pf-summary-en" class="swal2-textarea m-0 w-full h-20 text-left" dir="ltr">${escapeHTML(vb('summary','en'))}</textarea>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-right">الموقع (AR)</label>
              <input id="pf-location-ar" class="swal2-input m-0 w-full text-right" value="${escapeHTML(vb('location','ar'))}" dir="rtl">
            </div>
            <div>
              <label class="block text-xs mb-1 text-gray-500 text-left">Location (EN)</label>
              <input id="pf-location-en" class="swal2-input m-0 w-full text-left" value="${escapeHTML(vb('location','en'))}" dir="ltr">
            </div>
          </div>

          <div>
            <label class="block text-xs mb-1 text-gray-500">البريد الإلكتروني / Email</label>
            <input id="pf-email" class="swal2-input m-0 w-full" value="${escapeHTML(v('email'))}" dir="ltr" type="email">
          </div>
          <div>
            <label class="block text-xs mb-1 text-gray-500">رقم الجوال / Phone</label>
            <input id="pf-phone" class="swal2-input m-0 w-full" value="${escapeHTML(v('phone'))}" dir="ltr">
          </div>
          <div>
            <label class="block text-xs mb-1 text-gray-500">رابط LinkedIn</label>
            <input id="pf-linkedin" class="swal2-input m-0 w-full" value="${escapeHTML(v('linkedin'))}" dir="ltr" placeholder="https://www.linkedin.com/in/osama-alharbi-it/">
          </div>
          <div>
            <label class="block text-xs mb-1 text-gray-500">رابط GitHub</label>
            <input id="pf-github" class="swal2-input m-0 w-full" value="${escapeHTML(v('github'))}" dir="ltr" placeholder="https://github.com/...">
          </div>
          <div class="p-3 rounded-xl border border-gray-200 space-y-2">
            <label class="block text-xs text-gray-500" for="pf-cv">السيرة الذاتية (PDF) — مسار في الموقع أو رابط https</label>
            <input id="pf-cv" class="swal2-input m-0 w-full" value="${escapeHTML(v('cv'))}" dir="ltr" placeholder="cv/Osama_Alharbi.pdf">
            <div class="flex flex-wrap gap-2">
              <button type="button" id="pf-cv-upload" class="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold">⬆️ رفع PDF من جهازي</button>
              <button type="button" id="pf-cv-drive" class="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-bold">رابط Google Drive</button>
              <input type="file" id="pf-cv-file" accept="application/pdf,.pdf" class="hidden">
            </div>
            <p id="pf-cv-status" class="text-xs text-gray-500" role="status"></p>
          </div>

        </div>`,
        width: '740px',
        confirmButtonText: 'حفظ التغييرات',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        focusConfirm: false,
        didOpen: popup => setupCvField(popup),
        preConfirm: () => {
            const cv = normalizeCvLink(document.getElementById('pf-cv').value);
            if (cv === null) {
                Swal.showValidationMessage('رابط السيرة الذاتية غير صالح: مسار داخل الموقع (مثل cv/file.pdf) أو رابط يبدأ بـ https://');
                return false;
            }
            return profileFields(cv);
        }
    });

    if (value) {
        state.appData.profile = { ...p, ...value };   // keeps image, nationality and any other field
        renderAll();
        showToast(state.currentLang === 'ar' ? 'تم تحديث الملف الشخصي ✅' : 'Profile updated ✅', 'success');
    }
}

function profileFields(cv) {
    return {
        name:     { ar: document.getElementById('pf-name-ar').value,     en: document.getElementById('pf-name-en').value },
        title:    { ar: document.getElementById('pf-title-ar').value,    en: document.getElementById('pf-title-en').value },
        summary:  { ar: document.getElementById('pf-summary-ar').value,  en: document.getElementById('pf-summary-en').value },
        location: { ar: document.getElementById('pf-location-ar').value, en: document.getElementById('pf-location-en').value },
        email:    document.getElementById('pf-email').value,
        phone:    document.getElementById('pf-phone').value,
        linkedin: document.getElementById('pf-linkedin').value,
        github:   document.getElementById('pf-github').value,
        cv
    };
}

// ── CV: upload a PDF into the repository (cv/…), or use a Google Drive / https link ──
const CV_MAX_BYTES = 10 * 1024 * 1024;

// Drive "view" / "open" links → direct download link; site paths and https links pass; anything else → null.
export function normalizeCvLink(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const drive = raw.match(/^https:\/\/(?:drive|docs)\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:[^#]*&)?id=)([\w-]{10,})/);
    if (drive) return `https://drive.google.com/uc?export=download&id=${drive[1]}`;
    if (/^https:\/\/[^\s]+$/i.test(raw)) return raw;
    if (/^[\w\-./]+$/.test(raw) && !raw.startsWith('/') && !raw.includes('..')) return raw;
    return null;
}

// "سيرتي الذاتية 2026.pdf" → "cv/CV_2026.pdf"; keeps Latin letters, digits, dot, dash and underscore.
export function cvPathFor(fileName) {
    const base = String(fileName || '').replace(/\.pdf$/i, '').normalize('NFKD').replace(/[^\w.-]+/g, '_').replace(/_+/g, '_').replace(/^[_.-]+|[_.-]+$/g, '');
    return `cv/${/[A-Za-z0-9]/.test(base) ? base.slice(0, 60) : 'CV'}.pdf`;
}

export function readAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

async function uploadCv(file, status) {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (!isPdf || String.fromCharCode(...head) !== '%PDF-') { status('❌ الملف ليس PDF'); return null; }
    if (file.size > CV_MAX_BYTES) { status('❌ الحجم أكبر من 10 MB'); return null; }

    const path = cvPathFor(file.name);
    status(`⏳ جاري الرفع إلى ${path}…`);
    // An existing file with the same name is replaced
    const res = await putRepoFile(path, await readAsBase64(file), `Upload CV (${path}) via admin panel`);
    if (!res.ok) { status(`❌ فشل الرفع (HTTP ${res.status})`); return null; }
    status(`✅ تم رفع الملف إلى ${path} — اضغط «حفظ التغييرات» ثم «حفظ» في شريط المدير ليُربط بأزرار التحميل.`);
    return path;
}

function setupCvField(popup) {
    const input  = popup.querySelector('#pf-cv');
    const file   = popup.querySelector('#pf-cv-file');
    const status = text => { popup.querySelector('#pf-cv-status').textContent = text; };
    popup.querySelector('#pf-cv-upload').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
        const chosen = file.files?.[0];
        file.value = '';
        if (!chosen) return;
        const confirmBtn = Swal.getConfirmButton();
        confirmBtn.disabled = true;
        try {
            const path = await uploadCv(chosen, status);
            if (path) input.value = path;
        } catch {
            status('❌ حدث خطأ أثناء الرفع');
        } finally { confirmBtn.disabled = false; }
    });
    popup.querySelector('#pf-cv-drive').addEventListener('click', () => {
        status('الصق رابط المشاركة من Google Drive في الحقل أعلاه (اجعل المشاركة: «أي شخص لديه الرابط»)، وسيُحوَّل تلقائياً إلى رابط تحميل مباشر.');
        input.value = '';
        input.placeholder = 'https://drive.google.com/file/d/…/view?usp=sharing';
        input.focus();
    });
    input.addEventListener('change', () => {
        const normal = normalizeCvLink(input.value);
        if (normal && normal !== input.value.trim()) { input.value = normal; status('✅ حُوِّل رابط Google Drive إلى رابط تحميل مباشر.'); }
    });
}

export async function deleteItem(type, index) {
    if (!state.isAdmin) return;
    await loadVendor('swal');
    const result = await Swal.fire({
        title: 'هل أنت متأكد؟', text: 'لن تتمكن من التراجع!', icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#d33',
        confirmButtonText: 'نعم، احذف', cancelButtonText: 'تراجع'
    });
    if (result.isConfirmed) { state.appData[type].splice(index, 1); renderAll(); showToast('تم الحذف', 'success'); }
}

export async function editImage(key) {
    if (!state.isAdmin) return;
    await loadVendor('swal');
    const result = await Swal.fire({
        title: 'تغيير الصورة الشخصية',
        input: 'url',
        inputLabel: 'رابط صورة https:// — أو ارفع صورة من جهازك وستُقص وتُصغَّر تلقائياً (WebP)',
        inputPlaceholder: 'https://...',
        showDenyButton: true, showCancelButton: true,
        confirmButtonText: 'استخدام الرابط', denyButtonText: 'رفع من جهازي', cancelButtonText: 'إلغاء'
    });
    if (result.isDenied) return openTool('uploadProfilePhoto');
    if (result.value) { setDeepValue(state.appData, key, result.value); renderAll(); }
}

// Hidden items stay in data.json but are not shown to visitors (eye button on each card)
export function toggleHidden(type, index) {
    if (!state.isAdmin) return;
    const item = state.appData[type]?.[index];
    if (!item) return;
    if (item.hidden) delete item.hidden; else item.hidden = true;
    renderAll();
    showToast(item.hidden ? 'أُخفي العنصر عن الزوار — اضغط «حفظ» لنشره' : 'أصبح العنصر ظاهراً — اضغط «حفظ» لنشره', 'info');
}

// Tools in js/admin-tools.js, downloaded the first time one of them is used
const openTool = (name, ...args) => import('./admin-tools.js').then(m => m[name](...args));
export const openHistory   = () => openTool('openHistory');
export const openChecker   = () => openTool('openChecker');
export const openTools     = () => openTool('openTools');

function reorderSection(type, oldIdx, newIdx) {
    const moved = state.appData[type].splice(oldIdx, 1)[0];
    state.appData[type].splice(newIdx, 0, moved);
    renderAll();
}

// Writes the visible items (identified by their real indices, in their new on-screen
// order) back into the same array slots they occupied. Works for filtered views.
function applyVisualOrder(type, newOrder) {
    const arr   = state.appData[type] || [];
    const slots = [...newOrder].sort((x, y) => x - y);
    const items = newOrder.map(i => arr[i]);
    slots.forEach((slot, k) => { arr[slot] = items[k]; });
    renderAll();
}

function makeSortable(el, onEnd) {
    if (!el || Sortable.get(el)) return;   // renderAll() runs often; never stack instances
    new Sortable(el, { animation: 150, handle: '.drag-handle', ghostClass: 'opacity-40', onEnd });
}

function initSortable() {
    ['experience','education','volunteer','certificates','workshops','languages'].forEach(type => {
        makeSortable(document.getElementById(`${type}-container`), evt => reorderSection(type, evt.oldIndex, evt.newIndex));
    });

    // Projects and skills can be filtered, so read the real indices from the DOM after the move
    const projEl = document.getElementById('projects-container');
    makeSortable(projEl, () => applyVisualOrder('projects',
        [...projEl.querySelectorAll('.sortable-item')].map(item => Number(item.dataset.index))));

    const skillsEl = document.getElementById('skills-container');
    makeSortable(skillsEl, () => applyVisualOrder('skills',
        [...skillsEl.querySelectorAll('.sortable-item')].map(item => Number(item.dataset.realIndex))));
}

// ── GitHub page: pick the public repositories shown on the site, and what else to show ──
const MAX_FEATURED = 12;

function githubLogin() {
    return state.appData.github?.user
        || String(state.appData.profile?.github || '').match(/^https:\/\/github\.com\/([A-Za-z0-9-]+)\/?$/)?.[1] || '';
}

export async function manageGithub() {
    if (!state.isAdmin) return;
    await loadVendor('swal');
    const login = githubLogin();
    if (!login) { showToast('أضف رابط GitHub في الملف الشخصي أولاً', 'error'); return; }
    let repos;
    try {
        const res = await fetch(`https://api.github.com/users/${encodeURIComponent(login)}/repos?per_page=100&type=owner&sort=pushed`,
            { headers: githubHeaders(githubInfo.token), cache: 'no-store' });
        if (!res.ok) throw new Error(String(res.status));
        repos = await res.json();
    } catch {
        showToast('تعذّر جلب المستودعات من GitHub', 'error');
        return;
    }
    const current = { repos: [], calendar: true, activity: true, languages: true, ...(state.appData.github || {}) };
    const byName  = new Map(repos.map(r => [r.name.toLowerCase(), r]));
    let selected  = current.repos.filter(n => byName.has(String(n).toLowerCase())).map(n => byName.get(n.toLowerCase()).name);
    let query     = '';

    const row = (r, idx) => {
        const on = idx !== -1;
        const badges = [
            r.fork && '<span class="px-1.5 rounded bg-gray-200 text-gray-700 text-[10px]">fork</span>',
            r.archived && '<span class="px-1.5 rounded bg-amber-100 text-amber-800 text-[10px]">archived</span>',
            r.language && `<span class="text-gray-500 text-[11px]">${escapeHTML(r.language)}</span>`,
            `<span class="text-gray-500 text-[11px]">★ ${Number(r.stargazers_count) || 0}</span>`,
            `<span class="text-gray-400 text-[11px]">${escapeHTML(String(r.pushed_at || '').slice(0, 10))}</span>`
        ].filter(Boolean).join(' ');
        return `
        <li class="flex items-center gap-3 p-2.5 rounded-xl border ${on ? 'border-blue-300 bg-blue-50' : 'border-gray-200'}" dir="ltr">
            <input type="checkbox" class="w-4 h-4" data-gh-toggle="${escapeHTML(r.name)}" ${on ? 'checked' : ''} aria-label="${escapeHTML(r.name)}">
            <div class="flex-1 min-w-0 text-left">
                <p class="font-bold text-sm truncate">${on ? `<span class="text-blue-600">${idx + 1}.</span> ` : ''}${escapeHTML(r.name)}</p>
                <p class="text-xs text-gray-500 truncate">${escapeHTML(r.description || '—')}</p>
                <p class="flex flex-wrap gap-2 mt-0.5">${badges}</p>
            </div>
            ${on ? `<div class="flex flex-col gap-0.5">
                <button type="button" class="px-2 rounded bg-gray-100 hover:bg-gray-200 text-xs" data-gh-move="${escapeHTML(r.name)}" data-dir="-1" aria-label="Move up">▲</button>
                <button type="button" class="px-2 rounded bg-gray-100 hover:bg-gray-200 text-xs" data-gh-move="${escapeHTML(r.name)}" data-dir="1" aria-label="Move down">▼</button>
            </div>` : ''}
        </li>`;
    };

    const renderList = () => {
        const list = document.getElementById('gh-list');
        if (!list) return;
        const q = query.toLowerCase();
        const chosen = selected.map(n => byName.get(n.toLowerCase()));
        const rest   = repos.filter(r => !selected.includes(r.name));
        list.innerHTML = [...chosen, ...rest]
            .filter(r => !q || `${r.name} ${r.description || ''}`.toLowerCase().includes(q))
            .map(r => row(r, selected.indexOf(r.name))).join('') || '<li class="text-sm text-gray-500 p-3">لا توجد نتائج</li>';
        document.getElementById('gh-count').textContent = `${selected.length} / ${MAX_FEATURED}`;
    };

    const toggle = (id, label, on) => `
        <label class="flex items-center gap-2 text-sm"><input type="checkbox" id="${id}" class="w-4 h-4" ${on ? 'checked' : ''}> ${label}</label>`;

    const { value } = await Swal.fire({
        title: 'GitHub — المستودعات المعروضة',
        width: '760px',
        html: `<div class="text-right space-y-4" dir="rtl">
            <p class="text-xs leading-relaxed p-3 rounded-xl bg-blue-50 text-blue-900">
                تظهر هنا مستودعاتك <b>العامة</b> فقط. اختر ما تريد عرضه ورتّبه بالأسهم، ثم اضغط «حفظ» في شريط المدير.
                تُحدَّث بيانات GitHub على الموقع خلال دقائق بعد الحفظ، ثم تلقائياً كل 12 ساعة.
                لعرض مشروع خاص اجعله عاماً من إعدادات المستودع بعد التأكد من خلوّه من أي مفاتيح أو كلمات سر.
            </p>
            <div class="flex flex-wrap gap-4">
                ${toggle('gh-calendar', 'جدول المساهمات', current.calendar !== false)}
                ${toggle('gh-languages', 'اللغات', current.languages !== false)}
                ${toggle('gh-activity', 'آخر النشاطات', current.activity !== false)}
            </div>
            <div class="flex items-center gap-2">
                <input id="gh-search" class="swal2-input m-0 flex-1" placeholder="بحث / Search" dir="auto" autocomplete="off">
                <span id="gh-count" class="text-xs font-bold text-gray-500 whitespace-nowrap" dir="ltr"></span>
            </div>
            <ul id="gh-list" class="space-y-2 max-h-[45vh] overflow-y-auto"></ul>
        </div>`,
        showCancelButton: true,
        confirmButtonText: 'تطبيق',
        cancelButtonText: 'إلغاء',
        focusConfirm: false,
        didOpen: popup => {
            renderList();
            popup.querySelector('#gh-search').addEventListener('input', e => { query = e.target.value.trim(); renderList(); });
            popup.querySelector('#gh-list').addEventListener('click', e => {
                const move = e.target.closest('[data-gh-move]');
                if (move) {
                    const i = selected.indexOf(move.dataset.ghMove), j = i + Number(move.dataset.dir);
                    if (i !== -1 && j >= 0 && j < selected.length) { [selected[i], selected[j]] = [selected[j], selected[i]]; renderList(); }
                    return;
                }
                const box = e.target.closest('[data-gh-toggle]');
                if (!box) return;
                const name = box.dataset.ghToggle;
                if (box.checked) {
                    if (selected.length >= MAX_FEATURED) { box.checked = false; Swal.showValidationMessage(`الحد الأقصى ${MAX_FEATURED} مستودعاً`); return; }
                    selected = [...selected, name];
                } else selected = selected.filter(n => n !== name);
                Swal.resetValidationMessage();
                renderList();
            });
        },
        preConfirm: () => ({
            user: login,
            repos: [...selected],
            calendar: document.getElementById('gh-calendar').checked,
            languages: document.getElementById('gh-languages').checked,
            activity: document.getElementById('gh-activity').checked
        })
    });
    if (!value) return;
    state.appData.github = { ...(state.appData.github || {}), ...value };
    showToast('تم التطبيق — اضغط «حفظ» لنشره ✅', 'success');
}

// ── Theme page: brand colours, previewed live, with automatic contrast fixes ──
export async function manageTheme() {
    if (!state.isAdmin) return;
    await loadVendor('swal');
    let current = { ...DEFAULT_THEME, ...(state.appData.theme || {}) };

    const swatch = (hex, attrs, title) =>
        `<button type="button" ${attrs} title="${escapeHTML(title)}" aria-label="${escapeHTML(title)}"
                 class="w-9 h-9 rounded-full border-2 border-white shadow ring-1 ring-gray-300 hover:scale-110 transition" data-swatch="${hex}"></button>`;

    const render = () => {
        const d = applyTheme(current);                         // live preview on the page behind the dialog
        document.getElementById('th-primary').value = current.primary;
        document.getElementById('th-secondary').value = current.secondary;
        document.getElementById('th-primary-hex').value = current.primary;
        document.getElementById('th-secondary-hex').value = current.secondary;
        document.getElementById('th-harmony').innerHTML = harmonies(current.primary)
            .map(h => `<div class="flex flex-col items-center gap-1">${swatch(h.hex, `data-th-secondary="${h.hex}"`, h.label)}<span class="text-[10px] text-gray-500">${h.label}</span></div>`).join('');
        const adjusted = [
            d.light.primary !== d.chosen.primary && `الأساسي في الوضع الفاتح: <b dir="ltr">${d.chosen.primary} → ${d.light.primary}</b>`,
            d.dark.primary !== d.chosen.primary && `الأساسي في الوضع الداكن: <b dir="ltr">${d.chosen.primary} → ${d.dark.primary}</b>`,
            d.light.secondary !== d.chosen.secondary && `الثانوي في الوضع الفاتح: <b dir="ltr">${d.chosen.secondary} → ${d.light.secondary}</b>`,
            d.dark.secondary !== d.chosen.secondary && `الثانوي في الوضع الداكن: <b dir="ltr">${d.chosen.secondary} → ${d.dark.secondary}</b>`
        ].filter(Boolean);
        document.getElementById('th-adjusted').innerHTML = adjusted.length
            ? `<p class="font-bold mb-1">عُدّلت الإضاءة تلقائياً لتحقيق التباين (نفس الدرجة اللونية):</p><ul class="list-disc ps-5">${adjusted.map(a => `<li>${a}</li>`).join('')}</ul>`
            : '<p>✅ الألوان المختارة تحقق التباين كما هي.</p>';
        document.getElementById('th-report').innerHTML = d.report.map(r => `
            <li class="flex items-center justify-between gap-3 py-1.5 border-b border-gray-100">
                <span>${escapeHTML(r.label)}</span>
                <span class="font-mono text-xs" dir="ltr">${r.ratio.toFixed(2)}:1 <span class="${r.pass ? 'text-green-700' : 'text-red-600'} font-bold">${r.pass ? `✓ ≥ ${r.min}` : `✗ < ${r.min}`}</span></span>
            </li>`).join('');
        const preview = document.getElementById('th-preview');
        preview.querySelector('[data-p="btn"]').style.background = d.light.primary;
        preview.querySelector('[data-p="text"]').style.color = d.light.primary;
        preview.querySelector('[data-p="grad"]').style.backgroundImage = `linear-gradient(90deg, ${d.light.primary}, ${d.light.secondary})`;
        preview.querySelector('[data-p="dbtn"]').style.background = d.dark.primary;
        preview.querySelector('[data-p="dtext"]').style.color = d.dark.primary;
        preview.querySelector('[data-p="dgrad"]').style.backgroundImage = `linear-gradient(90deg, ${d.dark.primary}, ${d.dark.secondary})`;
    };

    const result = await Swal.fire({
        title: 'ألوان الموقع',
        width: '760px',
        html: `<div class="text-right space-y-4" dir="rtl">
            <p class="text-xs leading-relaxed p-3 rounded-xl bg-blue-50 text-blue-900">
                اختر لوناً أساسياً (الأزرار والروابط والعناوين) ولوناً ثانوياً (التدرّجات والأيقونات). يُعدَّل كل لون تلقائياً للوضعين
                الفاتح والداكن ليبقى مقروءاً وفق معيار WCAG AA، والتغيير يظهر على الصفحة مباشرة للمعاينة.
            </p>
            <div>
                <p class="text-xs font-bold text-gray-500 mb-2">ألوان جاهزة متناسقة</p>
                <div class="flex flex-wrap gap-2">${PRESETS.map((p, i) => `
                    <button type="button" data-th-preset="${i}" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-gray-200 hover:border-gray-400 text-xs">
                        <span class="w-4 h-4 rounded-full" data-swatch="${p.primary}"></span><span class="w-4 h-4 rounded-full -ms-2.5 ring-2 ring-white" data-swatch="${p.secondary}"></span>${escapeHTML(p.name)}
                    </button>`).join('')}
                </div>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <label class="block"><span class="text-xs font-bold text-gray-500">اللون الأساسي</span>
                    <span class="flex items-center gap-2 mt-1"><input type="color" id="th-primary" class="w-12 h-10 rounded cursor-pointer"><input id="th-primary-hex" class="swal2-input m-0 flex-1 font-mono" dir="ltr" maxlength="7" aria-label="Primary hex"></span></label>
                <label class="block"><span class="text-xs font-bold text-gray-500">اللون الثانوي</span>
                    <span class="flex items-center gap-2 mt-1"><input type="color" id="th-secondary" class="w-12 h-10 rounded cursor-pointer"><input id="th-secondary-hex" class="swal2-input m-0 flex-1 font-mono" dir="ltr" maxlength="7" aria-label="Secondary hex"></span></label>
            </div>
            <div>
                <p class="text-xs font-bold text-gray-500 mb-2">ألوان ثانوية متناسقة مع الأساسي</p>
                <div id="th-harmony" class="flex gap-4"></div>
            </div>
            <div id="th-preview" class="grid grid-cols-2 gap-3 text-sm">
                <div class="p-4 rounded-xl border border-gray-200 bg-gray-50 space-y-2"><p class="text-[11px] text-gray-500">الوضع الفاتح</p>
                    <span data-p="btn" class="inline-block px-3 py-1.5 rounded-lg text-white font-bold">زر</span> <b data-p="text">رابط ملوّن</b>
                    <div data-p="grad" class="h-2 rounded-full"></div></div>
                <div data-p="dark" class="p-4 rounded-xl border border-gray-700 space-y-2 text-gray-100"><p class="text-[11px] text-gray-400">الوضع الداكن</p>
                    <span data-p="dbtn" class="inline-block px-3 py-1.5 rounded-lg text-white font-bold">زر</span> <b data-p="dtext">رابط ملوّن</b>
                    <div data-p="dgrad" class="h-2 rounded-full"></div></div>
            </div>
            <div id="th-adjusted" class="text-xs p-3 rounded-xl bg-gray-50 leading-relaxed"></div>
            <div><p class="text-xs font-bold text-gray-500 mb-1">تقرير التباين</p><ul id="th-report" class="text-xs"></ul></div>
        </div>`,
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'تطبيق',
        denyButtonText: 'الألوان الافتراضية',
        cancelButtonText: 'إلغاء',
        focusConfirm: false,
        didOpen: popup => {
            popup.querySelector('[data-p="dark"]').style.background = '#0b1120';    // CSSOM: the CSP forbids style=""
            const paintSwatches = () => popup.querySelectorAll('[data-swatch]').forEach(el => { el.style.background = el.dataset.swatch; });
            const set = (key, hex) => { if (isHex(hex)) { current[key] = hex.toLowerCase(); render(); paintSwatches(); } };
            render();
            paintSwatches();
            ['primary', 'secondary'].forEach(key => {
                popup.querySelector(`#th-${key}`).addEventListener('input', e => set(key, e.target.value));
                popup.querySelector(`#th-${key}-hex`).addEventListener('change', e => {
                    const v = e.target.value.trim();
                    set(key, v.startsWith('#') ? v : `#${v}`);
                    e.target.value = current[key];
                });
            });
            popup.addEventListener('click', e => {
                const preset = e.target.closest('[data-th-preset]');
                if (preset) { const p = PRESETS[Number(preset.dataset.thPreset)]; current = { primary: p.primary, secondary: p.secondary }; render(); paintSwatches(); return; }
                const sec = e.target.closest('[data-th-secondary]');
                if (sec) set('secondary', sec.dataset.thSecondary);
            });
        },
        preConfirm: () => ({ ...current })
    });

    if (result.isConfirmed) {
        const isDefault = result.value.primary === DEFAULT_THEME.primary && result.value.secondary === DEFAULT_THEME.secondary;
        if (isDefault) delete state.appData.theme; else state.appData.theme = result.value;
        showToast('تم تطبيق الألوان — اضغط «حفظ» لنشرها ✅', 'success');
    } else if (result.isDenied) {
        delete state.appData.theme;
        showToast('عادت الألوان الافتراضية — اضغط «حفظ» لنشرها', 'info');
    }
    syncSiteTheme(state.appData.theme);                   // "cancel" restores the colours from before
    renderAll();
}

// ── Monitoring page: the sites checked every 12 hours ──
const MAX_MONITOR = 10;

export async function manageMonitor() {
    if (!state.isAdmin) return;
    await loadVendor('swal');
    let rows = (state.appData.monitor || []).map(m => ({ name: m.name || '', url: m.url || '' }));
    if (!rows.length) rows = [{ name: 'Portfolio (GitHub Pages)', url: 'https://osamaal-harbi.github.io/CV/' }];

    const render = () => {
        const list = document.getElementById('mon-list');
        list.innerHTML = rows.map((r, i) => `
            <li class="grid grid-cols-[1fr_2fr_auto] gap-2 items-center" dir="ltr">
                <input class="swal2-input m-0" data-mon-name="${i}" value="${escapeHTML(r.name)}" placeholder="Name" dir="auto">
                <input class="swal2-input m-0" data-mon-url="${i}" value="${escapeHTML(r.url)}" placeholder="https://…" type="url">
                <button type="button" class="px-3 py-2 rounded-lg bg-red-50 text-red-600 text-sm" data-mon-remove="${i}" aria-label="Remove">✕</button>
            </li>`).join('');
        document.getElementById('mon-add').disabled = rows.length >= MAX_MONITOR;
    };
    const sync = () => document.querySelectorAll('[data-mon-name]').forEach(el => {
        const i = Number(el.dataset.monName);
        rows[i] = { name: el.value.trim(), url: document.querySelector(`[data-mon-url="${i}"]`).value.trim() };
    });

    const { value } = await Swal.fire({
        title: 'مراقبة الأنظمة',
        width: '720px',
        html: `<div class="text-right space-y-4" dir="rtl">
            <p class="text-xs leading-relaxed p-3 rounded-xl bg-green-50 text-green-900">
                تُفحص هذه المواقع كل 12 ساعة من خوادم GitHub، وتظهر حالتها وزمن استجابتها ونسبة التوفر لآخر 30 يوماً
                في قسم «مراقبة الأنظمة» بصفحة الأعمال. روابط <b>https://</b> فقط، وبحد أقصى ${MAX_MONITOR}.
            </p>
            <ul id="mon-list" class="space-y-2"></ul>
            <button type="button" id="mon-add" class="px-4 py-2 rounded-lg bg-green-100 text-green-800 text-sm font-bold">+ إضافة موقع</button>
            <label class="flex items-start gap-2 text-sm p-3 rounded-xl border border-gray-200">
                <input type="checkbox" id="mon-alerts" class="w-4 h-4 mt-0.5" ${state.appData.monitorAlerts === false ? '' : 'checked'}>
                <span><b>تنبيه بالبريد عند توقف موقع</b><br><span class="text-xs text-gray-500">يفتح سير النشر Issue في المستودع يذكرك (@)، فيرسل GitHub رسالة إلى بريدك، ويُغلق تلقائياً عند عودة الموقع.</span></span>
            </label>
        </div>`,
        showCancelButton: true,
        confirmButtonText: 'تطبيق',
        cancelButtonText: 'إلغاء',
        focusConfirm: false,
        didOpen: popup => {
            render();
            popup.querySelector('#mon-add').addEventListener('click', () => { sync(); rows.push({ name: '', url: '' }); render(); });
            popup.querySelector('#mon-list').addEventListener('click', e => {
                const rm = e.target.closest('[data-mon-remove]');
                if (!rm) return;
                sync();
                rows.splice(Number(rm.dataset.monRemove), 1);
                render();
            });
        },
        preConfirm: () => {
            sync();
            const clean = rows.filter(r => r.url);
            const bad = clean.find(r => !/^https:\/\/[^\s/$.?#].[^\s]*$/i.test(r.url));
            if (bad) { Swal.showValidationMessage(`رابط غير صالح (يجب أن يبدأ بـ https://): ${bad.url}`); return false; }
            const sites = clean.slice(0, MAX_MONITOR).map(r => {
                let name = r.name;
                if (!name) { try { name = new URL(r.url).hostname; } catch { name = r.url; } }
                return { name, url: r.url };
            });
            return { sites, alerts: document.getElementById('mon-alerts').checked };
        }
    });
    if (!value) return;
    state.appData.monitor = value.sites;
    if (value.alerts) delete state.appData.monitorAlerts; else state.appData.monitorAlerts = false;
    showToast('تم التطبيق — اضغط «حفظ» لنشره ✅', 'success');
}

export async function enableSorting() {
    await loadVendor('sortable');
    initSortable();
}
