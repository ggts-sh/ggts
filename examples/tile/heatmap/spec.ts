import { aes, gg, guideColorbar, scaleFillContinuous } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { cholera1849 } from "./data.js";

export default defineExample(
  gg(cholera1849, aes({ x: "week", y: "weekday", fill: "deaths" }))
    .geomTile()
    .scales(scaleFillContinuous({ scheme: "viridis" }))
    // Weeks are numeric but read as a band here — one column per week — and the
    // weekday domain is reversed so Sunday sits at the top of a calendar.
    // CoordFixed keeps each week×weekday cell square (equal band units).
    // Mon/Wed/Fri labels match the usual calendar-heatmap density.
    // No panel grid: incomplete weeks leave real holes, not empty bordered cells.
    .scales({
      x: { type: "band" },
      y: {
        type: "band",
        domain: ["Sat", "Fri", "Thu", "Wed", "Tue", "Mon", "Sun"],
        breaks: ["Mon", "Wed", "Fri"],
      },
    })
    .coordFixed()
    .theme({ name: "light", grid: "none", gridX: false, gridY: false })
    .guides({
      fill: guideColorbar({ position: "bottom", direction: "horizontal" }),
    })
    .labs({
      title: "Cholera in England and Wales, 1849",
      subtitle: "53,293 deaths. Peak 1,121 on 6 September",
      x: "Week of 1849",
      y: "",
      fill: "Deaths",
    })
    .spec(),
);
