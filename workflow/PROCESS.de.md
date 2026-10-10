# Prozessvertrag: vom Artist-Eingang zum nächsten Release

Prozessversion: `2026-10-10-drive-first-v1`. Manueller Team-Betrieb gemäß [Drive-first-Schnellstart](DRIVE_FIRST.de.md). Keine tatsächlichen Artist-Fakten oder Genehmigungen enthalten. Drive ist der operative Stand; GitHub hält Regeln und Vorlagen. Aussagen zum Prototyp beschreiben nur das optionale lokale Testwerkzeug.

## 1. Zuständigkeiten und Begriffe

Der verantwortliche Mitarbeiter koordiniert Intake, Quellenprüfung, Priorisierung und Übergaben. Sieben Fachrollen prüfen ihre Domänen; eine Person kann mehrere Rollen übernehmen. Artist beziehungsweise benannter Management-Entscheider bestätigt Ziele und freigabepflichtige Inhalte. Spezialisten entscheiden im eigenen Rechts-/Steuer-/Vertragsmandat. Kein Agent darf fehlende Berechtigung aus einer vorhandenen Datei ableiten.

`onboardingStatus` bezeichnet Customer Success (CS), beispielsweise Pre-onboarding, Onboarding oder aktive Betreuung. `careerStage` bezeichnet die künstlerische Entwicklungsphase. Beide sind im neuen Datensatz null. Die genaue Taxonomie und Zuordnung werden bestätigt; keine automatischen Follower-Schwellen. Ein Artist kann bereits fortgeschritten sein und trotzdem gerade im Service-Onboarding stehen.

## 2. Artist anlegen und übernehmen

1. Interne stabile Artist-ID und zuständige Person festlegen; Dublette prüfen.
2. Umfang der Betreuung und zulässige Datenverarbeitung bestätigen. Nur erforderliche Daten im privaten Drive-Arbeitsstand erfassen.
3. Ziele, aktuelle Position, Kapazität, Budgetgrenzen, vorhandene Releases und laufende Verpflichtungen sammeln. Unbekanntes bleibt unbekannt.
4. Einen datierten Ausgangsstand mit Quellen und offenen Fragen festhalten.
5. Der Mitarbeiter liest Status, fehlende Inputs und Entscheidungen. Übernahme ist abgeschlossen, wenn ein anderer befugter Mitarbeiter die offenen Schritte eindeutig versteht, ohne einen zweiten Status zu führen.

## 3. Release-Zyklus

Eine bestätigte neue Release-Absicht erzeugt eine neue `cycleId`, eine Planversion, genau sieben Reviews sowie die 24 Task-Instanzen aus der Vorlage. Artist-weite Fakten können mit geprüfter Version referenziert werden. Frühere Freigaben werden nicht übernommen. Im Prototyp wird der erste Cycle bei `add-artist` erzeugt; spätere Cycles werden gemäß Schema kontrolliert ergänzt, nicht durch einen erfundenen CLI-Befehl.

Die sieben Reviews sind Career, Music & Releases, Growth, Content, Live, Relationships und Rights & Revenue. Jede Fachrolle liefert: belegte Ausgangslage, fehlende Informationen, Bedeutung dieses Releases, konkrete Empfehlung einschließlich bewusst keiner zusätzlichen Maßnahme, Risiken, Owner, Erfolgsbeleg und nächste Prüfung. `complete` braucht Reviewer, Entscheidung und Evidenz. Auch ohne Live-Aktivierung wird der Live-Review durchgeführt.

24 Aufgaben bilden Intake, Strategie und Reviews, Planfreigabe, Assets und Lieferung, Content-/Growth-/Relationship-Vorbereitung, Readiness, Live-Verifikation, T+7/T+28-Lernen sowie Abschluss und offene Abrechnung ab. Abhängigkeiten und alle 18 Input-IDs sind in `templates/` auflösbar. Die konkrete Task-Ausführung bleibt beaufsichtigt; die Daten enthalten keine automatisch erteilte Außenwirkung.

## 4. Vier Gates

