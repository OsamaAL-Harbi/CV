let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };
let clickCount = 0;
let isAdmin = false;

// ✅ رابط موقع DevShowcase (Render) الذي يجلب المشاريع
const DEV_SHOWCASE_URL = "https://devshowcase-7d9s.onrender.com"; 

document.addEventListener('DOMContentLoaded', () => {
    AOS.init();
    const yearEl = document.getElementById('year');
    if(yearEl) yearEl.textContent = new Date().getFullYear();
    
    // بدء التحميل
    loadContent();
    initTheme();
    initParticles();
    setupSecretTrigger();

    // التحقق من جلسة الأدمن المحفوظة
    if(localStorage.getItem('saved_repo') && localStorage.getItem('saved_token')) {
        const repoIn = document.getElementById('repo-input');
        const tokenIn = document.getElementById('token-input');
        if(repoIn) repoIn.value = localStorage.getItem('saved_repo');
        if(tokenIn) tokenIn.value = localStorage.getItem('saved_token');
    }
});

// --- التنقل وقوائم الجوال ---
function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(sec => {
        sec.classList.remove('active');
        sec.style.display = 'none';
    });
    const target = document.getElementById(pageId);
    if(target) {
        target.style.display = 'block';
        setTimeout(() => target.classList.add('active'), 10);
    }
    
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('nav-active'));
    const navBtn = document.getElementById(`nav-${pageId}`);
    if(navBtn) navBtn.classList.add('nav-active');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    if (menu.classList.contains('closed')) {
        menu.classList.remove('closed');
        menu.classList.add('open');
    } else {
        menu.classList.remove('open');
        menu.classList.add('closed');
    }
}

// --- 🔥 دالة تحميل البيانات (المدمجة) ---
async function loadContent() {
    try {
        // 1. جلب البيانات الأساسية من data.json (للبروفايل والخبرات)
        const resLocal = await fetch(`data.json?t=${Date.now()}`);
        if(!resLocal.ok) throw new Error("Local data not found");
        appData = await resLocal.json();

        // رسم البيانات الأولية فوراً
        renderAll();

        // 2. محاولة جلب المشاريع من السيرفر (Render) وتحديث القسم
        try {
            const projectsContainer = document.getElementById('projects-container');
            if(projectsContainer) {
                projectsContainer.innerHTML = '<div class="col-span-3 text-center text-gray-500 animate-pulse">جاري جلب أحدث المشاريع من السيرفر... ⏳</div>';
            }

            const resRemote = await fetch(`${DEV_SHOWCASE_URL}/api/portfolio`);
            if (resRemote.ok) {
                const remoteProjects = await resRemote.json();
                
                // تحويل صيغة البيانات لتناسب الـ CV
                const formattedProjects = remoteProjects.map(proj => ({
                    title: proj.name,
                    desc: proj.description,
                    // نستخدم الاسم هنا للربط، أو الرابط المباشر إذا كان موجوداً في html_url
                    link: proj.name, 
                    type: proj.type,
                    stars: proj.stars
                }));

                // تحديث المشاريع في الذاكرة وإعادة الرسم
                if (formattedProjects.length > 0) {
                    appData.projects = formattedProjects;
                    renderAll(); // إعادة الرسم بالمشاريع الجديدة
                    console.log("تم تحديث المشاريع من DevShowcase ✅");
                }
            }
        } catch (remoteErr) {
            console.warn("فشل الاتصال بـ DevShowcase، سيتم عرض المشاريع المحلية فقط.", remoteErr);
            // في حال الفشل، سيبقى المحتوى القديم أو يتم عرض رسالة خطأ بسيطة
        }

    } catch (err) {
        showToast('خطأ في تحميل البيانات الأساسية', 'error');
        console.error(err);
    }
}

