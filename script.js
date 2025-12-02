let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };
let clickCount = 0; // لعداد النقرات السرية

document.addEventListener('DOMContentLoaded', () => {
    AOS.init({ duration: 800, once: true });
    document.getElementById('year').textContent = new Date().getFullYear();
    loadContent();
    initTheme();
    setupSecretTrigger(); // تفعيل الزر السري

    // استعادة البيانات إن وجدت
    if(localStorage.getItem('saved_repo')) document.getElementById('repo-input').value = localStorage.getItem('saved_repo');
    if(localStorage.getItem('saved_token')) document.getElementById('token-input').value = localStorage.getItem('saved_token');
});

async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if(!res.ok) throw new Error("Data file not found");
        appData = await res.json();
        renderAll();
        // إخفاء التحميل
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('opacity-0');
            setTimeout(() => { document.getElementById('loading-screen').classList.add('hidden'); }, 500);
        }, 500);
    } catch (err) {
        showToast("خطأ في تحميل البيانات! تأكد من ملف JSON", "error");
    }
}

function renderAll() {
    const p = appData.profile;
    
    // Profile
    document.querySelector('[data-path="profile.name"]').innerText = p.name;
    document.querySelector('[data-path="profile.summary"]').innerText = p.summary;
    document.querySelector('[data-path="profile.location"]').innerText = p.location || "السعودية";
    document.getElementById('profile-img').src = p.image;
    document.getElementById('github-link').href = p.github;
    document.getElementById('email-contact').href = `mailto:${p.email}`;
    document.getElementById('contact-email-text').innerText = p.email;
    document.getElementById('footer-linkedin').href = p.linkedin;
    document.getElementById('footer-github').href = p.github;

    // Typewriter
    typeWriter(p.title, 'typewriter');

    // Skills
    document.getElementById('skills-container').innerHTML = appData.skills.map((s, i) => `
        <div class="px-4 py-2 bg-white dark:bg-darkCard rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm hover:border-primary hover:text-primary transition cursor-default" data-aos="fade-up" data-aos-delay="${i * 30}">
            <span class="font-bold text-sm" data-path="skills[${i}]">${s}</span>
        </div>
    `).join('');

    // Experience (Timeline)
    document.getElementById('experience-container').innerHTML = appData.experience.map((exp, i) => `
        <div class="relative pl-8 md:pl-0 md:pl-8 py-2" data-aos="fade-up">
            <div class="absolute -right-[9px] top-6 w-4 h-4 rounded-full bg-primary border-4 border-white dark:border-darkBg z-10"></div>
            <div class="glass p-6 rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100 dark:border-gray-700">
                <div class="flex flex-col md:flex-row justify-between items-start mb-2">
                    <h3 class="text-lg font-bold text-gray-800 dark:text-white" data-path="experience[${i}].role">${exp.role}</h3>
                    <span class="text-xs bg-primary/10 text-primary px-3 py-1 rounded-full font-bold" data-path="experience[${i}].period">${exp.period}</span>
                </div>
                <p class="text-sm text-primary font-medium mb-2" data-path="experience[${i}].company">${exp.company}</p>
                <p class="text-gray-600 dark:text-gray-300 text-sm leading-relaxed" data-path="experience[${i}].description">${exp.description}</p>
            </div>
        </div>
    `).join('');

    // Projects
    document.getElementById('projects-container').innerHTML = appData.projects.map((proj, i) => `
        <div class="glass rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition duration-300 flex flex-col h-full border border-gray-100 dark:border-gray-700" data-aos="fade-up" data-aos-delay="${i * 100}">
            <div class="h-40 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center">
                <i class="fas fa-code text-4xl text-gray-400"></i>
            </div>
            <div class="p-6 flex-grow flex flex-col">
                <h3 class="text-lg font-bold mb-2 text-gray-800 dark:text-white" data-path="projects[${i}].title">${proj.title}</h3>
                <p class="text-gray-600 dark:text-gray-400 text-sm mb-4 flex-grow line-clamp-3" data-path="projects[${i}].desc">${proj.desc}</p>
                <a href="${proj.link}" target="_blank" class="text-primary text-sm font-bold hover:underline">عرض المشروع &rarr;</a>
            </div>
        </div>
    `).join('');

    // Certificates
    if(appData.certificates) {
        document.getElementById('certificates-container').innerHTML = appData.certificates.map((cert, i) => `
            <div class="glass p-4 rounded-xl flex items-center gap-4 border border-gray-100 dark:border-gray-700" data-aos="fade-up">
                <div class="text-2xl text-yellow-500"><i class="fas fa-medal"></i></div>
                <div>
                    <h4 class="font-bold text-sm text-gray-800 dark:text-white" data-path="certificates[${i}].name">${cert.name}</h4>
                    <p class="text-xs text-gray-500 mt-1"><span data-path="certificates[${i}].issuer">${cert.issuer}</span> | <span data-path="certificates[${i}].date">${cert.date}</span></p>
                </div>
            </div>
        `).join('');
    }
}

// --- Ghost Admin Mode Logic ---
function setupSecretTrigger() {
    const trigger = document.getElementById('secret-trigger');
    trigger.addEventListener('click', () => {
        clickCount++;
        if(clickCount === 3) {
            document.getElementById('admin-modal').classList.remove('hidden');
            clickCount = 0; // Reset
        }
    });
}

function authenticateAndEdit() {
    const repo = document.getElementById('repo-input').value.trim();
    const token = document.getElementById('token-input').value.trim();
    if(!repo || !token) return showToast("الرجاء إدخال البيانات", "error");
    
    localStorage.setItem('saved_repo', repo);
    localStorage.setItem('saved_token', token);
    githubInfo.repo = repo; githubInfo.token = token;
    
    document.getElementById('admin-modal').classList.add('hidden');
    document.getElementById('save-btn').classList.remove('hidden');
    
    // Enable Editing
    document.querySelectorAll('[data-path]').forEach(el => {
        el.contentEditable = "true";
        el.classList.add('editable-active');
    });
    showToast("✅ تم تفعيل وضع التعديل! انقر على النصوص لتغييرها", "success");
}

async function saveToGitHub() {
    const btn = document.getElementById('save-btn');
    btn.innerHTML = 'جاري الحفظ...'; btn.disabled = true;

    try {
        // Collect Data
        document.querySelectorAll('[data-path]').forEach(el => {
            setNestedValue(appData, el.getAttribute('data-path'), el.innerText);
        });

        // GitHub API
        const fileUrl = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(fileUrl, { headers: { 'Authorization': `token ${githubInfo.token}` } });
        if(!getRes.ok) throw new Error('فشل الاتصال');
        const fileData = await getRes.json();
        
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2))));
        await fetch(fileUrl, {
            method: 'PUT',
            headers: { 'Authorization': `token ${githubInfo.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Update CV via Website", content: content, sha: fileData.sha })
        });

        showToast("🎉 تم الحفظ بنجاح! سيتم التحديث قريباً", "success");
        setTimeout(() => location.reload(), 2000);

    } catch (e) {
        showToast("خطأ: " + e.message, "error");
        btn.innerHTML = 'حفظ التعديلات'; btn.disabled = false;
    }
}

// --- Helper Functions ---
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

function setNestedValue(obj, path, value) {
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
    current[keys[keys.length - 1]] = value;
}

function initTheme() {
    const btn = document.getElementById('theme-btn');
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
    btn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    });
}

function showToast(msg, type) {
    Toastify({
        text: msg,
        duration: 3000,
        gravity: "top",
        position: "center",
        style: { background: type === "success" ? "#10B981" : "#EF4444" }
    }).showToast();
}
