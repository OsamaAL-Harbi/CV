// --- Global State ---
let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };
let currentLang = localStorage.getItem('lang') || 'ar';
let isAdmin = false;
let clickCount = 0;
const SESSION_DURATION = 60 * 60 * 1000;

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
    AOS.init();
    document.getElementById('year').textContent = new Date().getFullYear();
    setDirection();
    loadContent();
    initTheme();
    initParticles();
    setupSecretTrigger();
    checkSession();
    setupCmdPalette();
    setupKonamiCode();
    registerPWA();
});

// --- 1. PWA ---
function registerPWA() {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}

// --- 2. Localization ---
function t(data) {
    if (typeof data === 'object' && data !== null && (data.ar || data.en)) return data[currentLang] || data.ar;
    return data;
}

function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    localStorage.setItem('lang', currentLang);
    setDirection();
    renderAll();
    updateStaticText();
}

function setDirection() {
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;
    document.getElementById('lang-btn').textContent = currentLang === 'ar' ? 'EN' : 'عربي';
}

function updateStaticText() {
    const texts = {
        ar: { nav_home:"الرئيسية", nav_resume:"السيرة الذاتية", nav_portfolio:"الأعمال", nav_contact:"تواصل", btn_projects:"أعمالي", btn_contact:"تواصل", sec_resume:"الخبرات والتعليم", sec_exp:"الخبرات", sec_skills:"المهارات", sec_certs:"الشهادات", sec_projects:"المشاريع", contact_title:"راسلني", btn_email:"إرسال بريد", btn_save:"حفظ", btn_restore:"استعادة" },
        en: { nav_home:"Home", nav_resume:"Resume", nav_portfolio:"Portfolio", nav_contact:"Contact", btn_projects:"My Work", btn_contact:"Contact", sec_resume:"Resume & Education", sec_exp:"Experience", sec_skills:"Skills", sec_certs:"Certificates", sec_projects:"Projects", contact_title:"Get in Touch", btn_email:"Send Email", btn_save:"Save", btn_restore:"Restore" }
    };
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if(texts[currentLang][key]) el.innerText = texts[currentLang][key];
    });
}

// --- 3. Rendering ---
async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if(!res.ok) throw new Error("Failed");
        appData = await res.json();
        renderAll();
        updateStaticText();
        setSmartGreeting();
        setTimeout(() => document.getElementById('loading-screen').classList.add('hidden'), 500);
    } catch (err) { showToast("Error loading data", "error"); }
}

function renderAll() {
    const p = appData.profile;
    updateText('profile.name', t(p.name));
    updateText('profile.summary', t(p.summary));
    
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(t(p.name))}&background=0D8ABC&color=fff&size=200`;
    const imgEl = document.getElementById('profile-img');
    if(imgEl) {
        imgEl.src = p.image || fallback;
        imgEl.onerror = function() { this.src = fallback; };
    }

    typeWriter(t(p.title), 'typewriter');
    document.getElementById('social-linkedin').href = p.linkedin;
    document.getElementById('social-github').href = p.github;

    // Sections
    renderSection('experience', appData.experience, (item) => `
        <h3 class="text-xl font-bold dark:text-white" onclick="${isAdmin ? `editItem('experience', ${appData.experience.indexOf(item)})` : ''}">${t(item.role)}</h3>
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

    if(isAdmin) initSortable();
}

function renderSection(type, data, contentFn, wrapperClass = 'relative group mb-8') {
    const container = document.getElementById(`${type}-container`);
    if(container) {
        container.innerHTML = data.map((item, i) => `
            <div class="${wrapperClass} sortable-item" data-id="${i}">
                ${renderAdminButtons(type, i)}
                ${type === 'experience' ? `<div class="absolute -right-[39px] ltr:-left-[39px] top-1 w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-darkBg z-10"></div>` : ''}
                ${contentFn(item)}
            </div>
        `).join('');
    }
}

function renderAdminButtons(type, index) {
    if (!isAdmin) return '';
    return `<div class="admin-element absolute top-2 left-2 ltr:right-2 ltr:left-auto z-20 gap-2 opacity-0 group-hover:opacity-100 transition flex items-center">
        <span class="drag-handle bg-gray-200 dark:bg-gray-700 text-gray-500 w-7 h-7 rounded shadow flex items-center justify-center hover:bg-gray-300 cursor-move"><i class="fas fa-grip-vertical text-[10px]"></i></span>
        <button onclick="editItem('${type}', ${index})" class="bg-blue-500 text-white w-7 h-7 rounded shadow flex items-center justify-center hover:scale-110 transition"><i class="fas fa-pen text-[10px]"></i></button>
        <button onclick="deleteItem('${type}', ${index})" class="bg-red-500 text-white w-7 h-7 rounded shadow flex items-center justify-center hover:scale-110 transition"><i class="fas fa-trash text-[10px]"></i></button>
    </div>`;
}

