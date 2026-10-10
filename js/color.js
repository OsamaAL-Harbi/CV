// Site colours: the admin picks a primary and a secondary colour; this module derives the light- and
// dark-mode variants that meet WCAG contrast, keeping the chosen hue and saturation and changing
// lightness as little as possible. Used by the admin theme page, script.js (applies data.json → theme) and js/early.js
// (a cached copy, so a custom theme shows from the first paint).
import { local } from './storage.js';

export const DEFAULT_THEME = { primary: '#2563eb', secondary: '#8b5cf6' };

// Surfaces the colours are read against (see tailwind.config.js and body classes in index.html)
const WHITE = '#ffffff', PAGE_LIGHT = '#f9fafb', PAGE_DARK = '#0b1120', CARD_DARK = '#1e293b';

export const isHex = v => /^#[0-9a-f]{6}$/i.test(String(v || ''));

export function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
    return `#${[r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
    if (max === min) return [0, 0, l * 100];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s * 100, l * 100];
}

function hslToRgb([h, s, l]) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
}

export function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

// Closest lightness (same hue and saturation) for which ok(hex) holds; null when no lightness works.
function fitLightness(hex, ok) {
    const [h, s, l] = rgbToHsl(hexToRgb(hex));
    for (let d = 0; d <= 100; d += 0.5) {
        for (const candidate of [l - d, l + d]) {
            if (candidate < 0 || candidate > 100) continue;
            const out = rgbToHex(hslToRgb([h, s, candidate]));
            if (ok(out)) return out;
        }
    }
    return null;
}

const LIGHT_RULES = {
    // white button text on it, and the colour as text on the light page
    primary:   c => contrast(WHITE, c) >= 4.5 && contrast(c, PAGE_LIGHT) >= 4.5,
    // gradients, icons and large figures: 3:1 for non-text and large text
    secondary: c => contrast(c, WHITE) >= 3 && contrast(c, PAGE_LIGHT) >= 3
};
const DARK_RULES = {
    // text on the dark page and cards; white button text still readable
    primary:   c => contrast(c, PAGE_DARK) >= 4.5 && contrast(c, CARD_DARK) >= 3 && contrast(WHITE, c) >= 3,
    secondary: c => contrast(c, PAGE_DARK) >= 3 && contrast(c, CARD_DARK) >= 3
};
// Fallback when every rule cannot hold at once: the most important one alone
const DARK_FALLBACK = { primary: c => contrast(c, PAGE_DARK) >= 4.5, secondary: c => contrast(c, PAGE_DARK) >= 3 };

export function deriveTheme(theme = {}) {
    const chosen = {
        primary: isHex(theme.primary) ? theme.primary.toLowerCase() : DEFAULT_THEME.primary,
        secondary: isHex(theme.secondary) ? theme.secondary.toLowerCase() : DEFAULT_THEME.secondary
    };
    const out = { chosen, light: {}, dark: {} };
    for (const key of ['primary', 'secondary']) {
        out.light[key] = fitLightness(chosen[key], LIGHT_RULES[key]) || '#1e3a8a';
        out.dark[key]  = fitLightness(chosen[key], DARK_RULES[key]) || fitLightness(chosen[key], DARK_FALLBACK[key]) || '#93c5fd';
    }
    out.report = [
        { id: 'light-button', label: 'نص أبيض على الأزرار (فاتح)',   ratio: contrast(WHITE, out.light.primary),         min: 4.5 },
        { id: 'light-text',   label: 'النصوص الملوّنة على الصفحة (فاتح)', ratio: contrast(out.light.primary, PAGE_LIGHT),  min: 4.5 },
        { id: 'dark-text',    label: 'النصوص الملوّنة على الصفحة (داكن)', ratio: contrast(out.dark.primary, PAGE_DARK),    min: 4.5 },
        { id: 'dark-button',  label: 'نص أبيض على الأزرار (داكن)',   ratio: contrast(WHITE, out.dark.primary),          min: 3 },
        { id: 'secondary',    label: 'اللون الثانوي (أيقونات وتدرّجات)', ratio: Math.min(contrast(out.light.secondary, WHITE), contrast(out.dark.secondary, PAGE_DARK)), min: 3 }
    ].map(r => ({ ...r, pass: r.ratio >= r.min }));
    return out;
}

// Harmonious secondary colours for a primary: same saturation/lightness, hue rotated.
export function harmonies(hex) {
    const [h, s, l] = rgbToHsl(hexToRgb(hex));
    return [
        { id: 'analogous',     label: 'متجاور',   hex: rgbToHex(hslToRgb([(h + 35) % 360, s, l])) },
        { id: 'triadic',       label: 'ثلاثي',    hex: rgbToHex(hslToRgb([(h + 120) % 360, s, l])) },
        { id: 'split',         label: 'منقسم',    hex: rgbToHex(hslToRgb([(h + 150) % 360, s, l])) },
        { id: 'complementary', label: 'مكمّل',    hex: rgbToHex(hslToRgb([(h + 180) % 360, s, l])) }
    ];
}

const triplet = hex => hexToRgb(hex).join(' ');

// CSS custom properties consumed by src/tailwind.css (:root / .dark)
export function themeVars(derived) {
    return {
        '--primary-light': triplet(derived.light.primary),
        '--primary-dark': triplet(derived.dark.primary),
        '--secondary-light': triplet(derived.light.secondary),
        '--secondary-dark': triplet(derived.dark.secondary)
    };
}

export function applyTheme(theme) {
    const derived = deriveTheme(theme);
    const vars = themeVars(derived);
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    const dark = root.classList.contains('dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b1120' : derived.light.primary);
    return derived;
}

export function clearTheme() {
    ['--primary-light', '--primary-dark', '--secondary-light', '--secondary-dark'].forEach(k => document.documentElement.style.removeProperty(k));
}

// Applies data.json → theme (or the defaults) and caches it so js/early.js paints it from the start.
export function syncSiteTheme(theme) {
    if (theme) local.setJSON('theme_vars', themeVars(applyTheme(theme)));
    else { clearTheme(); local.remove('theme_vars'); }
}

export const PRESETS = [
    { name: 'أزرق وبنفسجي (الافتراضي)', primary: '#2563eb', secondary: '#8b5cf6' },
    { name: 'زمردي وسماوي',            primary: '#059669', secondary: '#0ea5e9' },
    { name: 'نيلي ووردي',              primary: '#4f46e5', secondary: '#db2777' },
    { name: 'تركوازي وكهرماني',        primary: '#0d9488', secondary: '#d97706' },
    { name: 'أحمر وبرتقالي',           primary: '#dc2626', secondary: '#ea580c' },
    { name: 'أردوازي وسماوي',          primary: '#334155', secondary: '#0284c7' },
    { name: 'بنفسجي وفوشيا',           primary: '#7c3aed', secondary: '#c026d3' }
];
