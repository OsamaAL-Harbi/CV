// --- Global State ---
let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };
let currentLang = localStorage.getItem('lang') || 'ar';
let isAdmin = false;
let clickCount = 0;
const SESSION_DURATION = 60 * 60 * 1000;

// --- Initialization ---
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
    logVisit(); // Analytics Tracking
});

// --- 1. Features (Cmd+K, Konami, Analytics) ---
function setupCmdPalette() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            openCmdPalette();
        }
        if (e.key === 'Escape') document.getElementById('cmd-palette').classList.add('hidden');
    });
}

function openCmdPalette() {
    const p = document.getElementById('cmd-palette');
    p.classList.remove('hidden');
    document.getElementById('cmd-input').focus();
    renderCmdItems();
}

function renderCmdItems() {
    const items = [
        { icon: 'fa-home', text: 'الرئيسية', action: () => showPage('home') },
        { icon: 'fa-briefcase', text: 'السيرة الذاتية', action: () => showPage('resume') },
        { icon: 'fa-envelope', text: 'تواصل معي', action: () => showPage('contact') },
        { icon: 'fa-language', text: 'تغيير اللغة (EN/AR)', action: toggleLanguage },
        { icon: 'fa-moon', text: 'تبديل المظهر', action: () => document.getElementById('theme-btn').click() },
        { icon: 'fa-user-cog', text: 'دخول المالك', action: () => document.getElementById('secret-trigger').click() }
    ];
    
    document.getElementById('cmd-list').innerHTML = items.map(i => `
        <div class="cmd-item p-3 rounded-lg cursor-pointer flex items-center gap-3 transition" onclick="this.parentElement.parentElement.parentElement.classList.add('hidden'); (${i.action})()">
            <i class="fas ${i.icon} text-gray-400"></i>
            <span class="font-bold">${i.text}</span>
        </div>
    `).join('');
}

function setupKonamiCode() {
    const code = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
    let idx = 0;
    document.addEventListener('keydown', (e) => {
        if (e.key === code[idx]) {
            idx++;
            if (idx === code.length) {
                showToast("🚀 Party Mode Activated!", "success");
                initParticles(true); // Crazy particles
                idx = 0;
            }
        } else { idx = 0; }
    });
}

function logVisit() {
    let visits = localStorage.getItem('visit_count') || 0;
    visits++;
    localStorage.setItem('visit_count', visits);
    document.getElementById('visit-count').innerText = visits;
}

function showAnalytics() {
    document.getElementById('analytics-modal').classList.remove('hidden');
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

// --- 3. Core Logic ---
async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if(!res.ok) throw new Error("Failed");
        appData = await res.json();
        renderAll();
        updateStaticText();
    } catch (err) { showToast("Error loading data", "error"); }
}

