/** Tailwind CLI config — replaces the old in-page Play CDN config. Run `npm run build:css`. */
export default {
    content: ['./index.html', './script.js', './js/**/*.js'],
    darkMode: 'class',
    theme: {
        extend: {
            // --font-stack is set from admin → Fonts (js/fonts.js); Tajawal when nothing was picked
            fontFamily: { sans: ['var(--font-stack, "Tajawal", system-ui, sans-serif)'] },
            // primary is a CSS variable: blue-600 in light mode (WCAG AA with white text), blue-500 in dark mode
            colors: { primary: 'rgb(var(--color-primary) / <alpha-value>)', secondary: 'rgb(var(--color-secondary) / <alpha-value>)', darkBg: '#0b1120', cardBg: '#1e293b' }
        }
    }
};
