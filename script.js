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
    logVisit();
});

// --- 1. Localization ---
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

// --- 2. Smart Greeting ---
function setSmartGreeting() {
    const hour = new Date().getHours();
    const msgs = {
        ar: { m: "صباح الخير ☀️", a: "مساء الخير 🌤️", e: "مساء النور 🌙" },
        en: { m: "Good Morning ☀️", a: "Good Afternoon 🌤️", e: "Good Evening 🌙" }
    };
    const timeKey = hour < 12 ? 'm' : (hour < 18 ? 'a' : 'e');
    document.getElementById('smart-greeting').innerText = msgs[currentLang][timeKey];
}

// --- 3. Core Logic ---
async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if(!res.ok) throw new Error("Failed");
        appData = await res.json();
        renderAll();
        updateStaticText();
        setSmartGreeting();
        // Hide loader
        setTimeout(() => document.getElementById('loading-screen').classList.add('hidden'), 500);
    } catch (err) { showToast("Error loading data", "error"); }
}

function renderAll() {
    const p = appData.profile;
    updateText('profile.name', t(p.name));
    updateText('profile.summary', t(p.summary));
    
    // Smart Image Fallback
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(t(p.name))}&background=0D8ABC&color=fff&size=200`;
    document.getElementById('profile-img').src = p.image || fallback;
    document.getElementById('profile-img').onerror = function() { this.src = fallback; };

    typeWriter(t(p.title), 'typewriter');
    document.getElementById('social-linkedin').href = p.linkedin;
    document.getElementById('social-github').href = p.github;

    // Experience
    document.getElementById('experience-container').innerHTML = appData.experience.map((exp, i) => `
        <div class="relative group mb-8" data-aos="fade-up">
            ${renderAdminButtons('experience', i)}
            <div class="absolute -right-[39px] ltr:-left-[39px] top-1 w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-darkBg z-10"></div>
            <div class="mb-1">
                <h3 class="text-xl font-bold dark:text-white" onclick="${isAdmin ? `editItem('experience', ${i})` : ''}">${t(exp.role)}</h3>
                <p class="text-primary font-medium text-sm">${t(exp.company)}</p>
            </div>
            <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs font-bold mb-3">${t(exp.period)}</span>
            <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${t(exp.description)}</p>
        </div>
    `).join('');

    // Skills
    document.getElementById('skills-container').innerHTML = appData.skills.map((s, i) => `
        <div class="relative group inline-block">
            <span class="px-3 py-1 bg-white dark:bg-cardBg border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold dark:text-gray-300 cursor-default">${t(s)}</span>
            ${isAdmin ? `<button onclick="deleteItem('skills', ${i})" class="absolute -top-2 -right-2 ltr:-right-2 ltr:-left-auto w-5 h-5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center">×</button>` : ''}
        </div>
    `).join('');

    // Projects
    document.getElementById('projects-container').innerHTML = appData.projects.map((proj, i) => `
        <div class="relative group bg-white dark:bg-cardBg rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition border border-gray-100 dark:border-gray-700 flex flex-col h-full">
            ${renderAdminButtons('projects', i)}
            <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center relative overflow-hidden">
                <i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500"></i>
                <div class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-sm">
                    <a href="${proj.link}" target="_blank" class="px-6 py-2 bg-white text-gray-900 rounded-full font-bold transform translate-y-4 group-hover:translate-y-0 transition">View</a>
                </div>
            </div>
            <div class="p-6 flex-grow">
                <h3 class="text-lg font-bold mb-2">${t(proj.title)}</h3>
                <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-3">${t(proj.desc)}</p>
            </div>
        </div>
    `).join('');

    // Certificates
    if(appData.certificates) {
        document.getElementById('certificates-container').innerHTML = appData.certificates.map((cert, i) => `
            <div class="relative group bg-white dark:bg-cardBg p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 hover:border-secondary transition">
                ${renderAdminButtons('certificates', i)}
                <div class="text-2xl text-secondary"><i class="fas fa-certificate"></i></div>
                <div>
                    <h4 class="font-bold text-sm dark:text-white">${t(cert.name)}</h4>
                    <p class="text-xs text-gray-500 mt-1">${t(cert.issuer)} | ${t(cert.date)}</p>
                </div>
            </div>
        `).join('');
    }
}

function renderAdminButtons(type, index) {
    if (!isAdmin) return '';
    return `<div class="admin-element absolute top-2 left-2 ltr:right-2 ltr:left-auto z-20 gap-2 opacity-0 group-hover:opacity-100 transition">
        <button onclick="editItem('${type}', ${index})" class="bg-blue-500 text-white w-7 h-7 rounded shadow flex items-center justify-center hover:scale-110 transition"><i class="fas fa-pen text-[10px]"></i></button>
        <button onclick="deleteItem('${type}', ${index})" class="bg-red-500 text-white w-7 h-7 rounded shadow flex items-center justify-center hover:scale-110 transition"><i class="fas fa-trash text-[10px]"></i></button>
    </div>`;
}

// --- 4. Advanced Admin System ---
async function manageItem(type, index = null) {
    if(!isAdmin) return;
    const isEdit = index !== null;
    const item = isEdit ? appData[type][index] : {};
    
    // Define fields structure
    const schemas = {
        skills: [{key:'ar', label:'Arabic Name'}, {key:'en', label:'English Name'}],
        experience: [{key:'role', label:'Role'}, {key:'company', label:'Company'}, {key:'period', label:'Date'}, {key:'description', label:'Description', type:'textarea'}],
        projects: [{key:'title', label:'Title'}, {key:'desc', label:'Description', type:'textarea'}, {key:'link', label:'Link', simple:true}],
        certificates: [{key:'name', label:'Name'}, {key:'issuer', label:'Issuer'}, {key:'date', label:'Date', simple:true}]
    };

    const schema = schemas[type];
    if(!schema) return;

    // Build Form HTML
    let html = schema.map(f => {
        if(f.simple) {
            return `<input id="swal-${f.key}" class="swal2-input" placeholder="${f.label}" value="${isEdit ? (item[f.key]||'') : ''}">`;
        }
        const valAr = isEdit && item[f.key] ? item[f.key].ar : '';
        const valEn = isEdit && item[f.key] ? item[f.key].en : '';
        if(f.type === 'textarea') {
            return `<textarea id="swal-${f.key}-ar" class="swal2-textarea" placeholder="${f.label} (AR)">${valAr}</textarea>
                    <textarea id="swal-${f.key}-en" class="swal2-textarea" placeholder="${f.label} (EN)">${valEn}</textarea>`;
        }
        return `<input id="swal-${f.key}-ar" class="swal2-input" placeholder="${f.label} (AR)" value="${valAr}">
                <input id="swal-${f.key}-en" class="swal2-input" placeholder="${f.label} (EN)" value="${valEn}">`;
    }).join('');

    const { value } = await Swal.fire({ 
        title: isEdit ? 'تعديل' : 'إضافة', 
        html: html, 
        confirmButtonText: 'Save',
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
        if(type === 'skills') { // Flatten skill object for simpler array
             if(isEdit) appData.skills[index] = value; else appData.skills.push(value);
        } else {
             if(isEdit) appData[type][index] = value; else appData[type].push(value);
        }
        renderAll();
    }
}

// Wrapper functions for clearer buttons
async function addItem(type) { await manageItem(type); }
async function editItem(type, index) { await manageItem(type, index); }

function deleteItem(type, index) {
    Swal.fire({ title: 'Delete?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then((r) => { 
        if(r.isConfirmed){ appData[type].splice(index,1); renderAll(); }
    });
}

// --- 5. Features (Palette, Analytics, etc) ---
function setupCmdPalette() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openCmdPalette(); }
        if (e.key === 'Escape') document.getElementById('cmd-palette').classList.add('hidden');
    });
}
function openCmdPalette() {
    const p = document.getElementById('cmd-palette'); p.classList.remove('hidden'); document.getElementById('cmd-input').focus();
    const items = [
        { icon: 'fa-home', text: 'Home', action: () => showPage('home') },
        { icon: 'fa-language', text: 'Switch Language', action: toggleLanguage },
        { icon: 'fa-moon', text: 'Toggle Theme', action: () => document.getElementById('theme-btn').click() },
        { icon: 'fa-key', text: 'Admin Login', action: () => document.getElementById('secret-trigger').click() }
    ];
    document.getElementById('cmd-list').innerHTML = items.map(i => `<div class="p-3 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex gap-3 items-center rounded" onclick="this.parentElement.parentElement.parentElement.classList.add('hidden'); (${i.action})()"><i class="fas ${i.icon}"></i> ${i.text}</div>`).join('');
}

function setupKonamiCode() {
    const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let idx = 0;
    document.addEventListener('keydown', (e) => {
        if (e.key === code[idx]) { idx++; if (idx === code.length) { showToast("Party Mode! 🚀", "success"); initParticles(true); idx = 0; } } else idx = 0;
    });
}

function logVisit() {
    let v = localStorage.getItem('visit_count') || 0; v++; localStorage.setItem('visit_count', v);
    if(document.getElementById('visit-count')) document.getElementById('visit-count').innerText = v;
}
function showAnalytics() { document.getElementById('analytics-modal').classList.remove('hidden'); }

// --- 6. Auth & Save ---
function checkSession() {
    const t = localStorage.getItem('login_time');
    if (t && (Date.now() - t > SESSION_DURATION)) logout();
    else if(localStorage.getItem('saved_token')) { githubInfo.repo=localStorage.getItem('saved_repo'); githubInfo.token=localStorage.getItem('saved_token'); enableAdminMode(); }
}
function authenticateAndEdit() {
    const r = document.getElementById('repo-input').value.trim();
    const t = document.getElementById('token-input').value.trim();
    if(!r || !t) return;
    localStorage.setItem('saved_repo', r); localStorage.setItem('saved_token', t); localStorage.setItem('login_time', Date.now());
    githubInfo.repo=r; githubInfo.token=t;
    document.getElementById('admin-modal').classList.add('hidden'); enableAdminMode();
}
function enableAdminMode() { isAdmin=true; document.body.classList.add('admin-mode'); document.getElementById('admin-toolbar').classList.remove('hidden'); renderAll(); }
function logout() { localStorage.clear(); location.reload(); }

async function saveToGitHub() {
    const btn = document.querySelector('#admin-toolbar button');
    const old = btn.innerHTML; btn.innerHTML = '...';
    localStorage.setItem('backup_data', JSON.stringify(appData));
    try {
        const url = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const get = await fetch(url, { headers: {'Authorization': `token ${githubInfo.token}`} });
        const file = await get.json();
        await fetch(url, { method: 'PUT', headers: {'Authorization': `token ${githubInfo.token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ message: "Update", content: btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2)))), sha: file.sha }) });
        showToast('Saved!', 'success');
    } catch(e) { showToast('Error', 'error'); } finally { btn.innerHTML = old; }
}
function restoreBackup() { const d = localStorage.getItem('backup_data'); if(d){ appData=JSON.parse(d); renderAll(); showToast('Restored', 'success'); } }

