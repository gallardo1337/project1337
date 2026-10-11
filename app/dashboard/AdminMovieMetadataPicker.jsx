"use client";

import { useMemo, useState } from "react";
import styles from "./AdminMovieMetadataPicker.module.css";
import { sortTagsByCategory, tagCategoryLabel } from "../../lib/tagCategories.mjs";

function normalizeSearch(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export default function AdminMovieMetadataPicker({
  label,
  items,
  selectedIds,
  onToggle,
  placeholder,
  emptyMessage,
}) {
  const [query, setQuery] = useState("");
  const normalizedQuery = normalizeSearch(query);
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const sortedItems = useMemo(() => sortTagsByCategory(items), [items]);
  const selectedItems = sortedItems.filter((item) => selectedIdSet.has(item.id));
  const matchingItems = normalizedQuery
    ? sortedItems.filter((item) =>
        normalizeSearch(item.name).includes(normalizedQuery)
      )
    : sortedItems;
  const availableItems = matchingItems.filter(
    (item) => !selectedIdSet.has(item.id)
  );
  const matchingSelectedCount = matchingItems.length - availableItems.length;

  return (
    <section className={styles.picker} aria-label={`${label} auswählen`}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Auswahl</span>
          <strong>
            {selectedItems.length} ausgewählt
            <span> · {items.length} insgesamt</span>
          </strong>
        </div>
        <div className={styles.search}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <circle cx="8.5" cy="8.5" r="5.25" />
            <path d="m12.5 12.5 4 4" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            aria-label={`${label} durchsuchen`}
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Suche leeren"
            >
              ×
            </button>
          ) : null}
        </div>
      </header>

      {selectedItems.length ? (
        <div className={styles.selected} aria-label="Ausgewählte Einträge">
          {selectedItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.selectedChip}
              onClick={() => onToggle(item)}
              aria-label={`${item.name} entfernen`}
              title={`${item.name} entfernen`}
            >
              <span>{item.name}</span>
              {item.category ? <small>{tagCategoryLabel(item.category)}</small> : null}
              <i aria-hidden="true">×</i>
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.list} role="group" aria-label={label}>
        {items.length === 0 ? (
          <p className={styles.empty}>{emptyMessage}</p>
        ) : availableItems.length ? (
          availableItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={styles.option}
              onClick={() => onToggle(item)}
            >
              <span className={styles.addMark} aria-hidden="true">+</span>
              <span className={styles.optionName}>{item.name}</span>
              {item.category ? (
                <span className={styles.tagCategory}>{tagCategoryLabel(item.category)}</span>
              ) : null}
            </button>
          ))
        ) : (
          <p className={styles.empty}>
            {normalizedQuery
              ? matchingSelectedCount
                ? "Alle passenden Einträge sind bereits ausgewählt."
                : `Keine Treffer für „${query}“.`
              : "Alle Einträge sind ausgewählt."}
          </p>
        )}
      </div>

      <footer className={styles.footer}>
        <span>
          {normalizedQuery
            ? `${matchingItems.length} Treffer · ${matchingSelectedCount} bereits ausgewählt`
            : "Eintrag anklicken zum Hinzufügen · Auswahl oben entfernen"}
        </span>
      </footer>
    </section>
  );
}
