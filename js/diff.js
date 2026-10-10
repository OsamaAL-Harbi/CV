// Line diff for the admin "preview before publishing" and the history page (no library).
// Common prefix/suffix are trimmed first, so editing a few fields of data.json stays tiny; the middle is an
// LCS table. Returns operations in order: { op: ' ' | '-' | '+', text, a, b } (a/b: 1-based line numbers).
export function diffLines(before, after) {
    const A = String(before ?? '').split('\n'), B = String(after ?? '').split('\n');
    let start = 0;
    while (start < A.length && start < B.length && A[start] === B[start]) start++;
    let endA = A.length, endB = B.length;
    while (endA > start && endB > start && A[endA - 1] === B[endB - 1]) { endA--; endB--; }

    const a = A.slice(start, endA), b = B.slice(start, endB);
    const n = a.length, m = b.length;
    const ops = [];
    for (let i = 0; i < start; i++) ops.push({ op: ' ', text: A[i], a: i + 1, b: i + 1 });

    if (n * m > 4_000_000) {                     // pathological sizes: show as replace instead of a huge table
        a.forEach((t, i) => ops.push({ op: '-', text: t, a: start + i + 1 }));
        b.forEach((t, j) => ops.push({ op: '+', text: t, b: start + j + 1 }));
    } else {
        const w = m + 1, lcs = new Uint32Array((n + 1) * w);
        for (let i = n - 1; i >= 0; i--) {
            for (let j = m - 1; j >= 0; j--) {
                lcs[i * w + j] = a[i] === b[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
            }
        }
        let i = 0, j = 0;
        while (i < n || j < m) {
            if (i < n && j < m && a[i] === b[j]) { ops.push({ op: ' ', text: a[i], a: start + i + 1, b: start + j + 1 }); i++; j++; }
            // additions only when they keep a longer common run; on ties the removal comes first (− then +)
            else if (j < m && (i === n || lcs[i * w + j + 1] > lcs[(i + 1) * w + j])) { ops.push({ op: '+', text: b[j], b: start + j + 1 }); j++; }
            else { ops.push({ op: '-', text: a[i], a: start + i + 1 }); i++; }
        }
    }
    const shift = endB - endA;
    for (let i = endA; i < A.length; i++) ops.push({ op: ' ', text: A[i], a: i + 1, b: i + 1 + shift });
    return ops;
}

// Keeps changed lines plus `context` unchanged lines around them; gaps become { op: '…' }.
export function hunks(ops, context = 3) {
    const keep = new Array(ops.length).fill(false);
    ops.forEach((o, i) => {
        if (o.op === ' ') return;
        for (let k = Math.max(0, i - context); k <= Math.min(ops.length - 1, i + context); k++) keep[k] = true;
    });
    const out = [];
    ops.forEach((o, i) => {
        if (keep[i]) out.push(o);
        else if (out.length && out[out.length - 1].op !== '…') out.push({ op: '…' });
    });
    if (out.length && out[0].op === '…') out.shift();
    return out;
}

export const diffStats = ops => ({ added: ops.filter(o => o.op === '+').length, removed: ops.filter(o => o.op === '-').length });
