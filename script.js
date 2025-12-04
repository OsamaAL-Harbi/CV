/**
 * OSAMA PORTFOLIO - ULTIMATE EDITION
 * Features: SPA, i18n, CRUD, GitHub Sync, PWA, Security, Analytics
 */

// --- 1. Global State ---
let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };
let currentLang = localStorage.getItem('lang') || 'ar';
let isAdmin = false;
let clickCount = 0;
const SESSION_DURATION = 60 * 60 * 1000; // 1 Hour Session

// --- 2. Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    AOS.init();
    document.getElementById('year').textContent = new Date().getFullYear();
    
    // Setup Core
    setDirection();
    loadContent();
    initTheme();
    initParticles();
    
    // Setup Features
    setupSecretTrigger();
    checkSession();
    setupCmdPalette();
    setupKonamiCode();
    registerPWA();
    
    // Check saved credentials
    if(localStorage.getItem('saved_repo')) {
        document.getElementById('repo-input').value = localStorage.getItem('saved_repo');
        document.getElementById('token-input').value = localStorage.getItem('saved_token');
    }
});

// --- 3. PWA Registration ---
function registerPWA() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
        .catch(err => console.log('SW Load Error', err));
    }
}

// --- 4. Navigation & UI ---
function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    const target = document.getElementById(pageId);
    if(target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
    }
    
    // Update Navbar
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('nav-active'));
    const navBtn = document.getElementById(`nav-${pageId}`);
    if(navBtn) navBtn.classList.add('nav-active');
    
    // Close Mobile Menu if open
    const mobileMenu = document.getElementById('mobile-menu');
    if(mobileMenu.classList.contains('open')) toggleMobileMenu();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

// --- 5. Localization System ---
function t(data) {
    // Return translation based on current language
    if (typeof data === 'object' && data !== null && (data.ar || data.en)) {
        return data[currentLang] || data.ar;
    }
    return data;
}

function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('lang', currentLang);
    setDirection();
    renderAll(); // Re-render content
    updateStaticText();
}

function setDirection() {
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
    document.getElementById('lang-btn').textContent = currentLang === 'ar' ? 'EN' : 'عربي';
}

function updateStaticText() {
    const texts = {
        ar: { 
            nav_home:"الرئيسية", nav_resume:"السيرة الذاتية", nav_portfolio:"الأعمال", nav_contact:"تواصل", 
            btn_projects:"أعمالي", btn_contact:"تواصل", btn_save:"حفظ", btn_restore:"استعادة",
            sec_resume:"الخبرات والتعليم", sec_exp:"الخبرات", sec_skills:"المهارات", sec_certs:"الشهادات", sec_projects:"المشاريع", 
            contact_title:"راسلني", btn_email:"إرسال"
        },
        en: { 
            nav_home:"Home", nav_resume:"Resume", nav_portfolio:"Portfolio", nav_contact:"Contact", 
            btn_projects:"My Work", btn_contact:"Contact", btn_save:"Save", btn_restore:"Restore",
            sec_resume:"Resume & Education", sec_exp:"Experience", sec_skills:"Skills", sec_certs:"Certificates", sec_projects:"Projects", 
            contact_title:"Get in Touch", btn_email:"Send"
        }
    };
    
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if(texts[currentLang][key]) el.innerText = texts[currentLang][key];
    });
}

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

// --- 6. Data Management ---
async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if(!res.ok) throw new Error("File not found");
        appData = await res.json();
        renderAll();
        updateStaticText();
        setSmartGreeting();
        // Remove Loader
        setTimeout(() => document.getElementById('loading-screen').classList.add('hidden'), 500);
    } catch (err) {
        showToast("Error loading data", "error");
        document.getElementById('loading-screen').classList.add('hidden');
    }
}

