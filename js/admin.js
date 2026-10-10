// Admin panel (loaded only after login): GitHub session, editors, drag & drop and saving.
// The token is kept in sessionStorage only and expires after SESSION_DURATION.
import { SESSION_KEYS, state } from './state.js';
import { local, session } from './storage.js';
import { escapeHTML, loadVendor, setDeepValue, showToast, skillLevel } from './utils.js';
import { t } from './i18n.js';
import { VALID_PAGES } from './router.js';
import { getProjectKey, renderAll } from './render.js';
import { closeDialog, openDialog } from './modal.js';

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
function toBase64Utf8(text) {
    let binary = '';
    new TextEncoder().encode(text).forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
}

function fromBase64Utf8(b64) {
    const binary = atob(String(b64).replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binary, ch => ch.charCodeAt(0)));
}

const SECTION_NAMES = {
    profile: 'الملف الشخصي', experience: 'الخبرات', education: 'التعليم', volunteer: 'التطوع', skills: 'المهارات',
    projects: 'المشاريع', certificates: 'الشهادات', workshops: 'ورش العمل', languages: 'اللغات',
    github: 'GitHub', monitor: 'المراقبة'
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
        let remoteChanged = false;
        try { remoteChanged = JSON.stringify(JSON.parse(fromBase64Utf8(fileData.content))) !== state.lastSavedSnapshot; }
        catch { remoteChanged = true; }
        const answer = await Swal.fire({
            title: 'حفظ التعديلات في GitHub؟',
            html: `<p class="text-sm mb-2">الأقسام المعدّلة:</p>
                   <ul class="text-sm font-bold list-disc ps-6 text-right" dir="rtl">${changes.map(c => `<li>${escapeHTML(c)}</li>`).join('')}</ul>
                   ${remoteChanged ? `<p class="mt-4 p-3 rounded-lg bg-amber-50 text-amber-800 text-sm text-right" dir="rtl">⚠️ تغيّر ملف data.json في GitHub منذ تحميل الصفحة (تعديل أو commit آخر). الحفظ سيستبدل تلك التغييرات.</p>` : ''}`,
            icon: remoteChanged ? 'warning' : 'question',
            showCancelButton: true,
            confirmButtonText: remoteChanged ? 'استبدال وحفظ' : 'حفظ',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: remoteChanged ? '#d33' : '#2563eb'
        });
        if (!answer.isConfirmed) return;

        const json   = JSON.stringify(state.appData, null, 2) + '\n';
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
        { key: 'date',       label: 'التاريخ / Date', simple: true }
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

async function manageItem(type, index = null) {
    if (!state.isAdmin) return;
    const isEdit = index !== null;
    const item   = isEdit ? (state.appData[type] || [])[index] : {};
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
            const val = isEdit ? getSimple(item, f) : '';
            const hint = f.array ? ' <span class="text-gray-400 text-xs">(مفصولة بفاصلة)</span>' : '';
            return `<div class="mb-3">
                <label class="block text-xs mb-1 text-gray-500 text-right">${f.label}${hint}</label>
                <input id="swal-${f.key}" class="swal2-input m-0 w-full" value="${escapeHTML(val)}" dir="ltr">
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

    const { value } = await Swal.fire({
        title: isEdit ? 'تعديل البيانات' : 'إضافة جديدة',
        html: `<div class="text-right" dir="rtl">${html}</div>`,
        width: '700px', confirmButtonText: 'حفظ التغييرات',
        showCancelButton: true, cancelButtonText: 'إلغاء',
        focusConfirm: false,
        preConfirm: () => {
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
        }
    });

    if (value) {
        if (!state.appData[type]) state.appData[type] = [];
        // Merge: fields the editor does not show (added by hand in data.json) are kept
        if (isEdit) state.appData[type][index] = { ...item, ...value }; else state.appData[type].push(value);
        if (type === 'skills' && value.category !== state.activeSkillTab) state.activeSkillTab = value.category;
        renderAll();
        showToast(isEdit ? 'تم التعديل ✅' : 'تمت الإضافة ✅', 'success');
    }
}

export function addItem(type)         { return type === 'projects' ? manageProjectItem() : manageItem(type); }

export function editItem(type, index) { return type === 'projects' ? manageProjectItem(index) : manageItem(type, index); }

// ── Dedicated project editor (handles technologies array + nested details) ──
async function manageProjectItem(index = null) {
    if (!state.isAdmin) return;
    await loadVendor('swal');
    const isEdit = index !== null;
    const item   = isEdit ? (state.appData.projects || [])[index] : {};

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
        preConfirm: () => {
            const titleAr = document.getElementById('pj-title-ar')?.value.trim();
            const titleEn = document.getElementById('pj-title-en')?.value.trim();
            if (!titleAr && !titleEn) {
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
        }
    });

    if (value) {
        if (!state.appData.projects) state.appData.projects = [];
        if (isEdit) state.appData.projects[index] = { ...item, ...value };
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
          <div>
            <label class="block text-xs mb-1 text-gray-500">رابط السيرة الذاتية (PDF path)</label>
            <input id="pf-cv" class="swal2-input m-0 w-full" value="${escapeHTML(v('cv'))}" dir="ltr" placeholder="Osama_Alharbi.pdf">
          </div>

        </div>`,
        width: '740px',
        confirmButtonText: 'حفظ التغييرات',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        focusConfirm: false,
        preConfirm: () => ({
            name:     { ar: document.getElementById('pf-name-ar').value,     en: document.getElementById('pf-name-en').value },
            title:    { ar: document.getElementById('pf-title-ar').value,    en: document.getElementById('pf-title-en').value },
            summary:  { ar: document.getElementById('pf-summary-ar').value,  en: document.getElementById('pf-summary-en').value },
            location: { ar: document.getElementById('pf-location-ar').value, en: document.getElementById('pf-location-en').value },
            email:    document.getElementById('pf-email').value,
            phone:    document.getElementById('pf-phone').value,
            linkedin: document.getElementById('pf-linkedin').value,
            github:   document.getElementById('pf-github').value,
            cv:       document.getElementById('pf-cv').value
        })
    });

    if (value) {
        state.appData.profile = { ...p, ...value };   // keeps image, nationality and any other field
        renderAll();
        showToast(state.currentLang === 'ar' ? 'تم تحديث الملف الشخصي ✅' : 'Profile updated ✅', 'success');
    }
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
    const { value } = await Swal.fire({
        title: 'تغيير الصورة الشخصية', input: 'url',
        inputLabel: 'رابط الصورة (Imgur, GitHub, Drive)', inputPlaceholder: 'https://...'
    });
    if (value) { setDeepValue(state.appData, key, value); renderAll(); }
}

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

