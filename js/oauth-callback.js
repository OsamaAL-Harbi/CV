// Redirect target of the Google sign-in popup (oauth.html). The access token arrives in the URL fragment;
// it is passed to the site tab over a same-origin BroadcastChannel (window.opener is cut off by Google's
// Cross-Origin-Opener-Policy), removed from the address bar, and the popup closes itself.
(function () {
    var params = new URLSearchParams(location.hash.slice(1));
    history.replaceState(null, '', location.pathname);
    var message = {
        type: 'ga-oauth',
        state: params.get('state') || '',
        token: params.get('access_token') || '',
        expiresIn: Number(params.get('expires_in')) || 3600,
        scope: params.get('scope') || '',
        error: params.get('error') || (params.get('access_token') ? '' : 'no_token')
    };
    try {
        var channel = new BroadcastChannel('ga-oauth');
        channel.postMessage(message);
        channel.close();
    } catch (e) { /* very old browser */ }
    document.getElementById('msg').textContent = message.error
        ? 'تعذّر تسجيل الدخول (' + message.error + '). أغلق هذه النافذة. / Sign-in failed, close this window.'
        : 'تم ✅ يمكنك إغلاق هذه النافذة. / Done, you can close this window.';
    setTimeout(function () { window.close(); }, 400);
})();
