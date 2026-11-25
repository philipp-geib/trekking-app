// TREKKING für iPhone und Android: die Web-App (trek-king.pages.dev) in einer WebView. Nativ dazu: Standort, Aufzeichnung und
// Sprachansagen bei gesperrtem Bildschirm, Kamera-Fotos in die Mediathek (src/photos.ts), Google-Anmeldung im Browser-Fenster, Hinweis vor dem Ablauf (nur iPhone/SideStore).
// Android: randlos – Ränder gehen per Brücke an die Seite (lib/webSafeArea.ts), Zurück-Taste = Zurück in der WebView,
// während einer Tour über dem Sperrbildschirm (modules/lock-screen). iPhone: App-Symbol nach Farbe + Darstellung (modules/app-icon).
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { StatusBar, type StatusBarStyle } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Appearance, AppState, BackHandler, KeyboardAvoidingView, Linking, Platform, Pressable, StatusBar as RNStatusBar, StyleSheet, Text, View } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewOpenWindowEvent } from 'react-native-webview/lib/WebViewTypes';

// Die Typen der WebView schneiden iOS/Android/Windows-Props zu „never“ – deshalb locker typisiert.
const Web = WebView as unknown as React.ComponentType<Record<string, unknown> & { ref?: React.Ref<WebView> }>;
import { bridge } from './src/bridge';
import { checkExpiry, planExpiryNotes, setExpiryNotes } from './src/expiry';
import { isEn, setLang } from './src/lang';
import { deviceVoices, hush, sayFromPage, setNav, type NavMsg } from './src/guide';
import { clearKm, setKm, type KmMsg } from './src/km';
import { savePhoto } from './src/photos';
import { shareFile, shareText } from './src/files';
import { canInstall, installReady, prepare, selfUpdateOk, updateNow } from './src/selfUpdate';
import { currentPosition, setDeliver, setWatch, startTour, stopTour, takeBuffer, type Loc } from './src/location';
import { setAppIcon } from './modules/app-icon';
import { showWhenLocked } from './modules/lock-screen';

const HOME = 'https://trek-king.pages.dev';
/** Build-Nummer aus app.json (beim Bauen eingebettet) – höher als in /app/version.json = aktuell */
const BUILD = Number(Platform.OS === 'android' ? Constants.expoConfig?.android?.versionCode : Constants.expoConfig?.ios?.buildNumber) || 0;
const TEAL = '#438482';
/** Hintergrund bis die Seite da ist = Farbe ihres Startbilds (eigene Farbe/Nacht), von der Seite gemeldet und gemerkt */
const lookFile = new File(Paths.document, 'look.json');
const HEX = /^#[0-9a-f]{6}$/i;
type Look = { bg?: string; scheme?: Scheme };
type Scheme = 'light' | 'dark' | 'auto';
const look: Look = (() => {
  try {
    return lookFile.exists ? (JSON.parse(lookFile.textSync()) as Look) : {};
  } catch {
    return {};
  }
})();
const savedBg = look.bg && HEX.test(look.bg) ? look.bg : TEAL;
function saveLook(patch: Look) {
  Object.assign(look, patch);
  try {
    lookFile.write(JSON.stringify(look));
  } catch {
    // egal – nächster Start nimmt dann Teal/System
  }
}
function saveBg(bg: string) {
  if (HEX.test(bg) && bg !== look.bg) saveLook({ bg });
}
/** Hell/Dunkel wie in TREKKING gewählt (Profil → Design), nicht wie das System: sonst meldet die WebView „dunkel“ bzw. dunkelt
 *  selbst ab, obwohl „Hell“ gewählt ist (Android, Nutzer 22./24.11.). Gemerkt, damit die WebView schon im richtigen Modus startet. */
function applyScheme(s: Scheme) {
  try {
    Appearance.setColorScheme(s === 'auto' ? 'unspecified' : s);
  } catch {
    // ältere Plattformen – egal
  }
}
if (look.scheme) applyScheme(look.scheme);
function setScheme(s: unknown) {
  if (s !== 'light' && s !== 'dark' && s !== 'auto') return;
  applyScheme(s);
  if (s !== look.scheme) saveLook({ scheme: s });
}
const ANDROID = Platform.OS === 'android';