// --- 4. Admin Logic (Combined Add/Edit) ---
async function manageItem(type, index = null) {
    if(!isAdmin) return;
    const isEdit = index !== null;
    const item = isEdit ? appData[type][index] : {};
    
    // Schemas define inputs
    const schemas = {
        skills: [{key:'ar', label:'اسم المهارة'}, {key:'en', label:'Skill Name'}],
        experience: [{key:'role', label:'المسمى'}, {key:'company', label:'الشركة'}, {key:'period', label:'التاريخ'}, {key:'description', label:'الوصف', type:'textarea'}],
        projects: [{key:'title', label:'العنوان'}, {key:'desc', label:'الوصف', type:'textarea'}, {key:'link', label:'الرابط', simple:true}],
        certificates: [{key:'name', label:'الاسم'}, {key:'issuer', label:'الجهة'}, {key:'date', label:'التاريخ', simple:true}]
    };

    const schema = schemas[type];
    if(!schema) return;

    let html = schema.map(f => {
        if(f.simple) {
            const val = isEdit ? (item[f.key] || '') : '';
            return `<input id="swal-${f.key}" class="swal2-input" placeholder="${f.label}" value="${val}">`;
        }
        const valAr = isEdit && item[f.key] ? item[f.key].ar : '';
        const valEn = isEdit && item[f.key] ? item[f.key].en : '';
        if(f.type === 'textarea') return `<textarea id="swal-${f.key}-ar" class="swal2-textarea" placeholder="${f.label} (عربي)">${valAr}</textarea><textarea id="swal-${f.key}-en" class="swal2-textarea" placeholder="${f.label} (English)">${valEn}</textarea>`;
        return `<div class="grid grid-cols-2 gap-2"><input id="swal-${f.key}-ar" class="swal2-input" placeholder="${f.label} (AR)" value="${valAr}"><input id="swal-${f.key}-en" class="swal2-input" placeholder="${f.label} (EN)" value="${valEn}"></div>`;
    }).join('');

    const { value } = await Swal.fire({
        title: isEdit ? 'تعديل' : 'إضافة',
        html: html,
        width: '600px',
        confirmButtonText: 'حفظ',
        showCancelButton: true,
        focusConfirm: false,
        preConfirm: () => {
            let obj = {};
            schema.forEach(f => {
                if(f.simple) obj[f.key] = document.getElementById(`swal-${f.key}`).value;
                else obj[f.key] = { ar: document.getElementById(`swal-${f.key}-ar`).value, en: document.getElementById(`swal-${f.key}-en`).value };
            });
            return obj;
        }
    });

    if(value) {
        if(type === 'skills') isEdit ? appData.skills[index] = value : appData.skills.push(value);
        else isEdit ? appData[type][index] = value : appData[type].push(value);
        renderAll();
    }
}

function addItem(type) { manageItem(type); }
function editItem(type, index) { manageItem(type, index); }

function deleteItem(type, index) {
    Swal.fire({ title: 'حذف؟', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then((r) => { 
        if(r.isConfirmed){ appData[type].splice(index,1); renderAll(); }
    });
}

function initSortable() {
    ['experience-container', 'skills-container', 'certificates-container', 'projects-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const type = id.replace('-container', '');
            new Sortable(el, {
                animation: 150,
                handle: '.drag-handle',
                ghostClass: 'bg-blue-100',
                onEnd: function (evt) {
                    const item = appData[type].splice(evt.oldIndex, 1)[0];
                    appData[type].splice(evt.newIndex, 0, item);
                    renderAll(); 
                }
            });
        }
    });
}

// --- Auth & Save ---
function checkSession() {
    const t = localStorage.getItem('login_time');
    if (localStorage.getItem('saved_token')) {
        if (t && (Date.now() - t > SESSION_DURATION)) { logout(); showToast("انتهت الجلسة", "error"); }
        else { githubInfo.repo=localStorage.getItem('saved_repo'); githubInfo.token=localStorage.getItem('saved_token'); enableAdminMode(); }
    }
}
function authenticateAndEdit() {
    const r = document.getElementById('repo-input').value.trim();
    const t = document.getElementById('token-input').value.trim();
    if(!r || !t) return showToast('Error', 'error');
    localStorage.setItem('saved_repo', r); localStorage.setItem('saved_token', t); localStorage.setItem('login_time', Date.now());
    githubInfo.repo=r; githubInfo.token=t;
    document.getElementById('admin-modal').classList.add('hidden'); enableAdminMode();
}
function enableAdminMode() { isAdmin=true; document.body.classList.add('admin-mode'); document.getElementById('admin-toolbar').classList.remove('hidden'); renderAll(); }
function logout() { localStorage.clear(); location.reload(); }

