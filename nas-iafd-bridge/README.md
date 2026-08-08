# Project1337 IAFD NAS-Bridge

Die Bridge lädt IAFD-Seiten mit einem persistenten Chromium-Browser über den
Internetanschluss des NAS. Vercel erhält ausschließlich das HTML der angeforderten
IAFD-Seite. Videos und Supabase-Daten werden nicht an die Bridge übertragen.

## Schutz

- Nur `/title.rme`, `/person.rme` und `/results.asp` auf `iafd.com` sind erlaubt.
- Jede Anfrage ist mit HMAC-SHA256 signiert und höchstens 60 Sekunden gültig.
- Private IP-Adressen und lokale Hostnamen sind für Browser-Unteranfragen gesperrt.
- Rate-Limit, Größenlimit, serieller Browserzugriff und zehn Minuten Cache sind aktiv.
- Der Container läuft ohne Root-Rechte, ohne Linux-Capabilities und mit read-only Root-Dateisystem.

## 1. Auf dem Ugreen NAS starten

Den Ordner `nas-iafd-bridge` auf das NAS kopieren und dort im Terminal ausführen:

```bash
cp .env.example .env
openssl rand -hex 32
```

Den erzeugten Wert in `.env` bei `IAFD_BRIDGE_SECRET` eintragen. Danach:

```bash
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:43137/health
```

Die Health-Antwort muss `"ok":true` enthalten. Der erste echte IAFD-Aufruf dauert
etwas länger, weil Chromium erst dann gestartet wird. Das Browserprofil bleibt im
Docker-Volume `iafd_browser_data` erhalten.

Chromium läuft im normalen Browsermodus innerhalb eines virtuellen X-Displays
(`xvfb-run`). Dadurch steht kein sichtbares Browserfenster offen, die Website erhält
aber nicht den eingeschränkten Headless-Browsermodus.

Beim Start entfernt die Bridge ausschließlich verwaiste Chromium-Sperrdateien
(`SingletonLock`, `SingletonCookie`, `SingletonSocket`) aus dem persistenten Profil.
Cookies, Cache und der übrige Browserzustand bleiben dabei erhalten.

Die Browserprüfung darf ihre JavaScript-, Bild-, Schrift-, `data:`- und
`blob:`-Ressourcen vollständig laden. Private Netzwerkziele bleiben blockiert. Eine
Seite wird erst in den Cache übernommen, wenn Cloudflares `cf-mitigated`-Header,
Prüftext und Challenge-Frame verschwunden sind. Nach der ersten echten Seite bleibt
der Tab kurz offen, damit Chromium ein mögliches `cf_clearance`-Cookie im
persistenten Profil speichern kann.

## 2. Über den vorhandenen Cloudflare-Tunnel veröffentlichen

Empfohlener öffentlicher Hostname:

```text
iafd-bridge.my1337.de
```

Wenn `cloudflared` direkt auf dem NAS läuft, zeigt der Tunnel auf:

```text
http://127.0.0.1:43137
```

Wenn `cloudflared` selbst in Docker läuft, dessen Container einmal mit dem
Bridge-Netz verbinden:

```bash
docker network connect project1337-bridge CLOUDFLARED_CONTAINERNAME
```

Die Tunnel-Origin lautet dann:

```text
http://iafd-bridge:43137
```

Die Bridge besitzt keine Browser-CORS-Freigabe. Nur der serverseitige
Project1337-Endpunkt kann mit dem gemeinsamen Secret gültige Anfragen erzeugen.

## 3. Vercel Preview verbinden

Im Vercel-Projekt `project1337` für die Umgebung **Preview** setzen:

```text
IAFD_BRIDGE_URL=https://iafd-bridge.my1337.de
IAFD_BRIDGE_SECRET=<derselbe Wert aus der NAS-.env>
IAFD_BRIDGE_TIMEOUT_MS=60000
```

Danach das Preview-Deployment neu bauen. Production erhält diese Variablen erst,
wenn der komplette Importablauf im Preview geprüft wurde.

## Betrieb

```bash
docker compose logs -f --tail=100 iafd-bridge
docker compose restart iafd-bridge
docker compose pull
docker compose up -d --build
```

Die Logs enthalten Request-ID, Status, Dauer und Cache-Status, aber weder Secret
noch den abgefragten Filmtitel.
