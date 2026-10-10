# Drive-first Integration und Änderungsvertrag

Prozessversion: `2026-10-10-drive-first-v1`.

- **Ziel:** gemeinsamer manuell geführter Artist-Prozess in Drive; versionierte Regeln und Vorlagen in GitHub.
- **Inputs:** bestätigte Drive-first-Richtung, bestehender Repository-Basisstand `1b8eb88266278e55a86ccae5c898c53131ab6c77`, sieben Reviews, 24 Aufgaben und 18 Input-Arten.
- **Owner:** betrieblicher Prozessverantwortlicher und konkrete Mitarbeiter werden im LIVE-Stand benannt; keine erfundenen produktiven Assignees.
- **Deliverable:** aktueller README-Einstieg, manueller Team-Schnellstart, Prozessvorlagen, synthetische CLI-Prüfung und Legacy-Katalog.
- **Risiken:** manuelle Pflege, falsche Datei-Freigaben, parallele Änderungen und veraltete Genehmigungen. Dokumentation allein erzwingt keine technische Sicherheit.
- **Abhängigkeiten:** bestehender gemeinsamer Drive-Arbeitsbereich und berechtigte Mitarbeiter. Kein Notion, Supabase oder neuer Hostinganbieter für den neuen manuellen Ablauf erforderlich. Python ist nur für optionale lokale Tests nötig.
- **Approval Owner:** Nutzer beziehungsweise ausdrücklich benannter Prozess-/Datenschutz-/Betriebsverantwortlicher.
- **Definition of Done dieses Drafts:** Drive und GitHub tragen dieselbe Prozessversion; Links und Templates stimmen; lokale synthetische Tests bestanden; keine echten Artist-Daten in GitHub. Die manuelle Team-Abnahme bleibt gesondert nachzuweisen.
- **Nächste Übergabe:** [synthetischen Team-Prüfbogen](workflow/DRIVE_FIRST.de.md) mit konkreten Mitarbeitern durchgehen und Ergebnisse im privaten Betriebsstand dokumentieren.

## Scope

Das neue Modell hat einen operativen Bestand in Drive und eine Regelquelle in GitHub. Der lokale Validator ist optional. Bestehender MCP-Code, Adapter, SQL und Deploymentkonfiguration bleiben erhalten, sind aber nicht der Standardpfad dieses Ablaufs. Ihre alten Backend-Aussagen gelten ausschließlich für den Legacy-Runtime. Keine Migration, Archivierung, Abschaltung, neue Konten oder Merge als Nebenwirkung dieses Drafts.

[Versionskatalog](docs/VERSION_CATALOG.de.md) hält den bisherigen Code-Stand fest. [Testnachweis](workflow/TEST_REPORT.md) trennt lokale Prüfungen von offenen Integrations- und Teamprüfungen. Eine Veröffentlichung als Draft-PR ist keine produktive Zertifizierung.
