---
"@ggts-sh/core": patch
---

A hex layer no longer writes path vertices outside the panel. A cell at the edge of the data now ends at the panel edge on its original outline, so the drawn shape does not change. A cell that lies fully outside the panel writes no path. Panels that do not clip, and polar panels, keep their paths as before.
