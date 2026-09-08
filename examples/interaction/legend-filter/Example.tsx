"use client";

import { useId, useState } from "react";
import {
  GGPlot,
  GeomLine,
  GeomPoint,
  GuideLegend,
  Inspect,
  Labs,
  ScaleXContinuous,
  ThemeFivethirtyeight,
} from "@ggsvelte/react";

// HistData::Playfair1824 national finances, in Playfair's index units.
const finances = [
  { id: "debt-1770", year: 1770, series: "National debt", value: 13.96 },
  { id: "debt-1771", year: 1771, series: "National debt", value: 13.97 },
  { id: "debt-1772", year: 1772, series: "National debt", value: 13.67 },
  { id: "debt-1773", year: 1773, series: "National debt", value: 13.68 },
  { id: "debt-1774", year: 1774, series: "National debt", value: 13.69 },
  { id: "debt-1775", year: 1775, series: "National debt", value: 14.88 },
  { id: "debt-1776", year: 1776, series: "National debt", value: 16.07 },
  { id: "debt-1777", year: 1777, series: "National debt", value: 16.97 },
  { id: "debt-1778", year: 1778, series: "National debt", value: 18.16 },
  { id: "debt-1779", year: 1779, series: "National debt", value: 19.06 },
  { id: "debt-1780", year: 1780, series: "National debt", value: 20.55 },
  { id: "debt-1781", year: 1781, series: "National debt", value: 21.74 },
  { id: "debt-1782", year: 1782, series: "National debt", value: 22.94 },
  { id: "debt-1783", year: 1783, series: "National debt", value: 24.43 },
  { id: "debt-1784", year: 1784, series: "National debt", value: 24.43 },
  { id: "debt-1785", year: 1785, series: "National debt", value: 24.44 },
  { id: "debt-1786", year: 1786, series: "National debt", value: 24.44 },
  { id: "debt-1787", year: 1787, series: "National debt", value: 24.45 },
  { id: "debt-1788", year: 1788, series: "National debt", value: 24.46 },
  { id: "debt-1789", year: 1789, series: "National debt", value: 24.46 },
  { id: "debt-1790", year: 1790, series: "National debt", value: 24.76 },
  { id: "debt-1791", year: 1791, series: "National debt", value: 24.77 },
  { id: "debt-1792", year: 1792, series: "National debt", value: 24.77 },
  { id: "debt-1793", year: 1793, series: "National debt", value: 25.08 },
  { id: "debt-1794", year: 1794, series: "National debt", value: 27.75 },
  { id: "debt-1795", year: 1795, series: "National debt", value: 30.73 },
  { id: "debt-1796", year: 1796, series: "National debt", value: 33.71 },
  { id: "debt-1797", year: 1797, series: "National debt", value: 36.98 },
  { id: "debt-1798", year: 1798, series: "National debt", value: 39.96 },
  { id: "debt-1799", year: 1799, series: "National debt", value: 41.15 },
  { id: "debt-1800", year: 1800, series: "National debt", value: 42.34 },
  { id: "debt-1801", year: 1801, series: "National debt", value: 43.54 },
  { id: "debt-1802", year: 1802, series: "National debt", value: 44.73 },
  { id: "debt-1803", year: 1803, series: "National debt", value: 44.74 },
  { id: "debt-1804", year: 1804, series: "National debt", value: 45.04 },
  { id: "debt-1805", year: 1805, series: "National debt", value: 45.94 },
  { id: "debt-1806", year: 1806, series: "National debt", value: 47.43 },
  { id: "debt-1807", year: 1807, series: "National debt", value: 49.21 },
  { id: "debt-1808", year: 1808, series: "National debt", value: 51.6 },
  { id: "debt-1809", year: 1809, series: "National debt", value: 54.57 },
  { id: "debt-1810", year: 1810, series: "National debt", value: 57.84 },
  { id: "debt-1811", year: 1811, series: "National debt", value: 61.12 },
  { id: "debt-1812", year: 1812, series: "National debt", value: 64.39 },
  { id: "debt-1813", year: 1813, series: "National debt", value: 67.66 },
  { id: "debt-1814", year: 1814, series: "National debt", value: 70.94 },
  { id: "debt-1815", year: 1815, series: "National debt", value: 73.91 },
  { id: "debt-1816", year: 1816, series: "National debt", value: 74.81 },
  { id: "debt-1817", year: 1817, series: "National debt", value: 75.11 },
  { id: "debt-1818", year: 1818, series: "National debt", value: 75.12 },
  { id: "debt-1819", year: 1819, series: "National debt", value: 75.42 },
  { id: "debt-1820", year: 1820, series: "National debt", value: 75.42 },
  { id: "debt-1821", year: 1821, series: "National debt", value: 75.73 },
  { id: "debt-1822", year: 1822, series: "National debt", value: 75.73 },
  { id: "debt-1823", year: 1823, series: "National debt", value: 76.03 },
  { id: "debt-1824", year: 1824, series: "National debt", value: 76.04 },
  { id: "revenue-1770", year: 1770, series: "Revenue", value: 7.72 },
  { id: "revenue-1771", year: 1771, series: "Revenue", value: 8.03 },
  { id: "revenue-1772", year: 1772, series: "Revenue", value: 8.03 },
  { id: "revenue-1773", year: 1773, series: "Revenue", value: 7.74 },
  { id: "revenue-1774", year: 1774, series: "Revenue", value: 8.04 },
  { id: "revenue-1775", year: 1775, series: "Revenue", value: 8.34 },
  { id: "revenue-1776", year: 1776, series: "Revenue", value: 8.94 },
  { id: "revenue-1777", year: 1777, series: "Revenue", value: 9.54 },
  { id: "revenue-1778", year: 1778, series: "Revenue", value: 10.74 },
  { id: "revenue-1779", year: 1779, series: "Revenue", value: 11.63 },
  { id: "revenue-1780", year: 1780, series: "Revenue", value: 12.53 },
  { id: "revenue-1781", year: 1781, series: "Revenue", value: 13.43 },
  { id: "revenue-1782", year: 1782, series: "Revenue", value: 14.32 },
  { id: "revenue-1783", year: 1783, series: "Revenue", value: 16.11 },
  { id: "revenue-1784", year: 1784, series: "Revenue", value: 15.82 },
  { id: "revenue-1785", year: 1785, series: "Revenue", value: 15.82 },
  { id: "revenue-1786", year: 1786, series: "Revenue", value: 15.83 },
  { id: "revenue-1787", year: 1787, series: "Revenue", value: 16.13 },
  { id: "revenue-1788", year: 1788, series: "Revenue", value: 16.14 },
  { id: "revenue-1789", year: 1789, series: "Revenue", value: 16.44 },
  { id: "revenue-1790", year: 1790, series: "Revenue", value: 16.45 },
  { id: "revenue-1791", year: 1791, series: "Revenue", value: 16.75 },
  { id: "revenue-1792", year: 1792, series: "Revenue", value: 16.75 },
  { id: "revenue-1793", year: 1793, series: "Revenue", value: 16.76 },
  { id: "revenue-1794", year: 1794, series: "Revenue", value: 18.25 },
  { id: "revenue-1795", year: 1795, series: "Revenue", value: 20.33 },
  { id: "revenue-1796", year: 1796, series: "Revenue", value: 22.42 },
  { id: "revenue-1797", year: 1797, series: "Revenue", value: 24.5 },
  { id: "revenue-1798", year: 1798, series: "Revenue", value: 26 },
  { id: "revenue-1799", year: 1799, series: "Revenue", value: 36.69 },
  { id: "revenue-1800", year: 1800, series: "Revenue", value: 38.48 },
  { id: "revenue-1801", year: 1801, series: "Revenue", value: 40.86 },
  { id: "revenue-1802", year: 1802, series: "Revenue", value: 42.95 },
  { id: "revenue-1803", year: 1803, series: "Revenue", value: 32.26 },
  { id: "revenue-1804", year: 1804, series: "Revenue", value: 32.27 },
  { id: "revenue-1805", year: 1805, series: "Revenue", value: 37.92 },
  { id: "revenue-1806", year: 1806, series: "Revenue", value: 45.35 },
  { id: "revenue-1807", year: 1807, series: "Revenue", value: 47.13 },
  { id: "revenue-1808", year: 1808, series: "Revenue", value: 48.33 },
  { id: "revenue-1809", year: 1809, series: "Revenue", value: 50.41 },
  { id: "revenue-1810", year: 1810, series: "Revenue", value: 52.79 },
  { id: "revenue-1811", year: 1811, series: "Revenue", value: 55.47 },
  { id: "revenue-1812", year: 1812, series: "Revenue", value: 57.56 },
  { id: "revenue-1813", year: 1813, series: "Revenue", value: 60.24 },
  { id: "revenue-1814", year: 1814, series: "Revenue", value: 62.62 },
  { id: "revenue-1815", year: 1815, series: "Revenue", value: 65 },
  { id: "revenue-1816", year: 1816, series: "Revenue", value: 57.28 },
  { id: "revenue-1817", year: 1817, series: "Revenue", value: 55.8 },
  { id: "revenue-1818", year: 1818, series: "Revenue", value: 55.21 },
  { id: "revenue-1819", year: 1819, series: "Revenue", value: 54.63 },
  { id: "revenue-1820", year: 1820, series: "Revenue", value: 54.04 },
  { id: "revenue-1821", year: 1821, series: "Revenue", value: 54.04 },
  { id: "revenue-1822", year: 1822, series: "Revenue", value: 53.45 },
  { id: "revenue-1823", year: 1823, series: "Revenue", value: 53.46 },
  { id: "revenue-1824", year: 1824, series: "Revenue", value: 53.17 },
  { id: "expenditure-1770", year: 1770, series: "Expenditure", value: 9.21 },
  { id: "expenditure-1771", year: 1771, series: "Expenditure", value: 9.21 },
  { id: "expenditure-1772", year: 1772, series: "Expenditure", value: 9.22 },
  { id: "expenditure-1773", year: 1773, series: "Expenditure", value: 9.22 },
  { id: "expenditure-1774", year: 1774, series: "Expenditure", value: 9.23 },
  { id: "expenditure-1775", year: 1775, series: "Expenditure", value: 9.24 },
  { id: "expenditure-1776", year: 1776, series: "Expenditure", value: 13.1 },
  { id: "expenditure-1777", year: 1777, series: "Expenditure", value: 14.59 },
  { id: "expenditure-1778", year: 1778, series: "Expenditure", value: 20.54 },
  { id: "expenditure-1779", year: 1779, series: "Expenditure", value: 22.33 },
  { id: "expenditure-1780", year: 1780, series: "Expenditure", value: 25.01 },
  { id: "expenditure-1781", year: 1781, series: "Expenditure", value: 28.28 },
  { id: "expenditure-1782", year: 1782, series: "Expenditure", value: 32.74 },
  { id: "expenditure-1783", year: 1783, series: "Expenditure", value: 16.11 },
  { id: "expenditure-1784", year: 1784, series: "Expenditure", value: 15.82 },
  { id: "expenditure-1785", year: 1785, series: "Expenditure", value: 15.82 },
  { id: "expenditure-1786", year: 1786, series: "Expenditure", value: 15.83 },
  { id: "expenditure-1787", year: 1787, series: "Expenditure", value: 16.13 },
  { id: "expenditure-1788", year: 1788, series: "Expenditure", value: 16.14 },
  { id: "expenditure-1789", year: 1789, series: "Expenditure", value: 16.44 },
  { id: "expenditure-1790", year: 1790, series: "Expenditure", value: 16.45 },
  { id: "expenditure-1791", year: 1791, series: "Expenditure", value: 16.75 },
  { id: "expenditure-1792", year: 1792, series: "Expenditure", value: 16.75 },
  { id: "expenditure-1793", year: 1793, series: "Expenditure", value: 16.76 },
  { id: "expenditure-1794", year: 1794, series: "Expenditure", value: 21.22 },
  { id: "expenditure-1795", year: 1795, series: "Expenditure", value: 29.54 },
  { id: "expenditure-1796", year: 1796, series: "Expenditure", value: 38.16 },
  { id: "expenditure-1797", year: 1797, series: "Expenditure", value: 43.51 },
  { id: "expenditure-1798", year: 1798, series: "Expenditure", value: 49.16 },
  { id: "expenditure-1799", year: 1799, series: "Expenditure", value: 54.22 },
  { id: "expenditure-1800", year: 1800, series: "Expenditure", value: 58.68 },
  { id: "expenditure-1801", year: 1801, series: "Expenditure", value: 61.36 },
  { id: "expenditure-1802", year: 1802, series: "Expenditure", value: 64.34 },
  { id: "expenditure-1803", year: 1803, series: "Expenditure", value: 34.64 },
  { id: "expenditure-1804", year: 1804, series: "Expenditure", value: 35.24 },
  { id: "expenditure-1805", year: 1805, series: "Expenditure", value: 45.34 },
  { id: "expenditure-1806", year: 1806, series: "Expenditure", value: 60.2 },
  { id: "expenditure-1807", year: 1807, series: "Expenditure", value: 69.11 },
  { id: "expenditure-1808", year: 1808, series: "Expenditure", value: 72.68 },
  { id: "expenditure-1809", year: 1809, series: "Expenditure", value: 84.27 },
  { id: "expenditure-1810", year: 1810, series: "Expenditure", value: 98.83 },
  { id: "expenditure-1811", year: 1811, series: "Expenditure", value: 105.67 },
  { id: "expenditure-1812", year: 1812, series: "Expenditure", value: 111.02 },
  { id: "expenditure-1813", year: 1813, series: "Expenditure", value: 113.7 },
  { id: "expenditure-1814", year: 1814, series: "Expenditure", value: 117.27 },
  { id: "expenditure-1815", year: 1815, series: "Expenditure", value: 120.55 },
  { id: "expenditure-1816", year: 1816, series: "Expenditure", value: 80.45 },
  { id: "expenditure-1817", year: 1817, series: "Expenditure", value: 72.14 },
  { id: "expenditure-1818", year: 1818, series: "Expenditure", value: 69.77 },
  { id: "expenditure-1819", year: 1819, series: "Expenditure", value: 69.18 },
  { id: "expenditure-1820", year: 1820, series: "Expenditure", value: 69.48 },
  { id: "expenditure-1821", year: 1821, series: "Expenditure", value: 69.49 },
];

