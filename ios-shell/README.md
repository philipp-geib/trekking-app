# TREKKING für iPhone (SideStore) und Android (APK)

Kleine native App um die Web-App (trek-king.pages.dev): Standort, Aufzeichnung und Sprachansagen auch bei gesperrtem
Bildschirm, Google-Anmeldung, Hinweis vor dem Ablauf. Alles andere kommt wie gewohnt aus der Web-App.

## Installieren (einmalig, je Person)

Offizielle Anleitung: <https://docs.sidestore.io> (Reiter „iOS 18.0+“). Kurzfassung auf Deutsch (21./22.11. mit iOS 26 durchgespielt):

**Vorbereiten (iPhone)**
1. iPhone braucht einen Code, WLAN (kein Mobilfunk) und eine Apple-ID (Einstellungen → ganz oben eigener Name → E-Mail
   darunter). Passwort vergessen: Einstellungen → Name → Anmeldung und Sicherheit → Passwort ändern (mit iPhone-Code).
2. Aus dem App Store **LocalDevVPN** installieren, öffnen, **Connect**, „VPN-Konfiguration erlauben“.
   Dieses VPN muss bei jedem Installieren/Erneuern in SideStore an sein.

**Am Computer (einmalig, hier Mac)**
3. **iloader** von <https://iloader.app> installieren (Mac: .dmg → Programme; „kann nicht geöffnet werden“ →
   Systemeinstellungen → Datenschutz & Sicherheit → „Trotzdem öffnen“).
4. iPhone per Kabel anschließen, entsperren, **auf dem iPhone** „Diesem Computer vertrauen?“ → Vertrauen + Code.
5. iloader: links Apple-ID + Passwort → **Login**; rechts unter DEVICES das iPhone anklicken („Selected“);
   unter INSTALLERS **„SideStore (Stable)“**. Warten, bis Download, Sign & Install und Pairing File einen Haken haben.

**Wieder am iPhone**
6. Einstellungen → Allgemein → **VPN und Geräteverwaltung** → „Entwickler-App“ (erscheint erst nach Schritt 5) →
   eigene Apple-ID → **vertrauen**.