- **G0 Arbeitsgrundlage:** Artist, Release-Absicht, Kontext, Quellenstand und offene Informationen verstanden. Sichere interne Analyse darf früher beginnen.
- **G1 Plan:** sieben aktuelle Reviews, priorisierte Ergebnisse, Owner, Kapazität, Terminannahmen und Budgetrahmen entschieden. Maximal drei Wochen-Ergebnisse als Fokus, ohne die anderen Domänen zu löschen.
- **G2 Readiness:** finale Audio-/Artwork-Versionen, Rechte, Credits, Metadaten, Lieferbelege und jede konkrete Veröffentlichungserlaubnis geprüft. Hochgeladen, angenommen und öffentlich live bleiben verschiedene Tatsachen.
- **G3 Abschluss:** Ergebnisse und Unsicherheiten dokumentiert, Learnings übergeben, offene Verpflichtungen samt Owner und Wiedervorlage erhalten.

Ein Gate braucht menschlichen Entscheider, Zeitpunkt, konkrete Planversion und Beleg. Ein freigegebener Plan erlaubt weder jede Zahlung noch Vertragsschluss oder Outreach. Externe Handlungen benötigen ihre konkrete, gültige Einzelgenehmigung und später einen tatsächlichen Ausführungsbeleg. Die CLI implementiert keinen Außenexecutor.

Im Prototyp werden Gates konservativ sequenziell ausgewertet. G1 und spätere Gates gelten nur mit allen sieben abgeschlossenen Reviews derselben Planversion. Tasks ab T12 brauchen G1, ab T19 zusätzlich G2. Abhängigkeiten müssen tatsächlich `done` sein; ein `not_applicable` Vorgänger gibt Nachfolger nicht automatisch frei. Abweichende fachliche Routen brauchen eine ausdrückliche spätere Workflow-Erweiterung.

## 5. Inputs und Belege

Die 18 Anfragearten decken Karrieregrundlage, Monatsänderungen, Budget, Release-Daten, Audio, Artwork/Text, Rechte, Distributor, DSP, Social, Content, Kampagnen, Shows, Showabschluss, Beziehungen, Royalties, Registrierung und Entscheidungen ab. Eine Anforderung benennt benötigte Angaben, liefernde und prüfende Rolle, Zeitfenster, Evidenzprüfung und Verhalten bei Lücken.

Eine Quelle hat eine stabile ID, Input-Kategorie, Version, Referenz und Prüfzustand (`unverified`, `valid`, `stale`, `rejected`). Hinzu kommen soweit sinnvoll Zeitraum, Dateihash, konkrete Belegstelle, Prüfer/Zeitpunkt und Gültigkeitsende. Ein Cycle referenziert ausdrücklich die verwendete Quellenversion. Dateien oder Aussageinhalte erteilen keine Erlaubnisse. Widersprüche werden dokumentiert und vom Owner geklärt.

Wird eine Quelle materiell ersetzt, ihre Version erhöhen; betroffene Cycles zeigen anschließend eine erneute Prüfpflicht. Erst nach erneuter Prüfung die Referenz aktualisieren, Planversion bei geänderter Entscheidung erhöhen und Reviews/Gates/Tasks neu bewerten. Nicht einfach alte Freigaben auf die neue Version kopieren. Der Prototyp blockiert vorsichtshalber den betroffenen gesamten Cycle bei erkannten Quellenversionskonflikten; gezieltere Abhängigkeitsinvalidierung ist spätere Arbeit.

## 6. Monatlicher Rhythmus

Ein Paket pro Artist und abgeschlossenem Kalendermonat, keine wiederholten Einreichungen je Release. Standardvorschlag: am ersten Geschäftstag anfordern, bis zum dritten anstreben, danach sichten, Rückfragen bündeln und höchstens drei priorisierte Ergebnisse beschließen. Diese Fristen werden beim Onboarding vereinbart und lösen hier keine automatischen Nachrichten aus.

Für alle sieben Domänen Änderungen oder bestätigtes „unverändert“ erfassen. Kampagnen-/Show-/Royalty-Daten nur soweit anwendbar oder verfügbar; „noch keine Abrechnung“ ist kein Nullumsatz. Eingangszeitraum und KPI-Definition müssen stimmen. Monatsdaten können mehrere Cycles informieren. T+7 und T+28 sind zusätzliche releasebezogene Prüfpunkte, keine behaupteten Provider-Abgabefristen.

