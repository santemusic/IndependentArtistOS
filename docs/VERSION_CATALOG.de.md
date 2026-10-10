# Versionskatalog und Rückkehrgrundlage

Stand: 10. Oktober 2026.

## Bisheriger Runtime-Stand

- Kanonischer Basis-Commit: [`1b8eb88266278e55a86ccae5c898c53131ab6c77`](https://github.com/santemusic/IndependentArtistOS/commit/1b8eb88266278e55a86ccae5c898c53131ab6c77).
- [Vollständiger alter Repository-Baum](https://github.com/santemusic/IndependentArtistOS/tree/1b8eb88266278e55a86ccae5c898c53131ab6c77), einschließlich MCP-Code, Adapter, Render-Konfiguration, Sicherheitsregeln und Betreiberhinweisen.
- Einordnung: bisheriger backendabhängiger Runtime-Pfad; noch nicht als entbehrlich nachgewiesen. Der Commit katalogisiert Code, nicht den verifizierten Live-Deploymentstand oder Datenbankzustand.
- Erhaltung: bestehende Dateien und `main` werden durch diesen Draft nicht ersetzt oder entfernt. Repository und Runtime werden nicht archiviert oder abgeschaltet.

## Neuer Review-Stand

Der neue Standard ist der manuelle Drive-first-Teamprozess. Drive hält operative Daten; GitHub hält Regeln und Vorlagen. `TEAM_ARCHITECTURE.de.md` beschreibt diesen gemeinsamen Arbeitsstand. Die lokale CLI in `workflow/` bleibt ein optionaler synthetischer Validator. Nur Prozessvorlagen und synthetische Daten gehören in Git. Die Veröffentlichung ist keine Freigabe für echte Artist-Daten und kein produktiver Cutover.

## Rückkehr und spätere Archivierung

Solange der Draft nicht gemergt oder ausgerollt ist, ist keine Produktionsrückkehr nötig. Der Basis-Commit bleibt die genaue Code-Referenz für einen später gesondert freizugebenden Rückwechsel. Ein Code-Checkout allein stellt weder Daten noch Geheimnisse oder externe Infrastruktur wieder her; es ist kein getesteter Betriebs-Restore.

Vor echten Betriebsdaten müssen Team-Zugang, Rollen, private Ablage, manuelle Gate-Prüfung, Umgang mit konkurrierenden Änderungen und Wiederherstellung geprüft sein. Eine technische Migration oder Abschaltung des Legacy-Runtime braucht einen eigenen geprüften Plan. Erst nach verifiziertem Ersatz und geklärten Aufbewahrungsanforderungen kann entschieden werden, welche alten Komponenten entbehrlich sind. Keine automatischen Lösch-, Archivierungs- oder Abschaltaktionen aus diesem Dokument ableiten.

