// Minimal static server that mounts the repository at /CV/ and gzips text, like GitHub Pages does.
// Usage: node scripts/serve.mjs   →   http://localhost:4173/CV/
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT   = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PREFIX = '/CV/';
const PORT   = Number(process.env.PORT) || 4173;
const TYPES  = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.ico': 'image/x-icon', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8', '.webmanifest': 'application/manifest+json',
    '.woff2': 'font/woff2', '.jpg': 'image/jpeg'
};

createServer(async (req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    if (pathname === '/' || pathname === '/CV') { res.writeHead(301, { Location: PREFIX }).end(); return; }
    if (!pathname.startsWith(PREFIX)) { res.writeHead(404).end('Not found'); return; }
    let file = normalize(join(ROOT, decodeURIComponent(pathname.slice(PREFIX.length))));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
        if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
        let body = await readFile(file);
        const type = TYPES[extname(file)] || 'application/octet-stream';
        const headers = { 'Content-Type': type, 'Cache-Control': 'max-age=600', Vary: 'Accept-Encoding' };
        if (/text|javascript|json|xml|svg/.test(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
            body = gzipSync(body);
            headers['Content-Encoding'] = 'gzip';
        }
        res.writeHead(200, headers);
        res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    }
}).listen(PORT, () => console.log(`Serving ${ROOT} at http://localhost:${PORT}${PREFIX}`));
