# Meeting to Kanban

Web-App, die Audioaufnahmen von Meetings transkribiert, Sprecher trennt und daraus automatisch Aufgaben für ein Kanban-Board generiert.

Alle Audiodaten und Transkripte werden lokal im Browser in IndexedDB gespeichert. Zur Transkription und Aufgaben-Extraktion wird OpenRouter (standardmäßig Google Gemini & DeepSeek) angebunden.

---

## Funktionen

- **Audioaufnahme & Konvertierung**: Direkte Aufnahme im Browser mit Pegelanzeige. Vor dem Upload wird das Audio clientseitig in 16-kHz-Mono-WAV umgerechnet, um Übertragungsfehler und Dateigröße zu minimieren.
- **Sprechererkennung (Diarisierung)**: Erkennt Sprecherwechsel, ordnet Segmente Stimmen zu und erlaubt das Umbenennen sowie das Zusammenführen von Sprechern.
- **Originalton-Wiedergabe**: Kein synthetisches Vorlesen – Schnipsel und einzelne Sätze lassen sich per Web Audio API im echten Originalton anhören.
- **Interaktive Zeitleiste**: Zeigt Sprecherblöcke auf einer Minutenachse. Klicks in die Zeitleiste springen synchron an die Textstelle im Transkript.
- **Kanban-Board**: Erkennt Aufgaben, Verantwortliche und deutsche Fristen (z. B. „bis nächsten Freitag“ oder „übermorgen“) und ordnet sie in Spalten (*To Do*, *In Progress*, *Done*) ein.
- **Meetings-Verwaltung**: Meetings können direkt im Header umbenannt, durchsucht oder gelöscht werden.
- **Dark- & Light-Mode**: Passendes Theme für dunkle und helle Systemeinstellungen.

---

## Installation & Setup

### Voraussetzungen
- Node.js (Version 18 oder neuer)
- Ein API-Key von [OpenRouter](https://openrouter.ai/keys)

### 1. Repository klonen und Pakete installieren

```bash
git clone https://github.com/superurban/Meeting-to-Kanban.git
cd Meeting-to-Kanban
npm install
```

### 2. API-Key hinterlegen

Erstelle eine `.env`-Datei auf Basis der Vorlage:

```bash
cp .env.example .env
```

Füge deinen OpenRouter-Key ein:

```env
VITE_OPENROUTER_API_KEY=sk-or-v1-...
```

*Hinweis: Die `.env`-Datei wird nicht ins Git-Repository übernommen. Alternativ kann der Key auch direkt im Einstellungs-Dialog der Oberfläche eingetragen werden.*

### 3. Entwicklungsserver starten

```bash
npm run dev
```

Die Anwendung läuft standardmäßig unter `http://localhost:5173`.

---

## Verfügbare Skripte

- `npm run dev`: Startet die Vite-Entwicklungsumgebung.
- `npm run build`: Baut das Projekt via TypeScript (`tsc -b`) und Vite für die Produktion.
- `npx vitest run`: Führt die Unit- und Integrationstests aus (Datums-Parsing, Sprecher-Deduktion, Task-Extraktion).
- `npm run preview`: Startet eine lokale Vorschau des gebauten `dist`-Ordners.

---

## Technische Details

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS
- **Audioverarbeitung**: MediaRecorder API, Web Audio API (AudioContext)
- **KI-Schnittstelle**: OpenRouter API (`google/gemini-3.8-flash` für multimodales Audio, `deepseek/deepseek-chat` für Aufgabenextraktion)
- **Persistenz**: IndexedDB via `idb` für Audiodaten und Meeting-Metadaten, LocalStorage für Benutzereinstellungen
