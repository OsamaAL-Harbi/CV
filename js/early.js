// Runs before first paint: apply the saved theme and language direction to avoid a flash.
(function () {
    try {
        var root = document.documentElement;
        var theme = localStorage.getItem('theme');
        if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            root.classList.add('dark');
        }
        var lang = localStorage.getItem('lang') === 'en' ? 'en' : 'ar';
        root.lang = lang;
        root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    } catch (e) { /* storage blocked: keep defaults */ }
})();
