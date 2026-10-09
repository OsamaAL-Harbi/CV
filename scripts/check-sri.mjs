// Verifies that every CDN file is version-pinned and that its integrity hash matches the bytes
// actually served. Set CDN_MIRROR_DIR to check against a local mirror (see mirror-cdn.mjs).
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CDN, listCdnAssets, splitCdnUrl } from './cdn-assets.mjs';

const mirror = process.env.CDN_MIRROR_DIR;
// Hosts whose responses are generated per request, so SRI cannot apply.
const SRI_EXEMPT = [/^https:\/\/fonts\.googleapis\.com\//];

let failed = 0;
for (const { url, integrity, from } of await listCdnAssets()) {
    if (SRI_EXEMPT.some(re => re.test(url))) { console.log(`skip  ${url} (dynamic, SRI not possible)`); continue; }
    if (!integrity) { console.error(`FAIL  ${url} (${from}): missing integrity`); failed++; continue; }
    if (url.startsWith(CDN) && !splitCdnUrl(url)) { console.error(`FAIL  ${url}: version not pinned`); failed++; continue; }
    const [algo, expected] = integrity.split(/-(.*)/s);
    let body;
    try {
        if (mirror) {
            const { spec, path } = splitCdnUrl(url);
            body = await readFile(join(mirror, spec, path));
        } else {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            body = Buffer.from(await res.arrayBuffer());
        }
    } catch (err) {
        console.error(`FAIL  ${url}: ${err.message}`); failed++; continue;
    }
    const actual = createHash(algo).update(body).digest('base64');
    if (actual === expected) console.log(`ok    ${url}`);
    else { console.error(`FAIL  ${url}: expected ${algo}-${expected}, got ${algo}-${actual}`); failed++; }
}
if (failed) { console.error(`\n${failed} SRI problem(s)`); process.exit(1); }
