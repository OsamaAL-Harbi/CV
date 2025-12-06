/**
 * OSAMA PORTFOLIO - EDITION
 * -----------------------------------------
 * This is the full, uncompressed source code controlling the entire website.
 * Contains: SPA Routing, Bilingual System, Admin CRUD, Security, GitHub Sync, PWA.
 */

// =========================================
// 1. GLOBAL VARIABLES & CONFIGURATION
// =========================================
let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };
let currentLang = localStorage.getItem('lang') || 'ar';
let isAdmin = false;
let clickCount = 0;
const SESSION_DURATION = 60 * 60 * 1000; // 1 Hour Session
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xqarljpg"; // ضع رابطك هنا

// =========================================
// 2. INITIALIZATION (STARTUP)
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    // 1. مكتبات الحركة
    AOS.init({ duration: 800, once: true });
    
    // 2. ضبط السنة في الفوتر
    if(document.getElementById('year')) {
        document.getElementById('year').textContent = new Date().getFullYear();
    }
    
    // 3. تحميل وتشغيل الأنظمة الأساسية
    setDirection();
    loadContent();
    initTheme();
    initParticles();
    
    // 4. تشغيل أنظمة الأدمن والميزات الإضافية
    setupSecretTrigger();
    checkSession();
    setupCmdPalette();
    setupKonamiCode();
    registerPWA();
    setupScrollTop();
    
    // 5. استرجاع بيانات الدخول المحفوظة (للتسهيل)
    if(localStorage.getItem('saved_repo')) {
        document.getElementById('repo-input').value = localStorage.getItem('saved_repo');
        document.getElementById('token-input').value = localStorage.getItem('saved_token');
    }
});

// تسجيل تطبيق الويب التقدمي (PWA)
function registerPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
        .then(() => console.log('Service Worker Registered Successfully'))
        .catch(err => console.log('Service Worker Failed:', err));
    }
}

// =========================================
// 3. NAVIGATION & UI LOGIC (SPA)
// =========================================
function showPage(pageId) {
    // إخفاء جميع الأقسام أولاً
    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    
    // إظهار القسم المطلوب مع أنميشن
    const target = document.getElementById(pageId);
    if(target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // تحديث الخط تحت الرابط في القائمة العلوية
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('nav-active'));
    const navBtn = document.getElementById(`nav-${pageId}`);
    if(navBtn) navBtn.classList.add('nav-active');
    
    // إغلاق قائمة الجوال إذا كانت مفتوحة
    const mobileMenu = document.getElementById('mobile-menu');
    if(mobileMenu && mobileMenu.classList.contains('open')) toggleMobileMenu();
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu.classList.contains('closed')) {
        menu.classList.remove('closed');
        menu.classList.add('open');
    } else {
        menu.classList.remove('open');
        menu.classList.add('closed');
    }
}

function setupScrollTop() {
    window.addEventListener('scroll', () => {
        const btn = document.getElementById('scrollTopBtn');
        if (window.scrollY > 300) {
            btn.classList.add('show');
            btn.classList.remove('translate-y-10');
        } else {
            btn.classList.remove('show');
            btn.classList.add('translate-y-10');
        }
    });
}

// =========================================
// 4. LOCALIZATION SYSTEM (AR/EN)
// =========================================
function t(data) {
    // هذه الدالة تتأكد من نوع البيانات لترجع النص الصحيح
    if (typeof data === 'object' && data !== null) {
        // إذا كان البيانات كائن يحتوي على لغتين
        return data[currentLang] || data.ar || "";
    }
    // إذا كان نصاً عادياً
    return data || "";
}

function toggleLanguage() {
    // تبديل المتغير
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    // حفظ التفضيل
    localStorage.setItem('lang', currentLang);
    // تطبيق التغييرات
    setDirection();
    renderAll();
    updateStaticText();
}

function setDirection() {
    // تغيير اتجاه الصفحة HTML
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
    const btn = document.getElementById('lang-btn');
    if(btn) btn.textContent = currentLang === 'ar' ? 'EN' : 'عربي';
}

