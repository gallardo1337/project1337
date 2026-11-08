"use client";

import { useId, useMemo, useState } from "react";
import { buildStatSlices, donutSegment } from "../../lib/actorStatChart.mjs";
import styles from "./ActorStatChart.module.css";

const COLORS = ["#f08080", "#9b9ef0", "#6dc9c3", "#e8bf78", "#b798d3", "#737986"];
const number = new Intl.NumberFormat("de-DE");
const percent = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

export default function ActorStatChart({ items, title }) {
  const id = useId();
  const { total, slices } = useMemo(() => buildStatSlices(items), [items]);
  const [hovered, setHovered] = useState(null);
  const [focused, setFocused] = useState(null);
  const [selected, setSelected] = useState(null);
  const activeKey = hovered ?? focused ?? selected;
  const active = slices.find((slice) => slice.key === activeKey);
  const enter = (event, key) => {
    if (event.pointerType === "mouse") setHovered(key);
  };

  if (!total) return <p className={styles.empty}>Keine Daten hinterlegt</p>;

  return (
    <div className={styles.chart}>
      <div className={styles.visual}>
        <svg viewBox="0 0 200 200" role="img" aria-labelledby={`${id}-title`}>
          <title id={`${id}-title`}>{title}: {number.format(total)} Zuordnungen. Werte in der Legende.</title>
          {slices.map((slice, index) => {
            const radians = slice.middle * Math.PI / 180;
            return (
              <path
                key={slice.key}
                className={styles.segment}
                d={donutSegment(slice.start, slice.end)}
                fill={COLORS[index]}
                data-active={active?.key === slice.key}
                data-hovered={hovered === slice.key}
                data-muted={Boolean(active && active.key !== slice.key)}
                style={{ "--offset-x": `${Math.cos(radians) * 4}px`, "--offset-y": `${Math.sin(radians) * 4}px` }}
                onPointerEnter={(event) => enter(event, slice.key)}
                onPointerLeave={() => setHovered(null)}
                onClick={() => setSelected(selected === slice.key ? null : slice.key)}
              >
                <title>{slice.value}: {number.format(slice.count)} · {percent.format(slice.percent)} %</title>
              </path>
            );
          })}
        </svg>
        <div className={styles.center} aria-hidden="true">
          <strong>{active ? `${percent.format(active.percent)} %` : number.format(total)}</strong>
          <span>{active ? active.value : "Zuordnungen"}</span>
        </div>
      </div>
      <ul className={styles.legend} aria-label={`${title}: Werte und Anteile`}>
        {slices.map((slice, index) => (
          <li key={slice.key}>
            <button
              type="button"
              className={styles.legendItem}
              data-active={active?.key === slice.key}
              aria-pressed={selected === slice.key}
              onPointerEnter={(event) => enter(event, slice.key)}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => setFocused(slice.key)}
              onBlur={() => setFocused(null)}
              onClick={() => setSelected(selected === slice.key ? null : slice.key)}
            >
              <i style={{ background: COLORS[index] }} aria-hidden="true" />
              <span className={styles.name}>{slice.value}</span>
              <span className={styles.value}>{number.format(slice.count)}<small>{percent.format(slice.percent)} %</small></span>
            </button>
          </li>
        ))}
      </ul>
      <p className={styles.note}>Anteile aller erfassten Zuordnungen{slices.some((slice) => slice.key === "remaining") ? " · Top 5 + Weitere" : ""}</p>
    </div>
  );
}
