# 🌐 Osama Al-Harbi — Portfolio Website

<div align="center">

![Portfolio](https://img.shields.io/badge/Portfolio-Live-3b82f6?style=for-the-badge&logo=github-pages)
![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

**موقع شخصي متكامل ثنائي اللغة (عربي / إنجليزي) مع لوحة تحكم إدارية**

[🔗 عرض الموقع](#) • [📄 تحميل السيرة الذاتية](./Osama_Alharbi_IT_CV.pdf) • [📬 تواصل](mailto:osamafcv214@gmail.com)

</div>

---

## 📋 نظرة عامة

موقع Portfolio احترافي مبني بتقنية **Single Page Application (SPA)** خالص بدون أي إطار عمل. جميع البيانات محفوظة في ملف `data.json` مركزي مما يجعل التحديث فورياً على كل أقسام الموقع. يدعم الوضع الليلي، وتغيير اللغة، وتحميل السيرة الذاتية مباشرة، ولوحة تحكم إدارية متكاملة.

---

## 🗂️ هيكل المشروع

```
portfolio/
├── index.html                  # الصفحة الرئيسية (SPA)
├── script.js                   # المنطق البرمجي الكامل
├── data.json                   # مصدر بيانات الموقع
├── Osama_Alharbi_IT_CV.pdf     # السيرة الذاتية للتحميل
├── sw.js                       # Service Worker (PWA)
├── manifest.json               # إعدادات تطبيق PWA
├── admin/
│   ├── index.html              # واجهة Decap CMS
│   └── config.yml              # مخطط حقول لوحة التحكم
├── images/
│   └── .gitkeep                # مجلد الصور
└── assets/                     # أيقونات PWA (اختياري)
    ├── icon-192.png
    └── icon-512.png
```

---

## ✨ المزايا

### الموقع العام
| الميزة | الوصف |
|--------|-------|
| 🌐 **ثنائي اللغة** | دعم كامل للعربية (RTL) والإنجليزية (LTR) مع حفظ التفضيل |
| 🌙 **الوضع الليلي** | Dark / Light mode مع اكتشاف تفضيل النظام تلقائياً |
| 📱 **PWA** | قابل للتثبيت كتطبيق على الجوال مع دعم offline |
| 📄 **تحميل PDF** | تحميل مباشر للسيرة الذاتية بنقرة واحدة |
| 🖨️ **وضع الطباعة** | CSS مخصص يُظهر السيرة الذاتية بتنسيق احترافي عند الطباعة |
| 🔗 **مشاركة الملف الشخصي** | Web Share API + نسخ الرابط للحافظة تلقائياً |
| 🎯 **إحصائيات متحركة** | Counter animation لأرقام الإنجازات عند الظهور |
| 📊 **أشرطة المهارات** | Progress bars بنسب مئوية مع تصنيف تقنية / شخصية |
| 🗂️ **تفاصيل المشاريع** | Modal window بالتحديات والنتائج والتقنيات المستخدمة |
| 👁️ **عداد المشاهدات** | تتبع مشاهدات المشاريع في الجلسة الحالية |
| 💼 **رسالة LinkedIn** | ترحيب مخصص للزائر القادم من LinkedIn |
| ⌨️ **Command Palette** | بحث وتنقل سريع بـ Ctrl+K |
| 🎮 **Konami Code** | Easter egg مخفي ↑↑↓↓←→←→BA |

### لوحة التحكم الإدارية
| الميزة | الوصف |
|--------|-------|
| ✏️ **تعديل مباشر** | تعديل النصوص inline بالضغط المباشر عليها |
| ➕ **إضافة / حذف** | CRUD كامل لكل الأقسام عبر نوافذ SweetAlert2 |
| ↕️ **ترتيب بالسحب** | Drag & Drop لإعادة ترتيب العناصر عبر SortableJS |
| 💾 **حفظ على GitHub** | رفع التغييرات مباشرة إلى `data.json` في الريبو |
| 🔄 **نسخة احتياطية** | حفظ واسترجاع النسخة الأخيرة في localStorage |
| ⏱️ **جلسة آمنة** | انتهاء الجلسة تلقائياً بعد ساعة واحدة |
| 📷 **تغيير الصورة** | تحديث الصورة الشخصية برابط خارجي |

---

## 🛠️ التقنيات المستخدمة

```
Frontend         → HTML5 · Vanilla JavaScript · Tailwind CSS (CDN)
Fonts            → Google Fonts: Tajawal (AR) + Roboto (EN)
Animations       → AOS.js · Particles.js · CSS Keyframes
UI Components    → SweetAlert2 · Toastify.js
Drag & Drop      → SortableJS
PDF Generation   → jsPDF · html2canvas
PWA              → Service Worker · Web App Manifest
CMS              → Decap CMS (Netlify) + Git Gateway
Analytics        → Google Analytics 4
Hosting          → GitHub Pages / Netlify
```

---

## 🚀 التشغيل والنشر

### محلياً
```bash
# 1. استنساخ الريبو
git clone https://github.com/OsamaAL-Harbi/portfolio.git
cd portfolio

# 2. فتح الموقع (لا يحتاج npm أو build)
# استخدم Live Server في VS Code أو أي خادم محلي
npx serve .
# ثم افتح http://localhost:3000
```

> ⚠️ **ملاحظة:** Service Worker يعمل فقط على `https://` أو `localhost`. على `file://` لن يتفعل.

### على GitHub Pages
```bash
# 1. ارفع جميع الملفات إلى الريبو
git add .
git commit -m "Initial portfolio deploy"
git push origin main

# 2. في إعدادات الريبو:
#    Settings → Pages → Branch: main → / (root) → Save
```

### على Netlify (مع لوحة التحكم)
```bash
# 1. ربط الريبو بـ Netlify عبر واجهة الموقع
# 2. تفعيل Netlify Identity:
#    Site settings → Identity → Enable Identity
#    Registration → Invite only
# 3. تفعيل Git Gateway:
#    Identity → Services → Git Gateway → Enable
# 4. دعوة نفسك عبر البريد الإلكتروني
```

---

## 📝 تحديث البيانات

### الطريقة الأولى: تعديل مباشر في الكود
افتح `data.json` وعدّل أي حقل. البنية:

```json
{
  "profile": { "name": {"ar": "...", "en": "..."}, ... },
  "experience": [ { "role": {"ar": "...", "en": "..."}, ... } ],
  "skills": [ { "ar": "...", "en": "...", "level": 85, "category": "hard" } ],
  "projects": [ { "title": {...}, "technologies": [...], "details": {...} } ],
  "certificates": [...],
  "education": [...],
  "volunteer": [...],
  "workshops": [...],
  "languages": [...]
}
```

### الطريقة الثانية: لوحة التحكم الإدارية
1. أدخل `Username/Repo` بهذا الشكل: `OsamaAL-Harbi/portfolio`
2. أدخل GitHub Personal Access Token (صلاحية `repo`)
3. اضغط **Login** — ستظهر أدوات التحكم على الصفحة
4. عدّل ما تريد ثم اضغط **حفظ** لرفع التغييرات مباشرة

### الطريقة الثالثة: Decap CMS (على Netlify)
افتح `https://your-site.netlify.app/admin/` وسجّل الدخول بحسابك.

---

## 🔑 إنشاء GitHub Token

1. اذهب إلى [github.com/settings/tokens](https://github.com/settings/tokens)
2. **Generate new token (classic)**
3. حدّد صلاحية `repo` فقط
4. انسخ التوكن واحفظه — لن يظهر مرة أخرى

---

## 📐 إضافة مشروع جديد

في `data.json` داخل مصفوفة `projects`:

```json
{
  "title": {
    "ar": "اسم المشروع بالعربية",
    "en": "Project Name in English"
  },
  "desc": {
    "ar": "وصف مختصر بالعربية",
    "en": "Short description in English"
  },
  "technologies": ["SQL", "Python", "HTML5"],
  "details": {
    "challenges": {
      "ar": "التحديات التي واجهتها...",
      "en": "Challenges faced..."
    },
    "results": {
      "ar": "النتائج والإنجازات...",
      "en": "Results and achievements..."
    }
  },
  "link": "https://github.com/your-repo"
}
```

---

## 📐 إضافة مهارة جديدة

```json
{
  "ar": "اسم المهارة",
  "en": "Skill Name",
  "level": 80,
  "category": "hard"
}
```

- `level`: من `0` إلى `100`
- `category`: `"hard"` للمهارات التقنية · `"soft"` للمهارات الشخصية

---

## 🎨 التخصيص

### تغيير الألوان الرئيسية
في `index.html` داخل `tailwind.config`:
```javascript
colors: {
  primary:   '#3b82f6',  // الأزرق الرئيسي
  secondary: '#8b5cf6',  // البنفسجي الثانوي
  darkBg:    '#0b1120',  // خلفية الوضع الليلي
  cardBg:    '#1e293b'   // خلفية البطاقات
}
```

### تغيير رابط Formspree (نموذج التواصل)
في `script.js`:
```javascript
const FORMSPREE_ENDPOINT = "https://formspree.io/f/YOUR_FORM_ID";
```

---

## 📦 الملفات المطلوبة للنشر

| الملف | مطلوب؟ | الوصف |
|-------|---------|-------|
| `index.html` | ✅ | |
| `script.js` | ✅ | |
| `data.json` | ✅ | |
| `Osama_Alharbi_IT_CV.pdf` | ✅ | |
| `sw.js` | ✅ | لدعم PWA |
| `manifest.json` | ✅ | لدعم PWA |
| `admin/` | ⚡ | فقط إذا تستخدم Netlify CMS |
| `assets/` | ⚡ | اختياري — للأيقونات |

---

## 🐛 حل المشكلات الشائعة

**data.json لا يُحمَّل:**
```
→ تأكد أن الملف في نفس مجلد index.html
→ على file:// المتصفح يحجب fetch() — استخدم خادماً محلياً
```

**Service Worker لا يعمل:**
```
→ يتطلب https:// أو localhost فقط
→ لمسح الكاش: DevTools → Application → Storage → Clear site data
```

**زر الحفظ في Admin لا يعمل:**
```
→ تأكد من صلاحية repo في GitHub Token
→ تأكد من صحة Username/Repo (حساسية الحروف)
→ تأكد أن الفرع main وليس master
```

**الـ PDF لا يظهر بشكل صحيح:**
```
→ الملف يجب أن يكون في نفس مجلد index.html تماماً
→ اسم الملف: Osama_Alharbi_IT_CV.pdf (حساسية الحروف)
```

---

## 📊 بنية script.js

| القسم | الوظيفة |
|-------|---------|
| `GLOBALS` | المتغيرات العامة والإعدادات |
| `BOOT` | تهيئة الموقع عند التحميل |
| `NAVIGATION` | نظام التنقل بين الصفحات SPA |
| `LOCALISATION` | نظام اللغات AR/EN |
| `DATA LOADING` | تحميل data.json |
| `RENDER ENGINE` | رسم جميع الأقسام |
| `SKILL PROGRESS BARS` | أشرطة المهارات المتحركة |
| `STATS COUNTER` | عداد الإحصائيات |
| `PROJECT MODAL` | نافذة تفاصيل المشروع |
| `PDF GENERATION` | توليد PDF |
| `PRINT MODE` | وضع الطباعة |
| `SHARE PROFILE` | مشاركة الموقع |
| `LINKEDIN REFERRER` | رسالة LinkedIn |
| `ADMIN CRUD` | نظام الإضافة والتعديل والحذف |
| `DRAG & DROP` | ترتيب العناصر |
| `AUTH & GITHUB SYNC` | المصادقة والحفظ على GitHub |

---

## 👤 صاحب المشروع

**أسامة عبدالعزيز الحربي**

- 📧 [osamafcv214@gmail.com](mailto:osamafcv214@gmail.com)
- 💼 [LinkedIn](https://www.linkedin.com/in/osama-al-harbi)
- 🐙 [GitHub](https://github.com/OsamaAL-Harbi)
- 📍 المدينة المنورة، المملكة العربية السعودية

---

<div align="center">

بُني بـ ❤️ وكود — &copy; 2026 Osama Al-Harbi

</div>
