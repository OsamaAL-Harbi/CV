let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };
let clickCount = 0;
let isAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
    AOS.init();
    document.getElementById('year').textContent = new Date().getFullYear();
    
    // إعدادات الأساس
    loadContent();
    initTheme();
    initParticles();
    setupSecretTrigger();

    // استعادة الدخول
    if(localStorage.getItem('saved_repo')) {
        document.getElementById('repo-input').value = localStorage.getItem('saved_repo');
        document.getElementById('token-input').value = localStorage.getItem('saved_token');
        // إذا البيانات موجودة، لا نفعل الأدمن تلقائياً للأمان، لكن نسهل الدخول
    }
});

// --- Navigation (SPA Logic) ---
function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    const target = document.getElementById(pageId);
    target.style.display = 'block';
    setTimeout(() => target.classList.add('active'), 10);

    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('nav-active'));
    const navBtn = document.getElementById(`nav-${pageId}`);
    if(navBtn) navBtn.classList.add('nav-active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Data Loading & Rendering ---
async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if(!res.ok) throw new Error("File not found");
        appData = await res.json();
        renderAll();
    } catch (err) {
        showToast('خطأ في تحميل البيانات', 'error');
    }
}

function renderAll() {
    const p = appData.profile;
    
    // 1. Profile
    updateText('profile.name', p.name);
    updateText('profile.summary', p.summary);
    document.getElementById('profile-img').src = p.image;
    typeWriter(p.title, 'typewriter');

    // Contact
    document.getElementById('email-contact').href = `mailto:${p.email}`;
    document.getElementById('social-linkedin').href = p.linkedin;
    document.getElementById('social-github').href = p.github;

    // 2. Experience
    document.getElementById('experience-container').innerHTML = appData.experience.map((exp, i) => `
        <div class="relative group mb-8" data-aos="fade-up">
            ${isAdmin ? `<button onclick="deleteItem('experience', ${i})" class="delete-btn absolute top-0 left-0 text-red-500 bg-red-100 p-1 rounded z-20"><i class="fas fa-trash"></i></button>` : ''}
            <div class="absolute -right-[39px] top-1 w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-darkBg z-10 group-hover:scale-125 transition"></div>
            <div class="mb-1">
                <h3 class="text-xl font-bold text-gray-800 dark:text-white" onclick="${isAdmin ? `editArrayItem('experience', ${i}, 'role')` : ''}">${exp.role}</h3>
                <p class="text-primary font-medium text-sm">${exp.company}</p>
            </div>
            <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs font-bold mb-3">${exp.period}</span>
            <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${exp.description}</p>
        </div>
    `).join('');

    // 3. Skills
    document.getElementById('skills-container').innerHTML = appData.skills.map((s, i) => `
        <div class="relative group inline-block">
            <span class="px-3 py-1 bg-white dark:bg-cardBg border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300 cursor-default">${s}</span>
            ${isAdmin ? `<button onclick="deleteItem('skills', ${i})" class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center">×</button>` : ''}
        </div>
    `).join('');

    // 4. Certificates
    if(appData.certificates) {
        document.getElementById('certificates-container').innerHTML = appData.certificates.map((cert, i) => `
            <div class="relative group bg-white dark:bg-cardBg p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 hover:border-secondary transition">
                ${isAdmin ? `<button onclick="deleteItem('certificates', ${i})" class="delete-btn absolute top-2 left-2 text-red-500 opacity-0 group-hover:opacity-100"><i class="fas fa-trash"></i></button>` : ''}
                <div class="text-2xl text-secondary"><i class="fas fa-certificate"></i></div>
                <div>
                    <h4 class="font-bold text-sm text-gray-800 dark:text-white">${cert.name}</h4>
                    <p class="text-xs text-gray-500 mt-1">${cert.issuer} | ${cert.date}</p>
                </div>
            </div>
        `).join('');
    }

    // 5. Projects
    document.getElementById('projects-container').innerHTML = appData.projects.map((proj, i) => `
        <div class="relative group bg-white dark:bg-cardBg rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition border border-gray-100 dark:border-gray-700 flex flex-col h-full">
            ${isAdmin ? `<button onclick="deleteItem('projects', ${i})" class="absolute top-2 left-2 z-20 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition"><i class="fas fa-trash"></i></button>` : ''}
            <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center relative overflow-hidden">
                <i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500"></i>
                <div class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-sm">
                    <a href="${proj.link}" target="_blank" class="px-6 py-2 bg-white text-gray-900 rounded-full font-bold transform translate-y-4 group-hover:translate-y-0 transition">عرض</a>
                </div>
            </div>
            <div class="p-6 flex-grow">
                <h3 class="text-lg font-bold mb-2">${proj.title}</h3>
                <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-3">${proj.desc}</p>
            </div>
        </div>
    `).join('');

    // 6. Custom Section
    if(appData.customSection && appData.customSection.items) {
        document.getElementById('custom-section-wrapper').classList.remove('hidden');
        updateText('customSection.title', appData.customSection.title);
        updateText('customSection.subtitle', appData.customSection.subtitle);
        
        document.getElementById('custom-container').innerHTML = appData.customSection.items.map((item, i) => `
            <div class="relative group bg-gray-50 dark:bg-cardBg p-4 rounded-lg">
                ${isAdmin ? `<button onclick="deleteItem('customSection.items', ${i})" class="absolute top-2 left-2 text-red-500 opacity-0 group-hover:opacity-100">×</button>` : ''}
                <h4 class="font-bold text-sm">${item.title}</h4>
                <p class="text-xs text-gray-500">${item.desc}</p>
            </div>
        `).join('');
    }
}

// --- CRUD & Editing Logic ---
function updateText(key, value) {
    const el = document.querySelector(`[data-path="${key}"]`);
    if(el) {
        el.innerText = value;
        if(isAdmin) {
            el.contentEditable = "true";
            el.classList.add('editable-active');
            // Save on blur
            el.onblur = () => setDeepValue(appData, key, el.innerText);
        }
    }
}

async function addItem(type) {
    if(!isAdmin) return;
    
    let newItem = null;
    
    if(type === 'skills') {
        const { value } = await Swal.fire({ input: 'text', title: 'مهارة جديدة' });
        if(value) appData.skills.push(value);
    } 
    else if(type === 'experience') {
        const { value } = await Swal.fire({
            title: 'إضافة خبرة',
            html: '<input id="swal-role" class="swal2-input" placeholder="المسمى"><input id="swal-co" class="swal2-input" placeholder="الشركة"><input id="swal-date" class="swal2-input" placeholder="التاريخ"><textarea id="swal-desc" class="swal2-textarea" placeholder="الوصف"></textarea>',
            preConfirm: () => ({ role: document.getElementById('swal-role').value, company: document.getElementById('swal-co').value, period: document.getElementById('swal-date').value, description: document.getElementById('swal-desc').value })
        });
        if(value) appData.experience.push(value);
    }
    else if(type === 'projects') {
        const { value } = await Swal.fire({
            title: 'إضافة مشروع',
            html: '<input id="swal-title" class="swal2-input" placeholder="العنوان"><input id="swal-link" class="swal2-input" placeholder="الرابط"><textarea id="swal-desc" class="swal2-textarea" placeholder="الوصف"></textarea>',
            preConfirm: () => ({ title: document.getElementById('swal-title').value, link: document.getElementById('swal-link').value, desc: document.getElementById('swal-desc').value })
        });
        if(value) appData.projects.push(value);
    }
    else if(type === 'certificates') {
         const { value } = await Swal.fire({
            title: 'إضافة شهادة',
            html: '<input id="swal-name" class="swal2-input" placeholder="الاسم"><input id="swal-iss" class="swal2-input" placeholder="الجهة"><input id="swal-date" class="swal2-input" placeholder="التاريخ">',
            preConfirm: () => ({ name: document.getElementById('swal-name').value, issuer: document.getElementById('swal-iss').value, date: document.getElementById('swal-date').value })
        });
        if(value) appData.certificates.push(value);
    }
    else if(type === 'customSection.items') {
         const { value } = await Swal.fire({
            title: 'عنصر جديد',
            html: '<input id="swal-t" class="swal2-input" placeholder="العنوان"><input id="swal-d" class="swal2-input" placeholder="الوصف">',
            preConfirm: () => ({ title: document.getElementById('swal-t').value, desc: document.getElementById('swal-d').value })
        });
        if(value) {
            if(!appData.customSection) appData.customSection = { title: "إضافات", items: [] };
            appData.customSection.items.push(value);
        }
    }
    
    renderAll();
}

function deleteItem(type, index) {
    if(!isAdmin) return;
    Swal.fire({
        title: 'حذف العنصر؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'نعم'
    }).then((result) => {
        if (result.isConfirmed) {
            const arr = getDeepValue(appData, type);
            if(Array.isArray(arr)) {
                arr.splice(index, 1);
                renderAll();
            }
        }
    });
}

async function editImage(key) {
    if(!isAdmin) return;
    const { value } = await Swal.fire({ input: 'url', title: 'رابط الصورة الجديد' });
    if(value) {
        setDeepValue(appData, key, value);
        renderAll();
    }
}

// --- Admin Auth ---
function setupSecretTrigger() {
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
    if(!repo || !token) return showToast('البيانات ناقصة', 'error');
    
    localStorage.setItem('saved_repo', repo);
    localStorage.setItem('saved_token', token);
    githubInfo.repo = repo; githubInfo.token = token;
    
    document.getElementById('admin-modal').classList.add('hidden');
    document.getElementById('save-btn').classList.remove('hidden');
    document.body.classList.add('admin-mode');
    isAdmin = true;
    
    renderAll(); // Re-render to show admin buttons
    showToast('تم تفعيل وضع التعديل', 'success');
}

async function saveToGitHub() {
    const btn = document.getElementById('save-btn');
    btn.innerHTML = 'جاري الرفع...'; btn.disabled = true;

    try {
        const fileUrl = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(fileUrl, { headers: { 'Authorization': `token ${githubInfo.token}` } });
        const fileData = await getRes.json();
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2))));
        
        await fetch(fileUrl, {
            method: 'PUT',
            headers: { 'Authorization': `token ${githubInfo.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Update via Web Admin", content: content, sha: fileData.sha })
        });
        
        showToast('تم الحفظ في GitHub بنجاح! 🎉', 'success');
        setTimeout(() => location.reload(), 2000);
    } catch(e) {
        showToast('خطأ: ' + e.message, 'error');
        btn.innerHTML = 'حفظ التعديلات'; btn.disabled = false;
    }
}

