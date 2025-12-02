let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };

// عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    loadContent();
    initTheme();
    
    // استرجاع البيانات المحفوظة للتسهيل عليك
    if(localStorage.getItem('saved_repo')) document.getElementById('repo-input').value = localStorage.getItem('saved_repo');
    if(localStorage.getItem('saved_token')) document.getElementById('token-input').value = localStorage.getItem('saved_token');
});

// --- 1. جلب البيانات وعرضها ---
async function loadContent() {
    try {
        // نضيف timestamp لمنع المتصفح من حفظ نسخة قديمة
        const res = await fetch(`data.json?t=${Date.now()}`);
        if(!res.ok) throw new Error("لم يتم العثور على ملف البيانات");
        appData = await res.json();
        renderPage();
    } catch (err) {
        console.error(err);
        document.body.innerHTML = `<div class="text-center p-10 text-red-500">خطأ في تحميل البيانات: ${err.message}</div>`;
    }
}

function renderPage() {
    // الملف الشخصي
    const p = appData.profile;
    document.getElementById('profile-section').innerHTML = `
        <div class="relative inline-block group">
            <img src="${p.image}" class="w-32 h-32 rounded-full mx-auto mb-4 border-4 border-primary object-cover shadow-xl group-hover:scale-105 transition">
        </div>
        <h1 class="text-4xl font-extrabold mb-2 text-gray-900 dark:text-white" data-path="profile.name">${p.name}</h1>
        <p class="text-xl text-primary font-medium mb-4" data-path="profile.title">${p.title}</p>
        <p class="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-6 leading-relaxed" data-path="profile.summary">${p.summary}</p>
        <div class="flex justify-center gap-3">
            <a href="mailto:${p.email}" class="px-6 py-2 bg-primary text-white rounded-lg shadow hover:bg-blue-600 transition">راسلني</a>
            <a href="${p.github}" target="_blank" class="px-6 py-2 bg-gray-800 text-white rounded-lg shadow hover:bg-black transition">GitHub</a>
        </div>
    `;

    // المهارات
    const skillsHTML = appData.skills.map((s, i) => 
        `<span class="px-4 py-2 bg-white dark:bg-darkCard rounded-lg shadow-sm text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700 font-bold" data-path="skills[${i}]">${s}</span>`
    ).join('');
    document.getElementById('skills-container').innerHTML = skillsHTML;

    // الخبرات
    const expHTML = appData.experience.map((exp, i) => `
        <div class="bg-white dark:bg-darkCard p-6 rounded-2xl shadow-sm border-r-4 border-primary hover:shadow-md transition">
            <div class="flex flex-col md:flex-row justify-between mb-2">
                <h3 class="text-xl font-bold text-gray-800 dark:text-white" data-path="experience[${i}].role">${exp.role}</h3>
                <span class="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded-full w-fit mt-1 md:mt-0" data-path="experience[${i}].period">${exp.period}</span>
            </div>
            <p class="text-gray-500 dark:text-gray-400 font-semibold mb-3" data-path="experience[${i}].company">${exp.company}</p>
            <p class="text-gray-600 dark:text-gray-300 leading-relaxed" data-path="experience[${i}].description">${exp.description}</p>
        </div>
    `).join('');
    document.getElementById('experience-container').innerHTML = expHTML;

    // المشاريع
    const projHTML = appData.projects.map((proj, i) => `
        <div class="bg-white dark:bg-darkCard p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 group hover:-translate-y-1 transition duration-300">
            <h3 class="text-lg font-bold mb-2 text-gray-800 dark:text-white" data-path="projects[${i}].title">${proj.title}</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-3" data-path="projects[${i}].desc">${proj.desc}</p>
            <a href="${proj.link}" class="text-primary text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all">عرض المشروع <span>&larr;</span></a>
        </div>
    `).join('');
    document.getElementById('projects-container').innerHTML = projHTML;
}

// --- 2. إدارة التعديل (Admin Logic) ---

function toggleAdminPanel() {
    const modal = document.getElementById('admin-modal');
    modal.classList.toggle('hidden');
}

function authenticateAndEdit() {
    const repo = document.getElementById('repo-input').value;
    const token = document.getElementById('token-input').value;

    if(!repo || !token) { alert('الرجاء تعبئة جميع الحقول'); return; }

    // حفظ البيانات محلياً للمستقبل
    localStorage.setItem('saved_repo', repo);
    localStorage.setItem('saved_token', token);
    
    githubInfo.repo = repo;
    githubInfo.token = token;

    toggleAdminPanel();
    enableEditMode();
}

function enableEditMode() {
    document.getElementById('save-changes-btn').classList.remove('hidden');
    
    // تحويل العناصر القابلة للتعديل
    document.querySelectorAll('[data-path]').forEach(el => {
        el.contentEditable = "true";
        el.classList.add('editable-active');
    });

    alert('✅ أنت الآن في وضع التعديل!\nاضغط على أي نص لتغييره، ثم اضغط "حفظ التغييرات".');
}

// --- 3. الحفظ في GitHub ---

async function saveToGitHub() {
    const btn = document.getElementById('save-changes-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'جاري الاتصال... ⏳';
    btn.disabled = true;

    try {
        // 1. تحديث المتغير appData بالقيم الجديدة من الشاشة
        document.querySelectorAll('[data-path]').forEach(el => {
            const path = el.getAttribute('data-path');
            const value = el.innerText;
            setNestedValue(appData, path, value);
        });

        // 2. جلب SHA الملف الحالي من GitHub (مطلوب للتحديث)
        const fileUrl = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(fileUrl, {
            headers: { 
                'Authorization': `token ${githubInfo.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if(!getRes.ok) throw new Error('فشل الاتصال بالمستودع (تأكد من التوكن واسم الريبو)');
        const fileData = await getRes.json();
        
        // 3. تشفير البيانات العربية بشكل صحيح (UTF-8 to Base64)
        const jsonString = JSON.stringify(appData, null, 2);
        const encodedContent = btoa(unescape(encodeURIComponent(jsonString)));

        // 4. إرسال البيانات الجديدة (PUT Request)
        const putRes = await fetch(fileUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubInfo.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "Update content via Website Editor",
                content: encodedContent,
                sha: fileData.sha
            })
        });

        if(!putRes.ok) throw new Error('خطأ أثناء الحفظ في GitHub');

        alert('🎉 تم الحفظ بنجاح! سيتم تحديث الموقع للزوار خلال دقيقة.');
        location.reload();

    } catch (err) {
        alert('❌ حدث خطأ: ' + err.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// دوال مساعدة
function setNestedValue(obj, path, value) {
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]];
    current[keys[keys.length - 1]] = value;
}

function initTheme() {
    const btn = document.getElementById('theme-btn');
    const html = document.documentElement;
    
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        html.classList.add('dark');
    }

    btn.addEventListener('click', () => {
        html.classList.toggle('dark');
        localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
    });
}