function updateStaticText() {
    // نصوص القوائم والأزرار الثابتة
    const texts = {
        ar: { 
            nav_home:"الرئيسية", nav_resume:"السيرة الذاتية", nav_portfolio:"الأعمال", nav_contact:"تواصل", 
            btn_projects:"أعمالي", btn_contact:"تواصل", btn_save:"حفظ", btn_restore:"استعادة", btn_email:"إرسال",
            sec_resume:"الخبرات والتعليم", sec_exp:"الخبرات", sec_skills:"المهارات", sec_certs:"الشهادات", sec_projects:"المشاريع", 
            contact_title:"راسلني"
        },
        en: { 
            nav_home:"Home", nav_resume:"Resume", nav_portfolio:"Portfolio", nav_contact:"Contact", 
            btn_projects:"My Work", btn_contact:"Contact", btn_save:"Save", btn_restore:"Restore", btn_email:"Send",
            sec_resume:"Resume & Education", sec_exp:"Experience", sec_skills:"Skills", sec_certs:"Certificates", sec_projects:"Projects", 
            contact_title:"Get in Touch"
        }
    };
    
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if(texts[currentLang][key]) el.innerText = texts[currentLang][key];
    });
}

// =========================================
// 5. DATA LOADING & RENDERING
// =========================================
async function loadContent() {
    try {
        // إضافة الوقت لتجنب الكاش القديم
        const res = await fetch(`data.json?t=${Date.now()}`);
        if(!res.ok) throw new Error("File not found");
        appData = await res.json();
        
        renderAll();
        updateStaticText();
        setSmartGreeting();
        
        // إخفاء شاشة التحميل بنجاح
        setTimeout(() => document.getElementById('loading-screen').classList.add('hidden'), 500);
    } catch (err) {
        showToast("خطأ في تحميل البيانات / Error Loading Data", "error");
        document.getElementById('loading-screen').classList.add('hidden');
    }
}

