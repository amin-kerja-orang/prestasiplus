# ADR-0012: Chart.js 4 through a thin in-house `ChartCanvas` wrapper

- **Status:** Proposed
- **Date:** 2026-09-25

## Context
Live draws charts with Chart.js 4.4.0 (M08 SQ-M08-04). SRSs specify the exact live configs:
- M05 FR-M05-101: dual-axis line, dashed dataset, 250 px box;
- M08 FR-M08-16: reversed y axis, band-shading plugin, tooltip callbacks, 800 ms easing.

No external runtime calls are allowed (SRS §4.1). E2E cannot read pixels on a canvas.

## Decision
- Bundle **`chart.js` ^4.5** (same major as live). Register only the controllers, elements, scales and plugins that are used, in `src/components/chart/register.ts`.
- **`ChartCanvas`** component: takes a full Chart.js config (copied from the live page script, including inline plugins and callbacks). It creates the chart on mount, updates it on data change, destroys it on unmount, and sizes to its container box as live does.
- In dev and e2e builds, each chart registers `{type, data, options}` in `window.__charts[testId]`, so E2E can assert labels, values, colours and axis settings. The demo build excludes this.

## Alternatives considered
- **`vue-chartjs`:** a well-supported wrapper, but it adds an abstraction between the SRS configs and Chart.js, and custom inline plugins are more natural with direct `new Chart(ctx, config)`.
- **Another chart library (ECharts, ApexCharts):** it would not reproduce live Chart.js visuals and behaviour.

## Consequences
- Chart configs match live one-to-one and are testable.
- About 50 lines of wrapper code to own.