export default function LegendComparison() {
  const name = useId();
  const [mode, setMode] = useState<"filter" | "focus">("filter");
  return (
    <div>
      <fieldset>
        <legend>Legend interaction</legend>
        {(["filter", "focus"] as const).map((option) => (
          <label
            key={option}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              minHeight: 44,
              marginRight: 16,
            }}
          >
            <input
              type="radio"
              name={name}
              value={option}
              checked={mode === option}
              onChange={() => {
                setMode(option);
              }}
            />
            {option === "filter" ? "Filter rows" : "Focus a series"}
          </label>
        ))}
      </fieldset>
      <p>
        {mode === "filter"
          ? "Toggle a legend checkbox to recompute the plot from visible series."
          : "Hover or select a legend entry to emphasize a series while keeping every row."}
      </p>
      <div key={mode}>
        <GGPlot
          data={finances}
          aes={{ x: "year", y: "value", color: "series" }}
          identity="id"
          height={430}
          ariaLabel={`British finances: legend ${mode}`}
        >
          <GeomLine linewidth={2.2} />
          <GeomPoint size={3.2} />
          <ScaleXContinuous labels="d" />
          <ThemeFivethirtyeight />
          <GuideLegend channel="color" filter={mode === "filter"} focus={mode === "focus"} />
          <Labs
            title={
              mode === "filter" ? "Filter series from the legend" : "Focus a series from the legend"
            }
            subtitle="Debt, revenue, and expenditure"
            x="Year"
            y="Playfair's index units"
            color="Series"
          />
          <Inspect mode="x" pin />
        </GGPlot>
      </div>
    </div>
  );
}
