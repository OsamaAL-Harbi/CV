# 🌐 Osama Al-Harbi — Portfolio Website

<div align="center">

![Portfolio](https://img.shields.io/badge/Portfolio-Live-2563eb?style=for-the-badge&logo=github-pages)
![HTML](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)

**موقع شخصي ثنائي اللغة (عربي / إنجليزي) مع لوحة تحرير مدمجة — ثابت بالكامل على GitHub Pages**

[🔗 عرض الموقع](https://osamaal-harbi.github.io/CV/) • [📄 تحميل السيرة الذاتية](./Osama_Alharbi.pdf) • [📬 تواصل](mailto:osamafcv214@gmail.com)

</div>

---

## 📋 نظرة عامة

موقع Portfolio مبني كـ **Single Page Application** بـ JavaScript خالص (ES modules) بلا إطار عمل ولا خادم.
كل المحتوى في ملف واحد هو `data.json`، والموقع يقرأه ويعرضه باللغتين. يدعم الوضع الليلي، والعمل دون اتصال (PWA)،
ولوحة تحرير تحفظ التعديلات مباشرة في المستودع عبر GitHub API.

---

## 🗂️ هيكل المشروع

```
CV/
├── index.html                # الصفحة الوحيدة (SPA) + سياسة CSP
├── script.js                 # نقطة الدخول (type="module"): تشغيل الصفحة وتحميل data.json
├── data.json                 # مصدر كل المحتوى
├── Osama_Alharbi.pdf         # السيرة الذاتية للتحميل
├── sw.js                     # Service Worker (الكاش والعمل دون اتصال)
├── offline.html              # صفحة "أنت غير متصل"
├── manifest.json             # إعدادات PWA (أيقونات، اختصارات، لقطات شاشة)
├── robots.txt · sitemap.xml
├── js/
│   ├── state.js              # الحالة المشتركة (البيانات، اللغة، وضع المدير…)
│   ├── utils.js              # escapeHTML / safeUrl / الإشعارات / تحميل المكتبات عند الحاجة مع SRI
│   ├── i18n.js               # النصوص الثابتة والتبديل بين RTL و LTR
│   ├── router.js             # التنقل بالـ hash ووسوم SEO لكل قسم
│   ├── render.js             # عرض الأقسام من data.json
│   ├── modal.js              # نافذة تفاصيل المشروع
│   ├── ui.js                 # الوضع الليلي، الخلفية، لوحة الأوامر، المشاركة، التواصل، PDF
│   ├── actions.js            # معالج واحد لكل أزرار data-action (بلا onclick داخل HTML)
│   ├── admin.js              # لوحة الإدارة — تُحمَّل فقط بعد تسجيل الدخول
│   ├── early.js              # يطبّق الوضع الليلي واتجاه اللغة قبل أول رسم
│   └── analytics.js          # Google Analytics 4 + Microsoft Clarity بعد اكتمال التحميل
├── assets/
│   ├── css/tailwind.css      # ملف مولَّد — لا تعدّله يدوياً (انظر "الأنماط")
│   ├── fonts/                # خط Tajawal (OFL) مستضاف محلياً
│   ├── icons/                # favicon وأيقونات PWA (any + maskable)
│   ├── img/                  # الصورة الافتراضية، صورة المشاركة og-image، لقطات الشاشة
│   └── vendor/aos.js         # منسوخ من حزمة aos@2.3.1 عند البناء
├── images/                   # صورك الخاصة (مثل الصورة الشخصية)
├── src/tailwind.css          # مصدر الأنماط (Tailwind + الأنماط المخصصة)
├── tailwind.config.js
├── scripts/
│   ├── serve.mjs             # خادم محلي يحاكي GitHub Pages تحت /CV/
│   ├── build-vendor.mjs      # يولّد الأيقونات والخطوط وينسخ aos.js
│   ├── check-sri.mjs         # يتحقق أن كل ملف CDN مثبّت الإصدار ومطابق لبصمة SRI
│   ├── mirror-cdn.mjs        # نسخة محلية من ملفات CDN لتشغيل الاختبارات دون إنترنت
│   └── cdn-assets.mjs        # قائمة ملفات CDN (مشتركة بين السكربتين السابقين)
├── tests/                    # اختبارات Playwright
├── lighthouserc.json         # حدود Lighthouse CI (≥ 90 في الأقسام الأربعة)
├── .github/workflows/ci.yml  # الاختبارات + Lighthouse على كل Pull Request
└── package.json              # أدوات التطوير فقط — الموقع نفسه لا يحتاج build ليعمل
```

> الملفات المنشورة جاهزة كما هي: GitHub Pages يخدم المستودع مباشرةً، و`package.json` مخصص لأدوات التطوير فقط.

---

## ✨ المزايا

| الميزة | الوصف |
|--------|-------|
| 🌐 **ثنائي اللغة** | عربي (RTL) وإنجليزي (LTR) مع حفظ التفضيل |
| 🌙 **الوضع الليلي** | يتبع إعداد النظام تلقائياً ويُحفظ اختيارك |
| 📱 **PWA** | قابل للتثبيت، ويعمل دون اتصال بعد الزيارة الأولى |
| 📄 **السيرة الذاتية** | تحميل PDF مباشر، أو توليد PDF من صفحة السيرة (Ctrl+K) |
| 🖨️ **الطباعة** | تنسيق طباعة مخصص لصفحة السيرة |
| 🗂️ **المشاريع** | تصفية حسب التقنية ونافذة تفاصيل (التحديات والنتائج) |
| ⌨️ **لوحة الأوامر** | Ctrl+K للتنقل والأوامر السريعة |
| ♿ **سهولة الوصول** | أسماء للأزرار، تباين ألوان AA، احترام إعداد "تقليل الحركة" |
| 🔒 **الأمان** | CSP صارمة، SRI لكل ملف CDN، تهريب كل بيانات data.json |

---

## 🚀 التشغيل محلياً

الموقع يعمل تحت المسار الفرعي `/CV/` كما على GitHub Pages، فاختبره بالطريقة نفسها:

```bash
git clone https://github.com/OsamaAL-Harbi/CV.git
cd CV
npm ci          # أدوات التطوير (مرة واحدة)
npm start       # http://localhost:4173/CV/
```

بدون Node.js: شغّل خادماً من المجلد **الأب** حتى يظهر المسار `/CV/`:

```bash
cd ..                       # المجلد الذي يحتوي مجلد CV
python3 -m http.server 8000 # ثم افتح http://localhost:8000/CV/
```

> ⚠️ لا تفتح `index.html` مباشرة (`file://`): المتصفح يمنع تحميل `data.json` والـ modules والـ Service Worker.

### الأنماط (Tailwind)

`assets/css/tailwind.css` ملف مولَّد. بعد تعديل أي class في `index.html` أو `js/`، أو أي شيء في `src/tailwind.css`:

```bash
npm run build:css    # أو npm run watch:css أثناء التطوير
```

السكربت يولّد أيضاً الأيقونات المستخدمة (Font Awesome كـ SVG داخل CSS) وملفات خط Tajawal و`assets/vendor/aos.js`.
إذا أضفت أيقونة جديدة `fa-…` فسيلتقطها البناء تلقائياً. الـ CI يفشل إذا نسيت إعادة البناء.

### الاختبارات

```bash
npx playwright install chromium   # مرة واحدة
npm test                          # Playwright: سطح المكتب + الجوال
npm run check:sri                 # كل ملف CDN مثبّت الإصدار ومطابق لبصمة SRI
npm run lhci                      # Lighthouse CI (Chrome مطلوب)
```

بيئة بلا إنترنت أو تحجب الـ CDN؟ `npm run mirror:cdn` ثم `CDN_MIRROR_DIR=.cdn-mirror npm test`.

---

## 📝 تحديث المحتوى

### 1) تعديل `data.json` مباشرة

```json
{
  "profile": { "name": {"ar": "...", "en": "..."}, "cv": "Osama_Alharbi.pdf", "linkedin": "https://...", ... },
  "experience":   [ { "role": {"ar": "...", "en": "..."}, "company": {...}, "period": {...}, "description": {...} } ],
  "skills":       [ { "ar": "...", "en": "...", "level": 85, "category": "hard" } ],
  "projects":     [ { "title": {...}, "desc": {...}, "technologies": ["SQL"], "link": "https://github.com/...", "liveUrl": "" } ],
  "certificates": [...], "education": [...], "volunteer": [...], "workshops": [...], "languages": [...]
}
```

- الروابط (`link`, `liveUrl`, `linkedin`, `github`) تُعرض **فقط** إذا بدأت بـ `https://`.
- `level` رقم من `0` إلى `100`، و`category` إما `"hard"` (تقنية) أو `"soft"` (شخصية).
- `profile.image` رابط `https://` أو مسار داخل الموقع مثل `images/me.jpg`؛ إن كان فارغاً تظهر صورة افتراضية.
- `profile.cv` اسم ملف الـ PDF الذي تشير إليه كل أزرار التحميل.
- النصوص تُعرض كنص عادي (لا يُفسَّر HTML داخلها).

### 2) لوحة الإدارة (داخل الموقع)

1. انقر **ثلاث مرات** على نص الحقوق أسفل الصفحة.
2. أدخل المستودع `OsamaAL-Harbi/CV` و **Fine-grained token** (انظر القسم التالي).
3. عدّل مباشرة (النصوص، الإضافة، الحذف، السحب لإعادة الترتيب)، ثم **حفظ** لرفع `data.json` إلى الفرع الافتراضي.
4. التغيير يظهر للزوار بعد إعادة بناء GitHub Pages (عادة دقيقة إلى بضع دقائق).
5. "استرجاع" يتراجع عن التعديلات غير المحفوظة إلى آخر نسخة محمّلة/محفوظة.

---

## 🔑 استخدام لوحة الإدارة بأمان

**أنشئ Fine-grained Personal Access Token (وليس Classic):**

1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**
2. **Expiration**: مدة قصيرة (7 أيام مثلاً).
3. **Repository access**: *Only select repositories* ← `OsamaAL-Harbi/CV` فقط.
4. **Permissions → Repository permissions → Contents: Read and write** (و *Metadata: Read* تُضاف تلقائياً). لا شيء غير ذلك.
5. انسخ التوكن والصقه في نافذة الدخول.

**كيف يُحفظ التوكن؟**
- في `sessionStorage` لهذا التبويب فقط — يُمسح عند إغلاق التبويب، أو تسجيل الخروج، أو بعد **ساعة** تلقائياً.
- لا يُكتب في `localStorage` ولا في الكود ولا يُرسل لأي جهة غير `api.github.com`.
- عند فتح الموقع تُحذف أي بقايا قديمة (`saved_token`, `backup_data`) من `localStorage`.

**نصائح:** استخدم اللوحة من جهازك الشخصي فقط، وألغِ التوكن (Revoke) من إعدادات GitHub بعد الانتهاء إن لم تعد تحتاجه.

---

## 🔒 ملاحظات أمنية للمطوّر

- **CSP** موجودة في `<meta>` داخل `index.html` وتسمح فقط بـ: الموقع نفسه، `cdn.jsdelivr.net` (مكتبات تُحمّل عند الحاجة)،
  `api.github.com`، وخدمات GA4/Clarity. لا يوجد `'unsafe-inline'` للسكربتات أو الأنماط (البصمة الوحيدة المسموحة هي
  أنماط html2canvas الثابتة عند توليد PDF).
- لا تضف `onclick="…"` أو `<script>` داخل HTML: استخدم `data-action="…"` وأضف الدالة في `js/actions.js`.
- أي قيمة من `data.json` تُدرج في HTML يجب أن تمر عبر `escapeHTML()`، وأي رابط عبر `safeUrl()`.
- **إضافة مكتبة من CDN**: ثبّت الإصدار الكامل (`name@1.2.3/path`)، أضفها إلى `VENDOR` في `js/utils.js` مع `integrity`،
  ثم شغّل `npm run check:sri` (يحسب البصمة الصحيحة ويرفض أي ملف غير مثبّت).
- GitHub Pages لا يسمح بترويسات HTTP مخصصة، لذلك `frame-ancestors` و`X-Content-Type-Options` غير ممكنة هنا.

---

## 🌍 النشر على GitHub Pages

**Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**. ملف `.nojekyll` موجود لتقديم الملفات كما هي.

> `robots.txt` لا تقرؤه محركات البحث إلا من جذر النطاق (`osamaal-harbi.github.io/robots.txt`)؛ لذلك أضف
> `https://osamaal-harbi.github.io/CV/sitemap.xml` يدوياً في Google Search Console.

---

## 🐛 حل المشكلات الشائعة

| المشكلة | الحل |
|---------|------|
| الصفحة لا تُحمّل البيانات | شغّل خادماً محلياً (لا `file://`) وتحقق من صحة `data.json` (JSON صالح). |
| الأنماط لا تظهر لـ class جديد | `npm run build:css` |
| لا أرى آخر تعديل بعد النشر | انتظر انتهاء بناء Pages، ثم أعد التحميل (الـ Service Worker يجلب النسخة الأحدث عند الاتصال). |
| مسح كاش الـ Service Worker | DevTools → Application → Storage → Clear site data |
| الحفظ من لوحة الإدارة يفشل | تحقق من صلاحية **Contents: Read and write** ومن أن التوكن لم تنتهِ مدته وأنه مقيّد بالمستودع الصحيح. |

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
<br><sub>الأيقونات: Font Awesome Free (CC BY 4.0) · الخط: Tajawal (SIL OFL 1.1)</sub>

</div>
