// Downloads the exact npm packages behind the jsDelivr URLs into .cdn-mirror/ so tests can run
// where the CDN is unreachable:  node scripts/mirror-cdn.mjs && CDN_MIRROR_DIR=.cdn-mirror npm test
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, CDN, listCdnAssets, splitCdnUrl } from './cdn-assets.mjs';

const out   = join(ROOT, '.cdn-mirror');
const specs = new Set((await listCdnAssets()).filter(a => a.url.startsWith(CDN)).map(a => splitCdnUrl(a.url)?.spec).filter(Boolean));
for (const spec of specs) {
    const dest = join(out, spec);
    if (existsSync(dest)) { console.log(`cached ${spec}`); continue; }
    const tmp = mkdtempSync(join(tmpdir(), 'cdn-'));
    const tgz = execFileSync('npm', ['pack', spec, '--silent', '--pack-destination', tmp], { encoding: 'utf8' }).trim().split('\n').pop();
    mkdirSync(dest, { recursive: true });
    execFileSync('tar', ['-xzf', join(tmp, tgz), '-C', dest, '--strip-components=1']);
    rmSync(tmp, { recursive: true, force: true });
    console.log(`mirrored ${spec}`);
}
