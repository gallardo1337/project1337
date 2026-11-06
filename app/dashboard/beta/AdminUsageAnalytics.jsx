"use client";

import { useEffect, useState } from "react";

const number = (value) => new Intl.NumberFormat("de-DE").format(value || 0);

export default function AdminUsageAnalytics() {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    fetch(`/api/beta-analytics?days=${days}`, { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Statistik nicht verfügbar");
        return result;
      })
      .then((result) => mounted && setData(result))
      .catch((cause) => mounted && setError(cause.message))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [days]);

  const web = data?.platforms.find((item) => item.platform === "web");
  const tv = data?.platforms.find((item) => item.platform === "tvos");
  const cards = [
    ["Web-Besucher", web?.visitors],
    ["Web-Seitenaufrufe", web?.pageViews],
    ["Apple-TV-Besucher", tv?.visitors],
    ["Filmstarts", (web?.filmStarts || 0) + (tv?.filmStarts || 0)],
  ];
  const maxDaily = Math.max(1, ...(data?.daily || []).map((day) => day.count));

  return (
    <div className="usageAnalytics">
      <div className="usageAnalytics__toolbar">
        <span>Erfassung seit Aktivierung · ausschließlich Beta</span>
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
                  <span>{item.country}</span><strong>{number(item.count)}</strong>
                </div>
              )) : <p className="usageAnalytics__note">Noch keine Länderinformationen verfügbar.</p>}
            </section>
          </div>
          <p className="usageAnalytics__note">
            Web-Besucher werden anonym über eine lokale Besucher-ID gezählt. Länder sind Schätzungen aus Vercel-Headern.
            Apple-TV-Werte erscheinen erst, sobald die tvOS-App Ereignisse an die Beta sendet.
            {data.truncated ? " Bei hohem Traffic werden maximal 50.000 Ereignisse ausgewertet." : ""}
          </p>
        </>
      ) : null}
    </div>
  );
}
