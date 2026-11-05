---
"@ggts-sh/react": patch
---

Stop rebuilding SVG markup when only the interaction masks change on a canvas chart. Each paint for a selection, an emphasis, a legend press, or a `muteSiblings` hover rebuilt the SVG of the axes and labels and compared it with the DOM. On 7 years of daily bars, a `muteSiblings` hover move goes from 19 ms to 2 ms. Charts with few SVG nodes do not change. Rendered output does not change. An outside edit to that SVG, such as one from a browser extension, now stays until the scene changes, where each paint used to undo it.