function renderAll() {
    const p = appData.profile;
    updateText('profile.name', t(p.name));
    updateText('profile.summary', t(p.summary));
    
    // Smart Image
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(t(p.name))}&background=0D8ABC&color=fff&size=200`;
    const imgEl = document.getElementById('profile-img');
    imgEl.src = p.image || fallback;
    imgEl.onerror = function() { this.src = fallback; };

    typeWriter(t(p.title), 'typewriter');
    
    // Links
    document.getElementById('email-contact').href = `mailto:${p.email}`;
    document.getElementById('social-linkedin').href = p.linkedin;
    document.getElementById('social-github').href = p.github;

    // Render Sections
    renderSection('experience', appData.experience, (item) => `
        <h3 class="text-xl font-bold dark:text-white">${t(item.role)}</h3>
        <p class="text-primary font-medium text-sm">${t(item.company)}</p>
        <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs mb-3 font-bold">${t(item.period)}</span>
        <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${t(item.description)}</p>
    `);

    renderSection('skills', appData.skills, (item) => `<span class="font-bold text-sm">${t(item)}</span>`, 'inline-block px-4 py-2 bg-white dark:bg-cardBg rounded-lg border dark:border-gray-700 shadow-sm cursor-default hover:border-primary transition');

    renderSection('certificates', appData.certificates, (item) => `
        <div class="text-2xl text-secondary"><i class="fas fa-certificate"></i></div>
        <div>
            <h4 class="font-bold text-sm dark:text-white">${t(item.name)}</h4>
            <p class="text-xs text-gray-500 mt-1">${t(item.issuer)} | ${t(item.date)}</p>
        </div>
    `, 'flex items-center gap-4 bg-white dark:bg-cardBg p-4 rounded-xl border dark:border-gray-700 shadow-sm');

    renderSection('projects', appData.projects, (item) => `
        <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center relative overflow-hidden group">
            <i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500"></i>
            <div class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-sm">
                <a href="${item.link}" target="_blank" class="px-6 py-2 bg-white text-gray-900 rounded-full font-bold transform translate-y-4 group-hover:translate-y-0 transition">View</a>
            </div>
        </div>
        <div class="p-6 flex-grow">
            <h3 class="text-lg font-bold mb-2">${t(item.title)}</h3>
            <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-3">${t(item.desc)}</p>
        </div>
    `, 'bg-white dark:bg-cardBg rounded-2xl border dark:border-gray-700 overflow-hidden flex flex-col h-full shadow-sm hover:shadow-xl transition');
}

function renderSection(type, data, contentFn, wrapperClass = 'relative group mb-8') {
    const container = document.getElementById(`${type}-container`);
    if(!container) return;
    
    container.innerHTML = data.map((item, i) => `
        <div class="${wrapperClass}">
            ${renderAdminButtons(type, i)}
            ${type === 'experience' ? `<div class="absolute -right-[39px] ltr:-left-[39px] top-1 w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-darkBg z-10"></div>` : ''}
            ${contentFn(item)}
        </div>
    `).join('');
}

function renderAdminButtons(type, index) {
    if (!isAdmin) return '';
    return `<div class="admin-element absolute top-2 left-2 ltr:right-2 ltr:left-auto z-20 gap-2 opacity-0 group-hover:opacity-100 transition">
        <button onclick="manageItem('${type}', ${index})" class="bg-blue-500 text-white w-7 h-7 rounded shadow flex items-center justify-center hover:scale-110 transition"><i class="fas fa-pen text-[10px]"></i></button>
        <button onclick="deleteItem('${type}', ${index})" class="bg-red-500 text-white w-7 h-7 rounded shadow flex items-center justify-center hover:scale-110 transition"><i class="fas fa-trash text-[10px]"></i></button>
    </div>`;
}

// --- 7. Powerful Admin System (Add + Edit Combined) ---
async function manageItem(type, index = null) {
    if(!isAdmin) return;
    const isEdit = index !== null;
    const item = isEdit ? appData[type][index] : {};
    
    // Define Schema for each type
    const schemas = {
        skills: [{key:'ar', label:'اسم المهارة (AR)'}, {key:'en', label:'Skill Name (EN)'}],
        experience: [
            {key:'role', label:'المسمى (Role)'}, {key:'company', label:'الشركة (Company)'}, 
            {key:'period', label:'التاريخ (Date)'}, {key:'description', label:'الوصف (Desc)', type:'textarea'}
        ],
        projects: [
            {key:'title', label:'العنوان (Title)'}, {key:'desc', label:'الوصف (Desc)', type:'textarea'}, 
            {key:'link', label:'الرابط (Link)', simple:true} // Simple means no translation needed
        ],
        certificates: [
            {key:'name', label:'الاسم (Name)'}, {key:'issuer', label:'الجهة (Issuer)'}, 
            {key:'date', label:'التاريخ (Date)', simple:true}
        ]
    };

    const schema = schemas[type];
    if(!schema) return;

    // Generate HTML for Inputs
    let html = schema.map(f => {
        if(f.simple) {
            const val = isEdit ? (item[f.key] || '') : '';
            return `<input id="swal-${f.key}" class="swal2-input" placeholder="${f.label}" value="${val}">`;
        }
        
        const valAr = isEdit && item[f.key] ? item[f.key].ar : '';
        const valEn = isEdit && item[f.key] ? item[f.key].en : '';
        
        if(f.type === 'textarea') {
            return `<textarea id="swal-${f.key}-ar" class="swal2-textarea" placeholder="${f.label} - Arabic">${valAr}</textarea>
                    <textarea id="swal-${f.key}-en" class="swal2-textarea" placeholder="${f.label} - English">${valEn}</textarea>`;
        }
        return `<div class="grid grid-cols-2 gap-2">
                    <input id="swal-${f.key}-ar" class="swal2-input" placeholder="${f.label} - AR" value="${valAr}">
                    <input id="swal-${f.key}-en" class="swal2-input" placeholder="${f.label} - EN" value="${valEn}">
                </div>`;
    }).join('');

    const { value } = await Swal.fire({
        title: isEdit ? 'تعديل العنصر' : 'إضافة عنصر جديد',
        html: `<div class="text-left text-sm">${html}</div>`,
        width: '600px',
        confirmButtonText: 'حفظ البيانات',
        showCancelButton: true,
        focusConfirm: false,
        preConfirm: () => {
            let obj = {};
            schema.forEach(f => {
                if(f.simple) obj[f.key] = document.getElementById(`swal-${f.key}`).value;
                else obj[f.key] = { 
                    ar: document.getElementById(`swal-${f.key}-ar`).value, 
                    en: document.getElementById(`swal-${f.key}-en`).value 
                };
            });
            return obj;
        }
    });

    if(value) {
        if (isEdit) {
            appData[type][index] = value;
        } else {
            appData[type].push(value);
        }
        renderAll();
    }
}

// Wrapper for "Add" button
function addItem(type) { manageItem(type); }
// Wrapper for "Edit" button
function editItem(type, index) { manageItem(type, index); }

function deleteItem(type, index) {
    Swal.fire({
        title: 'حذف العنصر؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'نعم، حذف'
    }).then((result) => {
        if (result.isConfirmed) {
            appData[type].splice(index, 1);
            renderAll();
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
                
                // Save to correct language
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
        inputLabel: 'ضع رابط الصورة الجديد (Imgur/Drive/GitHub)',
        inputPlaceholder: 'https://...'
    });
    if (value) {
        setDeepValue(appData, key, value);
        renderAll();
    }
}

// --- 8. Helper Functionality (Cmd+K, Contact, etc) ---
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
        { icon: 'fa-language', text: 'تغيير اللغة / Language', action: toggleLanguage },
        { icon: 'fa-moon', text: 'المظهر / Theme', action: () => document.getElementById('theme-btn').click() },
        { icon: 'fa-user-cog', text: 'دخول المالك / Login', action: () => document.getElementById('secret-trigger').click() }
    ];
    document.getElementById('cmd-list').innerHTML = items.map(i => `
        <div class="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex gap-3 items-center rounded transition" 
             onclick="this.parentElement.parentElement.parentElement.classList.add('hidden'); (${i.action})()">
            <i class="fas ${i.icon} text-primary"></i> <span class="font-bold dark:text-white">${i.text}</span>
        </div>
    `).join('');
}

function filterCmd(val) {
    // Simple filter logic can be added here
}

function setupKonamiCode() {
    const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let idx = 0;
    document.addEventListener('keydown', (e) => {
        if (e.key === code[idx]) { idx++; if(idx===code.length){ showToast("Party Mode! 🎉", "success"); initParticles(true); idx=0; }} 
        else idx=0;
    });
}

function handleContact(e) {
    // Basic Formspree integration example
    // In production, user should replace 'YOUR_FORM_ID' inside action attribute in HTML or here
}

// --- 9. Auth & Security ---
function checkSession() {
    const t = localStorage.getItem('login_time');
    if (localStorage.getItem('saved_token')) {
        if (t && (Date.now() - t > SESSION_DURATION)) {
            logout();
            showToast("Session Expired", "error");
        } else {
            githubInfo.repo = localStorage.getItem('saved_repo');
            githubInfo.token = localStorage.getItem('saved_token');
            enableAdminMode();
        }
    }
}

function authenticateAndEdit() {
    const r = document.getElementById('repo-input').value.trim();
    const t = document.getElementById('token-input').value.trim();
    if(!r || !t) return showToast('بيانات ناقصة', 'error');
    
    localStorage.setItem('saved_repo', r);
    localStorage.setItem('saved_token', t);
    localStorage.setItem('login_time', Date.now());
    githubInfo.repo = r; githubInfo.token = t;
    
    document.getElementById('admin-modal').classList.add('hidden');
    enableAdminMode();
    showToast('تم تفعيل وضع التعديل 🚀', 'success');
}

function enableAdminMode() {
    isAdmin = true;
    document.body.classList.add('admin-mode');
    document.getElementById('admin-toolbar').classList.remove('hidden');
    renderAll();
}

function logout() {
    localStorage.clear();
    location.reload();
}

async function saveToGitHub() {
    const btn = document.querySelector('#admin-toolbar button');
    const old = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ...';
    
    localStorage.setItem('backup_data', JSON.stringify(appData)); // Auto Backup

    try {
        const url = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const get = await fetch(url, { headers: {'Authorization': `token ${githubInfo.token}`} });
        if(!get.ok) throw new Error("Auth Failed");
        const file = await get.json();
        
        await fetch(url, {
            method: 'PUT',
            headers: { 'Authorization': `token ${githubInfo.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: "Update Content via Web Admin", 
                content: btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2)))), 
                sha: file.sha 
            })
        });
        showToast('تم الحفظ في GitHub بنجاح! ✅', 'success');
    } catch(e) {
        showToast('خطأ في الحفظ: ' + e.message, 'error');
    } finally {
        btn.innerHTML = old;
    }
}

