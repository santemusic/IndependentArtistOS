# Testnachweis

Prozessversion: `2026-10-10-drive-first-v1`. Neuer Standard: manueller Drive-first-Teamprozess. Die lokale CLI bleibt optional.

Datum: 10. Oktober 2026. Umgebung: isoliertes Cloud-Arbeitsverzeichnis, Python 3.12.14. Keine zusätzlichen Pakete installiert.

## Bestanden

- 18 Unittests: Initialisierung, genau 24 Tasks/7 Reviews, doppelte IDs, fehlende Inputs, Belege für Abschluss und Freigaben, Gate-/Planversionen, bedingte Input-Ausnahmen, unverzichtbare Rechteprüfung, Quellenversionswechsel, veraltete erledigte Aufgaben, schreibgeschützter deterministischer Status, Blockade eines Abschlusses ohne G3, reine Artist-Anlage ohne erfundenen Release, sichere ID-Form und Verweigerung eines zweiten Dateianlegeversuchs.
- Task-DAG und referenzierte Input-IDs der 24 Vorlagen vollständig auflösbar; 18 Input-Arten vorhanden.
- Python-Syntaxkompilierung.
- JSON Schema Draft 2020-12 syntaktisch gültig und synthetisches Beispiel mit bereits verfügbarer jsonschema-Bibliothek validiert. Diese Bibliothek ist keine CLI-Laufzeitabhängigkeit.
- CLI `validate` und `status` auf dem Beispiel. Ergebnis: `LOCAL_PLANNING_ONLY`, `WAITING_FOR_DATA`, 24 Tasks, 7 offene Reviews.
- `git check-ignore` in einem temporären Repository bestätigt den Ausschluss von `workflow/private/demo.json`.

## Nicht ausgeführt beziehungsweise nicht implementiert

- Kein Build, Typecheck oder Testlauf des bestehenden MCP-Projekts: dessen Code wurde nicht geändert und liegt nicht als vollständiger Checkout vor.
- Keine Datenmigration, Authentifizierung, produktive Integration, externe Veröffentlichung, Remote-Synchronisierung, Mehrbenutzer-/Race-Tests oder Browser-UI.
- Keine vollständige fachliche End-to-End-Abnahme eines realen Releases. Gates sind menschliche Datensätze, keine automatische Rechte-/Budgetprüfung.
- Der kleine CLI-Validator implementiert ausgewählte Invarianten, nicht den gesamten JSON-Schema-Standard. Nicht als untrusted multi-user API verwenden.
- Manuelle JSON-Änderungen sind nicht gegen Manipulation, Schreibkonflikte oder menschliche Fehler abgesichert. Revisions-/Auditfelder allein liefern keine transaktionalen Garantien.

## Wiederholen

```sh
python -m unittest discover -s workflow/tests -v
python -m py_compile workflow/artist_os.py workflow/tests/test_workflow.py
python workflow/artist_os.py validate workflow/examples/demo-artist.json
python workflow/artist_os.py status workflow/examples/demo-artist.json --as-of 2026-10-10
```


## Ergänzung: synthetischer Drive-Tabellen-Durchlauf

Am 10. Oktober 2026 wurden insgesamt **24 lokale Tests bestanden**: 18 vorhandene CLI-Tests plus sechs unabhängige Tabellenvertrags-Tests in `tests/test_drive_contract.py`. Die zusätzlichen Tests nutzen ausschließlich fiktive IDs, Rollen und `urn:demo:`-Belege.

Geprüft wurden die beobachteten Header-Zuordnungen für RELEASE CONTROL, TASKS, DELIVERABLES und APPROVALS; pro Cycle zwölf Kontrollzeilen (1 Cycle, 7 Reviews, 4 Gates), 24 eindeutige Taskinstanzen, 18 Input-Arten und aufgelöste Abhängigkeiten. Weitere Fälle: manuell eingetragene positive Entscheidung mit übereinstimmendem Beleg, fehlender Input mit sichtbarem Blocker, fehlende/negative Freigabe, zweiter Cycle ohne übernommene Gate-Entscheidung, neue Quellenversion und Owner-Übergabe mit unveränderter Task-ID.

**Grenze:** Dies ist ein lokaler synthetischer Daten-Durchlauf des dokumentierten Schemas, keine Bedienung oder produktive Abnahme des LIVE-Sheets. Es wurden keine synthetischen oder realen Artist-Zeilen in Drive geschrieben. Die Tests beweisen weder Zugriffsschutz, automatische Gate-Durchsetzung, Race-Sicherheit, tatsächliche Mitarbeiterübergabe noch Wiederherstellung. Diese Punkte benötigen die manuelle Abnahme aus `DRIVE_FIRST.de.md`.
