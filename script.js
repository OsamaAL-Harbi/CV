let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };

document.addEventListener('DOMContentLoaded', () => {
    // 1. تهيئة الحركات
    AOS.init({ duration: 800, once: true });
    
    // 2. ضبط السنة في الفوتر
    document.getElementById('year').textContent = new Date().getFullYear();
    
    // 3. تحميل البيانات
    loadContent();
    initTheme();

    // 4. استرجاع بيانات الدخول المحفوظة (للراحة)
    if(localStorage.getItem('saved_repo')) document.getElementById('repo-input').value = localStorage.getItem('saved_repo');
    if(localStorage.getItem('saved_token')) document.getElementById('token-input').value = localStorage.getItem('saved_token');
});

// --- دوال العرض (Rendering) ---

async function loadContent() {
    try {
        // إضافة timestamp لتجاوز الكاش وضمان جلب أحدث نسخة
        const res = await fetch(`data.json?t=${Date.now()}`);
        if(!res.ok) throw new Error("فشل تحميل ملف البيانات data.json");
        appData = await res.json();
        renderAll();
    } catch (err) {
        console.error(err);
        // في حال الخطأ نعرض رسالة لطيفة
        document.querySelector('.container').innerHTML = `<div class="text-center text-red-500 mt-20">عذراً، حدث خطأ في تحميل البيانات.<br>${err.message}</div>`;
    }
}

function renderAll() {
    // 1. الملف الشخصي
    const p = appData.profile;
    document.getElementById('profile-section').innerHTML = `
        <div class="relative inline-block group mb-6">
            <div class="absolute -inset-1 bg-gradient-to-r from-primary to-blue-400 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
            <img src="${p.image}" class="relative w-36 h-36 rounded-full border-4 border-white dark:border-darkBg object-cover shadow-2xl">
        </div>
        <h1 class="text-4xl md:text-5xl font-extrabold mb-3 text-gray-900 dark:text-white tracking-tight" data-path="profile.name">${p.name}</h1>
        <p class="text-xl text-primary font-medium mb-6" data-path="profile.title">${p.title}</p>
        <p class="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8 leading-relaxed text-lg" data-path="profile.summary">${p.summary}</p>
        
        <div class="flex flex-wrap justify-center gap-4 no-print">
            <a href="mailto:${p.email}" class="px-6 py-2.5 bg-primary text-white rounded-xl shadow-lg hover:bg-blue-600 hover:-translate-y-1 transition flex items-center gap-2">
                ✉️ تواصل معي
            </a>
            ${p.linkedin ? `<a href="${p.linkedin}" target="_blank" class="px-6 py-2.5 bg-[#0077b5] text-white rounded-xl shadow-lg hover:opacity-90 hover:-translate-y-1 transition">LinkedIn</a>` : ''}
            <a href="cv.pdf" download class="px-6 py-2.5 bg-white dark:bg-gray-800 text-gray-800 dark:text-white border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-1 transition flex items-center gap-2">
                📄 تحميل CV
            </a>
        </div>
    `;

    // 2. المهارات
    const skillsHTML = appData.skills.map((s, i) => 
        `<span class="px-4 py-2 bg-white dark:bg-darkCard rounded-lg shadow-sm text-gray-700 dark:text-gray-200 border border-gray-100 dark:border-gray-700 font-bold hover:border-primary hover:text-primary transition cursor-default" data-aos="zoom-in" data-aos-delay="${i * 50}" data-path="skills[${i}]">${s}</span>`
    ).join('');
    document.getElementById('skills-container').innerHTML = skillsHTML;

    // 3. الخبرات (Timeline)
    const expHTML = appData.experience.map((exp, i) => `
        <div class="relative pl-0 md:pl-12 py-2" data-aos="fade-up">
            <div class="hidden md:block absolute left-[-9px] top-6 w-5 h-5 rounded-full bg-primary border-4 border-white dark:border-darkBg z-10"></div>
            
            <div class="bg-white dark:bg-darkCard p-6 rounded-2xl shadow-sm hover:shadow-md transition border border-gray-100 dark:border-gray-700 group">
                <div class="flex flex-col sm:flex-row justify-between items-start mb-3 gap-2">
                    <div>
                        <h3 class="text-xl font-bold text-gray-900 dark:text-white group-hover:text-primary transition" data-path="experience[${i}].role">${exp.role}</h3>
                        <p class="text-primary font-medium text-sm" data-path="experience[${i}].company">${exp.company}</p>
                    </div>
                    <span class="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-full text-xs font-bold whitespace-nowrap" data-path="experience[${i}].period">${exp.period}</span>
                </div>
                <p class="text-gray-600 dark:text-gray-400 leading-relaxed text-sm" data-path="experience[${i}].description">${exp.description}</p>
            </div>
        </div>
    `).join('');
    document.getElementById('experience-container').innerHTML = expHTML;

    // 4. المشاريع
    const projHTML = appData.projects.map((proj, i) => `
        <div class="bg-white dark:bg-darkCard p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:-translate-y-1 transition duration-300 group h-full flex flex-col" data-aos="fade-up" data-aos-delay="${i * 100}">
            <h3 class="text-lg font-bold mb-2 text-gray-800 dark:text-white" data-path="projects[${i}].title">${proj.title}</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-6 flex-grow" data-path="projects[${i}].desc">${proj.desc}</p>
            <a href="${proj.link}" target="_blank" class="text-primary text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all mt-auto self-start">
                عرض المشروع <span class="text-lg">&larr;</span>
            </a>
        </div>
    `).join('');
    document.getElementById('projects-container').innerHTML = projHTML;

    // 5. الشهادات (إذا وجدت)
    if(appData.certificates) {
        const certsHTML = appData.certificates.map((cert, i) => `
            <div class="flex items-center gap-4 bg-white dark:bg-darkCard p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700" data-aos="fade-up">
                <div class="text-3xl bg-gray-50 dark:bg-gray-800 p-2 rounded-lg">🏅</div>
                <div>
                    <h4 class="font-bold text-gray-800 dark:text-white text-sm" data-path="certificates[${i}].name">${cert.name}</h4>
                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span data-path="certificates[${i}].issuer">${cert.issuer}</span> • 
                        <span data-path="certificates[${i}].date">${cert.date}</span>
                    </p>
                </div>
            </div>
        `).join('');
        document.getElementById('certificates-container').innerHTML = certsHTML;
    }
}

