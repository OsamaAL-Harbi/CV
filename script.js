let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };
let clickCount = 0;
let isAdmin = false;

// ✅ رابط موقع DevShowcase (Render)
const DEV_SHOWCASE_URL = "https://devshowcase-7d9s.onrender.com"; 

document.addEventListener('DOMContentLoaded', () => {
    AOS.init();
    const yearEl = document.getElementById('year');
    if(yearEl) yearEl.textContent = new Date().getFullYear();
    
    // تحميل البيانات
    loadContent();
    initTheme();
    initParticles();
    setupSecretTrigger();

    // التحقق من الجلسة المحفوظة
    if(localStorage.getItem('saved_repo') && localStorage.getItem('saved_token')) {
        const repoIn = document.getElementById('repo-input');
        const tokenIn = document.getElementById('token-input');
        if(repoIn) repoIn.value = localStorage.getItem('saved_repo');
        if(tokenIn) tokenIn.value = localStorage.getItem('saved_token');
    }
});

// --- التنقل ---
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
    menu.classList.toggle('closed');
    menu.classList.toggle('open');
}

// --- 🔥 التعديل الجذري: دالة تحميل البيانات المدمجة ---
async function loadContent() {
    try {
        // 1. جلب البيانات الأساسية (Profile, Experience, Skills) من الملف المحلي
        const resLocal = await fetch(`data.json?t=${Date.now()}`);
        if(!resLocal.ok) throw new Error("Local data not found");
        appData = await resLocal.json();

        // 2. محاولة جلب المشاريع من DevShowcase (Render)
        try {
            const resRemote = await fetch(`${DEV_SHOWCASE_URL}/api/portfolio`);
            if (resRemote.ok) {
                const remoteProjects = await resRemote.json();
                
                // تحويل صيغة بيانات DevShowcase لتناسب صيغة الـ CV
                const formattedProjects = remoteProjects.map(proj => ({
                    title: proj.name,
                    desc: proj.description,
                    // نضع اسم المشروع فقط هنا لكي يعمل الربط الذكي لاحقاً
                    link: proj.name, 
                    type: proj.type // (اختياري) لمعرفة المصدر
                }));

                // تحديث قائمة المشاريع في التطبيق
                if (formattedProjects.length > 0) {
                    appData.projects = formattedProjects;
                    console.log("تم جلب المشاريع من DevShowcase بنجاح:", formattedProjects.length);
                }
            }
        } catch (remoteErr) {
            console.warn("فشل الاتصال بـ DevShowcase (قد يكون السيرفر نائماً)، سيتم استخدام البيانات المحلية.", remoteErr);
            // في حالة الفشل، ستبقى المشاريع الموجودة في data.json كما هي
        }

        renderAll();

    } catch (err) {
        showToast('خطأ في تحميل البيانات', 'error');
        console.error(err);
    }
}