function renderAll() {
    const p = appData.profile;
    updateText('profile.name', t(p.name));
    updateText('profile.summary', t(p.summary));
    
    const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(t(p.name))}&background=0D8ABC&color=fff&size=200`;
    document.getElementById('profile-img').src = p.image || fallback;
    
    typeWriter(t(p.title), 'typewriter');
    document.getElementById('email-contact').href = `mailto:${p.email}`;
    document.getElementById('social-linkedin').href = p.linkedin;
    document.getElementById('social-github').href = p.github;

    // Sections Rendering (Simplified for brevity, similar structure as before)
    renderSection('experience', appData.experience, (item) => `
        <h3 class="text-xl font-bold dark:text-white">${t(item.role)}</h3>
        <p class="text-primary text-sm">${t(item.company)}</p>
        <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs mb-3">${t(item.period)}</span>
        <p class="text-gray-500 text-sm">${t(item.description)}</p>
    `);
    
    renderSection('skills', appData.skills, (item) => `<span class="font-bold text-sm">${t(item)}</span>`, 'inline-block px-3 py-2 bg-white dark:bg-cardBg rounded border dark:border-gray-700');
    
    renderSection('certificates', appData.certificates, (item) => `
        <h4 class="font-bold text-sm dark:text-white">${t(item.name)}</h4>
        <p class="text-xs text-gray-500">${t(item.issuer)} | ${t(item.date)}</p>
    `, 'flex items-center gap-4 bg-white dark:bg-cardBg p-4 rounded shadow-sm');

    renderSection('projects', appData.projects, (item) => `
        <h3 class="text-lg font-bold mb-2">${t(item.title)}</h3>
        <p class="text-gray-500 text-sm mb-4">${t(item.desc)}</p>
        <a href="${item.link}" target="_blank" class="text-primary text-sm hover:underline">View Project</a>
    `, 'bg-white dark:bg-cardBg p-6 rounded-xl border dark:border-gray-700');
}

function renderSection(type, data, contentFn, wrapperClass = 'relative group mb-8') {
    document.getElementById(`${type}-container`).innerHTML = data.map((item, i) => `
        <div class="${wrapperClass}">
            ${renderAdminButtons(type, i)}
            ${contentFn(item)}
        </div>
    `).join('');
}

function renderAdminButtons(type, index) {
    if (!isAdmin) return '';
    return `<div class="admin-element absolute top-2 left-2 z-20 gap-2 opacity-0 group-hover:opacity-100 transition">
        <button onclick="editItem('${type}', ${index})" class="bg-blue-500 text-white w-7 h-7 rounded shadow flex items-center justify-center"><i class="fas fa-pen text-[10px]"></i></button>
        <button onclick="deleteItem('${type}', ${index})" class="bg-red-500 text-white w-7 h-7 rounded shadow flex items-center justify-center"><i class="fas fa-trash text-[10px]"></i></button>
    </div>`;
}

// --- 4. Smart Admin Inputs ---
function getInputType(key) {
    if(key.includes('date') || key.includes('period')) return 'text'; // Can use 'date' if strict
    if(key.includes('link') || key.includes('url')) return 'url';
    if(key.includes('desc') || key.includes('summary')) return 'textarea';
    return 'text';
}

async function addItem(type) {
    if(!isAdmin) return;
    
    // Config for fields based on type
    const fields = {
        skills: [{key:'ar', label:'Arabic Name'}, {key:'en', label:'English Name'}],
        experience: [{key:'role', label:'Role'}, {key:'company', label:'Company'}, {key:'period', label:'Date'}, {key:'description', label:'Description'}],
        projects: [{key:'title', label:'Title'}, {key:'desc', label:'Description'}, {key:'link', label:'Link'}],
        certificates: [{key:'name', label:'Name'}, {key:'issuer', label:'Issuer'}, {key:'date', label:'Date'}]
    };

    const config = fields[type];
    let html = config.map(f => {
        const inputType = getInputType(f.key);
        if(f.key === 'link' || f.key === 'date' || f.key === 'issuer') return `<input id="swal-${f.key}" class="swal2-input" placeholder="${f.label}" type="${inputType}">`;
        // Bilingual fields
        return `<input id="swal-${f.key}-ar" class="swal2-input" placeholder="${f.label} (AR)"><input id="swal-${f.key}-en" class="swal2-input" placeholder="${f.label} (EN)">`;
    }).join('');

    const { value } = await Swal.fire({ title: `Add ${type}`, html: html, preConfirm: () => {
        let obj = {};
        config.forEach(f => {
            if(f.key === 'link' || f.key === 'date' || f.key === 'issuer') obj[f.key] = document.getElementById(`swal-${f.key}`).value;
            else obj[f.key] = { ar: document.getElementById(`swal-${f.key}-ar`).value, en: document.getElementById(`swal-${f.key}-en`).value };
        });
        return obj;
    }});

    if(value) {
        if(type === 'skills') appData.skills.push(value); // Special case for flat bilingual object
        else appData[type].push(value);
        renderAll();
    }
}

async function editItem(type, index) {
    // Similar to addItem but pre-filled. Simplified here for brevity.
    const item = appData[type][index];
    // In a real scenario, you'd refill the HTML above with `value="${item.key.ar}"`
    showToast("Edit mode: Re-add item to update (Full edit in V3)", "info");
}

function deleteItem(type, index) {
    Swal.fire({ title: 'Delete?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33' }).then((r) => { if(r.isConfirmed){ appData[type].splice(index,1); renderAll(); }});
}

// --- 5. System (Auth, Backup, Save) ---
function checkSession() {
    const t = localStorage.getItem('login_time');
    if(t && (Date.now() - t > SESSION_DURATION)) logout();
    else if(localStorage.getItem('saved_token')) { githubInfo.repo=localStorage.getItem('saved_repo'); githubInfo.token=localStorage.getItem('saved_token'); enableAdminMode(); }
}
function authenticateAndEdit() {
    const r = document.getElementById('repo-input').value, t = document.getElementById('token-input').value;
    if(!r || !t) return;
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
        const file = await get.json();
        await fetch(url, { method: 'PUT', headers: {'Authorization': `token ${githubInfo.token}`, 'Content-Type': 'application/json'}, body: JSON.stringify({ message: "Update", content: btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2)))), sha: file.sha }) });
        showToast('Saved!', 'success');
    } catch(e) { showToast('Error', 'error'); } finally { btn.innerHTML = 'Save'; }
}
function restoreBackup() { const d = localStorage.getItem('backup_data'); if(d){ appData=JSON.parse(d); renderAll(); showToast('Restored', 'success'); } }

// --- Utilities ---
function updateText(key, value) { const el = document.querySelector(`[data-path="${key}"]`); if(el) { el.innerText = value; if(isAdmin) { el.contentEditable="true"; el.classList.add('editable-active'); el.onblur=()=>setDeepValue(appData, key, el.innerText); } } }
function setDeepValue(obj, path, value) { const keys = path.split('.'); let current = obj; for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]]; current[keys[keys.length - 1]][currentLang] = value; }
async function triggerImageUpload(key) { if(!isAdmin) return; const {value} = await Swal.fire({input:'url', title:'Image URL'}); if(value) { let obj=appData; const p=key.split('.'); for(let i=0; i<p.length-1; i++) obj=obj[p[i]]; obj[p[p.length-1]] = value; renderAll(); }}
function typeWriter(t,id) { const e=document.getElementById(id); if(e){ e.innerHTML=""; let i=0; setInterval(()=>{e.innerHTML+=t.charAt(i);i++; if(i>=t.length) clearInterval()},100); }}
function initTheme() { const b=document.getElementById('theme-btn'); if(localStorage.theme==='dark'||(!('theme' in localStorage)&&window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); b.addEventListener('click', ()=>{ document.documentElement.classList.toggle('dark'); localStorage.theme=document.documentElement.classList.contains('dark')?'dark':'light'; initParticles(); }); }
function initParticles(party=false) { particlesJS("particles-js", { particles: { number: { value: party?100:40 }, color: { value: party?["#f00","#0f0","#00f"]: (document.documentElement.classList.contains('dark')?"#fff":"#3b82f6") }, move: { speed: party?10:1 } } }); }
function showToast(m,t) { Toastify({text:m, duration:3000, style:{background:t==='success'?'#10B981':'#EF4444'}}).showToast(); }
function setupSecretTrigger() { document.getElementById('secret-trigger').addEventListener('click', ()=>{ clickCount++; if(clickCount===3){ document.getElementById('admin-modal').classList.remove('hidden'); clickCount=0; } }); }