function renderAll() {
    // --- الملف الشخصي ---
    const p = appData.profile;
    updateText('profile.name', p.name);
    updateText('profile.summary', p.summary);
    
    const imgEl = document.getElementById('profile-img');
    if(imgEl) imgEl.src = p.image || 'https://via.placeholder.com/200';
    
    typeWriter(p.title, 'typewriter');

    const emailEl = document.getElementById('email-contact');
    if(emailEl) emailEl.href = `mailto:${p.email}`;
    const linkedinEl = document.getElementById('social-linkedin');
    if(linkedinEl) linkedinEl.href = p.linkedin;
    const githubEl = document.getElementById('social-github');
    if(githubEl) githubEl.href = p.github;

    // --- الخبرات ---
    const expContainer = document.getElementById('experience-container');
    if(expContainer) {
        expContainer.innerHTML = appData.experience.map((exp, i) => `
            <div class="relative group mb-8" data-aos="fade-up">
                ${renderAdminButtons('experience', i)}
                <div class="absolute -right-[39px] top-1 w-4 h-4 bg-primary rounded-full border-4 border-white dark:border-darkBg z-10 group-hover:scale-125 transition"></div>
                <div class="mb-1">
                    <h3 class="text-xl font-bold text-gray-800 dark:text-white">${exp.role}</h3>
                    <p class="text-primary font-medium text-sm">${exp.company}</p>
                </div>
                <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded text-xs font-bold mb-3">${exp.period}</span>
                <p class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">${exp.description}</p>
            </div>
        `).join('');
    }

    // --- المهارات ---
    const skillsContainer = document.getElementById('skills-container');
    if(skillsContainer) {
        skillsContainer.innerHTML = appData.skills.map((s, i) => `
            <div class="relative group inline-block">
                <span class="px-3 py-1 bg-white dark:bg-cardBg border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300 cursor-default">${s}</span>
                ${isAdmin ? `<button onclick="deleteItem('skills', ${i})" class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center transition">×</button>` : ''}
            </div>
        `).join('');
    }

    // --- الشهادات ---
    const certContainer = document.getElementById('certificates-container');
    if(certContainer && appData.certificates) {
        certContainer.innerHTML = appData.certificates.map((cert, i) => `
            <div class="relative group bg-white dark:bg-cardBg p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 hover:border-secondary transition">
                ${renderAdminButtons('certificates', i)}
                <div class="text-2xl text-secondary"><i class="fas fa-certificate"></i></div>
                <div>
                    <h4 class="font-bold text-sm text-gray-800 dark:text-white">${cert.name}</h4>
                    <p class="text-xs text-gray-500 mt-1">${cert.issuer} | ${cert.date}</p>
                </div>
            </div>
        `).join('');
    }

    // 🔥 --- المشاريع (الرسم التلقائي) ---
    const projContainer = document.getElementById('projects-container');
    if(projContainer && appData.projects) {
        projContainer.innerHTML = appData.projects.map((proj, i) => {
            // منطق الرابط الذكي:
            // إذا كان الرابط لا يبدأ بـ http (أي أنه اسم مستودع)، نقوم بتكوين رابط المعاينة
            let targetLink = proj.link;
            let btnText = "عرض";
            let btnClass = "bg-white text-gray-900";

            if (proj.link && !proj.link.startsWith('http')) {
                // هذا الرابط سيفتح مشروعك في الموقع الجديد مع نافذة منبثقة
                targetLink = `${DEV_SHOWCASE_URL}?project=${encodeURIComponent(proj.title)}`;
                btnText = "معاينة 🚀";
                btnClass = "bg-primary text-white hover:bg-blue-600";
            }

            return `
            <div class="relative group bg-white dark:bg-cardBg rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition border border-gray-100 dark:border-gray-700 flex flex-col h-full" data-aos="zoom-in" data-aos-delay="${i * 50}">
                ${renderAdminButtons('projects', i)}
                <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center relative overflow-hidden">
                    <i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500"></i>
                    
                    <div class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-sm">
                        <a href="${targetLink}" target="_blank" class="px-6 py-2 rounded-full font-bold transform translate-y-4 group-hover:translate-y-0 transition ${btnClass}">
                           ${btnText}
                        </a>
                    </div>
                    
                    ${proj.type ? `<span class="absolute top-2 right-2 text-[10px] bg-black/50 text-white px-2 py-1 rounded">${proj.type}</span>` : ''}
                </div>
                <div class="p-6 flex-grow">
                    <h3 class="text-lg font-bold mb-2 truncate" title="${proj.title}">${proj.title}</h3>
                    <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-3">${proj.desc}</p>
                </div>
            </div>
            `;
        }).join('');
    }
}

// --- أدوات الأدمن (CRUD) ---
function renderAdminButtons(type, index) {
    if (!isAdmin) return '';
    return `
    <div class="admin-controls absolute top-2 left-2 z-20 gap-2 opacity-0 group-hover:opacity-100 transition duration-300">
        <button onclick="editItem('${type}', ${index})" class="bg-blue-500 text-white w-8 h-8 rounded-full shadow hover:bg-blue-600 flex items-center justify-center transition transform hover:scale-110"><i class="fas fa-pen text-xs"></i></button>
        <button onclick="deleteItem('${type}', ${index})" class="bg-red-500 text-white w-8 h-8 rounded-full shadow hover:bg-red-600 flex items-center justify-center transition transform hover:scale-110"><i class="fas fa-trash text-xs"></i></button>
    </div>`;
}

function updateText(key, value) {
    const el = document.querySelector(`[data-path="${key}"]`);
    if(el) {
        el.innerText = value;
        if(isAdmin) {
            el.contentEditable = "true";
            el.classList.add('editable-active');
            el.onblur = () => setDeepValue(appData, key, el.innerText);
        }
    }
}

async function editItem(type, index) {
    const item = appData[type][index];
    let res;
    
    // الملاحظة: تعديل المشاريع هنا سيعدل النسخة المحلية فقط
    // المشاريع القادمة من GitHub يتم تحديثها من GitHub نفسه
    if(type === 'experience') {
        res = await Swal.fire({
            title: 'تعديل الخبرة',
            html: `<input id="swal-role" class="swal2-input" value="${item.role}"><input id="swal-co" class="swal2-input" value="${item.company}"><input id="swal-date" class="swal2-input" value="${item.period}"><textarea id="swal-desc" class="swal2-textarea">${item.description}</textarea>`,
            preConfirm: () => ({ role: document.getElementById('swal-role').value, company: document.getElementById('swal-co').value, period: document.getElementById('swal-date').value, description: document.getElementById('swal-desc').value })
        });
    } else if(type === 'projects') {
        res = await Swal.fire({
            title: 'تعديل مشروع (محلي)',
            html: `
                <input id="swal-title" class="swal2-input" value="${item.title}" placeholder="العنوان">
                <input id="swal-link" class="swal2-input" value="${item.link}" placeholder="رابط مباشر">
                <textarea id="swal-desc" class="swal2-textarea">${item.desc}</textarea>
            `,
            preConfirm: () => ({ title: document.getElementById('swal-title').value, link: document.getElementById('swal-link').value, desc: document.getElementById('swal-desc').value })
        });
    } else if(type === 'certificates') {
        res = await Swal.fire({
            title: 'تعديل الشهادة',
            html: `<input id="swal-name" class="swal2-input" value="${item.name}"><input id="swal-iss" class="swal2-input" value="${item.issuer}"><input id="swal-date" class="swal2-input" value="${item.date}">`,
            preConfirm: () => ({ name: document.getElementById('swal-name').value, issuer: document.getElementById('swal-iss').value, date: document.getElementById('swal-date').value })
        });
    }

    if(res && res.value) {
        appData[type][index] = res.value;
        renderAll();
    }
}

async function addItem(type) {
    if(!isAdmin) return;
    let res;
    
    if(type === 'skills') {
        res = await Swal.fire({ input: 'text', title: 'مهارة جديدة', confirmButtonText: 'إضافة' });
        if(res.value) appData.skills.push(res.value);
    } else if(type === 'experience') {
        res = await Swal.fire({
            title: 'إضافة خبرة',
            html: '<input id="swal-role" class="swal2-input" placeholder="المسمى"><input id="swal-co" class="swal2-input" placeholder="الشركة"><input id="swal-date" class="swal2-input" placeholder="التاريخ"><textarea id="swal-desc" class="swal2-textarea" placeholder="الوصف"></textarea>',
            preConfirm: () => ({ role: document.getElementById('swal-role').value, company: document.getElementById('swal-co').value, period: document.getElementById('swal-date').value, description: document.getElementById('swal-desc').value })
        });
        if(res.value) appData.experience.push(res.value);
    } else if(type === 'certificates') {
         res = await Swal.fire({
            title: 'إضافة شهادة',
            html: '<input id="swal-name" class="swal2-input" placeholder="الاسم"><input id="swal-iss" class="swal2-input" placeholder="الجهة"><input id="swal-date" class="swal2-input" placeholder="التاريخ">',
            preConfirm: () => ({ name: document.getElementById('swal-name').value, issuer: document.getElementById('swal-iss').value, date: document.getElementById('swal-date').value })
        });
        if(res.value) appData.certificates.push(res.value);
    }
    renderAll();
}

function deleteItem(type, index) {
    if(!isAdmin) return;
    Swal.fire({
        title: 'حذف العنصر؟', text: "لن يمكنك استرجاعه!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'نعم، احذف', cancelButtonText: 'إلغاء'
    }).then((result) => {
        if (result.isConfirmed) {
            appData[type].splice(index, 1);
            renderAll();
        }
    });
}

async function editImage(key) {
    if(!isAdmin) return;
    const { value } = await Swal.fire({ input: 'url', title: 'رابط الصورة الجديد', confirmButtonText: 'تحديث' });
    if(value) {
        setDeepValue(appData, key, value);
        renderAll();
    }
}

// --- المصادقة وحفظ GitHub ---
function setupSecretTrigger() {
    const trigger = document.getElementById('secret-trigger');
    if(trigger) {
        trigger.addEventListener('click', () => {
            clickCount++;
            if(clickCount === 3) { document.getElementById('admin-modal').classList.remove('hidden'); clickCount = 0; }
        });
    }
}

function authenticateAndEdit() {
    const repo = document.getElementById('repo-input').value.trim();
    const token = document.getElementById('token-input').value.trim();
    if(!repo || !token) return showToast('الرجاء إدخال البيانات', 'error');
    
    localStorage.setItem('saved_repo', repo);
    localStorage.setItem('saved_token', token);
    githubInfo.repo = repo; githubInfo.token = token;
    
    document.getElementById('admin-modal').classList.add('hidden');
    document.getElementById('admin-toolbar').classList.remove('hidden');
    document.body.classList.add('admin-mode');
    isAdmin = true;
    renderAll();
    showToast('أهلاً بك! تم تفعيل وضع التعديل ✏️', 'success');
}

function logout() {
    localStorage.removeItem('saved_repo');
    localStorage.removeItem('saved_token');
    location.reload();
}

async function saveToGitHub() {
    const btn = document.querySelector('#admin-toolbar button');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الحفظ...'; 
    
    try {
        const fileUrl = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(fileUrl, { headers: { 'Authorization': `token ${githubInfo.token}` } });
        if (!getRes.ok) throw new Error("فشل الاتصال");
        
        const fileData = await getRes.json();
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2))));
        
        await fetch(fileUrl, {
            method: 'PUT',
            headers: { 'Authorization': `token ${githubInfo.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Updated via Admin Panel", content: content, sha: fileData.sha })
        });
        
        Swal.fire('تم الحفظ!', 'تم تحديث الموقع بنجاح 🚀', 'success');
    } catch(e) {
        Swal.fire('خطأ', e.message, 'error');
    } finally {
        btn.innerHTML = oldText;
    }
}