function renderAll() {
    const p = appData.profile;
    
    // --- 1. Profile Section ---
    updateText('profile.name', t(p.name));
    updateText('profile.summary', t(p.summary));
    
    // معالجة الصور مع Fallback (صورة بديلة)
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(t(p.name))}&background=0D8ABC&color=fff&size=200`;
    const imgEl = document.getElementById('profile-img');
    if(imgEl) {
        imgEl.src = p.image || fallback;
        imgEl.onerror = function() { this.src = fallback; };
    }

    typeWriter(t(p.title), 'typewriter');
    
    // تحديث الروابط الاجتماعية
    if(document.getElementById('email-contact')) document.getElementById('email-contact').href = `mailto:${p.email}`;
    if(document.getElementById('social-linkedin')) document.getElementById('social-linkedin').href = p.linkedin;
    if(document.getElementById('social-github')) document.getElementById('social-github').href = p.github;

    // --- 2. Render Sections (Using Helper Function) ---
    
    // Experience Section
    renderSection('experience', appData.experience, (item, i) => `
        <h3 class="text-xl font-bold dark:text-white hover:text-primary transition cursor-pointer" onclick="${isAdmin ? `manageItem('experience', ${i})` : ''}">${t(item.role)}</h3>
        <p class="text-primary font-medium text-sm">${t(item.company)}</p>
        <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs mb-3 font-bold">${t(item.period)}</span>
        <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${t(item.description)}</p>
    `);

    // Skills Section
    renderSection('skills', appData.skills, (item, i) => `<span class="font-bold text-sm" onclick="${isAdmin ? `manageItem('skills', ${i})` : ''}">${t(item)}</span>`, 'inline-block px-4 py-2 bg-white dark:bg-cardBg rounded-lg border dark:border-gray-700 shadow-sm cursor-default hover:border-primary transition');

    // Certificates Section
    renderSection('certificates', appData.certificates, (item, i) => `
        <div class="text-2xl text-secondary"><i class="fas fa-certificate"></i></div>
        <div onclick="${isAdmin ? `manageItem('certificates', ${i})` : ''}" class="cursor-pointer w-full">
            <h4 class="font-bold text-sm dark:text-white">${t(item.name)}</h4>
            <p class="text-xs text-gray-500 mt-1">${t(item.issuer)} | ${t(item.date)}</p>
        </div>
    `, 'flex items-center gap-4 bg-white dark:bg-cardBg p-4 rounded-xl border dark:border-gray-700 shadow-sm hover:shadow-md transition');

    // Projects Section
    renderSection('projects', appData.projects, (item, i) => `
        <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center relative overflow-hidden group">
            <i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500"></i>
            <div class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 backdrop-blur-sm">
                <a href="${item.link}" target="_blank" class="px-6 py-2 bg-white text-gray-900 rounded-full font-bold transform translate-y-4 group-hover:translate-y-0 transition duration-300 shadow-xl">عرض</a>
            </div>
        </div>
        <div class="p-6 flex-grow cursor-pointer" onclick="${isAdmin ? `manageItem('projects', ${i})` : ''}">
            <h3 class="text-lg font-bold mb-2">${t(item.title)}</h3>
            <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-3">${t(item.desc)}</p>
        </div>
    `, 'bg-white dark:bg-cardBg rounded-2xl border dark:border-gray-700 overflow-hidden flex flex-col h-full shadow-sm hover:shadow-2xl transition duration-300 transform hover:-translate-y-1');

    // إعادة تفعيل السحب والإفلات إذا كان وضع الأدمن مفعلاً
    if(isAdmin) initSortable();
}

function renderSection(type, data, contentFn, wrapperClass = 'relative group mb-8') {
    const container = document.getElementById(`${type}-container`);
    if(!container) return;
    
    // إنشاء العناصر وإضافة أزرار التحكم لكل عنصر
    container.innerHTML = data.map((item, i) => `
        <div class="${wrapperClass} sortable-item" data-id="${i}">
            ${renderAdminButtons(type, i)}
            ${type === 'experience' ? `<div class="absolute -right-[39px] ltr:-left-[39px] top-1 w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-darkBg z-10 group-hover:scale-125 transition"></div>` : ''}
            ${contentFn(item, i)}
        </div>
    `).join('');
}

function renderAdminButtons(type, index) {
    if (!isAdmin) return '';
    // أزرار التحكم: سحب، تعديل، حذف
    return `<div class="admin-element absolute top-2 left-2 ltr:right-2 ltr:left-auto z-20 gap-2 opacity-0 group-hover:opacity-100 transition flex items-center">
        <span class="drag-handle bg-gray-200 dark:bg-gray-700 text-gray-500 w-7 h-7 rounded shadow flex items-center justify-center hover:bg-gray-300 cursor-move" title="سحب للترتيب"><i class="fas fa-grip-vertical text-[10px]"></i></span>
        <button onclick="manageItem('${type}', ${index})" class="bg-blue-500 text-white w-7 h-7 rounded shadow flex items-center justify-center hover:scale-110 transition" title="تعديل"><i class="fas fa-pen text-[10px]"></i></button>
        <button onclick="deleteItem('${type}', ${index})" class="bg-red-500 text-white w-7 h-7 rounded shadow flex items-center justify-center hover:scale-110 transition" title="حذف"><i class="fas fa-trash text-[10px]"></i></button>
    </div>`;
}

// =========================================
// 6. ADMIN SYSTEM (SMART CRUD)
// =========================================

// دالة شاملة: إذا مررنا index فهي تعديل، وإذا لم نمرر فهي إضافة
async function manageItem(type, index = null) {
    if(!isAdmin) return;
    const isEdit = index !== null;
    const item = isEdit ? appData[type][index] : {};
    
    // تعريف حقول الإدخال لكل قسم (Schemas)
    const schemas = {
        skills: [
            {key:'ar', label:'اسم المهارة (عربي)'}, 
            {key:'en', label:'Skill Name (English)'}
        ],
        experience: [
            {key:'role', label:'المسمى الوظيفي'}, 
            {key:'company', label:'الشركة'}, 
            {key:'period', label:'التاريخ/الفترة'}, 
            {key:'description', label:'الوصف', type:'textarea'}
        ],
        projects: [
            {key:'title', label:'عنوان المشروع'}, 
            {key:'desc', label:'وصف المشروع', type:'textarea'}, 
            {key:'link', label:'رابط المشروع', simple:true} // simple = حقل واحد للغتين
        ],
        certificates: [
            {key:'name', label:'اسم الشهادة'}, 
            {key:'issuer', label:'الجهة المانحة'}, 
            {key:'date', label:'التاريخ', simple:true}
        ]
    };

    const schema = schemas[type];
    if(!schema) return;

    // دالة مساعدة لاستخراج القيمة بأمان سواء كانت كائناً أو نصاً
    const getVal = (valObj, lang) => {
        if (!valObj) return '';
        if (typeof valObj === 'object') return valObj[lang] || '';
        return lang === 'ar' ? valObj : valObj; // للنصوص البسيطة
    };

    // بناء كود HTML للنوافذ المنبثقة
    let html = schema.map(f => {
        // 1. حقل بسيط (رابط أو تاريخ)
        if(f.simple) {
            const val = isEdit ? (item[f.key] || '') : '';
            return `<div class="mb-3">
                        <label class="block text-xs mb-1 text-gray-500 text-right">${f.label}</label>
                        <input id="swal-${f.key}" class="swal2-input m-0 w-full" value="${val}" dir="ltr">
                    </div>`;
        }
        
        // 2. حقول مزدوجة (عربي + إنجليزي)
        const valAr = getVal(isEdit ? item[f.key] : '', 'ar');
        const valEn = getVal(isEdit ? item[f.key] : '', 'en');
        
        if(f.type === 'textarea') {
            return `<div class="grid grid-cols-2 gap-2 mb-3">
                        <div>
                            <label class="block text-xs mb-1 text-gray-500 text-right">${f.label} (AR)</label>
                            <textarea id="swal-${f.key}-ar" class="swal2-textarea m-0 w-full h-24 text-right" dir="rtl">${valAr}</textarea>
                        </div>
                        <div>
                            <label class="block text-xs mb-1 text-gray-500 text-left">${f.label} (EN)</label>
                            <textarea id="swal-${f.key}-en" class="swal2-textarea m-0 w-full h-24 text-left" dir="ltr">${valEn}</textarea>
                        </div>
                    </div>`;
        }
        return `<div class="grid grid-cols-2 gap-2 mb-3">
                    <div>
                        <label class="block text-xs mb-1 text-gray-500 text-right">${f.label} (AR)</label>
                        <input id="swal-${f.key}-ar" class="swal2-input m-0 w-full text-right" value="${valAr}" dir="rtl">
                    </div>
                    <div>
                        <label class="block text-xs mb-1 text-gray-500 text-left">${f.label} (EN)</label>
                        <input id="swal-${f.key}-en" class="swal2-input m-0 w-full text-left" value="${valEn}" dir="ltr">
                    </div>
                </div>`;
    }).join('');

    const { value } = await Swal.fire({
        title: isEdit ? 'تعديل البيانات' : 'إضافة بيانات جديدة',
        html: `<div class="text-right" dir="rtl">${html}</div>`,
        width: '700px',
        confirmButtonText: 'حفظ التغييرات',
        showCancelButton: true,
        cancelButtonText: 'إلغاء',
        focusConfirm: false,
        preConfirm: () => {
            let obj = {};
            schema.forEach(f => {
                if(f.simple) {
                    obj[f.key] = document.getElementById(`swal-${f.key}`).value;
                } else {
                    obj[f.key] = { 
                        ar: document.getElementById(`swal-${f.key}-ar`).value, 
                        en: document.getElementById(`swal-${f.key}-en`).value 
                    };
                }
            });
            return obj;
        }
    });

    if(value) {
        if(type === 'skills') {
             // المهارات قد تكون نصاً أو كائناً، نحفظها ككائن لتوحيد البنية
             if(isEdit) appData.skills[index] = value; else appData.skills.push(value);
        } else {
             if(isEdit) appData[type][index] = value; else appData[type].push(value);
        }
        renderAll();
        showToast(isEdit ? "تم التعديل محلياً" : "تمت الإضافة محلياً", "success");
    }
}

// دوال مساعدة لربط الأزرار بالـ HTML
function addItem(type) { manageItem(type); }
function editItem(type, index) { manageItem(type, index); }

function deleteItem(type, index) {
    if(!isAdmin) return;
    Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "لن تتمكن من التراجع عن الحذف!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'تراجع'
    }).then((result) => {
        if (result.isConfirmed) {
            appData[type].splice(index, 1);
            renderAll();
            showToast("تم الحذف بنجاح", "success");
        }
    });
}

function updateText(key, value) {
    const el = document.querySelector(`[data-path="${key}"]`);
    if(el) {
        el.innerText = value;
        if(isAdmin) {
            el.contentEditable = "true";
            el.classList.add('editable-active');
            el.onblur = () => {
                const val = el.innerText;
                const pathParts = key.split('.');
                let obj = appData;
                for(let i=0; i<pathParts.length-1; i++) obj = obj[pathParts[i]];
                
                // حفظ التعديل في اللغة الحالية فقط
                if(typeof obj[pathParts[pathParts.length-1]] === 'object') {
                    obj[pathParts[pathParts.length-1]][currentLang] = val;
                } else {
                    obj[pathParts[pathParts.length-1]] = val;
                }
            };
        }
    }
}

async function editImage(key) {
    if(!isAdmin) return;
    const { value } = await Swal.fire({
        title: 'تغيير الصورة',
        input: 'url',
        inputLabel: 'رابط الصورة الجديد (Imgur, GitHub, Drive)',
        inputPlaceholder: 'https://...'
    });
    if (value) {
        setDeepValue(appData, key, value);
        renderAll();
    }
}

async function triggerImageUpload(key) { 
    // هذه الدالة تستدعي editImage (حالياً لا يوجد خادم لرفع الملفات)
    editImage(key); 
}

// --- 7. SORTABLE (Drag & Drop Logic) ---
function initSortable() {
    ['experience-container', 'skills-container', 'certificates-container', 'projects-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const type = id.replace('-container', '');
            new Sortable(el, {
                animation: 150,
                handle: '.drag-handle', // السحب من المقبض فقط
                ghostClass: 'bg-blue-100', // لون الخلفية عند السحب
                onEnd: function (evt) {
                    // تحديث ترتيب المصفوفة عند الإفلات
                    const item = appData[type].splice(evt.oldIndex, 1)[0];
                    appData[type].splice(evt.newIndex, 0, item);
                    renderAll(); 
                }
            });
        }
    });
}

// =========================================
// 8. SECURITY & GITHUB SYNC
// =========================================
function checkSession() {
    const t = localStorage.getItem('login_time');
    if (localStorage.getItem('saved_token')) {
        // التحقق من انتهاء وقت الجلسة
        if (t && (Date.now() - t > SESSION_DURATION)) {
            logout();
            showToast("انتهت الجلسة لأمانك، يرجى الدخول مجدداً", "error");
        } else {
            // استعادة الجلسة
            githubInfo.repo = localStorage.getItem('saved_repo');
            githubInfo.token = localStorage.getItem('saved_token');
            enableAdminMode();
        }
    }
}

function setupSecretTrigger() {
    // النقر 3 مرات على الفوتر لفتح لوحة الدخول
    document.getElementById('secret-trigger').addEventListener('click', () => {
        clickCount++;
        if(clickCount === 3) {
            document.getElementById('admin-modal').classList.remove('hidden');
            clickCount = 0;
        }
    });
}

function authenticateAndEdit() {
    const repo = document.getElementById('repo-input').value.trim();
    const token = document.getElementById('token-input').value.trim();
    if(!repo || !token) return showToast('الرجاء إدخال البيانات كاملة', 'error');
    
    // حفظ الجلسة محلياً
    localStorage.setItem('saved_repo', repo);
    localStorage.setItem('saved_token', token);
    localStorage.setItem('login_time', Date.now());
    
    githubInfo.repo = repo;
    githubInfo.token = token;
    
    document.getElementById('admin-modal').classList.add('hidden');
    enableAdminMode();
    showToast('تم تفعيل وضع المدير 🚀', 'success');
}

function enableAdminMode() {
    isAdmin = true;
    document.body.classList.add('admin-mode');
    document.getElementById('admin-toolbar').classList.remove('hidden');
    renderAll(); // إعادة الرسم لإظهار أدوات التحكم
}

function logout() {
    localStorage.removeItem('saved_repo');
    localStorage.removeItem('saved_token');
    localStorage.removeItem('login_time');
    location.reload();
}

async function saveToGitHub() {
    const btn = document.querySelector('#admin-toolbar button');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...';
    
    // Auto Backup قبل الحفظ
    localStorage.setItem('backup_data', JSON.stringify(appData));

    try {
        const url = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        
        // 1. جلب SHA الملف الحالي
        const getRes = await fetch(url, { headers: { 'Authorization': `token ${githubInfo.token}` } });
        if(!getRes.ok) throw new Error("فشل الاتصال بـ GitHub. تأكد من التوكن.");
        
        const fileData = await getRes.json();
        
        // 2. تشفير البيانات (UTF-8 Safe Base64)
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2))));
        
        // 3. إرسال التحديث
        await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${githubInfo.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: "Update via Admin Panel", 
                content: content, 
                sha: fileData.sha 
            })
        });
        
        showToast('تم الحفظ في GitHub بنجاح! ✅', 'success');
    } catch(e) {
        showToast('خطأ في الحفظ: ' + e.message, 'error');
    } finally {
        btn.innerHTML = oldText;
    }
}

function restoreBackup() {
    const data = localStorage.getItem('backup_data');
    if(data) {
        appData = JSON.parse(data);
        renderAll();
        showToast('تم استعادة آخر نسخة محفوظة محلياً', 'success');
    } else {
        showToast('لا توجد نسخة احتياطية', 'error');
    }
}

// =========================================
// 9. HELPER FUNCTIONS & EXTRAS
// =========================================
function setSmartGreeting() {
    const hour = new Date().getHours();
    const msgs = {
        ar: { m: "صباح الخير ☀️", a: "مساء الخير 🌤️", e: "مساء النور 🌙" },
        en: { m: "Good Morning ☀️", a: "Good Afternoon 🌤️", e: "Good Evening 🌙" }
    };
    const timeKey = hour < 12 ? 'm' : (hour < 18 ? 'a' : 'e');
    const el = document.getElementById('smart-greeting');
    if(el) el.innerText = msgs[currentLang][timeKey];
}

function setupCmdPalette() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('cmd-palette').classList.remove('hidden');
            document.getElementById('cmd-input').focus();
            renderCmdItems();
        }
        if (e.key === 'Escape') document.getElementById('cmd-palette').classList.add('hidden');
    });
}

function renderCmdItems() {
    const items = [
        { icon: 'fa-home', text: 'الرئيسية / Home', action: () => showPage('home') },
        { icon: 'fa-language', text: 'اللغة / Language', action: toggleLanguage },
        { icon: 'fa-moon', text: 'المظهر / Theme', action: () => document.getElementById('theme-btn').click() },
        { icon: 'fa-user-cog', text: 'دخول المالك / Admin', action: () => document.getElementById('secret-trigger').click() }
    ];
    document.getElementById('cmd-list').innerHTML = items.map(i => `
        <div class="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex gap-3 items-center rounded transition" 
             onclick="this.parentElement.parentElement.parentElement.classList.add('hidden'); (${i.action})()">
            <i class="fas ${i.icon} text-primary"></i> <span class="font-bold dark:text-white">${i.text}</span>
        </div>
    `).join('');
}

function filterCmd(val) {
    // يمكن تطوير هذا الفلتر لاحقاً للبحث في المشاريع
}

function setupKonamiCode() {
    const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let idx = 0;
    document.addEventListener('keydown', (e) => {
        if (e.key === code[idx]) {
            idx++;
            if (idx === code.length) {
                showToast("Party Mode Activated! 🎉", "success");
                initParticles(true);
                idx = 0;
            }
        } else { idx = 0; }
    });
}

function handleContact(e) {
    e.preventDefault();
    if(FORMSPREE_ENDPOINT.includes("https://formspree.io/f/xqarljpg")) {
        showToast("تم الإرسال بنجاح", "info");
    } else {
        const form = e.target;
        fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            body: new FormData(form),
            headers: {'Accept': 'application/json'}
        }).then(res => {
            if(res.ok) { showToast("تم الإرسال بنجاح", "success"); form.reset(); }
            else showToast("حدث خطأ في الإرسال", "error");
        });
    }
}

function typeWriter(text, elementId) {
    const elm = document.getElementById(elementId);
    if(elm) {
        elm.innerHTML = "";
        let i = 0;
        const interval = setInterval(() => {
            elm.innerHTML += text.charAt(i);
            i++;
            if (i >= text.length) clearInterval(interval);
        }, 100);
    }
}

function initTheme() {
    const btn = document.getElementById('theme-btn');
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
    btn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        initParticles();
    });
}

function initParticles(party = false) {
    const isDark = document.documentElement.classList.contains('dark');
    particlesJS("particles-js", {
        "particles": {
            "number": { "value": party ? 100 : 40 },
            "color": { "value": party ? ["#f00", "#0f0", "#00f"] : (isDark ? "#ffffff" : "#3b82f6") },
            "opacity": { "value": 0.3 },
            "size": { "value": 3 },
            "line_linked": { "enable": true, "distance": 150, "color": isDark ? "#ffffff" : "#3b82f6", "opacity": 0.1, "width": 1 },
            "move": { "enable": true, "speed": party ? 10 : 1 }
        },
        "interactivity": {
            "detect_on": "canvas",
            "events": { "onhover": { "enable": true, "mode": "grab" } }
        },
        "retina_detect": true
    });
}

function setDeepValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}

function showToast(msg, type) {
    Toastify({
        text: msg,
        duration: 3000,
        gravity: "top",
        position: "center",
        style: { background: type === 'success' ? '#10B981' : (type==='info'?'#3b82f6':'#EF4444') }
    }).showToast();
}
