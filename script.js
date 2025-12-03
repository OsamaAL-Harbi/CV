// --- Global Variables ---
let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };
let currentLang = localStorage.getItem('lang') || 'ar';
let isAdmin = false;
let clickCount = 0;
const SESSION_DURATION = 60 * 60 * 1000; // 1 Hour

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
});

// --- 1. Bilingual System (AR/EN) ---
function t(data) {
    if (typeof data === 'object' && data !== null && (data.ar || data.en)) {
        return data[currentLang] || data.ar;
    }
    return data; // Return as is if not translated
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
    const translations = {
        ar: { nav_home: "الرئيسية", nav_resume: "السيرة الذاتية", nav_portfolio: "الأعمال", nav_contact: "تواصل", sec_exp: "الخبرات", sec_skills: "المهارات", sec_certs: "الشهادات", btn_send: "إرسال", admin_save: "حفظ", admin_restore: "استعادة" },
        en: { nav_home: "Home", nav_resume: "Resume", nav_portfolio: "Portfolio", nav_contact: "Contact", sec_exp: "Experience", sec_skills: "Skills", sec_certs: "Certificates", btn_send: "Send", admin_save: "Save", admin_restore: "Restore" }
    };
    
    document.querySelectorAll('[data-lang]').forEach(el => {
        const key = el.getAttribute('data-lang');
        if(translations[currentLang][key]) el.innerText = translations[currentLang][key];
    });
}

// --- 2. Data & Rendering ---
async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if(!res.ok) throw new Error("Failed to load");
        appData = await res.json();
        renderAll();
        updateStaticText();
    } catch (err) {
        showToast("Error loading data", "error");
    }
}

function renderAll() {
    const p = appData.profile;
    
    // Profile
    updateText('profile.name', t(p.name));
    updateText('profile.summary', t(p.summary));
    document.getElementById('profile-img').src = p.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(t(p.name))}&background=0D8ABC&color=fff`;
    typeWriter(t(p.title), 'typewriter');

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
            <p class="text-gray-600 dark:text-gray-400 text-sm">${t(exp.description)}</p>
        </div>
    `).join('');

    // Skills
    document.getElementById('skills-container').innerHTML = appData.skills.map((s, i) => `
        <div class="relative group inline-block">
            <span class="px-3 py-1 bg-white dark:bg-cardBg border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold dark:text-gray-300">${t(s)}</span>
            ${isAdmin ? `<button onclick="deleteItem('skills', ${i})" class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center">×</button>` : ''}
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
}

function renderAdminButtons(type, index) {
    if (!isAdmin) return '';
    return `<div class="admin-element absolute top-2 left-2 ltr:right-2 ltr:left-auto z-20 gap-2 opacity-0 group-hover:opacity-100 transition">
        <button onclick="editItem('${type}', ${index})" class="bg-blue-500 text-white w-8 h-8 rounded-full shadow flex items-center justify-center"><i class="fas fa-pen text-xs"></i></button>
        <button onclick="deleteItem('${type}', ${index})" class="bg-red-500 text-white w-8 h-8 rounded-full shadow flex items-center justify-center"><i class="fas fa-trash text-xs"></i></button>
    </div>`;
}

