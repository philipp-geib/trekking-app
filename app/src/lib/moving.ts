// Zeit in Bewegung für ein Stück der Aufzeichnung – gemeinsam für tourStats (ganze Tour) und kmVoice (laufend, auch in der App-Hülle bei
// gesperrtem Bildschirm). Nur geo als Abhängigkeit (die Hülle bindet die Datei direkt ein).
import { distance } from './geo';

/** Länger als so ohne nennenswerte Bewegung = Pause (Nutzer: Ampel, kurz stehen – ab 5 s raus). Punkte kommen nur, wenn man sich ≥ 3 m bewegt. */
export const PAUSE_GAP = 5_000;
/** Langsamstes Tempo, das noch als Bewegung zählt (m/s, ≈ 0,9 km/h). */
export const MIN_SPEED = 0.25;
/** Tempo über einem GPS-Sprung zählt nicht als Bezug (m/s). */
const MAX_REF = 30;

type P = { lat: number; lng: number; time: number; seg?: boolean };

/**
 * Bewegungszeit (ms) von a nach b. Lücke > 5 s unter halbem eigenem Tempo davor (`ref`, m/s) zählt nur mit diesem Tempo, der Rest ist Pause;
 * gleichmäßig langsam (steil bergauf) bleibt Bewegung. Gibt den neuen Bezug mit zurück.
 */
export function movingStep(a: P, b: P, ref: number): { ms: number; ref: number } {
  const dt = b.time - a.time;
  if (b.seg || dt <= 0) return { ms: 0, ref };
  const d = distance(a, b);
  const v = d / (dt / 1000);
  if (dt <= PAUSE_GAP) return { ms: dt, ref: v <= MAX_REF ? Math.max(MIN_SPEED, v) : ref };
  if (v >= ref / 2) return { ms: dt, ref: Math.max(MIN_SPEED, v) };
  return { ms: (d / ref) * 1000, ref };
}
