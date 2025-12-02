let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };

document.addEventListener('DOMContentLoaded', () => {
    // تفعيل المكتبات
    AOS.init({ duration: 800, once: true, offset: 100 });
    document.getElementById('year').textContent = new Date().getFullYear();
    
    // تحميل البيانات
    loadContent();
    initTheme();
    setupScrollSpy();

    // استعادة بيانات الدخول
    if(localStorage.getItem('saved_repo')) document.getElementById('repo-input').value = localStorage.getItem('saved_repo');
    if(localStorage.getItem('saved_token')) document.getElementById('token-input').value = localStorage.getItem('saved_token');
});

// --- Core Data Loading ---
async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if(!res.ok) throw new Error("Data file not found");
        appData = await res.json();
        renderAll();
        
        // إخفاء شاشة التحميل
        setTimeout(() => {
            document.getElementById('loading-screen').classList.add('opacity-0');
            setTimeout(() => {
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('main-content').classList.remove('opacity-0');
            }, 500);
        }, 800);

    } catch (err) {
        console.error(err);
        document.getElementById('loading-screen').innerHTML = `<div class="text-red-500 text-center p-4">حدث خطأ في تحميل البيانات.<br>تأكد من ملف data.json</div>`;
    }
}

// --- Rendering Functions ---
function renderAll() {
    const p = appData.profile;
    
    // Header & Profile
    document.querySelector('[data-path="profile.name"]').innerText = p.name;
    document.getElementById('nav-name').innerText = p.name.split(' ')[0] || 'Me'; // الاسم الأول في الناف بار
    document.querySelector('[data-path="profile.summary"]').innerText = p.summary;
    document.getElementById('profile-img').src = p.image;
    document.getElementById('github-link').href = p.github;
    
    // Contact Info
    document.getElementById('email-contact').href = `mailto:${p.email}`;
    document.getElementById('contact-email-text').innerText = p.email;
    document.getElementById('footer-linkedin').href = p.linkedin;
    document.getElementById('footer-github').href = p.github;

    // Typewriter Effect
    typeWriter(p.title, 'typewriter');

    // Skills
    const skillsContainer = document.getElementById('skills-container');
    skillsContainer.innerHTML = appData.skills.map((s, i) => `
        <div class="px-5 py-3 bg-white dark:bg-darkCard rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary hover:text-primary transition-all duration-300 transform hover:-translate-y-1 cursor-default" data-aos="zoom-in" data-aos-delay="${i * 50}">
            <span class="font-bold text-gray-700 dark:text-gray-200" data-path="skills[${i}]">${s}</span>
        </div>
    `).join('');

    // Experience
    const expContainer = document.getElementById('experience-container');
    expContainer.innerHTML = appData.experience.map((exp, i) => `
        <div class="relative pl-8 md:pl-0" data-aos="fade-up">
            <div class="hidden md:block absolute -right-[9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-white dark:border-darkBg z-10"></div>
            <div class="bg-white dark:bg-darkCard p-8 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-gray-700 group">
                <div class="flex flex-col md:flex-row justify-between items-start mb-4">
                    <div>
                        <h3 class="text-xl font-bold text-gray-800 dark:text-white group-hover:text-primary transition" data-path="experience[${i}].role">${exp.role}</h3>
                        <p class="text-gray-500 font-medium mt-1" data-path="experience[${i}].company">${exp.company}</p>
                    </div>
                    <span class="mt-2 md:mt-0 px-4 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold" data-path="experience[${i}].period">${exp.period}</span>
                </div>
                <p class="text-gray-600 dark:text-gray-300 leading-relaxed" data-path="experience[${i}].description">${exp.description}</p>
            </div>
        </div>
    `).join('');

    // Projects
    const projContainer = document.getElementById('projects-container');
    projContainer.innerHTML = appData.projects.map((proj, i) => `
        <div class="bg-white dark:bg-darkCard rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-primary/20 transition-all duration-300 group border border-gray-100 dark:border-gray-700 flex flex-col h-full" data-aos="fade-up" data-aos-delay="${i * 100}">
            <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 flex items-center justify-center relative overflow-hidden">
                <i class="fas fa-code text-5xl text-gray-300 dark:text-gray-600 group-hover:scale-110 transition duration-500"></i>
                <div class="absolute inset-0 bg-primary/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-300 backdrop-blur-sm">
                    <a href="${proj.link}" target="_blank" class="px-6 py-2 bg-white text-primary rounded-full font-bold shadow-lg transform translate-y-4 group-hover:translate-y-0 transition duration-300">عرض المشروع</a>
                </div>
            </div>
            <div class="p-6 flex-grow flex flex-col">
                <h3 class="text-xl font-bold mb-3 text-gray-800 dark:text-white" data-path="projects[${i}].title">${proj.title}</h3>
                <p class="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3 flex-grow leading-relaxed" data-path="projects[${i}].desc">${proj.desc}</p>
            </div>
        </div>
    `).join('');

    // Certificates
    if(appData.certificates) {
        document.getElementById('certificates-container').innerHTML = appData.certificates.map((cert, i) => `
            <div class="flex items-center gap-4 bg-white dark:bg-darkCard p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-primary/50 transition" data-aos="fade-up">
                <div class="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary text-xl"><i class="fas fa-certificate"></i></div>
                <div>
                    <h4 class="font-bold text-gray-800 dark:text-white" data-path="certificates[${i}].name">${cert.name}</h4>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1"><span data-path="certificates[${i}].issuer">${cert.issuer}</span> | <span data-path="certificates[${i}].date">${cert.date}</span></p>
                </div>
            </div>
        `).join('');
    }
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

function setupScrollSpy() {
    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-link');
    
    window.addEventListener('scroll', () => {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (scrollY >= sectionTop - 200) current = section.getAttribute('id');
        });
        
        navLinks.forEach(link => {
            link.classList.remove('text-primary', 'font-bold');
            if (link.getAttribute('href').includes(current)) {
                link.classList.add('text-primary', 'font-bold');
            }
        });
    });
}

