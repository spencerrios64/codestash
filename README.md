# codestash

An Obsidian-style vault for the code your AI writes. Every code block becomes a searchable note, so you **copy it back instead of having the AI rebuild it**. It comes as a web app and as a Claude plugin, and both use the same note format.

- Web app (works offline, one HTML file): https://spencerrios64.github.io/codestash/
- Claude plugin: skill + MCP server + `/stash` command

## Web app

- **Import chats**: ChatGPT and Claude `conversations.json`, markdown notes, or text. Only the AI's replies are scanned; every fenced code block is saved with a title, language tag and source chat. Duplicates are skipped.
- **Load hub chats**: pulls whatever you already loaded in the [chathub](https://github.com/spencerrios64/chathub) tools (chatzip, chatvault...).
- **Obsidian style**: search, `#tags`, `[[wikilinks]]` between snippets, links and "linked from" panels.
- **Reuse**: one click to **Copy code**, **Copy as markdown**, or **Download file**.
- Paste code anywhere on the page, or drop files, to save it.
- **Export vault (.zip)**: one `.md` per snippet. Unzip into an Obsidian vault or into `~/.codestash/vault` and the plugin sees them too.
- Data stays in your browser (IndexedDB). Use **Backup JSON** to keep a copy.

## Claude plugin

Install from Claude Code:

~~~
/plugin marketplace add spencerrios64/codestash
/plugin install codestash@spencerrios64-tools
~~~

It needs Node 18+ (no packages). What you get:

- **MCP tools**: `snippet_search`, `snippet_get`, `snippet_save`, `snippet_link`, `snippet_list`, `snippet_delete`
- **Skill**: tells Claude to search the vault before writing code, reuse a hit as it is, and save new reusable code afterwards
- **`/stash`**: `/stash save` saves the reusable code from the current chat, `/stash search <words>`, `/stash list`
- **Auto-save hook**: every time Claude Code writes a file, a hook (`hooks/autosave.mjs`) saves it to the vault by itself, and updates the same note if the file is written again. Nothing to remember or ask for. Files under 4 lines, lockfiles and logs are skipped (change the minimum with `CODESTASH_MIN`).

The vault is a plain folder of markdown files: `~/.codestash/vault` by default, or set `CODESTASH_DIR`. Open that folder in Obsidian to browse it, or zip it up and import it in the web app (select the `.md` files with Import).

You can also use the server without the plugin, for example in Claude Desktop or Cursor:

~~~
{ "mcpServers": { "codestash": { "command": "node", "args": ["/path/to/codestash/mcp/codestash-mcp.mjs"] } } }
~~~

## Note format

~~~
---
title: Debounce helper
lang: javascript
tags: [util, javascript]
hash: f681e825e2
created: 2026-11-17
---

```javascript
function debounce(f,ms){...}
```

Used by [[Search box]]
~~~

The `hash` (SHA-1 of the whitespace-normalised code) is the same in the web app and the plugin, so duplicates are caught across both.

## Limits

Titles are guessed from the text before each code block, so rename anything odd. Code shorter than 3 lines is skipped on import (change it in the sidebar). The web app and the plugin do not sync by themselves; move notes between them with the zip export / Import.

## Import everything Claude Code wrote

Claude Code keeps every session on your PC as `.jsonl` files in `~/.claude/projects`. The `import-claude-code.mjs` script (Node 18+) reads them, takes every file Claude wrote (the latest version of each file) plus code blocks in its replies, skips lockfiles and tiny files, and removes duplicates.

```
node import-claude-code.mjs --dry                  # preview, writes nothing
node import-claude-code.mjs                        # save into your vault (~/.codestash/vault)
node import-claude-code.mjs --json-only my.json    # make one file to Import in the web app
```

Options: `--dir` (sessions folder), `--vault`, `--min` (shortest snippet in lines, default 4), `--no-fences` (only written files). Notes are tagged `claude-code` plus the project name. Running it again only adds what is new.
