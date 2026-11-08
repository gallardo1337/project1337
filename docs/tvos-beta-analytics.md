# tvOS-Beta-Nutzungsstatistik

## Stand

Implementiert im lokalen Web-Checkout auf Branch `beta` und im separaten `tvOS-Beta`-Projekt.
Die freigegebene Datenbankmigration wurde am 08.11.2026 angewandt. Der Dateiname entspricht der von Supabase vergebenen Migrationsversion. Veröffentlichungsziel ist ausschließlich Branch `beta` mit automatischem Preview-Deployment.
`main`, produktive App und gemeinsame Filmzähler wurden nicht geändert.

## Ereignisse und API

`POST https://beta.my1337.de/api/beta-analytics`, JSON, bestehendes Login-Cookie plus signiertes HttpOnly-Cookie `beta_analytics_session`.
Dieses Cookie wird nach erfolgreichem Passwort- oder Gerätecode-Login ausgegeben; ältere tvOS-Sitzungen müssen sich neu anmelden.
Es gibt keine neuen Secrets im App-Bundle. Die Signatur nutzt ausschließlich den vorhandenen serverseitigen Supabase-Schlüssel.

| Ereignis | Auslöser |
| --- | --- |
| `app_open` | Einmal pro Prozess, beim ersten Aktivieren |
| `session_start` | Neue Installation/Sitzung oder Aktivierung nach mindestens 30 Minuten Hintergrund |
| `screen_view` | Startseite, Darstellerprofil, Filmseite; einmal pro View-Lebensdauer |
| `movie_play` | Player meldet `.playing` und abgespielte Zeit > 0; einmal pro Player-Lebensdauer |
| `movie_complete` | Reguläres Ende des aktuellen Player-Items, nur nach registriertem Start |

Rückkehr vom Player oder Bewertungsdialog erzeugt keinen weiteren Filmseitenaufruf. Erneutes Navigieren zum Film bzw. ein neuer Player darf neue Ereignisse erzeugen. Buffering/Pause/Resume erzeugen keinen weiteren Start.

Übertragene Felder: `platform`, `event`, `eventId`, `timestamp`, `visitorId`, `sessionId`, `appVersion`, `osVersion`, optional `screen`, `movieId`.
`visitorId` ist eine zufällige UUID in den App-UserDefaults, ohne Benutzer-/Apple-ID. Neuinstallation oder Löschen der App-Daten setzt sie zurück.
Land wird ausschließlich aus dem Vercel-Header übernommen; Cookies, Passwörter und IP-Adressen werden nicht in Analytics gespeichert.

## Zustellung und Grenzen

- Zentrale Basisadresse in `APIConfiguration.swift`, für Debug und Release ausschließlich Beta; HTTP-Weiterleitungen werden abgelehnt.
- Asynchrone Übertragung, Request-Timeout 10 Sekunden, maximal ein Sender.
- Persistente Warteschlange: maximal 256 Ereignisse, höchstens 7 Tage alt; bei Überschreitung werden die ältesten verworfen.
- Bei Netzwerk-/Serverfehlern höchstens fünf Wiederholungen mit exponentiellem Abstand; weitere Versuche beim nächsten Ereignis oder Aktivieren.
- Bei 401 wartet die Warteschlange auf erneute Anmeldung. Ungültige Ereignisse werden verworfen. 429 wird erneut versucht.
- Server-Deduplizierung über `event_id` sowie eindeutige Sitzungsstarts. Wiederholungen behalten ihre UUID.
- Maximale Request-Größe 4 KiB. Signierte Anmeldung, validierte UUIDs/Metadaten/Ereignisse und Prüfung der Filmexistenz.
- 120 Ereignisse pro Minute je signierter Sitzung bzw. Installation, atomar in PostgreSQL; zusätzliche frühe Begrenzung je Serverinstanz.
- Analytics-Ausfälle blockieren weder UI noch Wiedergabe. Nicht angemeldete Starts bleiben lokal bis zum Login.

## Datenbank und Produktionsschutz

Die Migration `20261108102830_beta_tvos_analytics.sql` erweitert ausschließlich `beta_analytics_events` und ergänzt die Funktion `record_beta_tv_event`.
Keine neue Tracking-Tabelle, keine Änderungen an `movies`, `movie_metrics` oder vorhandenen Web-Ereignissen.
Die Funktion ist `SECURITY INVOKER` und nur für `service_role` ausführbar. Tabellen-RLS bleibt aktiv; `anon` und `authenticated` erhalten keinen Zugriff.
Ein Hash einer zufälligen Sitzungskennung dient der Request-Begrenzung; daraus lässt sich kein gültiges Login-Cookie ableiten.

Der frühere tvOS-Aufruf von `increment_movie_view` wird beim Beta-Abspielen nicht mehr ausgeführt, da dieser gemeinsame Produktivzähler verändern würde. Der globale Filmzähler in den bestehenden Filmkarten bleibt deshalb bei Beta-Testwiedergaben unverändert. Tatsächliche Beta-Filmstarts stehen im Admin unter Nutzungsstatistik.

Web-Auswertungen bleiben separat. Admin zeigt TV-Besucher (Installationen), Sitzungen, Starts, Filmseiten, Filmstarts und Abschlüsse. Plattformfilter wirkt auf Verlauf und Länder; Länder erscheinen deutsch mit Flaggen. Tage sind UTC. Maximal 50.000 Ereignisse je Plattform und Zeitraum; Begrenzung wird angezeigt. Besucher verschiedener Plattformen werden nicht als identische Personen behandelt.

