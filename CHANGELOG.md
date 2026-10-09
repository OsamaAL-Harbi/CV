# Changelog

All notable changes to this site. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [4.1.0] — 2026-10-09

### Fixed
- **Site did not load at all**: `script.js` still called `setupKonamiCode()`, removed in a02e4f5. The
  `ReferenceError` stopped start-up before `data.json` was loaded, so the loading screen never cleared.
- Service worker never installed: the precache list contained `assets/icon-192.png`/`icon-512.png`, which
  did not exist, so `cache.addAll()` failed. `offline.html` (deleted earlier) is recreated and used again.
- Profile image fallback re-requested a failing URL in an endless `onerror` loop.
- `updateMetaTags()` overwrote `twitter:card` with the page title.
- Admin drag & drop applied each drop several times after any edit (a new Sortable instance was stacked on
  every render) and misplaced items in filtered project/skill lists.
- PDF export saved the file as "download" when the interface was in Arabic.
- `robots.txt` / `sitemap.xml` pointed to `/portfolio/` instead of `/CV/`; sitemap `priority` was 1.1.
- Manifest shortcuts used `?page=…`, which the router ignores; they now open `#portfolio` / `#contact`.
- Closed mobile menu leaked its shadow into the page and kept its links in the tab order.

### Security
- Content-Security-Policy (meta) limited to the sources in use, without `'unsafe-inline'`/`'unsafe-eval'`;
  `Referrer-Policy: strict-origin-when-cross-origin`.
- All 45 inline `on*` handlers replaced with `data-action` attributes and one delegated listener.
- Every `data.json` value is escaped (`escapeHTML()`) before reaching HTML; project/profile links are used only
  when they are `https://` URLs (`safeUrl()`), blocking `javascript:` links.
- GitHub token moved from `localStorage` to `sessionStorage`, cleared on logout, tab close and after one hour;
  legacy `saved_token` / `backup_data` keys are purged; repository access is verified at login and the
  `owner/repo` value validated. The login dialog explains how to create a fine-grained, single-repository
  token with Contents read/write only and a short expiry.
- The persistent `localStorage` data backup became an in-memory "restore last saved version".
- Every CDN file is version-pinned (two were floating: `sweetalert2@11`, `toastify-js`) and loaded with
  `integrity` + `crossorigin`; `scripts/check-sri.mjs` verifies the hashes in CI.
- Decap CMS admin (`admin/`) removed: it could not work on GitHub Pages and its schema would have deleted fields.

### Changed
- `script.js` split into ES modules under `js/`; the admin module is downloaded only when needed.
- Tailwind Play CDN replaced by a prebuilt `assets/css/tailwind.css` (Tailwind CLI 3.4).
- AOS CSS, the Font Awesome icons in use (as SVG masks, no icon fonts) and the Tajawal font (self-hosted,
  weights 400/500/700/800) are bundled; no third-party request blocks the first render. Google Fonts is no
  longer used.
- SweetAlert2, Sortable (admin), jsPDF + html2canvas (PDF), Toastify (first toast) and particles.js (after
  idle) load on demand. Analytics (GA4, Clarity) load after the page has finished loading.
- Brand blue is `#2563eb` in light mode for WCAG AA contrast (`#3b82f6` kept in dark mode); icon buttons have
  bilingual accessible names; animations respect `prefers-reduced-motion`.
- Service worker rewritten: network-first for the site (fresh after deploys), cache-first for pinned CDN
  files, offline page for unknown URLs, no caching of analytics or GitHub API calls, bounded runtime cache,
  caches renamed to `portfolio-v4`.
- SEO: charset first, static canonical/`og:url`, Open Graph image, `og:locale`, JSON-LD LinkedIn URL fixed.
- `data.json`: `profile.cv` points to the kept PDF; five skill levels stored as numbers instead of strings.
- Lighthouse (mobile, measured locally with gzip; jsDelivr files served from a byte-identical mirror):
  Performance 97–98, Accessibility 100, Best Practices 100, SEO 100. CI enforces ≥ 90 in every category.

### Added
- Local icons (favicon, 192/512 any + maskable, Apple touch icon), Open Graph image, PWA screenshots.
- Playwright tests (desktop + mobile), Lighthouse CI and a GitHub Actions workflow on every pull request.
- `npm start` dev server that serves the site under `/CV/` like GitHub Pages.

### Removed
- `admin/` (Decap CMS + Netlify Identity), `Osama_Alharbi_IT_CV.pdf` (older CV, `Osama_Alharbi.pdf` kept),
  `portfolio_project_structure.svg` (unused).
- Dead code: `FORMSPREE_ENDPOINT`, `closeProjectModal(event)`, the admin-only skills observer, the unused
  `periodicsync` handler, `.timeline-year` styles, `#image-upload-input`, `console.log` calls in `sw.js`.