// --- Helpers ---
function updateText(key, value) { const el = document.querySelector(`[data-path="${key}"]`); if(el) { el.innerText = value; if(isAdmin) { el.contentEditable="true"; el.classList.add('editable-active'); el.onblur=()=>setDeepValue(appData, key, el.innerText); } } }
function setDeepValue(obj, path, value) { const keys = path.split('.'); let current = obj; for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]]; current[keys[keys.length - 1]][currentLang] = value; }
async function editImage(key) { if(!isAdmin) return; const {value} = await Swal.fire({input:'url', title:'Image URL'}); if(value) { let obj=appData; const p=key.split('.'); for(let i=0; i<p.length-1; i++) obj=obj[p[i]]; obj[p[p.length-1]] = value; renderAll(); }}
async function triggerImageUpload(key) { editImage(key); }
function showPage(pageId) { document.querySelectorAll('.page-section').forEach(s => {s.classList.remove('active'); s.style.display='none'}); const t=document.getElementById(pageId); t.style.display='block'; setTimeout(()=>t.classList.add('active'),10); window.scrollTo({top:0, behavior:'smooth'}); }
function typeWriter(t,id) { const e=document.getElementById(id); if(e){ e.innerHTML=""; let i=0; const int=setInterval(()=>{e.innerHTML+=t.charAt(i);i++; if(i>=t.length) clearInterval(int)},100); }}
function initTheme() { const b=document.getElementById('theme-btn'); if(localStorage.theme==='dark'||(!('theme' in localStorage)&&window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); b.addEventListener('click', ()=>{ document.documentElement.classList.toggle('dark'); localStorage.theme=document.documentElement.classList.contains('dark')?'dark':'light'; initParticles(); }); }
function initParticles(party=false) { const isDark = document.documentElement.classList.contains('dark'); particlesJS("particles-js", { particles: { number: { value: party?100:40 }, color: { value: party?["#f00","#0f0","#00f"]:(isDark ? "#ffffff" : "#3b82f6") }, opacity: { value: 0.3 }, size: { value: 3 }, line_linked: { enable: true, color: isDark ? "#ffffff" : "#3b82f6", opacity: 0.1 }, move: { enable: true, speed: party?10:1 } } }); }
function showToast(m,t) { Toastify({text:m, duration:3000, style:{background:t==='success'?'#10B981':'#EF4444'}}).showToast(); }
function setupSecretTrigger() { document.getElementById('secret-trigger').addEventListener('click', ()=>{ clickCount++; if(clickCount===3){ document.getElementById('admin-modal').classList.remove('hidden'); clickCount=0; } }); }
