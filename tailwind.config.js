/** Tailwind CLI config — replaces the old in-page Play CDN config. Run `npm run build:css`. */
export default {
    content: ['./index.html', './script.js', './js/**/*.js'],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: { sans: ['Tajawal', 'Roboto', 'sans-serif'] },
            colors: { primary: '#3b82f6', secondary: '#8b5cf6', darkBg: '#0b1120', cardBg: '#1e293b' }
        }
    }
};
