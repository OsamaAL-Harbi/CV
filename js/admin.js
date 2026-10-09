// Admin panel (loaded only after login): GitHub session, editors, drag & drop and saving.
// The token is kept in sessionStorage only and expires after SESSION_DURATION.
import { SESSION_KEYS, state } from './state.js';
import { escapeHTML, loadVendor, setDeepValue, showToast, skillLevel } from './utils.js';
import { t } from './i18n.js';
import { VALID_PAGES } from './router.js';
import { getProjectKey, renderAll } from './render.js';

let githubInfo     = { token: '', repo: '' };

const SESSION_DURATION   = 60 * 60 * 1000;

const REPO_PATTERN       = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

let sessionTimer         = null;

function readSession() {
    return {
        token:     sessionStorage.getItem(SESSION_KEYS.token),
        repo:      sessionStorage.getItem(SESSION_KEYS.repo),
        loginTime: Number(sessionStorage.getItem(SESSION_KEYS.loginTime)) || 0
    };
}

function isSessionExpired(loginTime) {
    return !loginTime || Date.now() - loginTime > SESSION_DURATION;
}

function clearSession() {
    Object.values(SESSION_KEYS).forEach(k => sessionStorage.removeItem(k));
    githubInfo = { token: '', repo: '' };
    if (sessionTimer) { clearTimeout(sessionTimer); sessionTimer = null; }
}

function scheduleSessionExpiry(loginTime) {
    if (sessionTimer) clearTimeout(sessionTimer);
    sessionTimer = setTimeout(expireSession, Math.max(0, loginTime + SESSION_DURATION - Date.now()));
}

function expireSession() {
    clearSession();
    showToast('انتهت الجلسة، يرجى تسجيل الدخول مجدداً / Session expired', 'error');
    setTimeout(() => location.reload(), 1500);
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
    sessionStorage.setItem(SESSION_KEYS.token, token);
    sessionStorage.setItem(SESSION_KEYS.repo, repo);
    sessionStorage.setItem(SESSION_KEYS.loginTime, String(loginTime));
    localStorage.setItem('saved_repo', repo);   // repo name only, not secret
    githubInfo.repo = repo; githubInfo.token = token;
    scheduleSessionExpiry(loginTime);
    document.getElementById('admin-modal').classList.add('hidden');
    enableAdminMode();
    showToast('تم تفعيل وضع المدير 🚀', 'success');
    if (!token.startsWith('github_pat_')) {
        setTimeout(() => showToast('⚠️ يُفضّل Fine-grained PAT مقيّد بهذا المستودع / Prefer a fine-grained PAT', 'info'), 800);
    }
}

function enableAdminMode() {
    state.isAdmin = true;
    document.body.classList.add('admin-mode');
    document.getElementById('admin-toolbar').classList.remove('hidden');
    if (state.dataLoaded) renderAll();
}

export function logout() {
    clearSession();
    location.reload();
}

// btoa() only accepts Latin-1, so encode the UTF-8 bytes first.
function toBase64Utf8(text) {
    let binary = '';
    new TextEncoder().encode(text).forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
}

export async function saveToGitHub() {
    if (isSessionExpired(readSession().loginTime)) { expireSession(); return; }
    const btn      = document.querySelector('#admin-toolbar button');
    const origHTML = btn.innerHTML;
    btn.innerHTML  = '<i class="fas fa-spinner fa-spin"></i>';
    try {
        const url    = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(url, { headers: githubHeaders(githubInfo.token) });
        if (!getRes.ok) throw new Error('فشل الاتصال. تحقق من الـ Token.');
        const fileData = await getRes.json();
        const json     = JSON.stringify(state.appData, null, 2);
        const putRes   = await fetch(url, {
            method: 'PUT',
            headers: { ...githubHeaders(githubInfo.token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Update via Admin Panel', content: toBase64Utf8(json), sha: fileData.sha })
        });
        if (!putRes.ok) throw new Error('فشل الحفظ في GitHub');
        state.lastSavedSnapshot = json;
        showToast('تم الحفظ في GitHub ✅', 'success');
    } catch (e) {
        showToast('خطأ: ' + e.message, 'error');
    } finally { btn.innerHTML = origHTML; }
}

// Reverts unsaved edits to the last version loaded from or saved to GitHub (memory only).
export function restoreBackup() {
    if (state.lastSavedSnapshot) { state.appData = JSON.parse(state.lastSavedSnapshot); renderAll(); showToast('تم التراجع إلى آخر نسخة محفوظة ✅', 'success'); }
    else showToast('لا توجد نسخة احتياطية', 'error');
}

const SCHEMAS = {
    skills: [
        { key: 'ar',       label: 'اسم المهارة (عربي)',   simple: true },
        { key: 'en',       label: 'Skill Name (English)', simple: true },
        { key: 'level',    label: 'المستوى % (0-100)',    simple: true, number: true },
        { key: 'category', label: 'النوع (hard / soft)',  simple: true }
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
        if (isEdit) state.appData[type][index] = value; else state.appData[type].push(value);
        renderAll();
        showToast(isEdit ? 'تم التعديل ✅' : 'تمت الإضافة ✅', 'success');
    }
}

export function addItem(type)         { if (type === 'projects') manageProjectItem(); else manageItem(type); }

export function editItem(type, index) { if (type === 'projects') manageProjectItem(index); else manageItem(type, index); }

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
        if (isEdit) state.appData.projects[index] = value;
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
            cv:       document.getElementById('pf-cv').value,
            // preserve unchanged fields
            image:       state.appData.profile?.image || '',
            nationality: state.appData.profile?.nationality || { ar: 'سعودي', en: 'Saudi' }
        })
    });

    if (value) {
        state.appData.profile = value;
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
    const visits  = JSON.parse(sessionStorage.getItem('page_visits')  || '{}');
    const pViews  = JSON.parse(sessionStorage.getItem('project_views') || '{}');
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
                <a href="https://analytics.google.com/" target="_blank"
                   class="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl text-xs font-bold hover:bg-orange-600 transition">
                   <i class="fab fa-google"></i> Google Analytics
                </a>
                <a href="https://clarity.microsoft.com/" target="_blank"
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

export async function enableSorting() {
    await loadVendor('sortable');
    initSortable();
}
