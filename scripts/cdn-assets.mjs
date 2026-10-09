// Lists every pinned CDN file the site loads, with its SRI hash, by reading the sources:
//   - <link>/<script> tags in index.html that carry integrity=""
//   - { src|href: '<pkg@ver/path>', integrity: '<hash>' } entries in the JS (lazy-loaded libraries)
import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const CDN  = 'https://cdn.jsdelivr.net/npm/';

export async function listCdnAssets() {
    const assets = [];
    const html = await readFile(join(ROOT, 'index.html'), 'utf8');
    // Only executable/stylesheet subresources: SRI does not apply to preconnect, icons or manifests.
    for (const tag of html.match(/<script\b[^>]*\bsrc="[^"]+"[^>]*>|<link\b[^>]*\brel="stylesheet"[^>]*>/g) || []) {
        const url = tag.match(/\b(?:src|href)="([^"]+)"/)?.[1];
        const integrity = tag.match(/\bintegrity="([^"]+)"/)?.[1];
        if (url?.startsWith('https://')) assets.push({ url, integrity: integrity || null, from: 'index.html' });
    }
    const jsFiles = ['script.js', ...(await readdir(join(ROOT, 'js')).catch(() => [])).map(f => `js/${f}`)].filter(f => f.endsWith('.js'));
    for (const file of jsFiles) {
        const src = await readFile(join(ROOT, file), 'utf8').catch(() => '');
        for (const m of src.matchAll(/(?:src|href):\s*'([^']+@[^']+)',\s*integrity:\s*'([^']+)'/g)) {
            assets.push({ url: CDN + m[1], integrity: m[2], from: file });
        }
    }
    return assets;
}

// "@scope/name@1.2.3/dist/x.js" -> { spec: "@scope/name@1.2.3", path: "dist/x.js" }
export function splitCdnUrl(url) {
    const rest = url.slice(CDN.length);
    const m = rest.match(/^((?:@[^/]+\/)?[^/@]+@[^/]+)\/(.+)$/);
    return m ? { spec: m[1], path: m[2] } : null;
}
