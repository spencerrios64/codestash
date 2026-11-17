#!/usr/bin/env node
// codestash-mcp.mjs - a code vault for AI-written code, stored as Obsidian-compatible markdown notes.
// Each snippet is one .md file (frontmatter + a fenced code block). Open the folder in Obsidian, or use
// the codestash web page. Reuse code by searching and copying it instead of having the AI rebuild it.
//   stdio:  node codestash-mcp.mjs            vault folder: CODESTASH_DIR or ~/.codestash/vault
// No dependencies; Node 18+.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import readline from 'node:readline';

const DIR = process.env.CODESTASH_DIR || path.join(os.homedir(), '.codestash', 'vault');
fs.mkdirSync(DIR, { recursive: true });

const slug = s => (s || 'snippet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'snippet';
const hash = c => crypto.createHash('sha1').update(c.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 10);
const EXT = { javascript: 'js', typescript: 'ts', python: 'py', bash: 'sh', shell: 'sh', powershell: 'ps1', lua: 'lua', luau: 'lua', html: 'html', css: 'css', json: 'json', csharp: 'cs', cpp: 'cpp', c: 'c', java: 'java', go: 'go', rust: 'rs', sql: 'sql', gdscript: 'gd' };

function parse(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const fm = {}; let body = raw;
  if (m) { body = m[2]; for (const l of m[1].split('\n')) { const k = l.match(/^(\w+):\s*(.*)$/); if (k) fm[k[1]] = k[2]; } }
  const code = (body.match(/```[^\n]*\n([\s\S]*?)\n```/) || [])[1] || '';
  const notes = body.replace(/```[^\n]*\n[\s\S]*?\n```/, '').trim();
  const tags = (fm.tags || '').replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(Boolean);
  return { id: path.basename(file, '.md'), title: fm.title || path.basename(file, '.md'), lang: fm.lang || '', tags, hash: fm.hash || hash(code), created: fm.created || '', source: fm.source || '', code, notes };
}
function all() { return fs.readdirSync(DIR).filter(f => f.endsWith('.md')).map(f => { try { return parse(path.join(DIR, f)); } catch { return null; } }).filter(Boolean); }
function write(s) {
  const fm = ['---', 'title: ' + s.title, 'lang: ' + s.lang, 'tags: [' + s.tags.join(', ') + ']', 'hash: ' + s.hash, 'created: ' + s.created, s.source ? 'source: ' + s.source : null, '---'].filter(x => x !== null).join('\n');
  const fence = '```';
  fs.writeFileSync(path.join(DIR, s.id + '.md'), fm + '\n\n' + fence + s.lang + '\n' + s.code + '\n' + fence + '\n' + (s.notes ? '\n' + s.notes + '\n' : ''));
}
const find = q => { const a = all(); return a.find(s => s.id === q) || a.find(s => s.title.toLowerCase() === String(q).toLowerCase()); };
const links = s => [...new Set([...(s.notes.matchAll(/\[\[([^\]]+)\]\]/g))].map(m => m[1].trim()))];