// --- 3. Secure Session & Auth ---
function checkSession() {
    const loginTime = localStorage.getItem('login_time');
    if (localStorage.getItem('saved_token')) {
        if (loginTime && (Date.now() - loginTime > SESSION_DURATION)) {
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
    const repo = document.getElementById('repo-input').value.trim();
    const token = document.getElementById('token-input').value.trim();
    if(!repo || !token) return showToast('Invalid data', 'error');
    
    localStorage.setItem('saved_repo', repo);
    localStorage.setItem('saved_token', token);
    localStorage.setItem('login_time', Date.now());
    
    githubInfo.repo = repo; githubInfo.token = token;
    document.getElementById('admin-modal').classList.add('hidden');
    enableAdminMode();
    showToast('Admin Mode Active 🚀', 'success');
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

// --- 4. Backup & Save ---
async function saveToGitHub() {
    const btn = document.querySelector('#admin-toolbar button');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    
    // Auto-Backup before save
    localStorage.setItem('backup_data', JSON.stringify(appData));

    try {
        const fileUrl = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(fileUrl, { headers: { 'Authorization': `token ${githubInfo.token}` } });
        const fileData = await getRes.json();
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2))));
        
        await fetch(fileUrl, {
            method: 'PUT',
            headers: { 'Authorization': `token ${githubInfo.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Update from Website", content: content, sha: fileData.sha })
        });
        showToast('Saved Successfully! 🎉', 'success');
    } catch(e) {
        showToast('Error saving: ' + e.message, 'error');
    } finally {
        btn.innerHTML = oldHtml;
    }
}

function restoreBackup() {
    const backup = localStorage.getItem('backup_data');
    if(backup) {
        appData = JSON.parse(backup);
        renderAll();
        showToast('Backup Restored! (Click Save to apply)', 'success');
    } else {
        showToast('No backup found', 'error');
    }
}

// --- 5. Image Upload (Imgur) ---
function triggerImageUpload(key) {
    const input = document.getElementById('image-upload-input');
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Placeholder for Imgur Upload (Requires Client ID)
        // For now, we simulate success or ask for URL
        const { value: url } = await Swal.fire({ 
            title: 'Enter Image URL', 
            input: 'text', 
            inputLabel: 'Or paste direct link (Imgur/Drive)',
            inputValue: 'https://' 
        });
        
        if (url) {
            setDeepValue(appData, key, url);
            renderAll();
        }
    };
    input.click();
}

// --- 6. Editing Logic ---
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
                // Handle bilingual text update
                let obj = appData;
                for(let i=0; i<pathParts.length-1; i++) obj = obj[pathParts[i]];
                
                if(typeof obj[pathParts[pathParts.length-1]] === 'object') {
                    obj[pathParts[pathParts.length-1]][currentLang] = val;
                } else {
                    obj[pathParts[pathParts.length-1]] = val;
                }
            };
        }
    }
}

async function addItem(type) {
    if(!isAdmin) return;
    // Simple add logic for now, extends with SweetAlert form
    let newItem = type === 'skills' ? { ar: "جديد", en: "New" } : {}; 
    
    if (type === 'experience' || type === 'projects') {
        const { value } = await Swal.fire({
            title: `Add ${type}`,
            html: '<input id="swal-en" class="swal2-input" placeholder="Title (EN)"><input id="swal-ar" class="swal2-input" placeholder="Title (AR)">',
            preConfirm: () => ({ 
                role: { en: document.getElementById('swal-en').value, ar: document.getElementById('swal-ar').value },
                title: { en: document.getElementById('swal-en').value, ar: document.getElementById('swal-ar').value },
                company: { en: "Company", ar: "الشركة" }, 
                period: { en: "2024", ar: "2024" },
                desc: { en: "Description...", ar: "وصف..." }
            })
        });
        if(value) newItem = value;
        else return;
    }
    
    if(Array.isArray(appData[type])) appData[type].push(newItem);
    renderAll();
}

function deleteItem(type, index) {
    Swal.fire({
        title: 'Delete?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33'
    }).then((result) => {
        if (result.isConfirmed) {
            appData[type].splice(index, 1);
            renderAll();
        }
    });
}

async function editItem(type, index) {
    // Advanced Edit logic would go here (opening modal with current values)
    // For simplicity, we just trigger a toast
    showToast("Feature coming in V3: Edit Objects directly", "info");
}

// --- Helpers ---
function setupSecretTrigger() {
    document.getElementById('secret-trigger').addEventListener('click', () => {
        clickCount++;
        if(clickCount === 3) { document.getElementById('admin-modal').classList.remove('hidden'); clickCount = 0; }
    });
}
function setDeepValue(obj, path, value) { const keys = path.split('.'); let current = obj; for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]]; current[keys[keys.length - 1]] = value; }
function showPage(pageId) { document.querySelectorAll('.page-section').forEach(s => {s.classList.remove('active'); s.style.display='none'}); const t=document.getElementById(pageId); t.style.display='block'; setTimeout(()=>t.classList.add('active'),10); window.scrollTo({top:0, behavior:'smooth'}); }
function typeWriter(text, elementId) { const elm = document.getElementById(elementId); if(elm) { elm.innerHTML = ""; let i = 0; const interval = setInterval(() => { elm.innerHTML += text.charAt(i); i++; if (i >= text.length) clearInterval(interval); }, 100); }}
function initTheme() { const btn = document.getElementById('theme-btn'); if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark'); btn.addEventListener('click', () => { document.documentElement.classList.toggle('dark'); localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light'; initParticles(); }); }
function initParticles() { const isDark = document.documentElement.classList.contains('dark'); particlesJS("particles-js", { particles: { number: { value: 30 }, color: { value: isDark ? "#ffffff" : "#3b82f6" }, shape: { type: "circle" }, opacity: { value: 0.3 }, size: { value: 3 }, line_linked: { enable: true, distance: 150, color: isDark ? "#ffffff" : "#3b82f6", opacity: 0.1, width: 1 }, move: { enable: true, speed: 1 } }, interactivity: { detect_on: "canvas", events: { onhover: { enable: true, mode: "grab" } } }, retina_detect: true }); }
function showToast(msg, type) { Toastify({ text: msg, duration: 3000, style: { background: type === 'success' ? '#10B981' : '#EF4444' } }).showToast(); }
function handleContact(e) { e.preventDefault(); showToast("Message Sent (Simulated)!", "success"); e.target.reset(); }