function renderAll() {
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

    // Experience
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

    // Skills
    const skillsContainer = document.getElementById('skills-container');
    if(skillsContainer) {
        skillsContainer.innerHTML = appData.skills.map((s, i) => `
            <div class="relative group inline-block">
                <span class="px-3 py-1 bg-white dark:bg-cardBg border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300 cursor-default">${s}</span>
            </div>
        `).join('');
    }

    // Certificates
    const certContainer = document.getElementById('certificates-container');
    if(certContainer && appData.certificates) {
        certContainer.innerHTML = appData.certificates.map((cert, i) => `
            <div class="relative group bg-white dark:bg-cardBg p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center gap-4 hover:border-secondary transition">
                <div class="text-2xl text-secondary"><i class="fas fa-certificate"></i></div>
                <div>
                    <h4 class="font-bold text-sm text-gray-800 dark:text-white">${cert.name}</h4>
                    <p class="text-xs text-gray-500 mt-1">${cert.issuer} | ${cert.date}</p>
                </div>
            </div>
        `).join('');
    }

    // 🔥 Projects (عرض المشاريع التي تم جلبها)
    const projContainer = document.getElementById('projects-container');
    if(projContainer) {
        // إذا لم توجد مشاريع
        if (!appData.projects || appData.projects.length === 0) {
            projContainer.innerHTML = `<div class="col-span-3 text-center text-gray-500 py-10">جاري جلب المشاريع من GitHub... <br><span class="text-xs">(قد يستغرق دقيقة إذا كان السيرفر في وضع السبات)</span></div>`;
        } else {
            projContainer.innerHTML = appData.projects.map((proj, i) => {
                // إعداد الرابط الذكي
                let targetLink = `${DEV_SHOWCASE_URL}?project=${proj.title}`; // نستخدم الاسم للربط
                let btnText = "معاينة 🚀";
                let btnClass = "bg-primary text-white";

                return `
                <div class="relative group bg-white dark:bg-cardBg rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition border border-gray-100 dark:border-gray-700 flex flex-col h-full" data-aos="zoom-in" data-aos-delay="${i * 100}">
                    ${renderAdminButtons('projects', i)}
                    <div class="h-48 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center relative overflow-hidden">
                        <i class="fas fa-laptop-code text-5xl text-gray-300 dark:text-gray-700 group-hover:scale-110 transition duration-500"></i>
                        <div class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition backdrop-blur-sm">
                            <a href="${targetLink}" target="_blank" class="px-6 py-2 rounded-full font-bold transform translate-y-4 group-hover:translate-y-0 transition ${btnClass}">
                               ${btnText}
                            </a>
                        </div>
                    </div>
                    <div class="p-6 flex-grow">
                        <h3 class="text-lg font-bold mb-2 truncate">${proj.title}</h3>
                        <p class="text-gray-500 dark:text-gray-400 text-sm line-clamp-3">${proj.desc}</p>
                    </div>
                </div>
                `;
            }).join('');
        }
    }
}

// Admin Helpers (كما هي)
function renderAdminButtons(type, index) {
    if (!isAdmin) return '';
    return `<div class="admin-controls absolute top-2 left-2 z-20 gap-2 opacity-0 group-hover:opacity-100 transition duration-300">
        <button onclick="editItem('${type}', ${index})" class="bg-blue-500 text-white w-8 h-8 rounded-full shadow flex items-center justify-center"><i class="fas fa-pen text-xs"></i></button>
    </div>`;
}

// ... باقي دوال التعديل (CRUD) والأدوات المساعدة تبقى كما هي في ملفك الأصلي ...
// لتقليل حجم الرد، تأكد من إبقاء دوال (updateText, editItem, addItem, deleteItem, etc.) كما هي في الأسفل.
// أهم شيء هو استبدال دالة loadContent وتحديث DEV_SHOWCASE_URL في الأعلى.

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
    if(window.particlesJS) {
        const isDark = document.documentElement.classList.contains('dark');
        particlesJS("particles-js", {
            "particles": { "number": { "value": 40 }, "color": { "value": isDark ? "#ffffff" : "#3b82f6" }, "shape": { "type": "circle" }, "opacity": { "value": 0.3 }, "size": { "value": 3 }, "line_linked": { "enable": true, "distance": 150, "color": isDark ? "#ffffff" : "#3b82f6", "opacity": 0.1, "width": 1 }, "move": { "enable": true, "speed": 1 } },
            "interactivity": { "detect_on": "canvas", "events": { "onhover": { "enable": true, "mode": "grab" } } }, "retina_detect": true
        });
    }
}
function setupSecretTrigger() {
    const trigger = document.getElementById('secret-trigger');
    if(trigger) {
        trigger.addEventListener('click', () => {
            clickCount++;
            if(clickCount === 3) { document.getElementById('admin-modal').classList.remove('hidden'); clickCount = 0; }
        });
    }
}
function showToast(msg, type) { if(window.Toastify) Toastify({ text: msg, duration: 3000, style: { background: type === 'success' ? '#10B981' : '#EF4444' } }).showToast(); }