7. Einstellungen → Datenschutz & Sicherheit → ganz unten **Entwicklermodus** an → Neustart → „Aktivieren“.
8. LocalDevVPN → Connect. SideStore öffnen → **Settings** und zuerst Anisette einstellen (seit 20.11. nötig, sonst
   scheitert die Anmeldung mit 503/401 – am 22.11. so gelöst, Quelle SideStore-Issue #1745):
   - **On-Device Anisette** aus
   - **Anisette Server** → **„SideStore (New)“** (Nr. 5)
   - **Reset adi.pb** → Header **behalten**
   - **Anisette Client Configuration** → genau so eintragen und **Save Overrides**:
     - Client Info: `<MacBookPro13,3> <Mac OS X;26.6;25F84> <com.apple.AuthKit/1 (com.apple.akd/1.0)>`
     - User Agent: `akd/1.0 CFNetwork/811.5.4 Darwin/16.7.0`
   - SideStore ganz schließen (App-Umschalter hochwischen), neu öffnen.
9. **Settings → Sign in with Apple ID** (dieselbe Apple-ID wie in iloader).
10. **My Apps** → neben SideStore auf **„7 DAYS“** tippen (bei Zertifikat-Frage „Yes“/„Refresh Now“).

**TREKKING installieren**
11. In Safari <https://trek-king.pages.dev/app/TREKKING.ipa> laden.
12. SideStore → **My Apps** → **+** → Downloads → TREKKING.ipa. Frage zur Erweiterung (Live-Aktivität) →
    **„Register App ID for Each Extension“**.
13. TREKKING öffnen, Konto anlegen bzw. anmelden – beim ersten Tourstart Standort **„Immer“**.

Alle 7 Tage muss die App in SideStore erneuert werden („7 DAYS“ bzw. „Refresh All“, VPN an; geht am iPhone, auch per
Kurzbefehl-Automation). TREKKING zeigt es 2 Tage vorher an und schickt 1 Tag und 1 Stunde vorher eine Mitteilung.
Abgelaufen = App öffnet nicht, Daten bleiben.
Nach iOS-Update/Zurücksetzen kann die Pairing-Datei ungültig werden → in iloader „Manage Pairing File“ neu ablegen.

### Alternative: AltStore Classic (erneuert automatisch, wenn der Mac läuft)

Stand 22.11.2026: AltServer hat selbst einen bekannten Apple-Anmeldefehler (AltStore arbeitet mit SideStore an einer Lösung) – erst nach einem AltServer-Update probieren, nicht wiederholt anmelden (Apple sperrt sonst kurz das Konto).
1. AltServer von <https://altstore.io> laden → Programme → öffnen (Symbol oben in der Menüleiste). AltServer → „Beim Anmelden starten“ an.
2. iPhone per Kabel, entsperren, „Vertrauen“. Im Finder das iPhone wählen → „Dieses iPhone bei bestehender WLAN-Verbindung anzeigen“ an.
3. Menüleiste → AltServer → **Install AltStore** → iPhone → Apple-ID + Passwort (fragt AltServer nach dem Mail-Plug-in: der Anleitung im Fenster folgen).
4. iPhone: Einstellungen → Allgemein → VPN und Geräteverwaltung → eigene Apple-ID → vertrauen. Entwicklermodus muss an sein.
5. TREKKING.ipa in Safari laden → AltStore → **My Apps** → **+** → Datei wählen.
   Erscheint TREKKING danach doppelt: vorher kurz warten (Abgleich), alte löschen, in der neuen anmelden – Touren kommen aus dem Konto.
6. Höchstens 3 selbst installierte Apps je kostenloser Apple-ID → SideStore löschen, wenn es nicht mehr gebraucht wird.

Automatisch erneuert wird, solange der Mac **wach** ist, AltServer läuft und iPhone + Mac im **selben WLAN** sind (Hintergrundaktualisierung für AltStore an).
Sonst: AltStore → My Apps → „Refresh All“, wenn der Mac in der Nähe ist.

**Während der Tour, Handy gesperrt:** Aufzeichnung und Ansagen laufen weiter. Auf dem Sperrbildschirm steht eine
Live-Aktivität (nächste Abbiegung mit Pfeil, Reststrecke, Balken; antippen = Navigation). Fehlt sie: Einstellungen →
TREKKING → **Live-Aktivitäten** an. Die App enthält dafür eine Erweiterung – SideStore/iloader brauchen damit 2 der
10 App-IDs pro Woche (kostenlose Apple-ID).

### Problem: Anmeldung in SideStore schlägt fehl

Meldung z. B. **„Failed to Sign In – ADI native error (-45063) … Pending ADI session“** (bzw. beim Erneuern
„You are not signed in“). Ursache: Apple verlangt bei der Anmeldung Gerätedaten („Anisette“). iloader nimmt die echten
des Macs (klappt), SideStore holt sie von einem fremden Anisette-Server – ist der überlastet, kaputt oder von Apple
geblockt, wird die Geräte-Anmeldung nicht fertig. Liegt weder am Passwort noch an TREKKING.

Was helfen kann:
- **Meldung 503/401:** Schritt 8 genau so wiederholen (vor allem Client Info + User Agent, Save Overrides, SideStore neu starten).
- Ein paarmal erneut versuchen; SideStore ganz schließen, LocalDevVPN verbinden, wieder öffnen.
- SideStore → Settings → **Anisette Server** → einen anderen wählen (alle durchprobieren).
- Falls vorhanden: Settings → **„Reset adi.pb“**, dann SideStore neu starten.
- Einstellungen → Allgemein → Datum & Uhrzeit → „Automatisch einstellen“ an.
- Einige Stunden später nochmal – solche Störungen verschwinden oft von selbst.

**Umweg (funktioniert sicher):** TREKKING.ipa am Mac laden, iPhone per Kabel, in iloader iPhone auswählen →
**„Import IPA“** → TREKKING.ipa. Nachteil: alle 7 Tage am Computer wiederholen (Daten bleiben), bis die Anmeldung in
SideStore klappt – dann kann SideStore TREKKING selbst erneuern.

## Android (einmalig, je Person)

1. Auf dem Handy **TREKKING.apk** laden: Einladungsseite bzw. <https://trek-king.pages.dev/app/TREKKING.apk> (oder GitHub → Releases → „Android-App“).
2. Datei öffnen, „Aus dieser Quelle installieren“ erlauben (Play Protect ggf. „Trotzdem installieren“).
3. TREKKING öffnen, anmelden bzw. Zugang anfragen – beim ersten Tourstart Standort **„Immer zulassen“**.

Während einer Tour liegt TREKKING über dem Sperrbildschirm: Handy einschalten = App bedienbar, ohne PIN (das Handy
selbst bleibt gesperrt).

Kein Ablauf, kein Play Store. Neue Version = neue APK drüber installieren (gleiche Signatur `android-signing/trekking.jks`).
Die Web-App selbst aktualisiert sich wie immer von allein – eine neue APK braucht es nur bei Änderungen an der Hülle.

## Bauen

GitHub Actions `.github/workflows/sidestore-ipa.yml` (macOS, ohne Signatur) und `.github/workflows/android-apk.yml` (Ubuntu, nur arm64,
mit apksigner signiert) bei Push auf `master` in `ios-shell/` oder von Hand.
Lokal prüfen: `npx tsc --noEmit`, `EXPO_OFFLINE=1 npx expo export --platform ios`.
