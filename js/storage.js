// Web Storage wrappers. Reading localStorage throws (SecurityError) when the visitor blocks site data,
// which used to stop the whole app before data.json was loaded. These fall back to memory instead.
function wrap(getArea) {
    const memory = new Map();
    const area = () => { try { return getArea(); } catch { return null; } };
    return {
        get(key) {
            try { const a = area(); if (a) return a.getItem(key); } catch { /* blocked */ }
            return memory.has(key) ? memory.get(key) : null;
        },
        set(key, value) {
            try { const a = area(); if (a) { a.setItem(key, String(value)); return; } } catch { /* blocked or full */ }
            memory.set(key, String(value));
        },
        remove(key) {
            memory.delete(key);
            try { area()?.removeItem(key); } catch { /* blocked */ }
        },
        // Corrupted or hand-edited values must not break the page either.
        getJSON(key, fallback) {
            try { return JSON.parse(this.get(key)) ?? fallback; } catch { return fallback; }
        },
        setJSON(key, value) { this.set(key, JSON.stringify(value)); }
    };
}

export const local   = wrap(() => window.localStorage);
export const session = wrap(() => window.sessionStorage);
