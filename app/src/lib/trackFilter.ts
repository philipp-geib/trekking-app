// Welche GPS-Messung wird ein Punkt der Aufzeichnung? (lib/tracking.ts)
// Rohwerte springen: Zittern im Stand und am Weg, einzelne Ausreißer, alte Werte aus dem Zwischenspeicher (beim Zurückholen
// der App, Nachholen aus der iPhone-App). Jeder Sprung zählte früher als Strecke – aus 1,9 km wurden so 5,9 km (Nutzer 22.11.).
// Deshalb: veraltete und unmögliche Messungen verwerfen, Position glätten (einfacher Kalman-Filter, Genauigkeit = Messrauschen),
// im Stand (GPS-Tempo ≈ 0) erst ab der Genauigkeit einen neuen Punkt.
import { distance } from './geo';
import { isFoot, isHike, type Sport } from './sport';

/** Messungen, die ungenauer sind, zählen nicht für Strecke und Höhenmeter. */
export const MAX_TRACK_ACCURACY = 50;
/** Schneller als das (m/s, ≈ 250 km/h) ist ein Ausreißer – auch im Auto. */
const MAX_SPEED = 70;
/** Unter diesem GPS-Tempo (m/s) gilt man als stehend. */
const STILL = 0.4;

/** Zustand des Glättungsfilters: geglättete Position, Unsicherheit (m²), Zeit der letzten Messung. */
export type Kf = { lat: number; lng: number; v: number; t: number };

export type Fix = { lat: number; lng: number; time: number; accuracy: number | null; speed?: number | null };

const still = (speed?: number | null) => speed != null && speed >= 0 && speed < STILL;

/** Wie schnell sich die Position ändern darf (m/s) – höher = folgt schneller, glättet weniger. Im Stand fast gar nicht. */
export const filterSpeed = (sport: Sport, gpsSpeed?: number | null) =>
  still(gpsSpeed) ? 0.3 : Math.max(isHike(sport) ? 2.5 : isFoot(sport) ? 4 : 6, gpsSpeed ?? 0);

export type Step = {
  kf: Kf;
  /** neuer Punkt der Aufzeichnung (geglättet) oder null = noch zu nah am letzten */
  at: { lat: number; lng: number } | null;
  /** Abstand zum letzten Punkt (m) */
  moved: number;
};

/**
 * Nächster Schritt. null = Messung verwerfen (veraltet, zu ungenau, Ausreißer); Filter bleibt dann, wie er ist.
 * `last` = letzter gespeicherter Punkt, `fresh` = nach dem Fortsetzen neu beginnen.
 */
export function trackStep(kf: Kf | undefined, last: { lat: number; lng: number; time: number } | undefined, fix: Fix, sport: Sport, fresh = false): Step | null {
  // alt oder doppelt (Zwischenspeicher, Nachholen, zwei Standort-Abos) – sonst springt der Weg zurück und wieder vor
  if (last && fix.time <= last.time) return null;
  if (kf && fix.time <= kf.t) return null;
  const acc = Math.max(3, fix.accuracy ?? 10);
  if (fix.accuracy != null && fix.accuracy > MAX_TRACK_ACCURACY) return null;
  const prev = fresh ? undefined : kf;
  if (prev) {
    const dt = (fix.time - prev.t) / 1000;
    if (dt < 60 && distance(prev, fix) > MAX_SPEED * dt + 2 * acc) return null;
  }
  let next: Kf;
  if (!prev) next = { lat: fix.lat, lng: fix.lng, v: acc * acc, t: fix.time };
  else {
    const q = filterSpeed(sport, fix.speed);
    const v = prev.v + ((fix.time - prev.t) / 1000) * q * q;
    const k = v / (v + acc * acc);
    next = { lat: prev.lat + k * (fix.lat - prev.lat), lng: prev.lng + k * (fix.lng - prev.lng), v: (1 - k) * v, t: fix.time };
  }
  const at = { lat: next.lat, lng: next.lng };
  if (!last || fresh) return { kf: next, at, moved: 0 };
  const moved = distance(last, at);
  const need = Math.max(3, acc * 0.7, still(fix.speed) ? acc : 0);
  return { kf: next, at: moved >= need ? at : null, moved };
}

/** Bewegungssensor: Streuung (m/s²) der Beschleunigung, unter der das Handy als ruhend gilt (Gehen ≈ 1–3, Rad am Lenker ≥ 0,3). */
const STILL_SHAKE = 0.18;

/**
 * Steht man? Aus den Beträgen der Beschleunigung (inkl. Schwerkraft) der letzten Sekunden – Drehen des Handys ändert den Betrag nicht.
 * null = zu wenig Werte (kein Sensor, keine Freigabe).
 */
export function stillFromMotion(values: number[]): boolean | null {
  if (values.length < 20) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  return sd < STILL_SHAKE;
}

/** GPS-Tempo für den Filter: fehlt es oder ist es klein und der Bewegungssensor meldet Ruhe → 0 (stehen). */
export function speedForFilter(gps: number | null | undefined, motionStill: boolean | null): number | null {
  const v = gps != null && Number.isFinite(gps) && gps >= 0 ? gps : null;
  if (motionStill === true && (v == null || v < 1)) return 0;
  return v;
}
