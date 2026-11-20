// Kinds of blog post (admin → Blog → «النوع»): a plain article, a hands-on networking lab, an IT support case, or a
// digital-transformation project write-up. Each kind has a label, an icon and a Markdown template the editor fills in
// when a new post of that kind is started. Shared by the site, the admin editor and the deploy (scripts/pages.mjs).
export const POST_KINDS = {
    article: { ar: 'مقال',           en: 'Article',                 icon: 'fa-newspaper' },
    lab:     { ar: 'مختبر عملي',      en: 'Hands-on lab',            icon: 'fa-network-wired' },
    case:    { ar: 'حالة دعم فني',    en: 'Support case',            icon: 'fa-headset' },
    project: { ar: 'مشروع تحول رقمي', en: 'Transformation project',  icon: 'fa-chart-line' }
};
export const postKind = post => (Object.hasOwn(POST_KINDS, post?.kind) ? post.kind : 'article');

export const POST_TEMPLATES = {
    lab: {
        ar: `## الهدف
ماذا أردت أن أبني أو أختبر؟

## البيئة والأدوات
- Cisco Packet Tracer (أو GNS3)
- عدد الأجهزة: …

## المخطط
![مخطط الشبكة](images/posts/…)

## الإعدادات
\`\`\`
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
\`\`\`

## الاختبار والنتيجة
- \`ping\` بين الشبكات…

## ما تعلمته
`,
        en: `## Goal
What I set out to build or test.

## Environment and tools
- Cisco Packet Tracer (or GNS3)
- Devices: …

## Topology
![Network diagram](images/posts/…)

## Configuration
\`\`\`
interface vlan 10
 ip address 192.168.10.1 255.255.255.0
\`\`\`

## Testing and result
- \`ping\` between the networks…

## What I learned
`
    },
    case: {
        ar: `## المشكلة
ما الذي أبلغ عنه المستخدم؟ (دون أسماء أو بيانات حساسة)

## التشخيص
1. …

## الحل
…

## النتيجة والوقت المستغرق
- زمن الحل: …

## الوقاية مستقبلاً
`,
        en: `## The problem
What the user reported (no names or sensitive data).

## Diagnosis
1. …

## Fix
…

## Result and time to resolve
- Resolved in: …

## Preventing it next time
`
    },
    project: {
        ar: `## السياق
الجهة ودوري في المشروع.

## المشكلة أو الفرصة
…

## ما قمت به
- …

## الأدوات والمعايير
- مثل معايير هيئة الحكومة الرقمية ومستهدفات رؤية 2030

## الأثر والنتائج
- …
`,
        en: `## Context
The organisation and my role.

## Problem or opportunity
…

## What I did
- …

## Tools and standards
- e.g. Digital Government Authority standards, Vision 2030 targets

## Impact and results
- …
`
    }
};
