// Runs before first paint: apply the saved theme and language direction to avoid a flash.
// Language rule (same as js/state.js): ?lang=en|ar, then the saved choice, then Arabic.
(function () {
    var root = document.documentElement;
    var theme = null, lang = null;
    try {
        theme = localStorage.getItem('theme');
        lang = localStorage.getItem('lang');
    } catch (e) { /* storage blocked: follow the system theme, Arabic */ }
    if (theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark');
    }
    var fromUrl = /[?&]lang=(ar|en)(&|$)/.exec(location.search);
    if (fromUrl) lang = fromUrl[1];
    if (lang !== 'en') lang = 'ar';
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
})();
