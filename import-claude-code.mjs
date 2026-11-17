#!/usr/bin/env node
// import-claude-code.mjs - pull the code Claude Code wrote on this PC into codestash.
// Reads ~/.claude/projects/**/*.jsonl, takes every file Claude wrote (Write tool; the latest version of each
// file wins) plus fenced code blocks in its replies, and saves them as codestash notes.
//
//   node import-claude-code.mjs                      -> notes go into your vault (CODESTASH_DIR or ~/.codestash/vault)
//   node import-claude-code.mjs --json backup.json   -> also/only make a file the web app can Import in one click
//   options: --dir <folder with .jsonl>  --vault <folder>  --min <lines, default 4>  --no-fences  --dry  --json-only
// No dependencies; Node 18+.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const flag = n => args.includes(n);
const SRC = opt('--dir', path.join(os.homedir(), '.claude', 'projects'));
const VAULT = opt('--vault', process.env.CODESTASH_DIR || path.join(os.homedir(), '.codestash', 'vault'));
const JSONOUT = opt('--json', '');
const MIN = +opt('--min', 4);
const F = String.fromCharCode(96).repeat(3);

const hash = c => crypto.createHash('sha1').update(c.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 10);
const slug = s => (s || 'snippet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'snippet';
const LANG = { js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', sh: 'bash', ps1: 'powershell', bat: 'batch', lua: 'lua', luau: 'lua', html: 'html', css: 'css', json: 'json', cs: 'csharp', cpp: 'cpp', c: 'c', h: 'c', java: 'java', go: 'go', rs: 'rust', sql: 'sql', gd: 'gdscript', yml: 'yaml', yaml: 'yaml', md: 'markdown', toml: 'toml', rb: 'ruby', php: 'php', kt: 'kotlin', swift: 'swift' };
const SKIP = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.(js|css)|node_modules|\.log$|\.svg$|\.lock$)/i;
const normLang = l => { l = (l || '').trim().split(/\s+/)[0].toLowerCase(); return { js: 'javascript', ts: 'typescript', py: 'python', sh: 'bash', shell: 'bash', zsh: 'bash', 'c#': 'csharp', 'c++': 'cpp', yml: 'yaml', md: 'markdown' }[l] || l; };

function walk(dir, out = []) {
  let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else if (e.name.endsWith('.jsonl')) out.push(p); }
  return out;
}
function extractFences(text) {
  const out = []; const re = new RegExp(F + '([^\\n]*)\\n([\\s\\S]*?)\\n?' + F, 'g'); let last = 0, m;
  while ((m = re.exec(text))) {
    const before = text.slice(last, m.index); last = re.lastIndex;
    const code = m[2].replace(/\s+$/, ''); if (!code.trim() || code.split('\n').length < Math.max(MIN, 5)) continue;
    const lines = before.split('\n').map(l => l.replace(/^[#>*\-\s\d.]+/, '').replace(/[*_]/g, '').replace(/[:\s]+$/, '').trim()).filter(Boolean);
    let t = lines.length ? lines[lines.length - 1] : ''; if (t.length < 6 || t.length > 70) t = '';
    out.push({ lang: normLang(m[1]), code, title: t });
  }
  return out;
}

const files = walk(SRC);
if (!files.length) { console.error('No .jsonl sessions found in ' + SRC + '. Use --dir to point at the folder.'); process.exit(1); }
const written = new Map(); // file_path -> {content, project, when}
const fenced = [];
let lines = 0, bad = 0;
for (const f of files) {
  const project = path.basename(path.dirname(f)).replace(/^-+/, '').split('-').slice(-2).join('-') || 'claude-code';
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (!line.trim()) continue; let j; try { j = JSON.parse(line); } catch { bad++; continue; } lines++;
    const msg = j.message; if (j.type !== 'assistant' || !msg || !Array.isArray(msg.content)) continue;
    for (const b of msg.content) {
      if (b.type === 'tool_use' && b.name === 'Write' && b.input && typeof b.input.content === 'string' && b.input.file_path) {
        const fp = String(b.input.file_path); if (SKIP.test(fp)) continue;
        written.set(project + '|' + fp, { fp, project, content: b.input.content, when: (j.timestamp || '').slice(0, 10) });
      } else if (b.type === 'text' && typeof b.text === 'string' && !flag('--no-fences') && b.text.includes(F)) {
        for (const x of extractFences(b.text)) fenced.push({ ...x, project, when: (j.timestamp || '').slice(0, 10) });
      }
    }
  }
}

const snips = []; const seen = new Set();
const add = (s) => { s.code = s.code.replace(/\s+$/, ''); if (!s.code.trim() || s.code.split('\n').length < MIN) return; s.hash = hash(s.code); if (seen.has(s.hash)) return; seen.add(s.hash); snips.push(s); };
for (const w of written.values()) {
  const base = path.basename(w.fp), ext = path.extname(base).slice(1).toLowerCase(), lang = LANG[ext] || ext || 'text';
  add({ title: base + ' (' + w.project + ')', lang, tags: [lang, 'claude-code', w.project.toLowerCase()], created: w.when || new Date().toISOString().slice(0, 10), source: 'claude-code / ' + w.fp, code: w.content, notes: '' });
}
for (const x of fenced) {
  const lang = x.lang || 'text';
  add({ title: x.title || (lang + ' snippet (' + x.project + ')'), lang, tags: [lang, 'claude-code', x.project.toLowerCase()], created: x.when || new Date().toISOString().slice(0, 10), source: 'claude-code / ' + x.project, code: x.code, notes: '' });
}
console.log('Scanned ' + files.length + ' sessions (' + lines + ' lines' + (bad ? ', ' + bad + ' unreadable' : '') + '): ' + written.size + ' written files, ' + fenced.length + ' code blocks -> ' + snips.length + ' unique snippets.');
if (flag('--dry')) { snips.slice(0, 15).forEach(s => console.log(' - ' + s.title + ' [' + s.lang + '] ' + s.code.split('\n').length + ' lines')); console.log('(dry run, nothing written)'); process.exit(0); }

if (JSONOUT) { fs.writeFileSync(JSONOUT, JSON.stringify({ codestash: 1, snippets: snips.map(s => ({ ...s, id: slug(s.title) })) }, null, 1)); console.log('Wrote ' + JSONOUT + ' - open the codestash web page and use Import chats / notes.'); }
if (!flag('--json-only')) {
  fs.mkdirSync(VAULT, { recursive: true });
  const have = new Set(); for (const f of fs.readdirSync(VAULT)) if (f.endsWith('.md')) { const m = fs.readFileSync(path.join(VAULT, f), 'utf8').match(/^hash:\s*(\w+)/m); if (m) have.add(m[1]); }
  let n = 0, dup = 0;
  for (const s of snips) {
    if (have.has(s.hash)) { dup++; continue; }
    let id = slug(s.title), k = 2; while (fs.existsSync(path.join(VAULT, id + '.md'))) id = slug(s.title) + '-' + k++;
    const fm = ['---', 'title: ' + s.title, 'lang: ' + s.lang, 'tags: [' + [...new Set(s.tags)].join(', ') + ']', 'hash: ' + s.hash, 'created: ' + s.created, 'source: ' + s.source, '---'].join('\n');
    fs.writeFileSync(path.join(VAULT, id + '.md'), fm + '\n\n' + F + s.lang + '\n' + s.code + '\n' + F + '\n'); n++;
  }
  console.log('Vault ' + VAULT + ': added ' + n + ', already there ' + dup + '.');
}
