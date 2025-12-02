let appData = {};
let githubInfo = { token: '', repo: '', sha: '' };
let isAdmin = false;

document.addEventListener('DOMContentLoaded', () => {
    AOS.init();
    document.getElementById('year').textContent = new Date().getFullYear();
    loadContent();
    initTheme();
    
    // Auto-login if data exists
    if(localStorage.getItem('gh_token')) {
        githubInfo.token = localStorage.getItem('gh_token');
        githubInfo.repo = localStorage.getItem('gh_repo');
        enableAdminMode();
    }
});

// --- 1. Data Loading ---
async function loadContent() {
    try {
        const res = await fetch(`data.json?t=${Date.now()}`);
        if(!res.ok) throw new Error("File not found");
        appData = await res.json();
        renderAll();
    } catch (err) {
        console.error(err);
    }
}

// --- 2. Rendering ---
function renderAll() {
    // Profile
    const p = appData.profile;
    updateText('profile.name', p.name);
    updateText('profile.title', p.title);
    updateText('profile.summary', p.summary);
    document.getElementById('profile-img').src = p.image;
    document.getElementById('email-btn').href = `mailto:${p.email}`;

    // Skills
    const skillsHtml = appData.skills.map((s, i) => `
        <div class="group relative px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
            <span class="font-bold" onclick="${isAdmin ? `editArrayItem('skills', ${i})` : ''}">${s}</span>
            ${isAdmin ? `<button onclick="deleteItem('skills', ${i})" class="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center">×</button>` : ''}
        </div>
    `).join('');
    document.getElementById('skills-container').innerHTML = skillsHtml;

    // Experience
    const expHtml = appData.experience.map((exp, i) => `
        <div class="group relative bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            ${isAdmin ? `<div class="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition"><button onclick="editObjectItem('experience', ${i})" class="text-blue-500"><i class="fas fa-pen"></i></button><button onclick="deleteItem('experience', ${i})" class="text-red-500"><i class="fas fa-trash"></i></button></div>` : ''}
            <h3 class="text-xl font-bold">${exp.role}</h3>
            <p class="text-primary text-sm mb-2">${exp.company} | ${exp.period}</p>
            <p class="text-gray-600 dark:text-gray-400">${exp.description}</p>
        </div>
    `).join('');
    document.getElementById('experience-container').innerHTML = expHtml;

    // Projects
    const projHtml = appData.projects.map((proj, i) => `
        <div class="group relative bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
             ${isAdmin ? `<div class="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition"><button onclick="editObjectItem('projects', ${i})" class="text-blue-500"><i class="fas fa-pen"></i></button><button onclick="deleteItem('projects', ${i})" class="text-red-500"><i class="fas fa-trash"></i></button></div>` : ''}
            <h3 class="text-lg font-bold mb-2">${proj.title}</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-4">${proj.desc}</p>
            <a href="${proj.link}" target="_blank" class="text-primary text-sm font-bold">عرض المشروع &rarr;</a>
        </div>
    `).join('');
    document.getElementById('projects-container').innerHTML = projHtml;

    // Custom Section (NEW)
    updateText('customSection.title', appData.customSection?.title || 'قسم إضافي');
    updateText('customSection.subtitle', appData.customSection?.subtitle || 'وصف القسم الإضافي');
    
    if(appData.customSection && appData.customSection.items) {
        const customHtml = appData.customSection.items.map((item, i) => `
            <div class="group relative bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm">
                ${isAdmin ? `<button onclick="deleteItem('customSection.items', ${i})" class="absolute top-2 left-2 text-red-500 opacity-0 group-hover:opacity-100">×</button>` : ''}
                <h4 class="font-bold">${item.title}</h4>
                <p class="text-sm text-gray-500">${item.desc}</p>
            </div>
        `).join('');
        document.getElementById('custom-container').innerHTML = customHtml;
    }
}

// --- 3. CRUD Operations (Add, Edit, Delete) ---

// A. Edit Image
async function editImage(key) {
    if(!isAdmin) return;
    const { value: url } = await Swal.fire({
        input: 'url',
        inputLabel: 'رابط الصورة الجديد',
        inputPlaceholder: 'https://...'
    });
    if (url) {
        setDeepValue(appData, key, url);
        renderAll();
    }
}

// B. Edit Simple Text
function updateText(key, value) {
    const el = document.querySelector(`[data-key="${key}"]`);
    if(el) {
        el.innerText = value;
        if(isAdmin) {
            el.contentEditable = "true";
            el.classList.add('editable-highlight');
            el.onblur = () => setDeepValue(appData, key, el.innerText);
        }
    }
}