export async function showAnalyticsDashboard() {
    await loadVendor('swal');
    const visits  = session.getJSON('page_visits', {});
    const pViews  = session.getJSON('project_views', {});
    const allProjects = state.appData.projects || [];

    const pageNames = {
        ar: { home:'الرئيسية', resume:'السيرة الذاتية', portfolio:'الأعمال', contact:'تواصل' },
        en: { home:'Home', resume:'Resume', portfolio:'Portfolio', contact:'Contact' }
    };

    const visitRows = VALID_PAGES.map(p => `
        <tr class="border-b border-gray-100 dark:border-gray-700">
            <td class="py-2 px-3 font-medium text-sm">${pageNames[state.currentLang][p] || p}</td>
            <td class="py-2 px-3 text-center">
                <span class="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold text-xs">${visits[p] || 0}</span>
            </td>
        </tr>
    `).join('');

    const projectRows = allProjects.map((proj, i) => {
        const key   = getProjectKey(proj, i);
        const count = pViews[key] || 0;
        return `
        <tr class="border-b border-gray-100 dark:border-gray-700">
            <td class="py-2 px-3 font-medium text-xs">${escapeHTML(t(proj.title))}</td>
            <td class="py-2 px-3 text-center">
                <span class="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded font-bold text-xs">${count}</span>
            </td>
        </tr>`;
    }).join('');

    Swal.fire({
        title: state.currentLang === 'ar' ? '📊 لوحة الإحصائيات' : '📊 Analytics Dashboard',
        html: `
        <div class="text-right" dir="${state.currentLang === 'ar' ? 'rtl' : 'ltr'}">
            <p class="text-xs text-gray-400 mb-4">${state.currentLang === 'ar' ? 'بيانات الجلسة الحالية فقط' : 'Current session data only'}</p>

            <h4 class="font-bold text-sm mb-2">${state.currentLang === 'ar' ? 'زيارات الصفحات' : 'Page Visits'}</h4>
            <table class="w-full mb-6 text-right">
                <thead><tr class="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500">
                    <th class="py-2 px-3 text-right">${state.currentLang === 'ar' ? 'الصفحة' : 'Page'}</th>
                    <th class="py-2 px-3 text-center">${state.currentLang === 'ar' ? 'الزيارات' : 'Visits'}</th>
                </tr></thead>
                <tbody>${visitRows}</tbody>
            </table>

            <h4 class="font-bold text-sm mb-2">${state.currentLang === 'ar' ? 'مشاهدات المشاريع' : 'Project Views'}</h4>
            <table class="w-full mb-6 text-right">
                <thead><tr class="bg-gray-50 dark:bg-gray-800 text-xs text-gray-500">
                    <th class="py-2 px-3 text-right">${state.currentLang === 'ar' ? 'المشروع' : 'Project'}</th>
                    <th class="py-2 px-3 text-center">${state.currentLang === 'ar' ? 'المشاهدات' : 'Views'}</th>
                </tr></thead>
                <tbody>${projectRows}</tbody>
            </table>

            <div class="flex gap-2 flex-wrap justify-center mt-4">
                <a href="https://analytics.google.com/" target="_blank" rel="noopener noreferrer"
                   class="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition">
                   <i class="fab fa-google"></i> Google Analytics
                </a>
                <a href="https://clarity.microsoft.com/" target="_blank" rel="noopener noreferrer"
                   class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition">
                   <i class="fas fa-eye"></i> Microsoft Clarity
                </a>
            </div>
        </div>`,
        width: '600px',
        showConfirmButton: false,
        showCloseButton: true
    });
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
            return clean.slice(0, MAX_MONITOR).map(r => {
                let name = r.name;
                if (!name) { try { name = new URL(r.url).hostname; } catch { name = r.url; } }
                return { name, url: r.url };
            });
        }
    });
    if (!value) return;
    state.appData.monitor = value;
    showToast('تم التطبيق — اضغط «حفظ» لنشره ✅', 'success');
}

export async function enableSorting() {
    await loadVendor('sortable');
    initSortable();
}
