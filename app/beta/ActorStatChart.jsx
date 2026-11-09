"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildStatSlices, donutSegment } from "../../lib/actorStatChart.mjs";
import styles from "./ActorStatChart.module.css";

const COLORS = ["#f08080", "#9b9ef0", "#6dc9c3", "#e8bf78", "#b798d3", "#737986"];
const number = new Intl.NumberFormat("de-DE");
const percent = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

export default function ActorStatChart({ items, title }) {
  const id = useId();
  const { total, slices } = useMemo(() => buildStatSlices(items), [items]);
  const [open, setOpen] = useState(null);
  const [hovered, setHovered] = useState(null);
  const visualRef = useRef(null);
  const tooltipRef = useRef(null);
  const timer = useRef(null);
  const active = slices.find((slice) => slice.key === open?.key);
  const cancelClose = () => clearTimeout(timer.current);
  const close = () => { cancelClose(); setOpen(null); setHovered(null); };
  const scheduleClose = () => { cancelClose(); timer.current = setTimeout(close, 180); };

  const show = (slice, pointer = false) => {
    cancelClose();
    const rect = visualRef.current.getBoundingClientRect();
    const angle = slice.middle * Math.PI / 180;
    const x = rect.left + rect.width * (100 + Math.cos(angle) * 74) / 200;
    const y = rect.top + rect.height * (100 + Math.sin(angle) * 74) / 200;
    const width = Math.min(280, window.innerWidth - 24);
    const height = Math.min(slice.entries ? 320 : 100, window.innerHeight - 24);
    setOpen({ key: slice.key, left: Math.max(12, Math.min(x + 12, window.innerWidth - width - 12)), top: Math.max(12, Math.min(y + 12, window.innerHeight - height - 12)), width, maxHeight: height });
    setHovered(pointer ? slice.key : null);
  };

  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return undefined;
    const dismiss = () => { clearTimeout(timer.current); setOpen(null); setHovered(null); };
    const outside = (event) => {
      if (!visualRef.current?.contains(event.target) && !tooltipRef.current?.contains(event.target)) dismiss();
    };
    const scroll = (event) => { if (!tooltipRef.current?.contains(event.target)) dismiss(); };
    const escape = (event) => {
      if (event.key === "Escape") { event.stopPropagation(); event.preventDefault(); dismiss(); }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("scroll", scroll, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("scroll", scroll, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  if (!total) return <p className={styles.empty}>Keine Daten hinterlegt</p>;

  return (
    <div className={styles.chart}>
      <div className={styles.visual} ref={visualRef}>
        <svg viewBox="0 0 200 200" role="group" aria-labelledby={`${id}-title`}>
          <title id={`${id}-title`}>{title} – Segmente für Details auswählen</title>
          {slices.map((slice, index) => {
            const radians = slice.middle * Math.PI / 180;
            return (
              <path
                key={slice.key}
                className={styles.segment}
                d={donutSegment(slice.start, slice.end)}
                fill={COLORS[index]}
                role="button"
                tabIndex={0}
                aria-label={`${slice.value}: ${number.format(slice.count)} · ${percent.format(slice.percent)} %`}
                aria-describedby={active?.key === slice.key ? `${id}-tooltip` : undefined}
                data-hovered={hovered === slice.key}
                data-muted={Boolean(active && active.key !== slice.key)}
                style={{ "--offset-x": `${Math.cos(radians) * 4}px`, "--offset-y": `${Math.sin(radians) * 4}px` }}
                onPointerEnter={(event) => { if (event.pointerType === "mouse") show(slice, true); }}
                onPointerLeave={(event) => { if (event.pointerType === "mouse") scheduleClose(); }}
                onFocus={() => show(slice)}
                onBlur={scheduleClose}
                onClick={() => show(slice)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); show(slice); } }}
              />
            );
          })}
        </svg>
      </div>
      {active && createPortal(
        <div
          ref={tooltipRef}
          id={`${id}-tooltip`}
          role="tooltip"
          tabIndex={active.entries ? 0 : undefined}
          className={styles.tooltip}
          style={{ left: open.left, top: open.top, width: open.width, maxHeight: open.maxHeight }}
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleClose}
          onFocus={cancelClose}
          onBlur={scheduleClose}
        >
          <strong>{active.value}</strong>
          <p>{number.format(active.count)} Zuordnungen <span>{percent.format(active.percent)} %</span></p>
          {active.entries && (
            <ul>
              {active.entries.map((item, index) => (
                <li key={`${item.value}-${index}`}>
                  <span>{item.value}</span>
                  <b>{number.format(item.count)}<small>{percent.format(item.percent)} %</small></b>
                </li>
              ))}
            </ul>
          )}
        </div>, visualRef.current?.closest('[role="dialog"]') || document.body
      )}
    </div>
  );
}
