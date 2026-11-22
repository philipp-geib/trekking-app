# TREKKING – iPhone-App (Hülle)

Öffentlicher Bau-Zweig der iPhone-App von TREKKING: nur die kleine Expo-Hülle (`ios-shell/`, WebView auf trek-king.pages.dev
mit Standort, Hintergrund-Aufzeichnung, Sprachansagen, App-Symbol) und zwei reine Rechen-Dateien aus `app/src/lib/`.
Keine Zugangsdaten, keine Nutzerdaten. Wird aus dem privaten Haupt-Repo gespiegelt (`ios-shell/scripts/sync-public.sh`) –
hier nichts von Hand ändern.

GitHub Actions baut bei jedem Push eine unsignierte `TREKKING.ipa` (Release „iphone“), installiert per iloader/SideStore.
