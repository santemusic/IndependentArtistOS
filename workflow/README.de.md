# Optionale lokale Prozessprüfung

Prozessversion: `2026-10-10-drive-first-v1`. Der operative Einstieg ist [Drive-first](DRIVE_FIRST.de.md). Drive hält Artists, Aufgaben und Freigaben; GitHub hält Prozessregeln und Vorlagen.

Die dependency-freie Python-CLI ist eine optionale lokale Vorschau und ein Testwerkzeug mit synthetischen Daten. Sie ist kein operativer Masterbestand, kein Drive-Client, keine Team-App und keine automatische Ausführung. Keine echten Artist-Daten in dieses öffentliche Repository oder lokale JSON-Zweitbestände übernehmen.

## Synthetischer Schnelltest

Python 3.10+; geprüft mit Python 3.12.14. Kein Paketinstallationsschritt erforderlich. Vom Repository-Wurzelordner:

```sh
python workflow/artist_os.py validate workflow/examples/demo-artist.json
python workflow/artist_os.py status workflow/examples/demo-artist.json --as-of 2026-10-10
python -m unittest discover -s workflow/tests -v
```

Die CLI enthält außerdem `add-artist` für isolierte synthetische Testfixtures. Der Standardpfad `workflow/private/` wird ignoriert, ist aber weder eine Sicherheitsgrenze noch der gemeinsame Betriebsstand. Gitignore schützt nicht vor erzwungenen Commits oder bereits getrackten Dateien.

## Prüfgrenzen

18 lokale Tests prüfen ausgewählte fachliche Invarianten. Der Validator ist kein allgemeiner JSON-Schema-Validator. Eingetragene Gate-Datensätze authentifizieren keine menschliche Entscheidung. `ready_for_internal_work` erteilt keine Erlaubnis für Außenaktionen. Die CLI synchronisiert nichts und schützt nicht vor konkurrierenden Änderungen.

JSON-Schema und Fixture verwenden weiterhin die technische Schemaversion `1.0.0-draft`; diese ist von der obigen betrieblichen Prozessversion zu unterscheiden. [Testnachweis](TEST_REPORT.md), [Prozessvertrag](PROCESS.de.md), [Team-Betrieb](../TEAM_ARCHITECTURE.de.md).
