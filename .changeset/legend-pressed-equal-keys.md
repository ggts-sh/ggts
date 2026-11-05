---
"@ggts-sh/core": patch
"@ggts-sh/react": patch
---

A click on an entry of the second legend now presses that entry in the React host when two legends have entries with the same rows. The React host used to press the matching entry of the first legend. When emphasis keys from a controller match two entries, the React host now presses none, as the Svelte host does.
