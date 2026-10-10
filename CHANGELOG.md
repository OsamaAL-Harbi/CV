# Changelog

All notable changes to this site. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [4.3.0] — 2026-10-10

### Added
- **GitHub section** in the portfolio: contribution calendar for the last year (own SVG in the site colours,
  mirrored in RTL, tooltips and a screen-reader summary), language share across the featured repositories,
  repository cards (language, stars, forks, topics, last push, GitHub/live links) and recent public activity.
- **Admin → GitHub page**: lists the public repositories, pick up to 12 and order them, and switch the
  calendar, languages and activity on or off. Saved in `data.json` → `github`.
- **Case studies** (`#portfolio/<repo>`): the README of a featured repository, rendered by GitHub and passed
  through an allow-list sanitizer (`js/sanitize.js`: inert DOMParser, https-only links/images, relative paths
  resolved to the repository); deep-linkable, closes back to `#portfolio`.
- **System status**: PRTG-style sensors for the sites in `data.json` → `monitor` (admin → Monitoring page),
  checked every 12 hours with one retry: state, HTTP code, response time, 30-day uptime and a sparkline.
- **Deploy site** workflow (`.github/workflows/deploy.yml`): on every push to `main` and every 12 hours it
  builds `generated/github.json`, `generated/readme/*.html` and `generated/status.json` with the workflow's own
  token (no secret to create), keeps the deployed copy if GitHub cannot be reached, and publishes only the
  site's files to GitHub Pages. Requires Settings → Pages → Source: **GitHub Actions**.
- View Transitions between sections (the nav underline glides to the new link) and tilt-on-hover cards with
  a light spot (mouse only, off with "reduce motion").
- Unit tests for the data scripts (`npm run test:unit`, also in CI).

### Changed
- `data.json` gains two settings blocks, `github` (no repositories picked yet) and `monitor` (the portfolio
  itself); CV content is unchanged.

## [4.2.0] — 2026-10-10

### Fixed
- **Blank page when the browser blocks site data** (cookies/storage disabled): reading `localStorage` threw before
  `data.json` was loaded. Storage now goes through `js/storage.js`, which falls back to memory.
- The greeting ("صباح الخير" / "Good Morning") stayed in the previous language after switching.
- Home stats were hard-coded (3 certificates while `data.json` lists 5) and the year was shown as "2,026" in
  English; they are computed from `data.json`, present in the page before the count-up animation.
- `Ctrl + K` did nothing on an Arabic keyboard layout (`e.key` is "ن") or with Caps Lock; the palette also
  reopened with the old search text over an unfiltered list.
- Printing (and "Generate PDF") contained only the selected skills tab, and AOS could leave the resume title
  transparent on paper. Both skill groups are now printed, with the LinkedIn/GitHub URLs written out.
- Paragraphs in descriptions (blank lines in `data.json`) were merged into one block; an empty `period`
  showed an empty grey badge; empty challenge/result boxes were shown in the project modal.
- Admin save: a second save within 60 s could fail with a stale `sha` (the API response was cached), and a
  double click sent two PUTs. Editors dropped fields they do not show (`{...item, ...value}` now).
- Message counter showed "2001 / 2000" before trimming (`maxlength` is used instead); contact form labels
  were not linked to their fields; the 404 view kept the previous page title.
- Corrupted `sessionStorage` values no longer throw; `?lang=xx` / unknown saved languages fall back to Arabic.

### Added
- `?lang=en` link for the English version, `hreflang` alternates (page and sitemap); canonical, `og:url` and
  `og:locale` follow the language.
- "Save contact" button: a vCard generated from `data.json` in the browser.
- WhatsApp contact card (`wa.me` link from `profile.phone`, greeting in the visitor's language; hidden
  when there is no phone) and a matching command-palette entry.
- Optional certificate `url` field rendered as a "Verify credential" link (https only); Arabic month names
  for "January 2025"-style dates in the Arabic UI.
- Command palette: search button (also on phones), labels in the current language with search in both,
  arrow keys + Enter, backdrop click, new commands (download CV, copy email, save contact).
- Admin: list of changed sections before saving, warning when `data.json` changed on GitHub since the page
  loaded, "nothing to save", confirmation for "restore", warning before leaving with unsaved edits, Enter to
  log in, skill type as a select.
- Error message with a retry button when `data.json` cannot be loaded; static fallback without JavaScript.
- Reading progress bar.

### Accessibility
- Dialogs (project, palette, admin login) have `role="dialog"`, trap focus and return it to the opener;
  Escape closes them and the mobile menu.
- Project cards are keyboard-operable; focus moves to the new section's heading on navigation;
  `aria-current`, `aria-pressed` (tabs, filters, theme), progress bars with values, skip link,
  visible focus ring, full typewriter title for screen readers.
- Section heading and secondary text colours raised to WCAG AA contrast in light and dark mode.

### Changed
- Theme follows the operating system until the visitor picks one; `theme-color` matches the theme.
- Particles are skipped on phone-sized screens and with Data Saver; the service worker registers after load
  (cache `portfolio-v5`); scroll handling is passive and frame-throttled.
- The project filter bar is hidden while there is only one project.
- Manifest no longer locks the installed app to portrait. CI actions updated to v5 (Node 24).
- Notifications are shorter (2 s, errors 3 s), pause on hover and have a close button.
- JSON-LD `sameAs` uses the LinkedIn profile from `data.json` (`/in/osama-alharbi-it/`).

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
  `integrity` + `crossorigin`. The CSP allows jsDelivr only for those exact package paths (not the whole host,
  which serves any npm/GitHub file) and Google Tag Manager only under `/gtag/`; `scripts/check-sri.mjs`
  verifies the hashes and that each file is permitted by the CSP.
- When the admin session expires, the token is dropped but unsaved edits stay on the page and the login
  dialog reopens; admin load/editor failures now show an error instead of failing silently.
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
  caches renamed to `portfolio-v4`. Offline, the newest copy seen is served (runtime cache before the
  install-time precache) and cache writes are kept alive with `waitUntil`.
- Icons are inlined as SVG images in the copy html2canvas renders, so they appear in the generated PDF, and are
  marked `print-color-adjust: exact` so they print without "background graphics".
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