function save(a) {
  const code = String(a.code || ''); if (!code.trim()) throw new Error('code is empty');
  const h = hash(code); const dup = all().find(s => s.hash === h);
  if (dup) return 'Already saved as "' + dup.title + '" (id ' + dup.id + ') - nothing changed. Reuse it with snippet_get.';
  const title = a.title || 'Snippet ' + h; let id = slug(title), n = 2;
  while (fs.existsSync(path.join(DIR, id + '.md'))) id = slug(title) + '-' + n++;
  const tags = (a.tags || []).map(t => String(t).replace(/^#/, '').toLowerCase());
  const lang = (a.lang || '').toLowerCase();
  write({ id, title, lang, tags: [...new Set(tags.concat(lang ? [lang] : []))], hash: h, created: new Date().toISOString().slice(0, 10), source: a.source || '', code, notes: a.notes || '' });
  return 'Saved "' + title + '" as ' + id + '.md in ' + DIR;
}
function search(a) {
  const q = String(a.query || '').toLowerCase().split(/\s+/).filter(Boolean), tag = a.tag ? String(a.tag).replace(/^#/, '').toLowerCase() : '';
  const rows = all().filter(s => (!tag || s.tags.includes(tag)) && (!a.lang || s.lang === String(a.lang).toLowerCase()))
    .map(s => { const hay = (s.title + ' ' + s.tags.join(' ') + ' ' + s.notes + ' ' + s.code).toLowerCase(); let sc = 0; for (const w of q) { if (!hay.includes(w)) { sc = -1; break; } sc += (s.title.toLowerCase().includes(w) ? 5 : 0) + (s.tags.includes(w) ? 3 : 0) + 1; } return { s, sc }; })
    .filter(r => r.sc >= 0).sort((x, y) => y.sc - x.sc).slice(0, +a.limit || 10);
  return rows.map(r => r.s.id + ' - ' + r.s.title + ' [' + (r.s.lang || '?') + '] #' + r.s.tags.join(' #') + ' (' + r.s.code.split('\n').length + ' lines)').join('\n') || 'No matching snippets.';
}
function get(a) {
  const s = find(a.id); if (!s) throw new Error('No snippet "' + a.id + '". Try snippet_search.');
  const back = all().filter(o => o.id !== s.id && links(o).some(l => slug(l) === s.id || l.toLowerCase() === s.title.toLowerCase())).map(o => o.title);
  return '# ' + s.title + '\nlang: ' + s.lang + ' | tags: ' + s.tags.join(', ') + (s.source ? ' | source: ' + s.source : '') + '\n\n```' + s.lang + '\n' + s.code + '\n```\n' + (s.notes ? '\n' + s.notes + '\n' : '') + (links(s).length ? '\nLinks: ' + links(s).join(', ') : '') + (back.length ? '\nLinked from: ' + back.join(', ') : '');
}
function link(a) {
  const x = find(a.from), y = find(a.to); if (!x || !y) throw new Error('Both snippets must exist (from / to).');
  if (links(x).some(l => slug(l) === y.id)) return 'Already linked.';
  x.notes = (x.notes ? x.notes + '\n' : '') + (a.note ? a.note + ' ' : 'Related: ') + '[[' + y.title + ']]'; write(x);
  return x.title + ' -> ' + y.title + ' linked.';
}
function list() {
  const a = all(); if (!a.length) return 'The vault is empty. Save code with snippet_save.';
  const tags = {}; for (const s of a) for (const t of s.tags) tags[t] = (tags[t] || 0) + 1;
  return a.length + ' snippets in ' + DIR + '\nTags: ' + Object.entries(tags).sort((p, q) => q[1] - p[1]).map(([t, n]) => t + '(' + n + ')').join(', ') + '\n\n' + a.sort((p, q) => q.created.localeCompare(p.created)).slice(0, 30).map(s => s.id + ' - ' + s.title + ' [' + (s.lang || '?') + ']').join('\n');
}
function del(a) { const s = find(a.id); if (!s) throw new Error('No snippet "' + a.id + '".'); fs.unlinkSync(path.join(DIR, s.id + '.md')); return 'Deleted ' + s.title; }

const obj = (props, req) => ({ type: 'object', properties: props, required: req || [] });
const TOOLS = [
  { name: 'snippet_search', description: 'Search the code vault BEFORE writing code. Returns matching saved snippets (id, title, language, tags). Reuse a hit with snippet_get instead of rebuilding it.', inputSchema: obj({ query: { type: 'string' }, tag: { type: 'string' }, lang: { type: 'string' }, limit: { type: 'number' } }) },
  { name: 'snippet_get', description: 'Get the full code and notes of a saved snippet by id or exact title, including its [[links]] and backlinks.', inputSchema: obj({ id: { type: 'string' } }, ['id']) },
  { name: 'snippet_save', description: 'Save reusable code to the vault. Duplicates are detected and skipped. Add notes with [[Other Snippet]] links to connect related code.', inputSchema: obj({ title: { type: 'string' }, code: { type: 'string' }, lang: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' }, source: { type: 'string' } }, ['title', 'code']) },
  { name: 'snippet_link', description: 'Link one snippet to another (adds a [[wikilink]] note, Obsidian style).', inputSchema: obj({ from: { type: 'string' }, to: { type: 'string' }, note: { type: 'string' } }, ['from', 'to']) },
  { name: 'snippet_list', description: 'Overview of the vault: count, tags and the newest snippets.', inputSchema: obj({}) },
  { name: 'snippet_delete', description: 'Delete a snippet from the vault.', inputSchema: obj({ id: { type: 'string' } }, ['id']) },
];
const run = { snippet_search: search, snippet_get: get, snippet_save: save, snippet_link: link, snippet_list: list, snippet_delete: del };

function handle(m) {
  if (m.id === undefined) return null;
  const ok = result => ({ jsonrpc: '2.0', id: m.id, result }), bad = (code, message) => ({ jsonrpc: '2.0', id: m.id, error: { code, message } });
  if (m.method === 'initialize') return ok({ protocolVersion: (m.params && m.params.protocolVersion) || '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'codestash', version: '1.0.0' } });
  if (m.method === 'ping') return ok({});
  if (m.method === 'tools/list') return ok({ tools: TOOLS });
  if (m.method === 'tools/call') {
    const f = run[m.params.name]; if (!f) return bad(-32602, 'Unknown tool ' + m.params.name);
    try { return ok({ content: [{ type: 'text', text: f(m.params.arguments || {}) }] }); } catch (e) { return ok({ isError: true, content: [{ type: 'text', text: e.message }] }); }
  }
  return bad(-32601, 'Method not found: ' + m.method);
}
readline.createInterface({ input: process.stdin }).on('line', line => { let m; try { m = JSON.parse(line); } catch { return; } const out = handle(m); if (out) process.stdout.write(JSON.stringify(out) + '\n'); });
console.error('codestash MCP ready, vault: ' + DIR);
