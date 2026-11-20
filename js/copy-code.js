// A "Copy" button on every code block of an article (blog/<slug>.html, which load this file and nothing else).
// Plain script, no imports: the article pages allow only scripts from this site.
(function () {
    function label(el, done) {
        var ar = (el.closest('[lang]') || document.documentElement).getAttribute('lang') === 'ar';
        return done ? (ar ? 'تم النسخ ✓' : 'Copied ✓') : (ar ? 'نسخ' : 'Copy');
    }
    function setup() {
        if (!navigator.clipboard) return;
        document.querySelectorAll('.readme pre').forEach(function (pre) {
            var code = pre.querySelector('code') || pre;
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'copy-code absolute top-2 end-2 text-xs font-bold px-2 py-1 rounded-md bg-white/90 text-gray-700 border border-gray-300 hover:bg-white';
            btn.textContent = label(pre, false);
            btn.addEventListener('click', function () {
                navigator.clipboard.writeText(code.textContent).then(function () {
                    btn.textContent = label(pre, true);
                    setTimeout(function () { btn.textContent = label(pre, false); }, 1500);
                }).catch(function () { /* clipboard refused: nothing to do */ });
            });
            pre.classList.add('relative');
            pre.appendChild(btn);
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setup); else setup();
})();
