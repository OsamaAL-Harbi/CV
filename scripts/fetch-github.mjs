// Builds generated/github.json (+ generated/readme/<repo>.html) for the GitHub section of the site.
// Runs in the "Deploy site" workflow every 12 hours and on every push to main. Only public data is read:
// the contribution calendar (it includes private contributions as anonymous counts when the profile
// setting "Private contributions" is on), the public repositories picked in the admin panel
// (data.json → github.repos), their languages, READMEs and recent public activity.
//
// Usage: GITHUB_TOKEN=… node scripts/fetch-github.mjs
// The token is the workflow's own GITHUB_TOKEN; GraphQL needs authentication even for public data.
// On any failure the copy currently deployed on the site is kept, so a GitHub outage never empties the page.
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT } from './cdn-assets.mjs';

export const SITE_URL = 'https://osamaal-harbi.github.io/CV/';
const OUT = join(ROOT, 'generated');
const API = 'https://api.github.com';
const MAX_REPOS = 12;
const MAX_README_BYTES = 300_000;
const ACTIVITY_LIMIT = 8;

const QUERY = `query($login: String!) {
  user(login: $login) {
    login name url avatarUrl
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
    repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes {
        name description url homepageUrl stargazerCount forkCount isFork isArchived pushedAt
        primaryLanguage { name color }
        languages(first: 10, orderBy: { field: SIZE, direction: DESC }) { edges { size node { name color } } }
        repositoryTopics(first: 8) { nodes { topic { name } } }
        defaultBranchRef { name }
      }
    }
  }
}`;

const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

// "https://github.com/OsamaAL-Harbi" → "OsamaAL-Harbi"
export function githubUser(data) {
    if (data.github?.user) return data.github.user;
    return String(data.profile?.github || '').match(/^https:\/\/github\.com\/([A-Za-z0-9-]+)\/?$/)?.[1] || '';
}

const onlyHttps = url => (/^https:\/\//i.test(url || '') ? url : '');

export function shapeRepo(node) {
    return {
        name: node.name,
        description: node.description || '',
        url: node.url,
        homepage: onlyHttps(node.homepageUrl),
        stars: node.stargazerCount,
        forks: node.forkCount,
        fork: node.isFork,
        archived: node.isArchived,
        pushedAt: node.pushedAt,
        language: node.primaryLanguage ? { name: node.primaryLanguage.name, color: node.primaryLanguage.color } : null,
        topics: (node.repositoryTopics?.nodes || []).map(n => n.topic.name),
        branch: node.defaultBranchRef?.name || 'main',
        languages: (node.languages?.edges || []).map(e => ({ name: e.node.name, color: e.node.color, size: e.size }))
    };
}

// Bytes per language summed over the featured repositories, as percentages (top 6 + "Other").
export function languageShare(repos) {
    const totals = new Map();
    for (const repo of repos) for (const { name, color, size } of repo.languages) {
        const cur = totals.get(name) || { name, color, size: 0 };
        cur.size += size;
        totals.set(name, cur);
    }
    const all = [...totals.values()].sort((a, b) => b.size - a.size);
    const sum = all.reduce((s, l) => s + l.size, 0);
    if (!sum) return [];
    const top = all.slice(0, 6);
    const rest = all.slice(6).reduce((s, l) => s + l.size, 0);
    if (rest) top.push({ name: 'Other', color: '#9ca3af', size: rest });
    return top.map(l => ({ name: l.name, color: l.color || '#9ca3af', percent: Math.round((l.size / sum) * 1000) / 10 }));
}

export function shapeCalendar(calendar) {
    return {
        total: calendar.totalContributions,
        days: calendar.weeks.flatMap(w => w.contributionDays).map(d => [d.date, d.contributionCount, LEVELS[d.contributionLevel] ?? 0])
    };
}

// Public events of the featured repositories only, newest first, as plain data (rendered escaped).
export function shapeActivity(events, featured) {
    const wanted = new Set(featured.map(n => n.toLowerCase()));
    const out = [];
    for (const e of events) {
        const repo = e.repo?.name?.split('/')[1];
        if (!repo || !wanted.has(repo.toLowerCase())) continue;
        const base = { repo, at: e.created_at };
        const p = e.payload || {};
        if (e.type === 'PushEvent') {
            const commits = p.commits || [];
            out.push({ ...base, type: 'push', count: p.size ?? commits.length ?? 0, message: (commits[commits.length - 1]?.message || '').split('\n')[0].slice(0, 120) });
        } else if (e.type === 'ReleaseEvent' && p.action === 'published') {
            out.push({ ...base, type: 'release', name: (p.release?.name || p.release?.tag_name || '').slice(0, 80) });
        } else if (e.type === 'CreateEvent' && p.ref_type === 'repository') {
            out.push({ ...base, type: 'create' });
        } else if (e.type === 'PullRequestEvent' && ['opened', 'closed'].includes(p.action)) {
            out.push({ ...base, type: p.pull_request?.merged ? 'merge' : 'pr', name: (p.pull_request?.title || '').slice(0, 100) });
        }
        if (out.length >= ACTIVITY_LIMIT) break;
    }
    return out;
}

async function gh(path, token, init = {}) {
    const res = await fetch(path.startsWith('http') ? path : API + path, {
        ...init,
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'osama-portfolio', ...init.headers }
    });
    if (!res.ok) throw new Error(`${init.method || 'GET'} ${path}: HTTP ${res.status}`);
    return res;
}

