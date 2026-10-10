// Search Console / Bing Webmaster verification (admin → SEO; written into index.html by the deploy).
// Only the token is kept, so pasting the whole <meta …> tag that Google or Bing shows works too.
export function verificationToken(value) {
    const v = String(value || '').trim();
    const token = (v.match(/content=["']([^"']+)["']/)?.[1] || v).trim();
    return /^[A-Za-z0-9_-]{8,100}$/.test(token) ? token : '';
}
