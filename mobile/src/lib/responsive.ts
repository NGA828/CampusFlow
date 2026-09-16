/** Pure sizing policy, shared by adaptive rows and the regression tests. Units are dp. */
export function rowLayout(width: number, fontScale = 1, minItemWidth = 140, gap = 12, count = 3) {
  const available = Math.max(0, Number.isFinite(width) ? width : 0);
  const scale = Number.isFinite(fontScale) ? Math.max(1, fontScale) : 1;
  const minimum = Math.max(1, minItemWidth) * scale;
  const columns = Math.max(1, Math.min(count, Math.floor((available + gap) / (minimum + gap))));
  return { columns, itemWidth: Math.max(0, (available - gap * (columns - 1)) / columns) };
}
