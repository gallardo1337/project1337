"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function BetaAnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!["my1337.de", "www.my1337.de", "beta.my1337.de"].includes(window.location.hostname) || pathname.startsWith("/dashboard")) return;
    let visitorId = window.localStorage.getItem("beta_1337_visitor_id");
    if (!visitorId) {
      visitorId = crypto.randomUUID();
      window.localStorage.setItem("beta_1337_visitor_id", visitorId);
    }
    // A page view is recorded after authentication, never for the login screen.
    fetch("/api/login", { credentials: "same-origin", cache: "no-store" })
      .then((res) => res.ok ? res.json() : null)
      .then((session) => {
        if (!session?.ok) return;
        return fetch("/api/beta-analytics", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ platform: "web", event: "page_view", visitorId, path: pathname }),
        });
      }).catch(() => {});
  }, [pathname]);

  return null;
}