function restoreBackup() {
    const d = localStorage.getItem('backup_data');
    if(d) { appData = JSON.parse(d); renderAll(); showToast('تم استعادة النسخة الاحتياطية', 'success'); }
    else showToast('لا توجد نسخة احتياطية', 'error');
}

async function triggerImageUpload(key) {
    const input = document.getElementById('image-upload-input');
    input.onchange = async (e) => {
        // Here you would implement Imgur upload. For now, prompt URL.
        editImage(key);
    };
    input.click();
}

// --- 10. Core Helpers ---
function setupSecretTrigger() {
    document.getElementById('secret-trigger').addEventListener('click', () => {
        clickCount++;
        if(clickCount === 3) { document.getElementById('admin-modal').classList.remove('hidden'); clickCount=0; }
    });
}
function setDeepValue(obj, path, value) { const keys = path.split('.'); let current = obj; for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]]; current[keys[keys.length - 1]] = value; }
function typeWriter(t,id) { const e=document.getElementById(id); if(e){ e.innerHTML=""; let i=0; const int=setInterval(()=>{e.innerHTML+=t.charAt(i);i++; if(i>=t.length) clearInterval(int)},100); }}
function initTheme() { const b=document.getElementById('theme-btn'); if(localStorage.theme==='dark'||(!('theme' in localStorage)&&window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); b.addEventListener('click', ()=>{ document.documentElement.classList.toggle('dark'); localStorage.theme=document.documentElement.classList.contains('dark')?'dark':'light'; initParticles(); }); }
function initParticles(party=false) { const isDark = document.documentElement.classList.contains('dark'); particlesJS("particles-js", { particles: { number: { value: party?80:30 }, color: { value: party?["#f00","#0f0","#00f"]:(isDark ? "#ffffff" : "#3b82f6") }, opacity: { value: 0.3 }, size: { value: 3 }, line_linked: { enable: true, distance: 150, color: isDark ? "#ffffff" : "#3b82f6", opacity: 0.1, width: 1 }, move: { enable: true, speed: party?10:1 } }, interactivity: { detect_on: "canvas", events: { onhover: { enable: true, mode: "grab" } } }, retina_detect: true }); }
function showToast(m,t) { Toastify({text:m, duration:3000, style:{background:t==='success'?'#10B981':'#EF4444'}}).showToast(); }
