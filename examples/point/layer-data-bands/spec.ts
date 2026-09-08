import { gg } from "@ggts-sh/spec";

import { defineExample } from "../../define.js";
import { callouts, nationalDebt, warYears } from "./data.js";

export default defineExample(
  // Three tables, three layers, one panel. The bands and the note are not
  // measurements and do not belong in the series, so each layer brings its own
  // data and its own aes rather than inheriting a shape that does not fit.
  gg()
    .geomRect({
      data: warYears,
      aes: { xmin: "xmin", xmax: "xmax", ymin: "ymin", ymax: "ymax", fill: "war" },
      alpha: 0.18,
    })
    .geomLine({
      data: nationalDebt,
      aes: { x: "year", y: "debt" },
      linewidth: 1.8,
    })
    .geomText({
      data: callouts,
      aes: { x: "year", y: "debt", label: "label" },
      size: 12,
    })
    .theme("classic")
    .labs({
      title: "What the wars did to the national debt",
      subtitle: "Playfair's series, 1770 to 1824, with the war years drawn behind it",
      x: "Year",
      y: "Debt (£ millions)",
      fill: "",
    })
    .spec(),
);