## 7. Überlappung, Abschluss und Carry-forward

Mehrere Cycles dürfen gleichzeitig offen sein; jede ID ist eindeutig. Gemeinsame Quellen werden referenziert. Eine gemeinsame Artist-Aufgabe wird nicht pro Release dupliziert: ein führender Datensatz und Verweise sind das Zielmodell. Der Prototyp hält Release-Aufgaben getrennt und implementiert noch keine automatische artistweite Deduplizierung.

Offene Abrechnungen können beim G3-Abschluss als Carry-forward mit Cycle-/Task-Verweis, Owner, Grund und nächstem Prüfdatum bestehen bleiben. Andere unvollständige Pflichtaufgaben blockieren den Abschluss. Ein neuer Release darf die Geschichte, offene Rechte, Kontaktzusagen oder ausstehende Einnahmen nicht löschen.

## 8. Versionierung, Idempotenz und Wiederaufnahme

Templateversion, Datenrevision, Planversion und Quellenversion sind verschiedene Werte. Eine Wiederholung mit gleicher Artist-/Cycle-/Template-ID erzeugt keine zweite Task-Instanz. Eine neue Planversion erzeugt Prüfbedarf statt einer stillen Ersetzung. Die aktuelle CLI verhindert doppelte initiale Artist-Dateien und doppelte IDs innerhalb eines Datensatzes; sie implementiert noch keine transaktionalen Updates oder Schema-Migrationen.

Im manuellen Drive-Betrieb vor jeder Änderung den aktuellen Stand prüfen; kritische Zeilen und Entscheidungen durch den benannten Koordinator nacheinander pflegen. Fachlicher Idempotenzschlüssel: Artist + Cycle oder Artist-Scope + Tasktyp + relevante Version + Ziel. Vor dem Kopieren von Vorlagen auf vorhandene IDs prüfen. Unsichere externe Ergebnisse niemals blind wiederholen. Änderungsgrund und Actor dokumentieren; Dateiversionsverlauf allein ist keine manipulationssichere Audit-Historie.

## 9. Abnahme vor Einführung

Mit einem synthetischen Artist durchspielen: leerer Intake, vollständiger Review, fehlendes Recht, abgelehnte Freigabe, neue Assetversion, Datumsänderung, wiederholte Anlage, zwei Releases, Monatswechsel, verspätete Royalty und Übergabe an einen zweiten Mitarbeiter. Mitarbeiter müssen innerhalb weniger Minuten dieselben nächsten Schritte aus denselben Daten ableiten. Erst danach echte Daten und ein beschlossenes Zugriff-/Backupmodell einsetzen.

Bestätigtes Team-Ziel: Alle berechtigten Mitarbeiter arbeiten auf demselben Drive-Bestand mit Artists und Aufgaben; Arbeit wird intern zugewiesen und übergeben. [TEAM_ARCHITECTURE.de.md](../TEAM_ARCHITECTURE.de.md) beschreibt den aktuellen manuellen Betriebsvertrag. GitHub ist die Prozessquelle, keine operative Datenbank. Eine eigene Team-App oder neue Backend-Datenbank ist keine Voraussetzung.

### Bedingte Inputs ohne erfundene Daten

Für REQ-12 (bezahlte Kampagne), REQ-13 (Shows/Booking) und REQ-14 (Showabschluss) erlaubt `inputExceptions` eine konkrete Nichtanwendbarkeit mit Begründung, prüfender Person und Planversion. Eine Änderung des Plans macht die Ausnahme erneut prüfpflichtig. Rechte, finale Assets und andere Pflichtbelege lassen sich damit nicht umgehen. Noch nicht eingegangene Royalties bleiben offen und können als Verpflichtung weitergeführt werden; sie werden nicht als null oder erledigt erfunden. Ein N/A-Task hat weiterhin keine automatische Freigabewirkung auf seine Nachfolger.

