// Shared chart colours and config for recharts across all pages.

export const CHART_COLORS = [
  "#3040a0", // primary blue
  "#e55381", // coral pink
  "#22a07a", // teal green
  "#e5a020", // amber
  "#7c3aed", // violet
  "#06b6d4", // cyan
  "#f97316", // orange
  "#ec4899", // hot-pink
  "#6366f1", // indigo
  "#14b8a6", // emerald
  "#f43f5e", // rose
  "#a78bfa", // lavender
] as const;

export const GRID_STROKE = "#e0e6f3";
export const AXIS_TICK = "#6b7bb8";
export const TOOLTIP_BG = "#ffffff";

// Shared axis style props
export const axisProps = {
  tick: { fontSize: 11, fill: AXIS_TICK },
  tickLine: false,
  axisLine: { stroke: GRID_STROKE },
} as const;

export const gridProps = {
  strokeDasharray: "3 6",
  stroke: GRID_STROKE,
} as const;
