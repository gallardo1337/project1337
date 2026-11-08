export function buildStatSlices(items, limit = 5) {
  const values = items.filter((item) => Number.isFinite(item.count) && item.count > 0);
  const total = values.reduce((sum, item) => sum + item.count, 0);
  const visible = values.slice(0, limit).map((item, index) => ({ ...item, key: `item-${index}` }));
  const remaining = values.slice(limit).reduce((sum, item) => sum + item.count, 0);
  if (remaining) visible.push({ key: "remaining", value: "Weitere", count: remaining });
  let angle = -90;
  return { total, slices: visible.map((item) => {
    const start = angle;
    const percent = item.count / total * 100;
    angle += item.count / total * 360;
    return { ...item, percent, start, end: angle, middle: (start + angle) / 2 };
  }) };
}

export function donutSegment(start, end, outer = 88, inner = 59) {
  const point = (radius, degrees) => {
    const radians = degrees * Math.PI / 180;
    return `${100 + radius * Math.cos(radians)} ${100 + radius * Math.sin(radians)}`;
  };
  // Two arcs also render a complete circle for a category with just one value.
  const middle = (start + end) / 2;
  return `M ${point(outer, start)} A ${outer} ${outer} 0 0 1 ${point(outer, middle)} A ${outer} ${outer} 0 0 1 ${point(outer, end)} L ${point(inner, end)} A ${inner} ${inner} 0 0 0 ${point(inner, middle)} A ${inner} ${inner} 0 0 0 ${point(inner, start)} Z`;
}