// --- دوال مساعدة ---
function typeWriter(text, elementId) {
    const elm = document.getElementById(elementId);
    if(elm && text) {
        elm.innerHTML = "";
        let i = 0;
        const interval = setInterval(() => {
            elm.innerHTML += text.charAt(i);
            i++;
            if (i >= text.length) clearInterval(interval);
        }, 100);
    }
}
function initTheme() {
    const btn = document.getElementById('theme-btn');
    if(btn) {
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark');
        btn.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark');
            localStorage.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
            initParticles();
        });
    }
}
function initParticles() {
    const isDark = document.documentElement.classList.contains('dark');
    if(window.particlesJS) {
        particlesJS("particles-js", {
            "particles": { "number": { "value": 40 }, "color": { "value": isDark ? "#ffffff" : "#3b82f6" }, "shape": { "type": "circle" }, "opacity": { "value": 0.3 }, "size": { "value": 3 }, "line_linked": { "enable": true, "distance": 150, "color": isDark ? "#ffffff" : "#3b82f6", "opacity": 0.1, "width": 1 }, "move": { "enable": true, "speed": 1 } },
            "interactivity": { "detect_on": "canvas", "events": { "onhover": { "enable": true, "mode": "grab" } } }, "retina_detect": true
        });
    }
}
function setDeepValue(obj, path, value) { const keys = path.split('.'); let current = obj; for (let i = 0; i < keys.length - 1; i++) current = current[keys[i]]; current[keys[keys.length - 1]] = value; }
function showToast(msg, type) { if(window.Toastify) Toastify({ text: msg, duration: 3000, style: { background: type === 'success' ? '#10B981' : '#EF4444' } }).showToast(); }