// C. Add New Item (Universal)
async function addItem(type) {
    if(type === 'skills') {
        const { value: skill } = await Swal.fire({ input: 'text', title: 'أضف مهارة جديدة' });
        if(skill) appData.skills.push(skill);
    } 
    else if (type === 'experience') {
        // Form for Object
        const { value: formValues } = await Swal.fire({
            title: 'إضافة خبرة',
            html: 
                '<input id="swal-role" class="swal2-input" placeholder="المسمى الوظيفي">' +
                '<input id="swal-company" class="swal2-input" placeholder="الشركة">' +
                '<input id="swal-period" class="swal2-input" placeholder="الفترة">' +
                '<textarea id="swal-desc" class="swal2-textarea" placeholder="الوصف"></textarea>',
            focusConfirm: false,
            preConfirm: () => {
                return {
                    role: document.getElementById('swal-role').value,
                    company: document.getElementById('swal-company').value,
                    period: document.getElementById('swal-period').value,
                    description: document.getElementById('swal-desc').value
                }
            }
        });
        if(formValues) appData.experience.push(formValues);
    }
    else if (type === 'projects') {
        const { value: formValues } = await Swal.fire({
            title: 'إضافة مشروع',
            html: 
                '<input id="swal-title" class="swal2-input" placeholder="اسم المشروع">' +
                '<input id="swal-link" class="swal2-input" placeholder="رابط المشروع">' +
                '<textarea id="swal-desc" class="swal2-textarea" placeholder="وصف المشروع"></textarea>',
            preConfirm: () => {
                return {
                    title: document.getElementById('swal-title').value,
                    link: document.getElementById('swal-link').value,
                    desc: document.getElementById('swal-desc').value
                }
            }
        });
        if(formValues) appData.projects.push(formValues);
    }
    else if (type === 'customSection.items') {
        const { value: formValues } = await Swal.fire({
            title: 'عنصر جديد',
            html: '<input id="swal-title" class="swal2-input" placeholder="العنوان"><input id="swal-desc" class="swal2-input" placeholder="التفاصيل">',
            preConfirm: () => ({ title: document.getElementById('swal-title').value, desc: document.getElementById('swal-desc').value })
        });
        if(formValues) {
            if(!appData.customSection) appData.customSection = { title: "عنوان", items: [] };
            appData.customSection.items.push(formValues);
        }
    }
    renderAll();
}

// D. Delete Item
function deleteItem(type, index) {
    Swal.fire({
        title: 'هل أنت متأكد؟',
        text: "لن تتمكن من التراجع عن الحذف!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'نعم، احذف!'
    }).then((result) => {
        if (result.isConfirmed) {
            const arr = getDeepValue(appData, type);
            if(Array.isArray(arr)) {
                arr.splice(index, 1);
                renderAll();
            }
        }
    })
}

// --- 4. Admin & Auth Logic ---
async function toggleAdminLogin() {
    if(isAdmin) return;
    const { value: formValues } = await Swal.fire({
        title: 'تسجيل دخول المالك',
        html: '<input id="swal-repo" class="swal2-input" placeholder="User/Repo"><input id="swal-token" class="swal2-input" type="password" placeholder="Token">',
        focusConfirm: false,
        preConfirm: () => [document.getElementById('swal-repo').value, document.getElementById('swal-token').value]
    });

    if (formValues) {
        const [repo, token] = formValues;
        if(repo && token) {
            localStorage.setItem('gh_repo', repo);
            localStorage.setItem('gh_token', token);
            githubInfo.repo = repo; githubInfo.token = token;
            enableAdminMode();
            Swal.fire('تم الدخول', 'وضع التعديل مفعل الآن', 'success');
        }
    }
}

function enableAdminMode() {
    isAdmin = true;
    document.getElementById('admin-toolbar').classList.remove('hidden');
    document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    renderAll(); // Re-render to add edit buttons
}

function logout() {
    localStorage.clear();
    location.reload();
}

async function saveChanges() {
    const btn = document.querySelector('#admin-toolbar button');
    const oldText = btn.innerHTML;
    btn.innerHTML = 'جاري الرفع...';
    
    try {
        const fileUrl = `https://api.github.com/repos/${githubInfo.repo}/contents/data.json`;
        const getRes = await fetch(fileUrl, { headers: { 'Authorization': `token ${githubInfo.token}` } });
        const fileData = await getRes.json();
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(appData, null, 2))));
        
        await fetch(fileUrl, {
            method: 'PUT',
            headers: { 'Authorization': `token ${githubInfo.token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Update Content via Dashboard", content: content, sha: fileData.sha })
        });
        
        Swal.fire('نجاح!', 'تم حفظ جميع التعديلات في GitHub', 'success');
    } catch(e) {
        Swal.fire('خطأ', e.message, 'error');
    } finally {
        btn.innerHTML = oldText;
    }
}

// --- Helpers ---
function getDeepValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
}
function setDeepValue(obj, path, value) {
    const keys = path.split('.');
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
