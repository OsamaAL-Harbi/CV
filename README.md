<div align="center">

# 🌐 أسامة الحربي — الموقع الشخصي

**موقع شخصي ثنائي اللغة (عربي / إنجليزي)، مبني بـ JavaScript خالص ومنشور على GitHub Pages**

[![Portfolio](https://img.shields.io/badge/Portfolio-Live-2563eb?style=for-the-badge&logo=github)](https://osamaal-harbi.github.io/CV/)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

[🔗 عرض الموقع](https://osamaal-harbi.github.io/CV/) • [📄 السيرة الذاتية (PDF)](./Osama_Alharbi.pdf)

</div>

---

## 📋 نظرة عامة

موقع Portfolio بصفحة واحدة (SPA) بلا إطار عمل ولا خادم. كل المحتوى محفوظ في ملف واحد هو `data.json`،
والموقع يقرؤه ويعرضه باللغتين، مع دعم الوضع الليلي والعمل دون اتصال.

---

## ✨ المزايا

| الميزة | الوصف |
|--------|-------|
| 🌐 **ثنائي اللغة** | عربي (RTL) وإنجليزي (LTR) مع حفظ التفضيل |
| 🌙 **الوضع الليلي** | يتبع إعداد النظام تلقائياً |
| 📱 **PWA** | قابل للتثبيت ويعمل دون اتصال بعد الزيارة الأولى |
| 📄 **السيرة الذاتية** | تحميل PDF مباشر وتنسيق مخصص للطباعة |
| 🗂️ **المشاريع** | تصفية حسب التقنية ونافذة تفاصيل لكل مشروع |
| ⌨️ **لوحة الأوامر** | `Ctrl + K` للتنقل السريع |
| ♿ **سهولة الوصول** | تباين ألوان AA واحترام إعداد "تقليل الحركة" |
| 🔒 **الأمان** | سياسة CSP صارمة، وSRI لملفات CDN، وتهريب كل المحتوى المعروض |

---

## 🗂️ هيكل المشروع

```
CV/
├── index.html        # الصفحة الرئيسية (SPA)
├── script.js         # نقطة الدخول
├── data.json         # مصدر كل المحتوى
├── sw.js             # Service Worker للعمل دون اتصال
├── manifest.json     # إعدادات PWA
├── js/               # وحدات الواجهة (العرض، التنقل، اللغات…)
├── assets/           # الأنماط المولّدة، الخطوط، الأيقونات، الصور
├── src/tailwind.css  # مصدر الأنماط
├── scripts/          # سكربتات التطوير والبناء
└── tests/            # اختبارات Playwright
```

> الموقع لا يحتاج إلى خطوة build ليعمل؛ `package.json` مخصص لأدوات التطوير فقط.

---

## 🚀 التشغيل محلياً

```bash
git clone https://github.com/OsamaAL-Harbi/CV.git
cd CV
npm ci
npm start      # http://localhost:4173/CV/
```

> ⚠️ لا تفتح `index.html` مباشرة من الملفات (`file://`)، فالمتصفح يمنع تحميل البيانات والـ Service Worker.

**الأنماط:** ملف `assets/css/tailwind.css` مولَّد تلقائياً. بعد تعديل أي class شغّل:

```bash
npm run build:css
```

**الاختبارات:**

```bash
npx playwright install chromium   # مرة واحدة
npm test
```

---

## 📝 تحديث المحتوى

كل المحتوى في `data.json`، وكل نص فيه باللغتين:

```json
{
  "profile":    { "name": { "ar": "...", "en": "..." }, "cv": "Osama_Alharbi.pdf" },
  "experience": [ { "role": { "ar": "...", "en": "..." }, "period": { "ar": "...", "en": "..." } } ],
  "skills":     [ { "ar": "...", "en": "...", "level": 85, "category": "hard" } ],
  "projects":   [ { "title": { "ar": "...", "en": "..." }, "technologies": ["SQL"], "link": "https://..." } ]
}
```

- الروابط لا تُعرض إلا إذا بدأت بـ `https://`.
- `level` من `0` إلى `100`، و`category` إما `"hard"` أو `"soft"`.
- النصوص تُعرض كنص عادي، ولا يُفسَّر أي HTML بداخلها.

---

## 🌍 النشر

**Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**

---

## 📜 الإسناد

- الأيقونات: [Font Awesome Free](https://fontawesome.com) — CC BY 4.0
- الخط: [Tajawal](https://fonts.google.com/specimen/Tajawal) — SIL OFL 1.1

---

## 👤 التواصل

- 💼 [LinkedIn](https://www.linkedin.com/in/osama-al-harbi)
- 🐙 [GitHub](https://github.com/OsamaAL-Harbi)
- 🌐 [الموقع الشخصي](https://osamaal-harbi.github.io/CV/)

<div align="center">

&copy; 2026 Osama Al-Harbi

</div>
