// Site fonts: one Arabic and one English family, picked in admin → Fonts (data.json → fonts).
// Every option is self-hosted (SIL OFL 1.1, files from @fontsource copied by scripts/build-vendor.mjs), so the
// CSP keeps font-src 'self' and a visitor downloads only the families actually used, and only the scripts
// on the page (each face carries its unicode-range).
import { local } from './storage.js';

export const FONTS = {
    ar: [
        { id: 'tajawal',              family: 'Tajawal',              pkg: 'tajawal',              label: 'تجوال (الافتراضي)' },
        { id: 'ibm-plex-sans-arabic', family: 'IBM Plex Sans Arabic', pkg: 'ibm-plex-sans-arabic', label: 'IBM Plex Sans Arabic' },
        { id: 'cairo',                family: 'Cairo',                pkg: 'cairo',                label: 'القاهرة Cairo' },
        { id: 'almarai',              family: 'Almarai',              pkg: 'almarai',              label: 'المراعي Almarai' },
        { id: 'readex-pro',           family: 'Readex Pro',           pkg: 'readex-pro',           label: 'Readex Pro' },
        { id: 'noto-kufi-arabic',     family: 'Noto Kufi Arabic',     pkg: 'noto-kufi-arabic',     label: 'Noto Kufi Arabic' },
        { id: 'el-messiri',           family: 'El Messiri',           pkg: 'el-messiri',           label: 'المسيري El Messiri' }
    ],
    en: [
        { id: 'same',          family: null,            pkg: null,            label: 'نفس الخط العربي' },
        { id: 'inter',         family: 'Inter',         pkg: 'inter',         label: 'Inter' },
        { id: 'poppins',       family: 'Poppins',       pkg: 'poppins',       label: 'Poppins' },
        { id: 'roboto',        family: 'Roboto',        pkg: 'roboto',        label: 'Roboto' },
        { id: 'ibm-plex-sans', family: 'IBM Plex Sans', pkg: 'ibm-plex-sans', label: 'IBM Plex Sans' }
    ]
};

export const DEFAULT_FONTS = { ar: 'tajawal', en: 'same' };

// Latin family first (it has no Arabic glyphs, so Arabic text falls through to the Arabic family)
export function fontStack(choice = {}) {
    const ar = FONTS.ar.find(f => f.id === choice.ar) || FONTS.ar[0];
    const en = FONTS.en.find(f => f.id === choice.en);
    const families = [en?.family, ar.family].filter(Boolean).map(f => `"${f}"`);
    return `${families.join(', ')}, system-ui, sans-serif`;
}

export function applyFonts(choice) {
    const stack = fontStack(choice);
    document.documentElement.style.setProperty('--font-stack', stack);
    return stack;
}

// Applies data.json → fonts and caches the stack so js/early.js uses it from the first paint.
export function syncSiteFonts(choice) {
    const custom = choice && (choice.ar !== DEFAULT_FONTS.ar || choice.en !== DEFAULT_FONTS.en);
    if (custom) local.set('font_stack', applyFonts(choice));
    else { document.documentElement.style.removeProperty('--font-stack'); local.remove('font_stack'); }
}
