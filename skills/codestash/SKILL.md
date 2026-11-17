---
name: codestash
description: Use when writing or editing code. Search the user's code vault first and reuse saved snippets instead of rebuilding; save any new reusable code afterwards.
---

# codestash

The user keeps a vault of code that AI has already written for them (Obsidian-style notes, one snippet per file). Use it so work is never rebuilt from scratch.

## Before writing code
1. Call `snippet_search` with a few keywords for what is needed (a function, a game system, a UI piece, a script). Try the language and tag filters too.
2. If something fits, call `snippet_get` and **copy that code as it is**, changing only what the task needs. Tell the user which snippet you reused.
3. If nothing fits, write the code as usual.

## After writing code
Save code that is likely to be reused (helpers, modules, scripts, templates, systems) with `snippet_save`:
- `title`: short and descriptive, in the words the user would search for
- `lang`, and `tags` for the topic (for example `roblox`, `ui`, `util`)
- `notes`: one line on what it does, with `[[Other Snippet]]` links to related snippets
Do not save throwaway one-liners, and do not re-save code that is already in the vault (duplicates are detected and skipped).

## Keeping it connected
Use `snippet_link` to connect snippets that depend on each other. `snippet_list` shows the vault overview and tags.

## Notes
- The vault is a plain folder of markdown files (default `~/.codestash/vault`, or `CODESTASH_DIR`). The user can open it in Obsidian or in the codestash web page.
- Never delete snippets unless the user asks.