// --- Helpers ---
function typeWriter(text, elementId) {
    const elm = document.getElementById(elementId);
    elm.innerHTML = "";
    let i = 0;
    const interval = setInterval(() => {
        elm.innerHTML += text.charAt(i);
        i++;
        if (i >= text.length) clearInterval(interval);
    }, 100);
}
function initTheme() {
    const btn = document.getElementById('theme-btn');
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
    btn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
        initParticles();
    });
}
function initParticles() {
    const isDark = document.documentElement.classList.contains('dark');
    particlesJS("particles-js", {
        "particles": { "number": { "value": 80 }, "color": { "value": isDark ? "#ffffff" : "#3b82f6" }, "shape": { "type": "circle" }, "opacity": { "value": 0.5 }, "size": { "value": 3 }, "line_linked": { "enable": true, "distance": 150, "color": isDark ? "#ffffff" : "#3b82f6", "opacity": 0.2, "width": 1 }, "move": { "enable": true, "speed": 2 } },
        "interactivity": { "detect_on": "canvas", "events": { "onhover": { "enable": true, "mode": "grab" } } }, "retina_detect": true
    });
}
function getDeepValue(obj, path) { return path.split('.').reduce((acc, part) => acc && acc[part], obj); }
function setDeepValue(obj, path, value) { const keys = path.split('.'); let current = obj; for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]]; current[keys[keys.length - 1]] = value; }
function showToast(msg, type) { Toastify({ text: msg, duration: 3000, style: { background: type === 'success' ? '#10B981' : '#EF4444' } }).showToast(); }