## Verifikation

- 66 Node-Tests erfolgreich, einschließlich API-Handler mit gemockter Auth/DB, Eingabevalidierung, Signaturen, Request-Limit, Produktionshost-Sperre und unveränderten Web-Kennzahlen.
- Swift-Testprogramm erfolgreich: Lifecycle, stabile Installation, Sitzungstimeout, Playback-Deduplizierung, Offline-Fehler, Wiederhol-IDs, Background-Pause, 401/Login-Fortsetzung, Queue-Grenze und Wiederherstellung.
- Beide Migrationen auf frischer lokaler PostgreSQL/PGlite-Instanz erfolgreich geprüft: Einfügen, Deduplizierung, Sitzungs-Eindeutigkeit, Filmvalidierung, Quota und Funktionsrechte.
- tvOS-Simulator-Build mit Xcode erfolgreich, ohne Codesigning.
- Next.js-Produktionsbuild lokal erfolgreich mit öffentlicher Supabase-URL und einem nicht geheimen Platzhalter-Key. Dieser Build prüft Kompilierung/Prerendering, nicht Live-DB-Zugriff.
- Live-Schema und Berechtigungen geprüft; RPC-Einfügen/Deduplizierung mit Rollback erfolgreich. Der Security-Advisor meldet für die Analytics-Tabelle nur das beabsichtigte RLS-ohne-Client-Policies; eine bestehende Warnung zu `set_actor_slug` liegt außerhalb dieser Änderung.
- Kein echter Apple-TV-Wiedergabetest und keine authentifizierte Ende-zu-Ende-Liveprüfung durchgeführt.

### Befehle

Im Web-Checkout: `node --test tests/*.test.mjs` und `npm run build` (öffentliche Build-Umgebungsvariablen erforderlich).

SQL-Test: PGlite 0.3.14 temporär installieren, dann `PGLITE_MODULE=/absoluter/pfad/node_modules/@electric-sql/pglite/dist/index.js node tests/beta-analytics-db.mjs`.

Im Workspace: `swiftc -parse-as-library tvOS-Beta/Project1337TV/AnalyticsState.swift tvOS-Beta/Project1337TV/AnalyticsManager.swift tvOS-Beta/Tests/main.swift -o /tmp/analytics-tests` und anschließend `/tmp/analytics-tests`.

Build: `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer xcodebuild -project tvOS-Beta/Project1337TVBeta.xcodeproj -scheme Project1337TV -sdk appletvsimulator -destination 'generic/platform=tvOS Simulator' -derivedDataPath /tmp/project1337-tv-build CODE_SIGNING_ALLOWED=NO build`.

## Freischaltung und Test am Apple TV

1. Erledigt: Freigegebene Migration im Projekt `tfjwgtpwcpbrmnhfmwyt` angewandt, RLS und minimale Funktionsrechte bestätigt. Live-RPC-Einfügen und Deduplizierung innerhalb einer zurückgerollten Transaktion geprüft; keine Testdaten verblieben.
2. Nach erfolgreicher Verifikation ausschließlich Branch `beta` veröffentlichen und Vercel-Beta-Deployment bis `READY` prüfen. Nicht `main` veröffentlichen oder ein Deployment nach Produktion promoten.
3. `Project1337TVBeta.xcodeproj` öffnen, Beta-Bundle-ID `de.project1337.Project1337TV.beta` beibehalten, eigenes Apple-TV-Gerät/Signing wählen und App installieren.
4. In der Beta-App neu anmelden (Gerätecode oder Passwort). Beta-Admin → Nutzungsstatistik → Apple TV öffnen.
5. Nach Kaltstart: ein App-Start, eine Installation und eine Sitzung. Kurze Background/Foreground-Wechsel: keine neue Sitzung. Nach 30 Minuten Hintergrund: eine neue Sitzung.
6. Filmseite öffnen: ein Filmseitenaufruf, kein Filmstart. Abspielen: genau ein Filmstart. Pause/Buffering/Resume: unverändert. Reguläres Ende: ein Abschluss.
7. Filmseite verlassen und erneut öffnen: neuer Seitenaufruf. Neue Wiedergabe: neuer Filmstart.
8. Netzwerk vorübergehend trennen, navigieren/abspielen und wieder verbinden: kein Absturz; erneute Aktivierung stößt Zustellung an. Derselbe Event darf auch bei wiederholter Zustellung nur einmal gezählt werden.
9. Web-Filter und Produktivzähler vergleichen. Keine Testereignisse von Hand in die Live-Statistik einfügen.

## Geänderte Dateien

Web: `app/api/beta-analytics/route.js`, `app/api/login/route.js`, `app/api/logout/route.js`, `app/dashboard/beta/AdminUsageAnalytics.jsx`, `app/dashboard/page.jsx` (Changelog 2.8.2), `lib/serverSupabase.js`, `lib/tvAnalytics.mjs`, Migration, drei Analytics-Testdateien und diese Dokumentation.

App: neu `APIConfiguration.swift`, `AnalyticsState.swift`, `AnalyticsManager.swift`, `AnalyticsScreen.swift`; angepasst `Project1337TVApp.swift`, `LibraryAPI.swift`, `LibraryStore.swift`, `HomeView.swift`, `MovieViews.swift`, `PerformerDetailView.swift`, `PlayerView.swift`; neu `Tests/main.swift`.