// --- منطق التعديل (Admin Logic) ---

function toggleAdminPanel() {
    document.getElementById('admin-modal').classList.toggle('hidden');
}

function authenticateAndEdit() {
    const repo = document.getElementById('repo-input').value.trim();
    const token = document.getElementById('token-input').value.trim();

    if(!repo || !token) { alert('الرجاء إدخال البيانات كاملة'); return; }

    // حفظ البيانات محلياً
    localStorage.setItem('saved_repo', repo);
    localStorage.setItem('saved_token', token);
    
    githubInfo.repo = repo;
    githubInfo.token = token;

    toggleAdminPanel();
    enableEditMode();
}

function enableEditMode() {
    document.getElementById('save-btn').classList.remove('hidden');
    
    // تفعيل خاصية الكتابة على العناصر
    document.querySelectorAll('[data-path]').forEach(el => {
        el.contentEditable = "true";
        el.classList.add('editable-active');
        // منع إضافة تنسيقات عند اللصق (لصق كنص فقط)
        el.addEventListener('paste', function(e) {
            e.preventDefault();
            const text = (e.originalEvent || e).clipboardData.getData('text/plain');
            document.execCommand('insertText', false, text);
        });
    });

    alert('✅ تم تفعيل وضع التعديل!\n- اضغط على أي نص لتغييره.\n- عند الانتهاء اضغط زر "حفظ التعديلات" الأخضر.');
}

async function saveToGitHub() {
    const btn = document.getElementById('save-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'جاري الحفظ... ⏳';
    btn.disabled = true;

    try {
        // 1. تحديث البيانات محلياً من الواجهة
        document.querySelectorAll('[data-path]').forEach(el => {
            const path = el.getAttribute('data-path');
            setNestedValue(appData, path, el.innerText);
        });

        // 2. جلب SHA الملف
        const fileUrl = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(fileUrl, {
            headers: { 
                'Authorization': `token ${githubInfo.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if(!getRes.ok) throw new Error('فشل الاتصال بالمستودع. تأكد من صحة التوكن واسم الريبو.');
        const fileData = await getRes.json();
        
        // 3. التشفير (UTF-8 safe base64)
        const jsonString = JSON.stringify(appData, null, 2);
        const encodedContent = btoa(unescape(encodeURIComponent(jsonString)));

        // 4. الإرسال (PUT)
        const putRes = await fetch(fileUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${githubInfo.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "Update CV content via Website",
                content: encodedContent,
                sha: fileData.sha
            })
        });

        if(!putRes.ok) throw new Error('حدث خطأ أثناء حفظ الملف في GitHub.');

        alert('🎉 تم الحفظ بنجاح! سيتم تحديث الموقع للزوار خلال دقيقة.');
        location.reload();

    } catch (err) {
        alert('❌ خطأ: ' + err.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// دالة مساعدة لتحديث القيم المتداخلة (Nested Objects)
function setNestedValue(obj, path, value) {
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
}

// دوال الثيم (Dark Mode)
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