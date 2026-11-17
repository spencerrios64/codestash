#!/usr/bin/env node
// autosave.mjs - codestash hook. Runs after Claude Code writes a file and saves it to the vault automatically.
// Same file written again -> the note is updated (latest version wins). Never blocks or prints anything.
// Vault: CODESTASH_DIR or ~/.codestash/vault. Shortest file saved: CODESTASH_MIN lines (default 4).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const F = String.fromCharCode(96).repeat(3);
const VAULT = process.env.CODESTASH_DIR || path.join(os.homedir(), '.codestash', 'vault');
const MIN = +(process.env.CODESTASH_MIN || 4);
const LANG = { js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', py: 'python', sh: 'bash', ps1: 'powershell', bat: 'batch', lua: 'lua', luau: 'lua', html: 'html', css: 'css', json: 'json', cs: 'csharp', cpp: 'cpp', c: 'c', h: 'c', java: 'java', go: 'go', rs: 'rust', sql: 'sql', gd: 'gdscript', yml: 'yaml', yaml: 'yaml', md: 'markdown', toml: 'toml', rb: 'ruby', php: 'php', kt: 'kotlin', swift: 'swift' };
const SKIP = /(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|\.min\.(js|css)|node_modules|\.log$|\.svg$|\.lock$|CLAUDE\.md$)/i;
const hash = c => crypto.createHash('sha1').update(c.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 10);
const slug = s => (s || 'snippet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'snippet';

function run(input) {
  let j; try { j = JSON.parse(input); } catch { return; }
  if (j.tool_name !== 'Write' || !j.tool_input) return;
  const fp = String(j.tool_input.file_path || ''), code = String(j.tool_input.content || '').replace(/\s+$/, '');
  if (!fp || SKIP.test(fp) || !code.trim() || code.split('\n').length < MIN) return;
  const base = path.basename(fp), ext = path.extname(base).slice(1).toLowerCase(), lang = LANG[ext] || ext || 'text';
  const project = path.basename(j.cwd || path.dirname(fp)) || 'project';
  const source = 'claude-code / ' + fp, h = hash(code);
  fs.mkdirSync(VAULT, { recursive: true });
  let same = null, hashHit = false;
  for (const f of fs.readdirSync(VAULT)) {
    if (!f.endsWith('.md')) continue;
    const t = fs.readFileSync(path.join(VAULT, f), 'utf8');
    const hm = t.match(/^hash:\s*(\w+)/m), sm = t.match(/^source:\s*(.*)$/m);
    if (hm && hm[1] === h) hashHit = true;
    if (sm && sm[1].trim() === source) same = { f, t };
  }
  if (hashHit) return;
  const today = new Date().toISOString().slice(0, 10);
  if (same) { // same file written again: update that note, keep its tags/notes/created
    const m = same.t.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/); if (!m) return;
    const fm = m[1].replace(/^hash:.*$/m, 'hash: ' + h), re = new RegExp(F + '[^\\n]*\\n[\\s\\S]*?\\n' + F);
    const rest = m[2].replace(re, () => F + lang + '\n' + code + '\n' + F);
    fs.writeFileSync(path.join(VAULT, same.f), '---\n' + fm + '\n---\n' + rest);
    return;
  }
  const title = base + ' (' + project + ')';
  let id = slug(title), k = 2; while (fs.existsSync(path.join(VAULT, id + '.md'))) id = slug(title) + '-' + k++;
  const tags = [...new Set([lang, 'claude-code', project.toLowerCase()])];
  const head = ['---', 'title: ' + title, 'lang: ' + lang, 'tags: [' + tags.join(', ') + ']', 'hash: ' + h, 'created: ' + today, 'source: ' + source, '---'].join('\n');
  fs.writeFileSync(path.join(VAULT, id + '.md'), head + '\n\n' + F + lang + '\n' + code + '\n' + F + '\n');
}
let buf = ''; process.stdin.setEncoding('utf8');
process.stdin.on('data', d => buf += d);
process.stdin.on('end', () => { try { run(buf); } catch { /* never block Claude */ } process.exit(0); });
