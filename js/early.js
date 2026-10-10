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
    // Custom brand colours chosen in the admin panel (cached by script.js), applied before first paint
    try {
        var vars = JSON.parse(localStorage.getItem('theme_vars') || 'null');
        for (var k in vars) {
            if (/^--(primary|secondary)-(light|dark)$/.test(k) && /^\d{1,3} \d{1,3} \d{1,3}$/.test(vars[k])) root.style.setProperty(k, vars[k]);
        }
    } catch (e) { /* storage blocked or bad value: default colours */ }
    var fromUrl = /[?&]lang=(ar|en)(&|$)/.exec(location.search);
    if (fromUrl) lang = fromUrl[1];
    if (lang !== 'en') lang = 'ar';
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
})();
