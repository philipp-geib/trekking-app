// Standort für die Web-App: im Vordergrund ein normales Abo (Karte, Planer, Wetter), während einer Tour die Hintergrund-
// Aufzeichnung (iOS: blaue Anzeige oben, Android: Vordergrund-Dienst mit Mitteilung; läuft bei gesperrtem Bildschirm weiter). Punkte aus dem Hintergrund werden
// gesammelt (auch in einer Datei, falls die App neu startet) und nach dem Entsperren an die Web-App übergeben.
import { isEn } from './lang';
import { File, Paths } from 'expo-file-system';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { AppState, Platform } from 'react-native';
import { guideStep } from './guide';
import { kmBackground } from './km';

export const TASK = 'trekking-tour-location';

export type Loc = {
  timestamp: number;
  coords: { latitude: number; longitude: number; accuracy: number | null; altitude: number | null; altitudeAccuracy: number | null; heading: number | null; speed: number | null };
};

const plain = (l: Location.LocationObject): Loc => ({
  timestamp: l.timestamp,
  coords: {
    latitude: l.coords.latitude,
    longitude: l.coords.longitude,
    accuracy: l.coords.accuracy,
    altitude: l.coords.altitude,
    altitudeAccuracy: l.coords.altitudeAccuracy,
    heading: l.coords.heading,
    speed: l.coords.speed,
  },
});

const store = new File(Paths.document, 'pending-locations.json');
const buffer: Loc[] = (() => {
  try {
    return store.exists ? (JSON.parse(store.textSync()) as Loc[]) : [];
  } catch {
    return [];
  }
})();
let unsaved = 0;
function save(force = false) {
  if (!force && ++unsaved < 20) return;
  unsaved = 0;
  try {
    if (!store.exists) store.create();
    store.write(JSON.stringify(buffer));
  } catch {
    /* nächster Versuch */
  }
}

/** Live-Weitergabe an die WebView (App.tsx); false = gerade nicht möglich → sammeln. */
let deliver: ((l: Loc) => boolean) | null = null;
export function setDeliver(fn: ((l: Loc) => boolean) | null) {
  deliver = fn;
}

/** Gesammelte Punkte abholen (nach dem Entsperren). */
export function takeBuffer(): Loc[] {
  const out = buffer.splice(0);
  save(true);
  return out;
}

TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TASK, async ({ data, error }) => {
  if (error || !data) return;
  const active = AppState.currentState === 'active';
  for (const raw of data.locations) {
    const l = plain(raw);
    guideStep(l, !active);
    if (!active) kmBackground(l);
    if (active && !buffer.length && deliver?.(l)) continue;
    buffer.push(l);
    save();
  }
});

export type Permission = 'granted' | 'denied';

export async function foregroundPermission(): Promise<Permission> {
  const r = await Location.requestForegroundPermissionsAsync();
  return r.granted ? 'granted' : 'denied';
}

/** Aufzeichnung im Hintergrund an. Ohne „Immer“-Erlaubnis false (dann nur bei offenem Bildschirm). */
export async function startTour(): Promise<boolean> {
  if ((await foregroundPermission()) !== 'granted') return false;
  // Android: Vordergrund-Dienst (unten) reicht mit „Bei Nutzung der App“ – „Immer zulassen“ braucht es dort nicht
  // (und Android 11+ schickt dafür nur in die Einstellungen). iPhone: ohne „Immer“ stoppt die Aufzeichnung beim Sperren.
  if (Platform.OS === 'ios') {
    const bg = await Location.requestBackgroundPermissionsAsync().catch(() => ({ granted: false }));
    if (!bg.granted) return false;
  }
  if (await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false)) return true;
  await Location.startLocationUpdatesAsync(TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    distanceInterval: 5,
    activityType: Location.ActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    // Android: Aufzeichnung als Vordergrund-Dienst mit dauerhafter Mitteilung (sonst stoppt Android sie im Hintergrund)
    foregroundService: {
      notificationTitle: isEn() ? 'TREKKING is recording' : 'TREKKING zeichnet auf',
      notificationBody: isEn() ? 'Your tour is recorded even with the screen locked.' : 'Deine Tour wird auch bei gesperrtem Bildschirm aufgezeichnet.',
      notificationColor: '#438482',
      killServiceOnDestroy: false,
    },
  });
  return true;
}

export async function stopTour() {
  if (await Location.hasStartedLocationUpdatesAsync(TASK).catch(() => false)) await Location.stopLocationUpdatesAsync(TASK);
  save(true);
}

/** Normales Standort-Abo (App offen, keine Tour bzw. ohne „Immer“-Erlaubnis). */
let watch: Location.LocationSubscription | null = null;
let starting = false;
let wanted = false;
export async function setWatch(on: boolean, cb: (l: Loc) => void, onDenied: () => void) {
  wanted = on;
  if (!on) {
    watch?.remove();
    watch = null;
    return;
  }
  if (watch || starting) return;
  starting = true;
  try {
    if ((await foregroundPermission()) !== 'granted') return onDenied();
    // mayShowUserSettingsDialog: false – sonst prüft Android bei ausgeschalteter „Google-Standortgenauigkeit“ erst die Einstellungen (Dialog);
    // abgelehnt oder ohne Netz nicht prüfbar → GPS startete nie (Nutzer 28.11.: „kein GPS in den Bergen“). GPS allein reicht.
    const w = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 3, mayShowUserSettingsDialog: false },
      (l) => cb(plain(l)),
    );
    // während des Startens abbestellt (Seite weg, App im Hintergrund) → gleich wieder aus, sonst lief GPS weiter
    if (wanted) watch = w;
    else w.remove();
  } finally {
    starting = false;
  }
}

/** Einzelner Standort. null = nicht erlaubt; wirft 'off' (Ortung am Handy aus) bzw. 'nofix' (noch kein GPS-Signal).
 *  Läuft schon eine Abfrage, warten alle darauf – ohne Netz dauert der erste Fix Minuten, die Seite fragt alle 5 s nach. */
let once: Promise<Loc | null> | null = null;
export function currentPosition(): Promise<Loc | null> {
  once ??= (async () => {
    if ((await foregroundPermission()) !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 10_000 }).catch(() => null);
    if (last) return plain(last);
    try {
      return plain(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High, mayShowUserSettingsDialog: false }));
    } catch {
      throw new Error((await Location.hasServicesEnabledAsync().catch(() => true)) ? 'nofix' : 'off');
    }
  })().finally(() => (once = null));
  return once;
}