/** Ränder (Statusleiste, Gestenleiste) in dp = CSS-Pixel der WebView */
function insets() {
  const i = initialWindowMetrics?.insets;
  return { top: Math.round(i?.top ?? RNStatusBar.currentHeight ?? 24), bottom: Math.round(i?.bottom ?? 0) };
}

/** Einladungs-/App-Link trekking://open?to=/pfad → Pfad innerhalb von TREKKING (sonst null) */
function target(url: string | null | undefined): string | null {
  const m = url?.match(/^trekking:\/\/open\?to=([^#]+)/);
  if (!m) return null;
  try {
    const to = decodeURIComponent(m[1]);
    return to.startsWith('/') && !to.startsWith('//') ? to : null;
  } catch {
    return null;
  }
}

/** Helle Schrift in der Statusleiste auf dunklen Farben */
function barFor(color: string | null): StatusBarStyle {
  const m = color?.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return 'dark';
  const n = parseInt(m[1], 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum < 150 ? 'light' : 'dark';
}

export default function App() {
  const web = useRef<WebView>(null);
  const ready = useRef(false);
  const watchers = useRef(0);
  const recording = useRef(false);
  const background = useRef(false);
  const [bar, setBar] = useState<StatusBarStyle>('light');
  const [failed, setFailed] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const canBack = useRef(false);
  const wantUpdate = useRef(false);
  const BRIDGE = useMemo(() => bridge(Platform.OS, insets(), BUILD, selfUpdateOk()), []);

  // Android: Zurück-Taste geht in der Seite zurück, erst auf der Startseite schließt sie die App
  useEffect(() => {
    if (!ANDROID) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canBack.current) return false;
      web.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  const inject = useCallback((js: string) => web.current?.injectJavaScript(`${js};true;`), []);
  const sendGeo = useCallback(
    (l: Loc) => {
      if (!ready.current) return false;
      inject(`window.__trekkingGeo && window.__trekkingGeo(${JSON.stringify(l)})`);
      return true;
    },
    [inject],
  );
  const denied = useCallback(() => inject(`window.__trekkingGeoError && window.__trekkingGeoError(1, 'Standort nicht erlaubt')`), [inject]);

  /** Vordergrund-Abo nur, wenn die Seite Standort will und nicht schon die Tour-Aufzeichnung liefert. */
  const updateWatch = useCallback(() => {
    const want = AppState.currentState === 'active' && watchers.current > 0 && !(recording.current && background.current);
    void setWatch(want, (l) => void sendGeo(l), denied);
  }, [sendGeo, denied]);

  /** Im Hintergrund gesammelte Punkte an die Seite (erst, wenn sie bereit ist). */
  const flush = useCallback(() => {
    if (!ready.current) return;
    const b = takeBuffer();
    if (b.length) inject(`window.__trekkingReplay && window.__trekkingReplay(${JSON.stringify(b)})`);
  }, [inject]);

  useEffect(() => {
    setDeliver(sendGeo);
    checkExpiry();
    planExpiryNotes();
    if (ANDROID && canInstall()) void prepare(BUILD);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        flush();
        checkExpiry();
        planExpiryNotes();
        if (ANDROID && canInstall()) void prepare(BUILD);
        if (wantUpdate.current && canInstall()) {
          // vom Einstellungs-Bildschirm („Apps aus dieser Quelle installieren“) zurück
          wantUpdate.current = false;
          void updateNow(BUILD);
        }
      } else if (st === 'background' && ANDROID && !recording.current) {
        // neue Version still einspielen – App endet, beim nächsten Öffnen läuft die neue
        void installReady().catch(() => {});
      }
      updateWatch();
    });
    return () => {
      sub.remove();
      setDeliver(null);
    };
  }, [sendGeo, flush, updateWatch]);

  // App über einen Link geöffnet (Einladung): dorthin – beim Start als erste Seite, sonst in der laufenden WebView
  useEffect(() => {
    Linking.getInitialURL()
      .then((u) => setStart(target(u) ?? '/'))
      .catch(() => setStart('/'));
    const sub = Linking.addEventListener('url', ({ url }) => {
      const to = target(url);
      if (to) inject(`location.assign(${JSON.stringify(to)})`);
    });
    return () => sub.remove();
  }, [inject]);

  const onNav = useCallback(
    async (m: NavMsg) => {
      setNav(m);
      // Android: während der Tour liegt TREKKING über dem Sperrbildschirm – Handy an = App bedienbar, ohne PIN (iPhone erlaubt das nicht)
      showWhenLocked(!!m.on);
      if (m.on && !recording.current) {
        recording.current = true;
        background.current = await startTour().catch(() => false);
        if (!background.current)
          Alert.alert(
            isEn() ? (ANDROID ? 'Allow location' : 'Allow location “Always”') : ANDROID ? 'Standort erlauben' : 'Standort „Immer“ erlauben',
            isEn()
              ? ANDROID
                ? 'So TREKKING can record your tour (even with the screen locked): Permissions → Location → “Allow only while using the app” or “Allow all the time”.'
                : 'So TREKKING can record and give directions with the screen locked: Settings → TREKKING → Location → “Always”.'
              : ANDROID
                ? 'Damit TREKKING deine Tour aufzeichnet (auch bei gesperrtem Bildschirm): Berechtigungen → Standort → „Nur bei Nutzung der App zulassen“ oder „Immer zulassen“.'
                : 'Damit TREKKING auch bei gesperrtem Bildschirm aufzeichnet und ansagt: Einstellungen → TREKKING → Standort → „Immer“.',
            [
              { text: isEn() ? 'Later' : 'Später', style: 'cancel' },
              { text: isEn() ? 'Settings' : 'Einstellungen', onPress: () => void Linking.openSettings() },
            ],
          );
      } else if (!m.on && recording.current) {
        recording.current = false;
        background.current = false;
        await stopTour().catch(() => {});
      }
      updateWatch();
    },
    [updateWatch],
  );

  const onMessage = useCallback(
    (e: WebViewMessageEvent) => {
      let m: { type?: string; [k: string]: unknown };
      try {
        m = JSON.parse(e.nativeEvent.data);
      } catch {
        return;
      }
      switch (m.type) {
        case 'ready':
          ready.current = true;
          flush();
          break;
        case 'geo':
          if (m.op === 'watch') {
            watchers.current = Number(m.n) || 0;
            updateWatch();
          } else if (m.op === 'once') {
            currentPosition()
              .then((l) => (l ? sendGeo(l) : denied()))
              .catch(() => inject(`window.__trekkingGeoError && window.__trekkingGeoError(2, 'Kein Standort')`));
          }
          break;
        case 'nav':
          if (!m.on) clearKm();
          void onNav(m as unknown as NavMsg);
          break;
        case 'km':
          setKm(m as unknown as KmMsg);
          break;
        case 'say':
          if (typeof m.text === 'string') sayFromPage(m.text, typeof m.lang === 'string' ? m.lang : 'de-DE', typeof m.voice === 'string' ? m.voice : undefined, !!m.urgent);
          break;
        case 'hush':
          hush();
          break;
        case 'voices':
          void deviceVoices().then((l) => inject(`window.__trekkingVoices && window.__trekkingVoices(${JSON.stringify(l)})`));
          break;
        case 'savePhoto':
          if (typeof m.id === 'string' && typeof m.data === 'string') {
            const id = m.id;
            void savePhoto(id, m.data)
              .catch(() => false)
              .then((ok) => inject(`window.__trekkingPhotoSaved && window.__trekkingPhotoSaved(${JSON.stringify(id)}, ${ok})`));
          }
          break;
        case 'look':
          if (typeof m.bg === 'string') saveBg(m.bg);
          break;
        case 'lang':
          if (setLang(m.lang)) planExpiryNotes();
          break;
        case 'expiryNotes':
          setExpiryNotes(m.on !== false);
          break;
        case 'icon':
          if (typeof m.name === 'string' || m.name === null) setAppIcon(m.name as string | null);
          break;
        case 'theme':
          setScheme(m.mode);
          break;
        case 'wake':
          // Bildschirm wach (Navigation) – die Android-WebView kennt navigator.wakeLock nicht
          if (m.on) void activateKeepAwakeAsync('page').catch(() => {});
          else void deactivateKeepAwake('page').catch(() => {});
          break;
        case 'file':
          if (typeof m.name === 'string' && typeof m.data === 'string')
            void shareFile(m.name, m.data).catch(() => Alert.alert(isEn() ? 'Sharing failed' : 'Teilen nicht möglich'));
          break;
        case 'share':
          void shareText(String(m.title ?? ''), String(m.text ?? ''), String(m.url ?? '')).catch(() => {});
          break;
        case 'selfUpdate':
          void updateNow(BUILD).then((ok) => {
            if (!ok) wantUpdate.current = true;
          });
          break;
        case 'bar':
          setBar(barFor(typeof m.color === 'string' ? m.color : null));
          break;
        case 'google':
          if (typeof m.url === 'string' && m.url.startsWith('https://accounts.google.com/'))
            void WebBrowser.openAuthSessionAsync(m.url, 'trekking://google').then((r) => {
              if (r.type !== 'success' || !r.url) return;
              const hash = r.url.slice(r.url.indexOf('#'));
              if (hash.startsWith('#')) inject(`location.replace('/profil/konto' + ${JSON.stringify(hash)})`);
            });
          break;
      }
    },
    [flush, updateWatch, sendGeo, denied, inject, onNav],
  );

  if (failed)
    return (
      <View style={[styles.fill, styles.center]}>
        <StatusBar style="light" />
        <Text style={styles.title}>Keine Verbindung</Text>
        <Text style={styles.text}>TREKKING braucht beim ersten Start Internet.</Text>
        <Pressable style={styles.button} onPress={() => setFailed(false)}>
          <Text style={styles.buttonText}>Nochmal</Text>
        </Pressable>
      </View>
    );

  if (start == null) return <View style={[styles.fill, { backgroundColor: savedBg }]} />;

  return (
    <KeyboardAvoidingView style={[styles.fill, { backgroundColor: savedBg }]} behavior={ANDROID ? 'height' : undefined} enabled={ANDROID}>
      <StatusBar style={bar} />
      <Web
        ref={web}
        source={{ uri: `${HOME}${start}` }}
        style={[styles.fill, { backgroundColor: savedBg }]}
        injectedJavaScriptBeforeContentLoaded={BRIDGE}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly
        onMessage={onMessage}
        onLoadStart={() => {
          ready.current = false;
        }}
        onError={() => setFailed(true)}
        limitsNavigationsToAppBoundDomains
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        bounces={false}
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grant"
        allowsLinkPreview={false}
        allowsBackForwardNavigationGestures={false}
        sharedCookiesEnabled
        applicationNameForUserAgent={ANDROID ? 'TREKKING-Android/1' : 'TREKKING-iOS/1'}
        // Alle Adressen in den eigenen Handler: die Standard-Liste (nur http/https) prüft andere Schemata per canOpenURL – das ist ohne
        // LSApplicationQueriesSchemes bzw. <queries> immer false, sidestore:// und mailto: taten dann nichts (Nutzer 25.11.).
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(r: ShouldStartLoadRequest) => {
          // Mail/Telefon/SideStore … an das System geben (alles außer Web-Adressen)
          if (!/^(https?|about|blob|data|file):/.test(r.url)) {
            void Linking.openURL(r.url);
            return false;
          }
          // Fremde Seiten (Quellen, Lawinendienste …) im Browser öffnen, die App bleibt auf TREKKING
          if (r.isTopFrame && /^https?:/.test(r.url) && !r.url.startsWith(HOME)) {
            void Linking.openURL(r.url);
            return false;
          }
          return true;
        }}
        onOpenWindow={(e: WebViewOpenWindowEvent) => void Linking.openURL(e.nativeEvent.targetUrl)}
        onNavigationStateChange={(st: { canGoBack: boolean }) => {
          canBack.current = st.canGoBack;
        }}
        // Android
        geolocationEnabled={false}
        allowFileAccess
        mediaPlaybackRequiresUserAction={false}
        overScrollMode="never"
        textZoom={100}
        androidLayerType="hardware"
        thirdPartyCookiesEnabled
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: TEAL },
  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  text: { color: '#fff', fontSize: 16, textAlign: 'center' },
  button: { marginTop: 12, backgroundColor: '#fff', borderRadius: 28, paddingHorizontal: 32, paddingVertical: 14 },
  buttonText: { color: TEAL, fontSize: 17, fontWeight: '700' },
});