function initTheme() {
    const btn = document.getElementById('theme-btn');
    const html = document.documentElement;
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) html.classList.add('dark');
    btn.addEventListener('click', () => {
        html.classList.toggle('dark');
        localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
    });
}

// --- Admin Logic ---
function toggleAdminPanel() { document.getElementById('admin-modal').classList.toggle('hidden'); }

function authenticateAndEdit() {
    const repo = document.getElementById('repo-input').value.trim();
    const token = document.getElementById('token-input').value.trim();
    if(!repo || !token) return alert('الرجاء إدخال البيانات');
    
    localStorage.setItem('saved_repo', repo);
    localStorage.setItem('saved_token', token);
    githubInfo.repo = repo; githubInfo.token = token;
    
    toggleAdminPanel();
    document.getElementById('save-btn').classList.remove('hidden');
    document.querySelectorAll('[data-path]').forEach(el => {
        el.contentEditable = "true";
        el.classList.add('editable-active');
    });
    alert('✅ تم تفعيل وضع التعديل');
}

async function saveToGitHub() {
    const btn = document.getElementById('save-btn');
    const oldText = btn.innerHTML;
    btn.innerHTML = 'جاري الحفظ...'; btn.disabled = true;

    try {
        document.querySelectorAll('[data-path]').forEach(el => {
            const path = el.getAttribute('data-path');
            setNestedValue(appData, path, el.innerText);
        });

        const fileUrl = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(fileUrl, { headers: { 'Authorization': `token ${githubInfo.token}` } });
        if(!getRes.ok) throw new Error('فشل الاتصال بـ GitHub');
        
        const fileData = await getRes.json();
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2))));

        await fetch(fileUrl, {
            method: 'PUT',
            headers: { 'Authorization': `token ${githubInfo.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Update CV Content", content: content, sha: fileData.sha })
        });

        alert('🎉 تم الحفظ بنجاح!');
        location.reload();
    } catch (e) {
        alert('خطأ: ' + e.message);
        btn.innerHTML = oldText; btn.disabled = false;
    }
}

function setNestedValue(obj, path, value) {
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
    current[keys[keys.length - 1]] = value;
}
