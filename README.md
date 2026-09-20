# Meeting to Kanban 🎙️ ➔ 📋

> **Vom gesprochenen Meeting direkt zum priorisierten Kanban-Board.**  
> Lokale Audioaufnahme, multimodale KI-Transkription mit präziser Sprecher-Diarisierung, intelligente Sprecher-Deduktion und vollautomatische Aufgaben-Extraktion – schnell, datenschutzfreundlich und direkt im Browser.

---

## ✨ Features

### 🎙️ Audioaufnahme & Lokale Speicherung
- **Live-Aufnahme:** Mikrofonaufnahme mit Pegel-Wellenform, Pause-, Fortsetzen- und Stopp-Funktionen.
- **Automatisierte Audio-Optimierung:** Konvertierung in 16 kHz Mono PCM WAV im Browser für höchste Transkriptionsgenauigkeit.
- **100% Lokale Daten:** Audiodaten und Meetings werden sicher in der Browser-Datenbank (**IndexedDB**) gespeichert.

### 🤖 Multimodale KI-Transkription & Diarisierung
- **State-of-the-Art Modelle:** Anbindung an OpenRouter (z.B. Google Gemini 3.8 Flash, DeepSeek Chat).
- **Sprecher-Diarisierung:** Erkennung und Konsistenz-Clusterung unterschiedlicher Sprecher über das gesamte Audio.
- **Erneute AI-Transkription:** Jederzeit erneute Transkription mit Live-Reasoning und Fortschritts-Stream auf Knopfdruck.

### ⏱️ Interaktive Zeitleiste & Dialog-Transkript
- **Minuten-Zeitleiste:** Visuelle Zeitleiste mit farbigen Sprechermarkern und Hover-Vorschau der gesprochenen Inhalte.
- **Synchrones Scrubbing:** Klick in die Zeitleiste springt exakt an die entsprechende Stelle im Transkript (mit automatischem Scrolling).
- **Leichtes Dialog-Design:** Schlankes Transkript im Format `Name: Text` mit Sofort-Audio-Wiedergabe pro Sprechbeitrag.

### 👥 Sprecherverwaltung & Original-Audio
- **Web Audio API:** Sample-genaue Wiedergabe des **echten Originaltons** statt synthetischer Stimmen.
- **Sprecher zuordnen:** Inline-Umbenennung von Sprechern direkt im Transkript-Kopf.
- **Sprecher zusammenführen (Merge):** Verschmelzen von Sprechern mit Sicherheitsabfrage vor irreversibler Neuzuweisung aller Segmente und Aufgaben.

### 📋 Intelligentes Kanban Board
- **Automatische Task-Extraktion:** KI analysiert das Meeting auf konkrete To-Dos, Beschreibungen und Prioritäten (*Low*, *Medium*, *High*, *Urgent*).
- **Deutsche Datumslogik:** Erkennt relative Termine wie *„bis nächsten Freitag“*, *„übermorgen“* oder *„Ende der Woche“*.
- **Interaktiver Workflow:** Spalten *To Do*, *In Progress*, *Done* mit Suchfunktion, Filtern und manuellem Hinzufügen.
- **Belohnung:** Konfetti-Animation beim Erledigen von Aufgaben! 🎉

### 📁 Meetings-Verwaltung & SaaS UI
- **Direktes Umbennen:** Meeting-Titel können direkt per Klick im Header umbenannt und sofort gespeichert werden.
- **Aufnahmen-Schnellzugriff:** Dropdown und Schnell-Lösch-Button direkt in der Hauptnavigation.
- **Executive SaaS Design:** Klares, leichtes Design mit nahtlosem Wechsel zwischen **Light- & Dark-Mode**.
- **Progressive Web App (PWA):** Als App installierbar und mobil optimiert.

---

## 🚀 Schnellstart

### 1. Repository klonen & Abhängigkeiten installieren

```bash
git clone https://github.com/superurban/Meeting-to-Kanban.git
cd Meeting-to-Kanban
npm install
```

### 2. API-Key konfigurieren (.env)

Kopiere die `.env.example`-Datei zu `.env`:

```bash
cp .env.example .env
```

Trage deinen [OpenRouter API-Key](https://openrouter.ai/keys) in `.env` ein:

```env
VITE_OPENROUTER_API_KEY=sk-or-v1-dein-key-hier...
```

*(Hinweis: Die `.env`-Datei ist in `.gitignore` eingetragen und wird **nicht** mit GitHub synchronisiert. Alternativ kann der Key auch direkt im Einstellungsmenü der Web-App hinterlegt werden.)*

### 3. Entwicklungsserver starten

```bash
npm run dev
```

Die App ist nun unter `http://localhost:5173` erreichbar.

---

## 🛠️ Befehle

| Befehl | Beschreibung |
|---|---|
| `npm run dev` | Startet den Vite-Entwicklungsserver mit Hot Module Replacement (HMR). |
| `npm run build` | Führt TypeScript-Prüfung (`tsc -b`) durch und baut das Produktions-Bundle. |
| `npx vitest run` | Führt die Unit- und Integrationstests (Sprecher-Deduktion, Datums-Parser, Task-Extraktion) aus. |
| `npm run preview` | Startet einen lokalen Webserver zur Vorschau des Produktions-Builds. |

---

## 🔒 Datenschutz & Sicherheit

- **Lokale Datenhaltung:** Aufnahmen, Transkripte und Aufgaben werden lokal in deinem Browser (IndexedDB / LocalStorage) gespeichert.
- **Keine Cloud-Datenbank:** Es gibt kein zentrales Backend, das deine Aufnahmen speichert.
- **Sichere Secrets:** API-Tokens verbleiben in der lokalen `.env` bzw. im Browser-Speicher und werden niemals in Repositories committed.

---

## 🏗️ Tech-Stack

- **Frontend:** React 19, TypeScript, Vite
- **Styling:** Tailwind CSS (v4), Lucide Icons
- **Audio:** Web Audio API, MediaRecorder API, Browser-native WAV-Konvertierung
- **KI:** OpenRouter API (Google Gemini 3.8 Flash, DeepSeek Chat)
- **State & Storage:** IndexedDB (idb), LocalStorage
- **Testing:** Vitest
- **PWA:** vite-plugin-pwa, Workbox
