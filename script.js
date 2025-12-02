let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };

document.addEventListener('DOMContentLoaded', () => {
    AOS.init({ duration: 800, once: true });
    document.getElementById('year').textContent = new Date().getFullYear();
    loadContent();
    initTheme();

    if(localStorage.getItem('saved_repo')) document.getElementById('repo-input').value = localStorage.getItem('saved_repo');
    if(localStorage.getItem('saved_token')) document.getElementById('token-input').value = localStorage.getItem('saved_token');
});

// --- الدالة الأساسية: تحميل البيانات ---
async function loadContent() {
    try {
        // 1. محاولة جلب الملف
        const res = await fetch(`data.json?t=${Date.now()}`); // إضافة وقت لمنع الكاش
        
        // 2. التحقق من وجود الملف
        if(!res.ok) throw new Error(`لم يتم العثور على ملف data.json (Error ${res.status})`);
        
        // 3. التحقق من صحة الكتابة داخل الملف
        appData = await res.json();
        
        // 4. إذا وصلنا هنا، البيانات سليمة -> نعرضها
        renderAll();
        
        // إخفاء شاشة التحميل وإظهار الموقع
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('main-content').classList.remove('opacity-0');

    } catch (err) {
        console.error("Critical Error:", err);
        // إظهار رسالة الخطأ للمستخدم بدلاً من الشاشة البيضاء
        document.getElementById('loading-screen').classList.add('hidden');
        document.getElementById('error-message').classList.remove('hidden');
        document.getElementById('error-details').textContent = `السبب: ${err.message}. تأكد من صحة ملف data.json`;
    }
}

function renderAll() {
    // الملف الشخصي
    const p = appData.profile;
    document.getElementById('profile-section').innerHTML = `
        <div class="relative inline-block group mb-6">
            <img src="${p.image}" class="relative w-40 h-40 rounded-full border-4 border-white dark:border-darkBg object-cover shadow-2xl group-hover:scale-105 transition transform" onerror="this.src='https://via.placeholder.com/150'">
        </div>
        <h1 class="text-4xl md:text-5xl font-extrabold mb-3 text-gray-900 dark:text-white" data-path="profile.name">${p.name}</h1>
        <p class="text-xl text-primary font-medium mb-6" data-path="profile.title">${p.title}</p>
        <p class="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed" data-path="profile.summary">${p.summary}</p>
        <div class="flex flex-wrap justify-center gap-4 no-print">
            <a href="mailto:${p.email}" class="px-6 py-2.5 bg-primary text-white rounded-xl shadow-lg hover:bg-blue-600 transition flex items-center gap-2">✉️ تواصل</a>
            ${p.linkedin ? `<a href="${p.linkedin}" target="_blank" class="px-6 py-2.5 bg-[#0077b5] text-white rounded-xl shadow-lg transition">LinkedIn</a>` : ''}
            <a href="cv.pdf" download class="px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition flex items-center gap-2">📄 تحميل CV</a>
        </div>
    `;

    // المهارات
    const skillsHTML = appData.skills.map((s, i) => 
        `<span class="px-4 py-2 bg-white dark:bg-darkCard rounded-lg shadow-sm text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700 font-bold hover:text-primary transition" data-aos="zoom-in" data-aos-delay="${i * 50}" data-path="skills[${i}]">${s}</span>`
    ).join('');
    document.getElementById('skills-container').innerHTML = skillsHTML;

    // الخبرات
    const expHTML = appData.experience.map((exp, i) => `
        <div class="relative pl-0 md:pl-12 py-2" data-aos="fade-up">
            <div class="hidden md:block absolute left-[-9px] top-6 w-5 h-5 rounded-full bg-primary border-4 border-white dark:border-darkBg z-10"></div>
            <div class="bg-white dark:bg-darkCard p-6 rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100 dark:border-gray-700 group">
                <div class="flex flex-col sm:flex-row justify-between items-start mb-2 gap-2">
                    <div>
                        <h3 class="text-xl font-bold text-gray-900 dark:text-white group-hover:text-primary transition" data-path="experience[${i}].role">${exp.role}</h3>
                        <p class="text-primary font-medium text-sm" data-path="experience[${i}].company">${exp.company}</p>
                    </div>
                    <span class="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full text-xs font-bold" data-path="experience[${i}].period">${exp.period}</span>
                </div>
                <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed" data-path="experience[${i}].description">${exp.description}</p>
            </div>
        </div>
    `).join('');
    document.getElementById('experience-container').innerHTML = expHTML;

    // المشاريع
    const projHTML = appData.projects.map((proj, i) => `
        <div class="bg-white dark:bg-darkCard p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-1 transition duration-300 flex flex-col h-full" data-aos="fade-up" data-aos-delay="${i * 100}">
            <h3 class="text-lg font-bold mb-2 text-gray-800 dark:text-white" data-path="projects[${i}].title">${proj.title}</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-6 flex-grow" data-path="projects[${i}].desc">${proj.desc}</p>
            <a href="${proj.link}" target="_blank" class="text-primary text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all mt-auto self-start">عرض المشروع <span>&larr;</span></a>
        </div>
    `).join('');
    document.getElementById('projects-container').innerHTML = projHTML;

    // الشهادات
    if(appData.certificates) {
        const certsHTML = appData.certificates.map((cert, i) => `
            <div class="flex items-center gap-4 bg-white dark:bg-darkCard p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700" data-aos="fade-up">
                <div class="text-3xl bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">🏅</div>
                <div>
                    <h4 class="font-bold text-gray-800 dark:text-white text-sm" data-path="certificates[${i}].name">${cert.name}</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1"><span data-path="certificates[${i}].issuer">${cert.issuer}</span> • <span data-path="certificates[${i}].date">${cert.date}</span></p>
                </div>
            </div>
        `).join('');
        document.getElementById('certificates-container').innerHTML = certsHTML;
    }
}

// --- أدوات التحكم (نفس الكود السابق مع تحسينات بسيطة) ---
function toggleAdminPanel() { document.getElementById('admin-modal').classList.toggle('hidden'); }

function authenticateAndEdit() {
    const repo = document.getElementById('repo-input').value.trim();
    const token = document.getElementById('token-input').value.trim();
    if(!repo || !token) { alert('الرجاء تعبئة الحقول'); return; }
    localStorage.setItem('saved_repo', repo);
    localStorage.setItem('saved_token', token);
    githubInfo.repo = repo; githubInfo.token = token;
    toggleAdminPanel();
    enableEditMode();
}

function enableEditMode() {
    document.getElementById('save-btn').classList.remove('hidden');
    document.querySelectorAll('[data-path]').forEach(el => {
        el.contentEditable = "true";
        el.classList.add('editable-active');
    });
    alert('✅ تم تفعيل وضع التعديل');
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
        if(!getRes.ok) throw new Error('فشل الاتصال بالمستودع');
        const fileData = await getRes.json();
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2))));
        
        await fetch(fileUrl, {
            method: 'PUT',
            headers: { 'Authorization': `token ${githubInfo.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Web Update", content: content, sha: fileData.sha })
        });
        alert('🎉 تم الحفظ! سيتم التحديث قريباً.');
        location.reload();
    } catch (e) { alert('خطأ: ' + e.message); btn.innerHTML = 'حفظ التعديلات 💾'; btn.disabled = false; }
}

function setNestedValue(obj, path, value) {
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
    current[keys[keys.length - 1]] = value;
}

function initTheme() {
    const btn = document.getElementById('theme-btn');
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    }
    btn.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark');
        localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    });
}
