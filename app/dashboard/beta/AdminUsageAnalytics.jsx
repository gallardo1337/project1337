"use client";

import { useEffect, useState } from "react";

const number = (value) => new Intl.NumberFormat("de-DE").format(value || 0);
const countryNames = new Intl.DisplayNames(["de"], { type: "region" });

function countryLabel(code) {
  if (!/^[A-Z]{2}$/.test(code)) return { flag: "🌐", name: code || "Unbekannt" };
  const flag = String.fromCodePoint(
    ...[...code].map((letter) => 0x1f1e6 + letter.charCodeAt(0) - 65)
  );
  return { flag, name: countryNames.of(code) || code };
}

export default function AdminUsageAnalytics() {
  const [days, setDays] = useState(7);
  const [platform, setPlatform] = useState("all");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    fetch(`/api/beta-analytics?days=${days}&platform=${platform}`, { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Statistik nicht verfügbar");
        return result;
      })
      .then((result) => mounted && setData(result))
      .catch((cause) => mounted && setError(cause.message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [days, platform]);

  const web = data?.platforms.find((item) => item.platform === "web");
  const tv = data?.platforms.find((item) => item.platform === "tvos");
  const cards = [
    ...(platform !== "tvos" ? [["Web-Besucher", web?.visitors], ["Web-Seitenaufrufe", web?.pageViews], ["Web-Filmstarts", web?.filmStarts]] : []),
    ...(platform !== "web" ? [
      ["Apple-TV-Besucher", tv?.visitors], ["Apple-TV-Sitzungen", tv?.sessions],
      ["App-Starts", tv?.appOpens], ["Filmseitenaufrufe (TV)", tv?.movieViews],
      ["Filmstarts (TV)", tv?.filmStarts], ["Abgeschlossen (TV)", tv?.completions],
    ] : []),
    ...(platform === "all" ? [["Filmstarts gesamt", (web?.filmStarts || 0) + (tv?.filmStarts || 0)]] : []),
  ];
  const maxDaily = Math.max(1, ...(data?.daily || []).map((day) => day.count));

  return (
    <div className="usageAnalytics">
      <div className="usageAnalytics__toolbar">
        <span>Erfassung seit Aktivierung · ausschließlich Beta</span>
        <div className="usageAnalytics__filters" aria-label="Plattform">
          {[["all", "Alle"], ["web", "Web"], ["tvos", "Apple TV"]].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setPlatform(value)}
              aria-pressed={platform === value} className={platform === value ? "is-active" : ""}>{label}</button>
          ))}
        </div>
        <div className="usageAnalytics__filters" aria-label="Zeitraum">
          {[[1, "24 Stunden"], [7, "7 Tage"], [30, "30 Tage"]].map(([value, label]) => (
            <button key={value} type="button" onClick={() => setDays(value)}
              className={days === value ? "is-active" : ""}>{label}</button>
          ))}
        </div>
      </div>

      {loading ? <p className="usageAnalytics__note">Statistik wird geladen…</p> : null}
      {error ? <p className="usageAnalytics__error">{error}</p> : null}
      {data && !loading ? (
        <>
          <div className="usageAnalytics__cards">
            {cards.map(([label, value]) => (
              <div key={label} className="usageAnalytics__card">
                <span>{label}</span><strong>{number(value)}</strong>
              </div>
            ))}
          </div>
          <div className="usageAnalytics__panels">
            <section className="usageAnalytics__panel">
              <h2>Zugriffe im Zeitraum</h2>
              {data.daily.length ? <div className="usageAnalytics__bars">
                {data.daily.map((day) => (
                  <div key={day.date} className="usageAnalytics__bar" title={`${day.date}: ${day.count}`}>
                    <span style={{ height: `${Math.max(5, day.count / maxDaily * 100)}%` }} />
                    <small>{day.date.slice(5)}</small>
                  </div>
                ))}
              </div> : <p className="usageAnalytics__note">Noch keine Zugriffe erfasst.</p>}
            </section>
            <section className="usageAnalytics__panel">
              <h2>Herkunftsländer</h2>
              {data.countries.length ? data.countries.map((item) => (
                <div className="usageAnalytics__country" key={item.country}>
                  <span className="usageAnalytics__countryLabel">
                    <span className="usageAnalytics__flag" aria-hidden="true">{countryLabel(item.country).flag}</span>
                    {countryLabel(item.country).name}
                  </span>
                  <strong>{number(item.count)}</strong>
                </div>
              )) : <p className="usageAnalytics__note">Noch keine Länderinformationen verfügbar.</p>}
            </section>
          </div>
          <p className="usageAnalytics__note">
            Web-Besucher werden anonym über eine lokale Besucher-ID gezählt. Länder sind Schätzungen aus Vercel-Headern.
            Apple-TV-Besucher entsprechen anonymen Installationen; Sitzungen enden nach 30 Minuten im Hintergrund.
            Herkunftsländer zählen eindeutige Besucher je Land im gewählten Zeitraum. Der Verlauf zählt Ereignisse; Tage werden in UTC gruppiert. Web und TV werden nicht personenübergreifend zusammengeführt.
            {data.truncated ? " Bei hohem Traffic werden maximal 50.000 Ereignisse je Plattform ausgewertet." : ""}
          </p>
        </>
      ) : null}
    </div>
  );
}