async function saveToGitHub() {
    const btn = document.querySelector('#admin-toolbar button');
    btn.innerHTML = '...';
    localStorage.setItem('backup_data', JSON.stringify(appData));
    try {
        const url = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const get = await fetch(url, { headers: {'Authorization': `token ${githubInfo.token}`} });
        if(!get.ok) throw new Error("Auth Failed");
        const file = await get.json();
        await fetch(url, { method: 'PUT', headers: {'Authorization': `token ${githubInfo.token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ message: "Update", content: btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2)))), sha: file.sha }) });
        showToast('تم الحفظ!', 'success');
    } catch(e) { showToast('خطأ', 'error'); } finally { btn.innerHTML = 'حفظ'; }
}
function restoreBackup() { const d = localStorage.getItem('backup_data'); if(d){ appData=JSON.parse(d); renderAll(); showToast('تمت الاستعادة', 'success'); } }

// --- Helpers ---
function updateText(key, value) { const el = document.querySelector(`[data-path="${key}"]`); if(el) { el.innerText = value; if(isAdmin) { el.contentEditable="true"; el.classList.add('editable-active'); el.onblur=()=>setDeepValue(appData, key, el.innerText); } } }
function setDeepValue(obj, path, value) { const keys = path.split('.'); let current = obj; for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]]; current[keys[keys.length - 1]][currentLang] = value; }
async function editImage(key) { if(!isAdmin) return; const {value} = await Swal.fire({input:'url', title:'رابط الصورة'}); if(value) { let obj=appData; const p=key.split('.'); for(let i=0; i<p.length-1; i++) obj=obj[p[i]]; obj[p[p.length-1]] = value; renderAll(); }}
async function triggerImageUpload(key) { editImage(key); }
function setSmartGreeting() { const h=new Date().getHours(),m={ar:{m:"صباح الخير",a:"مساء الخير",e:"مساء النور"},en:{m:"Good Morning",a:"Good Afternoon",e:"Good Evening"}}; document.getElementById('smart-greeting').innerText=m[currentLang][h<12?'m':(h<18?'a':'e')]; }
function setupCmdPalette() { document.addEventListener('keydown', (e)=>{ if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();document.getElementById('cmd-palette').classList.remove('hidden');document.getElementById('cmd-input').focus();} if(e.key==='Escape')document.getElementById('cmd-palette').classList.add('hidden'); }); }
function filterCmd(v) { const l=document.getElementById('cmd-list'); l.innerHTML = [{text:'Home',a:()=>showPage('home')},{text:'Language',a:toggleLanguage}].filter(i=>i.text.toLowerCase().includes(v.toLowerCase())).map(i=>`<div class="p-2 hover:bg-gray-100 cursor-pointer" onclick="this.parentElement.parentElement.classList.add('hidden');(${i.a})()">${i.text}</div>`).join(''); }
function setupKonamiCode() { const c=['ArrowUp','ArrowUp','ArrowDown','ArrowDown','b','a'], l=c.length; let i=0; document.addEventListener('keydown',e=>{if(e.key===c[i])i++; else i=0; if(i===l){showToast("Party!","success");initParticles(true);i=0;}}); }
function handleContact(e) { e.preventDefault(); showToast("تم الإرسال!", "success"); e.target.reset(); }
function setupSecretTrigger() { document.getElementById('secret-trigger').addEventListener('click', ()=>{ clickCount++; if(clickCount===3){ document.getElementById('admin-modal').classList.remove('hidden'); clickCount=0; } }); }
function typeWriter(t,id) { const e=document.getElementById(id); if(e){ e.innerHTML=""; let i=0; const x=setInterval(()=>{e.innerHTML+=t.charAt(i);i++;if(i>=t.length)clearInterval(x)},100); }}
function initTheme() { const b=document.getElementById('theme-btn'); if(localStorage.theme==='dark'||(!('theme' in localStorage)&&window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); b.addEventListener('click', ()=>{ document.documentElement.classList.toggle('dark'); localStorage.theme=document.documentElement.classList.contains('dark')?'dark':'light'; initParticles(); }); }
function initParticles(p=false) { const d=document.documentElement.classList.contains('dark'); particlesJS("particles-js", { particles: { number: { value: p?80:30 }, color: { value: d?"#ffffff":"#3b82f6" }, opacity: { value: 0.3 }, size: { value: 3 }, line_linked: { enable: true, color: d?"#ffffff":"#3b82f6", opacity: 0.1 }, move: { enable: true, speed: 1 } } }); }
function showToast(m,t) { Toastify({text:m, duration:3000, style:{background:t==='success'?'#10B981':'#EF4444'}}).showToast(); }
