/**
 * Tooltip chrome policy for theme-aware default content (#1069).
 *
 * Visual roles (paper / ink / border) live on the theme. This helper decides
 * whether the default instructional footer ("Click to pin", overflow pin hint)
 * belongs with that chrome — flat (gridless) themes drop to text on paper and
 * stay silent; pinned-disabled inspect configs never advertise pinning.
 */

export { shouldShowTooltipPinHint } from "@ggts-sh/core/interaction";
