# Project1337 NAS Library Scanner

Der Scanner liest den Hauptordner `1337` rekursiv und liefert der geschützten
Project1337-Adminseite ein Inventar aller erkannten Videodateien. Er liest nur
Dateiname, relativen Pfad, Dateigröße und Änderungszeit. Videoinhalte werden weder
geöffnet noch übertragen.

## Unterstützte Formate

Standardmäßig werden 36 verbreitete Video-, Rohvideo- und Disc-Formate erfasst,
darunter MP4, MKV, AVI, MOV, WMV, M2TS, VOB, HEVC, MXF und ISO. Die Liste kann in
`.env` über `NAS_VIDEO_EXTENSIONS` erweitert werden.

## Schutz

- Der Ordner `1337` wird ausschließlich read-only in den Container eingebunden.
- Inventaranfragen benötigen eine höchstens 60 Sekunden alte HMAC-Signatur.
- Der öffentliche Health-Endpunkt zeigt keine Datei- oder Ordnernamen.
- Es gibt kein CORS und keine Browserfreigabe.
- Das letzte Ergebnis liegt in einem eigenen Docker-Volume und überlebt Neustarts.
- Symlinks und typische NAS-Systemordner wie `@eaDir` werden ignoriert.
- Der Container läuft ohne Root-Rechte, ohne Linux-Capabilities und mit
  schreibgeschütztem Root-Dateisystem.

## 1. Auf dem Ugreen-NAS starten

Den Ordner `nas-library-scanner` auf das NAS kopieren. Anschließend im Ordner:

```bash
cp .env.example .env
openssl rand -hex 32
```

Den erzeugten Wert bei `NAS_SCANNER_SECRET` eintragen. Außerdem muss
`NAS_HOST_LIBRARY_PATH` auf den tatsächlichen absoluten Pfad des Hauptordners
`1337` zeigen. Danach:

```bash
docker compose up -d --build
docker compose ps
curl http://127.0.0.1:43138/health
```

Die Health-Antwort muss `"ok":true` enthalten. Der erste Inventaraufruf erstellt
automatisch den ersten Scan. Weitere Seitenaufrufe verwenden den gespeicherten
Stand, bis in der Adminseite **Neu scannen** gewählt wird.

## 2. Über den vorhandenen Cloudflare-Tunnel veröffentlichen

Empfohlener öffentlicher Hostname:

```text
nas-scanner.my1337.de
```

Wenn `cloudflared` direkt auf dem NAS läuft, zeigt der Tunnel auf:

```text
http://127.0.0.1:43138
```

Wenn `cloudflared` selbst in Docker läuft, den Container einmal verbinden:

```bash
docker network connect project1337-scanner CLOUDFLARED_CONTAINERNAME
```

Die Tunnel-Origin lautet dann:

```text
http://project1337-nas-library-scanner:43138
```

## 3. Vercel Preview verbinden

Im Vercel-Projekt `project1337` zunächst nur für **Preview** setzen:

```text
NAS_LIBRARY_SCANNER_URL=https://nas-scanner.my1337.de
NAS_LIBRARY_SCANNER_SECRET=<derselbe Wert aus der NAS-.env>
NAS_LIBRARY_SCANNER_TIMEOUT_MS=45000
```

Danach das Beta-Preview neu bauen. Production erhält diese Variablen erst nach
der Prüfung des vollständigen Beta-Ablaufs.

## Betrieb

```bash
docker compose logs -f --tail=100 nas-library-scanner
docker compose restart nas-library-scanner
docker compose up -d --build
```

Die Logs enthalten Scanzeit, Anzahl und Gesamtgröße, aber keine Datei- oder
Ordnernamen.
