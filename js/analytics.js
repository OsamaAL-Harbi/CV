// Google Analytics 4 + Microsoft Clarity, loaded once the page has finished loading
// so they do not compete with the site's own resources.
(function () {
    var GA_ID = 'G-KE86NNMX3J';
    var CLARITY_ID = 'vyu7dpoiy5';

    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    // Page views are sent by js/router.js for every section (#resume, #portfolio…), the first one included.
    window.gtag('config', GA_ID, { send_page_view: false });
    window.clarity = window.clarity || function () { (window.clarity.q = window.clarity.q || []).push(arguments); };

    function load(src) {
        var s = document.createElement('script');
        s.async = true;
        s.src = src;
        document.head.appendChild(s);
    }
    function start() {
        load('https://www.googletagmanager.com/gtag/js?id=' + GA_ID);
        load('https://www.clarity.ms/tag/' + CLARITY_ID);
    }
    function schedule() {
        if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 3000 });
        else setTimeout(start, 1500);
    }
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
})();
