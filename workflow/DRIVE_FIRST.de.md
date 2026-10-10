# Drive-first: Team-Schnellstart und manueller Arbeitsablauf

Prozessversion: `2026-10-10-drive-first-v1` (2026-10-10 Drive-first v1.0). Regeln und Vorlagen: GitHub. Operative Daten und Nachweise: Drive.

## Einstieg

- [Arbeitsbereich](https://drive.google.com/drive/folders/1ELleaZx9UdRV6-y6vw4d3a-azcHmmTZ_)
- [LIVE-Arbeitsstand](https://docs.google.com/spreadsheets/d/14Jg_XCytKwLEqMIQZy6kZ3J-EwiU6kFVyQ8Naqgxqac/edit)
- [MASTER-Prozessvorlagen](https://docs.google.com/spreadsheets/d/1o-1_71T8ghBDmlMhQaWTgsF2Kc6AmTWYrzeeHWCi1yk/edit)

Links zeigen bestehende Ziele und ändern keine Zugriffsrechte. Die folgenden Begriffe sind fachliche Datensätze; vorhandene Tabs und Felder im LIVE-Stand verwenden, statt unbemerkt ein zweites System anzulegen.

## Einen Artist und Release übernehmen

1. **Dublette ausschließen:** Artist-ID und bestehenden Artist suchen. Zuständigen Koordinator und Betreuungskontext erfassen. Career Stage und Customer-Success-Onboardingstatus getrennt halten; unbekannte Werte offenlassen.
2. **Quellen sammeln:** Unterlagen privat in Drive ablegen. Pro Quelle ID, Input-Kategorie REQ-01 bis REQ-18, Version, Referenz, Status, Prüfer und Zeitpunkt dokumentieren. Vorhandensein ist keine geprüfte Richtigkeit.
3. **Release bestätigen:** Nur bei tatsächlicher Release-Absicht eine eindeutige Cycle-ID und Planversion anlegen. Aus der GitHub-Vorlage genau 24 Tasktypen BYD-REL-T01 bis BYD-REL-T24 einmal pro Cycle übernehmen. Vor Wiederholung Instanz-IDs prüfen. Kein automatischer Import oder Hintergrundlauf wird vorausgesetzt.
4. **Sieben Reviews verteilen:** Career; Music & Releases; Growth; Content; Live; Relationships; Rights & Revenue. Je Review verantwortliche Person, Quelle/Version, Empfehlung, Risiko und Ergebnis erfassen. Auch ohne geplante Show bleibt der Live-Review erforderlich.
5. **Arbeit zuweisen:** Task-Owner, belegte Frist oder ausdrücklich vorgeschlagenes Planungsfenster, Abhängigkeit, nächster interner Schritt und Beleg festhalten. Persönliche Aufgabenlisten sind Filter auf dem gemeinsamen Bestand.
6. **Gates prüfen:** G0 Arbeitsgrundlage, G1 Plan, G2 Readiness, G3 Abschluss. Der benannte Entscheider prüft die konkrete Plan-/Quellenversion und dokumentiert Entscheidung, Zeitpunkt und Beleg. Keine Freigabe aus fehlenden Angaben ableiten. Bei Ablehnung bleibt die abhängige Arbeit blockiert.
7. **Ausführung belegen:** Aufgabe nur mit tatsächlichem Ergebnis und Beleg abschließen. Hochgeladen, angenommen und öffentlich live sind getrennte Zustände. Externe Ausführung erfolgt nur mit konkreter gültiger Erlaubnis; der manuelle Prozess führt selbst nichts extern aus.
8. **Änderungen und Übergabe:** Neue Asset-/Quellenversion kennzeichnen, betroffene Reviews und Freigaben neu prüfen. Bei Ownerwechsel Kontext und offene Schritte erhalten. Kein Kopieren eines vollständigen Artist-Masterbestands in persönliche Dateien.
9. **Monat und Abschluss:** Ein Paket je Artist und abgeschlossenem Kalendermonat, ergänzend Release-Checks T+7/T+28. Offene Royalties, Rechte oder Zusagen mit Owner, Grund und Wiedervorlage weiterführen. Fehlende Abrechnung ist kein Nullumsatz.

## Manueller Prüfbogen vor Team-Freigabe

Mit ausschließlich synthetischen Angaben im vorgesehenen Testbereich durchführen und Ergebnis, Prüfer, Zeitpunkt und Beleg festhalten. Diese Fälle sind Anforderungen; ihre Existenz bedeutet nicht, dass sie schon bestanden wurden.

- Ein Artist, ein Cycle: 24 eindeutige Taskinstanzen, sieben Reviews und 18 auflösbare Input-Arten.
- Zweite befugte Person sieht denselben Stand; Übergabe ändert Owner, nicht IDs oder Belege.
- Wiederholte Anlage erzeugt keine zweite Taskserie; vorhandene IDs werden vor dem Kopieren erkannt.
- Fehlendes Recht oder abgelehnte Freigabe blockiert die relevante Ausführung.
- Neue Audio-/Artwork-/Quellenversion führt zur erneuten Prüfung, nicht zur stillen Übernahme alter Freigaben.
- Zwei gleichzeitige Änderungen an einer kritischen Zeile werden durch den Koordinator abgeglichen; kein unbemerkter Datenverlust.
- Zwei Release-Cycles und ein Monatswechsel erhalten gemeinsame Quellen und offene Verpflichtungen ohne erfundene Daten.
- Mitarbeiter ohne bestätigten Zugriff erhält keinen Ersatz über öffentliche Freigaben. Austritt und Wiederherstellung werden nach dem tatsächlich vereinbarten Betreiberverfahren geprüft.

## Grenzen

Manuelle Kontrollen sind abhängig von sorgfältiger Pflege und benannten Verantwortlichen. Es gibt keine serverseitig erzwungenen Gates, transaktionalen Änderungen, automatische Erinnerungen, belegte Wiederherstellung oder garantierte Verfügbarkeit allein durch diese Vorlage. Die optionale CLI prüft synthetische Daten; sie liest und schreibt keine Drive-Daten.

## Konkrete Eintragung im LIVE-Sheet

Für jeden tatsächlich bestätigten Cycle im Tab **RELEASE CONTROL** manuell zwölf Zeilen anlegen: eine Zeile `Record Type = Cycle`, sieben `Review`-Zeilen und vier `Gate`-Zeilen (G0–G3). Vor Anlage nach Artist ID + Cycle ID und jeweiligem Typ/Domain suchen. `Record ID` ist je Zeile stabil und eindeutig. `Plan Version`, `Template Version = 2026-10-10-drive-first-v1`, `Coordinator` und `Updated By`/`Updated At` setzen; unbekannte Release-Daten und Entscheidungen bleiben leer. Bei neuen Review-/Gate-Zeilen darf kein erledigter oder freigegebener Zustand vorbelegt werden.

In **TASKS** je Cycle 24 Zeilen aus der Taskvorlage übernehmen. `Cycle ID`, `Task Template ID`, `Plan Version`, `Source IDs / Versions`, `Dependency Task IDs` und `Task Scope` verknüpfen die bestehende Aufgabenzeile. Abhängigkeiten auf konkrete Taskinstanzen desselben Cycles auflösen. `Owner` mit konkreter Person befüllen, `Status` aktiv pflegen und Blockaden in `Blocker` sichtbar machen; `ownerRole` aus der Vorlage ist keine tatsächliche Mitarbeiterzuweisung.

In **DELIVERABLES** Belege und Anfragen über `Input Request ID`, `Source ID`, `Source Version`, `Validation Status`, `Cycle IDs`, `Reporting Period`, `Reviewed By` und `Reviewed At` zuordnen. Eine neue Quellenversion invalidiert betroffene Entscheidungen fachlich; der Koordinator muss dies sichtbar markieren und erneute Prüfung veranlassen. Die Tabelle tut dies nicht automatisch.

In **APPROVALS** die tatsächliche Einzelentscheidung dokumentieren und mit `Cycle ID`, `Plan Version`, `Gate ID`, `Source / Asset Version` und später `Execution Evidence` verbinden. In RELEASE CONTROL wird das Gate-Ergebnis mit `Reviewer / Decider`, `Decision`, `Decision Date`, `Evidence URL` und `Source IDs / Versions` nachvollziehbar referenziert. Der Entscheidungsbeleg in APPROVALS ist führend; die Gatezeile ist dessen Prüfverweis, keine zweite unabhängige Genehmigung. Widersprüche blockieren die Ausführung, bis sie geklärt sind.

Zweiter Release: neue Cycle-ID, neue Record-/Taskinstanzen, wieder sieben Reviews und vier zunächst unentschiedene Gates. Artistweite Quellen dürfen mit konkret geprüfter Version referenziert werden; alte Gate-Freigaben niemals als neue Entscheidungen kopieren. Künstlerweite Aufgaben können mit `Task Scope` gekennzeichnet und als ein führender Datensatz referenziert werden.

## Statuswerte und Belegfelder

- **TASKS → Status** und **DELIVERABLES → Status:** vorhandene strikte Auswahl `Not Started`, `Pending`, `Done`. Initial `Not Started`; laufende beziehungsweise wartende Arbeit `Pending`; `Done` erst mit überprüftem Ergebnis. TASKS verwendet `Owner`, `Evidence URL`, `Blocker` und `Last Updated`; DELIVERABLES verwendet `Drive Evidence URL` und `Dependency / Next Action`.
- **RELEASE CONTROL → Status:** Review-/Gate-Zeilen zunächst `Pending`; Review `Complete` nur mit Prüfer, Entscheidung und Beleg, Gate `Approved` nur mit tatsächlich berechtigter versionsbezogener Entscheidung. Das Feld ist technisch unbeschränkt; diese Regeln werden manuell geprüft.
- **DELIVERABLES → Validation Status:** `unverified`, `valid`, `stale`, `rejected`; noch ungeprüfte Quellen starten `unverified`. Der Empfangsstatus `Done` ersetzt keine Validierung.
- **APPROVALS:** `Approver`, `Status`, `Decision Date` und `Approval Evidence URL` sind die vorhandenen Entscheidungsfelder. Initial `Pending`; eine positive Entscheidung als `Approved` erst nach tatsächlichem Beleg, eine negative Entscheidung ausdrücklich dokumentieren. Das Statusfeld erzwingt technisch keine Auswahl.

Die dokumentierten Statuswerte wurden aus der bestehenden LIVE-Struktur beziehungsweise dem fachlichen Prozess abgeglichen. Die Python-Tests prüfen nur synthetische Tabellen-Datensätze und keine Live-Dropdowns oder menschliche Berechtigung.
