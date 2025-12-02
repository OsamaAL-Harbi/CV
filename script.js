let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };
let clickCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    AOS.init({ duration: 800, once: true });
    document.getElementById('year').textContent = new Date().getFullYear();
    
    loadContent();
    initTheme();
    initParticles();
    setupSecretTrigger();

    if(localStorage.getItem('saved_repo')) document.getElementById('repo-input').value = localStorage.getItem('saved_repo');
    if(localStorage.getItem('saved_token')) document.getElementById('token-input').value = localStorage.getItem('saved_token');
});

// --- Routing System (نظام التنقل) ---
function showPage(pageId) {
    // 1. Hide all pages
    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    
    // 2. Show selected page with animation
    const target = document.getElementById(pageId);
    target.style.display = 'block';
    setTimeout(() => target.classList.add('active'), 10);

    // 3. Update Navbar
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('nav-active'));
    const navBtn = document.getElementById(`nav-${pageId}`);
    if(navBtn) navBtn.classList.add('nav-active');

    // 4. Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- Data Loading ---
async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if(!res.ok) throw new Error("File not found");
        appData = await res.json();
        renderAll();
    } catch (err) {
        console.error(err);
        alert('خطأ في تحميل البيانات. تأكد من ملف data.json');
    }
}

function renderAll() {
    const p = appData.profile;
    
    // Home
    document.querySelector('[data-path="profile.name"]').innerText = p.name;
    document.querySelector('[data-path="profile.summary"]').innerText = p.summary;
    document.getElementById('profile-img').src = p.image;
    typeWriter(p.title, 'typewriter');

    // Contact Links
    document.getElementById('email-contact').href = `mailto:${p.email}`;
    document.getElementById('social-linkedin').href = p.linkedin;
    document.getElementById('social-github').href = p.github;

    // Experience (Resume Page)
    document.getElementById('experience-container').innerHTML = appData.experience.map((exp, i) => `
        <div class="relative group" data-aos="fade-up">
            <div class="absolute -right-[39px] top-1 w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-darkBg z-10 group-hover:scale-125 transition"></div>
            <div class="mb-1">
                <h3 class="text-xl font-bold text-gray-800 dark:text-white" data-path="experience[${i}].role">${exp.role}</h3>
                <p class="text-primary font-medium text-sm" data-path="experience[${i}].company">${exp.company}</p>
            </div>
            <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs font-bold mb-3" data-path="experience[${i}].period">${exp.period}</span>
            <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed" data-path="experience[${i}].description">${exp.description}</p>
        </div>
    `).join('');

    // Certificates
    if(appData.certificates) {
        document.getElementById('certificates-container').innerHTML = appData.certificates.map((cert, i) => `
            <div class="bg-white dark:bg-cardBg p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 hover:border-secondary transition" data-aos="fade-up">
                <div class="text-2xl text-secondary"><i class="fas fa-certificate"></i></div>
                <div>
                    <h4 class="font-bold text-sm text-gray-800 dark:text-white" data-path="certificates[${i}].name">${cert.name}</h4>
                    <p class="text-xs text-gray-500 mt-1"><span data-path="certificates[${i}].issuer">${cert.issuer}</span> | <span data-path="certificates[${i}].date">${cert.date}</span></p>
                </div>
            </div>
        `).join('');
    }

    // Skills
    document.getElementById('skills-container').innerHTML = appData.skills.map((s, i) => `
        <span class="px-3 py-1 bg-white dark:bg-cardBg border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300" data-path="skills[${i}]">${s}</span>
    `).join('');

    // Projects (Portfolio Page)
    document.getElementById('projects-container').innerHTML = appData.projects.map((proj, i) => `
        <div class="group bg-white dark:bg-cardBg rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition duration-300 border border-gray-100 dark:border-gray-700 flex flex-col h-full" data-aos="fade-up" data-aos-delay="${i * 100}">
            <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center relative overflow-hidden">
                <i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500"></i>
                <div class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 backdrop-blur-sm">
                    <a href="${proj.link}" target="_blank" class="px-6 py-2 bg-white text-gray-900 rounded-full font-bold transform translate-y-4 group-hover:translate-y-0 transition duration-300">عرض التفاصيل</a>
                </div>
            </div>
            <div class="p-6 flex-grow flex flex-col">
                <h3 class="text-lg font-bold mb-2 text-gray-800 dark:text-white" data-path="projects[${i}].title">${proj.title}</h3>
                <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-3 mb-4 flex-grow" data-path="projects[${i}].desc">${proj.desc}</p>
            </div>
        </div>
    `).join('');
}

// --- Utilities ---
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
        // تحديث لون الجزيئات
        initParticles(); 
    });
}

function initParticles() {
    const isDark = document.documentElement.classList.contains('dark');
    particlesJS("particles-js", {
        "particles": {
            "number": { "value": 80 },
            "color": { "value": isDark ? "#ffffff" : "#3b82f6" },
            "shape": { "type": "circle" },
            "opacity": { "value": 0.5 },
            "size": { "value": 3 },
            "line_linked": { "enable": true, "distance": 150, "color": isDark ? "#ffffff" : "#3b82f6", "opacity": 0.2, "width": 1 },
            "move": { "enable": true, "speed": 2 }
        },
        "interactivity": {
            "detect_on": "canvas",
            "events": { "onhover": { "enable": true, "mode": "grab" }, "onclick": { "enable": true, "mode": "push" } },
            "modes": { "grab": { "distance": 140, "line_linked": { "opacity": 1 } } }
        },
        "retina_detect": true
    });
}

// --- Admin Logic ---
function setupSecretTrigger() {
    const trigger = document.getElementById('secret-trigger');
    trigger.addEventListener('click', () => {
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
    if(!repo || !token) return alert("البيانات ناقصة");
    
    localStorage.setItem('saved_repo', repo);
    localStorage.setItem('saved_token', token);
    githubInfo.repo = repo; githubInfo.token = token;
    
    document.getElementById('admin-modal').classList.add('hidden');
    document.getElementById('save-btn').classList.remove('hidden');
    document.querySelectorAll('[data-path]').forEach(el => {
        el.contentEditable = "true";
        el.classList.add('editable-active');
    });
    alert("تم تفعيل وضع التعديل ✅");
}

async function saveToGitHub() {
    const btn = document.getElementById('save-btn');
    btn.innerHTML = 'جاري الحفظ...'; btn.disabled = true;

    try {
        document.querySelectorAll('[data-path]').forEach(el => {
            setNestedValue(appData, el.getAttribute('data-path'), el.innerText);
        });

        const fileUrl = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(fileUrl, { headers: { 'Authorization': `token ${githubInfo.token}` } });
        if(!getRes.ok) throw new Error('فشل الاتصال');
        const fileData = await getRes.json();
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2))));

        await fetch(fileUrl, {
            method: 'PUT',
            headers: { 'Authorization': `token ${githubInfo.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Update CV Content", content: content, sha: fileData.sha })
        });

        alert("تم الحفظ بنجاح! 🎉");
        location.reload();
    } catch (e) {
        alert("خطأ: " + e.message);
        btn.innerHTML = 'حفظ'; btn.disabled = false;
    }
}

function setNestedValue(obj, path, value) {
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
    current[keys[keys.length - 1]] = value;
}