// The copy that is live on the site, used when GitHub cannot be reached.
async function keepDeployed() {
    try {
        const res = await fetch(`${SITE_URL}generated/github.json`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await mkdir(OUT, { recursive: true });
        await writeFile(join(OUT, 'github.json'), await res.text());
        const data = JSON.parse(await readFile(join(OUT, 'github.json'), 'utf8'));
        await mkdir(join(OUT, 'readme'), { recursive: true });
        for (const repo of data.repos || []) {
            if (!repo.readme) continue;
            const r = await fetch(`${SITE_URL}generated/readme/${encodeURIComponent(repo.name)}.html`);
            if (r.ok) await writeFile(join(OUT, 'readme', `${repo.name}.html`), await r.text());
        }
        console.log('kept the deployed github.json');
    } catch (err) {
        console.log(`no deployed copy to keep (${err.message}); the GitHub section stays hidden`);
    }
}

export async function main() {
    const data = JSON.parse(await readFile(join(ROOT, 'data.json'), 'utf8'));
    const settings = data.github;
    if (!settings) { console.log('data.json has no "github" settings: nothing to build'); return; }
    const login = githubUser(data);
    const token = process.env.GITHUB_TOKEN;
    if (!login || !token) { console.log('missing GitHub user or GITHUB_TOKEN'); await keepDeployed(); return; }

    try {
        const res = await gh('/graphql', token, { method: 'POST', body: JSON.stringify({ query: QUERY, variables: { login } }) });
        const { data: gql, errors } = await res.json();
        if (errors?.length) throw new Error(errors.map(e => e.message).join('; '));
        const user = gql.user;
        const all = user.repositories.nodes.map(shapeRepo);
        const byName = new Map(all.map(r => [r.name.toLowerCase(), r]));
        // Keep the order chosen in the admin panel; names that are no longer public are skipped.
        const featured = (settings.repos || []).map(n => byName.get(String(n).toLowerCase())).filter(Boolean).slice(0, MAX_REPOS);

        await rm(join(OUT, 'readme'), { recursive: true, force: true });
        await mkdir(join(OUT, 'readme'), { recursive: true });
        for (const repo of featured) {
            try {
                const r = await gh(`/repos/${login}/${repo.name}/readme`, token, { headers: { Accept: 'application/vnd.github.html+json' } });
                const html = await r.text();
                if (html.length > MAX_README_BYTES) { console.log(`README of ${repo.name} is too large, skipped`); continue; }
                await writeFile(join(OUT, 'readme', `${repo.name}.html`), html);
                repo.readme = true;
            } catch { repo.readme = false; }   // a repository without README is fine
        }

        let activity = [];
        try {
            const events = await (await gh(`/users/${login}/events/public?per_page=100`, token)).json();
            activity = shapeActivity(events, featured.map(r => r.name));
        } catch (err) { console.log(`activity skipped: ${err.message}`); }

        const out = {
            generatedAt: new Date().toISOString(),
            user: { login: user.login, name: user.name || user.login, url: user.url },
            calendar: shapeCalendar(user.contributionsCollection.contributionCalendar),
            repos: featured.map(({ languages, ...repo }) => repo),
            languages: languageShare(featured),
            activity,
            totals: { publicRepos: all.filter(r => !r.fork).length, stars: featured.reduce((s, r) => s + r.stars, 0) }
        };
        await writeFile(join(OUT, 'github.json'), JSON.stringify(out));
        console.log(`github.json: ${featured.length} repos, ${out.calendar.total} contributions, ${activity.length} events`);
    } catch (err) {
        console.error(`GitHub fetch failed: ${err.message}`);
        await keepDeployed();
    }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
