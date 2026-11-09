"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { buildStatSlices, donutSegment } from "../../lib/actorStatChart.mjs";
import styles from "./ActorStatChart.module.css";

const COLORS = ["#f08080", "#9b9ef0", "#6dc9c3", "#e8bf78", "#b798d3", "#737986"];
const number = new Intl.NumberFormat("de-DE");
const percent = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });
const color = (index) => COLORS[index] || `hsl(${(index * 137.508) % 360} 58% 65%)`;

function DetailDialog({ items, title, onClose }) {
  const ref = useRef(null);
  const heading = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); previous?.focus(); };
  }, []);
  return createPortal(
    <dialog ref={ref} className={styles.dialog} aria-labelledby={heading}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
      onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); } }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={styles.dialogContent}>
        <header className={styles.dialogHeader}>
          <div><h2 id={heading}>{title}</h2><p>Alle Einträge · Anzahl und Anteil</p></div>
          <button type="button" autoFocus onClick={onClose} aria-label="Detailansicht schließen">Schließen ×</button>
        </header>
        <ActorStatChart items={items} title={title} expanded />
      </div>
    </dialog>, document.body
  );
}

export default function ActorStatChart({ items, title, expanded = false }) {
  const id = useId();
  const { total, slices } = useMemo(() => buildStatSlices(items, expanded ? Infinity : 5), [items, expanded]);
  const [details, setDetails] = useState(false);
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
    <div className={styles.chart} data-expanded={expanded}>
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
                fill={color(index)}
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
      <div className={styles.legend}>
        {expanded && <div className={styles.legendHeading}><span>Eintrag</span><span>Anzahl / Anteil</span></div>}
        <ul>
          {slices.map((slice, index) => (
            <li key={slice.key}>
              <button type="button" className={styles.legendItem} data-active={active?.key === slice.key}
                onPointerEnter={(event) => { if (event.pointerType === "mouse") show(slice, true); }}
                onPointerLeave={scheduleClose} onFocus={() => show(slice)} onBlur={scheduleClose} onClick={() => show(slice)}>
                <span className={styles.swatch} style={{ background: color(index) }} />
                <span className={styles.label}>{slice.value}</span>
                <span className={styles.value}>{number.format(slice.count)}<small>{percent.format(slice.percent)} %</small></span>
              </button>
            </li>
          ))}
        </ul>
        {expanded && <div className={styles.total}><span>Gesamt</span><b>{number.format(total)} Zuordnungen</b></div>}
      </div>
      {!expanded && <button type="button" className={styles.detailsButton} onClick={() => { close(); setDetails(true); }}>Details anzeigen ↗</button>}
      {details && <DetailDialog items={items} title={title} onClose={() => setDetails(false)} />}
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
        </div>, visualRef.current?.closest('dialog, [role="dialog"]') || document.body
      )}
    </div>
  );
}
