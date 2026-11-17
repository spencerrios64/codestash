---
description: Save code from this conversation to the code vault, or search the vault
argument-hint: [save | search <words> | list]
---

The user ran /stash with: $ARGUMENTS

- `save` (or no argument): find the reusable code Claude wrote in this conversation and save each piece with `snippet_save` (clear title, language, tags, a one-line note, and `[[links]]` to related snippets). Skip duplicates and throwaway code. Report what was saved.
- `search <words>`: call `snippet_search`, then show the matches and offer to open one with `snippet_get`.
- `list`: call `snippet_list` and summarise.
