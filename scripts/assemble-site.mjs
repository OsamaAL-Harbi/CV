// Copies only the files the site serves into a folder for GitHub Pages (the "Deploy site" workflow
// uploads it), so tests, scripts, sources and package files are not published.
// Usage: node scripts/assemble-site.mjs _site
import { cp, mkdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './cdn-assets.mjs';

export const PUBLIC = [
    'index.html', 'offline.html', 'script.js', 'sw.js', 'data.json', 'manifest.json',
    'robots.txt', 'sitemap.xml', '.nojekyll', 'Osama_Alharbi.pdf',
    'oauth.html', 'assets', 'js', 'images', 'cv', 'generated'
];

const dest = join(ROOT, process.argv[2] || '_site');
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });
for (const entry of PUBLIC) {
    try { await stat(join(ROOT, entry)); } catch { console.log(`skip  ${entry} (not present)`); continue; }
    await cp(join(ROOT, entry), join(dest, entry), { recursive: true });
    console.log(`copy  ${entry}`);
}
